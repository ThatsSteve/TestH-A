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
  const { P, featured, projBySlug, areaBySlug, areaById, inArea, loc } = V.data;
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
    let lastY = window.scrollY;
    addEventListener('scroll', () => {
      const y = window.scrollY;
      const menuOpen = document.body.classList.contains('menu-open');
      if (!menuOpen) {
        if (y > 320 && y > lastY + 4) header.classList.add('is-hidden');
        else if (y < lastY - 4 || y < 320) header.classList.remove('is-hidden');
      }
      lastY = y;
      headerState();
    }, { passive: true });
  }
  const scrollTop = () => { if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0); };
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
    $$('[data-r="words"]', scope).forEach(el => {
      const ins = $$('.wm__in', el);
      gsap.set(ins, { yPercent: 110 });
      once(el, () => gsap.to(ins, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.03 }));
    });
    $$('[data-r="up"]', scope).forEach(el => {
      gsap.set(el, { opacity: 0, y: 28 });
      once(el, () => gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }));
    });
    // Images: a soft fade with a slight rise, no zoom (never upscale the photos)
    $$('[data-r="img"]', scope).forEach(el => {
      gsap.set(el, { opacity: 0, y: 32 });
      once(el, () => gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }), 'top 94%');
    });
  }

  /* ---------------------------------------------------------------- menu */
  function initMenu() {
    const burger = $('.header__burger'), menu = $('#menu');
    let open = false, tl = null;
    const set = v => {
      open = v;
      burger.setAttribute('aria-expanded', v);
      burger.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', v);
      header.classList.remove('is-hidden');
      lock(v);
      tl && tl.kill();
      if (v) menu.hidden = false;
      if (!ANIM) { if (!v) menu.hidden = true; return; }
      if (v) {
        tl = gsap.timeline()
          .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.inOut' })
          .fromTo($$('.menu__main .ln__in'), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05 }, '-=0.3')
          .fromTo($$('.menu__areas > div, .menu__foot'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.04 }, '-=0.7');
      } else {
        tl = gsap.timeline().to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.6, ease: 'expo.inOut', onComplete: () => { menu.hidden = true; } });
      }
    };
    burger.addEventListener('click', () => set(!open));
    menu.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) { set(false); burger.focus(); } });
    page.closeMenu = () => open && set(false);
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
    const hero = $('.hero');
    const frame = $('.hero__frame');
    const canvas = $('.hero__canvas');
    const imgs = $$('.hero__imgs img');
    const titleA = $('.hero__title a');
    const locEl = $('.hero__loc span');
    const openEl = $('.hero__open');
    const count = $('.hero__count b');
    const steps = $$('.hero__step');
    const f = featured;
    const DUR = 7;
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
      if (useGL) gl.goTo(i); else imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
      if (ANIM) {
        gsap.timeline()
          .to($$('.ch', titleA), { yPercent: -110, duration: 0.5, ease: 'expo.in', stagger: 0.01 })
          .to(locEl, { yPercent: -110, duration: 0.45, ease: 'expo.in' }, 0)
          .add(() => {
            titleA.innerHTML = V.chars(p.title);
            fitOne(titleA.parentElement);
            locEl.textContent = loc(p);
            gsap.fromTo($$('.ch', titleA), { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.015, delay: 0.1 });
            gsap.fromTo(locEl, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', delay: 0.3 });
          });
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

    gsap.set($$('.ch', titleA), { yPercent: 110 });
    gsap.set(locEl, { yPercent: 110 });
    gsap.set(['.hero__open', '.hero__bar'], { opacity: 0, y: 16 });
    gsap.set(frame, { opacity: 0, y: 24 });
    page.intro = () => gsap.timeline()
      .to(frame, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0)
      .to($$('.ch', titleA), { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.022 }, 0.5)
      .to(locEl, { yPercent: 0, duration: 1, ease: 'expo.out' }, 0.8)
      .to(['.hero__open', '.hero__bar'], { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.9)
      .add(progress, 1.1);

    // The statement fills with ink as it is read
    gsap.to($$('.statement__text .w'), { color: '#022753', stagger: 0.1, ease: 'none', scrollTrigger: { trigger: '.statement__text', start: 'top 80%', end: 'bottom 50%', scrub: true } });

    // Figures count up once
    $$('.fig__n[data-count]').forEach(el => {
      const n = +el.dataset.count, o = { v: 0 }, t = el.firstChild;
      t.nodeValue = '0';
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: n, duration: 1.8, ease: 'expo.out', onUpdate: () => { t.nodeValue = Math.round(o.v); } }) });
    });
    $$('.disc__img').forEach(el => el.setAttribute('data-r', 'img'));
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
    const gridItems = $$('.pgrid__item', root), rows = $$('.prow', root);
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
      sorted.forEach(p => { g.appendChild(gi[p.slug]); l.appendChild(ri[p.slug]); });
    }

    function apply(animate) {
      const list = current(), set = new Set(list.map(p => p.slug));
      gridItems.forEach(el => el.classList.toggle('is-out', !set.has(el.dataset.slug)));
      rows.forEach(el => el.classList.toggle('is-out', !set.has(el.dataset.slug)));
      order();
      empty.hidden = list.length > 0;
      countEl.textContent = pad(list.length);
      const name = active ? active.name : 'Projects';
      $$('.wm', titleEl).forEach(w => w.remove());
      titleEl.insertAdjacentHTML('afterbegin', V.words(name));
      fitOne(titleEl);
      sel('area').value = active ? active.slug : '';
      const path = V.link(active ? V.U.area(active) : V.U.projects);
      if (location.pathname !== path) history.replaceState({ path }, '', path);
      document.title = active ? `${active.name} | Projects | H&A Associati` : 'Projects | H&A Associati';
      if (mapApi) mapApi.setProjects(list);
      if (animate && ANIM) {
        const vis = (view === 'list' ? rows : gridItems).filter(el => !el.classList.contains('is-out')).slice(0, 12);
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
    if (!['grid', 'list', 'map'].includes(view)) view = 'grid';
    setView(view);
    apply(false);

    if (!ANIM) return;
    const ins = $$('.wm__in', titleEl);
    gsap.set(ins, { yPercent: 110 });
    titleEl.removeAttribute('data-r');
    const items = (view === 'list' ? rows : gridItems).filter(el => !el.classList.contains('is-out')).slice(0, 9);
    gsap.set(items, { opacity: 0, y: 30 });
    page.intro = () => gsap.timeline()
      .to($$('.wm__in', titleEl), { yPercent: 0, duration: 1.1, ease: 'expo.out' }, 0)
      .to(items, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.05 }, 0.2);
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

    $$('.gitem, .pnav__img').forEach(el => el.setAttribute('data-r', 'img'));

    if (!ANIM) return;
    const t = $('.proj__title');
    gsap.set($$('.wm__in', t), { yPercent: 110 });
    gsap.set($$('.proj__loc .ln__in'), { yPercent: 110 });
    gsap.set('.proj__cover', { opacity: 0, y: 28 });
    gsap.set($$('.facts__row'), { opacity: 0, y: 16 });
    page.intro = () => gsap.timeline()
      .to($$('.wm__in', t), { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05 }, 0)
      .to($$('.proj__loc .ln__in'), { yPercent: 0, duration: 1, ease: 'expo.out' }, 0.25)
      .to('.proj__cover', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0.2)
      .to($$('.facts__row'), { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, 0.7);
  }

  /* -------------------------------------------------------- firm/people */
  function introTitle() {
    const t = $('.phead__title');
    if (!ANIM || !t) return;
    gsap.set($$('.wm__in', t), { yPercent: 110 });
    page.intro = () => gsap.to($$('.wm__in', t), { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06 });
  }
  function initFirm() {
    const im = $('.firm__hero img');
    page.ready = new Promise(res => { if (!im || im.complete) res(); else { im.onload = im.onerror = res; } });
    $$('.firm__hero .frame, .fsec__img').forEach(el => el.setAttribute('data-r', 'img'));
    introTitle();
  }
  function initPeople() {
    initAccordions($$('.partner'), '.partner__btn', '.partner__panel');
    $$('.member').forEach(m => {
      const b = $('.member__more', m), bio = $('.member__bio', m);
      if (!b) return;
      b.addEventListener('click', () => { const o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', o); bio.hidden = !o; m.classList.toggle('is-open', o); window.ScrollTrigger && ScrollTrigger.refresh(); });
    });
    introTitle();
  }

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
    $$('.header__nav a').forEach(a => {
      const n = a.dataset.nav;
      const on = n === r.name || (n === 'projects' && r.name === 'project');
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    scrollTop();
    const init = { home: initHome, projects: () => initProjects(r.route), project: () => initProject(r.route), firm: initFirm, people: initPeople }[r.name] || introTitle;
    fitTitles(main);
    const run = () => { init(); initImageGroups(main); reveals(main); };
    if (window.gsap) page.ctx = gsap.context(run); else run();
    headerState();
    if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh());
  }

  async function go(pathname, push) {
    if (busy) { queued = pathname; return; }
    busy = true;
    if (push) history.pushState({ path: pathname }, '', pathname);
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
      if (url.pathname === location.pathname) { scrollToEl(document.body); return; }
      go(url.pathname, true);
    });
    addEventListener('popstate', () => {
      // The phone's back button closes the image viewer instead of leaving the page
      if (window.HA_LIGHTBOX && window.HA_LIGHTBOX.handlePop()) return;
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
      await gsap.to(loader, { opacity: 0, duration: 0.3, ease: 'power2.out' });
      loader.remove();
      page.intro && page.intro();
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
