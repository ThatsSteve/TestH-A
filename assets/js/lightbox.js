/* ==========================================================================
   H&A Associati — image viewer
   Open:  click or tap any project image.
   Zoom:  click/tap the image, double-tap, pinch, mouse wheel, + / - keys, zoom button.
   Pan:   drag when zoomed.
   Move:  arrows, ← / → keys, swipe left/right.
   Close: ✕, Esc, click the dark background, swipe down, or the phone's back button.
   ========================================================================== */
(function () {
  'use strict';

  const ICON = {
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    zin: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/></svg>',
    zout: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 12h17M14 5l7 7-7 7"/></svg>',
  };
  const pad = n => String(n).padStart(2, '0');

  let el, stage, img, countEl, capEl, zoomBtn, closeBtn, prevBtn, nextBtn;
  let items = [], idx = 0, label = '', lockFn = () => {};
  let s = 1, x = 0, y = 0, maxS = 2.5;
  let isOpen = false, pushed = false, lastFocus = null, lastTap = 0;
  const ptrs = new Map();
  let g = null; // current gesture

  function build() {
    el = document.createElement('div');
    el.className = 'lbx';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Image viewer');
    el.setAttribute('data-lenis-prevent', '');
    el.innerHTML = `
      <div class="lbx__stage"><img class="lbx__img" alt="" draggable="false"></div>
      <div class="lbx__top">
        <span class="lbx__count" aria-live="polite"></span>
        <div class="lbx__tools">
          <button class="lbx__btn lbx__zoom" type="button" aria-label="Zoom in">${ICON.zin}</button>
          <button class="lbx__btn lbx__close" type="button" aria-label="Close">${ICON.close}</button>
        </div>
      </div>
      <button class="lbx__btn lbx__nav lbx__prev" type="button" aria-label="Previous image">${ICON.arrow}</button>
      <button class="lbx__btn lbx__nav lbx__next" type="button" aria-label="Next image">${ICON.arrow}</button>
      <p class="lbx__cap"></p>`;
    document.body.appendChild(el);
    stage = el.querySelector('.lbx__stage'); img = el.querySelector('.lbx__img');
    countEl = el.querySelector('.lbx__count'); capEl = el.querySelector('.lbx__cap');
    zoomBtn = el.querySelector('.lbx__zoom'); closeBtn = el.querySelector('.lbx__close');
    prevBtn = el.querySelector('.lbx__prev'); nextBtn = el.querySelector('.lbx__next');

    closeBtn.addEventListener('click', () => close());
    zoomBtn.addEventListener('click', () => (s > 1.01 ? reset(true) : zoomTo(maxS, null, true)));
    prevBtn.addEventListener('click', () => show(idx - 1));
    nextBtn.addEventListener('click', () => show(idx + 1));
    img.addEventListener('load', () => { img.classList.add('is-ready'); fit(); });

    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', wheel, { passive: false });
    addEventListener('keydown', key);
    addEventListener('resize', () => { if (isOpen) { fit(); reset(false); } });
  }

  /* ------------------------------------------------------- transform */
  function size() { return { w: img.offsetWidth, h: img.offsetHeight, W: stage.clientWidth, H: stage.clientHeight }; }
  function fit() {
    const { w } = size();
    const nat = img.naturalWidth || w;
    maxS = Math.min(4, Math.max(2.2, nat / Math.max(1, w)));
  }
  function clamp() {
    const { w, h, W, H } = size();
    const bx = Math.max(0, (w * s - W) / 2), by = Math.max(0, (h * s - H) / 2);
    x = Math.min(bx, Math.max(-bx, x));
    y = Math.min(by, Math.max(-by, y));
  }
  function apply(animate) {
    img.style.transition = animate ? 'transform .35s cubic-bezier(.2,.8,.2,1), opacity .25s' : 'opacity .25s';
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    const z = s > 1.01;
    el.classList.toggle('is-zoomed', z);
    zoomBtn.innerHTML = z ? ICON.zout : ICON.zin;
    zoomBtn.setAttribute('aria-label', z ? 'Zoom out' : 'Zoom in');
  }
  function reset(animate) { s = 1; x = 0; y = 0; apply(animate); el.style.setProperty('--fade', 1); }
  // Zoom keeping the point under the cursor/finger still
  function zoomTo(ns, pt, animate) {
    ns = Math.min(maxS * 1.15, Math.max(1, ns));
    const r = stage.getBoundingClientRect();
    const px = pt ? pt.x - (r.left + r.width / 2) : 0, py = pt ? pt.y - (r.top + r.height / 2) : 0;
    x = px - (px - x) * (ns / s);
    y = py - (py - y) * (ns / s);
    s = ns;
    if (s <= 1.01) { s = 1; x = 0; y = 0; }
    clamp(); apply(animate);
  }

  /* ---------------------------------------------------------- gestures */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function down(e) {
    if (e.target.closest('button')) return;
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) g = { type: 'drag', sx: e.clientX, sy: e.clientY, ox: x, oy: y, t: Date.now(), moved: false, onImg: e.target === img };
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      g = { type: 'pinch', d0: dist(a, b), s0: s, m0: mid(a, b), ox: x, oy: y };
    }
  }
  function move(e) {
    if (!ptrs.has(e.pointerId) || !g) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.type === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const m = mid(a, b);
      // scale around the starting midpoint, then follow the fingers
      s = g.s0; x = g.ox; y = g.oy;
      zoomTo(g.s0 * dist(a, b) / g.d0, g.m0, false);
      x += m.x - g.m0.x; y += m.y - g.m0.y; clamp(); apply(false);
      return;
    }
    if (g.type !== 'drag') return;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > 6) { g.moved = true; el.classList.add('is-dragging'); }
    if (!g.moved) return;
    if (s > 1.01) { x = g.ox + dx; y = g.oy + dy; clamp(); apply(false); }
    else {
      // not zoomed: preview the swipe
      const vertical = Math.abs(dy) > Math.abs(dx);
      x = vertical ? 0 : dx; y = vertical && dy > 0 ? dy : 0;
      apply(false);
      el.style.setProperty('--fade', vertical && dy > 0 ? Math.max(0.35, 1 - dy / 500) : 1);
    }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    el.classList.remove('is-dragging');
    if (!g) return;
    if (g.type === 'pinch') {
      if (ptrs.size === 0) { g = null; if (s < 1.05) reset(true); }
      return;
    }
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy, dt = Date.now() - g.t;
    const gesture = g; g = null;
    if (!gesture.moved && dt < 400) { tap(e, gesture.onImg); return; }
    if (s > 1.01) return;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && items.length > 1) { show(idx + (dx < 0 ? 1 : -1)); return; }
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) { close(); return; }
    reset(true);
  }
  function tap(e, onImg) {
    const now = Date.now();
    const dbl = now - lastTap < 320;
    lastTap = now;
    if (!onImg) { if (s > 1.01) reset(true); else close(); return; }
    if (dbl) { if (s <= 1.01) zoomTo(maxS, { x: e.clientX, y: e.clientY }, true); return; }
    if (s > 1.01) reset(true); else zoomTo(maxS, { x: e.clientX, y: e.clientY }, true);
  }
  function wheel(e) {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
    zoomTo(s * factor, { x: e.clientX, y: e.clientY }, false);
  }
  function key(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === '+' || e.key === '=') zoomTo(s * 1.5, null, true);
    else if (e.key === '-') zoomTo(s / 1.5, null, true);
    else if (e.key === 'Tab') {
      const f = [...el.querySelectorAll('button')].filter(b => b.offsetParent !== null);
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }

  /* ------------------------------------------------------- open/close */
  function show(i) {
    if (!items.length) return;
    idx = (i + items.length) % items.length;
    const it = items[idx];
    reset(false);
    img.classList.remove('is-ready');
    img.removeAttribute('src');
    img.alt = `${label}, image ${idx + 1} of ${items.length}`;
    img.src = it.src;
    if (img.complete && img.naturalWidth) { img.classList.add('is-ready'); fit(); }
    countEl.textContent = `${pad(idx + 1)} / ${pad(items.length)}`;
    capEl.textContent = label;
    const many = items.length > 1;
    prevBtn.hidden = nextBtn.hidden = !many;
    // preload neighbours
    [1, -1].forEach(d => { const n = items[(idx + d + items.length) % items.length]; if (n) { const p = new Image(); p.src = n.src; } });
  }

  function open(list, start, opts = {}) {
    if (!el) build();
    items = list; label = opts.title || ''; lockFn = opts.lock || (() => {});
    lastFocus = document.activeElement;
    el.hidden = false;
    show(start || 0);
    requestAnimationFrame(() => el.classList.add('is-open'));
    lockFn(true);
    isOpen = true;
    try { history.pushState(Object.assign({}, history.state, { lb: 1 }), '', location.href); pushed = true; } catch (e) { pushed = false; }
    closeBtn.focus({ preventScroll: true });
  }

  function close(fromHistory) {
    if (!isOpen) return;
    if (pushed && !fromHistory) { pushed = false; history.back(); return; } // popstate finishes the close
    pushed = false;
    isOpen = false;
    ptrs.clear(); g = null;
    el.classList.remove('is-open');
    lockFn(false);
    setTimeout(() => { if (!isOpen) { el.hidden = true; reset(false); img.removeAttribute('src'); } }, 260);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // Called by the router on popstate: returns true if the event closed the viewer
  function handlePop() { if (!isOpen) return false; close(true); return true; }

  window.HA_LIGHTBOX = { open, close, handlePop, get isOpen() { return isOpen; } };
})();
