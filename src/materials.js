import * as THREE from 'three';
import { Q } from './quality.js';

// Texturas procedurales (sin archivos externos): contrachapado con sus chapas en el canto,
// listón de pino, revestimientos (tolex, polipiel, terciopelo, fieltro, corcho) y el mapa
// de juego que se ve en la pantalla.

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const canvasCache = new Map();
const cached = (k, fn) => { if (!canvasCache.has(k)) canvasCache.set(k, fn()); return canvasCache.get(k); };
function canvas(S, H = S) { const c = document.createElement('canvas'); c.width = S; c.height = H; return c; }

function tex(key, cv, sizeU, sizeV = sizeU, color = true) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / sizeU, 1 / sizeV);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// cara de abedul: claro, veta suave y alguna «ventana» de chapa
function birchFace(seed = 3, warm = false) {
  const S = Q.woodSize, c = canvas(S), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = warm ? '#d6b183' : '#e7d3b4'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) {
    const y0 = r() * S, amp = 3 + r() * 10, ph = r() * 6.28, k = 1 + Math.floor(r() * 3);
    x.strokeStyle = `rgba(${warm ? '120,72,30' : '150,110,70'},${0.03 + r() * 0.08})`;
    x.lineWidth = 0.5 + r() * 2;
    x.beginPath();
    for (let X = 0; X <= S; X += 8) { const Y = y0 + amp * Math.sin(X / S * 6.28 * k + ph); X ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.stroke();
  }
  for (let i = 0; i < 26; i++) {   // nudos minúsculos y parches
    x.fillStyle = `rgba(${warm ? '110,70,35' : '160,120,80'},${0.05 + r() * 0.1})`;
    x.beginPath(); x.ellipse(r() * S, r() * S, 2 + r() * 6, 1 + r() * 2, 0, 0, 6.28); x.fill();
  }
  const img = x.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  return c;
}

// canto del contrachapado: chapas alternas claro/oscuro (las franjas siguen v)
function plyEdge(plies = 7) {
  const W = 64, H = 256, c = canvas(W, H), x = c.getContext('2d'), r = rng(9);
  for (let i = 0; i < plies; i++) {
    const cross = i % 2 === 1;
    x.fillStyle = cross ? '#c9a77c' : '#e4cfae';
    x.fillRect(0, (i * H) / plies, W, H / plies + 1);
    x.fillStyle = 'rgba(90,60,30,0.35)';
    x.fillRect(0, (i * H) / plies, W, 1.5);
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(90,60,30,${r() * 0.12})`; x.fillRect(r() * W, (i * H) / plies + r() * H / plies, cross ? 1 : 6, 1); }
  }
  return c;
}

function pineCanvas() {
  const S = 512, c = canvas(S), x = c.getContext('2d'), r = rng(21);
  x.fillStyle = '#e0bf8c'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const y0 = r() * S, amp = 2 + r() * 6;
    x.strokeStyle = `rgba(170,110,50,${0.15 + r() * 0.25})`; x.lineWidth = 1 + r() * 4;
    x.beginPath();
    for (let X = 0; X <= S; X += 8) { const Y = y0 + amp * Math.sin(X / 90 + i); X ? x.lineTo(X, Y) : x.moveTo(X, Y); }
    x.stroke();
  }
  return c;
}

function grainCanvas(kind) {
  const S = 512, c = canvas(S), x = c.getContext('2d'), r = rng(kind.length * 31);
  x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  if (kind === 'tolex') {
    // granulado tipo «levant»: celdas irregulares
    for (let i = 0; i < 14000; i++) {
      const px = r() * S, py = r() * S, rad = 1 + r() * 3.2;
      x.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.10 + r() * 0.16})`;
      x.beginPath(); x.arc(px, py, rad, 0, 6.28); x.fill();
    }
  } else if (kind === 'polipiel') {
    for (let i = 0; i < 2200; i++) {
      x.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`; x.lineWidth = 0.6;
      const px = r() * S, py = r() * S, l = 4 + r() * 16, a = r() * 6.28;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + r() * 4, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.07})`; x.fillRect(r() * S, r() * S, 1.4, 1.4); }
  } else if (kind === 'fieltro') {
    for (let i = 0; i < 30000; i++) {
      x.strokeStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.07})`; x.lineWidth = 0.6;
      const px = r() * S, py = r() * S, a = r() * 6.28, l = 2 + r() * 6;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
  } else if (kind === 'corcho') {
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 16000; i++) {
      x.fillStyle = `rgba(${r() > 0.55 ? '255,255,255' : '0,0,0'},${0.1 + r() * 0.3})`;
      x.beginPath(); x.arc(r() * S, r() * S, 0.6 + r() * 2.4, 0, 6.28); x.fill();
    }
  } else {
    for (let i = 0; i < 50000; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},0.05)`; x.fillRect(r() * S, r() * S, 1, 1); }
  }
  return c;
}

