/* ==========================================================================
   H&A Associati — runtime
   History routing, page transitions, a small set of purposeful animations.
   Every page is pre-rendered as static HTML (build.js); this script takes
   over navigation and adds motion on top.
   ========================================================================== */
(function () {
  'use strict';

  const V = window.HA_VIEWS;
  const M = window.HA_MAP;
  const { P, latest, projBySlug, areaBySlug, areaById, inArea, loc } = V.data;
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 12h17M14 5l7 7-7 7"/></svg>';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const pad = V.pad;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIM = !!(window.gsap && window.ScrollTrigger) && !reduced;
  const touch = matchMedia('(hover: none)').matches;
  if (ANIM) { gsap.registerPlugin(ScrollTrigger); document.documentElement.classList.add('anim'); }

  let main, header, footer;
  let lenis = null;
  let page = { name: '', cleanup: [], ctx: null };
  let busy = false, queued = null, first = true;

  /* -------------------------------------------------------------- chrome */
  function ensureChrome() {
    if (!$('.header')) document.body.insertAdjacentHTML('afterbegin', V.header());
    if (!$('.footer')) document.body.insertAdjacentHTML('beforeend', V.footer());
    if (!$('.curtain')) document.body.insertAdjacentHTML('beforeend', `<div class="curtain" aria-hidden="true"><div class="curtain__mark">${V.markSVG()}</div></div>`);
    main = $('#main'); header = $('.header'); footer = $('.footer');
    // The static HTML uses page-relative links ("../../people/"). Header, menu and footer
    // stay on screen across page changes, so resolve them once into absolute paths.
    $$('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (!h || /^(https?:|mailto:|tel:|#|\/)/i.test(h)) return;
      a.setAttribute('href', new URL(h, location.href).pathname);
    });
  }

  /* -------------------------------------------------------------- scroll */
  function initScroll() {
    if (ANIM && window.Lenis && !touch) {
      lenis = new Lenis({ lerp: 0.12, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    // The header steps aside only after a clear scroll down (140px in one direction) and comes back
    // after a short scroll up (70px): quick wheel or trackpad flicks no longer make it blink
    let lastY = window.scrollY, travel = 0;
    addEventListener('scroll', () => {
      const y = window.scrollY, d = y - lastY;
      const busyNav = document.body.classList.contains('menu-open') || header.matches(':hover, :focus-within');
      travel = (d > 0) === (travel > 0) ? travel + d : d;
      if (busyNav || y < 320) { header.classList.remove('is-hidden'); travel = 0; }
      else if (travel > 140) header.classList.add('is-hidden');
      else if (travel < -70) header.classList.remove('is-hidden');
      lastY = y;
      headerState();
    }, { passive: true });
  }
  // ScrollTrigger caches the scroll position: sync it, or its next refresh puts the old page's position back
  const scrollTop = () => {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    if (window.ScrollTrigger) { ScrollTrigger.clearScrollMemory('manual'); ScrollTrigger.update(); }
  };
  const scrollToEl = el => { if (!el) return; if (lenis) lenis.scrollTo(el, { duration: 1.4 }); else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
  const lock = on => { document.body.classList.toggle('is-locked', on); if (lenis) on ? lenis.stop() : lenis.start(); };

  // The header always sits on its own surface: white over light content, navy over navy sections
  function headerState() {
    const y = window.scrollY;
    const probe = (header.offsetHeight || 80) / 2;
    let dark = false;
    for (const el of $$('[data-dark]', main).concat(footer ? [footer] : [])) {
      const r = el.getBoundingClientRect();
      if (r.top <= probe && r.bottom >= probe) { dark = true; break; }
    }
    header.classList.toggle('is-scrolled', y > 8);
    header.classList.toggle('is-dark', dark);
  }

  /* -------------------------------------------------------------- reveal */
  function reveals(scope) {
    if (!ANIM) return;
    const once = (el, fn, start = 'top 88%') => ScrollTrigger.create({ trigger: el, start, once: true, onEnter: fn });
    // Headings: the words rise out of their line, one after the other (transform only, light on phones)
    $$('[data-r="words"], [data-r="lines"]', scope).forEach(el => {
      const w = $$('.wm__in', el);
      if (!w.length) { gsap.set(el, { opacity: 0, y: 12 }); once(el, () => gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' })); return; }
      gsap.set(w, { yPercent: 110 });
      once(el, () => gsap.to(w, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: Math.min(0.04, 0.6 / w.length) }));
    });
    $$('[data-r="up"]', scope).forEach(el => {
      gsap.set(el, { opacity: 0, y: 24 });
      once(el, () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out' }));
    });
    // Images: they rise and settle into place (never enlarged beyond their size)
    $$('[data-r="img"]', scope).forEach(el => {
      gsap.set(el, { opacity: 0, y: 48, scale: 0.97, transformOrigin: '50% 100%' });
      once(el, () => gsap.to(el, { opacity: 1, y: 0, scale: 1, duration: 1.3, ease: 'expo.out', clearProps: 'transform' }), 'top 94%');
    });
  }

  /* ---------------------------------------------------------------- menu */
  function initMenu() {
    const burger = $('.header__burger'), menu = $('#menu');
    let open = false, tl = null;
    const set = (v, instant) => {
      open = v;
      burger.setAttribute('aria-expanded', v);
      burger.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', v);
      header.classList.remove('is-hidden');
      lock(v);
      tl && tl.kill();
      if (v) { menu.hidden = false; menu.scrollTop = 0; }
      // Leaving for another page: close at once, so nothing shows through the transition
      if (!ANIM || (!v && instant)) {
        if (!v) { menu.hidden = true; if (window.gsap) gsap.set(menu, { clearProps: 'clipPath' }); }
        return;
      }
      if (v) {
        tl = gsap.timeline()
          .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' })
          .fromTo($$('.marea__t'), { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.07 }, '-=0.35')
          .fromTo($$('.menu__all, .menu__main li'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.05 }, '-=0.75');
      } else {
        tl = gsap.timeline().to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo.inOut', onComplete: () => { menu.hidden = true; } });
      }
    };
    burger.addEventListener('click', () => set(!open));
    menu.addEventListener('click', e => {
      const a = e.target.closest('a');
      if (!a) return;
      // contacts scroll on the same page: close with the animation; other links leave the page: close at once
      set(false, a.getAttribute('href') !== '#contacts');
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) { set(false); burger.focus(); } });
    page.closeMenu = instant => open && set(false, instant);
  }

  function initAreaNav() {
    $$('.area-nav').forEach(li => {
      li.addEventListener('pointerleave', () => li.classList.remove('is-shut'));
      // A click (or tap) on the area or a category closes the panel at once
      li.addEventListener('click', e => { if (!e.target.closest('a')) return; li.classList.add('is-shut'); if (document.activeElement && li.contains(document.activeElement)) document.activeElement.blur(); });
    });
  }

  /* ============================================================= PAGES */

  /* ---------------------------------------------------------- carousel */
  function initCarousel(root) {
    const track = $('.car__track', root);
    const prev = $('.car__prev', root), next = $('.car__next', root), bar = $('.car__progress i', root);
    const gap = () => parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
    const step = () => { const c = $('.card', track); return c ? c.getBoundingClientRect().width + gap() : track.clientWidth * 0.8; };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const vis = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
      const p = max > 0 ? track.scrollLeft / max : 0;
      bar.style.width = (vis * 100) + '%';
      bar.style.transform = `translateX(${p * (1 / vis - 1) * 100}%)`;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
      root.classList.toggle('is-static', max <= 4);
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update); ro.observe(track);
    page.cleanup.push(() => ro.disconnect());
    // Mouse drag (touch and trackpads scroll natively)
    let down = null, moved = false;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, left: track.scrollLeft }; moved = false;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (Math.abs(dx) > 6) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = down.left - dx;
    });
    const end = () => { if (!down) return; down = null; if (moved) { track.classList.remove('is-drag'); } };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    track.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener('dragstart', e => e.preventDefault());
    page.cleanup.push(() => { removeEventListener('pointerup', end); removeEventListener('pointercancel', end); });
    update();
    if (ANIM) {
      const cards = $$('.card', track);
      gsap.set(cards, { opacity: 0, x: 60 });
      ScrollTrigger.create({ trigger: root, start: 'top 85%', once: true, onEnter: () => gsap.to(cards, { opacity: 1, x: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }) });
    }
  }

  /* -------------------------------------------------------------- maps */
  function initProjectsMap(root, list) {
    if (!M) return null;
    const api = M.projectsMap(root, list, V);
    page.cleanup.push(() => api.destroy());
    return api;
  }

  /* -------------------------------------------------------------- home */
  function initHome() {
    // Phones: the studio text starts folded, "Read more" opens it
    const more = $('.about__more'), about = $('.about');
    if (more && about) more.addEventListener('click', () => {
      const open = about.classList.toggle('is-open');
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Read less' : 'Read more';
      if (!open) scrollToEl(about);
      if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
    });

    const hero = $('.hero');
    const frame = $('.hero__frame');
    const canvas = $('.hero__canvas');
    const imgs = $$('.hero__imgs img');
    const titleA = $('.hero__title a');
    const locEl = $('.hero__loc span');
    const openEl = $('.hero__open');
    const count = $('.hero__count b');
    const steps = $$('.hero__step');
    const f = latest;
    const DUR = 8; // seconds each project stays on screen
    let cur = 0, prog = null, timer = null, visible = true;

    const gl = window.HeroGL ? window.HeroGL(canvas, f.map(p => p.cover.src), r => page.loadProgress && page.loadProgress(r)) : null;
    page.ready = gl ? gl.ready : Promise.resolve();
    let useGL = false;
    if (gl && gl.ok) gl.drawn.then(ok => { if (ok && page.name === 'home') { useGL = true; frame.classList.add('is-gl'); requestAnimationFrame(() => gl.start()); } });
    page.cleanup.push(() => gl && gl.destroy());

    function progress() {
      prog && prog.kill();
      clearTimeout(timer);
      steps.forEach((s, k) => { const b = $('b', s); b.style.transform = k < cur ? 'scaleX(1)' : 'scaleX(0)'; });
      if (reduced) return;
      if (window.gsap) {
        prog = gsap.fromTo($('b', steps[cur]), { scaleX: 0 }, { scaleX: 1, duration: DUR, ease: 'none', onComplete: () => go((cur + 1) % f.length) });
        if (!visible) prog.pause();
      } else timer = setTimeout(() => go((cur + 1) % f.length), DUR * 1000);
    }
    function go(i) {
      if (i === cur) return;
      const p = f[i];
      cur = i;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      count.textContent = pad(i + 1);
      titleA.href = openEl.href = V.link(V.U.project(p.slug));
      if (useGL) gl.goTo(i, 1.3); else imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
      if (ANIM) {
        // Sober text change: the title and place fade out and back in as a whole
        const txt = [titleA, locEl];
        gsap.timeline()
          .to(txt, { opacity: 0, y: -8, duration: 0.25, ease: 'power1.in' })
          .add(() => {
            titleA.innerHTML = V.chars(p.title);
            fitOne(titleA.parentElement);
            locEl.textContent = loc(p);
          })
          .fromTo(txt, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06 }, '+=0.1');
      } else { titleA.innerHTML = V.chars(p.title); fitOne(titleA.parentElement); locEl.textContent = loc(p); }
      progress();
    }
    steps.forEach((s, i) => s.addEventListener('click', () => go(i)));
    $('.hero__prev').addEventListener('click', () => go((cur - 1 + f.length) % f.length));
    $('.hero__next').addEventListener('click', () => go((cur + 1) % f.length));
    page.cleanup.push(() => { prog && prog.kill(); clearTimeout(timer); });

    let sx = null;
    frame.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    frame.addEventListener('touchend', e => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go((cur + (dx < 0 ? 1 : f.length - 1)) % f.length);
    });

    // Pause the slideshow when the hero is off-screen or the tab is hidden
    const io = new IntersectionObserver(es => es.forEach(e => {
      visible = e.isIntersecting;
      if (prog) visible ? prog.resume() : prog.pause();
    }), { threshold: 0.2 });
    io.observe(hero);
    const onVis = () => { if (prog) document.hidden ? prog.pause() : (visible && prog.resume()); };
    document.addEventListener('visibilitychange', onVis);
    page.cleanup.push(() => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); });

    // Clocks
    const clocks = $$('.office__time');
    const tick = () => clocks.forEach(c => {
      try { c.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.dataset.tz }).format(new Date()) + ' local time'; } catch (e) { c.textContent = ''; }
    });
    tick(); const clk = setInterval(tick, 20000); page.cleanup.push(() => clearInterval(clk));

    initAccordions($$('.disc__row'), '.disc__btn', '.disc__panel');
    $$('[data-carousel]').forEach(initCarousel);
    $$('[data-map]').forEach(root => {
      const api = initProjectsMap(root, P);
      if (api) page.cleanup.push(M.whenNear(root, () => api.init()));
    });

    if (!ANIM) { progress(); return; }

    // Opening: the four areas rise one after the other, their names lift out of the frame
    const items = $$('.stage__item'), names = $$('.stage__t .ln__in'), small = $$('.stage__c, .stage__go');
    gsap.set(items, { opacity: 0, y: 40 });
    gsap.set(names, { yPercent: 110 });
    gsap.set(small, { opacity: 0 });
    page.intro = () => gsap.timeline()
      .to(items, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }, 0)
      .to(names, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.09 }, 0.35)
      .to(small, { opacity: 1, duration: 0.6, stagger: 0.03 }, 0.7)
      .add(() => gsap.set([items, names, small], { clearProps: 'transform,opacity' }))
      .add(progress, 0.6);
    const intro = ['.hero__head', '.hero__stage', '.hero__info', '.hero__steps'];
    gsap.set(intro, { opacity: 0, y: 24 });
    ScrollTrigger.create({ trigger: '.hero', start: 'top 85%', once: true, onEnter: () => gsap.to(intro, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08 }) });

    // Project list: each image opens out from a slightly inset frame as it scrolls into view
    // (clip only, never a zoom, so the photos stay sharp)
    const mmEd = gsap.matchMedia();
    page.cleanup.push(() => mmEd.revert());
    mmEd.add('(min-width: 861px)', () => {
      $$('.ed__img').forEach(el => gsap.fromTo(el, { clipPath: 'inset(8% 8% 8% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 40%', scrub: 0.5 } }));
    });

    // Figures count up once
    $$('.fig__n[data-count]').forEach(el => {
      const n = +el.dataset.count, o = { v: 0 }, t = el.firstChild;
      t.nodeValue = '0';
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.8, ease: 'expo.out', onUpdate: () => { t.nodeValue = Math.round(o.v); } }) });
    });
    $$('.disc__img').forEach(el => el.setAttribute('data-r', 'img'));
  }

  /* ------------------------------------------------- header areas */
  const topOf = a => (a && a.parent ? areaById[a.parent] : a);
  // Highlight the area(s) of the current page in the header (desktop menu and phone strip)
  function navActive(tops, sub) {
    $$('.header [data-top]').forEach(a => {
      const on = a.dataset.area ? a.dataset.area === sub : tops.includes(a.dataset.top);
      a.classList.toggle('is-active', on);
      if (on && (a.dataset.area || sub === a.dataset.top)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const strip = $('.header__strip'), act = $('.header__strip .is-active');
    if (strip && act) strip.scrollTo({ left: act.offsetLeft - (strip.clientWidth - act.offsetWidth) / 2, behavior: 'smooth' });
  }

  /* ---------------------------------------------------- titles fit */
  // Words never break; if the longest word is wider than its column, shrink that title to fit
  const FIT = '.hero__title, .proj__title, .phead__title, .pindex__title, .sec__title, .fphil__title, .fsec__title, .psec__title, .proj__h';
  function fitOne(el) {
    el.style.fontSize = '';
    const words = $$('.wd, .wm', el);
    const avail = el.clientWidth;
    if (!words.length || !avail) return;
    const widest = Math.max(...words.map(w => w.offsetWidth));
    if (widest > avail) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = Math.floor(size * (avail / widest) * 0.97) + 'px';
    }
  }
  const fitTitles = (scope = document) => $$(FIT, scope).forEach(fitOne);

  /* ------------------------------------------------- image groups */
  // Any [data-lbgroup] block: its [data-lbsrc] images open together in the viewer
  function initImageGroups(scope) {
    const LB = window.HA_LIGHTBOX;
    if (!LB) return;
    $$('[data-lbgroup]', scope).forEach(group => {
      const btns = $$('[data-lbsrc]', group);
      const items = btns.map(b => ({ src: b.dataset.lbsrc }));
      btns.forEach((b, i) => b.addEventListener('click', () => LB.open(items, i, { title: group.dataset.lbgroup, lock })));
    });
    page.cleanup.push(() => { if (LB.isOpen) LB.close(true); });
  }

  /* ---------------------------------------------------------- accordion */
  function initAccordions(rows, btnSel, panelSel) {
    rows.forEach(row => {
      const btn = $(btnSel, row), panel = $(panelSel, row);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        btn.setAttribute('aria-expanded', open);
        row.classList.toggle('is-open', open);
        if (!window.gsap || reduced) { panel.hidden = !open; return; }
        if (open) {
          panel.hidden = false;
          gsap.fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.8, ease: 'expo.inOut', onComplete: () => { panel.style.height = ''; ScrollTrigger.refresh(); } });
          const ims = $$('img', panel).map(i => i.parentElement);
          if (ims.length) gsap.fromTo(ims, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06, delay: 0.2 });
        } else {
          gsap.to(panel, { height: 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => { panel.hidden = true; panel.style.height = ''; ScrollTrigger.refresh(); } });
        }
      });
    });
  }

  /* ---------------------------------------------------------- projects */
  function initProjects(route) {
    const root = $('.pindex');
    const panes = $$('[data-view-pane]', root);
    const gridItems = $$('.pgrid__item', root), rows = $$('.prow', root), idx = $$('.pidx__row', root);
    const empty = $('.empty', root), countEl = $('.pindex__count', root), titleEl = $('.pindex__title', root);
    const sel = k => $(`[data-tool="${k}"]`, root);
    const store = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } return null; };
    let mapApi = null, mapReady = false;
    let view = store('ha-view') || 'grid';
    let sort = store('ha-sort') || 'featured';

    let active = route.area && areaBySlug[route.area] ? areaBySlug[route.area] : null;
    const current = () => (active ? P.filter(p => inArea(p, active.slug)) : P);

    // Sorting re-orders the existing cards and rows (no re-render, no flicker)
    const statusRank = p => { const s = (p.facts.Status || '').toLowerCase(); return /complet/.test(s) ? 0 : /construct/.test(s) ? 1 : /design/.test(s) ? 2 : 3; };
    const byTitle = (a, b) => a.title.localeCompare(b.title);
    const SORTS = {
      featured: (a, b) => P.indexOf(a) - P.indexOf(b),
      az: byTitle,
      za: (a, b) => byTitle(b, a),
      location: (a, b) => V.data.country(a).localeCompare(V.data.country(b)) || loc(a).localeCompare(loc(b)) || byTitle(a, b),
      status: (a, b) => statusRank(a) - statusRank(b) || byTitle(a, b),
    };
    function order() {
      const sorted = P.slice().sort(SORTS[sort] || SORTS.featured);
      const g = $('.pgrid', root), l = $('.plist ul', root);
      const gi = Object.fromEntries(gridItems.map(el => [el.dataset.slug, el]));
      const ri = Object.fromEntries(rows.map(el => [el.dataset.slug, el]));
      const x = $('.pidx ol', root), xi = Object.fromEntries(idx.map(el => [el.dataset.slug, el]));
      sorted.forEach(p => { g.appendChild(gi[p.slug]); l.appendChild(ri[p.slug]); x.appendChild(xi[p.slug]); });
    }

    function apply(animate) {
      const list = current(), set = new Set(list.map(p => p.slug));
      gridItems.forEach(el => el.classList.toggle('is-out', !set.has(el.dataset.slug)));
      rows.forEach(el => el.classList.toggle('is-out', !set.has(el.dataset.slug)));
      idx.forEach(el => el.classList.toggle('is-out', !set.has(el.dataset.slug)));
      order();
      empty.hidden = list.length > 0;
      countEl.textContent = pad(list.length);
      const name = active ? active.name : 'Projects';
      $$('.wm', titleEl).forEach(w => w.remove());
      titleEl.insertAdjacentHTML('afterbegin', V.words(name));
      fitOne(titleEl);
      sel('area').value = active ? active.slug : '';
      navActive(active ? [topOf(active).slug] : [], active ? active.slug : null);
      const path = V.link(active ? V.U.area(active) : V.U.projects);
      if (location.pathname !== path) history.replaceState({ path }, '', path);
      document.title = active ? `${active.name} | Projects | H&A Associati` : 'Projects | H&A Associati';
      if (mapApi) mapApi.setProjects(list);
      if (animate && ANIM) {
        const vis = (view === 'list' ? rows : view === 'index' ? idx : gridItems).filter(el => !el.classList.contains('is-out')).slice(0, 12);
        gsap.fromTo(vis, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.03, overwrite: true });
        ScrollTrigger.refresh();
      }
    }
    function setView(v) {
      view = v;
      store('ha-view', v);
      panes.forEach(p => { p.hidden = p.dataset.viewPane !== v; });
      sel('view').value = v;
      sel('sort').closest('.ptool').classList.toggle('is-off', v === 'map');
      if (v === 'map') {
        if (!mapApi) { mapApi = initProjectsMap($('[data-map]', root), current()); mapApi && mapApi.setProjects(current()); }
        if (!mapReady && mapApi) { mapReady = true; mapApi.init().then(() => mapApi.setProjects(current())); }
        else mapApi && mapApi.resize();
      }
      window.ScrollTrigger && ScrollTrigger.refresh();
    }
    sel('area').addEventListener('change', e => { active = e.target.value ? areaBySlug[e.target.value] : null; apply(true); });
    sel('sort').addEventListener('change', e => { sort = e.target.value; store('ha-sort', sort); apply(true); });
    sel('view').addEventListener('change', e => setView(e.target.value));
    if (!SORTS[sort]) sort = 'featured';
    sel('sort').value = sort;
    if (!['grid', 'index', 'list', 'map'].includes(view)) view = 'grid';
    initIndex($('.pidx', root));
    setView(view);
    apply(false);

    if (!ANIM) return;
    titleEl.removeAttribute('data-r');
    const items = (view === 'list' ? rows : view === 'index' ? idx : gridItems).filter(el => !el.classList.contains('is-out')).slice(0, 9);
    gsap.set([titleEl, '.ptools'], { opacity: 0, y: 12 });
    gsap.set(items, { opacity: 0, y: 16 });
    page.intro = () => gsap.timeline()
      .to([titleEl, '.ptools'], { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out', stagger: 0.06 }, 0)
      .to(items, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.04 }, 0.15);
  }

  function initIndex(box) {
    if (!box || touch || !matchMedia('(pointer: fine)').matches) return;
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (x - cx) * 0.16; cy += (y - cy) * 0.16;
      box.style.setProperty('--x', cx.toFixed(1) + 'px'); box.style.setProperty('--y', cy.toFixed(1) + 'px');
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.5 ? requestAnimationFrame(loop) : 0;
    };
    const move = e => {
      const r = box.getBoundingClientRect();
      // keep the image inside the column: near the right edge it stops following
      x = Math.min(e.clientX - r.left, r.width - Math.min(380, Math.max(240, innerWidth * 0.22)) - 40); y = e.clientY - r.top;
      if (reduced) { cx = x; cy = y; }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    box.addEventListener('pointerenter', e => { const r = box.getBoundingClientRect(); cx = x = e.clientX - r.left; cy = y = e.clientY - r.top; move(e); });
    box.addEventListener('pointermove', move);
    page.cleanup.push(() => cancelAnimationFrame(raf));
  }

  /* ----------------------------------------------------------- project */
  function initProject(route) {
    const p = projBySlug[route.slug];
    if (!p) return;
    const cover = $('.proj__cover img');
    page.ready = new Promise(res => { if (!cover || cover.complete) res(); else { cover.onload = cover.onerror = res; } });

    // Image viewer: cover and every gallery image open it
    const LB = window.HA_LIGHTBOX;
    const items = V.lightboxItems(p);
    $$('[data-lb]').forEach(b => b.addEventListener('click', () => LB && LB.open(items, +b.dataset.lb, { title: p.title, lock })));
    page.cleanup.push(() => { if (LB && LB.isOpen) LB.close(true); });

    // Location map
    const lm = $('[data-locmap]');
    if (lm && M && p.geo) {
      const api = M.locationMap(lm, p, V);
      page.cleanup.push(M.whenNear(lm, () => api.init()), () => api.destroy());
    }

    $$('.pnav__img').forEach(el => el.setAttribute('data-r', 'img'));
    initGallery($('.gal'));

    if (!ANIM) return;
    const t = $('.proj__title');
    // Opening: title, place, image and facts fade up together, quickly
    const parts = [t, '.proj__loc', '.proj__cover', '.facts'];
    gsap.set(parts, { opacity: 0, y: 14 });
    page.intro = () => gsap.to(parts, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.07 });
  }

  /* -------------------------------------------------------- firm/people */
  function introTitle() {
    const t = $('.phead__title');
    if (!ANIM || !t) return;
    gsap.set(t, { opacity: 0, y: 14 });
    page.intro = () => gsap.to(t, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
  }
  function initFirm() {
    const im = $('.firm__hero img');
    page.ready = new Promise(res => { if (!im || im.complete) res(); else { im.onload = im.onerror = res; } });
    $$('.firm__hero .frame, .fsec__img').forEach(el => el.setAttribute('data-r', 'img'));
    introTitle();
  }
  /* ------------------------------------------------- project gallery */
  // The images one after the other, large, as you scroll down. A small glass counter
  // follows the image in view; each image rises into place once.
  function initGallery(root) {
    if (!root) return;
    const items = $$('.gal__item', root), count = $('.gal__count', root), b = $('b', count);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) b.textContent = pad(items.indexOf(e.target) + 1);
    }), { rootMargin: '-45% 0px -45% 0px' });
    items.forEach(it => io.observe(it));
    // the counter shows only while the gallery is on screen
    const io2 = new IntersectionObserver(es => es.forEach(e => count.classList.toggle('is-on', e.isIntersecting)), { rootMargin: '-30% 0px -30% 0px' });
    io2.observe($('.gal__list', root));
    page.cleanup.push(() => { io.disconnect(); io2.disconnect(); });
    if (!ANIM) return;
    items.forEach(it => {
      const btn = $('.gal__btn, .gal__vid', it), cap = $('.gal__cap', it);
      gsap.set(btn, { opacity: 0, y: 60 });
      gsap.set(cap, { opacity: 0 });
      ScrollTrigger.create({ trigger: it, start: 'top 90%', once: true, onEnter: () => {
        gsap.to(btn, { opacity: 1, y: 0, duration: 1.4, ease: 'expo.out', clearProps: 'transform' });
        gsap.to(cap, { opacity: 1, duration: 0.8, delay: 0.3 });
      } });
    });
  }

  /* ----------------------------------------------- person profile view */
  // Every person with a profile opens in a full screen of its own. The screens sit side by side:
  // swipe (touch or trackpad), the arrows or the arrow keys move seamlessly to the next person.
  // Each screen scrolls on its own when the biography is long.
  const Person = (() => {
    let el = null, track = null, slides = [], idx = 0, isOpen = false, pushed = false, lastFocus = null, io = null;
    const seen = new WeakSet();
    function build(list) {
      el = document.createElement('div');
      el.className = 'pview';
      el.hidden = true;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-label', 'People');
      el.setAttribute('data-lenis-prevent', '');
      el.innerHTML = `
        <div class="pview__bar wrap">
          <button type="button" class="pview__back"><span class="glass" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" style="transform:rotate(180deg)"><path d="M3 12h17M14 5l7 7-7 7"/></svg></span><span>People</span></button>
          <div class="pview__nav">
            <span class="pview__count" aria-live="polite"></span>
            <button type="button" class="glass pview__prev" aria-label="Previous person">${ARROW}</button>
            <button type="button" class="glass pview__next" aria-label="Next person">${ARROW}</button>
          </div>
        </div>
        <div class="pview__track">${list.map((m, i) => `
          <article class="pslide" aria-label="${V.esc(m.name)}" data-i="${i}">
            <div class="pslide__in wrap">
              <figure class="pslide__ph${m.photo ? '' : ' is-empty'}">${m.photo ? `<img src="${V.esc(m.photo)}" alt="${V.esc(m.name)}" width="660" height="660" loading="lazy" decoding="async">` : ''}</figure>
              <div class="pslide__txt">
                <p class="pslide__role">${V.esc(m.role)}</p>
                <h2 class="pslide__name">${V.words(m.name)}</h2>
                <div class="pslide__bio">${m.bio.map(t => `<p>${V.esc(t)}</p>`).join('')}</div>
              </div>
            </div>
          </article>`).join('')}
        </div>`;
      document.body.appendChild(el);
      track = $('.pview__track', el);
      slides = $$('.pslide', el);
      $('.pview__back', el).addEventListener('click', () => close());
      $('.pview__prev', el).addEventListener('click', () => go(idx - 1));
      $('.pview__next', el).addEventListener('click', () => go(idx + 1));
      addEventListener('keydown', e => {
        if (!isOpen) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      });
      // The screen in view sets the counter and plays its entrance once
      io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) settle(slides.indexOf(e.target)); }), { root: track, threshold: 0.6 });
      slides.forEach(s => io.observe(s));
    }
    function settle(i) {
      idx = i;
      $('.pview__count', el).textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
      $('.pview__prev', el).disabled = i === 0;
      $('.pview__next', el).disabled = i === slides.length - 1;
      const s = slides[i];
      if (!ANIM || seen.has(s)) return;
      seen.add(s);
      gsap.timeline()
        .fromTo($('.pslide__ph', s), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' }, 0)
        .fromTo($$('.pslide__name .wm__in', s), { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, 0.1)
        .fromTo($$('.pslide__role, .pslide__bio p', s), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.04 }, 0.25);
    }
    function go(i, instant) {
      if (i < 0 || i >= slides.length) return;
      track.scrollTo({ left: slides[i].offsetLeft, behavior: instant || reduced ? 'auto' : 'smooth' });
    }
    function open(list, i) {
      if (!el) build(list);
      lastFocus = document.activeElement;
      el.hidden = false; isOpen = true; lock(true);
      go(i, true); settle(i);
      try { history.pushState(Object.assign({}, history.state, { person: 1 }), '', location.href); pushed = true; } catch (e) { pushed = false; }
      if (ANIM) gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut', clearProps: 'clipPath' });
      $('.pview__back', el).focus({ preventScroll: true });
    }
    function close(fromHistory) {
      if (!isOpen) return;
      if (pushed && !fromHistory) { pushed = false; history.back(); return; }
      pushed = false; isOpen = false;
      const done = () => { el.hidden = true; lock(false); lastFocus && lastFocus.focus({ preventScroll: true }); };
      if (ANIM) gsap.to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo.inOut', onComplete: () => { done(); gsap.set(el, { clearProps: 'clipPath' }); } }); else done();
    }
    function destroy() { if (io) io.disconnect(); if (el) el.remove(); el = null; slides = []; isOpen = false; }
    return { open, close, destroy, handlePop() { if (!isOpen) return false; close(true); return true; }, get isOpen() { return isOpen; } };
  })();

  function initPeople() {
    // One sequence of profiles: partners first, then the project team (people with a biography)
    const groups = window.HA_DATA.people;
    const list = [], at = {};
    groups.forEach((g, gi) => g.members.forEach((m, i) => { if (m.bio.length) { at[gi + '-' + i] = list.length; list.push(m); } }));
    $$('[data-person]').forEach(b => b.addEventListener('click', () => { const k = at[b.dataset.person]; if (k != null) Person.open(list, k); }));
    page.cleanup.push(() => { if (Person.isOpen) Person.close(true); Person.destroy(); });
    introTitle();
  }

  /* --------------------------------------------------------- contacts */
  function initContacts() {
    const clocks = $$('.ct-office__time');
    const tick = () => clocks.forEach(c => {
      try { c.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.dataset.tz }).format(new Date()) + ' local time'; } catch (e) { c.textContent = ''; }
    });
    tick(); const clk = setInterval(tick, 20000); page.cleanup.push(() => clearInterval(clk));
    const btns = $$('.ct-office__btn');
    const mark = i => btns.forEach((b, k) => { b.setAttribute('aria-pressed', k === i); b.closest('.ct-office').classList.toggle('is-active', k === i); });
    const el = $('[data-officemap]');
    let api = null;
    if (el && M) {
      api = M.officesMap(el, D_OFFICES(), V.OFFICE_GEO);
      api.onSelect = mark;
      page.cleanup.push(M.whenNear(el, () => api.init()), () => api.destroy());
    }
    btns.forEach((b, i) => b.addEventListener('click', () => { mark(i); api && api.select(i); }));
    introTitle();
  }
  const D_OFFICES = () => window.HA_DATA.site.offices;

  /* ============================================================ ROUTER */
  function setMeta(meta) {
    document.title = meta.title;
    const set = (sel, attr, val) => { const el = $(sel); if (el) el.setAttribute(attr, val); };
    set('meta[name="description"]', 'content', meta.description);
    set('link[rel="canonical"]', 'href', V.SITE_URL + meta.path);
    set('meta[property="og:title"]', 'content', meta.title);
    set('meta[property="og:description"]', 'content', meta.description);
    set('meta[property="og:url"]', 'content', V.SITE_URL + meta.path);
    set('meta[property="og:image"]', 'content', meta.image);
  }

  function teardown() {
    page.cleanup.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });
    if (page.ctx) page.ctx.revert();
    if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(t => t.kill());
    page = { name: '', cleanup: [], ctx: null, closeMenu: page.closeMenu };
  }

  function render(pathname) {
    teardown();
    const r = V.render(pathname);
    page.name = r.name;
    page.route = r.route;
    page.path = location.pathname;
    main.innerHTML = r.html;
    setMeta(r.meta);
    let tops = [];
    if (r.name === 'projects' && r.route.area && areaBySlug[r.route.area]) tops = [topOf(areaBySlug[r.route.area]).slug];
    if (r.name === 'project' && projBySlug[r.route.slug]) tops = projBySlug[r.route.slug].areas.map(id => areaById[id]).filter(a => a && !a.parent).map(a => a.slug);
    if (r.name === 'books' || r.name === 'news') tops = [r.name];
    navActive(tops, r.name === 'projects' ? r.route.area : tops[0] === r.name ? r.name : null);
    scrollTop();
    const init = { home: initHome, projects: () => initProjects(r.route), project: () => initProject(r.route), firm: initFirm, people: initPeople, contacts: initContacts }[r.name] || introTitle;
    fitTitles(main);
    const run = () => { init(); initImageGroups(main); reveals(main); };
    if (window.gsap) page.ctx = gsap.context(run); else run();
    headerState();
    // a new page always starts at the top, also after ScrollTrigger measures it again
    if (window.ScrollTrigger) requestAnimationFrame(() => { scrollTop(); ScrollTrigger.refresh(); if (window.scrollY > 0) scrollTop(); });
  }

  async function go(pathname, push) {
    if (busy) { queued = pathname; return; }
    busy = true;
    if (push) history.pushState({ path: pathname }, '', pathname);
    // The blue curtain is kept for one journey only: from the home page to a main section
    // (Projects, The Firm, People, Contacts). Every other change is a quick, quiet fade.
    const target = V.match(pathname);
    const mainSection = ['firm', 'people', 'contacts'].includes(target.name) || (target.name === 'projects' && !target.area);
    if (!(page.name === 'home' && mainSection)) {
      page.closeMenu && page.closeMenu(true);
      if (ANIM) await gsap.to(main, { opacity: 0, duration: 0.22, ease: 'power1.out' });
      render(pathname);
      if (ANIM) gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out', clearProps: 'opacity' });
      page.intro && page.intro();
      busy = false;
      if (queued) { const q = queued; queued = null; go(q, false); }
      return;
    }
    const curtain = $('.curtain');
    const glyphs = $$('.lg, .lb, .ls', curtain);
    // Smooth movement: the logo appears as the curtain closes, stays readable for a moment
    // while the new page is prepared underneath, then everything lifts away.
    if (ANIM) {
      gsap.killTweensOf([curtain, glyphs]);
      gsap.set(curtain, { visibility: 'visible', clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(glyphs, { opacity: 0, y: 24 });
      gsap.to(glyphs, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out', stagger: 0.02, delay: 0.22 });
      await gsap.to(curtain, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'expo.inOut' });
    }
    const shown = Date.now();
    render(pathname);
    main.focus({ preventScroll: true });
    if (ANIM) {
      await Promise.race([page.ready || Promise.resolve(), new Promise(res => setTimeout(res, 600))]);
      const hold = 420 - (Date.now() - shown); // keep the logo legible
      if (hold > 0) await new Promise(res => setTimeout(res, hold));
      await gsap.timeline()
        .to(glyphs, { opacity: 0, y: -16, duration: 0.4, ease: 'power2.in', overwrite: true })
        .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, 0.12)
        .add(() => page.intro && page.intro(), 0.5)
        .set(curtain, { visibility: 'hidden' });
    } else page.intro && page.intro();
    busy = false;
    if (queued) { const q = queued; queued = null; go(q, false); }
  }

  function internal(a) {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || /\.[a-z0-9]+$/i.test(url.pathname.replace(/index\.html$/, ''))) return null;
    return url;
  }

  function initLinks() {
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href === '#contacts') { e.preventDefault(); page.closeMenu && page.closeMenu(); setTimeout(() => scrollToEl(footer), 350); return; }
      if (href === '#top') { e.preventDefault(); if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
      const url = internal(a);
      if (!url) return;
      e.preventDefault();
      // Any internal link (the logo included) first closes the menu if it is open
      const menuWasOpen = document.body.classList.contains('menu-open');
      page.closeMenu && page.closeMenu(true);
      if (url.pathname === location.pathname) {
        if (menuWasOpen) scrollTop(); else if (lenis) lenis.scrollTo(0, { duration: 1.2 }); else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        return;
      }
      go(url.pathname, true);
    });
    addEventListener('popstate', () => {
      // The phone's back button closes the image viewer instead of leaving the page
      if (window.HA_LIGHTBOX && window.HA_LIGHTBOX.handlePop()) return;
      if (Person.handlePop()) return;
      if (page.route && location.pathname === page.path) return;
      go(location.pathname, false);
    });
  }

  /* ------------------------------------------------------------ loader */
  async function boot() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    ensureChrome();
    initScroll();
    initMenu();
    initAreaNav();
    initLinks();
    const loader = $('.loader');
    render(location.pathname);

    if (!ANIM) { loader && loader.remove(); page.intro && page.intro(); return; }

    let seen = false;
    try { seen = sessionStorage.getItem('ha-intro') === '1'; sessionStorage.setItem('ha-intro', '1'); } catch (e) { /* storage unavailable */ }
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const ready = Promise.race([Promise.all([page.ready || Promise.resolve(), fonts]), new Promise(r => setTimeout(r, seen ? 700 : 2500))]);

    if (!loader) { await ready; page.intro && page.intro(); return; }
    if (seen) {
      $('.loader__count', loader) && $('.loader__count', loader).remove();
      gsap.set($$('.lg, .lb, .ls', loader), { opacity: 0 });
      await ready;
      // Opaque lift (no see-through fade): the navy panel slides away, the page appears beneath
      await gsap.timeline()
        .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.75, ease: 'expo.inOut' })
        .add(() => page.intro && page.intro(), 0.3);
      loader.remove();
      ScrollTrigger.refresh();
      return;
    }

    lock(true);
    const mark = $('.loader__mark', loader), count = $('.loader__count span', loader);
    const prog = { v: 0, target: 0 };
    page.loadProgress = v => { prog.target = Math.max(prog.target, v); };
    const intro = gsap.timeline()
      .from($$('.lg', mark), { y: 40, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05 }, 0.05)
      .from($('.lb', mark), { scaleX: 0, transformOrigin: '0 50%', duration: 0.7, ease: 'expo.inOut' }, 0.1)
      .from($$('.ls', mark), { opacity: 0, y: 8, duration: 0.4, ease: 'expo.out', stagger: 0.02 }, 0.35);
    const counter = gsap.to(prog, { v: 100, duration: 1, ease: 'power2.inOut', onUpdate: () => { count.textContent = Math.round(Math.min(prog.v, 30 + prog.target * 70)); } });
    await ready;
    prog.target = 1;
    await Promise.all([counter, intro]);
    count.textContent = '100';
    await gsap.timeline()
      .to(count, { yPercent: -110, duration: 0.4, ease: 'power2.in' })
      .to($$('.lg, .lb, .ls', mark), { opacity: 0, y: -16, duration: 0.4, ease: 'power2.in' }, 0)
      .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.85, ease: 'expo.inOut' }, 0.15)
      .add(() => page.intro && page.intro(), 0.5);
    loader.remove();
    lock(false);
    ScrollTrigger.refresh();
  }

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { fitTitles(); window.ScrollTrigger && ScrollTrigger.refresh(); headerState(); }, 150); });
  if (document.fonts) document.fonts.ready.then(() => { fitTitles(); window.ScrollTrigger && ScrollTrigger.refresh(); });
  boot();
})();
