/* =========================================================================
   Simon product pages — interactive feature tour, configurator, range
   PT. Klik Hiro Optima · Switch Design & Smart Home
   ========================================================================= */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SNAP = /[?&]snap/.test(location.search);
  const D = JSON.parse($('#series-data').textContent);
  const { SwitchModel, makeEnvironment, FINISH, LAYOUT, OUTER, PITCH } = window.Switch3D;
  const { M7Model, M3Model, P } = window.Series3D;
  const hexRGB = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

  /* ---------------- renderer ---------------- */
  const canvas = $('#gl');
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  if (!renderer) { canvas.style.display = 'none'; document.body.classList.add('no-webgl'); }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(0, 0, 60);
  const VH = () => 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2); keyLight.position.set(-6, 9, 10);
  const rim = new THREE.DirectionalLight(0xd4ddff, 1.1); rim.position.set(9, 2, -6);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.3);
  const sheen = new THREE.PointLight(0xffffff, 1, 0, 2);
  scene.add(keyLight, rim, hemi, sheen);
  const root = new THREE.Group(); scene.add(root);
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    scene.environment = makeEnvironment(renderer);
  }

  /* ---------------- model adapters ---------------- */
  const sel = { gang: D.defaults.gang, finish: D.defaults.finish, material: D.defaults.material || null };
  const finishList = () => (D.series === 'm7' ? D.materials[sel.material].finishes : D.finishes);
  const finishHex = (i, list) => (list || finishList())[i].hex;
  const v3 = new THREE.Vector3();
  let A; // adapter

  if (D.series === 'i7') {
    const m = new SwitchModel({ full: true, color: FINISH.dgrey.hex });
    root.add(m.group);
    m.keys.forEach((k) => { k.on = false; k.level = 0; });
    A = {
      model: m, extras: [],
      update(st, dt, t) {
        const ex = clamp((st.explode - 0.35) / 0.65, 0, 1);
        const mods = 1 + (st.modules - 1) * clamp(1 - st.explode * 2.2, 0, 1);
        m.update({ col: st.col, layout: st.layout, modules: mods, explode: ex, led: 1 }, dt, t);
      },
      press(i) { m.press(i); },
      pressables() { return m.keys.filter((k) => k.vis > 0.5).map((k) => k.mesh); },
      keys() { return m.keys; },
      footprint(st) { return [OUTER + (clamp(st.modules, 1, 4) - 1) * PITCH + st.explode * 13, OUTER + st.explode * 6]; },
      anchor(name, out) {
        const k0 = m.keys[0];
        if (name === 'led') { k0.led.disc.updateWorldMatrix(true, false); return k0.led.disc.localToWorld(out.set(0, 0, 0.02)); }
        if (name === 'key') { k0.g.updateWorldMatrix(true, false); return k0.g.localToWorld(out.set(0, 0.5, 0.05)); }
        if (name === 'module') { const md = m.mods[2]; md.g.updateWorldMatrix(true, false); return md.g.localToWorld(out.set(0, 0, 0.1)); }
        if (name === 'mid') { m.keysWrap.updateWorldMatrix(true, false); return m.keysWrap.localToWorld(out.set(0, 0, 0.1)); }
        const span = (m.frameN - 1) * PITCH, hw = (OUTER + span) / 2;
        m.frameWrap.updateWorldMatrix(true, false);
        if (name === 'frame') return m.frameWrap.localToWorld(out.set(hw - 0.17, 0, 0.02));
        if (name === 'corner') return m.frameWrap.localToWorld(out.set(hw - 0.17, -OUTER / 2 + 0.17, 0.02));
        return m.frameWrap.localToWorld(out.set(0, -OUTER / 2, 0));
      },
      plate() { return { obj: m.frameWrap, half: OUTER / 2 }; },
    };
    A.setLeds = (on) => m.keys.forEach((k) => (k.on = on));
  } else if (D.series === 'm7') {
    const m = new M7Model({ material: sel.material, gang: sel.gang, color: finishHex(sel.finish) });
    root.add(m.group);
    // the three materials side by side (catalog: Air · Metal · Gem)
    const trio = [['air', 0], ['gem', 2]].map(([mat, fi]) => {
      const c = new M7Model({ material: mat, gang: 1, color: D.materials[mat].finishes[fi].hex });
      c.group.visible = false; root.add(c.group); return c;
    });
    A = {
      model: m, extras: trio,
      update(st, dt, t) {
        m.update({ col: st.col, gang: sel.gang, material: st.material, indicator: 1 }, dt);
        trio.forEach((c, i) => {
          const e = st.trio; c.group.visible = e > 0.01;
          c.group.position.set((i ? 1 : -1) * 11 * e, Math.sin(t * 0.8 + i * 2) * 0.15 * e, -1.5 * (1 - e));
          c.group.rotation.y = (i ? -1 : 1) * 0.12 * e;
          c.update({ gang: 1 }, dt);
        });
        m.group.position.y = Math.sin(t * 0.8 + 1) * 0.15 * st.trio;
      },
      press(i) { m.press(i); },
      pressables() { return m.pressables; },
      keys() { return m.keys; },
      footprint(st) { return [P + st.trio * 22, P]; },
      anchor(name, out) { return m.anchor(name, out); },
      plate() { return { obj: m.panel, half: P / 2 }; },
    };
    A.setLeds = (on) => m.keys.forEach((k) => (k.on = on));
  } else {
    const m = new M3Model(Object.assign({ gang: sel.gang }, D.model || {}));
    root.add(m.group);
    A = {
      model: m, extras: [],
      update(st, dt) { m.update({ col: st.col, gang: sel.gang, explode: st.explode, glow: st.glow, lift: st.lift }, dt); },
      press(i) { m.press(i); },
      pressables() { return m.pressables; },
      keys() { return m.rockers; },
      footprint(st) { return m.footprint(st); },
      anchor(name, out) { return m.anchor(name, out); },
      plate() { return { obj: m.panel, half: P / 2 }; },
    };
    A.setLeds = (on) => m.rockers.forEach((r) => (r.on = on));
  }

  /* ---------------- layout / sections ---------------- */
  let vw = innerWidth, vh = innerHeight, mobile = false;
  const SEC = {};
  function measure() {
    vw = innerWidth; vh = innerHeight; mobile = vw <= 900 || vw / vh <= 0.8;
    $$('[data-mode]').forEach((el) => {
      const r = el.getBoundingClientRect();
      SEC[el.id] = { el, top: r.top + scrollY, h: el.offsetHeight, range: Math.max(1, el.offsetHeight - vh), mode: el.dataset.mode };
    });
  }
  function slot(name, fill) {
    fill = fill == null ? 0.9 : fill;
    const el = $(`.slot[data-slot="${name}"]`); if (!el) return { x: 0, y: 0, fw: 0.6, fh: 0.5 };
    const box = el.closest('.stick') || el.closest('[data-mode]');
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    const cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
    return { x: (cx / vw) * 2 - 1, y: 1 - (cy / vh) * 2, fw: Math.max(0.05, (r.width / vw) * fill), fh: Math.max(0.05, (r.height / vh) * fill) };
  }
  let SLOTS = {};
  function measureSlots() { SLOTS = { hero: slot('hero'), explore: slot('explore'), config: slot('config') }; }

  /* ---------------- state ---------------- */
  const N = D.features.length;
  const BASE = { rx: 0, ry: 0, rz: 0, zoom: 1, focus: 0, explode: 0, modules: 1, glow: 0, trio: 0, lift: 0, s: 1.25 };
  const target = {}, state = {};
  let anchorName = null, action = null, featIdx = -1, mode = 'hero';
  const blend = { a0: null, a1: null, f0: 0, f1: 0, s: 0 };
  const tmp2 = new THREE.Vector3();

  function selectedCol() { return hexRGB(finishHex(sel.finish)); }
  function selectedLayout() { return LAYOUT[sel.gang].slice(); }

  function computeTarget(y, t) {
    // which section owns the viewport centre?
    let cur = null;
    for (const id in SEC) { const s = SEC[id]; if (y + vh * 0.5 >= s.top && y + vh * 0.5 < s.top + s.h) cur = s; }
    mode = cur ? cur.mode : 'hidden';
    Object.assign(target, BASE);
    target.col = selectedCol(); target.layout = selectedLayout(); target.material = sel.material;
    anchorName = null; action = null;
    let sl = SLOTS.hero;
    if (mode === 'hero') {
      sl = SLOTS.hero; Object.assign(target, D.hero || {});
      target.ry = (D.hero && D.hero.ry || -20) + Math.sin(t * 0.35) * 14 * (reduced ? 0 : 1);
    } else if (mode === 'explore') {
      sl = SLOTS.explore;
      const p = (y - cur.top) / cur.range;
      const q = clamp(p * N, 0, N - 0.0001), i = Math.floor(q), fr = q - i;
      // hold each feature, then glide to the next one during the last part of its scroll range
      let s = i < N - 1 ? clamp((fr - 0.6) / 0.4, 0, 1) : 0; s = s * s * (3 - 2 * s);
      const f0 = D.features[i], f1 = D.features[Math.min(N - 1, i + 1)];
      const a = Object.assign({}, BASE, f0.state), b = Object.assign({}, BASE, f1.state);
      for (const k in BASE) target[k] = a[k] + (b[k] - a[k]) * s;
      const c0 = f0.state.colHex ? hexRGB(f0.state.colHex) : selectedCol(), c1 = f1.state.colHex ? hexRGB(f1.state.colHex) : selectedCol();
      target.col = c0.map((v, n) => v + (c1[n] - v) * s);
      featIdx = s > 0.5 ? Math.min(N - 1, i + 1) : i;
      const f = D.features[featIdx];
      anchorName = f.anchor; action = f.action;
      blend.a0 = f0.anchor; blend.a1 = f1.anchor; blend.f0 = a.focus; blend.f1 = b.focus; blend.s = s;
    } else if (mode === 'config') {
      sl = SLOTS.config; Object.assign(target, D.config || {});
    } else {
      // product leaves the stage while reading lists/specs
      sl = Object.assign({}, SLOTS.config, { y: -1.9 });
    }
    target.x = sl.x; target.y = sl.y; target.fw = sl.fw; target.fh = sl.fh;
    if (mode === 'explore') featureActions(t);
  }

  /* feature actions: little demos that make each explanation visible */
  let actT = 0, actStep = 0, lastAction = null, lastUser = -1e9;
  function featureActions(t) {
    if (action !== lastAction) { actT = 0; actStep = 0; lastAction = action; if (action === 'led' || action === 'dual' || action === 'rocker' || action === 'press') A.setLeds(true); }
    const userIdle = performance.now() - lastUser > 4000;
    const list = finishList();
    if (action === 'colors') {
      const i = Math.floor(actT / 1.6) % list.length; target.col = hexRGB(list[i].hex); showFinishBadge(list[i]);
    } else hideFinishBadge();
    if (action === 'materials') {
      const mats = ['air', 'metal', 'gem'];
      const i = Math.floor(actT / 2.2) % 3; target.material = mats[i];
      const f = D.materials[mats[i]];
      target.col = hexRGB(f.finishes[f.def || 0].hex); showFinishBadge({ name: f.name, code: f.sub });
    }
  }
  function tickActions(dt) {
    if (mode !== 'explore') return;
    actT += dt;
    const keys = A.keys();
    const period = action === 'rocker' ? 1.1 : action === 'dual' ? 1.2 : action === 'led' ? 0.7 : 1.0;
    if ((action === 'press' || action === 'led' || action === 'dual' || action === 'rocker') && performance.now() - lastUser > 4000) {
      if (actT > (actStep + 1) * period) { actStep++; A.press(actStep % keys.length); }
    }
  }

  const badge = $('#finishBadge');
  function showFinishBadge(f) { if (!badge) return; badge.classList.add('on'); badge.innerHTML = `<b>${f.name}</b>${f.code ? `<span>${f.code}</span>` : ''}`; }
  function hideFinishBadge() { if (badge) badge.classList.remove('on'); }

  function damp(cur, tgt, f) {
    for (const k in tgt) {
      const v = tgt[k];
      if (Array.isArray(v)) { cur[k] = cur[k] || v.slice(); for (let i = 0; i < v.length; i++) cur[k][i] += (v[i] - cur[k][i]) * f; }
      else if (typeof v === 'number') cur[k] = cur[k] == null ? v : cur[k] + (v - cur[k]) * f;
      else cur[k] = v;
    }
  }

  /* ---------------- interaction ---------------- */
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(-9, -9);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let hover = -1, actx = null;
  function clickSound() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, buf = actx.createBuffer(1, actx.sampleRate * 0.03, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
      const s = actx.createBufferSource(); s.buffer = buf;
      const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 1.3;
      const g = actx.createGain(); g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      s.connect(f).connect(g).connect(actx.destination); s.start(t);
    } catch (e) { /* optional */ }
  }
  addEventListener('pointermove', (e) => { ndc.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1); mouse.x = ndc.x; mouse.y = ndc.y; }, { passive: true });
  addEventListener('click', (e) => {
    if (hover < 0 || e.target.closest('a, button, .tabs, .range')) return;
    A.press(hover); clickSound(); lastUser = performance.now();
  });

  /* ---------------- pins (hotspots) ---------------- */
  const pinsWrap = $('#pins');
  const pins = D.features.map((f, i) => {
    const b = document.createElement('button');
    b.className = 'hotspot'; b.type = 'button';
    b.setAttribute('aria-label', `Feature ${i + 1}: ${f.title}`);
    b.innerHTML = `<span class="n">${i + 1}</span><span class="lbl">${f.title}</span>`;
    b.addEventListener('click', () => goFeature(i));
    pinsWrap.appendChild(b); return b;
  });
  function goFeature(i) {
    const s = SEC.explore; if (!s) return;
    scrollTo(s.top + ((i + 0.5) / N) * s.range);
  }
  $$('.feat-nav button').forEach((b, i) => b.addEventListener('click', () => goFeature(i)));

  /* ---------------- dimension overlay ---------------- */
  const dims = $('#dims');
  const dimsG = dims ? dims.querySelector('g') : null;
  const toScreen = (v) => { v.project(camera); return [(v.x + 1) * 0.5 * vw, (1 - v.y) * 0.5 * vh]; };
  function pt(obj, x, y) { v3.set(x, y, 0.05); obj.localToWorld(v3); return toScreen(v3); }
  function drawDims(on) {
    if (!dims) return;
    dims.classList.toggle('on', on);
    if (!on) return;
    const { obj, half } = A.plate(); obj.updateWorldMatrix(true, false);
    const h = half, box = h * 72 / 86, fx = h * 60.3 / 86;
    const TL = pt(obj, -h, h), TR = pt(obj, h, h), BR = pt(obj, h, -h), BL = pt(obj, -h, -h);
    const b = [pt(obj, -box, box), pt(obj, box, box), pt(obj, box, -box), pt(obj, -box, -box)];
    const f1 = pt(obj, -fx, 0), f2 = pt(obj, fx, 0);
    const off = 34;
    const L = (a, c) => `<line x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}"/>`;
    const bl = [BL[0], BL[1] + off], br = [BR[0], BR[1] + off], tr = [TR[0] + off, TR[1]], br2 = [BR[0] + off, BR[1]];
    dimsG.innerHTML =
      L(bl, br) + L([bl[0], bl[1] - 8], [bl[0], bl[1] + 8]) + L([br[0], br[1] - 8], [br[0], br[1] + 8]) +
      L(tr, br2) + L([tr[0] - 8, tr[1]], [tr[0] + 8, tr[1]]) + L([br2[0] - 8, br2[1]], [br2[0] + 8, br2[1]]) +
      `<polygon class="box" points="${b.map((p) => p.join(',')).join(' ')}"/>` +
      `<circle cx="${f1[0]}" cy="${f1[1]}" r="4"/><circle cx="${f2[0]}" cy="${f2[1]}" r="4"/>` + `<line class="fix" x1="${f1[0]}" y1="${f1[1]}" x2="${f2[0]}" y2="${f2[1]}"/>` +
      `<text x="${(bl[0] + br[0]) / 2}" y="${bl[1] + 24}" text-anchor="middle">86 mm</text>` +
      `<text x="${tr[0] + 14}" y="${(tr[1] + br2[1]) / 2 + 4}">86 mm</text>` +
      `<text class="s" x="${(f1[0] + f2[0]) / 2}" y="${f1[1] - 12}" text-anchor="middle">Fixing centre 60.3 mm</text>` +
      `<text class="s" x="${b[0][0] + 8}" y="${b[0][1] + 18}">Box 72 × 72 mm</text>`;
  }

  /* ---------------- smooth scroll + DOM ---------------- */
  let lenis = null;
  if (!reduced && window.Lenis) lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
  function scrollTo(y) { if (lenis) lenis.scrollTo(y, { duration: 1.3 }); else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' }); }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const el = $(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); $('.nav').classList.remove('open'); scrollTo(el.getBoundingClientRect().top + scrollY);
  }));
  const tog = $('.nav-toggle');
  if (tog) tog.addEventListener('click', () => { const o = $('.nav').classList.toggle('open'); tog.setAttribute('aria-expanded', o); });

  const feats = $$('.feat'), navBtns = $$('.feat-nav button'), progressBar = $('.progress span');
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: 0.15 });
  $$('.reveal').forEach((el) => io.observe(el));

  function domUpdate(y) {
    progressBar.style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh), 0, 1)})`;
    const inExplore = mode === 'explore';
    feats.forEach((f, i) => f.classList.toggle('on', inExplore ? i === featIdx : i === 0 && false));
    navBtns.forEach((b, i) => { b.classList.toggle('on', i === featIdx); b.setAttribute('aria-current', i === featIdx ? 'step' : 'false'); });
    document.body.classList.toggle('night', inExplore && action === 'glow');
    document.body.classList.toggle('mode-explore', inExplore);
    $$('.nav-links a').forEach((a) => { const id = a.getAttribute('href').slice(1); const s = SEC[id]; a.classList.toggle('active', !!s && y + vh * 0.5 >= s.top && y + vh * 0.5 < s.top + s.h); });
  }

  /* configurator controls */
  function refreshConfigUI() {
    $$('[data-gang]').forEach((b) => { const on = +b.dataset.gang === sel.gang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $$('[data-material]').forEach((b) => { const on = b.dataset.material === sel.material; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const list = finishList();
    const sw = $('#swatches');
    if (sw) {
      sw.innerHTML = list.map((f, i) => `<button class="sw${i === sel.finish ? ' on' : ''}" style="--c:${f.hex}" data-finish="${i}" aria-label="${f.name}" aria-pressed="${i === sel.finish}"></button>`).join('');
      $$('[data-finish]', sw).forEach((b) => b.addEventListener('click', () => { sel.finish = +b.dataset.finish; clickSound(); refreshConfigUI(); }));
    }
    const nm = $('#finishName'); if (nm) nm.textContent = list[sel.finish].name + (list[sel.finish].code ? ` · ${list[sel.finish].code}` : '');
    const code = $('#cfgCode'); if (code && D.codeFor) code.textContent = D.codeFor[sel.gang] ? D.codeFor[sel.gang].replace('{s}', D.series === 'm7' ? D.materials[sel.material].suffix : '') : '';
  }
  $$('[data-gang]').forEach((b) => b.addEventListener('click', () => { sel.gang = +b.dataset.gang; clickSound(); refreshConfigUI(); }));
  $$('[data-material]').forEach((b) => b.addEventListener('click', () => { sel.material = b.dataset.material; sel.finish = Math.min(sel.finish, D.materials[sel.material].finishes.length - 1); clickSound(); refreshConfigUI(); }));
  refreshConfigUI();

  /* product range tabs */
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.tabs button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    $$('.range-panel').forEach((p) => (p.hidden = p.dataset.cat !== b.dataset.cat));
  }));

  /* ---------------- main loop ---------------- */
  let last = performance.now(), intro = 0, focusAmt = 0;
  const exPanel = $('.ex-panel'); let fadeEdge = innerWidth + 400, lastMask = '';
  const tmp = new THREE.Vector3(), center = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (lenis) lenis.raf(now);
    const y = scrollY, t = now / 1000;
    computeTarget(y, t);
    domUpdate(y);
    if (!renderer) return;
    if (state.x == null) damp(state, target, 1);
    damp(state, target, SNAP ? 1 : 1 - Math.exp(-dt * (reduced ? 30 : 5.5)));
    tickActions(dt);
    const st = state;

    // fit into slot (+ zoom)
    const Hv = VH(), Wv = Hv * camera.aspect;
    const [fw, fh] = A.footprint(st);
    const base = Math.min(0.4 * Hv, 0.62 * Wv) / OUTER;
    let k = Math.min(base * st.s, (st.fw * Wv) / fw, (st.fh * Hv) / fh) * st.zoom * (0.85 + 0.15 * intro);
    root.scale.setScalar(k);
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 3); mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 3);
    const D2R = THREE.MathUtils.degToRad, mi = vw > 900 ? 1 : 0.3;
    root.rotation.set(D2R(st.rx) - mouse.sy * 0.06 * mi, D2R(st.ry) + mouse.sx * 0.09 * mi, D2R(st.rz));
    center.set(st.x * Wv / 2, st.y * Hv / 2, 0);
    root.position.copy(center);
    root.position.y += Math.sin(t * 0.9) * 0.1 * k * (reduced ? 0 : 1);
    A.update(st, dt, t);
    root.updateMatrixWorld(true);
    // bring the active feature's anchor towards the centre of the stage
    focusAmt += ((mode === 'explore' ? 1 : 0) - focusAmt) * Math.min(1, dt * 5);
    if (focusAmt > 0.001 && (blend.f0 > 0.001 || blend.f1 > 0.001)) {
      A.anchor(blend.a0, tmp); A.anchor(blend.a1, tmp2);
      const w0 = (1 - blend.s) * blend.f0 * focusAmt, w1 = blend.s * blend.f1 * focusAmt;
      root.position.x += (center.x - tmp.x) * w0 + (center.x - tmp2.x) * w1;
      root.position.y += (center.y - tmp.y) * w0 + (center.y - tmp2.y) * w1;
      root.updateMatrixWorld(true);
    }
    const R = OUTER * k;
    sheen.position.set(root.position.x - R * (0.9 - Math.sin(t * 0.3) * 0.25), root.position.y + R * 0.95, R * 1.15);
    sheen.intensity = R * R * (D.series === 'm7' ? 2.0 : 3.6) * (1 - 0.85 * st.glow);
    keyLight.intensity = 1.2 * (1 - 0.8 * st.glow);
    renderer.toneMappingExposure = 1.12 * (1 - 0.6 * st.glow);

    // hover keys
    hover = -1;
    if (ndc.x > -2 && st.explode < 0.05 && st.trio < 0.05 && mode !== 'hidden') {
      ray.setFromCamera(ndc, camera);
      const h = ray.intersectObjects(A.pressables(), false)[0];
      if (h) hover = h.object.userData.keyIndex;
    }
    document.documentElement.style.cursor = hover >= 0 ? 'pointer' : '';

    // pins
    const showPins = mode === 'explore';
    pins.forEach((p, i) => {
      if (!showPins) { p.classList.remove('vis'); return; }
      A.anchor(D.features[i].anchor, tmp);
      const [sx, sy] = toScreen(tmp);
      const inside = sx > 10 && sx < vw - 10 && sy > 70 && sy < vh - 10;
      // only the active pin and pins on the visible model show; avoid clutter while zoomed
      const clear = mobile ? sy < fadeEdge - 50 : sx < fadeEdge - 60;
      const vis = inside && clear && i === featIdx;
      p.classList.toggle('vis', vis);
      p.classList.toggle('on', i === featIdx);
      p.style.transform = `translate3d(${sx}px,${sy}px,0)`;
    });
    drawDims(mode === 'explore' && action === 'dims' && Math.abs(st.ry) < 6);
    // soft fade towards the explanation panel so a zoomed model never covers the text
    const pr = exPanel.getBoundingClientRect();
    const want = mode === 'explore' ? (mobile ? pr.top - 6 : pr.left - 14) : (mobile ? vh + 400 : vw + 400);
    fadeEdge += (want - fadeEdge) * Math.min(1, dt * 6); fadeEdge = (SNAP || Math.abs(want - fadeEdge) < 0.5) ? want : fadeEdge;
    const fe = Math.round(fadeEdge);
    const m = mobile ? `linear-gradient(to bottom, #000 ${fe - 70}px, transparent ${fe}px)` : `linear-gradient(to right, #000 ${fe - 110}px, transparent ${fe}px)`;
    if (m !== lastMask) { canvas.style.webkitMaskImage = m; canvas.style.maskImage = m; lastMask = m; }
    renderer.render(scene, camera);
  }

  function resize() {
    vw = innerWidth; vh = innerHeight;
    if (renderer) { renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix(); }
    measure(); measureSlots();
  }
  let rT, lastW = innerWidth, lastH = innerHeight;
  const coarse = matchMedia('(pointer: coarse)').matches;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const w = innerWidth, h = innerHeight;
      if (coarse && w === lastW && Math.abs(h - lastH) < 160) { if (renderer) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } vh = h; return; }
      lastW = w; lastH = h; resize();
    }, 120);
  });

  measure(); measureSlots();
  // late-loading images change section positions → re-measure
  if (window.ResizeObserver) { let roT; new ResizeObserver(() => { clearTimeout(roT); roT = setTimeout(() => { measure(); measureSlots(); }, 80); }).observe($('#main')); }
  requestAnimationFrame((n) => { last = n; frame(n); });
  const done = () => {
    resize();
    $('#loader') && $('#loader').classList.add('done');
    document.body.classList.add('ready');
    const o = { v: 0 };
    if (window.gsap) gsap.to(o, { v: 1, duration: reduced ? 0.01 : 1.8, ease: 'power3.out', onUpdate: () => (intro = o.v) }); else intro = 1;
    A.keys().forEach((k, i) => setTimeout(() => { k.on = true; }, (reduced ? 0 : 500) + i * 200));
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(done, 200));
})();

/* keep the current series visible in the scrollable series nav (phones) */
(function () { var on = document.querySelector('.nav-series .on'); if (on) on.parentNode.scrollLeft = on.offsetLeft - on.parentNode.offsetLeft - on.parentNode.clientWidth / 2 + on.offsetWidth / 2; })();
