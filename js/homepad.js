/* =========================================================================
   Simon Homepad Pro Max — Simple Smart Home
   3D panel with a live, tappable screen + scroll feature tour
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
  const WARM = '#ffb25e', COOL = '#7fb4ff';

  /* ---------------- renderer ---------------- */
  const canvas = $('#gl');
  let renderer = null;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { renderer = null; }
  if (!renderer) canvas.style.display = 'none';
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 0, 70);
  const VH = () => 2 * camera.position.z * Math.tan(T.MathUtils.degToRad(camera.fov / 2));
  scene.add(new T.HemisphereLight(0xffffff, 0x1a1a1a, 0.35));
  const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(-6, 9, 10); scene.add(key);
  const rim = new T.DirectionalLight(0xc9d6ff, 1.0); rim.position.set(9, 3, -6); scene.add(rim);
  if (renderer) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    scene.environment = Switch3D.makeEnvironment(renderer);
  }

  /* ---------------- smart-home state ---------------- */
  const S = {
    lights: { living: true, bedroom: false, kitchen: true },
    curtain: 1,           // 1 open, 0 closed
    ac: { on: true, temp: 24 },
    scene: null,
    call: 'none',         // none | ringing | open
    toast: '', toastT: 0,
  };
  const SCENES = {
    morning: { label: 'Good Morning', lights: { living: true, bedroom: true, kitchen: true }, curtain: 1, ac: { on: false, temp: 26 } },
    movie: { label: 'Movie', lights: { living: false, bedroom: false, kitchen: false }, curtain: 0, ac: { on: true, temp: 23 } },
    away: { label: 'Away', lights: { living: false, bedroom: false, kitchen: false }, curtain: 0, ac: { on: false, temp: 26 } },
  };
  function applyScene(k) {
    const sc = SCENES[k]; S.scene = k;
    Object.assign(S.lights, sc.lights); S.curtain = sc.curtain; Object.assign(S.ac, sc.ac);
    toast(sc.label + ' scene on');
  }
  function toast(t) { S.toast = t; S.toastT = 2.2; dirty = true; }
  let dirty = true;

  /* ---------------- screen UI (canvas) ---------------- */
  const SW = 1280, SH = 720;  // Homepad Pro display area: 237 × 133 mm
  function makeScreen(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return { c, x: c.getContext('2d'), tex, hits: [] };
  }
  const scr = makeScreen(SW, SH);
  const stars = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random()]);
  const cities = Array.from({ length: 260 }, () => [Math.random() * Math.PI * 2, Math.acos(Math.random() * 2 - 1), Math.random()]);
  const F = (w, s) => `${w} ${s}px Archivo, Arial, sans-serif`;
  function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  function clockStr() { const d = new Date(); return [String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })]; }

  function drawClock(s, t) {
    const x = s.x; x.fillStyle = '#020306'; x.fillRect(0, 0, SW, SH);
    stars.forEach(([a, b, c]) => { x.fillStyle = `rgba(255,255,255,${0.2 + 0.6 * c * (0.6 + 0.4 * Math.sin(t * 2 + c * 9))})`; x.fillRect(a * SW, b * SH, 1.6, 1.6); });
    // night earth
    const cx = SW * 0.78, cy = SH * 0.58, R = 330;
    const g = x.createRadialGradient(cx - 120, cy - 120, 40, cx, cy, R);
    g.addColorStop(0, '#1a2a4a'); g.addColorStop(0.7, '#0a1222'); g.addColorStop(1, '#03060c');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    const rot = t * 0.05;
    cities.forEach(([lon, lat, k]) => {
      const L = lon + rot, px = Math.sin(lat) * Math.cos(L), pz = Math.sin(lat) * Math.sin(L), py = Math.cos(lat);
      if (pz < 0.05) return;
      x.fillStyle = `rgba(255,${190 + k * 50},${110 + k * 60},${0.4 + 0.6 * pz})`;
      x.beginPath(); x.arc(cx + px * R * 0.98, cy - py * R * 0.98, 1.2 + k * 1.6, 0, 7); x.fill();
    });
    x.strokeStyle = 'rgba(120,170,255,0.55)'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R + 2, Math.PI * 0.95, Math.PI * 1.65); x.stroke();
    const [tm, dt] = clockStr();
    x.fillStyle = '#fff'; x.font = F(700, 210); x.fillText(tm, 90, 470);
    x.font = F(400, 40); x.fillStyle = 'rgba(255,255,255,0.8)'; x.fillText(`${dt}   ·   ${S.ac.temp}°C   ·   ${countOn()} lights on`, 96, 545);
    s.hits = [{ r: [0, 0, SW, SH], fn: () => { screenMode = 'dash'; userMode = 'dash'; } }];
  }
  function countOn() { return Object.values(S.lights).filter(Boolean).length; }

  function tile(x, X, Y, W, H, on, title, sub, icon, accent) {
    rr(x, X, Y, W, H, 26);
    x.fillStyle = on ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.08)'; x.fill();
    x.strokeStyle = on ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,0.12)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = on ? (accent || WARM) : 'rgba(255,255,255,0.18)';
    x.beginPath(); x.arc(X + 50, Y + 52, 26, 0, 7); x.fill();
    x.fillStyle = on ? '#111' : '#fff'; x.font = F(700, 30); x.textAlign = 'center'; x.fillText(icon, X + 50, Y + 63); x.textAlign = 'left';
    x.fillStyle = on ? '#111' : '#fff'; x.font = F(650, 32); x.fillText(title, X + 28, Y + H - 58);
    x.fillStyle = on ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.55)'; x.font = F(400, 24); x.fillText(sub, X + 28, Y + H - 24);
  }
  function drawDash(s, t) {
    const x = s.x, hits = [];
    const bg = x.createLinearGradient(0, 0, SW, SH); bg.addColorStop(0, '#0d1a33'); bg.addColorStop(1, '#05070d');
    x.fillStyle = bg; x.fillRect(0, 0, SW, SH);
    // left rail (as on the panel): home · devices · scenes · music · apps, Alexa at the bottom
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 96, SH);
    ['⌂', '▤', '✓', '♪', '▦'].forEach((ic, i) => { x.fillStyle = i === 0 ? '#fff' : 'rgba(255,255,255,0.45)'; x.font = F(600, 34); x.textAlign = 'center'; x.fillText(ic, 48, 92 + i * 96); x.textAlign = 'left'; });
    x.strokeStyle = '#2fd3f5'; x.lineWidth = 8; x.beginPath(); x.arc(48, SH - 62, 26, 0, 7); x.stroke();
    const [tm, dt] = clockStr();
    x.fillStyle = '#fff'; x.font = F(700, 64); x.fillText(tm, 128, 92);
    x.font = F(400, 26); x.fillStyle = 'rgba(255,255,255,0.65)'; x.fillText(`${dt} · Living room`, 132, 132);
    // intercom shortcut
    rr(x, SW - 250, 46, 200, 64, 32); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fill();
    x.fillStyle = '#fff'; x.font = F(600, 26); x.fillText('◉  Door', SW - 210, 88);
    hits.push({ r: [SW - 250, 46, 200, 64], fn: () => { S.call = 'ringing'; screenMode = 'intercom'; userMode = 'intercom'; } });
    // tiles
    const G = 20, X0 = 128, XR = 40, Y0 = 162, TW = (SW - X0 - XR - G * 3) / 4, TH = 214;
    const L = [['living', 'Living', '☀'], ['bedroom', 'Bedroom', '☀'], ['kitchen', 'Kitchen', '☀']];
    L.forEach(([k, n, ic], i) => {
      const X = X0 + i * (TW + G);
      tile(x, X, Y0, TW, TH, S.lights[k], n, S.lights[k] ? 'Light on' : 'Light off', ic);
      hits.push({ r: [X, Y0, TW, TH], fn: () => { S.lights[k] = !S.lights[k]; S.scene = null; } });
    });
    const Xc = X0 + 3 * (TW + G);
    tile(x, Xc, Y0, TW, TH, S.curtain > 0.5, 'Curtains', S.curtain > 0.5 ? 'Open' : 'Closed', '▥', '#9fd0ff');
    hits.push({ r: [Xc, Y0, TW, TH], fn: () => { S.curtain = S.curtain > 0.5 ? 0 : 1; S.scene = null; } });
    // climate
    const Y1 = Y0 + TH + G, CW = TW * 2 + G;
    rr(x, X0, Y1, CW, TH, 26); x.fillStyle = S.ac.on ? 'rgba(127,180,255,0.18)' : 'rgba(255,255,255,0.08)'; x.fill();
    x.fillStyle = '#fff'; x.font = F(650, 32); x.fillText('Climate', X0 + 28, Y1 + 52);
    x.font = F(400, 24); x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillText(S.ac.on ? 'Cooling · Auto' : 'Off', X0 + 28, Y1 + 86);
    x.font = F(700, 96); x.fillStyle = S.ac.on ? '#fff' : 'rgba(255,255,255,0.4)'; x.fillText(`${S.ac.temp}°`, X0 + 28, Y1 + 196);
    const bx = X0 + CW - 230;
    [['−', -1], ['+', 1]].forEach(([s2, d], i) => {
      const BX = bx + i * 110, BY = Y1 + 110;
      x.beginPath(); x.arc(BX + 46, BY + 46, 46, 0, 7); x.fillStyle = 'rgba(255,255,255,0.14)'; x.fill();
      x.fillStyle = '#fff'; x.font = F(500, 56); x.textAlign = 'center'; x.fillText(s2, BX + 46, BY + 66); x.textAlign = 'left';
      hits.push({ r: [BX, BY, 92, 92], fn: () => { S.ac.temp = clamp(S.ac.temp + d, 16, 30); S.ac.on = true; S.scene = null; } });
    });
    rr(x, X0 + CW - 120, Y1 + 30, 92, 50, 25); x.fillStyle = S.ac.on ? COOL : 'rgba(255,255,255,0.2)'; x.fill();
    x.beginPath(); x.arc(S.ac.on ? X0 + CW - 53 : X0 + CW - 95, Y1 + 55, 19, 0, 7); x.fillStyle = '#fff'; x.fill();
    hits.push({ r: [X0 + CW - 120, Y1 + 30, 92, 50], fn: () => { S.ac.on = !S.ac.on; S.scene = null; } });
    // scenes
    const SX = X0 + CW + G, SWd = SW - SX - XR;
    x.fillStyle = '#fff'; x.font = F(650, 30); x.fillText('Scenes', SX + 6, Y1 + 34);
    Object.entries(SCENES).forEach(([k, sc], i) => {
      const BY = Y1 + 54 + i * 60, on = S.scene === k;
      rr(x, SX, BY, SWd, 50, 25); x.fillStyle = on ? WARM : 'rgba(255,255,255,0.1)'; x.fill();
      x.fillStyle = on ? '#111' : '#fff'; x.font = F(600, 26); x.fillText(sc.label, SX + 26, BY + 34);
      hits.push({ r: [SX, BY, SWd, 50], fn: () => applyScene(k) });
    });
    // status bar
    const Y2 = Y1 + TH + G;
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = F(400, 24);
    x.fillText(`ZigBee & BLE · ${countOn()} lights on · ${S.ac.on ? 'AC ' + S.ac.temp + '°C' : 'AC off'} · curtains ${S.curtain > 0.5 ? "open" : "closed"}`, X0, Y2 + 30);
    s.hits = hits;
  }
  function drawIntercom(s, t) {
    const x = s.x, hits = [];
    // camera view (illustrated)
    const g = x.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, '#2a2f3a'); g.addColorStop(1, '#0d0f14');
    x.fillStyle = g; x.fillRect(0, 0, SW, SH);
    x.fillStyle = '#3b3f49'; x.fillRect(360, 120, 560, 740);
    x.fillStyle = '#1d2028'; x.fillRect(400, 160, 480, 700);
    x.fillStyle = '#c9a26a'; x.beginPath(); x.arc(840, 520, 12, 0, 7); x.fill();
    if (S.call === 'ringing') {
      x.fillStyle = 'rgba(10,10,12,0.85)'; x.beginPath(); x.ellipse(620, 470, 110, 130, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(620, 820, 230, 260, 0, Math.PI, 0); x.fill();
    }
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, 0, SW, 110);
    x.fillStyle = '#ff4d4d'; x.beginPath(); x.arc(56, 56, 10, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = F(650, 34); x.fillText('Front door', 82, 68);
    x.font = F(400, 26); x.fillStyle = 'rgba(255,255,255,0.7)';
    x.fillText(S.call === 'ringing' ? 'Someone is at the door' : S.call === 'open' ? 'Door unlocked' : 'Live view', SW - 360, 68);
    // buttons
    const B = (X, label, col, fn) => { rr(x, X, SH - 150, 300, 96, 48); x.fillStyle = col; x.fill(); x.fillStyle = '#fff'; x.font = F(650, 34); x.textAlign = 'center'; x.fillText(label, X + 150, SH - 90); x.textAlign = 'left'; hits.push({ r: [X, SH - 150, 300, 96], fn }); };
    if (S.call === 'open') {
      x.fillStyle = 'rgba(34,197,94,0.9)'; x.beginPath(); x.arc(SW / 2, 380, 90, 0, 7); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); x.moveTo(SW / 2 - 40, 382); x.lineTo(SW / 2 - 8, 414); x.lineTo(SW / 2 + 46, 350); x.stroke();
      B(SW / 2 - 150, 'Back home', 'rgba(255,255,255,0.18)', () => { S.call = 'none'; screenMode = 'dash'; userMode = 'dash'; });
    } else {
      B(SW / 2 - 330, 'Decline', '#d64545', () => { S.call = 'none'; screenMode = 'dash'; userMode = 'dash'; });
      B(SW / 2 + 30, 'Unlock', '#22a35a', () => { S.call = 'open'; toast('Door unlocked'); });
    }
    s.hits = hits;
  }
  function drawNetwork(s, t) {
    drawDash(s, t);
    const x = s.x;
    x.fillStyle = 'rgba(3,5,10,0.78)'; x.fillRect(0, 0, SW, SH);
    x.fillStyle = '#fff'; x.font = F(800, 150); x.textAlign = 'center'; x.fillText('100+', SW / 2, SH / 2 + 30);
    x.font = F(400, 34); x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillText('ZigBee & BLE devices on one panel', SW / 2, SH / 2 + 95); x.textAlign = 'left';
  }
  function drawSystem(s, t) {
    const x = s.x; s.hits = [];
    x.fillStyle = '#05070c'; x.fillRect(0, 0, SW, SH);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = F(600, 24); x.fillText('SYSTEM', 128, 120);
    // four cores working together
    x.fillStyle = '#fff'; x.font = F(800, 64); x.fillText('Quad-core', 128, 200);
    for (let i = 0; i < 4; i++) {
      const X = 128 + i * 120, H0 = 190, v = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7));
      rr(x, X, 250, 90, H0, 16); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fill();
      rr(x, X, 250 + H0 * (1 - v), 90, H0 * v, 16); x.fillStyle = '#7fb4ff'; x.fill();
      x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = F(500, 20); x.textAlign = 'center'; x.fillText('Core ' + (i + 1), X + 45, 475); x.textAlign = 'left';
    }
    x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = F(400, 24); x.fillText('Stable and smooth operation', 128, 530);
    // ample storage for more apps
    const R = 700;
    x.fillStyle = '#fff'; x.font = F(800, 64); x.fillText('Storage', R, 200);
    rr(x, R, 232, 450, 22, 11); x.fillStyle = 'rgba(255,255,255,0.1)'; x.fill();
    rr(x, R, 232, 450 * 0.32, 22, 11); x.fillStyle = '#9fe0b4'; x.fill();
    x.fillStyle = 'rgba(255,255,255,0.75)'; x.font = F(400, 24); x.fillText('Ample room for more apps', R, 290);
    const cols = ['#ff9f6b', '#7fb4ff', '#9fe0b4', '#f5d36b', '#c9a0ff', '#ff7f9e', '#6be0e0', '#e6e6e6'];
    for (let i = 0; i < 8; i++) {
      const X = R + (i % 4) * 116, Y = 330 + Math.floor(i / 4) * 116, pop = Math.min(1, Math.max(0, (t * 1.5) % 6 - i * 0.25));
      x.globalAlpha = 0.25 + 0.75 * pop; rr(x, X, Y, 92, 92, 24); x.fillStyle = cols[i]; x.fill(); x.globalAlpha = 1;
    }
  }
  function drawToast(s) {
    if (S.toastT <= 0) return;
    const x = s.x, a = Math.min(1, S.toastT * 2), ty = screenMode === 'intercom' ? 110 : SH - 110;
    x.globalAlpha = a; rr(x, SW / 2 - 230, ty, 460, 70, 35); x.fillStyle = 'rgba(255,255,255,0.95)'; x.fill();
    x.fillStyle = '#111'; x.font = F(650, 28); x.textAlign = 'center'; x.fillText(S.toast, SW / 2, ty + 46); x.textAlign = 'left'; x.globalAlpha = 1;
  }
  let screenMode = 'clock', userMode = null, lastDraw = 0;
  function drawScreen(t) {
    if (screenMode === 'clock') drawClock(scr, t);
    else if (screenMode === 'intercom') drawIntercom(scr, t);
    else if (screenMode === 'network') drawNetwork(scr, t);
    else if (screenMode === 'system') drawSystem(scr, t);
    else drawDash(scr, t);
    drawToast(scr);
    scr.tex.needsUpdate = true;
    // phone mirror
    const p = phone.x; p.fillStyle = '#05070d'; p.fillRect(0, 0, 360, 760);
    p.save(); p.translate(14, 210); p.scale(332 / SW, 332 / SW); p.drawImage(scr.c, 0, 0); p.restore();
    p.fillStyle = '#fff'; p.font = F(700, 34); p.fillText('Simon Smart', 24, 90);
    p.font = F(400, 18); p.fillStyle = 'rgba(255,255,255,0.6)'; p.fillText('Control anywhere', 24, 120);
    p.fillStyle = 'rgba(255,255,255,0.08)'; [0, 1, 2].forEach((i) => { rr(p, 24, 470 + i * 84, 312, 70, 18); p.fill(); });
    p.fillStyle = '#fff'; p.font = F(500, 20);
    p.fillText(`Lights on: ${countOn()}`, 44, 512); p.fillText(`Climate: ${S.ac.on ? S.ac.temp + '°C' : 'off'}`, 44, 596); p.fillText(`Curtains: ${S.curtain > 0.5 ? 'open' : 'closed'}`, 44, 680);
    phone.tex.needsUpdate = true;
  }
  const phone = makeScreen(360, 760);

  /* ---------------- 3D: Homepad Pro Max ---------------- */
  const root = new T.Group(); scene.add(root);
  const dev = new T.Group(); root.add(dev);
  /* Homepad Pro (Max) as installed: 259 × 161 × 13 mm — a black glass front in a thin gunmetal
     rim on a dark back body, with a separate champagne key strip on the right: two rockers,
     each with two "•••" press points. Scene scale: 1 mm = SC units. */
  const MM = 15.6 / 275;                      // panel 259 mm + strip 16 mm
  const BW = 259 * MM, BH = 161 * MM, BD = 13 * MM;
  const PW = 15.6, PH = BH;
  const BX = -PW / 2 + BW / 2;                // panel centre x
  const bodyMat = new T.MeshPhysicalMaterial({ color: 0x7d8086, metalness: 0.85, roughness: 0.35, clearcoat: 0.25 });   // gunmetal rim
  const backMat = new T.MeshStandardMaterial({ color: 0x2c2d31, metalness: 0.4, roughness: 0.6 });                      // back body
  const glassMat = new T.MeshPhysicalMaterial({ color: 0x040405, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
  const housing = new T.Group(); housing.position.set(BX, 0, 0); dev.add(housing);
  housing.add(new T.Mesh(keyGeometry(BW, BH, BD * 0.42, 0.12, 0.03), bodyMat));                                         // metal rim
  { const b = new T.Mesh(keyGeometry(BW - 0.25, BH - 0.25, BD * 0.62, 0.1, 0.03), backMat); b.position.z = -BD * 0.38; housing.add(b); }
  const glassG = keyGeometry(BW - 2.4 * MM, BH - 2.4 * MM, 0.045, 0.1, 0.012); glassG.translate(BX, 0, 0.045);
  const glass = new T.Mesh(glassG, glassMat); dev.add(glass);
  // top bezel: camera, sensors and microphone holes
  { const sens = new T.MeshPhysicalMaterial({ color: 0x17181c, roughness: 0.15, metalness: 0.5, clearcoat: 1 });
    const yb = BH / 2 - 8.5 * MM;
    [[-62, 1.4], [-38, 2.6], [-28, 1.4], [-8, 1.4], [22, 1.4]].forEach(([xm, r]) => { const d = new T.Mesh(new T.CircleGeometry(r * MM, 18), sens); d.position.set(xm * MM, yb, 0.002); glass.add(d); });
    const ring = new T.Mesh(new T.RingGeometry(2.6 * MM, 3.4 * MM, 24), new T.MeshBasicMaterial({ color: 0x3a3d44 })); ring.position.set(-38 * MM, yb, 0.003); glass.add(ring);
    const pill = new T.Mesh(keyGeometry(7 * MM, 2.6 * MM, 0.002, 1.2 * MM, 0.0005), sens); pill.position.set(36 * MM, yb, 0.004); glass.add(pill); }
  // display area 237 × 133 mm: 11 mm side bezels, 17 mm top, 12 mm bottom
  const SWu = 237 * MM, SHu = 133 * MM;
  const screen = new T.Mesh(new T.PlaneGeometry(SWu, SHu), new T.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  screen.position.set(BX, -2.5 * MM, 0.047); dev.add(screen);
  // key strip: 16 × 134 mm, two rockers, each with two "•••" marks
  const keys = [];
  {
    const SWs = 16 * MM, SHs = 134 * MM, gap = 0.6 * MM;
    const strip = new T.Group(); dev.add(strip); keys.push(strip);
    const stripMat = new T.MeshPhysicalMaterial({ color: 0xcfc9bd, metalness: 0.75, roughness: 0.38, clearcoat: 0.2 });
    const dotMat = new T.MeshBasicMaterial({ color: 0x55534f });
    const base = new T.Mesh(keyGeometry(SWs - 0.04, SHs - 0.04, BD * 0.55, 0.03, 0.01), backMat); base.position.z = -BD * 0.35; strip.add(base);
    const kh = (SHs - gap) / 2;
    [1, -1].forEach((k) => {
      const y = k * (kh / 2 + gap / 2);
      const key = new T.Mesh(keyGeometry(SWs, kh, BD * 0.45, 0.035, 0.012), stripMat); key.position.set(0, y, 0); strip.add(key);
      [kh / 4, -kh / 4].forEach((dy) => [-1.4, 0, 1.4].forEach((dx) => { const d = new T.Mesh(new T.CircleGeometry(0.55 * MM, 10), dotMat); d.position.set(dx * MM, y + dy, 0.002); strip.add(d); }));
    });
    strip.position.set(BX + BW / 2 + SWs / 2 + 0.2 * MM, (11.2 - 15.7) / 2 * MM, -0.6 * MM);
    strip.userData.z0 = strip.position.z;
  }
  function glowTex(rgba) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, rgba + '0.9)'); g.addColorStop(0.4, rgba + '0.3)'); g.addColorStop(1, rgba + '0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
  }
  // phone (app control)
  const ph = new T.Group(); root.add(ph);
  { const body = new T.Mesh(keyGeometry(3.6, 7.6, 0.32, 0.55, 0.06), new T.MeshPhysicalMaterial({ color: 0x1b1c1f, metalness: 0.6, roughness: 0.3, clearcoat: 0.8 })); ph.add(body);
    const pscr = new T.Mesh(new T.PlaneGeometry(3.3, 7.0), new T.MeshBasicMaterial({ map: phone.tex, toneMapped: false })); pscr.position.z = 0.02; ph.add(pscr); }
  ph.visible = false;
  // ZigBee/BLE device nodes
  const net = new T.Group(); root.add(net);
  const nodeMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true });
  const nodes = [], lineMat = new T.LineBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + Math.random() * 0.2, r = 9.5 + Math.random() * 4.5, y = (Math.random() - 0.5) * 10;
    const p = new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.6);
    const m = new T.Mesh(new T.SphereGeometry(0.22 + Math.random() * 0.18, 12, 8), nodeMat); m.position.copy(p); net.add(m);
    const lg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0.4), p]); const l = new T.Line(lg, lineMat); net.add(l);
    nodes.push({ m, p, ph: Math.random() * 6 });
  }
  net.visible = false;

  /* ---------------- tour data ---------------- */
  const STEPS = [
    { mode: 'clock', ry: -22, rx: -4, zoom: 1, explode: 0, phone: 0, net: 0 },
    { mode: 'dash', ry: -10, rx: -2, zoom: 1.08, explode: 0, phone: 0, net: 0, demo: 'dash' },
    { mode: 'network', ry: -18, rx: -6, zoom: 0.9, explode: 0, phone: 0, net: 1 },
    { mode: 'intercom', ry: -10, rx: -2, zoom: 1.08, explode: 0, phone: 0, net: 0, demo: 'intercom' },
    { mode: 'dash', ry: -24, rx: -4, zoom: 0.82, explode: 0, phone: 1, net: 0, demo: 'dash' },
    { mode: 'system', ry: -38, rx: -6, zoom: 0.92, explode: 0, phone: 0, net: 0 },
  ];

  /* ---------------- layout ---------------- */
  let vw = innerWidth, vh = innerHeight;
  const SEC = {}, SLOT = {};
  function measure() {
    vw = innerWidth; vh = innerHeight;
    $$('[data-mode]').forEach((el) => { const r = el.getBoundingClientRect(); SEC[el.id] = { el, top: r.top + scrollY, h: el.offsetHeight, range: Math.max(1, el.offsetHeight - vh), mode: el.dataset.mode }; });
    $$('.slot[data-slot]').forEach((el) => {
      const box = el.closest('.stick') || el.closest('[data-mode]');
      const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
      SLOT[el.dataset.slot] = { x: ((r.left - b.left + r.width / 2) / vw) * 2 - 1, y: 1 - ((r.top - b.top + r.height / 2) / vh) * 2, fw: r.width / vw, fh: r.height / vh };
    });
  }

  /* ---------------- state per frame ---------------- */
  const tgt = {}, st = {};
  let mode = 'hero', step = 0, demoT = 0, lastStep = -1;
  function compute(y) {
    let cur = null;
    for (const id in SEC) { const s = SEC[id]; if (y + vh * 0.5 >= s.top && y + vh * 0.5 < s.top + s.h) cur = s; }
    mode = cur ? cur.mode : 'hidden';
    const sl = mode === 'explore' ? SLOT.explore : mode === 'try' ? SLOT.try : mode === 'hero' ? SLOT.hero : Object.assign({}, SLOT.try, { y: -2.4 });
    Object.assign(tgt, { x: sl.x, y: sl.y, fw: sl.fw, fh: sl.fh, ry: -22, rx: -4, zoom: 1, explode: 0, phone: 0, net: 0 });
    if (mode === 'explore') {
      const N = STEPS.length, p = (y - cur.top) / cur.range, q = clamp(p * N, 0, N - 0.0001), i = Math.floor(q);
      let s = i < N - 1 ? ez(clamp((q - i - 0.62) / 0.38, 0, 1)) : 0;
      const a = STEPS[i], b = STEPS[Math.min(N - 1, i + 1)];
      ['ry', 'rx', 'zoom', 'explode', 'phone', 'net'].forEach((k) => (tgt[k] = a[k] + (b[k] - a[k]) * s));
      step = s > 0.5 ? Math.min(N - 1, i + 1) : i;
      screenMode = STEPS[step].mode;
    } else if (mode === 'try') { tgt.ry = -8; tgt.rx = -2; tgt.y = sl.y + ((y - cur.top) / vh) * 2; screenMode = userMode || 'dash'; }
    else if (mode === 'hero') { screenMode = 'clock'; }
  }
  function tourDemo(dt) {
    if (mode !== 'explore') return;
    if (step !== lastStep) { lastStep = step; demoT = 0; if (STEPS[step].mode === 'intercom') S.call = 'ringing'; }
    demoT += dt;
    const d = STEPS[step].demo;
    if (d === 'dash' && demoT > 1.4) { demoT = 0; const k = ['living', 'bedroom', 'kitchen'][Math.floor(Math.random() * 3)]; S.lights[k] = !S.lights[k]; S.scene = null; }
    if (d === 'intercom' && S.call === 'ringing' && demoT > 2.6) { S.call = 'open'; toast('Door unlocked'); }
    if (d === 'intercom' && S.call === 'open' && demoT > 6) { S.call = 'ringing'; demoT = 0; }
  }

  /* ---------------- interaction: tap the 3D screen ---------------- */
  const ray = new T.Raycaster(), ndc = new T.Vector2(-9, -9);
  let hoverHit = null;
  addEventListener('pointermove', (e) => ndc.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1), { passive: true });
  function pick() {
    hoverHit = null;
    if (mode !== 'try' && mode !== 'hero') return null;
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObject(screen, false)[0];
    if (!h || !h.uv) return null;
    const px = h.uv.x * SW, py = (1 - h.uv.y) * SH;
    hoverHit = scr.hits.find((z) => px >= z.r[0] && px <= z.r[0] + z.r[2] && py >= z.r[1] && py <= z.r[1] + z.r[3]) || null;
    return hoverHit;
  }
  // taps work the same with a mouse, a finger (iPad / phone) or a pen: a short press that does not move
  function onTap(handler) {
    let st = null;
    addEventListener('pointerdown', (e) => { st = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
    addEventListener('pointercancel', () => { st = null; }, { passive: true });
    addEventListener('pointerup', (e) => {
      if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y, dt = performance.now() - st.t; st = null;
      if (dx * dx + dy * dy > 144 || dt > 700) return;
      handler(e);
    });
  }
  onTap((e) => {
    if (e.target.closest('a,button')) return;
    ndc.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1);
    const h = pick(); if (!h) return;
    h.fn(); dirty = true; tick();
    syncRoom();
  });
  let actx = null;
  function tick() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 1800; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.06); } catch (e) { /* optional */ } }

  /* room preview (try section) */
  const room = $('#room');
  function syncRoom() {
    if (!room) return;
    const n = countOn();
    ['living', 'bedroom', 'kitchen'].forEach((k) => room.classList.toggle('on-' + k, !!S.lights[k]));
    room.classList.toggle('curtain-open', S.curtain > 0.5);
    room.classList.toggle('ac-on', S.ac.on);
    $('#roomTemp').textContent = S.ac.on ? `${S.ac.temp}°C` : 'AC off';
    $('#roomLights').textContent = `${n} / 3 lights`;
    $('#roomCurtain').textContent = S.curtain > 0.5 ? 'Curtains open' : 'Curtains closed';
    $('#roomScene').textContent = S.scene ? SCENES[S.scene].label : 'Manual';
    $$('[data-scene]').forEach((b) => b.classList.toggle('on', b.dataset.scene === S.scene));
  }
  $$('[data-scene]').forEach((b) => b.addEventListener('click', () => { applyScene(b.dataset.scene); userMode = 'dash'; tick(); syncRoom(); }));
  const ring = $('[data-ring]'); if (ring) ring.addEventListener('click', () => { S.call = 'ringing'; userMode = 'intercom'; tick(); });
  syncRoom();

  /* ---------------- DOM ---------------- */
  const feats = $$('.feat'), navBtns = $$('.feat-nav button');
  navBtns.forEach((b, i) => b.addEventListener('click', () => { const s = SEC.explore; go(s.top + ((i + 0.4) / STEPS.length) * s.range); }));
  let lenis = null;
  if (!reduced && window.Lenis) lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  function go(yy) { lenis ? lenis.scrollTo(yy, { duration: 1.3 }) : scrollTo({ top: yy, behavior: 'smooth' }); }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const el = $(a.getAttribute('href')); if (!el) return; e.preventDefault(); go(el.getBoundingClientRect().top + scrollY); }));
  function dom(y) {
    $('.progress span').style.transform = `scaleX(${clamp(y / (document.documentElement.scrollHeight - vh), 0, 1)})`;
    const inEx = mode === 'explore';
    feats.forEach((f, i) => f.classList.toggle('on', inEx && i === step));
    navBtns.forEach((b, i) => b.classList.toggle('on', i === step));
    $$('.nav-links a').forEach((a) => { const s = SEC[a.getAttribute('href').slice(1)]; a.classList.toggle('active', !!s && y + vh / 2 >= s.top && y + vh / 2 < s.top + s.h); });
  }
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); } }), { threshold: 0.15 });
  $$('.reveal').forEach((el) => io.observe(el));

  /* ---------------- loop ---------------- */
  let last = performance.now();
  const D2R = T.MathUtils.degToRad;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (lenis) lenis.raf(now);
    const y = scrollY, t = now / 1000;
    compute(y); dom(y); tourDemo(dt);
    if (!renderer) return;
    const f = SNAP ? 1 : 1 - Math.exp(-dt * 5.5);
    for (const k in tgt) st[k] = st[k] == null ? tgt[k] : st[k] + (tgt[k] - st[k]) * f;
    if (S.toastT > 0) S.toastT -= dt;
    if (now - lastDraw > 90 || dirty) { drawScreen(t); lastDraw = now; dirty = false; if (mode === 'try') syncRoom(); }

    const Hv = VH(), Wv = Hv * camera.aspect;
    const W = PW + st.phone * 7 + st.net * 9, H = PH + st.net * 4;
    const k = Math.min((st.fw * Wv) / W, (st.fh * Hv) / H) * st.zoom;
    root.scale.setScalar(k);
    root.position.set(st.x * Wv / 2 - st.phone * 2.6 * k, st.y * Hv / 2 + Math.sin(t * 0.8) * 0.1 * k, 0);
    root.rotation.set(D2R(st.rx), D2R(st.ry + (mode === 'hero' ? Math.sin(t * 0.4) * 8 : 0)), 0);
    // phone
    ph.visible = st.phone > 0.02;
    ph.position.set(PW / 2 + 3.4 + (1 - st.phone) * 10, -1.2, 2.5); ph.rotation.y = 0.35 - (1 - st.phone) * 0.6;
    // network
    net.visible = st.net > 0.02;
    nodeMat.opacity = st.net; lineMat.opacity = st.net * 0.45;
    nodes.forEach((n) => { const s2 = 0.5 + 0.5 * Math.sin(t * 2 + n.ph); n.m.scale.setScalar(st.net * (0.7 + 0.5 * s2)); });
    net.rotation.y = t * 0.12;

    const h = pick();
    document.documentElement.style.cursor = h ? 'pointer' : '';
    renderer.render(scene, camera);
  }
  function resize() { vw = innerWidth; vh = innerHeight; if (renderer) { renderer.setSize(vw, vh, false); camera.aspect = vw / vh; camera.updateProjectionMatrix(); } measure(); }
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 120); });
  if (window.ResizeObserver) { let r2; new ResizeObserver(() => { clearTimeout(r2); r2 = setTimeout(measure, 80); }).observe($('#main')); }
  measure();
  requestAnimationFrame((n) => { last = n; frame(n); });
  Promise.race([document.fonts ? document.fonts.ready : 0, new Promise((r) => setTimeout(r, 2500))]).then(() => setTimeout(() => { resize(); dirty = true; $('#loader').classList.add('done'); document.body.classList.add('ready'); }, 200));
})();

/* keep the current series visible in the scrollable series nav (phones) */
(function () { var on = document.querySelector('.nav-series .on'); if (on) on.parentNode.scrollLeft = on.offsetLeft - on.parentNode.offsetLeft - on.parentNode.clientWidth / 2 + on.offsetWidth / 2; })();
