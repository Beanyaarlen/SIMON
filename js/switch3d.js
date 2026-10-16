/* =========================================================================
   Simon i7 Push-Button Switch — procedural 3D model (Three.js r160, UMD)
   PT. Klik Hiro Optima — Switch Design & Smart Home
   ========================================================================= */
(function (global) {
  'use strict';
  const T = THREE;

  /* ---------- dimensions (1 unit ≈ 1 cm) ---------- */
  const A = 7.7;     // key area of one module
  const G = 0.1;     // gap between keys
  const GM = 0.1;    // modules sit flush in one frame (same hairline as between keys)
  const B = 0.34;    // frame border
  const CL = 0.06;   // clearance between keys and frame
  const KD = 0.32;   // key depth
  const FD = 0.72;   // frame depth
  const PITCH = A + GM;
  const OUTER = A + 2 * CL + 2 * B; // outer size of a 1-module frame

  /* ---------- finishes (sampled from the KHO catalog photos) ---------- */
  const FINISH = {
    white: { name: 'White', hex: '#e9e9e7' },
    champ: { name: 'Champagne', hex: '#d8c6a1' },
    dgrey: { name: 'Dark Grey', hex: '#5d5d5f' },
    black: { name: 'Black Doff', hex: '#262627' },
    mocha: { name: 'Mocha', hex: '#48433b' },
  };
  const hexToArr = (h) => { const c = new T.Color(h); return [c.r, c.g, c.b]; };
  Object.keys(FINISH).forEach((k) => { FINISH[k].rgb = hexToArr(FINISH[k].hex); });

  /* ---------- key layouts: [cx, cy, w, h, visible] x 4 ---------- */
  const K4 = (A - G) / 2;               // 3.8
  const K3 = (A - 2 * G) / 3;           // ~2.5
  const c4 = K4 / 2 + G / 2;            // 1.95
  const c3 = K3 + G;
  const LAYOUT = {
    1: [0, 0, A, A, 1, 0, 0, A, A, 0, 0, 0, A, A, 0, 0, 0, A, A, 0],
    2: [-c4, 0, K4, A, 1, c4, 0, K4, A, 1, -c4, 0, K4, A, 0, c4, 0, K4, A, 0],
    3: [-c3, 0, K3, A, 1, 0, 0, K3, A, 1, -c3, 0, K3, A, 0, c3, 0, K3, A, 1],
    4: [-c4, c4, K4, K4, 1, c4, c4, K4, K4, 1, -c4, -c4, K4, K4, 1, c4, -c4, K4, K4, 1],
  };

  /* ---------- helpers ---------- */
  function rrect(w, h, r, cx, cy, P) {
    const s = new (P || T.Shape)();
    cx = cx || 0; cy = cy || 0;
    r = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001));
    const x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function keyGeometry(w, h, depth, radius, bev) {
    bev = bev || 0.035;
    w = Math.max(w, 0.12); h = Math.max(h, 0.12);
    const shape = rrect(w - 2 * bev, h - 2 * bev, radius || 0.09);
    const d = Math.max(0.01, (depth || KD) - 2 * bev);
    const g = new T.ExtrudeGeometry(shape, {
      depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev,
      bevelSegments: 3, curveSegments: 5,
    });
    g.translate(0, 0, -(d + bev));
    return g;
  }

  function frameGeometry(n) {
    const bev = 0.05;
    const holeW = n * A + (n - 1) * GM + 2 * CL;
    const holeH = A + 2 * CL;
    const outW = holeW + 2 * B, outH = holeH + 2 * B;
    const shape = rrect(outW - 2 * bev, outH - 2 * bev, 0.22);
    shape.holes.push(rrect(holeW + 2 * bev, holeH + 2 * bev, 0.06, 0, 0, T.Path));
    const d = FD - 2 * bev;
    const g = new T.ExtrudeGeometry(shape, {
      depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev,
      bevelSegments: 3, curveSegments: 6,
    });
    g.translate(0, 0, -(d + bev) + 0.012);
    return g;
  }

  /* ---------- procedural textures ---------- */
  function noiseTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); const img = x.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 20;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(0.9, 0.9);
    return t;
  }

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.35, 'rgba(220,235,255,0.18)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }

  function glyphTexture(draw) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
    draw(x);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  /* 7-segment digit renderer for the thermostat display */
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
  function seg7(x, ch, px, py, w, h, t) {
    const on = SEG[ch] || '';
    const sk = 0.12 * w; // italic skew
    const P = (u, v) => [px + u + (1 - v / h) * sk, py + v];
    const segs = {
      a: [[t, 0], [w - t, 0], [w - t * 1.6, t], [t * 1.6, t]],
      d: [[t * 1.6, h - t], [w - t * 1.6, h - t], [w - t, h], [t, h]],
      g: [[t, h / 2], [t * 1.6, h / 2 - t / 2], [w - t * 1.6, h / 2 - t / 2], [w - t, h / 2], [w - t * 1.6, h / 2 + t / 2], [t * 1.6, h / 2 + t / 2]],
      f: [[0, t], [t, t * 1.6], [t, h / 2 - t * 0.8], [0, h / 2 - t * 0.3]],
      e: [[0, h / 2 + t * 0.3], [t, h / 2 + t * 0.8], [t, h - t * 1.6], [0, h - t]],
      b: [[w, t], [w, h / 2 - t * 0.3], [w - t, h / 2 - t * 0.8], [w - t, t * 1.6]],
      c: [[w, h / 2 + t * 0.3], [w, h - t], [w - t, h - t * 1.6], [w - t, h / 2 + t * 0.8]],
    };
    for (const s of on) {
      const pts = segs[s].map((p) => P(p[0], p[1]));
      x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
      x.closePath(); x.fill();
    }
  }

  function makeThermoCanvas() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    function draw(temp) {
      const x = c.getContext('2d');
      x.clearRect(0, 0, 512, 512);
      x.fillStyle = '#f2f6ff'; x.strokeStyle = '#f2f6ff';
      x.shadowColor = 'rgba(200,220,255,0.9)'; x.shadowBlur = 10;
      // snowflake
      x.lineWidth = 5; x.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        x.beginPath(); x.moveTo(70 + Math.cos(a) * 18, 70 + Math.sin(a) * 18);
        x.lineTo(70 - Math.cos(a) * 18, 70 - Math.sin(a) * 18); x.stroke();
      }
      // moon
      x.beginPath(); x.arc(330, 64, 15, Math.PI * 0.35, Math.PI * 1.65); x.quadraticCurveTo(318, 64, 336, 78); x.stroke();
      // clock 12:00
      const sw = 22, sh = 38, st = 5;
      ['1', '2'].forEach((d, i) => seg7(x, d, 368 + i * 28, 48, sw, sh, st));
      x.beginPath(); x.arc(426, 60, 3, 0, 7); x.arc(426, 76, 3, 0, 7); x.fill();
      ['0', '0'].forEach((d, i) => seg7(x, d, 436 + i * 28, 48, sw, sh, st));
      // big temperature
      const s = temp.toFixed(1); const parts = s.split('.');
      const bw = 92, bh = 170, bt = 17;
      const intStr = parts[0].padStart(2, ' ');
      let px = 70;
      for (const d of intStr) { if (d !== ' ') seg7(x, d, px, 168, bw, bh, bt); px += bw + 22; }
      x.beginPath(); x.arc(px + 4, 330, 10, 0, 7); x.fill(); px += 24;
      seg7(x, parts[1], px, 168, bw, bh, bt);
      px += bw + 18;
      x.lineWidth = 6; x.beginPath(); x.arc(px + 10, 190, 10, 0, 7); x.stroke();
      x.font = '600 64px Archivo, Arial, sans-serif'; x.fillText('C', px + 26, 270);
      x.font = '600 20px Archivo, Arial, sans-serif'; x.fillText('AUTO', 392, 372);
      // bottom icons
      x.lineWidth = 5;
      x.beginPath(); x.arc(78, 448, 18, -Math.PI * 0.3, Math.PI * 1.3); x.stroke();
      x.beginPath(); x.moveTo(78, 422); x.lineTo(78, 446); x.stroke();
      x.beginPath(); x.arc(172, 448, 18, 0, 7); x.stroke();
      x.font = '700 20px Archivo, Arial, sans-serif'; x.fillText('M', 163, 455);
      x.beginPath(); x.arc(212, 448, 5, 0, 7); x.fill();
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3; x.beginPath();
        x.ellipse(256 + Math.cos(a) * 10, 448 + Math.sin(a) * 10, 11, 6, a, 0, 7); x.stroke();
      }
      x.beginPath(); x.moveTo(338, 458); x.lineTo(354, 440); x.lineTo(370, 458); x.stroke();
      x.beginPath(); x.moveTo(416, 440); x.lineTo(432, 458); x.lineTo(448, 440); x.stroke();
      tex.needsUpdate = true;
    }
    return { tex, draw };
  }

  /* ---------- environment (soft studio) ---------- */
  function makeEnvironment(renderer) {
    const scene = new T.Scene();
    const room = new T.Mesh(new T.BoxGeometry(30, 20, 30), new T.MeshBasicMaterial({ color: 0x0b0b0c, side: T.BackSide }));
    scene.add(room);
    const panel = (w, h, pos, intensity, tint) => {
      const c = new T.Color(tint || 0xffffff).multiplyScalar(intensity);
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); scene.add(m);
    };
    panel(14, 6, [-7, 9, 8], 4.2);           // big top-left softbox
    panel(3, 14, [12, 1, 2], 1.6, 0xdfe7ff);  // cool right strip
    panel(18, 3, [0, -9, 9], 0.45);           // floor bounce
    panel(6, 6, [0, 2, 14], 0.9);             // front fill
    panel(4, 10, [-13, -2, -4], 0.8);         // left kicker
    const pm = new T.PMREMGenerator(renderer);
    const rt = pm.fromScene(scene, 0.04);
    pm.dispose();
    return rt.texture;
  }

  /* ---------- shared resources ---------- */
  let RES = null;
  function resources() {
    if (RES) return RES;
    RES = {
      noise: noiseTexture(),
      glow: glowTexture(),
      ledGeo: new T.CircleGeometry(0.055, 20),
      dotGeo: new T.CircleGeometry(0.038, 14),
      frame1: frameGeometry(1),
      key4: keyGeometry(K4, K4),
      curtainOpen: glyphTexture((x) => {
        x.strokeRect(22, 30, 84, 70);
        x.beginPath(); x.moveTo(22, 30); x.quadraticCurveTo(44, 64, 34, 100); x.stroke();
        x.beginPath(); x.moveTo(106, 30); x.quadraticCurveTo(84, 64, 94, 100); x.stroke();
      }),
      curtainClosed: glyphTexture((x) => {
        x.strokeRect(22, 30, 84, 70);
        for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(36 + i * 19, 34); x.lineTo(36 + i * 19, 96); x.stroke(); }
      }),
      bulb: glyphTexture((x) => {
        x.beginPath(); x.arc(64, 52, 26, Math.PI * 0.8, Math.PI * 2.2); x.lineTo(78, 90); x.lineTo(50, 90); x.closePath(); x.stroke();
        x.beginPath(); x.moveTo(52, 104); x.lineTo(76, 104); x.stroke();
      }),
      arrowUp: glyphTexture((x) => {
        x.lineWidth = 9;
        x.beginPath(); x.moveTo(64, 112); x.lineTo(64, 20); x.stroke();
        x.beginPath(); x.moveTo(30, 54); x.lineTo(64, 18); x.lineTo(98, 54); x.stroke();
      }),
    };
    RES.noise.colorSpace = T.NoColorSpace;
    return RES;
  }

  function makeMaterials(hex) {
    const R = resources();
    const key = new T.MeshPhysicalMaterial({
      color: new T.Color(hex), roughness: 0.5, metalness: 0.05,
      clearcoat: 0.25, clearcoatRoughness: 0.55, bumpMap: R.noise, bumpScale: 0.6,
      envMapIntensity: 1.0,
    });
    const frame = new T.MeshPhysicalMaterial({
      color: new T.Color(hex), roughness: 0.38, metalness: 0.35,
      clearcoat: 0.4, clearcoatRoughness: 0.35, bumpMap: R.noise, bumpScale: 0.3,
      envMapIntensity: 1.1,
    });
    const gap = new T.MeshStandardMaterial({ color: 0x080809, roughness: 0.9 });
    return { key, frame, gap };
  }

  function makeLed(parent, R) {
    const disc = new T.Mesh(R.ledGeo, new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    disc.position.z = 0.004;
    const glow = new T.Sprite(new T.SpriteMaterial({ map: R.glow, color: 0xdfeaff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.scale.set(1.05, 1.05, 1); glow.position.z = 0.05;
    parent.add(disc); // no glow halo: it clipped against the key surface (crescent look)
    return { disc, glow };
  }

  /* =======================================================================
     SwitchModel — the hero product (main) or a lightweight lineup clone
     ======================================================================= */
  class SwitchModel {
    constructor(opts) {
      opts = opts || {};
      const R = resources();
      this.full = !!opts.full;
      this.group = new T.Group();
      this.panel = new T.Group();
      this.group.add(this.panel);
      this.mats = makeMaterials(opts.color || FINISH.dgrey.hex);
      this._col = new T.Color();

      // frame
      this.frame = new T.Mesh(R.frame1, this.mats.frame);
      this.frameN = 1;
      this.frameWrap = new T.Group(); this.frameWrap.add(this.frame);
      this.panel.add(this.frameWrap);
      // dark backing behind the keys
      this.backing = new T.Mesh(new T.PlaneGeometry(1, 1), this.mats.gap);
      this.backing.position.z = -0.3;
      this.backing.scale.set(A + 2 * CL, A + 2 * CL, 1);
      this.frameWrap.add(this.backing);

      // keys
      this.keys = [];
      for (let i = 0; i < 4; i++) {
        const g = new T.Group();
        const mesh = new T.Mesh(R.key4, this.mats.key);
        mesh.userData.keyIndex = i;
        g.add(mesh);
        const led = makeLed(g, R);
        this.keysWrap = this.keysWrap || new T.Group();
        this.keysWrap.add(g);
        this.keys.push({ g, mesh, led, w: K4, h: K4, on: true, level: 1, press: 0, pressT: 0 });
      }
      this.panel.add(this.keysWrap);
      this.layout = LAYOUT[4].slice();
      this.applyLayout(this.layout, true);

      if (this.full) { this._buildInternals(); this._buildModules(); }
      this.explode = 0; this.modules = 1;
    }

    /* ---- layout of the 4 key slots ---- */
    applyLayout(L, force) {
      const R = resources();
      for (let i = 0; i < 4; i++) {
        const k = this.keys[i];
        const cx = L[i * 5], cy = L[i * 5 + 1], w = L[i * 5 + 2], h = L[i * 5 + 3], vis = L[i * 5 + 4];
        if (force || Math.abs(w - k.w) > 0.004 || Math.abs(h - k.h) > 0.004) {
          if (k.mesh.geometry !== R.key4) k.mesh.geometry.dispose();
          k.mesh.geometry = (Math.abs(w - K4) < 0.004 && Math.abs(h - K4) < 0.004) ? R.key4 : keyGeometry(w, h);
          k.w = w; k.h = h;
        }
        k.vis = vis;
        k.g.position.x = cx; k.g.position.y = cy;
        k.sink = -(1 - vis) * 0.34 - i * 0.0006;
        const ledY = -h / 2 + Math.min(0.84, h * 0.22);
        k.led.disc.position.set(0, ledY, 0.004);
        k.led.glow.position.set(0, ledY, 0.06);
        k.g.visible = vis > 0.01 || i === 0;
      }
    }

    setColor(rgb) {
      this._col.setRGB(rgb[0], rgb[1], rgb[2]);
      this.mats.key.color.copy(this._col);
      this.mats.frame.color.copy(this._col);
      // lighter finishes get a lighter gap + subtler LED
      const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      this.lum = lum;
      this.mats.gap.color.setRGB(rgb[0] * 0.25, rgb[1] * 0.25, rgb[2] * 0.25);
    }

    press(i) {
      const k = this.keys[i]; if (!k) return;
      k.on = !k.on; k.pressT = 1;
    }

    /* ---- internals for the exploded view ---- */
    _buildInternals() {
      const metal = new T.MeshPhysicalMaterial({ color: 0xc4c8ce, metalness: 0.95, roughness: 0.32, envMapIntensity: 1.2 });
      const darkPlastic = new T.MeshPhysicalMaterial({ color: 0x1b1c1e, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.6 });
      const greyPlastic = new T.MeshStandardMaterial({ color: 0x585c62, roughness: 0.72, metalness: 0.0 });
      const pcbMat = new T.MeshPhysicalMaterial({ color: 0x0f2219, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 });
      const chipMat = new T.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.35 });
      const goldMat = new T.MeshStandardMaterial({ color: 0xc9a75a, metalness: 1, roughness: 0.3 });
      const ledHot = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

      const parts = [];

      // 1) LED control board
      const pcb = new T.Group();
      const board = new T.Mesh(keyGeometry(A - 0.3, A - 0.3, 0.14, 0.2, 0.02), pcbMat);
      pcb.add(board);
      const chip = (w, h, x, y) => { const m = new T.Mesh(new T.BoxGeometry(w, h, 0.12), chipMat); m.position.set(x, y, 0.04); pcb.add(m); };
      chip(1.4, 1.4, 0, 0.3); chip(0.7, 0.5, -1.6, -0.6); chip(0.7, 0.5, 1.6, -0.6); chip(2.2, 0.35, 0, -2.2);
      for (let i = 0; i < 8; i++) { const p = new T.Mesh(new T.BoxGeometry(0.16, 0.3, 0.02), goldMat); p.position.set(-1.6 + i * 0.46, 2.9, 0.02); pcb.add(p); }
      LAYOUT[4].forEach((_, j) => {
        if (j % 5 !== 0) return; const i = j / 5;
        const lx = LAYOUT[4][i * 5], ly = LAYOUT[4][i * 5 + 1] - K4 / 2 + 0.84;
        const l = new T.Mesh(new T.BoxGeometry(0.22, 0.16, 0.12), ledHot); l.position.set(lx, ly, 0.06); pcb.add(l);
        const gl = new T.Sprite(new T.SpriteMaterial({ map: resources().glow, color: 0xe6efff, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
        gl.scale.set(1.1, 1.1, 1); gl.position.set(lx, ly, 0.2);
        // tactile domes
        const dome = new T.Mesh(new T.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal);
        dome.rotation.x = Math.PI / 2; dome.scale.set(1, 0.35, 1);
        dome.position.set(LAYOUT[4][i * 5], LAYOUT[4][i * 5 + 1] + 0.4, 0.02); pcb.add(dome);
      });
      parts.push({ name: 'pcb', obj: pcb, z0: -0.42, dz: 2.5, dy: 0.25, half: (A - 0.3) / 2, label: 'LED indicator board' });

      // 2) metal mounting plate
      const pw = OUTER + 0.4;
      const plateShape = rrect(pw, pw, 0.35);
      plateShape.holes.push(rrect(A - 1.4, A - 1.4, 0.4, 0, 0, T.Path));
      [[-pw / 2 + 0.75, 0], [pw / 2 - 0.75, 0]].forEach(([x, y]) => plateShape.holes.push(rrect(0.42, 1.5, 0.2, x, y, T.Path)));
      [[0, pw / 2 - 0.7], [0, -pw / 2 + 0.7]].forEach(([x, y]) => plateShape.holes.push(rrect(1.5, 0.42, 0.2, x, y, T.Path)));
      const plateGeo = new T.ExtrudeGeometry(plateShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 6 });
      plateGeo.translate(0, 0, -0.12);
      const plate = new T.Group(); plate.add(new T.Mesh(plateGeo, metal));
      parts.push({ name: 'plate', obj: plate, z0: -0.75, dz: -1.35, dy: -0.2, half: pw / 2, label: 'Steel mounting plate' });

      // 3) switch mechanism
      const mech = new T.Group();
      const body = new T.Mesh(keyGeometry(6.4, 6.4, 2.3, 0.35, 0.08), darkPlastic); body.position.z = -0.3; mech.add(body);
      const collar = new T.Mesh(keyGeometry(7.1, 7.1, 0.34, 0.3, 0.05), darkPlastic); mech.add(collar);
      for (let i = 0; i < 4; i++) {
        const t = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 0.7), greyPlastic); t.position.set(-1.8 + i * 1.2, -2.2, -2.75); mech.add(t);
        const s = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.12, 18), metal); s.rotation.x = Math.PI / 2; s.position.set(-1.8 + i * 1.2, -2.2, -3.12); mech.add(s);
      }
      const plug = new T.Mesh(new T.BoxGeometry(2.4, 0.7, 0.3), chipMat); plug.position.set(0, 1.4, 0.05); mech.add(plug);
      parts.push({ name: 'mech', obj: mech, z0: -0.95, dz: -5.3, dy: -0.65, half: 3.55, label: 'Push-button mechanism' });

      // 4) flush mounting box
      const box = new T.Group();
      const bw = OUTER - 0.2, bd = 4.6, wt = 0.22;
      const wall = (w, h, d, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), greyPlastic); m.position.set(x, y, z); box.add(m); };
      wall(bw, bw, wt, 0, 0, -bd);
      wall(bw, wt, bd, 0, bw / 2 - wt / 2, -bd / 2);
      wall(bw, wt, bd, 0, -bw / 2 + wt / 2, -bd / 2);
      wall(wt, bw, bd, bw / 2 - wt / 2, 0, -bd / 2);
      wall(wt, bw, bd, -bw / 2 + wt / 2, 0, -bd / 2);
      const lip = new T.Shape(); lip.copy(rrect(bw + 0.8, bw + 0.8, 0.3)); lip.holes.push(rrect(bw - 0.4, bw - 0.4, 0.1, 0, 0, T.Path));
      const lipG = new T.ExtrudeGeometry(lip, { depth: 0.16, bevelEnabled: false, curveSegments: 6 }); lipG.translate(0, 0, -0.16);
      box.add(new T.Mesh(lipG, greyPlastic));
      [-1, 1].forEach((sx) => {
        const boss = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, bd - 0.3, 18), greyPlastic);
        boss.rotation.x = Math.PI / 2; boss.position.set(sx * (bw / 2 - 0.65), 0, -bd / 2 - 0.15); box.add(boss);
        const hole = new T.Mesh(new T.CircleGeometry(0.16, 14), chipMat); hole.position.set(sx * (bw / 2 - 0.65), 0, 0.02); box.add(hole);
      });
      parts.push({ name: 'box', obj: box, z0: -1.25, dz: -9.5, dy: -1.1, half: (bw + 0.8) / 2, label: 'Flush mounting box' });

      this.internals = parts;
      parts.forEach((p) => { p.obj.position.z = p.z0; p.obj.visible = false; this.panel.add(p.obj); });
      // labels for the visible layers
      this.layers = [
        { name: 'keys', label: 'Push-button keys', half: A / 2 },
        { name: 'frame', label: 'Flat cover frame', half: OUTER / 2 },
      ].concat(parts);
    }

    /* ---- extra modules for the "Complete Design Language" panel ---- */
    _buildModules() {
      const R = resources();
      const mods = [];
      const mk = () => { const g = new T.Group(); this.panel.add(g); g.visible = false; return g; };

      // Dimmer Swipe: two tall keys with LED level columns
      const dim = mk(); const dimDots = [];
      const kg = keyGeometry(K4, A);
      [-c4, c4].forEach((x, j) => {
        const k = new T.Mesh(kg, this.mats.key); k.position.x = x; dim.add(k);
        for (let d = 0; d < 8; d++) {
          const m = new T.Mesh(R.dotGeo, new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
          m.position.set(x - 1.15, 3.05 - d * 0.38, 0.004); dim.add(m); dimDots.push({ m, j, d });
        }
        const led = makeLed(dim, R); led.disc.position.set(x, -A / 2 + 0.84, 0.004); led.glow.position.set(x, -A / 2 + 0.84, 0.06);
        const b = new T.Mesh(new T.PlaneGeometry(0.42, 0.42), new T.MeshBasicMaterial({ map: R.bulb, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
        b.position.set(x, -A / 2 + 1.45, 0.006); dim.add(b);
        const arr = new T.Mesh(new T.PlaneGeometry(0.9, 2.6), new T.MeshBasicMaterial({ map: R.arrowUp, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, color: 0xcfe6ff }));
        arr.position.set(x + 0.4, 0.6, 0.008); arr.scale.y = 1; dim.add(arr); dimDots.push({ arrow: arr, j });
      });
      mods.push({ g: dim, kind: 'dimmer', dots: dimDots, label: 'Dimmer Swipe' });

      // Curtain control: single key with open/close glyphs
      const cur = mk();
      cur.add(new T.Mesh(keyGeometry(A, A), this.mats.key));
      const gm = (tex, y) => { const m = new T.Mesh(new T.PlaneGeometry(0.62, 0.62), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })); m.position.set(0, y, 0.006); cur.add(m); return m; };
      gm(R.curtainOpen, A / 2 - 0.75); gm(R.curtainClosed, -A / 2 + 0.75);
      mods.push({ g: cur, kind: 'curtain', label: 'Curtain Control' });

      // AC control: black glass thermostat display
      const th = mk();
      const glass = new T.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 });
      th.add(new T.Mesh(keyGeometry(A, A, KD, 0.08, 0.03), glass));
      const disp = makeThermoCanvas(); disp.draw(25.0);
      const scr = new T.Mesh(new T.PlaneGeometry(A - 0.9, A - 0.9), new T.MeshBasicMaterial({ map: disp.tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
      scr.position.z = 0.006; th.add(scr);
      mods.push({ g: th, kind: 'thermo', disp, temp: 25.0, label: 'AC Control' });

      this.mods = mods;
    }

    setFrameModules(n) {
      if (Math.abs(n - this.frameN) < 0.002) return;
      if (this.frame.geometry !== resources().frame1) this.frame.geometry.dispose();
      this.frame.geometry = Math.abs(n - 1) < 0.002 ? resources().frame1 : frameGeometry(n);
      this.frameN = n;
      const holeW = n * A + (n - 1) * GM + 2 * CL;
      this.backing.scale.set(holeW, A + 2 * CL, 1);
    }

    /* ---- per-frame update ---- */
    update(st, dt, time) {
      // color + layout
      if (st.col) this.setColor(st.col);
      if (st.layout) this.applyLayout(st.layout);

      // keys: press spring + LED level
      const ledMaster = st.led == null ? 1 : st.led;
      for (let i = 0; i < 4; i++) {
        const k = this.keys[i];
        // key travel: quick press, softer release
        if (k.pressT > 0) {
          k.pressT = Math.max(0, k.pressT - dt / 0.32);
          const u = 1 - k.pressT;
          k.press = -0.11 * (u < 0.25 ? u / 0.25 : Math.pow(1 - (u - 0.25) / 0.75, 2));
        } else k.press = 0;
        const target = (k.on ? 1 : 0) * ledMaster * k.vis;
        k.level += (target - k.level) * Math.min(1, dt * 10);
        k.g.position.z = k.sink + k.press;
        const lum = this.lum == null ? 0.2 : this.lum;
        const offC = lum > 0.5 ? 0.62 : 0.22;
        const v = offC + (1.0 - offC) * k.level;
        k.led.disc.material.color.setRGB(v, v, v * 1.02);
        k.led.glow.material.opacity = k.level * (lum > 0.5 ? 0.35 : 0.9);
        k.led.glow.visible = k.level > 0.02;
        k.led.disc.visible = k.vis > 0.2;
      }

      if (!this.full) return;

      // modules fly in from the right (like before), hover just in front of their slot,
      // the frame then extends underneath them and they click into place —
      // so the frame never shows an empty area
      const n = Math.max(1, Math.min(4, st.modules || 1));
      let frameN = 1;
      const ez = (t) => t * t * (3 - 2 * t);
      this.mods.forEach((m, idx) => {
        const r = Math.max(0, Math.min(1, n - 1 - idx));
        const fly = ez(Math.min(1, r / 0.6));
        const grow = ez(Math.max(0, Math.min(1, (r - 0.6) / 0.25)));
        const seat = ez(Math.max(0, Math.min(1, (r - 0.85) / 0.15)));
        m.reveal = fly; frameN += grow;
        m.g.visible = r > 0.002;
        m.g.position.x = (idx + 1) * PITCH + (1 - fly) * 7;
        m.g.position.z = (1 - seat) * 1.1;
        const sc = 0.6 + 0.4 * fly; m.g.scale.set(sc, sc, sc);
      });
      this.setFrameModules(frameN);
      const span = (frameN - 1) * PITCH;
      this.frameWrap.position.x = span / 2;
      this.panel.position.x = -span / 2;
      this.mods.forEach((m) => {
        const e = m.reveal;
        if (m.kind === 'dimmer') {
          const lvl = 0.5 + 0.45 * Math.sin(time * 1.1);
          m.dots.forEach((d) => {
            if (d.arrow) { d.arrow.material.opacity = e * (0.25 + 0.55 * Math.max(0, Math.sin(time * 1.1 + Math.PI / 2))); d.arrow.rotation.z = d.j ? Math.PI : 0; return; }
            const lit = (7 - d.d) / 8 < (d.j ? 1 - lvl : lvl) ? 1 : 0.18;
            d.m.material.opacity = e * lit;
          });
        }
        if (m.kind === 'thermo') {
          const target = 18 + 7 * e;
          const tt = Math.round(target * 2) / 2;
          if (tt !== m.temp) { m.temp = tt; m.disp.draw(tt); }
        }
      });

      // exploded view
      const ex = Math.max(0, Math.min(1, st.explode || 0));
      const ee = ex < 0.5 ? 4 * ex * ex * ex : 1 - Math.pow(-2 * ex + 2, 3) / 2;
      this.keysWrap.position.z = ee * 10.5; this.keysWrap.position.y = ee * 1.2;
      this.frameWrap.position.z = ee * 6.3; this.frameWrap.position.y = ee * 0.7;
      const grow = Math.min(1, ex / 0.22);
      const gs = grow * grow * (3 - 2 * grow);
      this.internals.forEach((p) => {
        p.obj.visible = ex > 0.002;
        p.obj.position.z = p.z0 + ee * p.dz; p.obj.position.y = ee * p.dy;
        const s = 0.001 + gs * 0.999; p.obj.scale.set(s, s, s);
      });
    }

    /* world-space anchor for labels */
    layerAnchor(i, out) {
      const L = this.layers[i];
      let obj, half = L.half;
      if (L.name === 'keys') obj = this.keysWrap;
      else if (L.name === 'frame') obj = this.frameWrap;
      else obj = L.obj;
      out.set(0, (i % 2 ? -1 : 1) * (half + 0.25), 0);
      obj.updateWorldMatrix(true, false);
      return obj.localToWorld(out);
    }
    moduleAnchor(i, out) {
      // i = 0 → main switch, 1..3 → extra modules ; bottom-center of each module
      const x = i === 0 ? 0 : this.mods[i - 1].g.position.x;
      out.set(x, -OUTER / 2 - 0.2, 0);
      this.panel.updateWorldMatrix(true, false);
      return this.panel.localToWorld(out);
    }
  }

  global.Switch3D = { SwitchModel, makeEnvironment, FINISH, LAYOUT, OUTER, PITCH, A };
})(window);
