/* =========================================================================
   Simon M7 & Simon M3 — procedural 3D models (uses Switch3D helpers)
   ========================================================================= */
(function (global) {
  'use strict';
  const T = THREE;
  const { rrect, keyGeometry, resources } = global.Switch3D.helpers;
  const P = 8.6;                     // 86 × 86 mm plate (1 unit = 10 mm)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ez = (t) => t * t * (3 - 2 * t);

  /* key rectangles for 1–4 gang on a w×h area */
  function rects(n, W, H, gap) {
    const w = (W - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => [-W / 2 + w / 2 + i * (w + gap), 0, w, H]);
  }

  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  let BRUSH = null, HALO = null, LOGO = null;
  function brushTex() {
    if (BRUSH) return BRUSH;
    BRUSH = canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const y = Math.random() * h, g = 90 + Math.random() * 90;
        x.fillStyle = `rgba(${g},${g},${g},${0.15 + Math.random() * 0.3})`;
        x.fillRect(0, y, w, 0.6 + Math.random() * 1.4);
      }
    });
    BRUSH.wrapS = BRUSH.wrapT = T.RepeatWrapping; BRUSH.repeat.set(0.12, 0.12);
    return BRUSH;
  }
  function haloTex() {
    if (HALO) return HALO;
    HALO = canvasTex(128, 256, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.save(); x.translate(0, 0); x.scale(1, h / w); x.fillStyle = g; x.fillRect(0, 0, w, w); x.restore();
    });
    return HALO;
  }
  function logoTex() {
    if (LOGO) return LOGO;
    LOGO = canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = '#fff'; x.font = '700 40px Archivo, Arial, sans-serif'; x.textAlign = 'right'; x.textBaseline = 'middle';
      x.fillText('simon', w - 6, h / 2);
    }, true);
    return LOGO;
  }

  /* =======================================================================
     Simon M7 — frameless ultra-slim plate · Gem (glass) / Metal / Air (PC)
     ======================================================================= */
  const M7_MATERIALS = {
    air: { name: 'M7 Air', sub: 'Polycarbonate', finishes: [['Platinum White', '#ebe9e5', '6R'], ['Platinum Silver', '#c4c6c8', '6Q'], ['Platinum Grey', '#76787b', '26']] },
    metal: { name: 'M7 Metal', sub: 'Metal', finishes: [['Brushed Grey', '#8a8c8f', '2B'], ['Frosted Silver', '#c8cacd', '2A'], ['Satin Gold', '#c6aa79', '2C']] },
    gem: { name: 'M7 Gem', sub: 'Glass', finishes: [['Diamond White', '#f2f2f2', '4F'], ['Diamond Silver', '#b2b5b9', '4E'], ['Diamond Grey', '#3c3e43', '4D']] },
  };

  function m7Material(kind) {
    const R = resources();
    if (kind === 'metal') {
      const b = brushTex();
      return new T.MeshPhysicalMaterial({ color: 0x8a8c8f, metalness: 0.92, roughness: 0.42, roughnessMap: b, bumpMap: b, bumpScale: 0.35, clearcoat: 0.15, clearcoatRoughness: 0.4, envMapIntensity: 1.25 });
    }
    if (kind === 'gem') {
      return new T.MeshPhysicalMaterial({ color: 0x3c3e43, metalness: 0.05, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, ior: 1.52, envMapIntensity: 1.6 });
    }
    return new T.MeshPhysicalMaterial({ color: 0xebe9e5, metalness: 0.0, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.45, bumpMap: R.noise, bumpScale: 0.25, envMapIntensity: 1.0 });
  }

  class M7Model {
    constructor(opts) {
      opts = opts || {};
      this.kind = 'm7';
      this.group = new T.Group();
      this.panel = new T.Group(); this.group.add(this.panel);
      this.matKind = opts.material || 'air';
      this.faceMat = m7Material(this.matKind);
      this.baseMat = new T.MeshPhysicalMaterial({ color: 0xcfcfcf, roughness: 0.5, metalness: 0.1 });
      // slim base (the part that sits on the wall)
      const base = new T.Mesh(keyGeometry(P, P, 0.34, 0.42, 0.05), this.baseMat);
      base.position.z = -0.2; this.panel.add(base); this.base = base;
      this.keysWrap = new T.Group(); this.panel.add(this.keysWrap);
      // logo
      this.logo = new T.Mesh(new T.PlaneGeometry(0.95, 0.24), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.38, depthWrite: false }));
      this.logo.position.set(P / 2 - 0.62, -P / 2 + 0.34, 0.006); this.panel.add(this.logo);
      this.keys = []; this.gang = 0;
      this.setGang(opts.gang || 2);
      if (opts.color) this.setColorHex(opts.color);
      this.ledOn = 0; // indicator colour mix (0 white/off → 1 orange/on)
    }
    setMaterial(kind) {
      if (kind === this.matKind) return;
      const col = this.faceMat.color.clone();
      this.faceMat.dispose(); this.faceMat = m7Material(kind); this.faceMat.color.copy(col);
      this.matKind = kind;
      this.keys.forEach((k) => (k.mesh.material = this.faceMat));
    }
    setColorRGB(rgb) {
      this.faceMat.color.setRGB(rgb[0], rgb[1], rgb[2]);
      const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      this.baseMat.color.setRGB(rgb[0] * 0.82, rgb[1] * 0.82, rgb[2] * 0.82);
      this.logo.material.color.setScalar(lum > 0.45 ? 0.15 : 1);
      this.lum = lum;
    }
    setColorHex(hex) { const c = new T.Color(hex); this.setColorRGB([c.r, c.g, c.b]); }
    setGang(n) {
      if (n === this.gang) return;
      this.gang = n;
      this.keys.forEach((k) => { k.mesh.geometry.dispose(); this.keysWrap.remove(k.g); });
      const prev = this.keys; this.keys = [];
      rects(n, P - 0.02, P - 0.02, 0.07).forEach((r, i) => {
        const g = new T.Group(); g.position.set(r[0], r[1], 0);
        const mesh = new T.Mesh(keyGeometry(r[2], r[3], 0.24, i === 0 || n === 1 ? 0.2 : 0.12, 0.035), this.faceMat);
        mesh.userData.keyIndex = i; g.add(mesh);
        const ind = new T.Mesh(new T.PlaneGeometry(0.58, 0.075), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true }));
        ind.position.set(0, -r[3] / 2 + Math.min(1.25, r[3] * 0.3), 0.004); g.add(ind);
        this.keysWrap.add(g);
        const was = prev[i];
        this.keys.push({ g, mesh, ind, w: r[2], h: r[3], on: was ? was.on : i % 2 === 0, mix: was ? was.mix : 0, pressT: 0 });
      });
      this.pop = 1;
    }
    press(i) { const k = this.keys[i]; if (!k) return; k.on = !k.on; k.pressT = 1; }
    get pressables() { return this.keys.map((k) => k.mesh); }
    update(st, dt) {
      if (st.col) this.setColorRGB(st.col);
      if (st.gang) this.setGang(Math.round(st.gang));
      if (st.material) this.setMaterial(st.material);
      this.pop = Math.max(0, (this.pop || 0) - dt * 3);
      this.keysWrap.position.z = -0.08 * Math.sin(this.pop * Math.PI);
      const showInd = st.indicator == null ? 1 : st.indicator;
      this.keys.forEach((k) => {
        if (k.pressT > 0) { k.pressT = Math.max(0, k.pressT - dt / 0.3); const u = 1 - k.pressT; k.g.position.z = -0.07 * (u < 0.25 ? u / 0.25 : Math.pow(1 - (u - 0.25) / 0.75, 2)); }
        else k.g.position.z = 0;
        k.mix += ((k.on ? 1 : 0) - k.mix) * Math.min(1, dt * 9);
        // orange = ON, white = OFF (as in the M7 catalog)
        const r = 1, g = 1 - k.mix * 0.45, b = 1 - k.mix * 0.85;
        const dim = 0.55 + 0.45 * k.mix;
        k.ind.material.color.setRGB(r * dim, g * dim, b * dim);
        k.ind.material.opacity = showInd;
      });
    }
    footprint() { return [P, P]; }
    anchor(name, out) {
      const k0 = this.keys[0];
      if (name === 'indicator') out.set(k0.g.position.x, k0.g.position.y + k0.ind.position.y + 0.6, 0.05);
      else if (name === 'key2') { const kl = this.keys[this.keys.length - 1]; out.set(kl.g.position.x, kl.g.position.y + kl.h * 0.18, 0.1); }
      else if (name === 'edge') out.set(P / 2, 0, -0.1);
      else if (name === 'corner') out.set(P / 2 - 0.5, -P / 2 + 0.5, 0.05);
      else if (name === 'bottom') out.set(0, -P / 2, 0);
      else out.set(k0.g.position.x, k0.g.position.y + 0.6, 0.1);
      this.panel.updateWorldMatrix(true, false);
      return this.panel.localToWorld(out);
    }
  }

  /* =======================================================================
     Simon M3 — large frameless rocker panel, 0.9 mm indicator bar,
     J-type toggle (4.5°), silver alloy contacts, integral terminals
     ======================================================================= */
  const M3_FINISHES = [['White', '#eeeeec', ''], ['Champagne', '#d4c19c', '-46'], ['Grey', '#8c8e91', '-61'], ['Black', '#252527', '-26'], ['Vintage Gold', '#b39867', ''], ['Space Grey', '#5b5d61', '']];
  const TILT = T.MathUtils.degToRad(2.25); // ±2.25° → 4.5° travel

  class M3Model {
    constructor(opts) {
      opts = opts || {};
      this.kind = opts.kind || 'm3';
      this.area = opts.area || P - 0.36;          // size of the rocker field
      this.hasInd = opts.indicator !== false;     // indicator / fluorescent bar
      this.rockerDepth = opts.rockerDepth || 0.3;
      this.rockerRadius = opts.rockerRadius || 0.08;
      this.gap = opts.gap || 0.06;
      this.indStyle = opts.indStyle || 'bar';
      this.indOnGlow = !!opts.indOnGlow;      // indicator only shown while a feature lights it (E6 LED version)
      this.logoOnKey = !!opts.logoOnKey;
      const R = resources();
      this.group = new T.Group();
      this.panel = new T.Group(); this.group.add(this.panel);
      this.faceMat = new T.MeshPhysicalMaterial({ color: 0xeeeeec, roughness: 0.38, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.35, bumpMap: R.noise, bumpScale: 0.2 });
      this.baseMat = new T.MeshPhysicalMaterial({ color: 0xdedede, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4 });
      // base plate with a slim contour
      this.base = new T.Group();
      const BS = opts.baseSize || P;
      if (opts.wing) {
        // E3 "wing" plate: 2.4 mm thin floating edge rising to the key field (8.3 mm overall)
        const edge = new T.Mesh(keyGeometry(BS, BS, 0.24, opts.baseRadius || 0.16, 0.04), this.baseMat); edge.position.z = -0.49; this.base.add(edge);
        const hb = BS / 2 - 0.12, ht = this.area / 2 + 0.22, hh = 0.41;
        const fr = new T.CylinderGeometry(ht * Math.SQRT2, hb * Math.SQRT2, hh, 4, 1); fr.rotateY(Math.PI / 4); fr.rotateX(Math.PI / 2); fr.translate(0, 0, -0.49 + hh / 2);
        fr.computeVertexNormals();
        this.base.add(new T.Mesh(fr, this.baseMat));
      } else {
        const bm = new T.Mesh(keyGeometry(BS, BS, opts.baseDepth || 0.62, opts.baseRadius || 0.16, 0.05), this.baseMat); bm.position.z = opts.baseZ != null ? opts.baseZ : -0.08; this.base.add(bm);
      }
      if (opts.rim) {
        // ultra-thin raised frame around the rockers (E6: 1.2 mm)
        const sh = rrect(P, P, opts.baseRadius || 0.16);
        sh.holes.push(rrect(this.area + 0.04, this.area + 0.04, 0.06, 0, 0, T.Path));
        const rg = new T.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 });
        rg.translate(0, 0, 0.0);
        this.rimMesh = new T.Mesh(rg, this.faceMat); this.base.add(this.rimMesh);
      }
      this.panel.add(this.base);
      this.rockersWrap = new T.Group(); this.panel.add(this.rockersWrap);
      this.logo = new T.Mesh(new T.PlaneGeometry(0.8, 0.2), new T.MeshBasicMaterial({ map: logoTex(), transparent: true, opacity: 0.3, depthWrite: false }));
      this.logo.position.set(P / 2 - 0.62, -P / 2 + 0.38, 0.08);
      if (!this.logoOnKey) this.panel.add(this.logo);
      this.rockers = []; this.gang = 0; this.glow = 0;
      this.setGang(opts.gang || 1);
      this._buildInternals();
      this.explode = 0;
    }
    setColorRGB(rgb) {
      this.faceMat.color.setRGB(rgb[0], rgb[1], rgb[2]);
      this.baseMat.color.setRGB(rgb[0] * 0.92, rgb[1] * 0.92, rgb[2] * 0.92);
      const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      this.logo.material.color.setScalar(lum > 0.45 ? 0.2 : 1); this.lum = lum;
    }
    setGang(n) {
      if (n === this.gang) return;
      this.gang = n;
      this.rockers.forEach((r) => { r.mesh.geometry.dispose(); this.rockersWrap.remove(r.g); });
      const prev = this.rockers; this.rockers = [];
      rects(n, this.area, this.area, this.gap).forEach((r, i) => {
        const g = new T.Group(); g.position.set(r[0], r[1], 0.0);
        const rad = n === 1 ? this.rockerRadius : Math.min(this.rockerRadius, 0.12);
        const mesh = new T.Mesh(keyGeometry(r[2], r[3], this.rockerDepth, rad, 0.05), this.faceMat);
        mesh.position.z = 0.1; mesh.userData.keyIndex = i; g.add(mesh);
        const dash = this.indStyle === 'dash';
        const dotS = this.indStyle === 'dot';
        const bar = new T.Mesh(dotS ? new T.CircleGeometry(0.075, 20) : dash ? new T.PlaneGeometry(0.42, 0.055) : new T.PlaneGeometry(0.075, 0.46), new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
        const bx = dash || dotS ? 0 : -r[2] / 2 + 0.34, by = dotS ? r[3] / 2 - 0.75 : dash ? r[3] / 2 - 0.5 : r[3] / 2 - 0.6;
        bar.position.set(bx, by, 0.104); bar.visible = this.hasInd; g.add(bar);
        const halo = new T.Mesh(dotS ? new T.PlaneGeometry(0.7, 0.7) : dash ? new T.PlaneGeometry(1.05, 0.5) : new T.PlaneGeometry(0.5, 1.05), new T.MeshBasicMaterial({ map: haloTex(), color: 0xf3f6ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
        halo.position.set(bx, by, 0.106); halo.visible = this.hasInd; g.add(halo);
        this.rockersWrap.add(g);
        const was = prev[i];
        this.rockers.push({ g, mesh, bar, halo, w: r[2], h: r[3], on: was ? was.on : true, ang: was ? was.ang : -TILT, mix: was ? was.mix : 1 });
      });
      if (this.logoOnKey) {
        // the logo is printed on the (last) rocker, bottom-right
        const last = this.rockers[this.rockers.length - 1];
        last.g.add(this.logo);
        this.logo.position.set(P / 2 - 0.62 - last.g.position.x, -P / 2 + 0.36 - last.g.position.y, 0.104);
      }
    }
    press(i) { const r = this.rockers[i]; if (r) r.on = !r.on; }
    get pressables() { return this.rockers.map((r) => r.mesh); }

    _buildInternals() {
      const white = new T.MeshPhysicalMaterial({ color: 0xf1f1ef, roughness: 0.5, clearcoat: 0.2 });
      const silver = new T.MeshPhysicalMaterial({ color: 0xe4e6ea, metalness: 1, roughness: 0.18, envMapIntensity: 1.6 });
      const brass = new T.MeshPhysicalMaterial({ color: 0xc9935a, metalness: 1, roughness: 0.3 });
      const steel = new T.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 0.95, roughness: 0.3 });
      const parts = [];
      // J-type toggle lever
      const lever = new T.Group();
      const curve = new T.CatmullRomCurve3([new T.Vector3(0, 1.6, 0), new T.Vector3(0, 0.2, 0), new T.Vector3(0, -0.9, 0.1), new T.Vector3(0.1, -1.5, 0.6), new T.Vector3(0.15, -1.3, 1.1)]);
      lever.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.11, 10, false), steel));
      const pivot = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 1.6, 18), steel); pivot.rotation.z = Math.PI / 2; pivot.position.y = 0.2; lever.add(pivot);
      parts.push({ name: 'lever', obj: lever, z0: -0.5, dz: 1.2, x: -1.4, label: 'J-type toggle mechanism' });
      // silver alloy contacts on brass arms
      const contacts = new T.Group();
      [-0.55, 0.55].forEach((y) => {
        const arm = new T.Mesh(new T.BoxGeometry(1.5, 0.28, 0.12), brass); arm.position.set(0, y, 0); contacts.add(arm);
        const c = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.1, 24), silver); c.rotation.x = Math.PI / 2; c.position.set(0.6, y, 0.11); contacts.add(c);
      });
      parts.push({ name: 'contacts', obj: contacts, z0: -1.0, dz: -1.2, x: 1.3, label: 'Silver alloy contacts' });
      // mechanism body
      const mech = new T.Group();
      const body = new T.Mesh(keyGeometry(6.4, 6.4, 2.4, 0.4, 0.08), white); body.position.z = -0.1; mech.add(body);
      const plate = new T.Mesh(keyGeometry(P - 0.6, P - 0.6, 0.12, 0.3, 0.02), steel); plate.position.z = 0.08; mech.add(plate);
      parts.push({ name: 'mech', obj: mech, z0: -0.75, dz: -4.0, x: 0, label: 'Mechanism' });
      // integral wiring terminals
      const term = new T.Group();
      [-1.3, 1.3].forEach((x) => {
        const blk = new T.Mesh(new T.BoxGeometry(1.0, 1.3, 0.9), brass); blk.position.set(x, 0, 0); term.add(blk);
        const sc = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.18, 20), steel); sc.rotation.x = Math.PI / 2; sc.position.set(x, 0.1, 0.52); term.add(sc);
        const slot = new T.Mesh(new T.BoxGeometry(0.4, 0.06, 0.04), new T.MeshStandardMaterial({ color: 0x222222 })); slot.position.set(x, 0.1, 0.62); term.add(slot);
      });
      parts.push({ name: 'terminals', obj: term, z0: -2.2, dz: -6.6, x: 0, y: -2.2, label: 'Integral wiring terminals' });
      parts.forEach((p) => { p.obj.visible = false; this.panel.add(p.obj); });
      this.parts = parts;
    }

    update(st, dt) {
      if (st.col) this.setColorRGB(st.col);
      if (st.gang) this.setGang(Math.round(st.gang));
      const glow = st.glow || 0;
      this.rockers.forEach((r) => {
        const target = r.on ? -TILT : TILT;
        r.ang += (target - r.ang) * Math.min(1, dt * 14);
        r.g.rotation.x = r.ang;
        r.mix += ((r.on ? 1 : 0) - r.mix) * Math.min(1, dt * 8);
        const v = 0.35 + 0.65 * r.mix;
        r.bar.material.color.setRGB(v * 0.95, v * 0.98, v);
        r.halo.material.opacity = glow * r.mix * 0.3;
        if (this.indOnGlow) { r.bar.visible = r.halo.visible = glow > 0.02; r.bar.material.opacity = 1; }
      });
      // exploded view
      const ex = clamp(st.explode || 0, 0, 1);
      const ee = ex < 0.5 ? 4 * ex * ex * ex : 1 - Math.pow(-2 * ex + 2, 3) / 2;
      this.rockersWrap.position.z = ee * 6.5 + (st.lift || 0) * 2.6;
      this.rockersWrap.rotation.y = (st.lift || 0) * -0.5;
      this.base.position.z = ee * 3.2;
      if (!this.logoOnKey) this.logo.position.z = 0.08 + ee * 3.2;
      const gs = ez(Math.min(1, ex / 0.22));
      this.parts.forEach((p) => {
        p.obj.visible = ex > 0.002;
        p.obj.position.set((p.x || 0) * ee, (p.y || 0) * ee, p.z0 + ee * p.dz);
        const s = 0.001 + gs * 0.999; p.obj.scale.set(s, s, s);
      });
    }
    footprint(st) { const e = (st && st.explode) || 0; return [P + e * 13, P + e * 6]; }
    anchor(name, out) {
      const r0 = this.rockers[0];
      const part = this.parts.find((p) => p.name === name);
      if (part) { out.set(0, 0, 0); part.obj.updateWorldMatrix(true, false); return part.obj.localToWorld(out); }
      if (name === 'indicator') { out.set(r0.bar.position.x + 0.7, r0.bar.position.y - 0.35, 0.12); r0.g.updateWorldMatrix(true, false); return r0.g.localToWorld(out); }
      if (name === 'edge') out.set(P / 2, 0, 0);
      else if (name === 'rim') out.set(P / 2 - (P - this.area) / 4, P * 0.18, 0.14);
      else if (name === 'corner') out.set(P / 2 - 0.5, -P / 2 + 0.5, 0.1);
      else if (name === 'bottom') out.set(0, -P / 2, 0);
      else if (name === 'rocker') { out.set(0, r0.h * 0.2, 0.2); r0.g.updateWorldMatrix(true, false); return r0.g.localToWorld(out); }
      else if (name === 'center') { out.set(r0.w * 0.12, -r0.h * 0.05, 0.2); r0.g.updateWorldMatrix(true, false); return r0.g.localToWorld(out); }
      else if (name === 'lower') { out.set(-r0.w * 0.15, -r0.h * 0.3, 0.2); r0.g.updateWorldMatrix(true, false); return r0.g.localToWorld(out); }
      else out.set(r0.g.position.x, r0.g.position.y, 0.2);
      this.panel.updateWorldMatrix(true, false);
      return this.panel.localToWorld(out);
    }
  }

  global.Series3D = { M7Model, M3Model, M7_MATERIALS, M3_FINISHES, P };
})(window);
