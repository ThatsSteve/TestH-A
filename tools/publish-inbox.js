#!/usr/bin/env node
// Applies what the studio dashboard sent (content/inbox) to the site data:
// converts the new photos to WebP in several sizes, adds, changes or removes projects
// in assets/js/data.js, then deletes the processed requests.
// Run by the GitHub workflow before build.js. Locally: node tools/publish-inbox.js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INBOX = path.join(ROOT, 'content', 'inbox');
const DATA = path.join(ROOT, 'assets', 'js', 'data.js');
const IMG = path.join(ROOT, 'assets', 'img', 'projects');
const MAX = 2200, STEPS = [480, 800, 1200, 1600];
const FACTS = ['Location', 'Client', 'Tipology', 'Size', 'Status', 'Credits'];
const skipped = []; // files left out because they could not be read

// data.js is a one-line wrapper around JSON: keep the wrapper, rewrite only the JSON
const readData = () => {
  const text = fs.readFileSync(DATA, 'utf8');
  const open = text.indexOf('})(');
  const close = text.lastIndexOf(');');
  if (open < 0 || close < open) throw new Error('data.js: unexpected format');
  return { head: text.slice(0, open + 3), data: JSON.parse(text.slice(open + 3, close)), tail: text.slice(close) };
};
const writeData = f => fs.writeFileSync(DATA, f.head + JSON.stringify(f.data) + f.tail);