function tableCanvas() {
  const S = 1024, c = canvas(S), x = c.getContext('2d'), r = rng(77);
  const planks = 6;
  for (let i = 0; i < planks; i++) {
    const h = 24 + r() * 8, l = 30 + r() * 8;
    x.fillStyle = `hsl(${h},38%,${l}%)`; x.fillRect(0, (i * S) / planks, S, S / planks);
    for (let k = 0; k < 40; k++) {
      const y0 = (i * S) / planks + r() * S / planks, amp = 1 + r() * 4;
      x.strokeStyle = `hsla(${h},40%,${l - 10}%,${0.15 + r() * 0.3})`; x.lineWidth = 0.6 + r() * 2;
      x.beginPath();
      for (let X = 0; X <= S; X += 16) { const Y = y0 + amp * Math.sin(X / 120 + k); X ? x.lineTo(X, Y) : x.moveTo(X, Y); }
      x.stroke();
    }
    x.fillStyle = 'rgba(20,8,0,.5)'; x.fillRect(0, (i * S) / planks, S, 2);
  }
  return c;
}

export const COVER_LOOK = {
  tolex: { grain: 'tolex', size: 60, rough: 0.62, bump: 0.6, clearcoat: 0.15 },
  polipiel: { grain: 'polipiel', size: 120, rough: 0.48, bump: 0.5, clearcoat: 0.3 },
  terciopelo: { grain: 'noise', size: 80, rough: 0.85, bump: 0.25, sheen: 1 },
  fieltro: { grain: 'fieltro', size: 90, rough: 0.98, bump: 0.8 },
  corcho: { grain: 'corcho', size: 70, rough: 0.9, bump: 1.2, tint: '#b88d5f' },
  pintura: { grain: 'noise', size: 200, rough: 0.55, bump: 0.05 },
  ninguno: null,
};

export const COVER_SWATCHES = ['#232325', '#3a3c40', '#5b3a26', '#7a4b2a', '#4a1f24', '#1f3a2e', '#24324a', '#6b6f73', '#b9b2a6', '#8b2e2e'];
export const FRAME_SWATCHES = ['#1d1d1f', '#3a3c40', '#5b3a26', '#e7d3b4', '#4a1f24'];

export class MaterialFactory {
  constructor() { this.cache = new Map(); this.xray = false; this.clip = []; }
  setStyle(p) { this.p = p; this.dispose(); }
  dispose() { this.cache.forEach(m => (Array.isArray(m) ? m : [m]).forEach(x => x.dispose())); this.cache.clear(); }
  key(k, fn) { if (!this.cache.has(k)) { const m = fn(); this.cache.set(k, m); (Array.isArray(m) ? m : [m]).forEach(x => { x.clippingPlanes = this.clip; this.applyXray(x); }); } return this.cache.get(k); }

