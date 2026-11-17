/* ==========================================================================
   H&A Associati — views
   Pure functions: data in, HTML out. Used by the browser (app.js) and by
   build.js to pre-render every page as static HTML for search engines.
   ========================================================================== */
(function (factory) {
  if (typeof module !== 'undefined') module.exports = factory;
  else window.HA_VIEWS = factory(window.HA_DATA, window.HA_LOGO, window.HA_BASE || '');
})(function (D, L, BASE) {
  'use strict';
  BASE = (BASE || '').replace(/\/$/, '');
  // Site may live in a sub-folder (e.g. GitHub Pages): prefix internal links
  const link = p => BASE + p;
  const withBase = h => (BASE ? h.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`) : h);

  const SITE_URL = 'https://www.hastudio.it';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const lines = arr => arr.flatMap(s => s.split('\n')).map(s => s.trim()).filter(Boolean);
  const isCaps = t => /^[A-Z\s]+$/.test(t);

  /* ---------------------------------------------------------------- data */
  const P = D.projects;
  const AREA_ORDER = ['architecture', 'engineering', 'urban-planning-and-landscape', 'competition'];
  const areaById = Object.fromEntries(D.areas.map(a => [a.id, a]));
  const areaBySlug = Object.fromEntries(D.areas.map(a => [a.slug, a]));
  const tops = AREA_ORDER.map(s => areaBySlug[s]).filter(Boolean);
  const childrenOf = id => D.areas.filter(a => a.parent === id);
  const projBySlug = Object.fromEntries(P.map(p => [p.slug, p]));
  const inArea = (p, slug) => { const a = areaBySlug[slug]; return !!a && p.areas.includes(a.id); };
  const countIn = slug => P.filter(p => inArea(p, slug)).length;
  const featured = P.filter(p => p.order <= 3);
  const loc = p => p.facts.Location || '';
  const country = p => { const m = loc(p).match(/italy|china|korea/i); return m ? m[0][0].toUpperCase() + m[0].slice(1).toLowerCase() : ''; };
  const COUNTRIES = ['Italy', 'China', 'Korea'].filter(c => P.some(p => country(p) === c));
  const FACT_LABELS = { Location: 'Location', Client: 'Client', Tipology: 'Typology', Size: 'Size', Status: 'Status', Credits: 'Credits' };

  /* ---------------------------------------------------------------- urls */
  const U = {
    home: '/',
    projects: '/projects/',
    project: slug => `/projects/${slug}/`,
    firm: '/the-firm/',
    people: '/people/',
    contacts: '/contacts/',
    area: a => (a.parent ? `/area/${areaById[a.parent].slug}/${a.slug}/` : `/area/${a.slug}/`),
  };

  /* -------------------------------------------------------------- images */
  // WordPress keeps resized copies next to the original: name-768x512.webp
  const variantUrl = (im, suf) => (suf ? im.src.replace(/(\.[a-z0-9]+)$/i, suf + '$1') : im.src);
  const srcset = im => (im.v || []).map(s => `${variantUrl(im, s)} ${parseInt(s.slice(1), 10)}w`).concat(`${im.src} ${im.w}w`).join(', ');
  // Pick the smallest copy at least `min` px wide (used for thumbnails and map cards)
  const smallUrl = (im, min) => { const s = (im.v || []).find(x => parseInt(x.slice(1), 10) >= min); return variantUrl(im, s); };
  function pic(im, sizes, alt, opt = {}) {
    if (!im) return '';
    return `<img src="${esc(im.src)}"${im.v && im.v.length ? ` srcset="${esc(srcset(im))}" sizes="${sizes}"` : ''}${im.w ? ` width="${im.w}" height="${im.h}"` : ''} alt="${esc(alt || '')}"${opt.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${opt.cls ? ` class="${opt.cls}"` : ''}>`;
  }
  const SZ = {
    card: '(max-width: 700px) 84vw, (max-width: 1100px) 46vw, 560px',
    grid: '(max-width: 560px) 92vw, (max-width: 1100px) 46vw, 31vw',
    cover: '(max-width: 1240px) 100vw, 1200px',
    half: '(max-width: 860px) 100vw, 50vw',
    third: '(max-width: 860px) 100vw, 66vw',
    thumb: '120px',
    small: '(max-width: 860px) 50vw, 25vw',
  };

  /* ------------------------------------------------------------- strings */
  const words = text => esc(text).split(/\s+/).filter(Boolean).map(w => `<span class="wm"><span class="wm__in">${w}</span></span>`).join(' ');
  const chars = text => esc(text).split(' ').map(w => `<span class="wd">${[...w].map(c => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');
  const arrowSVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 12h17M14 5l7 7-7 7"/></svg>';
  const cta = (href, label, cls = '') => `<a class="cta ${cls}" href="${href}"><span>${esc(label)}</span>${arrowSVG}</a>`;

  function logoSVG(title) {
    return `<svg viewBox="0 0 800 800" role="img" aria-label="${esc(title || 'H&A Associati')}"><path fill="#022753" d="${L.sq}"/><g fill="#fff">${L.big.concat(L.small).map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
  }
  function markSVG() {
    return `<svg viewBox="50 320 700 420" aria-hidden="true">
      <g fill="#fff">${L.big.map(d => `<path class="lg" d="${d}"/>`).join('')}</g>
      <line class="lb" x1="70" x2="730" y1="648" y2="648" stroke="#fff" stroke-width="1.5"/>
      <g fill="#fff">${L.small.map(d => `<path class="ls" d="${d}"/>`).join('')}</g>
    </svg>`;
  }

  /* -------------------------------------------------------------- chrome */
  function header() {
    return withBase(`
    <header class="header">
      <div class="header__bar wrap">
        <a class="header__logo" href="/" aria-label="H&amp;A Associati, home">${logoSVG()}</a>
        <nav class="header__nav" aria-label="Areas">
          <ul>
            ${tops.map(a => {
              const kids = childrenOf(a.id).filter(c => countIn(c.slug));
              return `<li class="area-nav">
              <a class="area-nav__a" href="${U.area(a)}" data-top="${a.slug}">${esc(a.name)}</a>
              ${kids.length ? `<div class="area-nav__drop"><ul>${kids.map(c => `<li><a href="${U.area(c)}" data-top="${a.slug}" data-area="${c.slug}">${esc(c.name)}<sup>${countIn(c.slug)}</sup></a></li>`).join('')}</ul></div>` : ''}
            </li>`;
            }).join('')}
          </ul>
        </nav>
        <button class="header__burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu"><span class="header__burger-l">Menu</span><span class="header__burger-i"><span></span><span></span></span></button>
      </div>
    </header>
    <div class="menu" id="menu" hidden>
      <div class="menu__inner wrap">
        <nav class="menu__main" aria-label="Menu">
          ${[[U.projects, 'Projects'], [U.firm, 'The Firm'], [U.people, 'People'], [U.contacts, 'Contacts']].map(([h, t]) => `<span class="ln"><a class="ln__in" href="${h}">${t}</a></span>`).join('')}
        </nav>
        <div class="menu__areas">
          ${tops.map(a => `<div class="menu__group"><p class="menu__h"><a href="${U.area(a)}">${esc(a.name)}<sup>${countIn(a.slug)}</sup></a></p>${childrenOf(a.id).filter(c => countIn(c.slug)).map(c => `<a href="${U.area(c)}">${esc(c.name)}</a>`).join('')}</div>`).join('')}
        </div>
        <div class="menu__foot">
          <a href="mailto:${D.site.contacts.mail}">${esc(D.site.contacts.mail)}</a>
          <a href="${D.site.contacts.telHref}">${esc(D.site.contacts.tel)}</a>
        </div>
      </div>
    </div>`);
  }

  function footer() {
    const s = D.site;
    return withBase(`
    <footer class="footer" id="contacts">
      <div class="wrap footer__top">
        <div class="footer__call">
          <a class="footer__mail" href="mailto:${s.contacts.mail}">${esc(s.contacts.mail)}</a>
          <a class="footer__tel" href="${s.contacts.telHref}">${esc(s.contacts.tel)}</a>
        </div>
        <div class="footer__cols">
          <div><h2 class="footer__h">Contacts</h2>
            <p>H&amp;A Associati<br>${esc(s.contacts.address)}<br>Tel: <a href="${s.contacts.telHref}">${esc(s.contacts.tel)}</a><br>Mail: <a href="mailto:${s.contacts.mail}">${esc(s.contacts.mail)}</a></p>
          </div>
          <div><h2 class="footer__h">Offices</h2>
            ${s.offices.map(o => `<p class="footer__office"><strong>${esc(o.city)} (${esc(o.country)})</strong>${o.lines.map(esc).join('<br>')}${o.tel ? `<br>Tel: <a href="${o.telHref}">${esc(o.tel)}</a>` : ''}</p>`).join('')}
          </div>
          <div><h2 class="footer__h">Social</h2>
            <ul>${s.social.map(x => `<li><a href="${x.href}" target="_blank" rel="noopener">${esc(x.name)}</a></li>`).join('')}</ul>
          </div>
          <div><h2 class="footer__h">Legal</h2>
            <p>${esc(s.legal.copy)}<br>${esc(s.legal.vat)}</p>
            <p><a href="${s.legal.privacy}" target="_blank" rel="noopener">Privacy Policy</a><br><a href="${s.legal.cookie}" target="_blank" rel="noopener">Cookie Policy</a></p>
          </div>
        </div>
      </div>
      <div class="footer__mark" aria-hidden="true"><div class="wrap"><span>H&amp;A Associati</span></div></div>
      <div class="wrap footer__bottom">
        <span>${esc(s.legal.copy)} | ${esc(s.legal.vat)}</span>
        <a class="footer__top" href="#top">Back to the top</a>
      </div>
    </footer>`);
  }

  /* -------------------------------------------------------- shared parts */
  const card = (p, i, sizes) => `
    <li class="card">
      <a class="card__link" href="${U.project(p.slug)}">
        <span class="card__img">${pic(p.cover, sizes || SZ.card, p.title)}</span>
        <span class="card__cap">
          ${i != null ? `<span class="card__n">${pad(i + 1)}</span>` : ''}
          <span class="card__t">${esc(p.title)}</span>
          <span class="card__l">${esc(loc(p))}</span>
        </span>
      </a>
    </li>`;

  function carousel(list, label) {
    return `
    <div class="car" data-carousel>
      <ul class="car__track" aria-label="${esc(label)}">${list.map((p, i) => card(p, i)).join('')}</ul>
      <div class="wrap car__foot">
        <div class="car__progress" aria-hidden="true"><i></i></div>
        <div class="car__btns">
          <button class="car__btn car__prev" type="button" aria-label="Previous">${arrowSVG}</button>
          <button class="car__btn car__next" type="button" aria-label="Next">${arrowSVG}</button>
        </div>
      </div>
    </div>`;
  }

  // Projects map with region tabs and a synced list (map loads lazily in the browser)
  function mapBlock(list, id) {
    const by = c => list.filter(p => country(p) === c).length;
    return `
    <div class="pmap" data-map="${id}">
      <div class="pmap__tabs" role="tablist" aria-label="Regions">
        <button type="button" role="tab" data-region="all" aria-selected="true">All<sup>${list.length}</sup></button>
        ${COUNTRIES.filter(by).map(c => `<button type="button" role="tab" data-region="${c}" aria-selected="false">${c}<sup>${by(c)}</sup></button>`).join('')}
      </div>
      <div class="pmap__grid">
        <div class="pmap__canvas" aria-label="Map of project locations"><div class="pmap__note">Loading map</div></div>
        <button type="button" class="pmap__more" aria-expanded="false" aria-controls="pl-${id}"><span>List of projects<sup>${list.length}</sup></span><span class="plus" aria-hidden="true"></span></button>
        <ol class="pmap__list" id="pl-${id}">
          ${list.map(p => `<li data-slug="${p.slug}" data-country="${country(p)}"><a href="${U.project(p.slug)}"><span class="pmap__t">${esc(p.title)}</span><span class="pmap__l">${esc(loc(p))}</span></a></li>`).join('')}
        </ol>
      </div>
    </div>`;
  }

  /* =============================================================== VIEWS */

  function viewHome() {
    const f = featured;
    const works = P.slice(0, 10);
    const sections = D.firm.sections.filter(s => s.images.length);
    const intro = lines(D.firm.intro[0] || []);
    const offices = D.site.offices;
    const tz = { Venice: 'Europe/Rome', Rome: 'Europe/Rome', Shanghai: 'Asia/Shanghai' };
    const join = arr => arr.join(', ').replace(/, ([^,]*)$/, ' and $1');

    return `
    <nav class="areas-m wrap" aria-label="Areas">
      <ul>
        ${tops.map(a => {
          return `<li><a class="areas-m__a" href="${U.area(a)}">
            <span class="areas-m__t">${esc(a.name)}</span>
            <span class="areas-m__c">${countIn(a.slug)}</span>
            <span class="areas-m__arr">${arrowSVG}</span>
          </a></li>`;
        }).join('')}
      </ul>
    </nav>

    <section class="hero wrap" aria-labelledby="h-feat">
      <div class="hero__head">
        <h2 class="sec__title" id="h-feat">${words('Featured projects')}</h2>
        <span class="hero__count"><b>01</b> / ${pad(f.length)}</span>
      </div>
      <div class="hero__stage">
        <div class="hero__frame">
          <canvas class="hero__canvas" aria-hidden="true"></canvas>
          <div class="hero__imgs">${f.map((p, i) => pic(p.cover, SZ.cover, p.title, { eager: i === 0, cls: i === 0 ? 'is-on' : '' })).join('')}</div>
        </div>
      </div>
      <div class="hero__info">
        <div class="hero__text">
          <h2 class="hero__title"><a href="${U.project(f[0].slug)}">${chars(f[0].title)}</a></h2>
          <p class="hero__loc caps"><span>${esc(loc(f[0]))}</span></p>
        </div>
        <div class="hero__side">
          <a class="hero__open cta" href="${U.project(f[0].slug)}"><span>View project</span>${arrowSVG}</a>
          <div class="hero__nav">
            <button class="car__btn hero__prev" type="button" aria-label="Previous project">${arrowSVG}</button>
            <button class="car__btn hero__next" type="button" aria-label="Next project">${arrowSVG}</button>
          </div>
        </div>
      </div>
      <ol class="hero__steps">
        ${f.map((p, i) => `<li><button type="button" class="hero__step${i === 0 ? ' is-active' : ''}" aria-label="${esc(p.title)}"><i><b></b></i><span>${pad(i + 1)}</span><em>${esc(p.title)}</em></button></li>`).join('')}
      </ol>
    </section>

    <section class="intro wrap" aria-label="H&amp;A Associati">
      <div class="intro__inner">
        <h1 class="intro__text" data-r="words">${words(D.site.description)}</h1>
        <div class="intro__row">
          ${intro[1] ? `<p class="intro__p" data-r="up">${esc(intro[1])}</p>` : ''}
          <div class="intro__cta" data-r="up">${cta(U.firm, 'The Firm')}</div>
        </div>
      </div>
    </section>

    <section class="areas wrap" aria-labelledby="h-areas">
      <h2 class="sr-only" id="h-areas">Areas</h2>
      <ul class="areas__grid">
        ${tops.map((a, i) => {
          const p = P.find(q => inArea(q, a.slug));
          return `<li data-r="up">
          <a class="area-card" href="${U.area(a)}">
            <span class="area-card__img">${p ? pic(p.cover, '(max-width: 560px) 96px, (max-width: 1023px) 46vw, 25vw', a.name) : ''}</span>
            <span class="area-card__body">
              <span class="area-card__n">${pad(i + 1)}</span>
              <span class="area-card__t">${esc(a.name)}</span>
              <span class="area-card__c">${countIn(a.slug)} projects</span>
            </span>
          </a>
        </li>`;
        }).join('')}
      </ul>
    </section>

    <section class="sec" aria-labelledby="h-works">
      <div class="wrap sec__head">
        <h2 class="sec__title" id="h-works" data-r="words">${words('Projects')}</h2>
        ${cta(U.projects, `All projects (${P.length})`)}
      </div>
      <ol class="ed wrap">
        ${works.map((p, i) => `
        <li class="ed__item${i % 2 ? ' ed__item--r' : ''}">
          <a class="ed__link" href="${U.project(p.slug)}">
            <span class="ed__img" data-r="img">${pic(p.cover, '(max-width: 860px) 100vw, 58vw', p.title)}</span>
            <span class="ed__text" data-r="up">
              <span class="ed__n">${pad(i + 1)}</span>
              <span class="ed__t">${esc(p.title)}</span>
              <span class="ed__l">${esc(loc(p))}</span>
              ${p.facts.Tipology ? `<span class="ed__c">${esc(p.facts.Tipology)}</span>` : ''}
            </span>
          </a>
        </li>`).join('')}
      </ol>
      <div class="wrap ed__more">${cta(U.projects, 'More projects')}</div>
    </section>


    <section class="sec sec--map" aria-labelledby="h-map">
      <div class="wrap sec__head">
        <h2 class="sec__title" id="h-map" data-r="words">${words('Where we work')}</h2>
      </div>
      <div class="wrap">${mapBlock(P, 'home')}</div>
    </section>

    <section class="figures wrap" aria-label="The studio in numbers">
      <div class="fig" data-r="up"><p class="fig__n" data-count="${P.length}">${P.length}</p><p class="fig__l">Projects in architecture, engineering, urban planning and landscape</p></div>
      <div class="fig" data-r="up"><p class="fig__n" data-count="30">30<sup>+</sup></p><p class="fig__l">Architects and engineers</p></div>
      <div class="fig" data-r="up"><p class="fig__n" data-count="${offices.length}">${offices.length}</p><p class="fig__l">Offices in ${join(offices.map(o => esc(o.city)))}</p></div>
      <div class="fig" data-r="up"><p class="fig__n" data-count="${sections.length}">${sections.length}</p><p class="fig__l">${join(sections.map(s => esc(s.title)))}</p></div>
    </section>

    <section class="disc wrap" aria-label="Disciplines">
      ${sections.map((s, i) => `
      <div class="disc__row${i === 0 ? ' is-open' : ''}">
        <h2 class="disc__h"><button class="disc__btn" type="button" aria-expanded="${i === 0}" aria-controls="disc-${i}">
          <span class="disc__name">${esc(s.title)}</span><span class="plus" aria-hidden="true"></span>
        </button></h2>
        <div class="disc__panel" id="disc-${i}"${i === 0 ? '' : ' hidden'}>
          <div class="disc__body">
            <div class="disc__text">${lines(s.columns.flat()).map(t => isCaps(t) ? `<p class="sub">${esc(t)}</p>` : `<p>${esc(t)}</p>`).join('')}</div>
            <div class="disc__imgs" data-lbgroup="${esc(s.title)}">${s.images.map((im, k) => `<button type="button" class="disc__img" data-lbsrc="${esc(im.src)}" aria-label="Enlarge ${esc(s.title)} image ${k + 1}">${pic(im, SZ.small, '')}</button>`).join('')}</div>
          </div>
        </div>
      </div>`).join('')}
    </section>

    <section class="offices wrap" aria-label="Offices">
      ${offices.map(o => `
      <div class="office" data-r="up">
        <h2 class="office__city">${esc(o.city)}</h2>
        <p class="office__time caps" data-tz="${tz[o.city] || 'Europe/Rome'}">&nbsp;</p>
        <p class="office__addr">${o.lines.map(esc).join('<br>')}${o.tel ? `<br><a href="${o.telHref}">${esc(o.tel)}</a>` : ''}</p>
      </div>`).join('')}
    </section>`;
  }

  function viewProjects(areaSlug) {
    const active = areaSlug && areaBySlug[areaSlug] ? areaBySlug[areaSlug] : null;
    const top = active ? (active.parent ? areaById[active.parent] : active) : null;
    const list = active ? P.filter(p => inArea(p, active.slug)) : P;
    return `
    <section class="pindex wrap">
      <div class="pindex__top">
        <h1 class="pindex__title" data-r="words">${words(active ? active.name : 'Projects')}<sup class="pindex__count">${pad(list.length)}</sup></h1>
      </div>
      <div class="ptools" role="group" aria-label="Project options">
        <label class="ptool"><span class="ptool__l">Filter by</span>
          <select class="ptool__s" data-tool="area">
            <option value=""${top ? '' : ' selected'}>All projects (${P.length})</option>
            ${tops.map(a => `<optgroup label="${esc(a.name)}">
              <option value="${a.slug}"${active && active.slug === a.slug ? ' selected' : ''}>All ${esc(a.name)} (${countIn(a.slug)})</option>
              ${childrenOf(a.id).filter(c => countIn(c.slug)).map(c => `<option value="${c.slug}"${active && active.slug === c.slug ? ' selected' : ''}>${esc(c.name)} (${countIn(c.slug)})</option>`).join('')}
            </optgroup>`).join('')}
          </select>
        </label>
        <label class="ptool"><span class="ptool__l">Sort by</span>
          <select class="ptool__s" data-tool="sort">
            <option value="featured">Featured</option>
            <option value="az">Name A–Z</option>
            <option value="za">Name Z–A</option>
            <option value="location">Location</option>
            <option value="status">Status</option>
          </select>
        </label>
        <label class="ptool"><span class="ptool__l">View</span>
          <select class="ptool__s" data-tool="view">
            <option value="grid">Grid</option>
            <option value="list">List</option>
            <option value="map">Map</option>
          </select>
        </label>
      </div>

      <ul class="pgrid" data-view-pane="grid">${P.map(p => `
        <li class="pgrid__item${list.includes(p) ? '' : ' is-out'}" data-slug="${p.slug}">
          <a class="card__link" href="${U.project(p.slug)}">
            <span class="card__img">${pic(p.cover, SZ.grid, p.title)}</span>
            <span class="card__cap"><span class="card__t">${esc(p.title)}</span><span class="card__l">${esc(loc(p))}</span></span>
          </a>
        </li>`).join('')}
      </ul>

      <div class="plist" data-view-pane="list" hidden>
        <div class="plist__head" aria-hidden="true"><span></span><span>Project</span><span>Location</span><span class="h-c">Typology</span><span>Status</span></div>
        <ul>${P.map(p => `
          <li class="prow${list.includes(p) ? '' : ' is-out'}" data-slug="${p.slug}">
            <a href="${U.project(p.slug)}">
              <span class="prow__img">${pic({ src: smallUrl(p.cover, 300), w: 300, h: 200 }, SZ.thumb, '')}</span>
              <span class="prow__t">${esc(p.title)}</span>
              <span class="prow__l">${esc(loc(p))}</span>
              <span class="prow__c">${esc(p.facts.Tipology || '')}</span>
              <span class="prow__s">${esc(p.facts.Status || '')}</span>
            </a>
          </li>`).join('')}
        </ul>
      </div>

      <div data-view-pane="map" hidden>${mapBlock(P, 'index')}</div>
      <p class="empty" hidden>No projects in this category yet.</p>
    </section>`;
  }

  function layoutGallery(items) {
    const cycle = [['wide'], ['half', 'half'], ['right'], ['left'], ['half', 'half']];
    const out = []; let i = 0, c = 0;
    while (i < items.length) {
      let pat = cycle[c % cycle.length];
      if (pat.length > items.length - i) pat = ['wide'];
      pat.forEach(k => out.push({ k, item: items[i++] }));
      c++;
    }
    return out;
  }

  // Images shown in the viewer: the gallery, plus the cover if it is not part of it
  const lightboxItems = p => (p.gallery.some(g => g.src === p.cover.src) ? p.gallery : [p.cover].concat(p.gallery));
  const lbIndex = (p, im) => Math.max(0, lightboxItems(p).findIndex(g => g.src === im.src));

  function splitLead(desc) {
    let [lead, ...body] = desc;
    if (lead && lead.length > 200) {
      const m = lead.match(/^([\s\S]{30,240}?[.;])\s+([\s\S]+)$/);
      if (m) { lead = m[1]; body = [m[2], ...body]; }
    }
    return { lead, body };
  }

  function viewProject(slug) {
    const p = projBySlug[slug];
    if (!p) return null;
    const i = P.indexOf(p);
    const prev = P[(i - 1 + P.length) % P.length], next = P[(i + 1) % P.length];
    const gal = p.gallery.filter(g => g.src !== p.cover.src);
    const areas = p.areas.map(id => areaById[id]).filter(Boolean).sort((a, b) => a.parent - b.parent);
    const facts = Object.keys(FACT_LABELS).filter(k => p.facts[k]);
    const { lead, body } = splitLead(p.desc);
    const nearby = P.filter(q => q !== p && country(q) === country(p)).slice(0, 5);
    const sizeFor = k => ({ wide: SZ.cover, half: SZ.half, right: SZ.third, left: SZ.third }[k]);

    return `
    <article class="proj">
      <header class="proj__head wrap">
        <h1 class="proj__title">${words(p.title)}</h1>
        <p class="proj__loc caps"><span class="ln"><span class="ln__in">${esc(loc(p))}</span></span></p>
      </header>

      <div class="proj__top wrap">
        <figure class="proj__cover frame" style="--nw:${p.cover.w}px;--ar:${(p.cover.w / p.cover.h).toFixed(3)}"><button type="button" class="gitem__btn" data-lb="${lbIndex(p, p.cover)}" aria-label="Enlarge image ${lbIndex(p, p.cover) + 1} of ${lightboxItems(p).length}">${pic(p.cover, SZ.cover, p.title, { eager: true })}</button></figure>
        <dl class="facts">${facts.map(k => `<div class="facts__row"><dt>${FACT_LABELS[k]}</dt><dd>${esc(p.facts[k])}</dd></div>`).join('')}</dl>
      </div>

      <section class="proj__text wrap" aria-label="Description">
        ${lead ? `<p class="proj__lead" data-r="words">${words(lead)}</p>` : ''}
        ${body.length ? `<div class="proj__body">${body.map(t => `<p data-r="up">${esc(t)}</p>`).join('')}</div>` : ''}
      </section>

      ${p.geo ? `
      <section class="proj__map wrap" aria-labelledby="h-loc">
        <div class="proj__mapgrid">
          <div class="locmap" data-locmap="${p.slug}" aria-label="Map: ${esc(loc(p))}"></div>
          <div class="proj__mapside">
            <h2 class="proj__h" id="h-loc" data-r="words">${words('Location')}</h2>
            <p class="proj__place">${esc(loc(p))}</p>
            <ul class="tags">${areas.map(a => `<li><a href="${U.area(a)}">${esc(a.name)}</a></li>`).join('')}</ul>
            ${nearby.length ? `<p class="proj__near-h caps">Also in ${esc(country(p))}</p><ul class="proj__near">${nearby.map(q => `<li><a href="${U.project(q.slug)}"><span>${esc(q.title)}</span><span>${esc(loc(q))}</span></a></li>`).join('')}</ul>` : ''}
          </div>
        </div>
      </section>` : ''}

      ${gal.length ? `
      <section class="gal" aria-labelledby="h-gal">
        <div class="gal__pin">
          <div class="wrap gal__head">
            <h2 class="sec__title" id="h-gal">${words('Gallery')}<sup class="gal__sup">${pad(gal.length)}</sup></h2>
            <p class="gal__count" aria-hidden="true"><b>01</b> / ${pad(gal.length)}</p>
          </div>
          <ol class="gal__track">
            ${gal.map((item, k) => {
              const n = lbIndex(p, item);
              return `<li class="gal__item${k === 0 ? ' is-lit' : ''}" style="--ar:${(item.w / item.h).toFixed(3)};--nh:${item.h}px">
                <button type="button" class="gal__btn" data-lb="${n}" aria-label="Enlarge image ${k + 1} of ${gal.length}">${pic(item, '(max-width: 860px) 86vw, 70vw', `${p.title}, image ${k + 1}`)}</button>
                <span class="gal__cap"><span class="gal__n">${pad(k + 1)}</span><span class="gal__t">${esc(p.title)}</span></span>
              </li>`;
            }).join('')}
          </ol>
          <div class="wrap gal__foot"><div class="gal__progress" aria-hidden="true"><i></i></div></div>
        </div>
      </section>` : ''}

      <nav class="pnav wrap" aria-label="More projects">
        <a class="pnav__item pnav__item--prev" href="${U.project(prev.slug)}">
          <span class="pnav__dir caps">Previous</span>
          <span class="pnav__img">${pic(prev.cover, SZ.half, prev.title)}</span>
          <span class="pnav__t">${esc(prev.title)}</span>
        </a>
        <a class="pnav__item pnav__item--next" href="${U.project(next.slug)}">
          <span class="pnav__dir caps">Next</span>
          <span class="pnav__img">${pic(next.cover, SZ.half, next.title)}</span>
          <span class="pnav__t">${esc(next.title)}</span>
        </a>
      </nav>
      <div class="wrap pnav__all">${cta(U.projects, 'All projects')}</div>
    </article>`;
  }

  function viewFirm() {
    const F = D.firm;
    const c1 = lines(F.intro[0] || []), c2 = lines(F.intro[1] || []);
    const iso = c1.find(t => /ISO/.test(t));
    const col1 = c1.slice(1).filter(t => t !== iso);
    const secs = F.sections.filter(s => s.images.length);
    const phil = F.sections.find(s => !s.images.length);
    const para = t => (isCaps(t) ? `<p class="sub">${esc(t)}</p>` : `<p data-r="up">${esc(t)}</p>`);
    return `
    <section class="phead wrap">
      <h1 class="phead__title">${words('The Firm')}</h1>
      <p class="phead__lead" data-r="words">${words(c1[0] || '')}</p>
    </section>
    <figure class="firm__hero wrap" data-lbgroup="H&amp;A Associati"><button type="button" class="frame" data-lbsrc="${esc(F.hero.src)}" aria-label="Enlarge image" style="--nw:${F.hero.w}px">${pic(F.hero, '(max-width: 1680px) 100vw, 1620px', 'H&A Associati | An Italian architectural firm', { eager: true })}</button></figure>
    <section class="firm__intro wrap">
      <div class="firm__col">${col1.map(t => `<p data-r="up">${esc(t)}</p>`).join('')}${iso ? `<p class="sub" data-r="up">${esc(iso)}</p>` : ''}</div>
      <div class="firm__col">${c2.map(t => `<p data-r="up">${esc(t)}</p>`).join('')}</div>
    </section>
    ${secs.map(s => `
    <section class="fsec wrap">
      <div class="fsec__grid">
        <h2 class="fsec__title" data-r="words">${words(s.title)}</h2>
        <div class="fsec__body">${lines(s.columns.flat()).map(para).join('')}</div>
      </div>
      <div class="fsec__imgs" data-lbgroup="${esc(s.title)}">${s.images.map((im, k) => `<button type="button" class="fsec__img" data-lbsrc="${esc(im.src)}" aria-label="Enlarge ${esc(s.title)} image ${k + 1}">${pic(im, SZ.small, '')}</button>`).join('')}</div>
    </section>`).join('')}
    ${phil ? `
    <section class="fphil" data-dark>
      <div class="wrap">
        <h2 class="fphil__title" data-r="words">${words(phil.title)}</h2>
        <div class="fphil__cols">${phil.columns.map(col => `<div>${lines(col).map(t => `<p data-r="up">${esc(t)}</p>`).join('')}</div>`).join('')}</div>
      </div>
    </section>` : ''}`;
  }

  const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('');
  function viewPeople() {
    const [partners, ...groups] = D.people;
    const photo = (m, sizes) => (m.photo ? pic({ src: m.photo, w: 660, h: 660 }, sizes, m.name) : `<span class="ph-none" aria-hidden="true">${esc(initials(m.name))}</span>`);
    return `
    <section class="phead wrap">
      <h1 class="phead__title">${words('People')}</h1>
    </section>
    <section class="psec wrap" aria-labelledby="g-0">
      <h2 class="psec__title" id="g-0" data-r="words"><span>${words(partners.group)}</span><sup>${pad(partners.members.length)}</sup></h2>
      <div class="partners">
        ${partners.members.map((m, i) => `
        <div class="partner">
          <span class="partner__ph" aria-hidden="true">${photo(m, '(max-width: 860px) 180px, 420px')}</span>
          <h3 class="partner__h"><button class="partner__btn" type="button" aria-expanded="false" aria-controls="pp-${i}">
            <span class="partner__name">${esc(m.name)}</span>
            <span class="partner__role">${esc(m.role)}</span>
            <span class="plus" aria-hidden="true"></span>
          </button></h3>
          <div class="partner__panel" id="pp-${i}" hidden>
            <div class="partner__text">${(m.bio.length ? m.bio : [m.role]).map(t => `<p>${esc(t)}</p>`).join('')}</div>
          </div>
        </div>`).join('')}
      </div>
    </section>
    ${groups.map((g, gi) => `
    <section class="psec wrap" aria-labelledby="g-${gi + 1}">
      <h2 class="psec__title" id="g-${gi + 1}" data-r="words"><span>${words(g.group)}</span><sup>${pad(g.members.length)}</sup></h2>
      <ul class="team">
        ${g.members.map((m, i) => `
        <li class="member" data-r="up">
          ${m.bio.length ? `<button class="member__open" type="button" data-person="${gi + 1}-${i}" aria-label="Open the profile of ${esc(m.name)}">` : '<div class="member__open is-static">'}
            <span class="member__ph">${photo(m, '(max-width: 560px) 46vw, (max-width: 1100px) 24vw, 18vw')}</span>
            <span class="member__name">${esc(m.name)}</span>
            <span class="member__role">${esc(m.role)}</span>
            ${m.bio.length ? `<span class="member__more">Profile${arrowSVG}</span>` : ''}
          ${m.bio.length ? '</button>' : '</div>'}
          ${m.bio.length ? `<div class="member__bio" hidden>${m.bio.map(t => `<p>${esc(t)}</p>`).join('')}</div>` : ''}
        </li>`).join('')}
      </ul>
    </section>`).join('')}`;
  }

  // Offices on the map: city-level positions (Marghera for Venice, Rome, Xuhui for Shanghai)
  const OFFICE_GEO = { Venice: [45.4620, 12.2400], Rome: [41.8560, 12.4820], Shanghai: [31.1990, 121.4370] };
  const TZ = { Venice: 'Europe/Rome', Rome: 'Europe/Rome', Shanghai: 'Asia/Shanghai' };

  function viewContacts() {
    const s = D.site;
    const mapsUrl = o => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.lines.join(', '))}`;
    return `
    <section class="phead wrap">
      <h1 class="phead__title">${words('Contacts')}</h1>
    </section>
    <section class="ct wrap" aria-label="Contacts">
      <div class="ct__main">
        <a class="ct__mail" href="mailto:${s.contacts.mail}">${esc(s.contacts.mail)}</a>
        <a class="ct__tel" href="${s.contacts.telHref}">${esc(s.contacts.tel)}</a>
      </div>
      <div class="ct__side">
        <p>H&amp;A Associati<br>${esc(s.contacts.address)}</p>
        <ul class="ct__social">${s.social.map(x => `<li><a href="${x.href}" target="_blank" rel="noopener">${esc(x.name)}</a></li>`).join('')}</ul>
      </div>
    </section>
    <section class="ct-off wrap" aria-labelledby="h-off">
      <h2 class="sec__title" id="h-off" data-r="words">${words('Offices')}</h2>
      <div class="ct-off__grid">
        <div class="ct-map" data-officemap aria-label="Map of the offices"><div class="pmap__note">Loading map</div></div>
        <ul class="ct-off__list">
          ${s.offices.map((o, i) => `
          <li class="ct-office${i === 0 ? ' is-active' : ''}">
            <button type="button" class="ct-office__btn" data-office="${i}" aria-pressed="${i === 0}">
              <span class="ct-office__city">${esc(o.city)}</span>
              <span class="ct-office__time caps" data-tz="${TZ[o.city] || 'Europe/Rome'}">&nbsp;</span>
            </button>
            <p class="ct-office__addr">${o.lines.map(esc).join('<br>')}${o.tel ? `<br><a href="${o.telHref}">${esc(o.tel)}</a>` : ''}</p>
            <a class="ct-office__maps cta" href="${mapsUrl(o)}" target="_blank" rel="noopener"><span>Open in Google Maps</span>${arrowSVG}</a>
          </li>`).join('')}
        </ul>
      </div>
    </section>`;
  }

  function viewNotFound() {
    return `<section class="phead wrap nf"><h1 class="phead__title">${words('Page not found')}</h1><p class="phead__lead">${cta(U.home, 'Back to home')}</p></section>`;
  }

  /* ============================================================= ROUTING */
  function match(pathname) {
    if (BASE && pathname.startsWith(BASE)) pathname = pathname.slice(BASE.length) || '/';
    const parts = pathname.replace(/index\.html$/, '').split('/').filter(Boolean);
    if (!parts.length) return { name: 'home' };
    if (parts[0] === 'projects' && parts.length === 1) return { name: 'projects' };
    if (parts[0] === 'projects' && projBySlug[parts[1]]) return { name: 'project', slug: parts[1] };
    if (parts[0] === 'area' && areaBySlug[parts[parts.length - 1]]) return { name: 'projects', area: parts[parts.length - 1] };
    if (parts[0] === 'the-firm') return { name: 'firm' };
    if (parts[0] === 'people') return { name: 'people' };
    if (parts[0] === 'contacts') return { name: 'contacts' };
    return { name: '404' };
  }

  const ORG = {
    '@type': 'Organization', '@id': SITE_URL + '/#org', name: D.site.name, url: SITE_URL + '/',
    logo: SITE_URL + '/assets/img/logo.svg', email: D.site.contacts.mail, telephone: D.site.contacts.tel,
    description: D.site.description,
    address: { '@type': 'PostalAddress', streetAddress: 'Banchina dell’Azoto 15/d', postalCode: '30175', addressLocality: 'Marghera, Venice', addressCountry: 'IT' },
    location: D.site.offices.map(o => ({ '@type': 'Place', name: `H&A Associati ${o.city}`, address: o.lines.join(', ') })),
    sameAs: D.site.social.filter(s => s.name !== 'Google').map(s => s.href),
  };
  const crumbs = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + path })) });

  function render(pathname) {
    const r = match(pathname);
    const base = { name: r.name, route: r };
    switch (r.name) {
      case 'home':
        return { ...base, html: withBase(viewHome()), meta: { title: 'H&A Associati | Architecture and engineering, Venice and Shanghai', description: D.site.description, path: '/', image: featured[0].cover.src, jsonld: [ORG, { '@type': 'WebSite', name: D.site.name, url: SITE_URL + '/' }] } };
      case 'projects': {
        const a = r.area && areaBySlug[r.area];
        const title = a ? `${a.name} | Projects | H&A Associati` : 'Projects | H&A Associati';
        const n = a ? countIn(a.slug) : P.length;
        const path = a ? U.area(a) : U.projects;
        return { ...base, html: withBase(viewProjects(r.area)), meta: { title, description: `${n} ${a ? a.name + ' ' : ''}projects by H&A Associati, architecture and engineering studio based in Venice and Shanghai.`, path, image: P[0].cover.src, jsonld: [ORG, crumbs([['Home', '/'], ['Projects', U.projects]].concat(a ? [[a.name, path]] : [])), { '@type': 'ItemList', itemListElement: (a ? P.filter(p => inArea(p, a.slug)) : P).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + U.project(p.slug), name: p.title })) }] } };
      }
      case 'project': {
        const p = projBySlug[r.slug];
        const desc = (p.desc[0] || '').slice(0, 158);
        return { ...base, html: withBase(viewProject(r.slug)), meta: { title: `${p.title}, ${loc(p)} | H&A Associati`, description: desc, path: U.project(p.slug), image: p.cover.src, jsonld: [crumbs([['Home', '/'], ['Projects', U.projects], [p.title, U.project(p.slug)]]), { '@type': 'CreativeWork', name: p.title, description: p.desc.join(' '), url: SITE_URL + U.project(p.slug), image: p.gallery.map(g => g.src), genre: p.facts.Tipology, creator: { '@id': SITE_URL + '/#org' }, locationCreated: { '@type': 'Place', name: loc(p), ...(p.geo ? { geo: { '@type': 'GeoCoordinates', latitude: p.geo[0], longitude: p.geo[1] } } : {}) } }] } };
      }
      case 'firm':
        return { ...base, html: withBase(viewFirm()), meta: { title: 'The Firm | H&A Associati', description: (lines(D.firm.intro[0] || [])[0] || '').slice(0, 158), path: U.firm, image: D.firm.hero.src, jsonld: [ORG, crumbs([['Home', '/'], ['The Firm', U.firm]])] } };
      case 'people':
        return { ...base, html: withBase(viewPeople()), meta: { title: 'People | H&A Associati', description: `Partners and project team of H&A Associati: ${D.people[0].members.map(m => m.name).join(', ')} and over thirty architects and engineers.`.slice(0, 158), path: U.people, image: D.firm.hero.src, jsonld: [ORG, crumbs([['Home', '/'], ['People', U.people]])] } };
      case 'contacts':
        return { ...base, html: withBase(viewContacts()), meta: { title: 'Contacts | H&A Associati', description: `Contact H&A Associati: ${D.site.contacts.mail}, ${D.site.contacts.tel}. Offices in ${D.site.offices.map(o => o.city).join(', ')}.`.slice(0, 158), path: U.contacts, image: D.firm.hero.src, jsonld: [ORG, crumbs([['Home', '/'], ['Contacts', U.contacts]])] } };
      default:
        return { ...base, html: withBase(viewNotFound()), meta: { title: 'Page not found | H&A Associati', description: D.site.description, path: '/404.html', image: featured[0].cover.src, noindex: true, jsonld: [] } };
    }
  }

  function allPaths() {
    return ['/', U.projects, U.firm, U.people, U.contacts]
      .concat(D.areas.filter(a => countIn(a.slug)).map(U.area))
      .concat(P.map(p => U.project(p.slug)));
  }

  return {
    SITE_URL, BASE, link, U, lightboxItems, esc, pad, words, chars, pic, smallUrl, logoSVG, markSVG, header, footer, render, match, allPaths,
    OFFICE_GEO,
    data: { P, featured, projBySlug, areaBySlug, areaById, inArea, loc, country, COUNTRIES },
  };
});
