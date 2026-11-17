/* ==========================================================================
   H&A Associati — maps
   MapLibre GL + OpenFreeMap vector tiles, restyled in the brand palette.
   Loaded only when a map approaches the viewport.
   Positions are city-level, taken from each project's Location field.
   ========================================================================== */
(function () {
  'use strict';

  const LIB = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
  const STYLE = 'https://tiles.openfreemap.org/styles/positron';
  const NAVY = '#022753';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;
  let loading = null;

  function load() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = LIB + '.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = LIB + '.js'; s.async = true;
      s.onload = () => res(window.maplibregl);
      s.onerror = () => { loading = null; rej(new Error('map library unavailable')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // Recolour the light basemap: blue-grey water, quiet land, navy-tinted 3D buildings
  function brand(map) {
    const set = (id, prop, val) => { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, val); } catch (e) { /* layer differs */ } };
    set('background', 'background-color', '#f5f5f3');
    set('water', 'fill-color', '#d3dce8');
    set('waterway', 'line-color', '#d3dce8');
    set('park', 'fill-color', '#eceeea');
    set('landcover_wood', 'fill-color', '#eceeea');
    set('landuse_residential', 'fill-color', '#efefec');
    ['boundary_2', 'boundary_3'].forEach(id => set(id, 'line-color', '#b8c1cd'));
    map.getStyle().layers.forEach(l => {
      if (l.type !== 'symbol') return;
      set(l.id, 'text-color', '#6f7682'); set(l.id, 'text-halo-color', '#f5f5f3');
      // Place names in English only (the default shows local scripts too)
      if (/^(label_|water_name|waterway_line|airport)/.test(l.id)) {
        try { map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]); } catch (e) { /* keep default */ }
      }
    });
    try {
      const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol');
      if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
      map.addLayer({
        id: 'ha-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': '#dce2ea',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 0.92],
        },
      }, firstSymbol && firstSymbol.id);
    } catch (e) { /* 3D buildings are optional */ }
  }

  function baseOptions(el, extra) {
    return Object.assign({
      container: el, style: STYLE,
      attributionControl: { compact: true },
      scrollZoom: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      cooperativeGestures: touch, maxPitch: 60, fadeDuration: 0,
      renderWorldCopies: false,
    }, extra);
  }

  const lngLat = g => [g[1], g[0]];
  const groupKey = g => g[0].toFixed(3) + ',' + g[1].toFixed(3);

  function boundsOf(list) {
    const b = new maplibregl.LngLatBounds();
    list.forEach(p => p.geo && b.extend(lngLat(p.geo)));
    return b;
  }

  /* ---------------------------------------------------- projects map */
  function projectsMap(root, list, V) {
    const canvas = root.querySelector('.pmap__canvas');
    const listEl = root.querySelector('.pmap__list');
    const tabs = Array.from(root.querySelectorAll('[data-region]'));
    let projects = list.slice();
    let region = 'all';
    let map = null, popup = null;
    const markers = {};

    const features = () => {
      const groups = {};
      projects.filter(p => p.geo && (region === 'all' || V.data.country(p) === region)).forEach(p => {
        const k = groupKey(p.geo);
        (groups[k] = groups[k] || { geo: p.geo, slugs: [] }).slugs.push(p.slug);
      });
      return {
        type: 'FeatureCollection',
        features: Object.entries(groups).map(([k, g]) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: lngLat(g.geo) },
          properties: { key: k, n: g.slugs.length, slugs: g.slugs.join(',') },
        })),
      };
    };

    function visibleList() { return projects.filter(p => region === 'all' || V.data.country(p) === region); }

    function fit(animate) {
      const vis = visibleList().filter(p => p.geo);
      if (!vis.length) return;
      const b = boundsOf(vis);
      const wide = region === 'all';
      const opts = { padding: { top: 70, bottom: 70, left: 70, right: 70 }, maxZoom: wide ? 4 : 9.2, pitch: wide ? 0 : 42, bearing: wide ? 0 : -10, duration: animate && !reduced ? 2600 : 0, essential: true };
      try { map.fitBounds(b, opts); } catch (e) { /* container not sized yet */ }
    }

    function syncList() {
      const set = new Set(visibleList().map(p => p.slug));
      listEl.querySelectorAll('li').forEach(li => { li.hidden = !set.has(li.dataset.slug); });
    }

    function card(slug) {
      const p = V.data.projBySlug[slug];
      return `<a class="mpop__item" href="${V.link(V.U.project(slug))}"><img src="${V.esc(V.smallUrl(p.cover, 300))}" alt="" width="96" height="64" loading="lazy"><span><b>${V.esc(p.title)}</b><small>${V.esc(V.data.loc(p))}</small></span></a>`;
    }

    function openPopup(coords, slugs) {
      popup && popup.remove();
      popup = new maplibregl.Popup({ offset: 20, maxWidth: '340px', className: 'mpop', focusAfterOpen: false })
        .setLngLat(coords).setHTML(`<div class="mpop__list">${slugs.map(card).join('')}</div>`).addTo(map);
    }

    function updateMarkers() {
      if (!map.getSource('p') || !map.isSourceLoaded('p')) return;
      const seen = {};
      map.querySourceFeatures('p').forEach(f => {
        const pr = f.properties;
        const id = pr.cluster ? 'c' + pr.cluster_id : 'g' + pr.key;
        if (seen[id]) return;
        seen[id] = true;
        if (!markers[id]) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'mk' + (pr.cluster ? ' mk--cluster' : '');
          const n = pr.n;
          el.innerHTML = `<span>${n}</span>`;
          el.setAttribute('aria-label', `${n} project${n > 1 ? 's' : ''}`);
          el.dataset.slugs = pr.slugs || '';
          el.addEventListener('click', ev => {
            ev.stopPropagation();
            if (pr.cluster) {
              map.getSource('p').getClusterExpansionZoom(pr.cluster_id).then(z => map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.3, duration: reduced ? 0 : 1200 })).catch(() => {});
            } else openPopup(f.geometry.coordinates, pr.slugs.split(','));
          });
          markers[id] = new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates);
          if (pr.cluster) {
            map.getSource('p').getClusterLeaves(pr.cluster_id, 100, 0).then(leaves => {
              el.dataset.slugs = leaves.map(l => l.properties.slugs).join(',');
            }).catch(() => {});
          }
        }
        if (!markers[id]._on) { markers[id].addTo(map); markers[id]._on = true; }
      });
      Object.keys(markers).forEach(id => { if (!seen[id] && markers[id]._on) { markers[id].remove(); markers[id]._on = false; } });
    }

    function setRegion(r, animate) {
      region = r;
      tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.region === r));
      syncList();
      if (!map) return;
      popup && popup.remove();
      Object.keys(markers).forEach(k => { markers[k].remove(); delete markers[k]; });
      map.getSource('p') && map.getSource('p').setData(features());
      fit(animate);
    }
    tabs.forEach(t => t.addEventListener('click', () => setRegion(t.dataset.region, true)));

    // Hovering the list lights up the matching marker
    listEl.addEventListener('pointerover', e => {
      const li = e.target.closest('li'); if (!li) return;
      Object.values(markers).forEach(m => m.getElement().classList.toggle('is-hot', m._on && (m.getElement().dataset.slugs || '').split(',').includes(li.dataset.slug)));
    });
    listEl.addEventListener('pointerleave', () => Object.values(markers).forEach(m => m.getElement().classList.remove('is-hot')));

    function init() {
      return load().then(() => {
        canvas.innerHTML = '';
        map = new maplibregl.Map(baseOptions(canvas, { center: [60, 36], zoom: 1.2 }));
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.on('load', () => {
          brand(map);
          map.addSource('p', { type: 'geojson', data: features(), cluster: true, clusterRadius: 46, clusterMaxZoom: 12, clusterProperties: { n: ['+', ['get', 'n']] } });
          map.addLayer({ id: 'p-anchor', type: 'circle', source: 'p', paint: { 'circle-radius': 0, 'circle-opacity': 0 } });
          let raf = 0;
          map.on('render', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; updateMarkers(); }); });
          fit(true);
        });
        map.on('click', () => popup && popup.remove());
        return map;
      }).catch(() => { canvas.innerHTML = '<div class="pmap__note">The map could not be loaded. All locations are listed here.</div>'; });
    }

    return {
      init,
      resize() { map && map.resize(); },
      setProjects(next) {
        projects = next.slice();
        tabs.forEach(t => {
          const r = t.dataset.region;
          const n = r === 'all' ? projects.length : projects.filter(p => V.data.country(p) === r).length;
          const sup = t.querySelector('sup'); if (sup) sup.textContent = n;
          t.hidden = r !== 'all' && !n;
        });
        if (region !== 'all' && !projects.some(p => V.data.country(p) === region)) region = 'all';
        setRegion(region, !!map);
      },
      destroy() { popup && popup.remove(); map && map.remove(); map = null; },
    };
  }

  /* ------------------------------------------- single project location */
  function locationMap(el, p, V) {
    let map = null, flown = false, io = null;
    const nearby = V.data.P.filter(q => q !== p && q.geo && V.data.country(q) === V.data.country(p));
    function init() {
      return load().then(() => {
        const c = lngLat(p.geo);
        map = new maplibregl.Map(baseOptions(el, { center: c, zoom: 3.4, pitch: 0, bearing: 0 }));
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
        map.on('load', () => {
          brand(map);
          nearby.forEach(q => {
            const a = document.createElement('a');
            a.className = 'mk mk--small'; a.href = V.link(V.U.project(q.slug)); a.title = q.title;
            a.setAttribute('aria-label', q.title);
            new maplibregl.Marker({ element: a }).setLngLat(lngLat(q.geo)).addTo(map);
          });
          const m = document.createElement('div');
          m.className = 'mk mk--main';
          m.innerHTML = `<span class="mk__label">${V.esc(V.data.loc(p))}</span>`;
          new maplibregl.Marker({ element: m, anchor: 'left', offset: [-9, 0] }).setLngLat(c).addTo(map);
          const fly = () => {
            if (flown) return; flown = true;
            const t = { center: c, zoom: 10.6, pitch: 52, bearing: -16, essential: true };
            if (reduced) map.jumpTo(t); else map.flyTo(Object.assign(t, { duration: 5200, curve: 1.5 }));
          };
          io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fly(); io.disconnect(); } }), { threshold: 0.45 });
          io.observe(el);
        });
        return map;
      }).catch(() => { el.innerHTML = `<div class="pmap__note">${V.esc(V.data.loc(p))}</div>`; });
    }
    return { init, destroy() { io && io.disconnect(); map && map.remove(); map = null; } };
  }

  // Start a map only once it is about to scroll into view
  function whenNear(el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return () => {}; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }

  window.HA_MAP = { load, projectsMap, locationMap, whenNear, NAVY };
})();
