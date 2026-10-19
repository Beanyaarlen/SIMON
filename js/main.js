/* =========================================================================
   Simon i7 — scroll-driven product story
   PT. Klik Hiro Optima · Switch Design & Smart Home
   ========================================================================= */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { SwitchModel, makeEnvironment, FINISH, LAYOUT, OUTER, PITCH } = window.Switch3D;

  /* ------------------------------------------------------------------ */
  /* Renderer                                                            */
  /* ------------------------------------------------------------------ */
  const canvas = $('#gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { renderer = null; }
  if (!renderer) { canvas.style.display = 'none'; $('#glFallback').hidden = false; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(0, 0, 60);
  const VH = () => 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  let main, root, clones = [];
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(-6, 9, 10);
  const rim = new THREE.DirectionalLight(0xd4ddff, 1.1); rim.position.set(9, 2, -6);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.3);
  // a soft point light that travels with the product → photographic falloff across the face
  const sheen = new THREE.PointLight(0xffffff, 1, 0, 2);
  scene.add(keyLight, rim, hemi, sheen);
  const SNAP = /[?&]snap/.test(location.search);

  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    scene.environment = makeEnvironment(renderer);

    root = new THREE.Group();
    scene.add(root);
    main = new SwitchModel({ full: true, color: FINISH.dgrey.hex });
    root.add(main.group);
    ['white', 'champ', null, 'black', 'mocha'].forEach((k, j) => {
      if (!k) return;
      const c = new SwitchModel({ color: FINISH[k].hex });
      c.setColor(FINISH[k].rgb);
      c.slot = j; c.finish = k;
      c.group.visible = false;
      root.add(c.group);
      clones.push(c);
    });
    main.keys.forEach((k) => { k.on = false; k.level = 0; });
  }

  /* ------------------------------------------------------------------ */
  /* Smooth scroll                                                        */
  /* ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  }
  const scrollTo = (y) => {
    if (lenis) lenis.scrollTo(y, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  };

  /* ------------------------------------------------------------------ */
  /* Section geometry                                                     */
  /* ------------------------------------------------------------------ */
  const SEC = {};
  let vh = innerHeight, vw = innerWidth, mobile = vw < 900;
  function measure() {
    vh = innerHeight; vw = innerWidth; mobile = vw <= 900 || vw / vh <= 0.8;
    $$('[data-sec]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      SEC[el.dataset.sec] = { el, top, h: el.offsetHeight, range: Math.max(1, el.offsetHeight - vh) };
    });
  }
  const anchor = (id, at) => SEC[id].top + at * SEC[id].range;
  const progressOf = (id, y) => (y - SEC[id].top) / SEC[id].range;

  /* ------------------------------------------------------------------ */
  /* Keyframes — the choreography of the switch                          */
  /* ------------------------------------------------------------------ */
  const F = (k) => FINISH[k].rgb.slice();
  const L = (n) => LAYOUT[n].slice();
  const SPACE_STEPS = { g1: 0.14, g2: 0.21, g3: 0.28, g4: 0.35, white: 0.44, champ: 0.51, dgrey: 0.58, black: 0.65, mocha: 0.72, lineup: 0.95 };
  let KF = [], upPoseG = null;
  /* where the CSS layout wants the switch: centre + box, in viewport fractions */
  function slot(id, name, fill) {
    fill = fill == null ? 0.92 : fill;
    const sec = SEC[id].el;
    const el = sec.querySelector('.slot[data-slot="' + (name || id) + '"]');
    if (!el) return { x: 0, y: 0, fw: 0.6, fh: 0.5 };
    const box = el.closest('.stick') || sec;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    const cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
    return { x: (cx / vw) * 2 - 1, y: 1 - (cy / vh) * 2, fw: Math.max(0.05, (r.width / vw) * fill), fh: Math.max(0.05, (r.height / vh) * fill) };
  }

  function buildKeyframes() {
    const M = mobile;
    const m = (d, mo) => (M ? mo : d);
    const list = [];
    let prev = { x: 0, y: 0.12, s: 2, fw: 0.9, fh: 0.74, rx: 0, ry: 0, rz: 0, explode: 0, modules: 1, layout: L(4), col: F('dgrey'), lineup: 0, mouse: 1, op: 1 };
    const K = (id, at, st, opt) => {
      const s = Object.assign({}, prev, st);
      s.layout = (st.layout || prev.layout).slice(); s.col = (st.col || prev.col).slice();
      list.push({ y: anchor(id, at), st: s, ride: !!(opt && opt.ride) }); prev = s;
    };
    // 1 hero
    K('hero', 0, Object.assign(slot('hero'), { s: 1.15, rx: 0, ry: 0, mouse: 1 }));
    // 2 hello push button
    K('hello', 0, Object.assign(slot('hello'), { s: 1.3, rx: -4, ry: m(24, 12), mouse: 0.6 }), { ride: true });
    K('hello', 1, { ry: m(30, 18) });
    // 3 anatomy / exploded
    const an = slot('anatomy');
    K('anatomy', 0, Object.assign({}, an, { s: 1.35, rx: -14, ry: -34, rz: 0, mouse: 0.35 }), { ride: true });
    K('anatomy', 0.1, {});
    K('anatomy', 0.4, { explode: 1, rx: -12, ry: -50, fh: an.fh * m(0.72, 0.9) });
    K('anatomy', 0.5, {});
    K('anatomy', 0.62, { explode: 0, rx: -3, ry: -84, fh: an.fh, y: an.y + m(0.02, 0.13) });
    K('anatomy', 0.72, {});
    K('anatomy', 0.82, { rx: 0, ry: 0, y: an.y });
    K('anatomy', 1, {});
    // 4 complete design language
    K('language', 0, Object.assign(slot('language'), { s: m(1, 0.85), rx: 0, ry: 0, modules: 1, mouse: 0.3 }), { ride: true });
    K('language', 0.1, {});
    K('language', 0.7, { modules: 4 });
    K('language', 0.86, { rx: -6, ry: -10 });
    K('language', 1, {});
    // 5 control photo — model leaves upward
    K('control', 0, { y: 1.75, rx: 20 });
    K('control', 1, { y: 1.75, x: 0, modules: 1, rx: 0, ry: 0 });
    // 6 next revolution
    const rv = slot('revolution', null, 0.8);
    K('revolution', 0, { x: -1.7, y: 1.75, fw: rv.fw, fh: rv.fh, s: 2, rx: 10, ry: 30, rz: -6, modules: 1 });
    K('revolution', 0.3, { y: rv.y });
    K('revolution', 0.6, { x: rv.x });
    K('revolution', 1, { ry: 24 });
    // 7 designed for every space (scroll demo — the buttons override it)
    K('space', 0, Object.assign(slot('space'), { s: 1.35, layout: L(4), col: F('dgrey'), rx: 0, ry: m(16, 0), rz: 0, mouse: 0.5 }));
    K('space', 0.05, {});
    const hold = (at, st) => { K('space', at - 0.015, st); K('space', at + 0.015, {}); };
    hold(SPACE_STEPS.g1, { layout: L(1) });
    hold(SPACE_STEPS.g2, { layout: L(2) });
    hold(SPACE_STEPS.g3, { layout: L(3) });
    hold(SPACE_STEPS.g4, { layout: L(4) });
    hold(SPACE_STEPS.white, { col: F('white') });
    hold(SPACE_STEPS.champ, { col: F('champ') });
    hold(SPACE_STEPS.dgrey, { col: F('dgrey') });
    hold(SPACE_STEPS.black, { col: F('black') });
    hold(SPACE_STEPS.mocha, { col: F('mocha') });
    K('space', 0.86, Object.assign(slot('space', 'lineup', 0.86), { lineup: 1, col: F('dgrey'), s: 2, rx: m(-8, -4), ry: m(-18, -8), mouse: 0.4 }));
    K('space', 1, {});
    // 8 gallery — the lineup flies away
    const up = slot('upgrade');
    upPoseG = { x: up.x, y: up.y, fw: up.fw * m(0.5, 0.9), fh: up.fh * m(0.8, 0.5), s: 2, lineup: 0, modules: 1, rx: 0, ry: 0, rz: 0, mouse: 0.5 };
    const upPose = upPoseG;
    K('gallery', 0, { y: 1.9 });
    K('gallery', 0.15, { y: 1.9, op: 0 });
    K('gallery', 0.3, Object.assign({}, upPose, { op: 0 }));
    K('gallery', 1, Object.assign({}, upPose, { op: 1 }));
    // 9 upgrade anytime (leave room for the chips around the switch)
    K('upgrade', 0, Object.assign({}, upPose, { op: 1 }));
    K('upgrade', 0.3, {});
    K('upgrade', 0.45, { ry: -12, rx: 4 });
    K('upgrade', 0.7, { ry: 10, rx: -4 });
    K('upgrade', 0.86, { ry: 0, rx: 0 });
    K('upgrade', 1, {});
    // 10 lineup — the switch steps aside for the Simon family
    K('lineup', 0, { op: 0, y: up.y + 0.35, s: 1.7 });
    KF = list.sort((a, b) => a.y - b.y);
  }

  function sampleKF(y, out) {
    if (!KF.length) return out;
    let a = KF[0], b = KF[0], t = 0;
    if (y <= KF[0].y) { a = b = KF[0]; }
    else if (y >= KF[KF.length - 1].y) { a = b = KF[KF.length - 1]; }
    else {
      for (let i = 0; i < KF.length - 1; i++) {
        if (y >= KF[i].y && y < KF[i + 1].y) { a = KF[i]; b = KF[i + 1]; t = (y - a.y) / Math.max(1, b.y - a.y); break; }
      }
    }
    const u = t;
    t = easeIO(t);
    for (const k in a.st) {
      const va = a.st[k], vb = b.st[k];
      if (Array.isArray(va)) { out[k] = out[k] || []; for (let i = 0; i < va.length; i++) out[k][i] = lerp(va[i], vb[i], t); }
      else out[k] = lerp(va, vb, t);
    }
    // "ride": approach the next pose together with its section as it scrolls in
    if (b.ride && a !== b) out.y -= (2 * (1 - u) * (b.y - a.y) / vh) * t;
    return out;
  }
  function damp(cur, tgt, f) {
    for (const k in tgt) {
      if (Array.isArray(tgt[k])) { cur[k] = cur[k] || tgt[k].slice(); for (let i = 0; i < tgt[k].length; i++) cur[k][i] += (tgt[k][i] - cur[k][i]) * f; }
      else cur[k] = cur[k] == null ? tgt[k] : cur[k] + (tgt[k] - cur[k]) * f;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Projected HTML labels                                                */
  /* ------------------------------------------------------------------ */
  const v3 = new THREE.Vector3();
  const toScreen = (v) => { v.project(camera); return [(v.x + 1) * 0.5 * vw, (1 - v.y) * 0.5 * vh]; };

  const partLabels = [];
  const modLabels = [], modPlus = [], colorLabels = [];
  function buildLabels() {
    if (!main) return;
    const pl = $('#partLabels');
    main.layers.forEach((L, i) => {
      const el = document.createElement('div'); el.className = 'plabel' + (i % 2 ? ' down' : ' up');
      el.style.setProperty('--len', (mobile ? 18 : 34) + (i % 3) * (mobile ? 10 : 22) + 'px');
      el.innerHTML = `<span class="dot"></span><span class="ln"></span><span class="tx"><small>0${i + 1}</small>${L.label}</span>`;
      pl.appendChild(el); partLabels.push(el);
    });
    const ml = $('#modLabels');
    ['Switch', 'Dimmer Swipe', 'Curtain Control', 'AC Control'].forEach((t, i) => {
      const el = document.createElement('div'); el.className = 'mlabel'; el.textContent = t; ml.appendChild(el); modLabels.push(el);
      if (i) { const p = document.createElement('div'); p.className = 'mplus'; p.textContent = '+'; ml.appendChild(p); modPlus.push(p); }
    });
    const cl = $('#colorLabels');
    ['white', 'champ', 'dgrey', 'black', 'mocha'].forEach((k) => {
      const el = document.createElement('div'); el.className = 'clabel'; el.style.setProperty('--c', FINISH[k].hex);
      el.innerHTML = `<b>${FINISH[k].name}</b><i></i>`; cl.appendChild(el); colorLabels.push(el);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Interaction: press the keys                                          */
  /* ------------------------------------------------------------------ */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-9, -9);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let hoverKey = -1, lastUserPress = -1e9;
  let actx = null;
  function clickSound() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const buf = actx.createBuffer(1, actx.sampleRate * 0.03, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
      const src = actx.createBufferSource(); src.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 1.4;
      const g = actx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(f).connect(g).connect(actx.destination); src.start(t);
    } catch (e) { /* audio optional */ }
  }
  addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1);
    mouse.x = ndc.x; mouse.y = ndc.y;
  }, { passive: true });
  addEventListener('pointerleave', () => ndc.set(-9, -9));
  addEventListener('click', (e) => {
    if (!main || hoverKey < 0) return;
    if (e.target.closest('a, button, .card, .nav')) return;
    main.press(hoverKey); clickSound(); lastUserPress = performance.now();
  });
  function updateHover(st) {
    hoverKey = -1;
    if (!main || ndc.x < -2 || st.explode > 0.05 || st.lineup > 0.05) { document.documentElement.style.cursor = ''; return; }
    ray.setFromCamera(ndc, camera);
    const meshes = main.keys.filter((k) => k.vis > 0.5).map((k) => k.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) hoverKey = hit.object.userData.keyIndex;
    document.documentElement.style.cursor = hoverKey >= 0 ? 'pointer' : '';
  }

  /* ------------------------------------------------------------------ */
  /* DOM-side scroll effects                                              */
  /* ------------------------------------------------------------------ */
  const navLinks = $$('.nav-links a');
  const progressBar = $('.progress span');
  const spaceSteps = Object.entries(SPACE_STEPS).filter(([k]) => k !== 'lineup');
  const ring = $('#ring');
  (function ticks() {
    const g = $('.ring-clock .ticks'); let s = '';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r1 = i % 5 ? 84 : 80, r2 = 88;
      s += `<line x1="${Math.cos(a) * r1}" y1="${Math.sin(a) * r1}" x2="${Math.cos(a) * r2}" y2="${Math.sin(a) * r2}"/>`;
    }
    g.innerHTML = s;
  })();

  function domUpdate(y) {
    const docH = document.documentElement.scrollHeight - vh;
    progressBar.style.transform = `scaleX(${clamp(y / docH, 0, 1)})`;

    // step-in reveals inside pinned sections (reversible)
    $$('.pin').forEach((sec) => {
      const id = sec.dataset.sec; if (!SEC[id]) return;
      const p = progressOf(id, y);
      sec._p = p;
      $$('.step-in', sec).forEach((el) => el.classList.toggle('on', p >= parseFloat(el.dataset.in || 0) - 0.001 && p < 1.25));
      $$('[data-steps]', sec).forEach((wrap) => {
        const th = wrap.dataset.steps.split(',').map(Number);
        let idx = 0; th.forEach((v, i) => { if (p >= v) idx = i; });
        $$('.step', wrap).forEach((s, i) => { s.classList.toggle('on', i === idx); s.classList.toggle('past', i < idx); });
        $$('.step-dots i', sec).forEach((d, i) => d.classList.toggle('on', i === idx));
        sec._step = idx;
      });
    });
    SEC.anatomy.el.classList.toggle('s1', SEC.anatomy.el._step === 1);
    SEC.anatomy.el.classList.toggle('s0', SEC.anatomy.el._step === 0 && SEC.anatomy.el._p > 0.25);

    // configurator state (scroll demo until the visitor picks something)
    const sp = SEC.space.el, p = sp._p;
    let gang = 4, finish = 'dgrey';
    spaceSteps.forEach(([k, v]) => {
      if (p >= v - 0.035) { if (k[0] === 'g') gang = +k[1]; else finish = k; }
    });
    if (p < SPACE_STEPS.g1 - 0.035) gang = 4;
    if (p < SPACE_STEPS.white - 0.035) finish = 'dgrey';
    if (manual.gang) gang = manual.gang;
    if (manual.color) finish = manual.color;
    shownGang = gang; shownFinish = finish;
    $$('.chip-btn', sp).forEach((b) => { const on = +b.dataset.gang === gang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $$('.sw', sp).forEach((b) => { const on = b.dataset.color === finish; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('.cfg-name', sp).textContent = FINISH[finish].name;
    sp.style.setProperty('--tint', FINISH[finish].hex);
    sp.classList.toggle('finale', p > 0.8);
    SEC.upgrade.el.classList.toggle('final', SEC.upgrade.el._p > 0.86);

    // lineup horizontal track
    const lu = SEC.lineup.el, track = $('.track', lu);
    const lp = clamp((lu._p - 0.04) / 0.92, 0, 1);
    const max = Math.max(0, track.scrollWidth - vw);
    track.style.transform = `translate3d(${-lp * max}px,0,0)`;
    $('.lu-progress span', lu).style.transform = `scaleX(${lp})`;
    if (window.__luSync && lu._p > -0.2 && lu._p < 1.2) window.__luSync();

    // photo parallax
    const ctl = SEC.control;
    const cp = clamp((y - ctl.top + vh) / (ctl.h + vh), 0, 1);
    $('.pb-media img', ctl.el).style.transform = `translate3d(0,${(cp - 0.5) * -8}%,0) scale(${1.18 - cp * 0.14})`;
    $$('.gal-grid img').forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const q = (r.top + r.height / 2 - vh / 2) / vh;
      img.style.transform = `translate3d(0,${q * -9}%,0) scale(1.14)`;
    });

    // nav highlight
    let cur = null;
    navLinks.forEach((a) => {
      const id = a.getAttribute('href').slice(1); const s = SEC[id];
      if (s && y >= s.top - vh * 0.4) cur = a;
    });
    navLinks.forEach((a) => a.classList.toggle('active', a === cur));
  }

  /* reveal for normal sections */
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: 0.18 });
  $$('.reveal').forEach((el) => io.observe(el));

  /* anchors */
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1); const s = SEC[id]; if (!s) return;
    e.preventDefault(); $('.nav').classList.remove('open'); $('.nav-toggle').setAttribute('aria-expanded', 'false');
    let y = s.top;
    if (id === 'anatomy' || id === 'space' || id === 'upgrade' || id === 'language') y = anchor(id, 0.02);
    scrollTo(y);
  }));
  $('.nav-toggle').addEventListener('click', () => {
    const n = $('.nav'); const o = n.classList.toggle('open'); $('.nav-toggle').setAttribute('aria-expanded', o ? 'true' : 'false');
  });

  /* ------------------------------------------------------------------ */
  /* Lineup: swipe / drag / horizontal wheel / arrows move the track       */
  /* (the track is driven by vertical scroll, so sideways input is turned  */
  /*  into the matching page scroll)                                       */
  /* ------------------------------------------------------------------ */
  (function lineupSideways() {
    const lu = $('#lineup'), stick = lu && $('.stick', lu), track = lu && $('.track', lu);
    if (!stick || !track) return;
    const geo = () => {
      const S = SEC.lineup, max = Math.max(1, track.scrollWidth - vw);
      return { S, max, k: (0.92 * S.range) / max, y0: S.top + 0.04 * S.range, y1: S.top + 0.96 * S.range };
    };
    const curY = () => (lenis ? lenis.targetScroll : window.scrollY);
    const jump = (yy, smoothDur) => {
      const g = geo(); yy = clamp(yy, g.S.top, g.S.top + g.S.range);
      if (lenis) lenis.scrollTo(yy, smoothDur ? { duration: smoothDur, easing: (t) => 1 - Math.pow(1 - t, 3) } : { immediate: true });
      else window.scrollTo({ top: yy, behavior: smoothDur ? 'smooth' : 'auto' });
    };
    // trackpad / mouse horizontal wheel
    stick.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 1) return;
      e.preventDefault();
      jump(curY() + e.deltaX * geo().k);
    }, { passive: false });
    // touch + mouse drag
    let down = null, dragged = false;
    stick.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.lu-nav')) return;
      down = { x: e.clientX, y: e.clientY, sy: curY(), axis: null, lx: e.clientX, lt: performance.now(), v: 0, id: e.pointerId };
      dragged = false;
    });
    stick.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.axis) {
        if (Math.hypot(dx, dy) < 8) return;
        down.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (down.axis === 'x') { try { stick.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } lu.classList.add('dragging'); }
      }
      if (down.axis !== 'x') { if (e.pointerType === 'mouse') down = null; return; }
      dragged = true;
      const now = performance.now(), ddt = Math.max(1, now - down.lt);
      down.v = 0.8 * down.v + 0.2 * ((e.clientX - down.lx) / ddt); down.lx = e.clientX; down.lt = now;
      jump(down.sy - dx * geo().k);
    });
    const up = (e) => {
      if (!down) return;
      if (down.axis === 'x') {
        const fling = clamp(down.v, -3, 3) * 260; // px of track travel
        if (Math.abs(fling) > 20) jump(curY() - fling * geo().k, 0.9);
      }
      down = null; lu.classList.remove('dragging');
    };
    stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
    // links and images must not start a native drag (it cancels the swipe)
    track.addEventListener('dragstart', (e) => e.preventDefault());
    $$('a, img', track).forEach((el) => el.setAttribute('draggable', 'false'));
    // a drag must not open the card underneath
    track.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
    // arrows: one card at a time
    const btns = $$('[data-lu]', lu);
    btns.forEach((b) => b.addEventListener('click', () => {
      const g = geo(), first = track.children[1] || track.children[0];
      const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 28);
      const p = clamp((curY() - g.y0) / (g.y1 - g.y0), 0, 1);
      const off = clamp(p * g.max + (+b.dataset.lu) * step, 0, g.max);
      jump(g.y0 + (off / g.max) * (g.y1 - g.y0), 0.8);
    }));
    lineupSideways.sync = () => {
      const g = geo(), p = (window.scrollY - g.y0) / (g.y1 - g.y0);
      if (btns[0]) btns[0].disabled = p <= 0.005; if (btns[1]) btns[1].disabled = p >= 0.995;
    };
    window.__luSync = lineupSideways.sync;
  })();

  /* ------------------------------------------------------------------ */
  /* Configurator: any finish × any configuration                         */
  /* ------------------------------------------------------------------ */
  const manual = { gang: null, color: null };
  let shownGang = 4, shownFinish = 'dgrey';
  $$('[data-gang]').forEach((b) => b.addEventListener('click', () => {
    manual.gang = +b.dataset.gang; if (!manual.color) manual.color = shownFinish; clickSound();
  }));
  $$('[data-color]').forEach((b) => b.addEventListener('click', () => {
    manual.color = b.dataset.color; if (!manual.gang) manual.gang = shownGang; clickSound();
  }));

  /* ------------------------------------------------------------------ */
  /* Main loop                                                            */
  /* ------------------------------------------------------------------ */
  const target = {}, state = {};
  let intro = 0, last = performance.now(), demoT = 0, demoIdx = 0, prevPose = null, blurS = 0;
  const tmpA = new THREE.Vector3();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (lenis) lenis.raf(now);
    const y = window.scrollY;
    domUpdate(y);
    if (!renderer) return;

    sampleKF(y, target);
    const spP = SEC.space.el._p;
    if (manual.gang && spP > -0.02 && spP < 1.3) target.layout = LAYOUT[manual.gang].slice();
    if (manual.color && spP > -0.02 && spP < 0.8) target.col = FINISH[manual.color].rgb.slice();
    if (state.x == null) damp(state, target, 1);
    damp(state, target, SNAP ? 1 : 1 - Math.exp(-dt * (reduced ? 30 : 6.5)));
    // lift the switch out of the "Start simple" photo on its way to Upgrade Anytime
    let st = state, lockA = 0, opF = state.op == null ? 1 : state.op;
    const em = emergence(y);
    if (em) {
      st = Object.assign({}, state);
      ['x', 'y', 'fw', 'fh', 's', 'rx', 'ry', 'rz'].forEach((kk) => (st[kk] = lerp(em.slot[kk], em.pose[kk], em.a)));
      st.lineup = state.lineup * (1 - em.a); st.explode = state.explode * (1 - em.a); st.modules = lerp(state.modules, 1, em.a);
      st.mouse = state.mouse * (1 - em.a);
      opF = em.vis; lockA = em.a;
    }
    const t = now / 1000;

    // world size + fitting
    const Hv = VH(), Wv = Hv * camera.aspect;
    const base = Math.min(0.4 * Hv, 0.62 * Wv) / OUTER;
    let k = base * st.s * (0.82 + 0.18 * smooth(intro));
    const lineupW = mobile ? 10.4 : 4 * PITCH * 1.32;
    const lineupH = mobile ? 21.6 : 0;
    const modelW = OUTER + (clamp(st.modules, 1, 4) - 1) * PITCH + lineupW * st.lineup + st.explode * 13;
    const modelH = OUTER + lineupH * st.lineup + st.explode * 6;
    k = Math.min(k, (st.fw * Wv) / modelW, (st.fh * Hv) / modelH);
    root.scale.setScalar(k);

    // idle motion + pointer parallax
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 3);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 3);
    const idle = reduced ? 0 : 1;
    const mi = (st.mouse || 0) * (vw > 900 ? 1 : 0.3);
    root.position.set(st.x * Wv / 2, st.y * Hv / 2 + Math.sin(t * 0.9) * 0.12 * idle * k, 0);
    const D = THREE.MathUtils.degToRad;
    root.rotation.set(
      D(st.rx) - mouse.sy * 0.08 * mi + Math.sin(t * 0.6) * 0.012 * idle + (1 - smooth(intro)) * 0.5,
      D(st.ry) + mouse.sx * 0.12 * mi + Math.sin(t * 0.45) * 0.018 * idle,
      D(st.rz)
    );
    // motion blur + a slight fade while the switch travels between sections
    const sPx = (OUTER * k / Wv) * vw, pX = st.x * vw / 2, pY = st.y * vh / 2;
    let blurT = 0;
    if (!SNAP && !reduced && prevPose && intro >= 1) {
      const sp = Math.hypot(pX - prevPose[0], pY - prevPose[1], (sPx - prevPose[2]) * 0.6) / Math.max(dt, 1 / 120);
      blurT = clamp((sp - 300) / 140, 0, 7) * (1 - lockA);
    }
    prevPose = [pX, pY, sPx];
    blurS += (blurT - blurS) * Math.min(1, dt * 10);
    const opOut = clamp(opF, 0, 1) * (1 - 0.3 * clamp(blurS / 7, 0, 1));
    canvas.style.opacity = opOut.toFixed(3);
    canvas.style.filter = blurS > 0.25 ? `blur(${blurS.toFixed(2)}px)` : 'none';
    keyLight.position.x = -6 + Math.sin(t * 0.25) * 4 * idle;
    const R = OUTER * k;
    sheen.position.set(root.position.x - R * (0.9 - Math.sin(t * 0.3) * 0.25 * idle), root.position.y + R * 0.95, R * 1.15);
    sheen.intensity = R * R * 3.6;

    // auto demo presses when a section invites it and the user is idle
    const anaP = SEC.anatomy.el._p, upP = SEC.upgrade.el._p;
    const demoOn = (anaP > 0.8 && anaP < 1.05) || (upP > 0.02 && upP < 0.32);
    if (demoOn && now - lastUserPress > 4000) {
      demoT += dt;
      if (demoT > 0.9) { demoT = 0; main.press(demoIdx % 4); demoIdx++; }
    } else if (!demoOn && intro >= 1) {
      // keep all LEDs lit outside demo zones (the catalog look)
      if (now - lastUserPress > 6000) main.keys.forEach((kk) => { if (!kk.on) kk.on = true; });
    }

    main.update({ col: st.col, layout: st.layout, modules: st.modules, explode: st.explode, led: 1 }, dt, t);

    // lineup clones
    clones.forEach((c, i) => {
      const e = smooth(clamp(st.lineup * 1.1 - i * 0.025, 0, 1));
      c.group.visible = e > 0.01;
      if (!c.group.visible) return;
      const [ox, oy] = lineupOffset(c.slot - 2);
      c.group.position.set(ox * e, oy * e + Math.sin(t * 0.8 + i * 1.7) * 0.18 * e, -1.2 * (1 - e));
      c.group.rotation.set(0, Math.sin(t * 0.5 + i) * 0.06 * e, 0);
      const s = 0.35 + 0.65 * e; c.group.scale.setScalar(s);
      c.update({ layout: st.layout }, dt, t);
    });
    const [mx0, my0] = lineupOffset(0);
    main.group.position.set(mx0 * st.lineup, my0 * st.lineup + (st.lineup > 0.01 ? Math.sin(t * 0.8 + 3) * 0.18 * st.lineup : 0), 0);

    root.updateMatrixWorld(true);
    if (opOut > 0.4) updateHover(st); else { hoverKey = -1; document.documentElement.style.cursor = ''; }
    updateLabels(st);
    if (opOut > 0.004) renderer.render(scene, camera);
  }

  /* where the switch sits inside the "Start simple" photo (concrete-wall.jpg) */
  const galPh = $('.g4 .ph'), galImg = $('.g4 img');
  const PHOTO_SW = { u: 0.495, v: 0.538, w: 0.29 };
  function emergence(y) {
    if (!galPh || !galImg || !SEC.gallery || !SEC.upgrade) return null;
    const yStart = anchor('gallery', 0.15), yEnd = SEC.upgrade.top;
    if (y < yStart || y >= yEnd) return null;
    const pr = galPh.getBoundingClientRect();
    if (!pr.height) return null;
    const cAbs = pr.top + y + pr.height * PHOTO_SW.v;
    let yE = cAbs - 0.62 * vh, fEnd = yE + 0.16 * vh, lEnd = fEnd + 0.06 * vh;
    if (yEnd - lEnd < 0.32 * vh) { const sh = 0.32 * vh - (yEnd - lEnd); yE -= sh; fEnd -= sh; lEnd -= sh; }
    const vis = clamp((y - yE) / (fEnd - yE), 0, 1);
    const a = y < lEnd ? 1 : 1 - easeIO(clamp((y - lEnd) / (yEnd - lEnd), 0, 1));
    const r = galImg.getBoundingClientRect();
    const cx = r.left + PHOTO_SW.u * r.width, cy = r.top + PHOTO_SW.v * r.height, w = PHOTO_SW.w * r.width;
    const U = upPoseG || { x: 0, y: 0, fw: 0.5, fh: 0.4, s: 2 };
    const slotNow = { x: U.x, y: U.y - (2 * (yEnd - y)) / vh, fw: U.fw, fh: U.fh, s: U.s, rx: 0, ry: 0, rz: 0 };
    return { a, vis, slot: slotNow, pose: { x: (cx / vw) * 2 - 1, y: 1 - (cy / vh) * 2, fw: w / vw, fh: 1, s: 8, rx: 0, ry: 12, rz: 0 } };
  }

  function lineupOffset(j) {
    if (!mobile) return [j * PITCH * 1.32, 0];
    return [(Math.abs(j) % 2 ? 5.2 : -5.2) + 1.04, -j * 5.4];
  }

  /* arrow from the TikTok photo to the live 3D push-button switch */
  const arrowSvg = $('#helloArrow'), arrowShaft = $('#helloArrow .shaft'), arrowHead = $('#helloArrow .head');
  const ttImg = $('.tiktok img');
  const corner = new THREE.Vector3();
  function updateArrow() {
    const hp = SEC.hello.el._p;
    const draw = clamp((hp - 0.12) / 0.3, 0, 1) * (hp < 1.15 ? 1 : 0);
    if (draw <= 0.001) { arrowSvg.style.opacity = 0; return; }
    // switch bounding box on screen
    let l = 1e9, r = -1e9, tp = 1e9, bt = -1e9;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      corner.set(sx * OUTER / 2, sy * OUTER / 2, 0); main.group.localToWorld(corner);
      const [x, y] = toScreen(corner); l = Math.min(l, x); r = Math.max(r, x); tp = Math.min(tp, y); bt = Math.max(bt, y);
    });
    const ti = ttImg.getBoundingClientRect();
    const mcx = (l + r) / 2, mcy = (tp + bt) / 2;
    // start: TikTok edge facing the switch; end: switch edge facing the TikTok
    let sx, sy, ex, ey;
    if (ti.left > r) { sx = ti.left - 10; sy = ti.top + ti.height * 0.55; ex = r + 18; ey = clamp(sy + (bt - sy) * 0.35, tp + 30, bt - 20); }
    else { sx = ti.left - 8; sy = ti.top + ti.height * 0.6; ex = clamp(sx - 40, l + 30, r - 30); ey = tp - 18; }
    const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, bulge = Math.min(140, len * 0.32) * (ti.left > r ? -1 : 1);
    const cx = (sx + ex) / 2 + nx * bulge, cy = (sy + ey) / 2 + ny * bulge;
    arrowShaft.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`);
    const total = arrowShaft.getTotalLength();
    arrowShaft.style.strokeDasharray = total; arrowShaft.style.strokeDashoffset = total * (1 - draw);
    const ax = ex - cx, ay = ey - cy, al = Math.hypot(ax, ay) || 1, ux = ax / al, uy = ay / al, hs = 16;
    const rot = (a) => [ux * Math.cos(a) - uy * Math.sin(a), ux * Math.sin(a) + uy * Math.cos(a)];
    const [h1x, h1y] = rot(Math.PI * 0.82), [h2x, h2y] = rot(-Math.PI * 0.82);
    arrowHead.setAttribute('d', `M${ex + h1x * hs},${ey + h1y * hs} L${ex},${ey} L${ex + h2x * hs},${ey + h2y * hs}`);
    arrowHead.style.opacity = draw > 0.96 ? 1 : 0;
    arrowSvg.style.opacity = Math.min(1, draw * 3);
  }

  function updateLabels(st) {
    updateArrow();
    // exploded parts
    const ex = st.explode, inAna = SEC.anatomy.el._p > -0.2 && SEC.anatomy.el._p < 1.2;
    const op = inAna && !mobile ? clamp((ex - 0.7) / 0.25, 0, 1) : 0;
    partLabels.forEach((el, i) => {
      if (op <= 0.001) { el.style.opacity = 0; return; }
      main.layerAnchor(i, v3);
      const [sx, sy] = toScreen(v3);
      el.style.opacity = op;
      el.style.transform = `translate3d(${sx}px,${sy}px,0) translate(-50%,${i % 2 ? '-3.5px' : 'calc(-100% + 3.5px)'})`;
    });
    // module labels
    const lp = SEC.language.el._p, inLang = lp > -0.25 && lp < 1.15;
    let prevX = 0;
    modLabels.forEach((el, i) => {
      const r = i === 0 ? clamp((st.modules - 1) / 0.35, 0, 1) : (main.mods[i - 1].reveal || 0);
      const o = inLang ? r : 0;
      el.style.opacity = o;
      if (o <= 0.001) return;
      main.moduleAnchor(i, v3);
      const [sx, sy] = toScreen(v3);
      el.style.transform = `translate3d(${sx}px,${sy + 14}px,0) translateX(-50%)`;
      if (i > 0) {
        const pl = modPlus[i - 1];
        pl.style.opacity = o;
        pl.style.transform = `translate3d(${(sx + prevX) / 2}px,${sy + 22}px,0) translate(-50%,-50%)`;
      }
      prevX = sx;
    });
    if (!inLang) modPlus.forEach((p) => (p.style.opacity = 0));
    // finish labels in the lineup
    const co = SEC.space.el._p > 0.8 && SEC.space.el._p < 1.1 ? clamp((st.lineup - 0.85) / 0.15, 0, 1) : 0;
    const order = ['white', 'champ', 'dgrey', 'black', 'mocha'];
    colorLabels.forEach((el, i) => {
      el.style.opacity = co; if (co <= 0.001) return;
      const obj = order[i] === 'dgrey' ? main.group : clones.find((c) => c.finish === order[i]).group;
      v3.set(0, -OUTER / 2 - 0.6, 0); obj.localToWorld(v3);
      const [sx, sy] = toScreen(v3);
      el.style.transform = `translate3d(${sx}px,${sy + 8}px,0) translateX(-50%)`;
    });
    // upgrade ring
    const up = SEC.upgrade.el._p, inUp = up > -0.05 && up < 0.98;
    ring.classList.toggle('on', inUp);
    const stp = SEC.upgrade.el._step || 0;
    ring.classList.toggle('t2', inUp && stp >= 1);
    ring.classList.toggle('t3', inUp && stp >= 2);
    if (inUp) {
      v3.set(0, 0, 0); root.localToWorld(v3); const [cx, cy] = toScreen(v3);
      tmpA.set(OUTER / 2, 0, 0); root.localToWorld(tmpA); const [ex2] = toScreen(tmpA);
      const r = Math.abs(ex2 - cx);
      ring.style.setProperty('--x', cx + 'px'); ring.style.setProperty('--y', cy + 'px'); ring.style.setProperty('--r', r * 1.05 + 'px');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                 */
  /* ------------------------------------------------------------------ */
  function resize() {
    vw = innerWidth; vh = innerHeight;
    if (renderer) {
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh; camera.updateProjectionMatrix();
    }
    measure(); buildKeyframes();
  }
  let rT, lastW = innerWidth, lastH = innerHeight;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const w = innerWidth, h = innerHeight;
      if (coarse && w === lastW && Math.abs(h - lastH) < 160) {
        // mobile address bar moved: just resize the canvas
        if (renderer) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
        vh = h; return;
      }
      lastW = w; lastH = h; resize();
    }, 120);
  });

  measure(); buildKeyframes(); buildLabels();
  requestAnimationFrame((n) => { last = n; frame(n); });

  // loader: wait for fonts + key images
  const bar = $('.loader-bar span'), pct = $('.loader-pct');
  const imgs = $$('img').filter((i) => i.loading !== 'lazy');
  let done = 0; const total = imgs.length + 1;
  const tick = () => { done++; const v = done / total; bar.style.transform = `scaleX(${v})`; pct.textContent = Math.round(v * 100) + '%'; };
  const waits = imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); })).then(tick));
  waits.push((document.fonts ? document.fonts.ready : Promise.resolve()).then(tick));
  const timeout = new Promise((r) => setTimeout(r, 6000));
  Promise.race([Promise.all(waits), timeout]).then(() => {
    resize();
    if (main) main.mods.forEach((m) => { if (m.kind === 'thermo') { m.temp = null; } });
    setTimeout(() => {
      $('#loader').classList.add('done');
      document.body.classList.add('ready');
      const o = { v: 0 };
      if (window.gsap) gsap.to(o, { v: 1, duration: reduced ? 0.01 : 2.2, ease: 'power3.out', onUpdate: () => (intro = o.v) });
      else intro = 1;
      if (main) main.keys.forEach((kk, i) => setTimeout(() => { kk.on = true; }, (reduced ? 0 : 900) + i * 220));
    }, 350);
  });
})();