  // Devuelve material o [caras, cantos] para ExtrudeGeometry
  get(mat, thickness = 10) {
    const p = this.p;
    const Std = Q.physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    switch (mat) {
      case 'ply': case 'plyFinish': return this.key(mat + ':' + thickness, () => {
        const warm = mat === 'plyFinish';
        const face = new Std({ map: tex('birch', cached('birch' + warm, () => birchFace(3, warm)), 900), roughness: warm ? 0.45 : 0.75, ...(Q.physical && warm ? { clearcoat: 0.25, clearcoatRoughness: 0.4 } : {}) });
        const et = tex('edge', cached('plyEdge', () => plyEdge(7)), 200, thickness);
        et.offset.set(0, 0);
        const edge = new Std({ map: et, roughness: 0.85 });
        return [face, edge];
      });
      case 'batten': return this.key('batten', () => new Std({ map: tex('pine', cached('pine', pineCanvas), 400), roughness: 0.7 }));
      case 'black': return this.key('black:' + p.frameColor, () => new Std({ color: p.frameFinish === 'negro' ? p.frameColor : '#151516', roughness: 0.8 }));
      case 'cover': return this.key('cover:' + p.cover + p.coverColor, () => {
        const look = COVER_LOOK[p.cover] || COVER_LOOK.pintura;
        const cv = cached('grain:' + look.grain, () => grainCanvas(look.grain));
        const bump = tex('g', cv, look.size, look.size, false);
        const opts = { color: look.tint && p.cover === 'corcho' ? look.tint : p.coverColor, roughness: look.rough, bumpMap: bump, bumpScale: look.bump, roughnessMap: tex('g2', cv, look.size, look.size, false) };
        if (Q.physical) {
          if (look.sheen) Object.assign(opts, { sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color(p.coverColor).offsetHSL(0, 0, 0.3) });
          if (look.clearcoat) Object.assign(opts, { clearcoat: look.clearcoat, clearcoatRoughness: 0.5 });
        } else delete opts.bumpMap;
        return new Std(opts);
      });
      case 'acrylic': return this.key('acrylic', () => new THREE.MeshPhysicalMaterial({ color: '#e8f4ff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.07, ...(Q.physical ? { clearcoat: 1, clearcoatRoughness: 0.02 } : {}), depthWrite: false }));
      case 'glass': return this.key('glass', () => [
        new THREE.MeshPhysicalMaterial({ color: '#e6f6ee', roughness: 0.02, transparent: true, opacity: 0.16, ...(Q.physical ? { clearcoat: 1 } : {}), depthWrite: false }),
        new THREE.MeshStandardMaterial({ color: '#7fb9a0', roughness: 0.1, transparent: true, opacity: 0.85 }),
      ]);
      case 'foam': return this.key('foam', () => new Std({ color: '#2b2c2e', roughness: 1 }));
      case 'metal': return this.key('metal', () => new Std({ color: '#c9ccd1', roughness: 0.28, metalness: 0.95 }));
      case 'darkmetal': return this.key('darkmetal', () => new Std({ color: '#2a2b2e', roughness: 0.4, metalness: 0.8 }));
      case 'rubber': return this.key('rubber', () => new Std({ color: '#1b1b1c', roughness: 0.95 }));
      case 'plastic': return this.key('plastic', () => new Std({ color: '#141416', roughness: 0.45 }));
      case 'tvback': return this.key('tvback', () => new Std({ color: '#26272a', roughness: 0.55 }));
      default: return this.key('x', () => new Std({ color: '#ff00ff' }));
    }
  }
  table() { return this.key('table', () => new THREE.MeshStandardMaterial({ map: tex('table', cached('table', tableCanvas), 1400, 1400), roughness: 0.6 })); }
  applyXray(m) {
    if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity, m.userData.baseTransparent = m.transparent, m.userData.baseDepthWrite = m.depthWrite;
    m.transparent = this.xray || m.userData.baseTransparent;
    m.opacity = this.xray ? Math.min(0.14, m.userData.baseOpacity) : m.userData.baseOpacity;
    m.depthWrite = this.xray ? false : m.userData.baseDepthWrite;
    m.needsUpdate = true;
  }
  setXray(on) { this.xray = on; this.cache.forEach(m => (Array.isArray(m) ? m : [m]).forEach(x => this.applyXray(x))); }
}

// ───────── mapa de juego en pantalla (1920×1080, rejilla de 1") ─────────
export function mapCanvas(style, inchPx = 51.2) {
  const W = 1920, H = 1080, c = canvas(W, H), x = c.getContext('2d'), r = rng(style.length * 97 + 5);
  if (style === 'apagada') { x.fillStyle = '#050607'; x.fillRect(0, 0, W, H); return c; }
  const cell = inchPx;
  if (style === 'mazmorra') {
    x.fillStyle = '#16120f'; x.fillRect(0, 0, W, H);
    // roca de fondo
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(60,52,44,${r() * 0.35})`; x.beginPath(); x.arc(r() * W, r() * H, 2 + r() * 8, 0, 6.28); x.fill(); }
    const cols = Math.floor(W / cell), rows = Math.floor(H / cell);
    const rooms = [];
    for (let k = 0; k < 40 && rooms.length < 9; k++) {
      const w = 4 + Math.floor(r() * 7), h = 3 + Math.floor(r() * 5), cx = 1 + Math.floor(r() * (cols - w - 2)), cy = 1 + Math.floor(r() * (rows - h - 2));
      if (rooms.some(o => cx < o.x + o.w + 1 && cx + w + 1 > o.x && cy < o.y + o.h + 1 && cy + h + 1 > o.y)) continue;
      rooms.push({ x: cx, y: cy, w, h });
    }
    const floor = (gx, gy) => {
      const v = 120 + r() * 30;
      x.fillStyle = `rgb(${v},${v - 12},${v - 26})`; x.fillRect(gx * cell, gy * cell, cell, cell);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(gx * cell + cell * 0.1, gy * cell + cell * 0.6, cell * 0.3, cell * 0.08);
    };
    const carve = new Set();
    rooms.forEach(o => { for (let i = 0; i < o.w; i++) for (let j = 0; j < o.h; j++) carve.add((o.x + i) + ',' + (o.y + j)); });
    for (let k = 1; k < rooms.length; k++) {
      const a = rooms[k - 1], b = rooms[k];
      let ax = a.x + (a.w >> 1), ay = a.y + (a.h >> 1);
      const bx = b.x + (b.w >> 1), by = b.y + (b.h >> 1);
      while (ax !== bx) { carve.add(ax + ',' + ay); ax += Math.sign(bx - ax); }
      while (ay !== by) { carve.add(ax + ',' + ay); ay += Math.sign(by - ay); }
    }
    carve.forEach(s => { const [gx, gy] = s.split(',').map(Number); floor(gx, gy); });
    // muros
    x.strokeStyle = '#0c0a08'; x.lineWidth = 6;
    carve.forEach(s => {
      const [gx, gy] = s.split(',').map(Number);
      [[0, -1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 1], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1]].forEach(([dx, dy, a0, b0, a1, b1]) => {
        if (carve.has((gx + dx) + ',' + (gy + dy))) return;
        x.beginPath(); x.moveTo((gx + a0) * cell, (gy + b0) * cell); x.lineTo((gx + a1) * cell, (gy + b1) * cell); x.stroke();
      });
    });
    // detalles
    rooms.forEach((o, i) => {
      if (i % 3 === 0) { x.fillStyle = '#6b4a2b'; x.fillRect((o.x + 1) * cell + 6, (o.y + 1) * cell + 10, cell * 1.6, cell * 0.8); }
      if (i % 4 === 1) { x.fillStyle = 'rgba(40,90,140,.55)'; x.beginPath(); x.ellipse((o.x + o.w / 2) * cell, (o.y + o.h / 2) * cell, cell * 1.2, cell * 0.8, 0, 0, 6.28); x.fill(); }
      if (i % 3 === 2) { x.fillStyle = '#d9a440'; x.beginPath(); x.arc((o.x + o.w - 1.5) * cell, (o.y + 1.5) * cell, cell * 0.25, 0, 6.28); x.fill(); }
    });
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  } else if (style === 'bosque') {
    x.fillStyle = '#4f6b35'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '90,120,60' : '50,70,30'},${0.2 + r() * 0.3})`; x.fillRect(r() * W, r() * H, 3 + r() * 6, 3 + r() * 6); }
    // río
    x.strokeStyle = '#3d6f8f'; x.lineWidth = 70; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-40, H * 0.2);
    for (let X = 0; X <= W + 40; X += 80) x.lineTo(X, H * 0.25 + Math.sin(X / 260) * 120 + X * 0.25);
    x.stroke();
    x.strokeStyle = 'rgba(160,210,230,.35)'; x.lineWidth = 18; x.stroke();
    // camino
    x.strokeStyle = '#9b8259'; x.lineWidth = 46; x.setLineDash([]);
    x.beginPath(); x.moveTo(W * 0.1, H + 20); x.bezierCurveTo(W * 0.3, H * 0.6, W * 0.6, H * 0.8, W * 0.85, -20); x.stroke();
    // árboles
    for (let i = 0; i < 160; i++) {
      const px = r() * W, py = r() * H, rad = 18 + r() * 30;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(px + 8, py + 10, rad, 0, 6.28); x.fill();
      x.fillStyle = `hsl(${95 + r() * 30},${35 + r() * 20}%,${18 + r() * 12}%)`; x.beginPath(); x.arc(px, py, rad, 0, 6.28); x.fill();
      x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(px - rad * 0.3, py - rad * 0.3, rad * 0.5, 0, 6.28); x.fill();
    }
    // ruinas
    x.fillStyle = '#8d8a83'; for (let i = 0; i < 6; i++) x.fillRect(W * 0.62 + i * cell, H * 0.42, cell * 0.8, cell * 0.8);
  } else if (style === 'hex') {
    x.fillStyle = '#d9c9a3'; x.fillRect(0, 0, W, H);
    const R = cell * 0.9, hw = Math.sqrt(3) * R;
    const terr = ['#87a96b', '#6e8f4e', '#b5a06a', '#8fa3ad', '#5c7d9e', '#a68b6d'];
    for (let row = -1; row < H / (1.5 * R) + 1; row++) for (let col = -1; col < W / hw + 1; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * 1.5 * R;
      const n = Math.sin(cx / 300) + Math.cos(cy / 220) + r() * 0.8;
      x.fillStyle = terr[Math.max(0, Math.min(5, Math.floor((n + 2) * 1.5)))];
      x.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); } x.closePath(); x.fill();
      x.strokeStyle = 'rgba(60,40,20,.45)'; x.lineWidth = 1.5; x.stroke();
    }
    x.fillStyle = '#3b2a1a'; x.font = '600 54px serif'; x.fillText('Marca del Norte', 80, 110);
    return c;
  }
  // rejilla de 1 pulgada
  x.strokeStyle = style === 'mazmorra' ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.18)'; x.lineWidth = 1.2;
  for (let X = 0; X <= W; X += cell) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, H); x.stroke(); }
  for (let Y = 0; Y <= H; Y += cell) { x.beginPath(); x.moveTo(0, Y); x.lineTo(W, Y); x.stroke(); }
  return c;
}
