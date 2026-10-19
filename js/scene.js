/* =========================================================
   Simon Smart Scene Studio
   - 3D bedroom whose lights follow a 4-gang dimmer
   - Simon finishes, scene buttons A–D, saved scenes, guided tour
   ========================================================= */
(() => {
  'use strict';
  const T = window.THREE;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LIGHTS = ['LED Strip', 'Downlight', 'Walk-in Closet', 'Bedside'];
  const FINISH = {
    white: { name: 'White', hex: '#e9e9e7' },
    champ: { name: 'Champagne', hex: '#d8c6a1' },
    dgrey: { name: 'Dark Grey', hex: '#5d5d5f' },
    black: { name: 'Black Doff', hex: '#262627' },
    mocha: { name: 'Mocha', hex: '#48433b' },
  };
  const DEFAULTS = {
    A: { name: 'All On', finish: 'black', levels: [80, 85, 70, 75], armed: [1, 1, 1, 1] },
    B: { name: 'Movie Time', finish: 'black', levels: [22, 0, 0, 14], armed: [1, 0, 0, 1] },
    C: { name: 'Bedtime', finish: 'black', levels: [0, 0, 18, 26], armed: [0, 0, 1, 1] },
    D: { name: 'All Off', finish: 'black', levels: [0, 0, 0, 0], armed: [0, 0, 0, 0] },
  };
  const KEY = 'simon_scene_studio_v1', GUIDE_KEY = 'simon_scene_guide_seen_v1';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- state ---------------- */
  const S = { levels: [0, 0, 0, 0], armed: [0, 0, 0, 0], finish: 'black', slot: 'A', edited: false, scenes: clone(DEFAULTS) };
  try { const saved = JSON.parse(store.get(KEY) || 'null'); if (saved && saved.scenes) S.scenes = Object.assign(clone(DEFAULTS), saved.scenes); } catch (e) { /* ignore */ }
  const persist = () => store.set(KEY, JSON.stringify({ scenes: S.scenes }));
  const eff = (i) => (S.armed[i] ? S.levels[i] / 100 : 0);

  /* =========================================================
     3D ROOM
     ========================================================= */
  const canvas = $('#room');
  let renderer = null, scene, camera, needs = 2;
  const disp = [0, 0, 0, 0];
  const FX = { strip: [], down: [], closet: [], bedside: [] };
  let plateMat = null; const plateDots = [];

  function gradTex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    let g;
    if (kind === 'radial') { g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
    else if (kind === 'edge') { g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const h = x.createLinearGradient(0, 0, 256, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.08, 'rgba(0,0,0,0)'); h.addColorStop(0.92, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 256, 256); }
    else if (kind === 'scallop') { x.save(); x.scale(1, 2.4); g = x.createRadialGradient(128, 4, 2, 128, 4, 120); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); x.restore(); }
    else if (kind === 'sky') { g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#0b1424'); g.addColorStop(0.7, '#1a2a45'); g.addColorStop(1, '#2b3550'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,${200 + Math.random() * 40},${140 + Math.random() * 60},${0.25 + Math.random() * 0.5})`; x.fillRect(Math.random() * 256, 170 + Math.random() * 80, 1.5, 1.5); } }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  function buildRoom() {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new T.Scene();
    scene.background = new T.Color('#0b0a09');
    camera = new T.PerspectiveCamera(48, 1.6, 0.05, 40);

    const RAD = gradTex('radial'), EDGE = gradTex('edge'), SCAL = gradTex('scallop');
    const std = (hex, r = 0.85, m = 0) => new T.MeshStandardMaterial({ color: hex, roughness: r, metalness: m });
    const box = (w, h, d, mat, x, y, z, parent = scene) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const glowMat = (tex, hex) => new T.MeshBasicMaterial({ map: tex, color: hex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
    const plane = (w, h, mat, x, y, z, rx = 0, ry = 0) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); return m; };
    const WARM = '#ffb36a', COVE = '#ffae62', CLOS = '#ffc68c';

    const W = 7.2, D = 6.4, H = 2.9, SH = 2.62, X0 = -W / 2, X1 = W / 2, Z0 = -D / 2, Z1 = D / 2;
    // shell
    const wallM = std('#8a8379', 0.95), ceilM = std('#9b958d', 0.95), floorM = std('#5d4a3c', 0.55);
    plane(W, D, floorM, 0, 0, 0, -Math.PI / 2);
    plane(W, D, ceilM, 0, H, 0, Math.PI / 2);
    plane(W, H, wallM, 0, H / 2, Z0);
    plane(D, H, wallM, X0, H / 2, 0, 0, Math.PI / 2);
    plane(D, H, wallM, X1, H / 2, 0, 0, -Math.PI / 2);
    plane(W, H, wallM, 0, H / 2, Z1, 0, Math.PI);
    // soffit band (cove ceiling)
    const sof = std('#a29c93', 0.95), B = 0.5, th = H - SH;
    box(W, th, B, sof, 0, SH + th / 2, Z0 + B / 2); box(W, th, B, sof, 0, SH + th / 2, Z1 - B / 2);
    box(B, th, D, sof, X0 + B / 2, SH + th / 2, 0); box(B, th, D, sof, X1 - B / 2, SH + th / 2, 0);
    // cove wash on the recessed ceiling (LED Strip)
    const coveEdges = [[W - 2 * B, 0, Z0 + B, 0], [W - 2 * B, 0, Z1 - B, Math.PI], [D - 2 * B, X0 + B, 0, Math.PI / 2], [D - 2 * B, X1 - B, 0, -Math.PI / 2]];
    coveEdges.forEach(([len, x, z, ry]) => {
      const g = new T.Mesh(new T.PlaneGeometry(len, 1.1), glowMat(EDGE, COVE));
      g.rotation.set(Math.PI / 2, 0, Math.PI); const holder = new T.Group(); holder.add(g); g.position.set(0, 0, 0.55);
      holder.position.set(x, H - 0.004, z); holder.rotation.y = ry; scene.add(holder);
      FX.strip.push({ m: g.material, k: 0.95 });
      const lip = box(len, 0.012, 0.012, new T.MeshBasicMaterial({ color: COVE, toneMapped: false }), 0, 0, 0); scene.remove(lip); holder.add(lip); lip.position.set(0, -(th) + 0.02, 0.01);
      FX.strip.push({ basic: lip.material, base: new T.Color(COVE) });
    });
    [[-1.6, -1], [1.6, -1], [-1.6, 1.4], [1.6, 1.4]].forEach(([x, z]) => { const p = new T.PointLight(COVE, 0, 7, 2); p.position.set(x, 2.78, z); scene.add(p); FX.strip.push({ light: p, k: 1.6 }); });

    // headboard wall: dark panel + wood slats
    box(3.6, 2.55, 0.03, std('#2a211b', 0.8), 0, 1.275, Z0 + 0.015);
    const slatM = std('#6b4a32', 0.62);
    for (let i = 0; i < 26; i++) box(0.095, 2.5, 0.04, slatM, -1.75 + 0.05 + i * 0.1346, 1.25, Z0 + 0.05);
    // bed
    const bedZ = Z0 + 0.12 + 1.07;
    box(1.62, 0.13, 1.9, std('#141210', 0.9), 0, 0.065, bedZ);
    box(1.96, 0.18, 2.14, std('#2f2b28', 0.8), 0, 0.22, bedZ);
    box(1.84, 0.24, 2.02, std('#d9d3c9', 0.95), 0, 0.43, bedZ);
    box(1.9, 0.07, 1.35, std('#e6e1d8', 0.97), 0, 0.575, bedZ + 0.36);
    box(1.94, 0.05, 0.46, std('#3b3531', 0.95), 0, 0.62, bedZ + 0.72);
    const pil = std('#eeeae3', 0.97), pil2 = std('#8f7d69', 0.95);
    [[-0.45, pil], [0.45, pil]].forEach(([x, m]) => { const s = new T.Mesh(new T.SphereGeometry(0.5, 24, 16), m); s.scale.set(0.62, 0.32, 0.18); s.position.set(x, 0.74, Z0 + 0.32); s.rotation.x = -0.25; scene.add(s); });
    [[-0.3, pil2], [0.3, pil2]].forEach(([x, m]) => { const s = new T.Mesh(new T.SphereGeometry(0.5, 24, 16), m); s.scale.set(0.46, 0.26, 0.15); s.position.set(x, 0.7, Z0 + 0.48); s.rotation.x = -0.2; scene.add(s); });
    // under-bed strip glow (LED Strip)
    const ub = plane(2.9, 3.2, glowMat(RAD, COVE), 0, 0.004, bedZ, -Math.PI / 2); FX.strip.push({ m: ub.material, k: 0.75 });
    const ubl = new T.PointLight(COVE, 0, 2.2, 2); ubl.position.set(0, 0.07, bedZ + 1.1); scene.add(ubl); FX.strip.push({ light: ubl, k: 0.35 });
    // rug + bench
    box(2.9, 0.012, 2.2, std('#7f776c', 1), 0, 0.006, bedZ + 0.9);
    box(1.3, 0.09, 0.4, std('#8a7d70', 0.95), 0, 0.38, bedZ + 1.5);
    [[-0.62, -0.15], [0.62, -0.15], [-0.62, 0.15], [0.62, 0.15]].forEach(([x, z]) => box(0.03, 0.335, 0.03, std('#1a1715', 0.6, 0.4), x * 0.92, 0.17, bedZ + 1.5 + z));
    // floating nightstands
    const ns = std('#3a2a20', 0.7);
    [-1.27, 1.27].forEach((x) => box(0.52, 0.2, 0.42, ns, x, 0.45, Z0 + 0.27));

    // bedside pendants (Bedside)
    [-1.27, 1.27].forEach((x) => {
      box(0.006, SH - 1.18, 0.006, std('#111', 0.5, 0.5), x, (SH + 1.18) / 2, Z0 + 0.3);
      const globeM = new T.MeshBasicMaterial({ color: '#3a3430', toneMapped: false });
      const g = new T.Mesh(new T.SphereGeometry(0.105, 32, 20), globeM); g.position.set(x, 1.08, Z0 + 0.3); scene.add(g);
      FX.bedside.push({ basic: globeM, base: new T.Color('#ffd7a3'), off: new T.Color('#3a3430') });
      const sp = new T.Sprite(new T.SpriteMaterial({ map: RAD, color: WARM, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); sp.scale.set(0.9, 0.9, 1); sp.position.copy(g.position); scene.add(sp); FX.bedside.push({ m: sp.material, k: 0.55 });
      const wash = plane(1.5, 1.5, glowMat(RAD, WARM), x, 1.1, Z0 + 0.075); FX.bedside.push({ m: wash.material, k: 0.4 });
      const p = new T.PointLight(WARM, 0, 4, 2); p.position.set(x, 1.0, Z0 + 0.42); scene.add(p); FX.bedside.push({ light: p, k: 2.4 });
    });

    // downlights (Downlight)
    const DL = [[-0.78, SH, Z0 + 0.28, true], [0.78, SH, Z0 + 0.28, true], [-1.5, H, 0.45, false], [1.5, H, 0.45, false]];
    DL.forEach(([x, y, z, graze]) => {
      const ring = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.01, 24), std('#cfcac2', 0.4, 0.3)); ring.position.set(x, y - 0.004, z); scene.add(ring);
      const discM = new T.MeshBasicMaterial({ color: '#2b2a28', toneMapped: false });
      const disc = new T.Mesh(new T.CircleGeometry(0.04, 24), discM); disc.rotation.x = Math.PI / 2; disc.position.set(x, y - 0.011, z); scene.add(disc);
      FX.down.push({ basic: discM, base: new T.Color('#fff1dc'), off: new T.Color('#2b2a28') });
      const sp = new T.Sprite(new T.SpriteMaterial({ map: RAD, color: '#ffe3bd', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); sp.scale.set(0.42, 0.42, 1); sp.position.set(x, y - 0.03, z); scene.add(sp); FX.down.push({ m: sp.material, k: 0.7 });
      const s = new T.SpotLight('#ffd6a6', 0, 7, 0.5, 0.75, 2); s.position.set(x, y - 0.02, z); s.target.position.set(x, 0, z + (graze ? 0.25 : 0)); scene.add(s, s.target); FX.down.push({ light: s, k: graze ? 9 : 14 });
      if (graze) { const sc = plane(1.0, 2.2, glowMat(SCAL, '#ffcf96'), x, SH - 1.1, Z0 + 0.075); FX.down.push({ m: sc.material, k: 0.55 }); }
    });

    // walk-in closet along the left wall (Walk-in Closet)
    const cw = std('#2c221b', 0.75), cx0 = X0 + 0.015, depth = 0.62, cz0 = -2.75, cz1 = 0.55, cH = 2.45;
    box(0.03, cH, cz1 - cz0, std('#3a2e25', 0.8), cx0, cH / 2, (cz0 + cz1) / 2);
    box(depth, 0.06, cz1 - cz0, cw, X0 + depth / 2, cH, (cz0 + cz1) / 2);
    box(depth, 0.1, cz1 - cz0, cw, X0 + depth / 2, 0.05, (cz0 + cz1) / 2);
    const divs = [cz0, cz0 + 1.1, cz0 + 2.2, cz1];
    divs.forEach((z) => box(depth, cH, 0.035, cw, X0 + depth / 2, cH / 2, z));
    // shelves + folded stacks in bay 1
    const fold = ['#c9c1b4', '#6f6559', '#9aa0a6', '#d8d2c6', '#4d4a47'];
    [0.45, 0.85, 1.25, 1.65, 2.05].forEach((y, r) => { box(depth - 0.04, 0.025, 1.06, cw, X0 + depth / 2, y, cz0 + 0.55); for (let k = 0; k < 3; k++) box(0.34, 0.12, 0.28, std(fold[(r + k) % 5], 0.95), X0 + 0.3, y + 0.075, cz0 + 0.22 + k * 0.33); });
    // hanging bays 2 + 3
    const cloth = ['#ddd6cb', '#6e6458', '#2f3135', '#a49a8c', '#e9e5de', '#55606b', '#8a7563', '#c8c2b8'];
    [[cz0 + 1.1, 1.95, 1.0], [cz0 + 2.2, 1.95, 1.35]].forEach(([za, y, len]) => {
      box(0.02, 0.02, 1.06, std('#b9b4ac', 0.3, 0.8), X0 + 0.33, y, za + 0.55);
      for (let k = 0; k < 13; k++) { const h = len * (0.75 + Math.random() * 0.3); box(0.42, h, 0.035, std(cloth[(k * 3) % 8], 0.95), X0 + 0.33, y - h / 2 - 0.02, za + 0.08 + k * 0.073); }
    });
    box(depth - 0.04, 0.5, 1.06, cw, X0 + depth / 2, 0.36, cz0 + 2.75);
    // LED profiles on the dividers + closet light
    divs.forEach((z, i) => { const m = new T.MeshBasicMaterial({ color: '#2b2622', toneMapped: false }); const s = box(0.012, cH - 0.2, 0.012, m, X0 + depth - 0.02, cH / 2, z + (i === divs.length - 1 ? -0.025 : 0.025)); FX.closet.push({ basic: m, base: new T.Color('#fff0d8'), off: new T.Color('#2b2622') }); s.renderOrder = 1; });
    [cz0 + 0.55, cz0 + 1.65, cz0 + 2.75].forEach((z) => {
      const p = new T.PointLight(CLOS, 0, 2.6, 2); p.position.set(X0 + 0.5, 1.45, z); scene.add(p); FX.closet.push({ light: p, k: 1.5 });
      const w = plane(1.1, 2.4, glowMat(RAD, CLOS), X0 + 0.035, 1.3, z, 0, Math.PI / 2); FX.closet.push({ m: w.material, k: 0.35 });
    });
    const spill = plane(1.6, 3.6, glowMat(RAD, CLOS), X0 + 0.75, 0.004, (cz0 + cz1) / 2, -Math.PI / 2); FX.closet.push({ m: spill.material, k: 0.35 });

    // window + sheer curtains on the right wall
    plane(3.3, 2.3, new T.MeshBasicMaterial({ map: gradTex('sky'), toneMapped: false }), X1 - 0.01, 1.35, -0.35, 0, -Math.PI / 2);
    box(0.06, 0.05, 3.4, std('#1c1b1a', 0.6, 0.3), X1 - 0.03, 2.52, -0.35); box(0.06, 0.05, 3.4, std('#1c1b1a', 0.6, 0.3), X1 - 0.03, 0.18, -0.35);
    const curtM = new T.MeshStandardMaterial({ color: '#cfc9bf', roughness: 1, transparent: true, opacity: 0.62, side: T.DoubleSide });
    [[-1.65, 1.1], [0.95, 1.2]].forEach(([z, w]) => {
      const g = new T.PlaneGeometry(w, 2.55, 48, 1); const pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 22) * 0.045);
      g.computeVertexNormals(); const c = new T.Mesh(g, curtM); c.rotation.y = -Math.PI / 2; c.position.set(X1 - 0.16, 1.33, z); scene.add(c);
    });
    // armchair by the window
    const ac = std('#5b5149', 0.95);
    box(0.78, 0.38, 0.75, ac, X1 - 0.95, 0.27, 1.1); box(0.14, 0.42, 0.75, ac, X1 - 0.6, 0.62, 1.1); box(0.78, 0.2, 0.12, ac, X1 - 0.95, 0.52, 0.78); box(0.78, 0.2, 0.12, ac, X1 - 0.95, 0.52, 1.42);

    // Simon 4-gang plate on the wall next to the headboard
    plateMat = std(FINISH[S.finish].hex, 0.45, 0.1);
    box(0.172, 0.086, 0.012, plateMat, -2.2, 1.12, Z0 + 0.006);
    for (let i = 0; i < 4; i++) { const m = new T.MeshBasicMaterial({ color: '#333', toneMapped: false }); const d = new T.Mesh(new T.CircleGeometry(0.0035, 12), m); d.position.set(-2.2 - 0.06 + i * 0.04, 1.095, Z0 + 0.0135); scene.add(d); plateDots.push(m); }

    // ambient night + moonlight
    scene.add(new T.HemisphereLight('#4a5368', '#1d1813', 0.55));
    const moon = new T.DirectionalLight('#7f95c4', 0.5); moon.position.set(6, 2.5, -0.6); scene.add(moon);
    const fill = new T.PointLight('#8aa0c8', 0.6, 6, 2); fill.position.set(X1 - 0.6, 1.4, -0.3); scene.add(fill);
  }

  function frameCamera() {
    if (!renderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    const a = w / h; camera.aspect = a;
    camera.fov = a < 1.4 ? 58 : 48;
    camera.position.set(0.85, 1.5, a < 1.4 ? 3.05 : 2.95);
    camera.lookAt(-0.35, 1.02, -2.6);
    camera.updateProjectionMatrix();
    needs = 2;
  }

  const curve = (v) => Math.pow(v, 1.35);
  function applyLights() {
    const groups = [FX.strip, FX.down, FX.closet, FX.bedside];
    groups.forEach((list, gi) => {
      const v = curve(disp[gi]);
      list.forEach((f) => {
        if (f.light) f.light.intensity = f.k * v * (f.light.isSpotLight ? 1 : 1);
        else if (f.m) f.m.opacity = f.k * v;
        else if (f.basic) { if (f.off) f.basic.color.copy(f.off).lerp(f.base, Math.min(1, v * 1.6)); else f.basic.color.copy(f.base).multiplyScalar(0.15 + v * 1.4); }
      });
    });
    plateDots.forEach((m, i) => m.color.set(S.armed[i] ? '#ffe9c6' : (S.finish === 'white' || S.finish === 'champ' ? '#b9b3a8' : '#3a3a3a')));
  }

  /* =========================================================
     UI
     ========================================================= */
  const segs = $$('.seg'), dots = $$('.seg-dot'), dimmer = $('#dimmer'), sceneSw = $('#sceneSwitch');
  const levelEls = $$('[data-level]'), legendEls = $$('[data-legend]');
  const quads = $$('.quad'), rows = $('#sceneRows');

  function sig(type, detail) { window.dispatchEvent(new CustomEvent('scene-guide', { detail: Object.assign({ type }, detail || {}) })); }

  function renderUI() {
    segs.forEach((el, i) => {
      const on = !!S.armed[i], v = S.levels[i], n = on && v > 0 ? Math.max(1, Math.min(7, Math.ceil(v / (100 / 7)))) : 0;
      $$('.seg-dots i', el).forEach((d, k) => d.classList.toggle('on', k < n));
      el.setAttribute('aria-valuenow', on ? v : 0); el.setAttribute('aria-valuetext', on ? `${v}%` : 'Off');
      dots[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      levelEls[i].textContent = on ? `${v}%` : 'Off'; levelEls[i].classList.toggle('on', on);
      if (legendEls[i]) { legendEls[i].querySelector('b').textContent = on ? `${v}%` : 'Off'; legendEls[i].classList.toggle('on', on && v > 0); }
    });
    dimmer.dataset.finish = sceneSw.dataset.finish = S.finish;
    $('#finishName').textContent = FINISH[S.finish].name;
    $$('.sc-swatches .sw').forEach((b) => b.classList.toggle('on', b.dataset.finish === S.finish));
    quads.forEach((q) => { q.classList.toggle('on', q.dataset.slot === S.slot); q.classList.toggle('saved', !!S.scenes[q.dataset.slot]); q.setAttribute('aria-pressed', q.dataset.slot === S.slot ? 'true' : 'false'); });
    $('#activeSlot').textContent = S.slot;
    const sc = S.scenes[S.slot];
    $('#sceneTag').textContent = `Scene ${S.slot}${sc ? ' · ' + sc.name : ''}${S.edited ? ' · edited' : ''}`;
    if (plateMat) plateMat.color.set(FINISH[S.finish].hex);
    renderTable();
    needs = Math.max(needs, 2);
  }

  function renderTable() {
    rows.innerHTML = 'ABCD'.split('').map((slot) => {
      const s = S.scenes[slot];
      if (!s) return `<tr data-row="${slot}" class="${slot === S.slot ? 'on' : ''}"><td><span class="slot-badge">${slot}</span></td><td class="empty">Empty</td><td class="empty">–</td>${LIGHTS.map(() => '<td class="empty">–</td>').join('')}</tr>`;
      const cells = s.levels.map((v, i) => { const on = s.armed[i] && v > 0; return `<td><span class="lvl ${on ? 'on' : ''}"><i style="--v:${on ? v : 0}%"></i>${on ? v + '%' : 'Off'}</span></td>`; }).join('');
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      return `<tr data-row="${slot}" class="${slot === S.slot ? 'on' : ''}" tabindex="0" aria-label="Recall scene ${slot}: ${esc(s.name)}"><td><span class="slot-badge">${slot}</span></td><td>${esc(s.name)}</td><td><span class="fin" style="--c:${FINISH[s.finish].hex}"><i></i>${FINISH[s.finish].name}</span></td>${cells}</tr>`;
    }).join('');
  }

  function applyScene(slot) {
    const s = S.scenes[slot]; if (!s) return;
    S.levels = s.levels.slice(); S.armed = s.armed.map((a) => (a ? 1 : 0)); S.finish = s.finish; S.edited = false;
  }
  function selectSlot(slot) { S.slot = slot; applyScene(slot); renderUI(); sig('slot', { slot }); }
  function edited() { S.edited = true; }

  // dimmer: tap the dot to toggle, swipe a key to dim
  dots.forEach((d, i) => d.addEventListener('click', (e) => {
    e.stopPropagation();
    S.armed[i] = S.armed[i] ? 0 : 1; if (S.armed[i] && S.levels[i] <= 0) S.levels[i] = 35;
    edited(); renderUI(); sig('armed', { i, on: !!S.armed[i] });
  }));
  segs.forEach((el, i) => {
    let y0 = null, v0 = 0, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.seg-dot')) return;
      e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('dragging');
      if (!S.armed[i]) { S.armed[i] = 1; if (S.levels[i] <= 0) S.levels[i] = 35; edited(); renderUI(); sig('armed', { i, on: true }); }
      y0 = e.clientY; v0 = S.levels[i]; moved = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      const px = el.clientHeight * 0.85 / 100;
      const nv = clamp(Math.round(v0 + (y0 - e.clientY) / px), 0, 100);
      if (Math.abs(y0 - e.clientY) > 3) moved = true;
      if (nv !== S.levels[i]) { S.levels[i] = nv; edited(); renderUI(); sig('dimmer', { i, v: nv }); }
    });
    const end = () => { if (y0 == null) return; y0 = null; el.classList.remove('dragging'); if (moved && S.levels[i] === 0) { S.armed[i] = 0; renderUI(); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 5; let v = S.levels[i], handled = true;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v += step; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v -= step;
      else if (e.key === 'Home') v = 0; else if (e.key === 'End') v = 100;
      else if (e.key === 'Enter' || e.key === ' ') { dots[i].click(); e.preventDefault(); return; } else handled = false;
      if (!handled) return; e.preventDefault();
      S.levels[i] = clamp(v, 0, 100); S.armed[i] = S.levels[i] > 0 ? 1 : 0; edited(); renderUI(); sig('dimmer', { i, v: S.levels[i] });
    });
  });

  // customize (finish)
  const cBtn = $('.customize-btn'), sw = $('#swatches');
  cBtn.addEventListener('click', () => { const open = sw.hidden; sw.hidden = !open; cBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); });
  $$('.sc-swatches .sw').forEach((b) => b.addEventListener('click', () => { S.finish = b.dataset.finish; edited(); renderUI(); sig('variant', { finish: S.finish }); }));

  // scene switch + table
  quads.forEach((q) => q.addEventListener('click', () => selectSlot(q.dataset.slot)));
  rows.addEventListener('click', (e) => { const r = e.target.closest('[data-row]'); if (r) { selectSlot(r.dataset.row); $('#studio').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); } });
  rows.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; const r = e.target.closest('[data-row]'); if (r) selectSlot(r.dataset.row); });
  $('#resetScenes').addEventListener('click', () => { S.scenes = clone(DEFAULTS); persist(); selectSlot(S.slot); });

  // save modal
  const modal = $('#saveModal'), nameIn = $('#sceneName');
  let lastFocus = null;
  function openModal() {
    lastFocus = document.activeElement;
    $('#saveSlot').textContent = S.slot;
    const cur = S.scenes[S.slot]; nameIn.value = cur && !/^(All On|All Off)$/.test(cur.name) ? cur.name : '';
    $('#saveSummary').innerHTML = `${FINISH[S.finish].name} finish · ` + LIGHTS.map((n, i) => `${n} ${S.armed[i] ? S.levels[i] + '%' : 'off'}`).join(' · ');
    modal.hidden = false; setTimeout(() => nameIn.focus(), 30); sig('open-save');
  }
  function closeModal() { modal.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  $('.save-btn').addEventListener('click', openModal);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  $('.sc-modal-card').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = (nameIn.value || '').trim() || `Scene ${S.slot}`;
    S.scenes[S.slot] = { name: name.slice(0, 24), finish: S.finish, levels: S.levels.slice(), armed: S.armed.slice() };
    S.edited = false; persist(); closeModal(); renderUI(); sig('save', { slot: S.slot });
  });

  /* ---------------- guided tour ---------------- */
  const STEPS = [
    { sel: '#sceneSwitch', label: 'Buttons A / B / C / D', copy: 'One tap changes the whole mood. Try another scene button.', action: 'slot' },
    { sel: '.seg-3 .seg-dot', label: 'Bottom dot', copy: 'Tap the dot at the bottom of a key to switch that light on or off.', action: 'armed' },
    { sel: '.seg-3', label: 'Swipe up / down', copy: 'Swipe up on the key to brighten, swipe down to dim. Watch the closet light follow.', action: 'dimmer' },
    { sel: '.customize-btn', label: 'Customize', copy: 'Pick the Simon finish that suits your interior: White, Champagne, Dark Grey, Black Doff or Mocha.', action: 'variant', before: () => { if (sw.hidden) cBtn.click(); }, target2: '#swatches' },
    { sel: '.save-btn', label: 'Save Scenario', copy: 'Happy with the mood? Tap Save Scenario to store it on the active button.', action: 'open-save', before: () => { if (!modal.hidden) closeModal(); } },
    { sel: '.sc-modal-card', label: 'Scenario name', copy: 'Give it a name (e.g. Movie, Relax, Night), then tap Save.', action: 'save', before: () => { if (modal.hidden) openModal(); } },
    { sel: '#sceneSwitch', label: 'Scene buttons', copy: 'Choose another button to set up, or tap a saved one to bring its scene back.', action: 'slot', before: () => { if (!modal.hidden) closeModal(); } },
  ];
  const G = $('#guide'), marker = $('#guideMarker'), gCopy = $('#guideCopy'), gNum = $('#guideNum'), gNext = $('[data-guide-next]'), gBack = $('[data-guide-back]');
  $('#guideTotal').textContent = STEPS.length;
  let gi = -1, gTarget = null, gLock = false;
  function placeMarker() {
    if (gi < 0 || !gTarget) return;
    const st = STEPS[gi]; let r = gTarget.getBoundingClientRect();
    if (st.target2) { const t2 = $(st.target2); if (t2 && !t2.hidden) { const r2 = t2.getBoundingClientRect(); r = { left: Math.min(r.left, r2.left), top: Math.min(r.top, r2.top), right: Math.max(r.right, r2.right), bottom: Math.max(r.bottom, r2.bottom) }; } }
    const pad = 10, w = r.right - r.left, h = r.bottom - r.top;
    Object.assign(marker.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${w + pad * 2}px`, height: `${Math.max(40, h + pad * 2)}px` });
    marker.hidden = false;
    G.classList.toggle('top', r.top + h / 2 > innerHeight * 0.55);
  }
  function showStep(i) {
    gi = i; gLock = false; const st = STEPS[i];
    if (st.before) st.before();
    gNum.textContent = i + 1; gCopy.textContent = st.copy; marker.querySelector('span').textContent = st.label;
    gBack.style.visibility = i === 0 ? 'hidden' : 'visible';
    gNext.textContent = i === STEPS.length - 1 ? 'Finish' : 'Next';
    gTarget = $(st.sel);
    if (gTarget) gTarget.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    marker.hidden = true; setTimeout(placeMarker, 60); setTimeout(placeMarker, 600);
  }
  function openGuide() { G.hidden = false; showStep(0); }
  function closeGuide() { G.hidden = true; gi = -1; marker.hidden = true; store.set(GUIDE_KEY, '1'); if (!modal.hidden) closeModal(); }
  function advance() { if (gLock) return; gLock = true; setTimeout(() => { if (gi >= STEPS.length - 1) closeGuide(); else showStep(gi + 1); }, 650); }
  gNext.addEventListener('click', () => { if (gi >= STEPS.length - 1) closeGuide(); else showStep(gi + 1); });
  gBack.addEventListener('click', () => { if (gi > 0) showStep(gi - 1); });
  $('[data-guide-skip]').addEventListener('click', closeGuide);
  $('#guideStart').addEventListener('click', openGuide);
  window.addEventListener('scene-guide', (e) => { if (gi < 0) return; if (e.detail.type === STEPS[gi].action) advance(); });
  addEventListener('scroll', () => { if (gi >= 0) placeMarker(); }, { passive: true });

  /* ---------------- loop ---------------- */
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (gi >= 0) placeMarker();
    if (!renderer) return;
    const f = reduced ? 1 : 1 - Math.exp(-dt * 6);
    let moving = false;
    for (let i = 0; i < 4; i++) { const t = eff(i), d = t - disp[i]; if (Math.abs(d) > 0.002) { disp[i] += d * f; moving = true; } else disp[i] = t; }
    if (moving || needs > 0) { applyLights(); renderer.render(scene, camera); needs = Math.max(0, needs - 1); }
  }

  // init
  try { buildRoom(); } catch (e) { renderer = null; $('#stage').classList.add('no-gl'); }
  applyScene(S.slot);
  for (let i = 0; i < 4; i++) disp[i] = eff(i);
  renderUI(); frameCamera();
  if (window.ResizeObserver) new ResizeObserver(() => frameCamera()).observe(canvas); else addEventListener('resize', frameCamera);
  requestAnimationFrame(loop);
  const forced = /[?&]guide=1/.test(location.search);
  if (forced || (!store.get(GUIDE_KEY) && !/[?&]snap/.test(location.search))) setTimeout(openGuide, 1200);

  /* keep the current series visible in the scrollable series nav (phones) */
  const on = $('.nav-series .on'); if (on) on.parentNode.scrollLeft = on.offsetLeft - on.parentNode.offsetLeft - on.parentNode.clientWidth / 2 + on.offsetWidth / 2;
  window.__scene = { S, selectSlot, render: () => { needs = 2; } };
})();
