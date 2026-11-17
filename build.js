/* H&A Associati — static build
   Pre-renders every route to its own index.html (same URLs as hastudio.it),
   with title, description, canonical, Open Graph and JSON-LD, plus sitemap.xml
   and robots.txt.
   Usage:  node build.js                  (site at the domain root)
           node build.js --base=TestH-A   (site in a sub-folder, e.g. GitHub Pages)  */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const D = require('./assets/js/data.js');
const L = require('./assets/js/logo.js');
const arg = process.argv.find(a => a.startsWith('--base='));
// Accepts "--base=TestH-A" or "--base=/TestH-A" (some shells rewrite leading slashes)
const rawBase = (arg ? arg.slice(7) : '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
const BASE = rawBase ? '/' + rawBase : '';
const V = require('./assets/js/views.js')(D, L, BASE);

// Cache-busting version from the asset contents
const assets = ['assets/css/style.css', 'assets/js/data.js', 'assets/js/logo.js', 'assets/js/views.js', 'assets/js/hero-gl.js', 'assets/js/map.js', 'assets/js/app.js'];
const ver = crypto.createHash('md5').update(assets.map(a => fs.readFileSync(path.join(ROOT, a))).join('')).digest('hex').slice(0, 8);
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 12h17M14 5l7 7-7 7"/></svg>';

function page(r) {
  const m = r.meta;
  const url = V.SITE_URL + m.path;
  const ld = m.jsonld && m.jsonld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': m.jsonld }).replace(/</g, '\\u003c')}</script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
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
<link rel="icon" href="${BASE}/assets/img/logo.svg" type="image/svg+xml">
<link rel="preload" href="${BASE}/assets/fonts/rubik-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${BASE}/assets/fonts/rubik-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://www.hastudio.it">
<link rel="stylesheet" href="${BASE}/assets/css/style.css?v=${ver}">
<script>window.HA_BASE=${JSON.stringify(BASE)};document.documentElement.classList.add('js');if('scrollRestoration' in history)history.scrollRestoration='manual';</script>
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
<div class="lightbox" role="dialog" aria-modal="true" aria-label="Project images" hidden>
  <div class="lightbox__stage"><img alt=""></div>
  <button class="lightbox__close" type="button">Close</button>
  <button class="lightbox__prev" type="button" aria-label="Previous image">${arrow}</button>
  <button class="lightbox__next" type="button" aria-label="Next image">${arrow}</button>
  <div class="lightbox__count" aria-live="polite"></div>
</div>
<div class="curtain" aria-hidden="true"><div class="curtain__mark">${V.markSVG()}</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>
<script src="https://unpkg.com/lenis@1.1.13/dist/lenis.min.js" defer></script>
<script src="${BASE}/assets/js/data.js?v=${ver}" defer></script>
<script src="${BASE}/assets/js/logo.js?v=${ver}" defer></script>
<script src="${BASE}/assets/js/views.js?v=${ver}" defer></script>
<script src="${BASE}/assets/js/hero-gl.js?v=${ver}" defer></script>
<script src="${BASE}/assets/js/map.js?v=${ver}" defer></script>
<script src="${BASE}/assets/js/app.js?v=${ver}" defer></script>
</body>
</html>
`;
}

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// Remove previously generated route folders so deleted projects do not linger
for (const dir of ['projects', 'area', 'the-firm', 'people']) fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });

const paths = V.allPaths();
for (const p of paths) write(path.join(p, 'index.html'), page(V.render(p)));
write('404.html', page(V.render('/404/')));

const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${paths.map(p => {
  const r = V.match(p);
  const imgs = r.name === 'project' ? V.data.projBySlug[r.slug].gallery.map(g => `<image:image><image:loc>${g.src}</image:loc></image:image>`).join('') : '';
  return `<url><loc>${V.SITE_URL}${p}</loc><lastmod>${today}</lastmod>${imgs}</url>`;
}).join('\n')}
</urlset>
`);
write('.nojekyll', '');
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${V.SITE_URL}/sitemap.xml\n`);

console.log(`Built ${paths.length} pages${BASE ? ' for ' + BASE + '/' : ''} + 404, sitemap.xml, robots.txt (v${ver})`);