// ffmpeg and ffprobe must be on the PATH; heif-convert (libheif) is used for iPhone HEIC photos
// when this ffmpeg cannot read them
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 });
const dims = f => run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(/[,\s]+/).slice(0, 2).map(Number);
const duration = f => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()) || 0;
const enc = (inp, out, w) => run('ffmpeg', ['-v', 'error', '-y', '-i', inp, '-map_metadata', '-1', '-vf', `scale=${w}:-2:flags=lanczos`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', out]);
const VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi|3gp|mpe?g|wmv)$/i;
const tmpFile = ext => path.join(os.tmpdir(), `ha-inbox-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);

// Any picture ffmpeg cannot read directly (HEIC) is first turned into a JPEG
function readable(inp) {
  try { dims(inp); return inp; } catch (e) { /* try libheif below */ }
  const out = tmpFile('.jpg');
  try { run('heif-convert', ['-q', '95', inp, out]); } catch (e) { throw new Error(`cannot read the photo ${path.basename(inp)}`); }
  return out;
}

// One photo -> slug-NN.webp (max 2200 px wide) plus smaller copies named -WxH
function convert(file, slug) {
  const inp = readable(file);
  const dir = path.join(IMG, slug);
  fs.mkdirSync(dir, { recursive: true });
  let n = 1, name;
  do name = `${slug}-${String(n++).padStart(2, '0')}`; while (fs.existsSync(path.join(dir, name + '.webp')) || fs.existsSync(path.join(dir, name + '.mp4')));
  const full = Math.min(dims(inp)[0], MAX);
  enc(inp, path.join(dir, name + '.webp'), full);
  const [w, h] = dims(path.join(dir, name + '.webp'));
  const v = [];
  for (const s of STEPS.filter(s => s < full - 100)) {
    const tmp = path.join(dir, `${name}-tmp.webp`);
    enc(inp, tmp, s);
    const [vw, vh] = dims(tmp);
    fs.renameSync(tmp, path.join(dir, `${name}-${vw}x${vh}.webp`));
    v.push(`-${vw}x${vh}`);
  }
  if (inp !== file) fs.rmSync(inp, { force: true });
  return { src: `/assets/img/projects/${slug}/${name}.webp`, w, h, v };
}

// One video -> slug-NN.mp4 (H.264, at most 1920 px wide, starts playing while it loads)
// plus a still frame used as its poster (slug-NN.webp and its smaller copies)
function convertVideo(inp, slug) {
  const t = Math.min(1, duration(inp) / 2);
  const still = tmpFile('.png');
  run('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', inp, '-frames:v', '1', still]);
  const poster = convert(still, slug);
  fs.rmSync(still, { force: true });
  const out = path.join(ROOT, poster.src.replace(/\.webp$/, '.mp4'));
  run('ffmpeg', ['-v', 'error', '-y', '-i', inp, '-map_metadata', '-1', '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', "scale='min(1920,iw)':-2:flags=lanczos,format=yuv420p", '-c:v', 'libx264', '-preset', 'medium', '-crf', '26',
    '-maxrate', '5M', '-bufsize', '10M', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  const [w, h] = dims(out);
  return Object.assign(poster, { w, h, video: poster.src.replace(/\.webp$/, '.mp4') });
}

// A file sent by the dashboard: in one piece, in several pieces, or inside the request itself
function media(g, dir, slug) {
  const name = typeof g.name === 'string' && /^[\w-]+\.[a-z0-9]{2,5}$/i.test(g.name) ? g.name : typeof g.file === 'string' && /^[\w.-]+$/.test(g.file) ? g.file : null;
  if (!name) return null;
  const tmp = tmpFile(path.extname(name).toLowerCase());
  try {
    if (Array.isArray(g.parts)) {
      fs.writeFileSync(tmp, '');
      for (const part of g.parts) {
        if (typeof part !== 'string' || !/^[\w.-]+$/.test(part)) throw new Error(`${slug}: bad file piece`);
        const f = path.join(dir, part);
        if (!fs.existsSync(f)) throw new Error(`${slug}: piece ${part} of ${name} missing`);
        fs.appendFileSync(tmp, fs.readFileSync(f));
      }
    } else if (typeof g.data === 'string') {
      fs.writeFileSync(tmp, Buffer.from(g.data, 'base64'));
    } else {
      const f = path.join(dir, name);
      if (!fs.existsSync(f)) throw new Error(`${slug}: file ${name} missing`);
      fs.copyFileSync(f, tmp);
    }
    if (fs.statSync(tmp).size < 100) throw new Error(`${slug}: file ${name} is empty`);
    return VIDEO.test(name) || g.kind === 'video' ? convertVideo(tmp, slug) : convert(tmp, slug);
  } finally { fs.rmSync(tmp, { force: true }); }
}

const str = (x, max) => typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const isImage = g => g && typeof g.src === 'string' && /^(\/assets\/img\/projects\/|https:\/\/)/.test(g.src) && g.w > 0 && g.h > 0;
const keep = k => {
  const g = { src: k.src, w: +k.w, h: +k.h, v: (k.v || []).filter(s => /^-\d+x\d+$/.test(s)) };
  if (typeof k.video === 'string' && /^\/assets\/img\/projects\/[\w-]+\/[\w-]+\.mp4$/.test(k.video)) g.video = k.video;
  return g;
};

function applySave(D, req, dir) {
  const p = req.project || {};
  const slug = str(req.slug, 90);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`bad web address "${req.slug}"`);
  const title = str(p.title, 160);
  if (!title) throw new Error(`${slug}: missing title`);
  const prev = str(req.previousSlug, 90) || slug;
  const idx = D.projects.findIndex(x => x.slug === prev);
  if (slug !== prev && D.projects.some(x => x.slug === slug)) throw new Error(`${slug}: web address already used`);
  if (idx < 0 && D.projects.some(x => x.slug === slug)) throw new Error(`${slug}: web address already used`);
  const areaIds = new Set(D.areas.map(a => a.id));
  const areas = (Array.isArray(p.areas) ? p.areas : []).map(Number).filter(a => areaIds.has(a));
  if (!areas.length) throw new Error(`${slug}: choose at least one area`);
  const facts = {};
  for (const k of FACTS) { const v = str(p.facts && p.facts[k], 200); if (v) facts[k] = v; }
  const desc = (Array.isArray(p.desc) ? p.desc : []).map(t => typeof t === 'string' ? t.replace(/[ \t]+/g, ' ').trim() : '').filter(Boolean).slice(0, 40);
  const gallery = (Array.isArray(p.gallery) ? p.gallery : []).map(g => {
    if (g && g.keep && isImage(g.keep)) return keep(g.keep);
    if (g && (g.name || g.file)) {
      // a file that cannot be read (damaged, unknown format) is left out; the rest is published
      try { return media(g, dir, slug); } catch (e) { skipped.push(`${slug}/${g.name || g.file}: ${e.message.split('\n')[0]}`); return null; }
    }
    return null;
  }).filter(Boolean);
  if (!gallery.length) throw new Error(`${slug}: at least one photo is needed`);
  let geo = null;
  if (Array.isArray(p.geo) && p.geo.length === 2) {
    const [la, lo] = p.geo.map(Number);
    if (Math.abs(la) <= 90 && Math.abs(lo) <= 180) geo = [+la.toFixed(4), +lo.toFixed(4)];
  }

  const old = idx >= 0 ? D.projects[idx] : null;
  const rec = { slug, title, order: old ? old.order : 4 };
  if (old && old.added) rec.added = old.added;
  if (!old) rec.added = new Date().toISOString().slice(0, 10);
  // the cover is the first photo; if there are only videos, the first video's still frame
  const first = gallery.find(g => !g.video) || gallery[0];
  const cover = { src: first.src, w: first.w, h: first.h, v: first.v };
  Object.assign(rec, { areas, facts, desc, gallery, cover });
  if (geo) rec.geo = geo;
  if (old) D.projects[idx] = rec;
  else D.projects.splice(D.projects.filter(x => x.order <= 3).length, 0, rec); // newest right after the featured ones
  return `${old ? 'updated' : 'added'} ${title}`;
}

function applyRemove(D, req) {
  const slug = str(req.slug, 90);
  const i = D.projects.findIndex(x => x.slug === slug);
  if (i < 0) return `nothing to remove for ${slug}`;
  const [gone] = D.projects.splice(i, 1);
  return `removed ${gone.title}`;
}

// Deletes local photos no project uses any more (after removals and changes)
function prune(D) {
  if (!fs.existsSync(IMG)) return 0;
  const used = new Set();
  for (const p of D.projects) for (const g of [p.cover, ...p.gallery]) {
    if (!g || !g.src.startsWith('/assets/')) continue;
    used.add(g.src);
    if (g.video) used.add(g.video);
    for (const s of g.v || []) used.add(g.src.replace(/\.webp$/, s + '.webp'));
  }
  let n = 0;
  for (const slug of fs.readdirSync(IMG)) {
    const dir = path.join(IMG, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (!used.has(`/assets/img/projects/${slug}/${f}`)) { fs.rmSync(path.join(dir, f)); n++; }
    if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  return n;
}

function main() {
  const reqs = fs.existsSync(INBOX) ? fs.readdirSync(INBOX).filter(f => f.endsWith('.json')).sort() : [];
  if (!reqs.length) { console.log('Inbox empty: nothing to publish.'); return; }
  const file = readData();
  const done = [];
  for (const name of reqs) {
    const req = JSON.parse(fs.readFileSync(path.join(INBOX, name), 'utf8'));
    const dir = path.join(INBOX, name.replace(/\.json$/, ''));
    done.push(req.action === 'remove' ? applyRemove(file.data, req) : applySave(file.data, req, dir));
  }
  writeData(file);
  const pruned = prune(file.data);
  fs.rmSync(INBOX, { recursive: true, force: true });
  fs.mkdirSync(INBOX, { recursive: true });
  fs.writeFileSync(path.join(INBOX, '.gitkeep'), '');
  if (skipped.length) done.push(`left out ${skipped.length} unreadable file(s)`);
  console.log(done.join('\n') + (pruned ? `\n${pruned} unused photo files deleted` : '') + (skipped.length ? '\nLeft out:\n' + skipped.join('\n') : ''));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `summary=${done.join('; ').replace(/[\r\n]/g, ' ')}\n`);
}

main();
