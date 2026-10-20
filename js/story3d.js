/* =========================================================================
   Animated exploded views for the "Highlights" story.
   Replaces the catalogue's exploded pictures with a detailed 3D model that
   turns round and takes itself apart as the row scrolls into view.
   Parts follow the Simon catalogues (1 unit = 10 mm):
     · J-type kit (M3 · E3 · E6): rocker, base plate (tray with holes, rails,
       snap clips), J-type toggle (copper rod + coil spring + plunger),
       two terminal assemblies (steel clamp, screw, copper strip, silver
       contact) and the mechanism housing.
     · M1 kit: panel, frame, lever transmission block, brass current-carrying
       parts (screws, clamps, brass links) and the integrated housing.
   ========================================================================= */
(function () {
  'use strict';
  const els = Array.from(document.querySelectorAll('.st-3d'));
  if (!els.length || !window.THREE || !window.Switch3D || !window.SimonKits) return;
  const T = THREE;
  const D = JSON.parse(document.getElementById('series-data').textContent);
  const { makeEnvironment } = window.Switch3D;
  const { rrect, keyGeometry } = window.Switch3D.helpers;
  const SNAP = /[?&]snap/.test(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ez = (t) => t * t * (3 - 2 * t);
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const MODEL = D.model || {};
  const FI = D.defaults && D.finishes && D.finishes[D.defaults.finish] ? D.defaults.finish : 0;
  const FIN = (D.finishes && D.finishes[FI] && D.finishes[FI].hex) || '#eeeeec';

  /* ---------------- per-view setup ---------------- */
  const views = [];
  els.forEach((el) => {
    let cfg = {};
    try { cfg = JSON.parse(el.dataset.ex || '{}'); } catch (e) { cfg = {}; }
    const canvas = el.querySelector('canvas');
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { el.classList.add('st-3d-off'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const scene = new T.Scene();
    scene.environment = makeEnvironment(renderer);
    const camera = new T.PerspectiveCamera(26, 1, 0.1, 400);
    const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(-6, 9, 10);
    const rim = new T.DirectionalLight(0xd4ddff, 0.9); rim.position.set(9, 2, -6);
    const back = new T.DirectionalLight(0xffffff, 0.9); back.position.set(-6, 4, -10);
    const fill = new T.DirectionalLight(0xffffff, 0.6); fill.position.set(4, 2, 12);
    scene.add(key, rim, back, fill, new T.HemisphereLight(0xffffff, 0x1a1a1a, 0.45));
    // each series has its own kit, taken from its own brochure (kits3d.js)
    const kit = window.SimonKits.build(cfg.kit || (MODEL.kind === 'm1' ? 'm1' : 'm3'), cfg.kit === 'i7' ? 4 : 1);
    const K = kit.meta, parts = kit.parts, twin = false;
    const asm = kit.group;
    const pivot = new T.Group(); pivot.add(asm); scene.add(pivot);
    // final viewing angle, as in the catalogue: the J-type kit is shown from the back (all inner parts visible),
    // the M1 kit and the twinset from the front
    const yaw = K.yaw;
    const labWrap = el.querySelector('.st-labs');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'st-lines'); labWrap.appendChild(svg);
    const labels = Object.entries(cfg.labels || {}).filter(([k]) => parts[k]).map(([k, txt]) => {
      const d = document.createElement('div'); d.className = 'st-lab'; d.innerHTML = '<span></span>';
      d.querySelector('span').textContent = txt; labWrap.appendChild(d);
      const dot = document.createElement('i'); dot.className = 'st-dot'; labWrap.appendChild(dot);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path'); svg.appendChild(line);
      return { k, d, dot, line };
    });
    views.push({ el, renderer, scene, camera, parts, asm, pivot, twin, yaw, labels, K, kit, vis: false, ex: 0, dist: 40, w: 0, h: 0, box: new T.Box3(), c: new T.Vector3(), s: new T.Sphere() });
  });
  if (!views.length) return;

  const io = new IntersectionObserver((es) => es.forEach((en) => { const v = views.find((x) => x.el === en.target); if (v) v.vis = en.isIntersecting; }), { rootMargin: '120px 0px' });
  views.forEach((v) => io.observe(v.el));

  const tmp = new T.Vector3();
  function anchor(v, k, out) {
    const p = v.parts[k]; const o = p.obj || p.g; const a = p.obj ? [0, 0, 0] : p.a || [0, 0, 0];
    out.set(a[0], a[1], a[2]); o.updateWorldMatrix(true, false); return o.localToWorld(out);
  }
  function size(v) {
    const r = v.el.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== v.w || h !== v.h) { v.w = w; v.h = h; v.labels.forEach((L) => (L.tw = 0)); v.renderer.setSize(w, h, false); v.camera.aspect = w / h; v.camera.updateProjectionMatrix(); }
    return r;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000, vh = innerHeight;
    views.forEach((v) => {
      if (!v.vis) return;
      const r = size(v);
      // scroll progress through the viewport: 0 = entering at the bottom, 1 = leaving at the top
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      const target = reduced ? 1 : ez(clamp((p - 0.16) / 0.36, 0, 1));
      v.ex += (target - v.ex) * (SNAP ? 1 : Math.min(1, dt * 6));
      const e = eio(v.ex);
      // parts slide out one after another (front first)
      const keys = Object.keys(v.parts), n = keys.length;
      window.SimonKits.pose(v.kit, e);
      // the switch turns from a front view to the catalogue angle while it opens up
      const y0 = v.K.start != null ? v.K.start : 0.5;
      const yaw = y0 + (v.yaw - y0) * eio(clamp(v.ex / 0.5, 0, 1));
      v.pivot.rotation.set(0.16 + ((v.K.tilt || 0.24) - 0.16) * v.ex, yaw + (reduced ? 0 : Math.sin(t * 0.35) * 0.05), 0);
      // frame the whole model
      v.pivot.position.set(0, 0, 0); v.pivot.updateMatrixWorld(true);
      v.box.setFromObject(v.asm); v.box.getCenter(v.c); v.box.getBoundingSphere(v.s);
      v.pivot.position.sub(v.c);
      const fov = T.MathUtils.degToRad(v.camera.fov) / 2;
      const need = v.s.radius / Math.sin(Math.min(fov, Math.atan(Math.tan(fov) * v.camera.aspect))) * 0.68;
      v.dist += (need - v.dist) * (SNAP ? 1 : Math.min(1, dt * 5));
      const sx = -v.dist * 0.05 * v.ex * (v.K.shift != null ? v.K.shift : 1); v.camera.position.set(sx, 0, v.dist); v.camera.lookAt(sx, 0, 0);
      v.pivot.updateMatrixWorld(true);
      // labels: a dot on the part, the tag in a side column, joined by a thin leader line
      const la = clamp((v.ex - 0.6) / 0.3, 0, 1);
      v.labels.forEach((L) => {
        anchor(v, L.k, tmp); tmp.project(v.camera);
        L.x = (tmp.x * 0.5 + 0.5) * v.w; L.y = (-tmp.y * 0.5 + 0.5) * v.h;
        L.right = v.K.right.includes(L.k); L.ty = L.y;
        if (!L.tw) L.tw = L.d.querySelector('span').offsetWidth || 120;
      });
      [true, false].forEach((side) => {
        const g = v.labels.filter((L) => L.right === side).sort((a, b) => a.y - b.y);
        if (side) g.forEach((L, k) => (L.ty = 24 + k * 30));
        for (let k = 1; k < g.length; k++) if (g[k].ty < g[k - 1].ty + 30) g[k].ty = g[k - 1].ty + 30;
        const over = g.length ? g[g.length - 1].ty - (v.h - 22) : 0;
        if (over > 0) g.forEach((L) => (L.ty -= over));
      });
      const Mg = 14;
      v.labels.forEach((L, i) => {
        const o = la * (0.4 + 0.6 * clamp((v.ex - 0.6 - i * 0.05) / 0.25, 0, 1));
        const tx = L.right ? v.w - Mg - L.tw : Mg;
        L.dot.style.transform = `translate3d(${L.x.toFixed(1)}px,${L.y.toFixed(1)}px,0)`;
        L.d.style.transform = `translate3d(${tx.toFixed(1)}px,${(L.ty - 11).toFixed(1)}px,0)`;
        const ex2 = L.right ? tx - 4 : tx + L.tw + 4;
        L.line.setAttribute('d', `M${L.x.toFixed(1)} ${L.y.toFixed(1)} L${(L.right ? Math.max(L.x, ex2 - 16) : Math.min(L.x, ex2 + 16)).toFixed(1)} ${L.ty.toFixed(1)} L${ex2.toFixed(1)} ${L.ty.toFixed(1)}`);
        L.d.style.opacity = L.dot.style.opacity = o.toFixed(3); L.line.style.opacity = (o * 0.6).toFixed(3);
      });
      v.el.classList.toggle('done', v.ex > 0.6);
      v.renderer.render(v.scene, v.camera);
    });
  }
  requestAnimationFrame((n) => { last = n; frame(n); });
})();
