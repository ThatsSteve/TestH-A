/* H&A Associati — WebGL hero slideshow.
   A noise-driven "rising water" wipe between project images, slow camera drift,
   and a soft response to the pointer. Falls back to CSS if WebGL is unavailable. */
(function () {
  const VERT = `
    attribute vec2 a; varying vec2 vUv;
    void main(){ vUv = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }`;

  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D t0, t1;
    uniform vec2 s0, s1;        // cover scale for each texture
    uniform float p;            // transition progress 0..1
    uniform float z;            // slow zoom (ken burns)
    uniform float time;
    uniform vec2 mouse;         // -1..1

    float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 q){
      vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);
      return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y);
    }
    vec2 cover(vec2 uv, vec2 s, float k){ return (uv - .5) * s * k + .5; }

    void main(){
      vec2 uv = vUv;
      vec2 m = mouse * 0.;

      // reveal field: low values open first (from the bottom, like water rising)
      float n = noise(uv * vec2(2.4, 4.0) + time * .08) * .65 + noise(uv * 11. - time * .05) * .35;
      float v = uv.y * .62 + n * .38;
      float wd = .22;
      float mask = 1. - smoothstep(p * (1. + wd) - wd, p * (1. + wd), v);
      float band = mask * (1. - mask) * 4.;

      vec2 uv0 = uv + vec2(0., band * .03) + m;
      vec2 uv1 = uv - vec2(0., band * .035) + m;

      // no drift or zoom at rest: images are shown at their native framing
      float k0 = 1. - z * 0.;
      float k1 = 1.;
      vec4 c0 = texture2D(t0, cover(uv0, s0, k0));
      vec4 c1 = texture2D(t1, cover(uv1, s1, k1));

      vec4 col = mix(c0, c1, mask);
      // a thin bright meniscus along the edge
      col.rgb += band * .05;
      gl_FragColor = col;
    }`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  window.HeroGL = function (canvas, srcs, onProgress) {
    let gl = null;
    try { gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false }); } catch (e) { gl = null; }

    const state = { cur: 0, next: 0, p: 0, z: 0, time: 0, mouse: [0, 0], tm: [0, 0], running: false, raf: 0 };
    const textures = [], images = [];
    let loaded = 0;

    const ready = Promise.all(srcs.map((s, i) => loadImage(s).then(img => {
      images[i] = img; loaded++; onProgress && onProgress(loaded / srcs.length); return img;
    }).catch(() => { loaded++; onProgress && onProgress(loaded / srcs.length); return null; })));

    if (!gl) return { ok: false, ready, drawn: Promise.resolve(false), images, goTo() {}, start() {}, stop() {}, destroy() {}, setMouse() {} };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    ['t0', 't1', 's0', 's1', 'p', 'z', 'time', 'mouse'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    gl.uniform1i(U.t0, 0); gl.uniform1i(U.t1, 1);

    function makeTex(img) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); }
      catch (e) { return null; }
      return t;
    }

    function coverScale(img) {
      const ca = canvas.width / canvas.height, ia = img.naturalWidth / img.naturalHeight;
      return [Math.min(1, ca / ia), Math.min(1, ia / ca)];
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw() {
      const a = images[state.cur], b = images[state.next];
      if (!a || !textures[state.cur]) return;
      resize();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures[state.cur]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures[state.next] || textures[state.cur]);
      gl.uniform2fv(U.s0, coverScale(a));
      gl.uniform2fv(U.s1, coverScale(b || a));
      gl.uniform1f(U.p, state.p);
      gl.uniform1f(U.z, state.z);
      gl.uniform1f(U.time, state.time);
      gl.uniform2fv(U.mouse, state.mouse);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Draws only when something changes: at rest the GPU is idle
    const onResize = () => requestAnimationFrame(draw);
    addEventListener('resize', onResize);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
    ro && ro.observe(canvas);
    const drawn = ready.then(() => { images.forEach((img, i) => { if (img) textures[i] = makeTex(img); }); draw(); return textures.filter(Boolean).length > 0; });

    let tween = null;
    return {
      ok: true, ready, drawn, images,
      start() { draw(); },
      stop() {},
      setMouse() {},
      goTo(i, dur = 1.5) {
        if (i === state.cur || !images[i]) return;
        if (tween) { tween.kill(); state.cur = state.next; }
        state.next = i; state.p = 0;
        const done = () => { state.cur = i; state.p = 0; tween = null; draw(); };
        if (window.gsap) tween = gsap.to(state, { p: 1, duration: dur, ease: 'power2.inOut', onComplete: done, onUpdate: () => { state.time += 1 / 60; draw(); } });
        else done();
      },
      destroy() {
        removeEventListener('resize', onResize);
        ro && ro.disconnect();
        tween && tween.kill();
        textures.forEach(t => t && gl.deleteTexture(t));
        const ext = gl.getExtension('WEBGL_lose_context'); ext && ext.loseContext();
      },
    };
  };
})();
