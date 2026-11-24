// Studio dashboard backend (Netlify Function): lets /studio-upload/ publish without a GitHub key
// in the browser. The key lives only in the Netlify settings, as the environment variable GITHUB_TOKEN.
// It can only add files under content/inbox/; the GitHub workflow does the rest.
// Optional: set STUDIO_CODE to require a password from the dashboard (no password while testing).

const REPO = process.env.STUDIO_REPO || 'ThatsSteve/TestH-A';
const BRANCH = process.env.STUDIO_BRANCH || 'main';
const API = `https://api.github.com/repos/${REPO}`;
const INBOX_PATH = /^content\/inbox\/\d{8}-\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*(?:\.json|\/[\w-]+\.[a-z0-9]{2,5}(?:\.\d{3})?)$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function gh(path, opt = {}) {
  const r = await fetch(API + path, {
    method: opt.method || 'GET',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'studio-dashboard',
      ...(opt.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: opt.body ? JSON.stringify(opt.body) : undefined
  });
  if (r.status === 404 && opt.allow404) return null;
  if (!r.ok) { const e = new Error(`GitHub ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

async function status() {
  const items = await gh(`/contents/content/inbox?ref=${BRANCH}`, { allow404: true });
  const pending = (items || []).map(f => (/^\d{8}-\d{6}-(.+)\.json$/.exec(f.name) || [])[1]).filter(Boolean);
  let run = null;
  try {
    const r = await gh(`/actions/workflows/publish.yml/runs?per_page=1&branch=${BRANCH}`, { allow404: true });
    const x = r && r.workflow_runs && r.workflow_runs[0];
    if (x) run = { status: x.status, conclusion: x.conclusion, at: x.updated_at };
  } catch (e) { /* the key may not read Actions: the status is optional */ }
  return { ready: true, pending, run };
}

async function blob(content) {
  if (typeof content !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(content)) throw Object.assign(new Error('bad data'), { status: 400 });
  const b = await gh('/git/blobs', { method: 'POST', body: { content, encoding: 'base64' } });
  return { sha: b.sha };
}

async function commit(files, message) {
  if (!Array.isArray(files) || !files.length || files.length > 600) throw Object.assign(new Error('bad files'), { status: 400 });
  const tree = [];
  for (const f of files) {
    if (!f || typeof f.path !== 'string' || !INBOX_PATH.test(f.path)) throw Object.assign(new Error(`not allowed: ${f && f.path}`), { status: 400 });
    if (typeof f.text === 'string') {
      if (!f.path.endsWith('.json') || f.text.length > 200000) throw Object.assign(new Error('bad request file'), { status: 400 });
      const b = await gh('/git/blobs', { method: 'POST', body: { content: f.text, encoding: 'utf-8' } });
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha });
    } else if (typeof f.sha === 'string' && /^[0-9a-f]{40}$/.test(f.sha)) {
      tree.push({ path: f.path, mode: '100644', type: 'blob', sha: f.sha });
    } else throw Object.assign(new Error('bad file'), { status: 400 });
  }
  const msg = String(message || 'Studio dashboard upload').replace(/[\r\n]+/g, ' ').slice(0, 200);
  for (let left = 3; ; left--) {
    try {
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const parent = await gh(`/git/commits/${ref.object.sha}`);
      const t = await gh('/git/trees', { method: 'POST', body: { base_tree: parent.tree.sha, tree } });
      const c = await gh('/git/commits', { method: 'POST', body: { message: msg, tree: t.sha, parents: [ref.object.sha] } });
      await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: c.sha } });
      return { ok: true };
    } catch (e) {
      if (left > 1 && (e.status === 422 || e.status === 409)) continue;
      throw e;
    }
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method' }, 405);
  if (!process.env.GITHUB_TOKEN) return reply({ ready: false, error: 'not-configured' }, 503);
  let body;
  try { body = await req.json(); } catch (e) { return reply({ error: 'bad-json' }, 400); }
  if (process.env.STUDIO_CODE && body.code !== process.env.STUDIO_CODE) return reply({ error: 'code' }, 401);
  try {
    if (body.op === 'status') return reply(await status());
    if (body.op === 'blob') return reply(await blob(body.content));
    if (body.op === 'commit') return reply(await commit(body.files, body.message));
    return reply({ error: 'op' }, 400);
  } catch (e) {
    return reply({ error: e.message }, e.status && e.status < 500 ? (e.status === 401 || e.status === 403 ? 502 : e.status) : 502);
  }
};
