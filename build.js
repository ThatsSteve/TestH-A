/* H&A Associati — static build
   Pre-renders every route to its own index.html (same URLs as hastudio.it),
   with title, description, canonical, Open Graph and JSON-LD, plus sitemap.xml
   and robots.txt.
   All internal links and assets are relative, so the same files work at a
   domain root (Netlify, final domain) and in a sub-folder (GitHub Pages).
   Usage:  node build.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const D = require('./assets/js/data.js');
const L = require('./assets/js/logo.js');
const V = require('./assets/js/views.js')(D, L, '');
// Sub-folders the site may be published under. Only 404.html needs this,
// because it can be served at any depth.
const SUBFOLDERS = ['/TestH-A/'];

// Cache-busting version from the asset contents
const assets = ['assets/css/style.css', 'assets/js/data.js', 'assets/js/logo.js', 'assets/js/views.js', 'assets/js/hero-gl.js', 'assets/js/lightbox.js', 'assets/js/map.js', 'assets/js/app.js'];
const ver = crypto.createHash('md5').update(assets.map(a => fs.readFileSync(path.join(ROOT, a))).join('')).digest('hex').slice(0, 8);

// iubenda: paste the code from the iubenda dashboard (Cookie Solution, "Embed") into iubenda.html
// at the site root and run the build again; it goes into the <head> of every page. Without the file nothing is added.
const IUBENDA = fs.existsSync(path.join(ROOT, 'iubenda.html')) ? fs.readFileSync(path.join(ROOT, 'iubenda.html'), 'utf8').trim() + '\n' : '';

// Tells the browser-side router where the site root is (links in the HTML are already relative)
const baseScript = rel => `<script>window.HA_BASE=new URL(${JSON.stringify(rel)},location.href).pathname.slice(0,-1);</script>`;

// rel: path from the page back to the site root ("./", "../", "../../")
function page(r, rel) {
  const m = r.meta;
  const url = V.SITE_URL + m.path;
  const ld = m.jsonld && m.jsonld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': m.jsonld }).replace(/</g, '\\u003c')}</script>` : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${baseScript(rel)}
${IUBENDA}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${V.esc(m.title)}</title>
<meta name="description" content="${V.esc(m.description)}">
<meta name="robots" content="${m.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#022753">
<meta property="og:type" content="${r.name === 'project' ? 'article' : 'website'}">
<meta property="og:site_name" content="H&amp;A Associati">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${V.esc(m.title)}">
<meta property="og:description" content="${V.esc(m.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${V.esc(m.image)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/logo.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/rubik-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/rubik-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://www.hastudio.it">
<link rel="stylesheet" href="/assets/css/style.css?v=${ver}">
<script>document.documentElement.classList.add('js');if('scrollRestoration' in history)history.scrollRestoration='manual';</script>
${ld}
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
<div class="loader" aria-hidden="true"><div class="loader__mark">${V.markSVG()}</div><div class="loader__count"><span>0</span></div></div>
${V.header()}
<main id="main" tabindex="-1">
${r.html}
</main>
${V.footer()}
<div class="curtain" aria-hidden="true"><div class="curtain__mark">${V.markSVG()}</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
<script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js" defer></script>
<script src="/assets/js/data.js?v=${ver}" defer></script>
<script src="/assets/js/logo.js?v=${ver}" defer></script>
<script src="/assets/js/views.js?v=${ver}" defer></script>
<script src="/assets/js/lightbox.js?v=${ver}" defer></script>
<script src="/assets/js/hero-gl.js?v=${ver}" defer></script>
<script src="/assets/js/map.js?v=${ver}" defer></script>
<script src="/assets/js/app.js?v=${ver}" defer></script>
</body>
</html>
`;
  // Turn every root-relative link ("/projects/x/") into a page-relative one ("../../projects/x/")
  return html
    .replace(/(href|src|poster)="\/(?!\/)/g, `$1="${rel}`)
    .replace(/srcset="([^"]*)"/g, (m, v) => `srcset="${v.split(', ').map(s => (/^\/(?!\/)/.test(s) ? rel + s.slice(1) : s)).join(', ')}"`);
}

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Remove previously generated route folders so deleted projects do not linger
for (const dir of ['projects', 'area', 'the-firm', 'people', 'contacts']) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });

const paths = V.allPaths();
const relFor = p => '../'.repeat(p.split('/').filter(Boolean).length) || './';
for (const p of paths) write(path.join(p, 'index.html'), page(V.render(p), relFor(p)));
// 404.html can be served at any depth and on any host, so it is self-contained
write('404.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | H&amp;A Associati</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#022753">
<style>
  html, body { height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: #022753; color: #fff; font-family: Rubik, system-ui, -apple-system, 'Segoe UI', sans-serif; font-weight: 300; text-align: center; padding: 24px; box-sizing: border-box; }
  svg { width: 120px; height: auto; display: block; margin: 0 auto 40px; }
  h1 { font-weight: 300; font-size: clamp(2.2rem, 7vw, 5rem); letter-spacing: -.04em; margin: 0 0 28px; }
  a { color: #fff; text-transform: uppercase; letter-spacing: .14em; font-size: .78rem; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,.5); padding-bottom: 4px; }
  a:hover { border-color: #fff; }
</style>
</head>
<body>
<main>
${V.markSVG()}
<h1>Page not found</h1>
<a id="home" href="/">Back to home</a>
</main>
<script>(function(){var s=${JSON.stringify(SUBFOLDERS)},p=location.pathname,b='/';for(var i=0;i<s.length;i++)if(p.indexOf(s[i])===0)b=s[i];document.getElementById('home').href=b;})();</script>
</body>
</html>
`);

const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${paths.map(p => {
  const r = V.match(p);
  const imgs = r.name === 'project' ? V.data.projBySlug[r.slug].gallery.map(g => `<image:image><image:loc>${V.abs(g.src)}</image:loc></image:image>`).join('') : '';
  return `<url><loc>${V.SITE_URL}${p}</loc><lastmod>${today}</lastmod>${imgs}</url>`;
}).join('\n')}
</urlset>
`);
write('.nojekyll', '');
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${V.SITE_URL}/sitemap.xml\n`);

console.log(`Built ${paths.length} pages + 404, sitemap.xml, robots.txt (v${ver})`);
