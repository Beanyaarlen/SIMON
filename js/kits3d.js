/* =========================================================================
   Simon exploded-view kits — one per series, each modelled on the parts
   shown in that series' own Simon brochure (1 unit = 10 mm).
   Used by the "Highlights" story (story3d.js) and the product tour (product.js).
   ========================================================================= */
(function (global) {
  'use strict';
  const T = THREE;
  const { rrect, keyGeometry } = global.Switch3D.helpers;
  const D = (() => { try { return JSON.parse(document.getElementById('series-data').textContent); } catch (e) { return {}; } })();
  const MODEL = D.model || {};
  const FI = D.defaults && D.finishes && D.finishes[D.defaults.finish] ? D.defaults.finish : 0;
  const FIN = (D.finishes && D.finishes[FI] && D.finishes[FI].hex) || '#eeeeec';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  /* ---------------- materials ---------------- */
  function mats() {
    return {
      pc: new T.MeshPhysicalMaterial({ color: new T.Color(FIN), roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
      white: new T.MeshPhysicalMaterial({ color: 0xf1f1ef, roughness: 0.5, clearcoat: 0.15 }),
      inner: new T.MeshStandardMaterial({ color: 0xd9dadb, roughness: 0.65 }),
      grey: new T.MeshStandardMaterial({ color: 0x9da1a7, roughness: 0.55 }),
      hole: new T.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.9, side: T.DoubleSide }),
      steel: new T.MeshPhysicalMaterial({ color: 0xc9ccd2, metalness: 0.95, roughness: 0.3, envMapIntensity: 1.3 }),
      zinc: new T.MeshPhysicalMaterial({ color: 0xaeb3ba, metalness: 0.85, roughness: 0.42 }),
      copper: new T.MeshPhysicalMaterial({ color: 0xd08a5c, metalness: 1, roughness: 0.28, envMapIntensity: 1.3 }),
      brass: new T.MeshPhysicalMaterial({ color: 0xd6b06a, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 }),
      silver: new T.MeshPhysicalMaterial({ color: 0xeef0f3, metalness: 1, roughness: 0.15 }),
      slot: new T.MeshBasicMaterial({ color: 0x2a2b2e }),
      ind: new T.MeshBasicMaterial({ color: 0xffffff }),
    };
  }
  let LOGO = null;
  function logoTex() {
    if (LOGO) return LOGO;
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.font = '700 40px Archivo, Arial, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText('simon', 250, 32);
    LOGO = new T.CanvasTexture(c); LOGO.colorSpace = T.SRGBColorSpace; return LOGO;
  }

  /* ---------------- geometry helpers ---------------- */
  // key layout for the current gang count: vertical strips, or 2 x 2 for a 4-gang push-button (i7 · KHO)
  let GANG = 1;
  function rects(A, layout, gap) {
    const n = GANG; gap = gap == null ? 0.06 : gap;
    if (n <= 1) return [[0, 0, A, A]];
    if (layout === 'grid' && n === 4) { const w = (A - gap) / 2, o = w / 2 + gap / 2; return [[-o, o, w, w], [o, o, w, w], [-o, -o, w, w], [o, -o, w, w]]; }
    const w = (A - gap * (n - 1)) / n; return Array.from({ length: n }, (_, i) => [-A / 2 + w / 2 + i * (w + gap), 0, w, A]);
  }
  function keys(g, A, d, r, m, layout) { rects(A, layout).forEach(([x, y, w, h]) => g.add(slab(w, h, d, GANG > 1 ? Math.min(r, 0.1) : r, m, x, y, 0))); }

  const mesh = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); return o; };
  const box = (w, h, d, m, x, y, z) => mesh(new T.BoxGeometry(w, h, d), m, x, y, z);
  // rounded slab whose front face sits at z (extends backwards by d)
  const slab = (w, h, d, r, m, x, y, z) => mesh(keyGeometry(w, h, d, r, Math.min(0.04, d / 3)), m, x, y, z);
  // rectangular ring (frame / tray rim) of depth d, front at z
  function ring(w, h, t, d, r, m, z) {
    const s = rrect(w, h, r); s.holes.push(rrect(w - 2 * t, h - 2 * t, Math.max(0.02, r - t), 0, 0, T.Path));
    const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, -d - 0.02 + (z || 0)); return new T.Mesh(g, m);
  }
  const cyl = (r, h, m, axis, seg) => { const g = new T.CylinderGeometry(r, r, h, seg || 24); if (axis === 'z') g.rotateX(Math.PI / 2); if (axis === 'x') g.rotateZ(Math.PI / 2); return new T.Mesh(g, m); };
  // flat dark disc that reads as a hole, facing +z (or -z)
  function hole(r, m, x, y, z, back, sx, sy) { const g = new T.CircleGeometry(r, 28); if (back) g.rotateY(Math.PI); const o = mesh(g, m, x, y, z); o.scale.set(sx || 1, sy || 1, 1); return o; }
  // snap clip: a flat tab with a square window, standing out of a plate
  function clip(m, w, h, t) {
    const s = rrect(w, h, 0.05); s.holes.push(rrect(w * 0.52, h * 0.5, 0.03, 0, 0, T.Path));
    const g = new T.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -t / 2); g.rotateY(Math.PI / 2);
    return new T.Mesh(g, m);
  }
  // pan-head screw along +y (head on top), with a cross slot and thread rings
  function screw(M, len) {
    const g = new T.Group();
    const head = new T.Mesh(new T.CylinderGeometry(0.33, 0.35, 0.2, 28), M.steel); head.position.y = len / 2 + 0.1; g.add(head);
    const dome = new T.Mesh(new T.SphereGeometry(0.33, 24, 8, 0, Math.PI * 2, 0, 0.55), M.steel); dome.scale.y = 0.45; dome.position.y = len / 2 + 0.2; g.add(dome);
    g.add(box(0.5, 0.06, 0.07, M.slot, 0, len / 2 + 0.33, 0)); g.add(box(0.07, 0.06, 0.5, M.slot, 0, len / 2 + 0.33, 0));
    const sh = cyl(0.15, len, M.zinc, 'y', 16); g.add(sh);
    for (let i = 0; i < 6; i++) { const th = new T.Mesh(new T.TorusGeometry(0.15, 0.03, 6, 18), M.zinc); th.rotation.x = Math.PI / 2; th.position.y = len / 2 - 0.15 - i * (len - 0.25) / 6; g.add(th); }
    return g;
  }
  // coil spring along +z
  function spring(M, r, len, turns, tube) {
    const pts = []; const N = turns * 20;
    for (let i = 0; i <= N; i++) { const a = (i / 20) * Math.PI * 2; pts.push(new T.Vector3(Math.cos(a) * r, Math.sin(a) * r, -len / 2 + (len * i) / N)); }
    return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), N, tube, 6, false), M.steel);
  }
  // terminal assembly: steel clamp with wire entry, vertical screw, copper strip with a silver contact
  function terminal(M, up, clampMat) {
    const g = new T.Group();
    const c = slab(0.82, 0.78, 0.82, 0.06, clampMat || M.zinc, 0, 0, 0.41); g.add(c);
    g.add(box(0.46, 0.4, 0.02, M.slot, 0, 0, -0.42));            // wire entry (back)
    const s = screw(M, 1.25); s.position.y = up ? 0.45 : -0.45; if (!up) s.rotation.z = Math.PI; g.add(s);
    // copper strip: out of the clamp, forward, then bent towards the base
    const k = up ? -1 : 1;
    g.add(box(0.5, 0.08, 1.1, M.copper, 0, k * 0.25, 0.9));
    g.add(box(0.5, 0.62, 0.08, M.copper, 0, k * 0.25 - k * 0.27, 1.43));
    const ct = cyl(0.15, 0.08, M.silver, 'z', 24); ct.position.set(0, k * 0.25 - k * 0.48, 1.5); g.add(ct);
    g.userData.contact = ct; g.userData.screw = s;
    return g;
  }

  /* ---------------- J-type kit (M3 · E3 · E6) ---------------- */
  function buildJ(M, twin) {
    const A = MODEL.area || 8.5, rr = MODEL.rockerRadius || 0.12;
    const parts = {};
    // rocker: PC panel, recessed back rim, logo
    { const g = new T.Group();
      keys(g, A, 0.3, rr, M.pc, 'v');
      g.add(ring(A - 0.12, A - 0.12, 0.22, 0.24, Math.max(0.04, rr - 0.06), M.pc, -0.3));
      g.add(box(0.5, 4.2, 0.2, M.pc, -1.6, 0, -0.42)); g.add(box(0.5, 4.2, 0.2, M.pc, 1.6, 0, -0.42));   // back latches
      if (MODEL.indicator !== false && (MODEL.indStyle || 'bar') === 'bar') rects(A, 'v').forEach(([x, y, w, h]) => g.add(box(0.075, 0.46, 0.01, M.ind, x - w / 2 + 0.34, y + h / 2 - 0.6, 0.005)));
      const lg = mesh(new T.PlaneGeometry(0.8, 0.2), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.28, depthWrite: false }), A / 2 - 0.62, -A / 2 + 0.36, 0.006); g.add(lg);
      parts.rocker = { g, a: [0, 0.35, 0], asm: [0, 0, 0.6], ex: [0, 0.5, 10.6] }; }
    // base plate: tray open to the back, mounting holes, rails, T-slot, actuator, snap clips
    { const g = new T.Group(), P = 8.6;
      g.add(slab(P, P, 0.22, 0.16, M.white, 0, 0, 0));
      g.add(ring(P, P, 0.3, 0.62, 0.16, M.white, -0.22));
      const zb = -0.225;
      g.add(hole(0.3, M.hole, 0, 3.0, zb, true)); g.add(hole(0.3, M.hole, 0, -3.0, zb, true));
      g.add(hole(0.3, M.hole, -2.55, 0, zb, true, 0.75, 1.5)); g.add(hole(0.3, M.hole, 2.55, 0, zb, true, 0.75, 1.5));
      g.add(box(0.16, 5.0, 0.5, M.inner, -0.72, 0, -0.47)); g.add(box(0.16, 5.0, 0.5, M.inner, 0.72, 0, -0.47));
      g.add(box(1.6, 0.24, 0.4, M.inner, 0, 1.5, -0.42)); g.add(box(0.4, 0.9, 0.4, M.inner, 0, 1.0, -0.42));
      g.add(box(0.55, 2.0, 0.7, M.grey, 0, -0.7, -0.57));                       // rocker actuator
      g.add(box(0.36, 0.5, 0.36, M.inner, 0, -2.0, -0.5));
      const c1 = clip(M.white, 1.0, 0.9, 0.12); c1.position.set(-1.9, 1.15, -0.72); g.add(c1);
      const c2 = clip(M.white, 1.0, 0.9, 0.12); c2.position.set(-1.9, -1.3, -0.72); g.add(c2);
      for (let i = 0; i < 6; i++) g.add(box(0.06, 0.06, 0.02, M.grey, 2.9, -2.4 + i * 0.22, zb));   // moulded marks
      parts.base = { g, a: [-2.6, -2.6, -0.2], asm: [0, 0, 0], ex: [0, 0, 5.8] }; }
    if (twin) return parts;
    // J-type toggle: copper rod, coil spring, plastic plunger
    { const g = new T.Group();
      const rod = cyl(0.045, 3.0, M.copper, 'z', 10); g.add(rod);
      const tip = box(0.32, 0.06, 0.4, M.copper, 0, -0.05, -1.65); tip.rotation.x = 0.4; g.add(tip);
      const sp = spring(M, 0.14, 1.3, 11, 0.022); sp.position.z = -0.3; g.add(sp);
      g.add(box(0.42, 0.42, 1.0, M.grey, 0, 0, 1.15)); g.add(box(0.6, 0.18, 0.3, M.grey, 0, 0, 1.55));
      g.rotation.x = 0.06;
      parts.lever = { g, a: [0, 0, 0.2], asm: [0, -0.4, -1.0], ex: [0, -0.2, 2.4] }; }
    // two terminal assemblies
    { const g = new T.Group();
      const tU = terminal(M, true); tU.position.set(0, 1.05, 0); g.add(tU);
      const tL = terminal(M, false); tL.position.set(0, -1.05, 0); g.add(tL);
      parts.contacts = { g, obj: tU.userData.contact, a: [0, 0, 0], asm: [0.5, 0, -1.5], ex: [0.3, 0.1, -1.2] };
      parts.terminals = { g: null, obj: tL, a: [0, -0.2, 0] }; parts.contacts.spin = [tU.userData.screw, tL.userData.screw]; }
    // mechanism housing: open box with partitions and side windows; it turns to show its inside
    { const g = new T.Group(), W = 3.6, H = 5.8, Dp = 2.2, t = 0.16;
      const inner = new T.Group(); g.add(inner);
      inner.add(box(W, H, t, M.white, 0, 0, -Dp + t / 2));
      inner.add(box(t, H, Dp, M.white, -W / 2 + t / 2, 0, -Dp / 2)); inner.add(box(t, H, Dp, M.white, W / 2 - t / 2, 0, -Dp / 2));
      inner.add(box(W, t, Dp, M.white, 0, H / 2 - t / 2, -Dp / 2)); inner.add(box(W, t, Dp, M.white, 0, -H / 2 + t / 2, -Dp / 2));
      inner.add(box(t, H - 0.3, Dp - 0.3, M.inner, 0.3, 0, -Dp / 2 - 0.15));
      inner.add(box(W / 2 - 0.1, t, Dp - 0.4, M.inner, -W / 4, 0.95, -Dp / 2 - 0.2)); inner.add(box(W / 2 - 0.1, t, Dp - 0.4, M.inner, -W / 4, -0.95, -Dp / 2 - 0.2));
      inner.add(box(0.5, 0.6, 0.6, M.inner, 1.1, 1.6, -1.6)); inner.add(box(0.5, 0.6, 0.6, M.inner, 1.1, -1.6, -1.6));
      [[1.6], [-0.4], [-2.2]].forEach(([y]) => inner.add(box(0.02, 0.45, 0.45, M.hole, -W / 2 - 0.005, y, -1.2)));
      inner.add(box(W + 0.02, 0.5, 0.4, M.white, 0, H / 2 - 0.25, -0.05));   // stepped top edge
      inner.add(hole(0.18, M.hole, 0, -H / 2 + 0.1, -1.1, false));
      parts.mech = { g, inner, a: [-W / 2, 0.6, -0.8], asm: [0, 0, -1.0], ex: [0, -0.5, -5.4], turn: -1.1 }; }
    return parts;
  }

  /* ---------------- M1 kit ---------------- */
  function buildM1(M) {
    const parts = {};
    { const g = new T.Group(), A = 8.6, rr = 0.34;
      keys(g, A, 0.42, rr, M.pc, 'v');
      g.add(ring(A - 0.4, A - 0.4, 0.2, 0.24, 0.2, M.pc, -0.42));
      const lg = mesh(new T.PlaneGeometry(0.8, 0.2), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.28, depthWrite: false }), A / 2 - 0.62, -A / 2 + 0.36, 0.006); g.add(lg);
      parts.rocker = { g, a: [0, 0.4, 0], asm: [0, 0, 1.05], ex: [0.2, 0.6, 12.8] }; }
    { const g = new T.Group();
      g.add(ring(7.3, 8.2, 0.42, 0.55, 0.12, M.pc, 0));
      [[-3.0, 0], [3.0, 0]].forEach(([x, y]) => g.add(box(0.3, 0.9, 0.35, M.white, x * 0.97, y, -0.5)));
      parts.frame = { g, a: [3.4, 3.6, 0], asm: [0, 0, 0.6], ex: [0, 0.3, 8.8] }; }
    { const g = new T.Group();
      g.add(slab(2.8, 3.4, 1.5, 0.12, M.white, 0, 0, 0));
      g.add(slab(1.1, 1.7, 0.4, 0.06, M.grey, 0.2, 0.1, 0.02));
      g.add(box(0.5, 0.9, 0.12, M.steel, 0.3, 0.15, 0.06));
      const c1 = clip(M.white, 0.9, 0.8, 0.12); c1.position.set(-1.55, 0.9, -0.6); g.add(c1);
      const c2 = clip(M.white, 0.9, 0.8, 0.12); c2.position.set(-1.55, -0.9, -0.6); g.add(c2);
      g.add(box(0.06, 0.25, 0.02, M.grey, 0.95, 1.4, 0.01)); g.add(box(0.2, 0.2, 0.02, M.grey, 1.2, 1.4, 0.01));
      parts.lever = { g, a: [0.2, -0.6, 0], asm: [0, 0, 0.1], ex: [0, -0.1, 5.2] }; }
    { const g = new T.Group();
      [1, -1].forEach((k) => {
        const s = screw(M, 1.0); s.position.y = k * 1.25; if (k < 0) s.rotation.z = Math.PI; g.add(s);
        g.add(slab(0.62, 0.55, 0.6, 0.05, M.zinc, 0, k * 0.65, 0.3));
      });
      const b1 = box(0.36, 0.6, 0.1, M.brass, 0.05, 0.05, 0.1); b1.rotation.z = 0.35; g.add(b1);
      g.add(box(0.5, 0.12, 0.3, M.brass, 0.1, -0.25, 0.1));
      g.rotation.y = -0.3;
      parts.contacts = { g, a: [0, 0, 0], asm: [0, 0, -0.5], ex: [0, 0, 1.4] }; }
    { const g = new T.Group(), P = 8.0;
      g.add(slab(P, P, 0.3, 0.2, M.white, 0, 0, -0.5));
      g.add(ring(P, P, 0.3, 0.5, 0.2, M.white, 0));
      g.add(slab(3.2, 3.9, 0.02, 0.1, M.hole, 0, -0.2, -0.48));
      g.add(box(0.6, 3.4, 0.5, M.grey, -0.55, -0.2, -0.7)); g.add(box(0.6, 3.4, 0.5, M.grey, 0.55, -0.2, -0.7));
      g.add(ring(3.6, 4.3, 0.22, 0.25, 0.08, M.inner, -0.25));
      g.add(hole(0.32, M.hole, 0, 2.95, -0.49)); g.add(hole(0.32, M.hole, 0, -2.95, -0.49));
      g.add(hole(0.3, M.hole, -2.55, 0.1, -0.49, false, 0.75, 1.4)); g.add(hole(0.3, M.hole, 2.55, 0.1, -0.49, false, 0.75, 1.4));
      const lg = mesh(new T.PlaneGeometry(1.0, 0.25), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.45, depthWrite: false }), -2.6, 2.6, -0.49); g.add(lg);
      parts.mech = { g, a: [0, -2.95, -0.5], asm: [0, 0, 0], ex: [0, -0.4, -2.6] }; }
    return parts;
  }

  /* ---------------- E3 kit (E3 brochure "Details matter") ----------------
     71.5 mm rocker in a wing frame, plastic J-type arm with an H-block,
     brass terminal clamps */
  function buildE3(M) {
    const parts = {}, A = 7.15;
    { const g = new T.Group();
      keys(g, A, 0.34, 0.1, M.pc, 'v');
      g.add(ring(A - 0.1, A - 0.1, 0.2, 0.22, 0.06, M.pc, -0.34));
      rects(A, 'v').forEach(([x, y, w, h]) => g.add(box(Math.min(0.42, w * 0.4), 0.055, 0.01, M.ind, x, y + h / 2 - 0.5, 0.005)));
      g.add(box(0.7, 0.3, 0.3, M.inner, 0, A / 2 - 0.3, -0.5));            // indicator window
      g.add(box(0.4, 3.4, 0.22, M.pc, -1.5, 0, -0.45)); g.add(box(0.4, 3.4, 0.22, M.pc, 1.5, 0, -0.45));
      parts.rocker = { g, a: [0, 0.4, 0], asm: [0, 0, 0.75], ex: [0, 0.5, 10.4] }; }
    { const g = new T.Group(), P = 8.6;
      g.add(slab(P, P, 0.2, 0.14, M.white, 0, 0, 0));
      g.add(ring(P, P, (P - A) / 2 - 0.05, 0.42, 0.14, M.white, 0.42));      // wing frame around the rocker
      g.add(ring(P, P, 0.28, 0.55, 0.14, M.white, -0.2));
      const zb = -0.205;
      [[-1.7, 2.9], [1.7, 2.9], [-1.7, -2.9], [1.7, -2.9]].forEach(([x, y]) => g.add(hole(0.28, M.hole, x, y, zb, true)));
      g.add(box(0.16, 4.6, 0.45, M.inner, -0.65, 0, -0.43)); g.add(box(0.16, 4.6, 0.45, M.inner, 0.65, 0, -0.43));
      g.add(box(1.5, 0.24, 0.4, M.inner, 0, 1.3, -0.4)); g.add(box(0.36, 1.0, 0.4, M.inner, 0, 0.75, -0.4));
      g.add(box(0.5, 1.8, 0.65, M.white, 0, -0.6, -0.53));
      g.add(box(0.9, 0.5, 0.35, M.inner, -2.3, 0.2, -0.38)); g.add(box(0.9, 0.5, 0.35, M.inner, 2.3, 0.2, -0.38));
      const lg = mesh(new T.PlaneGeometry(1.0, 0.25), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide }), 0, -3.7, zb - 0.002); lg.rotation.y = Math.PI; g.add(lg);
      parts.base = { g, a: [-2.4, -2.4, -0.2], asm: [0, 0, 0], ex: [0, 0, 5.8] }; }
    { const g = new T.Group();                                              // plastic J-type arm with H-block
      g.add(box(0.34, 0.34, 2.6, M.white, 0, 0, 0));
      g.add(box(0.14, 1.5, 0.75, M.white, -0.4, 0, 1.25)); g.add(box(0.14, 1.5, 0.75, M.white, 0.4, 0, 1.25));
      g.add(box(0.94, 0.3, 0.75, M.white, 0, 0, 1.25));
      [0.5, -0.5].forEach((y) => g.add(box(0.16, 0.3, 0.3, M.hole, -0.48, y, 1.25)));
      const tip = box(0.36, 0.08, 0.55, M.brass, 0, 0.1, -1.45); tip.rotation.x = -0.5; g.add(tip);
      parts.lever = { g, a: [0, 0.2, 0], asm: [0, -0.4, -1.0], ex: [0, -0.2, 2.6] }; }
    { const g = new T.Group();
      const tU = terminal(M, true, M.brass); tU.position.set(0, 1.0, 0); g.add(tU);
      const tL = terminal(M, false, M.brass); tL.position.set(0, -1.0, 0); g.add(tL);
      parts.contacts = { g, obj: tU.userData.contact, a: [0, 0, 0], asm: [0.5, 0, -1.5], ex: [0.3, 0.1, -1.0] };
      parts.terminals = { g: null, obj: tL, a: [0, 0, 0] }; parts.contacts.spin = [tU.userData.screw, tL.userData.screw]; }
    parts.mech = housing(M, 3.4, 5.2);
    return parts;
  }
  // shared mechanism housing (open box, partitions, side windows); turns to show its inside
  function housing(M, W, H) {
    const g = new T.Group(), Dp = 2.2, t = 0.16;
    g.add(box(W, H, t, M.white, 0, 0, -Dp + t / 2));
    g.add(box(t, H, Dp, M.white, -W / 2 + t / 2, 0, -Dp / 2)); g.add(box(t, H, Dp, M.white, W / 2 - t / 2, 0, -Dp / 2));
    g.add(box(W, t, Dp, M.white, 0, H / 2 - t / 2, -Dp / 2)); g.add(box(W, t, Dp, M.white, 0, -H / 2 + t / 2, -Dp / 2));
    g.add(box(t, H - 0.3, Dp - 0.3, M.inner, 0.3, 0, -Dp / 2 - 0.15));
    g.add(box(W / 2 - 0.1, t, Dp - 0.4, M.inner, -W / 4, 0.95, -Dp / 2 - 0.2)); g.add(box(W / 2 - 0.1, t, Dp - 0.4, M.inner, -W / 4, -0.95, -Dp / 2 - 0.2));
    g.add(box(0.5, 0.6, 0.6, M.inner, 1.0, 1.6, -1.6)); g.add(box(0.5, 0.6, 0.6, M.inner, 1.0, -1.6, -1.6));
    [1.6, -0.4, -2.0].forEach((y) => g.add(box(0.02, 0.45, 0.45, M.hole, -W / 2 - 0.005, y * H / 5.8, -1.2)));
    g.add(box(W + 0.02, 0.5, 0.4, M.white, 0, H / 2 - 0.25, -0.05));
    return { g, a: [-W / 2, 0.6, -0.8], asm: [0, 0, -1.0], ex: [0, -0.5, -5.4], turn: -1.1 };
  }

  /* ---------------- E6 kit (E6 brochure "Saddle connection / J-type toggle") ----------------
     super-large 86 × 82 rocker with four-point fasteners, base with fastener seats,
     grey H-shaped toggle block, copper saddle clamps */
  function buildE6(M) {
    const parts = {}, A = 8.3;
    { const g = new T.Group();
      keys(g, A, 0.5, 0.1, M.pc, 'v');
      g.add(ring(A - 0.1, A - 0.1, 0.22, 0.25, 0.06, M.pc, -0.5));
      [[0, 1.7], [0, -1.7], [-3.4, 0], [3.4, 0]].forEach(([x, y]) => { const c = cyl(0.22, 0.6, M.pc, 'z', 18); c.position.set(x, y, -0.8); g.add(c); });
      const lg = mesh(new T.PlaneGeometry(0.8, 0.2), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.28, depthWrite: false }), A / 2 - 0.62, -A / 2 + 0.36, 0.006); g.add(lg);
      parts.rocker = { g, a: [0, 0.6, 0], asm: [0, 0, 1.25], ex: [0, 0.6, 7.2] }; }
    { const g = new T.Group(), P = 8.6;
      g.add(slab(P, P, 0.22, 0.12, M.white, 0, 0, 0));
      g.add(ring(P, P, 0.26, 0.4, 0.12, M.white, 0.4));
      [[0, 1.7], [0, -1.7], [-3.4, 0], [3.4, 0]].forEach(([x, y]) => { g.add(slab(0.7, 0.7, 0.3, 0.08, M.inner, x, y, 0.3)); g.add(hole(0.2, M.hole, x, y, 0.305)); });
      [[-3.3, 3.3], [3.3, 3.3], [-3.3, -3.3], [3.3, -3.3]].forEach(([x, y]) => { g.add(box(0.08, 0.35, 0.02, M.hole, x - 0.1, y, 0.01)); g.add(box(0.08, 0.35, 0.02, M.hole, x + 0.1, y, 0.01)); });
      g.add(slab(1.2, 2.4, 0.02, 0.08, M.hole, 0, 0, 0.012)); g.add(box(0.6, 1.6, 0.35, M.grey, 0, -0.1, 0.15));
      [[-0.75, 0.9], [0.75, 0.9], [-0.75, -0.9], [0.75, -0.9]].forEach(([x, y]) => g.add(box(0.06, 0.4, 0.02, M.hole, x, y, 0.01)));
      const lg = mesh(new T.PlaneGeometry(1.0, 0.25), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.35, depthWrite: false }), 2.4, 3.6, 0.012); g.add(lg);
      parts.base = { g, a: [3.4, 0, 0.3], asm: [0, 0, 0], ex: [0, 0, 3.6] }; }
    { const g = new T.Group();                                              // grey H-shaped toggle block
      g.add(box(0.5, 0.5, 2.0, M.grey, 0, 0, 0));
      [-0.55, 0.55].forEach((x) => { const c = clip(M.grey, 1.6, 1.4, 0.18); c.position.set(x, 0, 0.6); g.add(c); });
      g.add(box(1.25, 0.3, 0.5, M.grey, 0, 0, 0.6));
      const tip = box(0.4, 0.08, 0.5, M.copper, 0, 0.15, -1.1); tip.rotation.x = -0.4; g.add(tip);
      parts.lever = { g, a: [0.6, 0.5, 0.6], asm: [0, -0.3, -1.0], ex: [0, -0.4, 0.6] }; }
    { const g = new T.Group();
      [1, -1].forEach((k) => {                                              // saddle clamps: copper U around a screw
        const s = new T.Group(); s.position.y = k * 1.0; g.add(s);
        s.add(box(0.85, 0.08, 0.8, M.copper, 0, -0.35 * k, 0));
        s.add(box(0.08, 0.75, 0.8, M.copper, -0.42, 0, 0)); s.add(box(0.08, 0.75, 0.8, M.copper, 0.42, 0, 0));
        const sad = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.8, 18, 1, true, 0, Math.PI), M.copper); sad.rotation.x = Math.PI / 2; sad.rotation.z = k > 0 ? 0 : Math.PI; sad.position.y = 0.1 * k; sad.material.side = T.DoubleSide; s.add(sad);
        const sc = screw(M, 1.1); sc.position.y = 0.35 * k; if (k < 0) sc.rotation.z = Math.PI; s.add(sc);
        s.add(box(0.55, 0.08, 0.9, M.copper, 0, -0.35 * k, 0.8));
        const ct = cyl(0.15, 0.08, M.silver, 'z', 24); ct.position.set(0, -0.35 * k, 1.27); s.add(ct);
        if (k > 0) g.userData.contact = ct;
      });
      const sp = spring(M, 0.14, 0.7, 6, 0.022); sp.rotation.x = Math.PI / 2; g.add(sp);
      parts.contacts = { g, obj: g.userData.contact, a: [0, 0, 0], asm: [0.4, 0, -1.6], ex: [0.2, -0.1, -1.8] };
      parts.terminals = { g: null, obj: g, a: [0, 0, 0] }; }
    parts.mech = housing(M, 3.6, 5.6);
    parts.mech.ex = [0, -0.6, -5.2];
    return parts;
  }

  /* ---------------- E6 twinset socket (rocker + base) ---------------- */
  function buildE6Socket(M) {
    const parts = {}, A = 8.4;
    { const g = new T.Group();
      g.add(slab(A, A, 0.5, 0.12, M.pc, 0, 0, 0));
      g.add(ring(A - 0.1, A - 0.1, 0.22, 0.3, 0.06, M.pc, -0.5));
      g.add(box(0.36, 0.9, 0.04, M.slot, -0.6, 1.3, 0.005));                 // earth
      g.add(box(0.8, 0.36, 0.04, M.slot, -1.8, -1.0, 0.005)); g.add(box(0.8, 0.36, 0.04, M.slot, 0.6, -1.0, 0.005));
      g.add(slab(1.0, 2.0, 0.04, 0.06, M.hole, 2.6, 1.0, 0.005)); g.add(slab(0.8, 1.8, 0.2, 0.06, M.white, 2.6, 1.0, 0.12));   // switch
      g.add(box(1.4, 0.9, 0.4, M.pc, -0.6, A / 2 + 0.2, -0.3)); g.add(box(1.0, 0.25, 0.5, M.pc, -0.6, A / 2 + 0.55, 0.0));       // top hook
      const lg = mesh(new T.PlaneGeometry(0.8, 0.2), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.28, depthWrite: false }), A / 2 - 0.9, -A / 2 + 0.8, 0.006); g.add(lg);
      parts.rocker = { g, a: [-1.6, 1.8, 0], asm: [0, 0, 0.6], ex: [0, 0.6, 6.6] }; }
    { const g = new T.Group(), P = 8.6;
      g.add(slab(P, P, 0.22, 0.12, M.white, 0, 0, 0));
      g.add(ring(P, P, 0.3, 0.6, 0.12, M.white, 0.6));
      [[-3.3, 3.3], [3.3, 3.3], [-3.3, -3.3], [3.3, -3.3]].forEach(([x, y]) => g.add(slab(0.6, 0.6, 0.02, 0.05, M.hole, x, y, 0.012)));
      g.add(slab(1.0, 2.2, 0.02, 0.06, M.hole, 2.6, 1.0, 0.012)); g.add(hole(0.42, M.hole, 2.6, -1.8, 0.012));
      parts.base = { g, a: [-3.3, -3.3, 0], asm: [0, 0, 0], ex: [0, 0, 2.8] }; }
    { const g = new T.Group();                                              // safety shutter with spring
      g.add(slab(2.6, 0.8, 0.3, 0.08, new T.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.5 }), 0, 0, 0));
      const sp = spring(M, 0.15, 0.9, 7, 0.022); sp.rotation.x = Math.PI / 2; sp.position.set(-0.6, -0.85, -0.15); g.add(sp);
      parts.lever = { g, a: [0, 0, 0], asm: [-0.6, -1.0, -0.9], ex: [-0.6, -1.6, -0.4] }; }
    { const g = new T.Group();                                              // integral Sn-P bronze current-carrying parts
      const bz = new T.MeshPhysicalMaterial({ color: 0xd99a7e, metalness: 1, roughness: 0.3 });
      g.add(box(3.6, 0.5, 0.1, bz, 0, 0, 0));
      [-1.7, 1.7].forEach((x) => { g.add(box(0.1, 0.6, 0.7, bz, x - 0.2, 0.25, 0.35)); g.add(box(0.1, 0.6, 0.7, bz, x + 0.2, 0.25, 0.35)); });
      g.add(hole(0.12, M.hole, 0, 0, 0.06));
      parts.contacts = { g, a: [1.7, 0.4, 0.4], asm: [0, -0.4, -1.4], ex: [0, -0.3, -2.4] }; }
    { const h = housing(M, 4.6, 5.4); h.ex = [0.4, -0.8, -5.0]; parts.mech = h; }
    return parts;
  }

  /* ---------------- i7 kit (i7 brochure: J shape toggle system) ----------------
     push key with LED ring, slim frame, base, grey mechanism with J-lever,
     brass L-contacts and grey terminal clamps */
  function buildI7(M) {
    const parts = {}, A = 7.7;
    { const g = new T.Group();
      const dot = new T.MeshBasicMaterial({ color: 0xffffff });
      rects(A, 'grid', 0.1).forEach(([x, y, w, h]) => {
        g.add(slab(w, h, 0.32, 0.09, M.pc, x, y, 0));
        const led = new T.Mesh(new T.CircleGeometry(0.06, 16), dot); led.position.set(x, y - h / 2 + Math.min(0.84, h * 0.22), 0.004); g.add(led);
      });
      g.add(slab(A - 0.3, A - 0.3, 0.12, 0.08, M.pc, 0, 0, -0.32));
      parts.rocker = { g, a: [0, 0.6, 0], asm: [0, 0, 0.62], ex: [0, 0.4, 9.8] }; }
    { const g = new T.Group();
      g.add(ring(8.5, 8.5, 0.34, 0.66, 0.2, M.pc, 0.36));
      parts.frame = { g, a: [4.1, 3.0, 0.3], asm: [0, 0, 0], ex: [0, 0.2, 6.6] }; }
    { const g = new T.Group(), P = 8.2;
      g.add(slab(P, P, 0.18, 0.12, M.white, 0, 0, 0));
      g.add(ring(P, P, 0.24, 0.4, 0.12, M.white, -0.18));
      [[0, 3.0], [0, -3.0]].forEach(([x, y]) => g.add(hole(0.24, M.hole, x, y, -0.185, true)));
      [[-2.55, 0], [2.55, 0]].forEach(([x, y]) => g.add(hole(0.24, M.hole, x, y, -0.185, true, 0.7, 1.5)));
      g.add(slab(4.4, 5.2, 0.02, 0.1, M.hole, 0, 0, -0.18 - 0.001)); 
      parts.base = { g, a: [-3.0, -3.0, -0.2], asm: [0, 0, -0.1], ex: [0, 0, 3.6] }; }
    { const g = new T.Group();                                              // grey mechanism block with snap clips
      g.add(slab(3.0, 4.6, 1.5, 0.12, M.grey, 0, 0, 0));
      g.add(box(2.4, 0.5, 0.8, M.grey, 0, 2.5, -0.5));
      [1.2, -1.2].forEach((y) => { const c = clip(M.grey, 1.2, 1.1, 0.16); c.position.set(-1.6, y, -0.7); g.add(c); });
      g.add(box(0.9, 0.9, 0.6, M.grey, 0.6, 0.2, 0.3));
      parts.mech = { g, a: [-1.5, 0, -0.7], asm: [0, 0, -0.35], ex: [-0.3, -0.3, -3.8], turn: -0.9 }; }
    { const g = new T.Group();                                              // J lever + brass L contacts
      const lv = box(2.6, 0.12, 0.3, M.steel, 0, 0, 0); lv.rotation.z = 0.12; g.add(lv);
      const hk = box(0.12, 0.6, 0.3, M.steel, -1.3, -0.25, 0); g.add(hk);
      [1, -1].forEach((k) => { const L = new T.Group(); L.position.set(0.7, 0.9 * k, 0.3); g.add(L);
        L.add(box(0.5, 1.0, 0.07, M.brass, 0.3, 0, 0)); L.add(box(0.5, 0.07, 0.6, M.brass, 0.3, 0.5 * k, -0.3)); L.add(box(0.22, 0.5, 0.07, M.brass, -0.05, -0.5 * k, 0.1)); });
      parts.lever = { g, a: [0, 0, 0.15], asm: [0.2, 0, -1.0], ex: [0.4, 0, -0.4] }; }
    { const g = new T.Group();
      [1, -1].forEach((k) => {
        const c = new T.Group(); c.position.y = 2.0 * k; g.add(c);
        c.add(slab(1.1, 0.9, 0.9, 0.12, M.grey, 0, 0, 0.45)); c.add(box(0.6, 0.45, 0.02, M.slot, 0, 0, 0.46));
        const s = screw(M, 1.0); s.position.y = 0.4 * k; if (k < 0) s.rotation.z = Math.PI; c.add(s);
        if (k < 0) g.userData.low = c;
      });
      parts.terminals = { g, obj: g.userData.low, a: [0, 0, 0], asm: [0.5, 0, -1.2], ex: [1.4, 0, -1.6] }; }
    return parts;
  }

  /* ---------------- M7 kit (M7 brochure: Gem, anti-glare glass) ----------------
     etched AG glass, glass panel with dark edge, key carrier, base with mechanism */
  function buildM7(M) {
    const parts = {}, P = 8.6;
    { const g = new T.Group();
      const gm = new T.MeshPhysicalMaterial({ color: 0xe9e6ff, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, clearcoatRoughness: 0.2, depthWrite: false });
      rects(P, 'v', 0.07).forEach(([x, y, w, h]) => g.add(slab(w, h, 0.07, GANG > 1 ? 0.2 : 0.36, gm, x, y, 0)));
      g.add(ring(P, P, 0.03, 0.07, 0.36, new T.MeshBasicMaterial({ color: 0x8c88b8, transparent: true, opacity: 0.6 }), 0));
      parts.glass = { g, a: [0.6, 1.4, 0], asm: [0, 0, 0.6], ex: [0, 0, 7.4] }; }
    { const g = new T.Group();
      rects(P, 'v', 0.07).forEach(([x, y, w, h]) => g.add(slab(w, h, 0.24, GANG > 1 ? 0.2 : 0.36, M.pc, x, y, 0)));
      g.add(ring(P, P, 0.05, 0.24, 0.36, new T.MeshStandardMaterial({ color: 0x141416, roughness: 0.4 }), 0));
      const lg = mesh(new T.PlaneGeometry(0.95, 0.24), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.25, depthWrite: false }), P / 2 - 0.62, -P / 2 + 0.34, 0.006); g.add(lg);
      parts.rocker = { g, a: [-1.2, -1.2, 0], asm: [0, 0, 0.52], ex: [0, 0, 5.0] }; }
    { const g = new T.Group();
      g.add(slab(8.2, 8.2, 0.16, 0.3, M.white, 0, 0, 0));
      g.add(slab(6.6, 3.0, 0.02, 0.2, M.inner, 0, 1.8, 0.012)); g.add(slab(6.6, 3.0, 0.02, 0.2, M.inner, 0, -1.8, 0.012));
      parts.frame = { g, a: [2.6, 3.2, 0], asm: [0, 0, 0.27], ex: [0, 0, 2.6] }; }
    { const g = new T.Group();
      g.add(ring(P, P, 0.55, 0.7, 0.3, M.white, 0.1));
      g.add(slab(P - 1.0, P - 1.0, 0.2, 0.2, M.inner, 0, 0, -0.45));
      [-1.6, -0.5, 0.6].forEach((x) => { g.add(slab(0.8, 0.8, 0.35, 0.05, M.grey, x, -2.6, -0.2)); g.add(box(0.4, 0.4, 0.02, M.slot, x, -2.6, -0.19)); });
      g.add(hole(0.42, M.hole, 2.2, 0.2, -0.44)); const tor = new T.Mesh(new T.TorusGeometry(0.46, 0.06, 8, 30), M.grey); tor.position.set(2.2, 0.2, -0.43); g.add(tor);
      g.add(box(0.16, 4.6, 0.3, M.grey, 1.3, 0.4, -0.3)); g.add(box(0.5, 0.9, 0.4, M.grey, 2.6, 2.2, -0.25)); g.add(box(0.5, 0.9, 0.4, M.grey, 2.6, -1.2, -0.25));
      g.add(box(1.0, 1.2, 0.3, M.grey, -2.4, 2.0, -0.3)); g.add(box(1.0, 1.2, 0.3, M.grey, -0.6, 2.0, -0.3));
      parts.mech = { g, a: [-0.5, -2.6, -0.2], asm: [0, 0, 0], ex: [0, 0, -0.6] }; }
    return parts;
  }


  /* ---------------- registry ---------------- */
  const KITS = {
    m3: { build: (M) => buildJ(M, false), yaw: 2.2, right: ['rocker'] },
    e3: { build: buildE3, yaw: 2.2, right: ['rocker'] },
    e6: { build: buildE6, yaw: 0.95, tilt: 0.42, right: ['rocker', 'base'] },
    e6socket: { build: buildE6Socket, yaw: 0.85, tilt: 0.38, right: ['rocker', 'base'] },
    m1: { build: buildM1, yaw: 0.98, right: ['rocker', 'frame'] },
    i7: { build: buildI7, yaw: 0.95, tilt: 0.3, right: ['rocker', 'frame'] },
    m7: { build: buildM7, yaw: -0.72, tilt: 0.42, right: ['frame', 'mech'], start: -0.2, shift: 0 },
  };
  // build a kit: { meta, M (materials), parts, group }
  function build(name, gang) {
    const meta = KITS[name] || KITS.m3;
    GANG = gang || 1;
    const M = mats();
    const parts = meta.build(M);
    const group = new T.Group(); Object.values(parts).forEach((p) => p.g && group.add(p.g));
    return { name, meta, M, parts, group, gang: GANG };
  }
  // logical disassembly: each part first slides straight out along the mounting axis, then moves aside;
  // parts go one after another (front part first); screws turn as they come out
  function pose(kit, e) {
    const moving = Object.keys(kit.parts).filter((k) => kit.parts[k].g), nm = moving.length;
    moving.forEach((k, i) => {
      const P = kit.parts[k];
      const d = clamp((e - (i / nm) * 0.55) / 0.45, 0, 1);
      const qz = eio(clamp(d / 0.7, 0, 1)), qs = eio(clamp((d - 0.45) / 0.55, 0, 1));
      P.g.position.set(P.asm[0] + (P.ex[0] - P.asm[0]) * qs, P.asm[1] + (P.ex[1] - P.asm[1]) * qs, P.asm[2] + (P.ex[2] - P.asm[2]) * qz);
      if (P.turn) P.g.rotation.y = P.turn * qs;
      if (P.spin) P.spin.forEach((o) => (o.rotation.y = -qz * Math.PI * 6));
    });
  }
  function anchor(kit, k, out) {
    const p = kit.parts[k]; if (!p) return null;
    const o = p.obj || p.g; const a = p.obj ? [0, 0, 0] : p.a || [0, 0, 0];
    out.set(a[0], a[1], a[2]); o.updateWorldMatrix(true, false); return o.localToWorld(out);
  }
  function dispose(kit) { kit.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  global.SimonKits = { KITS, build, pose, anchor, dispose, eio };
})(window);
