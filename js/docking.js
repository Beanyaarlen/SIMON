/* =========================================================================
   Simon Docking Family — "One Dock. Endless Possibilities."
   Blueprint / wireframe scroll story + solid configurator
   ========================================================================= */
(function () {
  'use strict';
  const T = THREE;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ez = (t) => t * t * (3 - 2 * t);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SNAP = /[?&]snap/.test(location.search);
  const { rrect, keyGeometry } = Switch3D.helpers;
  const ACCENT = new T.Color('#ffb25e');           // 3000K warm light
  const FIN = [['White', '#ececea'], ['Champagne', '#d6c3a0'], ['Black Doff', '#262627'], ['Dark Grey', '#5d5d5f'], ['Mocha', '#48433b']];

  /* ---------------- renderer ---------------- */
  const canvas = $('#gl');
  let renderer = null;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { renderer = null; }
  if (!renderer) { canvas.style.display = 'none'; }
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 0, 70);
  const VH = () => 2 * camera.position.z * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
  const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(-6, 9, 10);
  const rim = new T.DirectionalLight(0xd4ddff, 1.0); rim.position.set(9, 2, -6);
  scene.add(key, rim, new T.HemisphereLight(0xffffff, 0x1a1a1a, 0.35));
  const warm = new T.PointLight(0xffb25e, 0, 0, 2); scene.add(warm);
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    scene.environment = Switch3D.makeEnvironment(renderer);
  }

  /* ---------------- materials ---------------- */
  const M = {
    finish: new T.MeshPhysicalMaterial({ color: 0xececea, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    acc: new T.MeshPhysicalMaterial({ color: 0xf2f2f0, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    dark: new T.MeshStandardMaterial({ color: 0x141416, roughness: 0.8, side: T.DoubleSide }),
    gold: new T.MeshStandardMaterial({ color: 0xd2a85a, metalness: 1, roughness: 0.25 }),
    steel: new T.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.35 }),
    box: new T.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.75 }),
    emit: new T.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false }),
  };
  const solidMats = [M.finish, M.acc, M.dark, M.gold, M.steel, M.box, M.emit];
  solidMats.forEach((m) => { m.transparent = true; });

  /* every visible solid also gets a blueprint twin: dark fill + white edges */
  const parts = [];
  const lineMat = () => new T.LineBasicMaterial({ color: 0xf2f2f0, transparent: true, opacity: 0.9 });
  function part(geo, mat, tag, parent, opts) {
    opts = opts || {};
    const g = new T.Group();
    const solid = new T.Mesh(geo, mat);
    const fillMat = new T.MeshBasicMaterial({ color: 0x0b0b0c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: true, side: opts.side || T.FrontSide });
    const fill = new T.Mesh(geo, fillMat);
    const lines = new T.LineSegments(new T.EdgesGeometry(geo, opts.edge || 28), lineMat());
    g.add(solid, fill, lines);
    parent.add(g);
    const p = { g, solid, fill, lines, tag, hi: 0 };
    parts.push(p);
    return g;
  }

  /* ---------------- the dock ---------------- */
  const P = 8.6, HOLE = 2.75;
  const root = new T.Group(); scene.add(root);
  const dock = new T.Group(); root.add(dock);
  const layers = { plate: new T.Group(), cup: new T.Group(), pins: new T.Group(), box: new T.Group() };
  Object.values(layers).forEach((l) => dock.add(l));
  {
    const sh = rrect(P, P, 0.3);
    const hole = new T.Path(); hole.absarc(0, 0, HOLE, 0, Math.PI * 2, true); sh.holes.push(hole);
    const geo = new T.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 48 });
    geo.translate(0, 0, -0.4);
    part(geo, M.finish, 'plate', layers.plate);
    const btn = new T.CylinderGeometry(0.32, 0.32, 0.08, 28); btn.rotateX(Math.PI / 2); btn.translate(-P / 2 + 0.75, -P / 2 + 0.75, 0.04);
    part(btn, M.finish, 'plate', layers.plate);
    const ring = new T.TorusGeometry(HOLE + 0.02, 0.05, 8, 64); part(ring, M.finish, 'plate', layers.plate);
    // socket cup
    const cup = new T.CylinderGeometry(HOLE - 0.02, HOLE - 0.02, 1.0, 32, 1, true); cup.rotateX(Math.PI / 2); cup.translate(0, 0, -0.5);
    part(cup, M.dark, 'cup', layers.cup, { side: T.DoubleSide, edge: 8 });
    const back = new T.CircleGeometry(HOLE - 0.02, 64); back.translate(0, 0, -0.98);
    part(back, M.dark, 'cup', layers.cup);
    // contact pins
    [-0.66, -0.22, 0.22, 0.66].forEach((x) => {
      const pin = new T.CylinderGeometry(0.13, 0.13, 0.4, 20); pin.rotateX(Math.PI / 2); pin.translate(x, 0.35, -0.78);
      part(pin, M.gold, 'pins', layers.pins);
    });
    const pcb = keyGeometry(2.6, 1.0, 0.12, 0.2, 0.02); pcb.translate(0, 0.35, -0.86);
    part(pcb, M.dark, 'pins', layers.pins);
    // flush mounting box
    const bw = 7.6, bd = 4.2;
    const bx = new T.Group();
    const wall = (w, h, d, x, y, z) => { const gg = new T.BoxGeometry(w, h, d); gg.translate(x, y, z); part(gg, M.box, 'box', layers.box); };
    wall(bw, bw, 0.2, 0, 0, -bd);
    wall(bw, 0.2, bd, 0, bw / 2, -bd / 2); wall(bw, 0.2, bd, 0, -bw / 2, -bd / 2);
    wall(0.2, bw, bd, bw / 2, 0, -bd / 2); wall(0.2, bw, bd, -bw / 2, 0, -bd / 2);
    layers.box.add(bx);
  }

  /* ---------------- accessories (each plugs into the cup) ---------------- */
  function plug(parent) {
    const g = new T.CylinderGeometry(HOLE - 0.12, HOLE - 0.12, 0.75, 32); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.42);
    part(g, M.acc, 'plug', parent, { edge: 8 });
    [-0.66, -0.22, 0.22, 0.66].forEach((x) => { const c = new T.CircleGeometry(0.11, 16); c.rotateY(Math.PI); c.translate(x, 0.35, -0.8); part(c, M.gold, 'plug', parent); });
  }
  function glowTex(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, inner, 128, 128, outer);
    g.addColorStop(0, 'rgba(255,214,160,0.95)'); g.addColorStop(0.4, 'rgba(255,178,94,0.35)'); g.addColorStop(1, 'rgba(255,178,94,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new T.CanvasTexture(c);
  }
  const KITS = {};
  // Reading lamp kit — fully rotating head, warm, dimmable (5W 3000K)
  {
    const g = new T.Group(); plug(g);
    const face = new T.CylinderGeometry(HOLE - 0.05, HOLE + 0.05, 0.45, 56); face.rotateX(Math.PI / 2); face.translate(0, 0, 0.22);
    part(face, M.acc, 'body', g);
    const knuckle = new T.SphereGeometry(0.75, 16, 10); knuckle.translate(0, 0, 0.75); part(knuckle, M.acc, 'body', g, { edge: 10 });
    const head = new T.Group(); head.position.set(0, 0, 0.9); g.add(head);
    const arm = new T.CylinderGeometry(1.05, 1.15, 4.6, 24); arm.rotateZ(Math.PI / 2); arm.translate(2.3, 0, 0.45);
    part(arm, M.acc, 'head', head, { edge: 10 });
    const cap = new T.CircleGeometry(1.0, 40); cap.rotateY(Math.PI / 2); cap.translate(4.61, 0, 0.45);
    const em = new T.Mesh(cap, M.emit); head.add(em);
    const cone = new T.Mesh(new T.ConeGeometry(2.6, 7, 48, 1, true), new T.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
    cone.rotation.z = Math.PI / 2; cone.position.set(4.6 + 3.5, 0, 0.45); head.add(cone);
    KITS.lamp = { g, head, em, beam: cone, name: 'Reading Lamp Kit' };
  }
  // Wall light kit — 355° rotation, warm, dimmable (3W 3000K)
  {
    const g = new T.Group(); plug(g);
    const disc = new T.CylinderGeometry(HOLE + 0.25, HOLE + 0.35, 0.7, 36); disc.rotateX(Math.PI / 2); disc.translate(0, 0, 0.35);
    part(disc, M.acc, 'body', g, { edge: 8 });
    const dome = new T.SphereGeometry(HOLE + 0.25, 36, 4, 0, Math.PI * 2, 0, 0.42); dome.rotateX(Math.PI / 2); dome.translate(0, 0, 0.7 - (HOLE + 0.25) * Math.cos(0.42));
    const rot = new T.Group(); g.add(rot);
    part(dome, M.acc, 'face', rot, { edge: 6 });
    const dot = new T.CircleGeometry(0.12, 16); dot.translate(0, HOLE - 0.55, 1.1); part(dot, M.dark, 'face', rot);
    const slot = new T.Mesh(new T.PlaneGeometry(3.6, 0.16), M.emit); slot.position.set(0, -(HOLE + 0.36), 0.35); slot.rotation.x = Math.PI / 2; g.add(slot);
    const wash = new T.Mesh(new T.PlaneGeometry(12, 12), new T.MeshBasicMaterial({ map: glowTex(0, 128), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    wash.position.set(0, -4.6, -0.3); wash.scale.set(0.9, 1.2, 1); g.add(wash);
    KITS.wall = { g, rot, em: slot, beam: wash, name: 'Wall Light Kit' };
  }
  // Type A+C double USB outlet kit
  {
    const g = new T.Group(); plug(g);
    const face = new T.CylinderGeometry(HOLE - 0.05, HOLE + 0.05, 0.4, 56); face.rotateX(Math.PI / 2); face.translate(0, 0, 0.2);
    part(face, M.acc, 'body', g);
    const a = keyGeometry(1.5, 0.62, 0.3, 0.06, 0.02); a.translate(0, 0.62, 0.43); part(a, M.dark, 'ports', g);
    const at = keyGeometry(1.2, 0.18, 0.1, 0.04, 0.01); at.translate(0, 0.72, 0.46); part(at, M.steel, 'ports', g);
    const c = keyGeometry(1.0, 0.36, 0.3, 0.17, 0.02); c.translate(0, -0.55, 0.43); part(c, M.dark, 'ports', g);
    KITS.usb = { g, name: 'Type A+C USB Kit' };
  }
  Object.values(KITS).forEach((k) => { root.add(k.g); k.pres = 0; k.g.visible = false; });

  /* ---------------- story data ---------------- */
  const STEPS = [
    { word: 'DOCK', kit: null, explode: 1, out: 1, hi: ['pins'], ry: -38, rx: -16, wire: 1 },
    { word: 'CONNECT', kit: 'lamp', explode: 0, out: 0.7, hi: ['plug'], ry: -46, rx: -14, wire: 1 },
    { word: 'READ', kit: 'lamp', explode: 0, out: 0, hi: ['head'], ry: -28, rx: -10, wire: 1, light: 1, swing: 1 },
    { word: 'GLOW', kit: 'wall', explode: 0, out: 0, hi: ['face'], ry: -24, rx: -8, wire: 1, light: 1, spin: 1 },
    { word: 'CHARGE', kit: 'usb', explode: 0, out: 0, hi: ['ports'], ry: -30, rx: -10, wire: 1 },
    { word: 'CUSTOMIZE', kit: 'lamp', explode: 0, out: 0, hi: [], ry: -26, rx: -8, wire: 0, light: 1, colors: 1 },
  ];
  const sel = { kit: 'wall', fin: 0, light: true };

  /* ---------------- layout ---------------- */
  let vw = innerWidth, vh = innerHeight, mobile = false;
  const SEC = {};
  function measure() {
    vw = innerWidth; vh = innerHeight; mobile = vw <= 900 || vw / vh <= 0.8;
    $$('[data-mode]').forEach((el) => { const r = el.getBoundingClientRect(); SEC[el.id] = { el, top: r.top + scrollY, h: el.offsetHeight, range: Math.max(1, el.offsetHeight - vh), mode: el.dataset.mode }; });
    ['hero', 'story', 'config'].forEach((n) => {
      const el = $(`.slot[data-slot="${n}"]`); if (!el) return;
      const box = el.closest('.stick') || el.closest('[data-mode]');
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      SLOT[n] = { x: ((r.left - b.left + r.width / 2) / vw) * 2 - 1, y: 1 - ((r.top - b.top + r.height / 2) / vh) * 2, fw: r.width / vw, fh: r.height / vh };
    });
  }
  const SLOT = {};

  /* ---------------- state ---------------- */
  const tgt = {}, st = {};
  let mode = 'hero', stepIdx = 0, stepBlend = 0;
  function compute(y, t) {
    let cur = null;
    for (const id in SEC) { const s = SEC[id]; if (y + vh * 0.5 >= s.top && y + vh * 0.5 < s.top + s.h) cur = s; }
    mode = cur ? cur.mode : 'hidden';
    const sl = SLOT[mode] || Object.assign({}, SLOT.config || { x: 0, fw: 0.5, fh: 0.5 }, { y: -2.2 });
    Object.assign(tgt, { x: sl.x, y: sl.y, fw: sl.fw, fh: sl.fh, explode: 0, out: 0, wire: 0, ry: -22, rx: -6, light: 1, swing: 0, spin: 0 });
    let kit = sel.kit, hi = [];
    if (mode === 'hero') {
      tgt.ry = -22 + Math.sin(t * 0.4) * 10; tgt.light = 1; kit = 'wall';
      // the hero hands over to the blueprint as you scroll
      const hp = clamp((y - SEC.hero.top) / vh, 0, 1); tgt.wire = ez(clamp((hp - 0.35) / 0.5, 0, 1));
    } else if (mode === 'story') {
      const N = STEPS.length, p = (y - cur.top) / cur.range;
      const q = clamp(p * N, 0, N - 0.0001), i = Math.floor(q), fr = q - i;
      let s = i < N - 1 ? clamp((fr - 0.62) / 0.38, 0, 1) : 0; s = ez(s);
      const a = STEPS[i], b = STEPS[Math.min(N - 1, i + 1)];
      ['explode', 'out', 'ry', 'rx', 'wire'].forEach((k) => (tgt[k] = a[k] + (b[k] - a[k]) * s));
      tgt.light = (a.light || 0) + ((b.light || 0) - (a.light || 0)) * s;
      tgt.swing = a.swing || 0; tgt.spin = a.spin || 0;
      stepIdx = s > 0.5 ? Math.min(N - 1, i + 1) : i; stepBlend = s;
      const S = STEPS[stepIdx];
      kit = S.kit; hi = S.hi;
      if (S.colors) { const fi = Math.floor(t / 1.5) % FIN.length; finishTo(fi); kit = ['lamp', 'wall', 'usb'][Math.floor(t / 4.5) % 3]; }
    } else if (mode === 'config') {
      tgt.light = sel.light ? 1 : 0; kit = sel.kit;
    }
    if (mode !== 'story' || !STEPS[stepIdx].colors) finishTo(sel.fin);
    for (const k in KITS) KITS[k].want = k === kit ? 1 : 0;
    parts.forEach((p) => (p.want = hi.includes(p.tag) ? 1 : 0));
  }
  const colTarget = new T.Color(FIN[0][1]);
  function finishTo(i) { colTarget.set(FIN[i][1]); curFin = i; }
  let curFin = 0;
  const damp = (a, b, f) => a + (b - a) * f;

  /* ---------------- interaction ---------------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2(-9, -9);
  addEventListener('pointermove', (e) => ndc.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1), { passive: true });
  let hovering = false;
  addEventListener('click', (e) => {
    if (!hovering || e.target.closest('a,button')) return;
    sel.light = !sel.light; refreshUI();
  });
  $$('[data-kit]').forEach((b) => b.addEventListener('click', () => { sel.kit = b.dataset.kit; sel.light = true; refreshUI(); }));
  function refreshUI() {
    $$('[data-kit]').forEach((b) => { const on = b.dataset.kit === sel.kit; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const sw = $('#dockSwatches');
    sw.innerHTML = FIN.map((f, i) => `<button class="sw${i === sel.fin ? ' on' : ''}" style="--c:${f[1]}" data-fin="${i}" aria-label="${f[0]}" aria-pressed="${i === sel.fin}"></button>`).join('');
    $$('[data-fin]', sw).forEach((b) => b.addEventListener('click', () => { sel.fin = +b.dataset.fin; refreshUI(); }));
    $('#dockFinName').textContent = FIN[sel.fin][0];
    $('#dockLight').textContent = sel.kit === 'usb' ? 'Charging ready' : sel.light ? 'Light on — tap the dock to switch off' : 'Light off — tap the dock to switch on';
  }
  refreshUI();

  /* ---------------- DOM: words, counter, copy ---------------- */
  const words = $('.words'), wordEls = $$('.words span'), counter = $('.counter b'), dots = $$('.counter i'), copies = $$('.story-copy article');
  const heroLetters = $$('.split-letter');
  const seeds = heroLetters.map(() => [Math.random() * 2 - 1, Math.random(), 0.2 + Math.random() * 0.8]);
  let lastStep = -1;
  function dom(y) {
    $('.progress span').style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh), 0, 1)})`;
    // hero letters scatter (like the reference)
    const hp = clamp((y - (SEC.hero ? SEC.hero.top : 0)) / (vh * 0.7), 0, 1);
    heroLetters.forEach((el, i) => {
      const [dx, dy, sp] = seeds[i]; const k = clamp((hp - (1 - sp) * 0.4) / 0.6, 0, 1);
      el.style.transform = `translate3d(${dx * 40 * k}px,${-dy * 140 * k}px,0)`; el.style.opacity = 1 - k;
    });
    const inStory = mode === 'story';
    document.body.classList.toggle('blueprint', inStory);
    if (inStory) {
      const n = String(stepIdx + 1).padStart(2, '0');
      if (counter.textContent !== n) counter.textContent = n;
      dots.forEach((d, i) => d.classList.toggle('on', i === stepIdx));
      copies.forEach((c, i) => c.classList.toggle('on', i === stepIdx));
      wordEls.forEach((w, i) => w.classList.toggle('on', i === stepIdx));
    }
    if (inStory && stepIdx !== lastStep) {
      lastStep = stepIdx;
      const w = wordEls[stepIdx], wrap = words.parentElement, cs = getComputedStyle(wrap);
      const right = parseFloat(cs.paddingLeft) + w.offsetLeft + w.offsetWidth;
      words.style.transform = `translate3d(${wrap.clientWidth - parseFloat(cs.paddingRight) - right}px,0,0)`;
    }
  }

  /* ---------------- frame ---------------- */
  let lenis = null;
  if (!reduced && window.Lenis) lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const el = $(a.getAttribute('href')); if (!el) return; e.preventDefault(); const yy = el.getBoundingClientRect().top + scrollY; lenis ? lenis.scrollTo(yy, { duration: 1.3 }) : scrollTo({ top: yy, behavior: 'smooth' }); }));
  let last = performance.now();
  const tmp = new T.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (lenis) lenis.raf(now);
    const y = scrollY, t = now / 1000;
    compute(y, t); dom(y);
    if (!renderer) return;
    const f = SNAP ? 1 : 1 - Math.exp(-dt * 5.5);
    for (const k in tgt) st[k] = st[k] == null ? tgt[k] : damp(st[k], tgt[k], f);

    // fit
    const Hv = VH(), Wv = Hv * camera.aspect;
    const W = 11 + st.explode * 4 + (mode === 'story' ? 3 : 0), H = 11 + st.explode * 2;
    const k = Math.min((st.fw * Wv) / W, (st.fh * Hv) / H);
    root.scale.setScalar(k);
    root.position.set(st.x * Wv / 2, st.y * Hv / 2 + Math.sin(t * 0.8) * 0.1 * k, 0);
    root.rotation.set(T.MathUtils.degToRad(st.rx), T.MathUtils.degToRad(st.ry), 0);

    // dock layers explode along the depth axis
    const e = st.explode;
    layers.plate.position.z = e * 5.5; layers.cup.position.z = e * 2.2; layers.pins.position.z = e * 0.4; layers.box.position.z = -e * 3.5;

    // accessories: active one flies in on a diagonal and docks
    for (const kk in KITS) {
      const K = KITS[kk];
      K.pres = damp(K.pres, K.want, SNAP ? 1 : 1 - Math.exp(-dt * 4));
      K.g.visible = K.pres > 0.01;
      const away = 1 - K.pres, out = st.out * K.pres;
      K.g.position.set(away * 9, away * 3, out * 7.5 + away * 14 + e * 5.5);
      K.g.rotation.y = away * 0.8;
      const on = st.light * K.pres;
      if (K.beam) K.beam.material.opacity = (kk === 'lamp' ? 0.16 : 0.85) * on * (1 - st.out);
      if (K.em) K.em.material = on > 0.05 ? M.emit : M.dark;
      if (kk === 'lamp') { K.head.rotation.y = -0.55 + (st.swing ? Math.sin(t * 0.9) * 0.55 : 0); K.head.rotation.z = -0.45 + (st.swing ? Math.sin(t * 0.6) * 0.25 : 0); }
      if (kk === 'wall') K.rot.rotation.z = st.spin ? (t * 0.9) % (Math.PI * 2) * (355 / 360) : 0;
    }
    // warm point light near the active light kit
    const act = KITS.lamp.pres > 0.5 ? KITS.lamp : KITS.wall.pres > 0.5 ? KITS.wall : null;
    warm.intensity = act ? st.light * 22 * k * k * (1 - st.wire * 0.8) * (1 - st.out) : 0;
    if (act) { tmp.set(0, -3, 3); act.g.localToWorld(tmp); warm.position.copy(tmp); }

    // finish colour
    M.finish.color.lerp(colTarget, Math.min(1, dt * 6));
    M.acc.color.lerp(colTarget, Math.min(1, dt * 6));

    // solid ↔ blueprint
    const w = clamp(st.wire, 0, 1);
    solidMats.forEach((m) => { m.opacity = 1 - w; m.depthWrite = w < 0.5; });
    parts.forEach((p) => {
      p.hi = damp(p.hi, p.want || 0, Math.min(1, dt * 6));
      p.solid.visible = w < 0.995;
      p.fill.visible = w > 0.02;
      p.lines.visible = w > 0.02;
      p.lines.material.opacity = w * (0.9 - p.hi * 0.65);
      p.fill.material.color.setRGB(0.043 + (ACCENT.r - 0.043) * p.hi, 0.043 + (ACCENT.g - 0.043) * p.hi, 0.047 + (ACCENT.b - 0.047) * p.hi);
      p.fill.material.opacity = w;
    });

    // hover (configurator)
    hovering = false;
    if (mode === 'config' && ndc.x > -2) { ray.setFromCamera(ndc, camera); hovering = ray.intersectObject(root, true).length > 0; }
    document.documentElement.style.cursor = hovering ? 'pointer' : '';
    renderer.render(scene, camera);
  }

  function resize() {
    vw = innerWidth; vh = innerHeight;
    if (renderer) { renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix(); }
    measure(); lastStep = -1;
  }
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 120); });
  if (window.ResizeObserver) { let r2; new ResizeObserver(() => { clearTimeout(r2); r2 = setTimeout(measure, 80); }).observe($('#main')); }
  measure();
  requestAnimationFrame((n) => { last = n; frame(n); });
  Promise.race([document.fonts ? document.fonts.ready : 0, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(() => { resize(); $('#loader').classList.add('done'); document.body.classList.add('ready'); }, 200));
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); } }), { threshold: 0.15 });
  $$('.reveal').forEach((el) => io.observe(el));
})();

/* keep the current series visible in the scrollable series nav (phones) */
(function () { var on = document.querySelector('.nav-series .on'); if (on) on.parentNode.scrollLeft = on.offsetLeft - on.parentNode.offsetLeft - on.parentNode.clientWidth / 2 + on.offsetWidth / 2; })();
