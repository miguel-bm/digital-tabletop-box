import { pieceCut, tvProfile } from './model.js';
import { cutRows, packBoards, BOARD } from './cutlist.js';
import { rectMinusRects, regionCells } from './geometry.js';
import { planAssembly } from './assembly.js';
import { PROTECTORS, COVERS, PLY } from './params.js';
import { buildBOM } from './bom.js';

// Planos A3 apaisados en SVG (unidades del viewBox = mm de papel).
const W = 420, H = 297;
const f1 = v => { const r = Math.round(v * 10) / 10; return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ','); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const INK = '#1d1f22', DIM = '#c24e14', MUTED = '#7b8088', ACC = '#e39a12';

function defs() {
  return `<defs>
    <pattern id="hPly" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.2" stroke="#8a6a44" stroke-width=".35"/></pattern>
    <pattern id="hWood" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="2.6" stroke="#a5703a" stroke-width=".35"/><line x1="0" y1="1.3" x2="2.6" y2="1.3" stroke="#a5703a" stroke-width=".2"/></pattern>
    <pattern id="hFoam" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><circle cx=".8" cy=".8" r=".35" fill="#555"/></pattern>
    <marker id="ar" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 6 3 0 6z" fill="${DIM}"/></marker>
  </defs>`;
}
function sheet(title, sub, n, total, body, d) {
  const p = d.params, m = d.metrics;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 ${W} ${H}" font-family="IBM Plex Sans Condensed, Arial Narrow, sans-serif" fill="none" stroke-linejoin="round">
  ${defs()}
  <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
  <rect x="8" y="8" width="${W - 16}" height="${H - 16}" stroke="${INK}" stroke-width=".5"/>
  ${body}
  <g transform="translate(${W - 168},${H - 30})">
    <rect width="160" height="22" stroke="${INK}" stroke-width=".4" fill="#fff"/>
    <line x1="0" y1="11" x2="160" y2="11" stroke="${INK}" stroke-width=".25"/><line x1="112" y1="0" x2="112" y2="22" stroke="${INK}" stroke-width=".25"/>
    <text x="3" y="8" font-size="6.2" font-weight="700" fill="${INK}" letter-spacing=".4">TABLERO DIGITAL · ${esc(title.toUpperCase())}</text>
    <text x="3" y="19" font-size="3.6" fill="${MUTED}">${esc(sub)}</text>
    <text x="115" y="8" font-size="3.4" fill="${INK}">Hoja ${n}/${total} · A3</text>
    <text x="115" y="19" font-size="3.2" fill="${MUTED}">${f1(m.outer.X)}×${f1(m.outer.Z)}×${f1(m.outer.H + m.y0)} · ${PLY[p.plyType].label.split(' ')[0]} ${p.t}</text>
  </g>
  </svg>`;
}

// ───────── primitivas de dibujo ─────────
function rect(x0, y0, x1, y1, a = '') { return `<rect x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}" ${a}/>`; }
function text(x, y, s, size = 3, a = '') { return `<text x="${x}" y="${y}" font-size="${size}" fill="${INK}" stroke="none" ${a}>${esc(s)}</text>`; }
// cota entre dos puntos (en coordenadas de papel), desplazada `off` perpendicular
function dim(x0, y0, x1, y1, off, label, a = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const ax = x0 + nx * off, ay = y0 + ny * off, bx = x1 + nx * off, by = y1 + ny * off;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const flip = ang > 90 || ang <= -90;
  const mx = (ax + bx) / 2 + nx * (flip ? -1.6 : 1.6) * -1, my = (ay + by) / 2 + ny * (flip ? -1.6 : 1.6) * -1;
  const rot = flip ? ang + 180 : ang;
  const sz = a.size || 2.8;
  const ext = (px, py, qx, qy) => `<line x1="${px + nx * Math.sign(off) * 1}" y1="${py + ny * Math.sign(off) * 1}" x2="${qx + nx * Math.sign(off) * 1.5}" y2="${qy + ny * Math.sign(off) * 1.5}" stroke="${DIM}" stroke-width=".18"/>`;
  return `<g>${Math.abs(off) > 0.5 ? ext(x0, y0, ax, ay) + ext(x1, y1, bx, by) : ''}<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${DIM}" stroke-width=".25" marker-start="url(#ar)" marker-end="url(#ar)"/>
  <text x="${mx}" y="${my}" font-size="${sz}" fill="${DIM}" stroke="none" font-family="JetBrains Mono, monospace" text-anchor="middle" transform="rotate(${rot} ${mx} ${my})" dy="-0.6">${esc(label)}</text></g>`;
}
function holeSVG(h, X, Y, s, a) {
  if (h.circle) { const [u, v, r] = h.circle; return `<circle cx="${X(u)}" cy="${Y(v)}" r="${Math.max(0.25, r * s)}" ${a}/>`; }
  if (h.slot) { const [u0, v0, u1, v1] = h.slot; const w = Math.abs(X(u1) - X(u0)), hh = Math.abs(Y(v1) - Y(v0)); return `<rect x="${Math.min(X(u0), X(u1))}" y="${Math.min(Y(v0), Y(v1))}" width="${w}" height="${hh}" rx="${Math.min(w, hh) / 2}" ${a}/>`; }
  const [u0, v0, u1, v1] = h.rect; return rect(X(u0), Y(v0), X(u1), Y(v1), a);
}
function solidOutline(so, X, Y, a) {
  const regs = rectMinusRects(so.rect, so.notches || []);
  return regs.map(reg => {
    const path = l => 'M' + l.map(([u, v]) => `${X(u)},${Y(v)}`).join('L') + 'Z';
    return `<path d="${path(reg.outer)} ${reg.holes.map(path).join(' ')}" fill-rule="evenodd" ${a}/>`;
  }).join('');
}

// ───────── secciones ─────────
// Corta un sólido por x = xc (devuelve rects en z,y) o por z = zc (rects en x,y).
function sectionRects(so, axis, c) {
  const [u0, v0, u1, v1] = so.rect, [t0, t1] = so.t;
  const within = (a, b) => c > Math.min(a, b) + 1e-6 && c < Math.max(a, b) - 1e-6;
  const holeRects = (holes, uAxisIsCut) => (holes || []).map(h => h.circle ? [h.circle[0] - h.circle[2], h.circle[1] - h.circle[2], h.circle[0] + h.circle[2], h.circle[1] + h.circle[2]] : h.slot || h.rect);
  const subtract1D = (a0, a1, cuts) => {
    let segs = [[a0, a1]];
    cuts.forEach(([c0, c1]) => { segs = segs.flatMap(([s0, s1]) => (c1 <= s0 || c0 >= s1) ? [[s0, s1]] : [[s0, Math.max(s0, c0)], [Math.min(s1, c1), s1]].filter(([p, q]) => q - p > 0.01)); });
    return segs;
  };
  if (axis === 'x') {
    if (so.plane === 'XZ') { if (!within(u0, u1)) return []; const cuts = [...holeRects(so.holes), ...(so.notches || [])].filter(r => c > r[0] && c < r[2]).map(r => [r[1], r[3]]); return subtract1D(v0, v1, cuts).map(([a, b]) => [a, t0, b, t1]); }
    if (so.plane === 'XY') { if (!within(u0, u1)) return []; const cuts = [...holeRects(so.holes), ...(so.notches || [])].filter(r => c > r[0] && c < r[2]).map(r => [r[1], r[3]]); return subtract1D(v0, v1, cuts).map(([a, b]) => [t0, a, t1, b]); }
    if (so.plane === 'YZ') { if (!within(t0, t1)) return []; return regionCellsOf(so).map(([a, b, cc, dd]) => [a, b, cc, dd]); }
  } else {
    if (so.plane === 'XZ') { if (!within(v0, v1)) return []; const cuts = [...holeRects(so.holes), ...(so.notches || [])].filter(r => c > r[1] && c < r[3]).map(r => [r[0], r[2]]); return subtract1D(u0, u1, cuts).map(([a, b]) => [a, t0, b, t1]); }
    if (so.plane === 'XY') { if (!within(t0, t1)) return []; return regionCellsOf(so); }
    if (so.plane === 'YZ') { if (!within(u0, u1)) return []; const cuts = [...holeRects(so.holes), ...(so.notches || [])].filter(r => c > r[0] && c < r[2]).map(r => [r[1], r[3]]); return subtract1D(v0, v1, cuts).map(([a, b]) => [t0, a, t1, b]); }
  }
  return [];
}
function regionCellsOf(so) {
  const holes = (so.holes || []).map(h => h.circle ? [h.circle[0] - h.circle[2], h.circle[1] - h.circle[2], h.circle[0] + h.circle[2], h.circle[1] + h.circle[2]] : h.slot || h.rect);
  return rectMinusRects(so.rect, [...(so.notches || []), ...holes]).flatMap(regionCells);
}
const FILL = { ply: 'url(#hPly)', plyFinish: 'url(#hPly)', black: 'url(#hPly)', cover: '#555', batten: 'url(#hWood)', foam: 'url(#hFoam)', acrylic: '#cfe6f5', glass: '#bfe3d2' };

function drawSection(d, axis, c, X, Y, opts = {}) {
  let out = '';
  for (const pc of d.pieces) {
    if (pc.role === 'tv' || pc.lid) continue;
    for (const so of pc.solids) {
      for (const r of sectionRects(so, axis, c)) {
        const fill = pc.skin ? '#3a3a3c' : FILL[pc.mat] || '#eee';
        out += rect(X(r[0]), Y(r[1]), X(r[2]), Y(r[3]), `fill="${fill}" stroke="${INK}" stroke-width="${pc.skin ? 0.12 : 0.3}"`);
      }
    }
  }
  // tele en sección
  const tvp = d.pieces.find(p => p.role === 'tv');
  if (tvp) {
    const t = tvp.tv;
    const a0 = axis === 'x' ? t.z0 : t.x0, a1 = axis === 'x' ? t.z1 : t.x1;
    const inTV = axis === 'x' ? c > t.x0 && c < t.x1 : c > t.z0 && c < t.z1;
    if (inTV) {
      const prof = tvProfile(d.params, t), n = 80, pts = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([a, t.yS - (axis === 'x' ? prof.depth(c, a) : prof.depth(a, c))]); }
      const poly = [[a0, t.yS], ...pts, [a1, t.yS]].map(([u, v]) => `${X(u).toFixed(2)},${Y(v).toFixed(2)}`).join(' ');
      out += `<polygon points="${poly}" fill="#dfe1e4" stroke="${INK}" stroke-width=".35"/>`;
      const s0 = axis === 'x' ? t.scr.z0 : t.scr.x0, s1 = axis === 'x' ? t.scr.z1 : t.scr.x1;
      out += `<line x1="${X(s0)}" y1="${Y(t.yS)}" x2="${X(s1)}" y2="${Y(t.yS)}" stroke="#2a7ab8" stroke-width=".8"/>`;
    }
  }
  return out;
}

// ───────── hoja 1: conjunto ─────────
function sheetConjunto(d, n, total) {
  const p = d.params, m = d.metrics;
  const s = 1 / 5;
  let b = '';
  // planta 1:5
  const ox = 22 + (m.outer.X * s) / 2, oy = 30 + (m.outer.Z * s) / 2;
  const X = x => ox + x * s, Y = z => oy + z * s;
  b += text(16, 22, 'PLANTA · 1:5', 4.2, 'font-weight="700"');
  b += text(16, 26.5, 'desde arriba; trazos: lo que queda dentro', 2.6, `fill="${MUTED}"`);
  const top = d.pieces.filter(pc => ['marco', 'piel'].includes(pc.role) && pc.solids[0].plane === 'XZ');
  for (const pc of top) for (const so of pc.solids) b += solidOutline(so, X, Y, `stroke="${INK}" stroke-width="${pc.skin ? 0.15 : 0.4}" fill="${pc.step === 'marco2' || (!m.twoLayer && pc.id === 'F1') ? '#f3f1ed' : 'none'}"`) + (so.holes || []).map(h => holeSVG(h, X, Y, s, `stroke="${INK}" stroke-width=".35" fill="#fff"`)).join('');
  // aberturas y piezas interiores (ocultas)
  b += rect(X(m.op1[0]), Y(m.op1[1]), X(m.op1[2]), Y(m.op1[3]), `stroke="${INK}" stroke-width=".25" fill="#eef4f8"`);
  b += rect(X(-m.innerX / 2), Y(-m.innerZ / 2), X(m.innerX / 2), Y(m.innerZ / 2), `stroke="${MUTED}" stroke-width=".2" stroke-dasharray="1.5 1"`);
  b += rect(X(m.tv.x0), Y(m.tv.z0), X(m.tv.x1), Y(m.tv.z1), `stroke="#2a7ab8" stroke-width=".25" stroke-dasharray="2 1"`);
  d.pieces.filter(pc => pc.role === 'costilla').forEach(pc => { const r = pc.solids[0].rect; b += rect(X(r[0]), Y(r[1]), X(r[2]), Y(r[3]), `stroke="${MUTED}" stroke-width=".2" stroke-dasharray="1.5 1"`); });
  d.pieces.filter(pc => pc.role === 'travesano').forEach(pc => { const so = pc.solids[0]; b += rect(X(so.t[0]), Y(so.rect[0]), X(so.t[1]), Y(so.rect[2]), `stroke="${MUTED}" stroke-width=".2" stroke-dasharray="1.5 1"`); });
  // VESA
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => (b += `<circle cx="${X(m.railX[a < 0 ? 0 : 1])}" cy="${Y(m.vz + c * p.vesa / 2)}" r=".9" stroke="#2a7ab8" stroke-width=".25"/>`));
  b += text(X(0), Y(0) + 1, 'ÁREA VISIBLE ' + f1(p.screenW) + ' × ' + f1(p.screenH), 3, `text-anchor="middle" fill="#2a7ab8"`);
  b += text(X(0), Y(0) + 5, `rejilla de 1" → ${m.gridCells[0]} × ${m.gridCells[1]} casillas`, 2.4, `text-anchor="middle" fill="${MUTED}"`);
  b += text(X(0), Y(-m.Z / 2) + 3.6, 'ASA · fondo (canto superior de la tele)', 2.2, `text-anchor="middle" fill="${MUTED}"`);
  b += text(X(0), Y(m.Z / 2) - 1.4, 'FRENTE · jugador (altavoces)', 2.2, `text-anchor="middle" fill="${MUTED}"`);
  // cotas planta
  const ex = m.outer.X / 2, ez = m.outer.Z / 2;
  b += dim(X(-ex), Y(ez), X(ex), Y(ez), -7, f1(m.outer.X));
  b += dim(X(ex), Y(-ez), X(ex), Y(ez), -7, f1(m.outer.Z));
  b += dim(X(m.op1[0]), Y(m.op1[3]), X(m.op1[2]), Y(m.op1[3]), -3, f1(m.op1[2] - m.op1[0]), { size: 2.3 });
  b += dim(X(m.op1[0]), Y(m.op1[1]), X(m.op1[0]), Y(m.op1[3]), -3, f1(m.op1[3] - m.op1[1]), { size: 2.3 });
  b += dim(X(-ex), Y(-ez), X(m.op1[0]), Y(-ez), 4, f1(m.op1[0] + ex), { size: 2.2 });
  b += dim(X(-ex), Y(-ez), X(-ex), Y(m.op1[1]), -4, f1(m.op1[1] + ez), { size: 2.2 });
  b += dim(X(-ex), Y(m.op1[3]), X(-ex), Y(ez), -4, f1(ez - m.op1[3]), { size: 2.2 });

  // alzado frontal 1:5
  const fy = 30 + m.outer.Z * s + 22;
  const FX = x => ox + x * s, FY = y => fy + (m.outer.H + m.y0 - y) * s;
  b += text(16, fy - 6, 'ALZADO FRONTAL · 1:5', 3.6, 'font-weight="700"');
  const front = d.pieces.find(pc => pc.key === 'skinFront') || d.pieces.find(pc => pc.key === 'front');
  front.solids.forEach(so => { b += solidOutline(so, FX, FY, `stroke="${INK}" stroke-width=".4" fill="#f6f5f2"`) + (so.holes || []).map(h => holeSVG(h, FX, FY, s, `stroke="${INK}" stroke-width=".25" fill="#fff"`)).join(''); });
  d.pieces.filter(pc => pc.role === 'marco').forEach(pc => { const so = pc.solids[0]; b += rect(FX(so.rect[0]), FY(so.t[0]), FX(so.rect[2]), FY(so.t[1]), `stroke="${INK}" stroke-width=".3" fill="#eee"`); });
  d.fixtures.filter(f => f.kind === 'foot').slice(0, 3).forEach(f => (b += rect(FX(f.pos[0] - 11), FY(f.h), FX(f.pos[0] + 11), FY(0), `fill="#333"`)));
  b += `<line x1="${FX(-m.outer.X / 2 - 20)}" y1="${FY(0)}" x2="${FX(m.outer.X / 2 + 20)}" y2="${FY(0)}" stroke="${INK}" stroke-width=".3"/>`;
  b += dim(FX(m.outer.X / 2), FY(0), FX(m.outer.X / 2), FY(m.outer.H + m.y0), -6, f1(m.outer.H + m.y0));

  // lateral de conexiones 1:5
  const ly = fy + (m.outer.H + m.y0) * s + 18;
  const portSkin = d.pieces.find(pc => pc.key === (m.portWall === 'right' ? 'skinRight' : 'skinLeft')) || d.pieces.find(pc => pc.key === m.portWall);
  const LX = z => 22 + (z + m.outer.Z / 2) * s, LY = y => ly + (m.outer.H + m.y0 - y) * s;
  b += text(16, ly - 6, 'LATERAL DE CONEXIONES · 1:5', 3.6, 'font-weight="700"');
  portSkin.solids.forEach(so => { b += solidOutline(so, LX, LY, `stroke="${INK}" stroke-width=".4" fill="#f6f5f2"`) + (so.holes || []).map(h => holeSVG(h, LX, LY, s, `stroke="${INK}" stroke-width=".25" fill="#fff"`)).join(''); });
  m.cz.forEach(z => (b += dim(LX(-m.outer.Z / 2), LY(0) + 2, LX(z), LY(0) + 2, 0, f1(z + m.Z / 2), { size: 2 })));
  b += dim(LX(m.outer.Z / 2) + 2, LY(0), LX(m.outer.Z / 2) + 2, LY(m.cy), 0, f1(m.cy), { size: 2 });

  // sección de detalle 1:1 por un travesaño (o por el centro)
  const xc = (m.railX && p.mount === 'vesa') ? m.railX[0] : m.tv.cx - 140;
  const sc = 1;
  const zA = -m.outer.Z / 2 - 6, zB = zA + 130;
  const dx0 = 258, dy0 = 32;
  const SX = z => dx0 + (z - zA) * sc, SY = y => dy0 + (m.outer.H + m.y0 + 6 - y) * sc;
  b += text(250, 22, 'SECCIÓN A-A · DETALLE 1:1', 4.2, 'font-weight="700"');
  b += text(250, 26.5, `por x = ${f1(xc)}${p.mount === 'vesa' ? ' (travesaño VESA)' : ''}, lado del asa`, 2.6, `fill="${MUTED}"`);
  b += `<clipPath id="clipA"><rect x="${dx0}" y="${dy0}" width="${130 * sc}" height="${(m.outer.H + m.y0 + 12) * sc}"/></clipPath>`;
  b += `<g clip-path="url(#clipA)">${drawSection(d, 'x', xc, SX, SY)}</g>`;
  b += `<line x1="${dx0}" y1="${SY(0)}" x2="${dx0 + 130 * sc}" y2="${SY(0)}" stroke="${INK}" stroke-width=".4"/>`;
  b += `<path d="M${dx0 + 130 * sc} ${dy0} l-2 4 l4 4 l-2 4" stroke="${MUTED}" stroke-width=".3"/>`;
  // cotas de la pila
  const levels = [[0, m.y0, 'patas'], [m.y0, m.yBaseTop, 'base'], [m.yBaseTop, m.yB, p.mount === 'vesa' ? 'travesaño' : p.mount === 'base' ? 'costilla' : 'espuma'], [m.yB, m.yS, 'tele'], [m.yS, m.yF, m.protAbove || !m.pt ? 'burlete' : 'prot.+burlete'], [m.yF, m.yTop, 'marco'], ...(m.protTop ? [[m.protY, m.protY + m.pt, 'prot.']] : [])].filter(([a, c]) => c - a > 0.4);
  levels.forEach(([a, c, l], i) => { b += dim(SX(zB), SY(a), SX(zB), SY(c), -4 - (i % 2) * 9, f1(c - a), { size: 2.2 }); });
  b += dim(SX(zB) + 26, SY(0), SX(zB) + 26, SY(m.yTop), 0, f1(m.yTop), { size: 2.4 });
  b += dim(SX(-m.Z / 2), SY(m.yTop) - 4, SX(m.op1[1]), SY(m.yTop) - 4, 0, f1(m.op1[1] + m.Z / 2), { size: 2.2 });
  // leyenda
  const lg = [['url(#hPly)', `Contrachapado ${p.t}`], ['url(#hWood)', 'Listón / taco pino'], ['#d9dbde', 'Tele'], ['url(#hFoam)', 'Burlete / espuma'], ['#cfe6f5', 'Protector'], ['#3a3a3c', 'Revestimiento']];
  const lgy = SY(0) + 10;
  lg.forEach(([f, l], i) => { const x = 252 + (i % 3) * 52, y = lgy + Math.floor(i / 3) * 6; b += rect(x, y - 3, x + 5, y, `fill="${f}" stroke="${INK}" stroke-width=".2"`) + text(x + 7, y - 0.4, l, 2.6); });
  // notas
  const notes = [
    `Tele: ${f1(p.tvW)} × ${f1(p.tvH)} × ${f1(p.tvD)} mm (borde ${f1(p.tvRimD)} — medir), ${f1(p.tvKg)} kg, VESA ${p.vesa}.`,
    `Holgura tele–pared ${f1(m.g)} mm (${f1(p.fit)} de ajuste + ${f1(p.margin)} de cámara). Interior ${f1(m.innerX)} × ${f1(m.innerZ)}.`,
    `Marco ${m.twoLayer ? 'doble: labio de ' + p.t + ' + pozo de ' + p.t + ' mm' : 'simple'}; ventana ${f1(m.op1[2] - m.op1[0])} × ${f1(m.op1[3] - m.op1[1])}.`,
    m.protRect ? `Protector ${PROTECTORS[p.protector].label}: ${f1(m.protRect[2] - m.protRect[0])} × ${f1(m.protRect[3] - m.protRect[1])}.` : 'Sin protector de pantalla.',
    `Base extraíble ${f1(m.innerX - 1)} × ${f1(m.innerZ - 1)}, ${p.baseFix === 'insertos' ? p.baseScrews + ' tornillos M5 a insertos' : p.baseFix === 'magnetos' ? 'imanes + 4 M5' : p.baseScrews + ' tornillos madera'}.`,
    `Peso estimado ${f1(m.mass.total)} kg (tele ${f1(m.mass.tv)} + caja ${f1(m.mass.total - m.mass.tv)}).`,
  ];
  const ny = lgy + 18;
  b += text(250, ny, 'NOTAS', 3, 'font-weight="700"');
  notes.forEach((t, i) => (b += text(250, ny + 5 + i * 4.6, '· ' + t, 2.55)));
  return sheet('Conjunto', 'Planta, alzados y sección de detalle', n, total, b, d);
}

// ───────── despiece ─────────
function pieceCard(d, pc, row, x, y, w, h) {
  let b = rect(x, y, x + w, y + h, `stroke="${INK}" stroke-width=".3"`);
  const c = pieceCut(pc);
  b += text(x + 3, y + 6, pc.id, 4.6, `font-weight="700" fill="${ACC}"`);
  b += text(x + 3 + pc.id.length * 3 + 3, y + 6, row.qty > 1 ? `${row.name} · ×${row.qty} (${row.ids.join(' ')})` : pc.name, 3.1, 'font-weight="600"');
  b += text(x + 3, y + 10.5, `${f1(c.L)} × ${f1(c.W)} × ${f1(c.T)} mm · ${row.stockLabel}`, 2.6, `fill="${MUTED}" font-family="JetBrains Mono, monospace"`);
  const viewNote = { XZ: 'vista desde arriba · el canto del jugador abajo', XY: 'vista desde el lado del jugador', YZ: 'vista desde la izquierda · el jugador a la derecha' }[pc.solids[0].plane] || '';
  b += text(x + w - 3, y + 6, viewNote, 2.2, `text-anchor="end" fill="${MUTED}"`);
  // sólido principal (el de mayor área)
  const so = pc.solids.reduce((a, s) => ((s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]) >= (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) ? s : a), pc.solids[0]);
  const [u0, v0, u1, v1] = so.rect;
  const pw = u1 - u0, ph = v1 - v0;
  const rot = ph > pw * 1.15;   // poner la dimensión mayor en horizontal
  const aw = w - 22, ah = h - 34;
  const sc = Math.min(aw / (rot ? ph : pw), ah / (rot ? pw : ph));
  const cx = x + 11 + aw / 2, cy = y + 16 + ah / 2;
  const X = (u, v) => rot ? cx + (v - (v0 + v1) / 2) * sc : cx + (u - (u0 + u1) / 2) * sc;
  const vs = so.plane === 'XZ' ? 1 : -1;   // XZ: visto desde arriba (z hacia abajo); XY y YZ: alzado (y hacia arriba)
  const Y = (u, v) => rot ? cy + (u - (u0 + u1) / 2) * sc : cy + vs * (v - (v0 + v1) / 2) * sc;
  const mapLoop = l => 'M' + l.map(([u, v]) => `${X(u, v)},${Y(u, v)}`).join('L') + 'Z';
  const regs = rectMinusRects(so.rect, so.notches || []);
  regs.forEach(reg => (b += `<path d="${mapLoop(reg.outer)} ${reg.holes.map(mapLoop).join(' ')}" fill-rule="evenodd" fill="${pc.mat === 'batten' ? '#f4e6cf' : '#f6f1e8'}" stroke="${INK}" stroke-width=".4"/>`));
  (so.holes || []).forEach(hh => {
    if (hh.circle) { const [u, v, r] = hh.circle; b += `<circle cx="${X(u, v)}" cy="${Y(u, v)}" r="${Math.max(0.35, r * sc)}" fill="#fff" stroke="${INK}" stroke-width=".3"/>`; }
    else { const r = hh.slot || hh.rect; const pts = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]; const xs = pts.map(q => X(...q)), ys = pts.map(q => Y(...q)); const ww = Math.max(...xs) - Math.min(...xs), hgt = Math.max(...ys) - Math.min(...ys); b += `<rect x="${Math.min(...xs)}" y="${Math.min(...ys)}" width="${ww}" height="${hgt}" rx="${hh.slot ? Math.min(ww, hgt) / 2 : 0}" fill="#fff" stroke="${INK}" stroke-width=".3"/>`; }
  });
  (pc.drill || []).forEach(([u, v, r]) => (b += `<circle cx="${X(u, (v0 + v1) / 2)}" cy="${Y(u, (v0 + v1) / 2)}" r="${Math.max(0.4, r * sc)}" fill="#fff" stroke="${INK}" stroke-width=".3"/>`));
  // cotas generales
  const L = rot ? ph : pw, Wd = rot ? pw : ph;
  const bx0 = cx - (L * sc) / 2, bx1 = cx + (L * sc) / 2, by0 = cy - (Wd * sc) / 2, by1 = cy + (Wd * sc) / 2;
  b += dim(bx0, by1, bx1, by1, -4, f1(L), { size: 2.4 });
  b += dim(bx1, by0, bx1, by1, -4, f1(Wd), { size: 2.4 });
  // tabla de huecos (coordenadas desde la esquina inferior izquierda del dibujo)
  const hl = (so.holes || []).filter(hh => hh.tag || hh.circle && hh.circle[2] > 2);
  const uniq = [];
  hl.forEach(hh => { const k = hh.tag || 'Taladro'; const e = uniq.find(q => q.k === k); const pos = hh.circle ? [hh.circle[0], hh.circle[1]] : [((hh.slot || hh.rect)[0] + (hh.slot || hh.rect)[2]) / 2, ((hh.slot || hh.rect)[1] + (hh.slot || hh.rect)[3]) / 2]; const rel = rot ? [pos[1] - v0, u1 - pos[0]] : [pos[0] - u0, vs < 0 ? pos[1] - v0 : v1 - pos[1]]; if (e) e.p.push(rel); else uniq.push({ k, p: [rel] }); });
  const lines = uniq.slice(0, 3).map(q => `${q.p.length}× ${q.k}${q.p.length <= 4 ? ' @ ' + q.p.map(([a, bb]) => `(${f1(a)}; ${f1(bb)})`).join(' ') : ''}`);
  if (pc.cut && pc.cut.notes) lines.unshift(pc.cut.notes);
  lines.slice(0, 3).forEach((t, i) => (b += text(x + 3, y + h - 9.5 + i * 3.4, t.length > 120 ? t.slice(0, 118) + '…' : t, 2.25, `fill="${MUTED}"`)));
  return b;
}

function sheetsDespiece(d, n0, total) {
  const rows = cutRows(d).filter(r => r.stock !== 'espuma');
  const cards = rows.map(r => ({ r, pc: d.pieces.find(p => p.id === r.ids[0]) }));
  const big = cards.filter(c => c.r.L > 500 && c.r.W > 60), small = cards.filter(c => !big.includes(c));
  const out = [];
  const pages = [];
  // hojas: 4 piezas grandes por hoja (2×2) y 9 pequeñas (3×3)
  for (let i = 0; i < big.length; i += 4) pages.push({ list: big.slice(i, i + 4), cols: 2, rows: 2 });
  for (let i = 0; i < small.length; i += 9) pages.push({ list: small.slice(i, i + 9), cols: 3, rows: 3 });
  pages.forEach((pg, k) => {
    const gx = 14, gy = 14, gw = W - 28, gh = H - 50;
    const cw = gw / pg.cols, ch = gh / pg.rows;
    let b = '';
    pg.list.forEach((c, i) => { const cx = gx + (i % pg.cols) * cw, cy = gy + Math.floor(i / pg.cols) * ch; b += pieceCard(d, c.pc, c.r, cx + 1.5, cy + 1.5, cw - 3, ch - 3); });
    out.push(sheet('Despiece', `${pg.list.length} fichas · cotas de huecos desde la esquina inferior izquierda`, n0 + k, total, b, d));
  });
  return out;
}

// ───────── corte ─────────
function boardSVG(d, bd, ox, oy, s, k) {
  let b = text(ox, oy - 2, `Tablero ${k + 1} · ${String(bd.T).replace('.', ',')} mm`, 3, 'font-weight="600"');
  b += rect(ox, oy, ox + BOARD.W * s, oy + BOARD.H * s, `fill="#efe7da" stroke="${INK}" stroke-width=".4"`);
  let used = 0;
  bd.parts.forEach(pt => {
    used += pt.w * pt.h;
    const pc = d.pieces.find(q => q.id === pt.id);
    const so = pc.solids.reduce((a, q) => ((q.rect[2] - q.rect[0]) * (q.rect[3] - q.rect[1]) >= (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) ? q : a), pc.solids[0]);
    const [u0, v0, u1, v1] = so.rect;
    const rot = Math.abs((u1 - u0) - pt.w) > 0.5;
    const P = (u, v) => rot ? [ox + (pt.x + (v - v0)) * s, oy + (pt.y + (u1 - u)) * s] : [ox + (pt.x + (u - u0)) * s, oy + (pt.y + (v - v0)) * s];
    const loop = l => 'M' + l.map(([u, v]) => P(u, v).join(',')).join('L') + 'Z';
    rectMinusRects(so.rect, so.notches || []).forEach(reg => (b += `<path d="${loop(reg.outer)} ${reg.holes.map(loop).join(' ')}" fill-rule="evenodd" fill="#fff" stroke="${INK}" stroke-width=".35"/>`));
    (so.holes || []).forEach(h => { const r = h.circle ? null : h.slot || h.rect; if (!r || (r[2] - r[0]) * (r[3] - r[1]) < 400) return; b += `<path d="${loop([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]])}" fill="#efe7da" stroke="${INK}" stroke-width=".2" stroke-dasharray="1 .8"/>`; });
    const fs = Math.min(2.6, pt.h * s * 0.42, (pt.w * s) / 11);
    b += text(ox + (pt.x + pt.w / 2) * s, oy + (pt.y + Math.min(pt.h / 2, 40)) * s + fs * 0.35, `${pt.id} · ${f1(pt.w)}×${f1(pt.h)}`, fs, `text-anchor="middle" font-family="JetBrains Mono, monospace"`);
  });
  b += text(ox + BOARD.W * s - 1, oy - 2, `aprovechamiento ${Math.round((used / (BOARD.W * BOARD.H)) * 100)} %`, 2.6, `text-anchor="end" fill="${MUTED}"`);
  return b;
}

function sheetsCorte(d, n, total) {
  const boards = packBoards(d);
  const p = d.params;
  const s = Math.min((W - 52) / 2 / BOARD.W, 120 / BOARD.H);
  const out = [];
  for (let k = 0; k < Math.max(1, boards.length); k += 2) {
    let b = text(16, 20, `OPTIMIZACIÓN DE CORTE · tableros ${BOARD.W} × ${BOARD.H} · sierra ${BOARD.kerf} mm · margen ${BOARD.edge}`, 4, 'font-weight="700"');
    boards.slice(k, k + 2).forEach((bd, j) => (b += boardSVG(d, bd, 20 + j * (BOARD.W * s + 12), 30, s, k + j)));
    if (k === 0) b += sticksSVG(d, 30 + BOARD.H * s + 16);
    out.push(sheet('Corte', `${boards.length} tablero${boards.length > 1 ? 's' : ''} (${[...new Set(boards.map(x => x.T))].join(' y ')} mm) · guillotina por franjas`, n + out.length, total, b, d));
  }
  return out;
}

function sticksSVG(d, yy) {
  let b = '';
  const sticks = [];
  d.pieces.forEach(pc => { if (!pc.solids) return; const c = pieceCut(pc); if (c.stock === 'taco') sticks.push({ id: pc.id, L: c.L, sec: `${f1(Math.min(c.W, c.T))}×${f1(Math.max(c.W, c.T))}` }); });
  const bySec = {};
  sticks.forEach(st => (bySec[st.sec] = bySec[st.sec] || []).push(st));
  b += text(20, yy, 'LISTONES Y TACOS · barras de 2400 mm', 3.4, 'font-weight="700"');
  yy += 5;
  const bs = (W - 120) / 2400;
  Object.entries(bySec).forEach(([sec, list]) => {
    list.sort((a, c) => c.L - a.L);
    const bars = [];
    list.forEach(st => { const bar = bars.find(q => q.used + st.L + 4 <= 2400); if (bar) { bar.items.push(st); bar.used += st.L + 4; } else bars.push({ used: st.L + 4, items: [st] }); });
    bars.forEach((bar, k) => {
      if (yy > H - 40) return;
      b += text(20, yy + 3, `${sec}${bars.length > 1 ? ' · ' + (k + 1) : ''}`, 2.6, 'font-family="JetBrains Mono, monospace"');
      b += rect(48, yy, 48 + 2400 * bs, yy + 4.2, `fill="#efe7da" stroke="${INK}" stroke-width=".25"`);
      let x = 0;
      bar.items.forEach(st => { b += rect(48 + x * bs, yy, 48 + (x + st.L) * bs, yy + 4.2, `fill="#fff" stroke="${INK}" stroke-width=".25"`); if (st.L * bs > 9) b += text(48 + (x + st.L / 2) * bs, yy + 3, `${st.id} ${f1(st.L)}`, 1.9, 'text-anchor="middle"'); x += st.L + 4; });
      yy += 6.5;
    });
  });
  return b;
}

// ───────── guía de taller ─────────
function sheetTaller(d, n, total) {
  const p = d.params, m = d.metrics;
  const steps = planAssembly(d);
  let b = text(16, 20, 'GUÍA DE TALLER', 5, 'font-weight="700"');
  const colW = (W - 44) / 2;
  let x = 16, y = 30;
  const wrap = (str, max) => { const words = String(str).split(' '); const lines = []; let cur = ''; words.forEach(w => { if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }); if (cur.trim()) lines.push(cur.trim()); return lines; };
  steps.forEach((st, i) => {
    const lines = wrap(st.text, 112);
    const need = 5 + lines.length * 3.2 + 2;
    if (y + need > H - 40) { x += colW + 12; y = 30; }
    b += `<rect x="${x}" y="${y - 3.4}" width="6" height="4.4" rx="1" fill="${ACC}"/>` + text(x + 3, y - 0.2, String(i + 1), 3, 'text-anchor="middle" font-weight="700"');
    b += text(x + 8, y, st.title + (st.flip ? ' · boca abajo' : '') + `  ·  ${st.min} min${st.dry ? ' + ' + st.dry + ' secado' : ''}`, 3.3, 'font-weight="700"');
    y += 4.2;
    lines.forEach(l => { b += text(x + 8, y, l, 2.45); y += 3.2; });
    y += 2.4;
  });
  // herrajes
  if (y > H - 80) { x += colW + 12; y = 30; }
  const bom = buildBOM(d);
  b += text(x, y + 2, `LISTA DE COMPRA · ≈ ${Math.round(bom.total)} €`, 3.4, 'font-weight="700"'); y += 6;
  bom.items.forEach(h => { if (y > H - 36) return; b += rect(x + 1, y - 2.2, x + 3.4, y + 0.2, `stroke="${INK}" stroke-width=".2"`) + text(x + 5, y, `${String(h.qty).replace('.', ',')}${h.u ? ' ' + h.u : ''} × ${h.name}`, 2.35) + text(x + colW - 2, y, `${Math.round(h.cost)} €`, 2.35, `text-anchor="end" fill="${MUTED}"`); y += 3.1; });
  y += 3;
  if (y < H - 50) {
    b += text(x, y + 2, 'HERRAMIENTAS', 3.4, 'font-weight="700"'); y += 6;
    ['Sierra circular con guía (o corte en tienda)', 'Caladora + taladro con brocas 3, 5,5, 7, 9 y corona Ø' + p.cableDia, 'Avellanador, llaves Allen 3 y 4', '4–6 sargentos, escuadra, metro', 'Lijadora orbital (120/180)', 'Rodillo y cúter (revestimiento)'].forEach(t => { if (y > H - 36) return; b += text(x + 2, y, '· ' + t, 2.4); y += 3.1; });
  }
  return sheet('Taller', 'Orden de trabajo, herrajes y herramientas', n, total, b, d);
}

// ───────── vista explosionada (captura del 3D) ─────────
function sheetExplosion(d, n, total, snap) {
  let b = text(16, 20, 'VISTA EXPLOSIONADA', 5, 'font-weight="700"');
  b += text(16, 25, 'Cada pieza con su ID; la lista de abajo dice qué es. Montaje: de dentro afuera, con la caja boca abajo para la tele y la base.', 2.6, `fill="${MUTED}"`);
  if (!snap) return sheet('Explosión', 'Vista de conjunto con piezas separadas', n, total, b + text(20, 60, 'Abre los planos desde la vista 3D para generar esta hoja.', 3), d);
  const iw = W - 32, ih = iw * snap.h / snap.w, ox = 16, oy = 30;
  const ihc = Math.min(ih, 200), iwc = ihc * snap.w / snap.h, ox2 = ox + (iw - iwc) / 2;
  b += `<image href="${snap.url}" x="${ox2}" y="${oy}" width="${iwc}" height="${ihc}" preserveAspectRatio="xMidYMid meet"/>`;
  const sx = iwc / snap.w, sy = ihc / snap.h;
  const seen = new Set();
  snap.labels.forEach((l, i) => {
    if (seen.has(l.id)) return; seen.add(l.id);
    const x = ox2 + l.x * sx, y = oy + l.y * sy;
    if (x < ox || x > ox + iw || y < oy || y > oy + ihc) return;
    b += `<circle cx="${x}" cy="${y}" r="3.2" fill="#fff" stroke="${ACC}" stroke-width=".6"/>` + text(x, y + 1.1, l.id, 2.4, 'text-anchor="middle" font-weight="700"');
  });
  // leyenda
  const list = d.pieces.filter(pc => seen.has(pc.id));
  const cols = 4, cw = (W - 32) / cols;
  list.forEach((pc, i) => { const cx = 16 + (i % cols) * cw, cy = oy + ihc + 8 + Math.floor(i / cols) * 3.6; if (cy > H - 34) return; b += text(cx, cy, pc.id, 2.4, `font-weight="700" fill="${ACC}"`) + text(cx + 7, cy, pc.name, 2.4); });
  return sheet('Explosión', 'Vista de conjunto con piezas separadas', n, total, b, d);
}

// ───────── montaje ilustrado: 6 pasos por hoja ─────────
function sheetsMontaje(d, n0, total, shots) {
  const steps = planAssembly(d);
  const out = [];
  const wrap = (str, max) => { const words = String(str).split(' '); const lines = []; let cur = ''; words.forEach(w => { if ((cur + ' ' + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; }); if (cur.trim()) lines.push(cur.trim()); return lines; };
  for (let k = 0; k < steps.length; k += 6) {
    let b = text(16, 20, 'MONTAJE ILUSTRADO', 5, 'font-weight="700"');
    b += text(16, 25, 'En naranja, las piezas de cada paso. «Boca abajo»: la caja apoyada sobre el marco, encima de una manta.', 2.6, `fill="${MUTED}"`);
    const cw = (W - 32 - 8) / 3, ch = (H - 30 - 34 - 6) / 2;
    steps.slice(k, k + 6).forEach((st, j) => {
      const i = k + j, x = 16 + (j % 3) * (cw + 4), y = 30 + Math.floor(j / 3) * (ch + 6);
      b += rect(x, y, x + cw, y + ch, `stroke="${INK}" stroke-width=".3"`);
      b += `<rect x="${x + 2}" y="${y + 2}" width="7" height="5" rx="1" fill="${ACC}"/>` + text(x + 5.5, y + 5.8, String(i + 1), 3.2, 'text-anchor="middle" font-weight="700"');
      b += text(x + 11, y + 6, st.title + (st.flip ? ' · boca abajo' : ''), 3.2, 'font-weight="700"');
      const shot = shots && shots[i];
      const ih = ch * 0.56, iw = cw - 4;
      if (shot) {
        b += `<image href="${shot.url}" x="${x + 2}" y="${y + 9}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid meet"/>`;
        const s2 = Math.min(iw / shot.w, ih / shot.h), ox = x + 2 + (iw - shot.w * s2) / 2, oy = y + 9 + (ih - shot.h * s2) / 2;
        const seen = new Set();
        shot.labels.forEach(l => { if (seen.has(l.id) || seen.size > 10) return; seen.add(l.id); const lx = ox + l.x * s2, ly = oy + l.y * s2; if (lx < x || lx > x + cw || ly < y + 9 || ly > y + 9 + ih) return; b += `<rect x="${lx - 3.4}" y="${ly - 1.8}" width="6.8" height="3.4" rx=".8" fill="${ACC}"/>` + text(lx, ly + 0.9, l.id, 2.1, 'text-anchor="middle" font-weight="700"'); });
      }
      const lines = wrap(st.text, 78);
      const maxL = Math.floor((ch - ih - 13) / 2.75);
      lines.slice(0, maxL).forEach((l, q) => (b += text(x + 2.5, y + 9 + ih + 4.5 + q * 2.75, q === maxL - 1 && lines.length > maxL ? l + '…' : l, 2.15)));
    });
    out.push(sheet('Montaje', `Pasos ${k + 1}–${Math.min(steps.length, k + 6)} de ${steps.length}`, n0 + out.length, total, b, d));
  }
  return out;
}

// ───────── patrón del revestimiento ─────────
function sheetRevestimiento(d, n, total) {
  const p = d.params, m = d.metrics;
  let b = text(16, 20, 'PATRÓN DEL REVESTIMIENTO', 5, 'font-weight="700"');
  if (p.cover === 'ninguno' || p.cover === 'pintura') return sheet('Forro', 'Sin revestimiento', n, total, b + text(16, 34, p.cover === 'pintura' ? 'Acabado pintado: imprimación, lijado fino (240) y dos manos de esmalte satinado; sin patrón de corte.' : 'El diseño no lleva revestimiento: madera vista (aceite o barniz).', 3.4), d);
  const ov = 20;                                       // solape arriba y abajo
  const H0 = m.yTop - m.y0;                            // alto de las paredes + marco
  const segs = [m.X / 2, m.Z, m.X, m.Z, m.X / 2];      // empieza en el centro de la pared del fondo
  const names = ['Fondo (½)', 'Lateral izq.', 'Frente', 'Lateral der.', 'Fondo (½)'];
  const Ltot = segs.reduce((s, v) => s + v, 0) + 30;   // + 30 de solape en la junta
  const sc = (W - 40) / Ltot, ox = 20, oy = 44, hh = (H0 + 2 * ov) * sc;
  b += text(16, 26, `${COVERS[p.cover].label}: una tira continua de ${f1(Ltot)} × ${f1(H0 + 2 * ov)} mm (escala 1:${Math.round(1 / sc)}). Junta en el centro de la pared del fondo, bajo el asa.`, 2.8, `fill="${MUTED}"`);
  b += rect(ox, oy, ox + Ltot * sc, oy + hh, `fill="#f1efe9" stroke="${INK}" stroke-width=".4"`);
  b += rect(ox, oy + ov * sc, ox + Ltot * sc, oy + hh - ov * sc, `fill="#e4e1d9" stroke="none"`);
  let x = 0;
  segs.forEach((L, i) => {
    const xa = ox + x * sc;
    if (i) {
      b += `<line x1="${xa}" y1="${oy}" x2="${xa}" y2="${oy + hh}" stroke="${DIM}" stroke-width=".3" stroke-dasharray="1.5 1"/>`;
      // cortes en V en las esquinas (arriba y abajo) para doblar el solape
      b += `<path d="M${xa - ov * sc} ${oy} L${xa} ${oy + ov * sc} L${xa + ov * sc} ${oy}" stroke="${INK}" stroke-width=".3"/><path d="M${xa - ov * sc} ${oy + hh} L${xa} ${oy + hh - ov * sc} L${xa + ov * sc} ${oy + hh}" stroke="${INK}" stroke-width=".3"/>`;
    }
    b += text(xa + (L * sc) / 2, oy + hh / 2 + 1, names[i], 3, 'text-anchor="middle"');
    b += dim(xa, oy + hh, xa + L * sc, oy + hh, -5, f1(L), { size: 2.4 });
    x += L;
  });
  b += `<line x1="${ox + x * sc}" y1="${oy}" x2="${ox + x * sc}" y2="${oy + hh}" stroke="${DIM}" stroke-width=".3" stroke-dasharray="1.5 1"/>`;
  b += text(ox + (x + 15) * sc, oy - 2, 'solape 30', 2.4, `text-anchor="middle" fill="${MUTED}"`);
  b += dim(ox + Ltot * sc, oy, ox + Ltot * sc, oy + hh, -5, f1(H0 + 2 * ov), { size: 2.4 });
  b += text(ox, oy + hh + 16, 'Líneas discontinuas: esquinas (pliegue). Franja oscura: la pared; las franjas claras de 20 mm se doblan: arriba sobre el marco, abajo hacia dentro hasta el listón (sin tapar el apoyo de la base).', 2.6, `fill="${MUTED}"`);
  // huecos a recortar en la tira
  let hy = oy + hh + 26;
  b += text(16, hy, 'RECORTAR DESPUÉS DE PEGAR (cúter por el borde del hueco de la madera)', 3.2, 'font-weight="700"'); hy += 5;
  const tags = new Map();
  d.pieces.filter(pc => pc.skin).forEach(pc => (pc.solids[0].holes || []).forEach(h => { if (h.tag) tags.set(pc.name + ': ' + h.tag, (tags.get(pc.name + ': ' + h.tag) || 0) + 1); }));
  [...tags.entries()].slice(0, 12).forEach(([k, v]) => { b += text(18, hy, `· ${v > 1 ? v + '× ' : ''}${k}`, 2.6); hy += 3.6; });
  if (p.frameFinish === 'mismo') {
    hy += 4;
    const fw = m.X + 2 * ov, fz = m.Z + 2 * ov;
    b += text(16, hy, `MARCO FORRADO: una pieza de ${f1(fw)} × ${f1(fz)} mm; corta la ventana dejando 15 mm para doblar hacia dentro y pinta de negro el canto interior antes.`, 2.8); hy += 5;
  }
  const area = (Ltot * (H0 + 2 * ov) + (p.frameFinish === 'mismo' ? (m.X + 40) * (m.Z + 40) : 0)) * 1e-6;
  b += text(16, Math.min(H - 36, hy + 6), `Material: ${f1(area)} m² netos. Los rollos son de 1,37–1,40 m de ancho: sin juntas necesitas ${f1(Math.ceil((Ltot + 100) / 100) / 10)} m lineales; ${m.X + 40 <= 1370 ? `en 4 trozos (uno por pared, juntas en las esquinas) cortados a lo ancho del rollo basta con ${f1(Math.ceil(((H0 + 2 * ov) * 4 + (p.frameFinish === 'mismo' ? m.Z + 40 : 0) + 100) / 100) / 10)} m` : 'las paredes largas no caben a lo ancho del rollo: compra la tira entera'}.`, 2.8, 'font-weight="600"');
  return sheet('Forro', 'Revestimiento: tira continua con pliegues y cortes de esquina', n, total, b, d);
}

// ───────── plantillas 1:1 por trozos de A3 ─────────
function sheetsPlantillas(d) {
  const pick = d.pieces.filter(pc => ['R1', 'W1', 'W2', 'W3', 'W4', 'A1'].includes(pc.id) || (pc.id === 'H1'));
  const out = [];
  const PW = W - 40, PH = H - 70;    // zona útil por hoja (mm reales a 1:1)
  pick.forEach(pc => {
    const so = pc.solids.reduce((a, s) => ((s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]) >= (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) ? s : a), pc.solids[0]);
    const [u0, v0, u1, v1] = so.rect;
    // siempre la cara exterior: en el fondo (W1) y el lateral derecho (W4) se invierte u
    const flip = ['W1', 'W4'].includes(pc.id);
    const F = u => (flip ? u0 + u1 - u : u);
    const fr = r => (flip ? [F(r[2]), r[1], F(r[0]), r[3]] : r);
    const fl = l => l.map(([u, v]) => [F(u), v]);
    const holes = (so.holes || []).map(h => (h.circle ? { ...h, circle: [F(h.circle[0]), h.circle[1], h.circle[2]] } : h.slot ? { ...h, slot: fr(h.slot) } : { ...h, rect: fr(h.rect) }));
    (pc.drill || []).forEach(([u, v, r]) => holes.push({ circle: [F(u), (v0 + v1) / 2, r] }));
    const same = d.pieces.filter(q => q !== pc && q.name.replace(/ (izq\.|der\.|izquierdo|derecho|fondo|frente|frontal|del fondo)$/i, '') === pc.name.replace(/ (izq\.|der\.|izquierdo|derecho|fondo|frente|frontal|del fondo)$/i, '') && q.solids && q.solids[0].plane === so.plane && Math.abs((q.solids[0].rect[2] - q.solids[0].rect[0]) - (u1 - u0)) < 0.5).map(q => q.id);
    const isWall = pc.role === 'pared';
    const ends = so.plane === 'XY' ? ['lado izquierdo', 'lado derecho'] : ['lado del asa (fondo)', 'lado del jugador'];
    const [endL, endR] = flip ? [ends[1], ends[0]] : ends;
    const L = u1 - u0, Hh = v1 - v0;
    const nx = Math.ceil(L / PW), ny = Math.ceil(Hh / PH);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const tu0 = u0 + i * PW, tv0 = v1 - (j + 1) * PH;     // de izquierda a derecha y de arriba abajo
      const ox = 20, oy = 34;
      const X = u => ox + (u - tu0), Y = v => oy + PH - (v - tv0);
      let b = `<clipPath id="cp${pc.id}${i}${j}"><rect x="${ox}" y="${oy}" width="${PW}" height="${PH}"/></clipPath>`;
      b += text(16, 18, `PLANTILLA 1:1 · ${pc.id} ${pc.name}${same.length ? ` (vale también para ${same.join(', ')})` : ''}${isWall ? ' · CARA EXTERIOR' : ''}`, 4.4, 'font-weight="700"');
      if (isWall) { if (i === 0) b += text(ox + 2, oy - 2, '← ' + endL, 2.6, `fill="${DIM}"`); if (i === nx - 1) b += text(ox + Math.min(PW, u1 - tu0) - 2, oy - 2, endR + ' →', 2.6, `fill="${DIM}" text-anchor="end"`); }
      b += text(16, 24, `Trozo ${j * nx + i + 1} de ${nx * ny} (columna ${i + 1}/${nx}${ny > 1 ? `, fila ${j + 1}/${ny}` : ''}). Imprime al 100 % (sin «ajustar a página») y comprueba la regla de 100 mm. Empalma por las marcas ✚.`, 2.6, `fill="${MUTED}"`);
      b += `<g clip-path="url(#cp${pc.id}${i}${j})">`;
      rectMinusRects(so.rect, (so.notches || []).map(fr)).forEach(reg => {
        const lp = l => 'M' + l.map(([u, v]) => `${X(u)},${Y(v)}`).join('L') + 'Z';
        b += `<path d="${lp(reg.outer)} ${reg.holes.map(lp).join(' ')}" fill-rule="evenodd" fill="#faf7f0" stroke="${INK}" stroke-width=".35"/>`;
      });
      holes.forEach(h => {
        if (h.circle) {
          const [u, v, r] = h.circle;
          b += `<circle cx="${X(u)}" cy="${Y(v)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width=".3"/><path d="M${X(u) - r - 3} ${Y(v)}h${2 * r + 6}M${X(u)} ${Y(v) - r - 3}v${2 * r + 6}" stroke="${DIM}" stroke-width=".2"/>`;
          b += text(X(u) + r + 1.5, Y(v) - r - 1, `Ø${f1(2 * r)}`, 2.2, `fill="${DIM}"`);
        } else {
          const r = h.slot || h.rect, x0 = X(r[0]), x1 = X(r[2]), y0 = Y(r[3]), y1 = Y(r[1]);
          b += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${h.slot ? Math.min(x1 - x0, y1 - y0) / 2 : 0}" fill="#fff" stroke="${INK}" stroke-width=".3"/>`;
        }
      });
      // cotas acumuladas de los huecos desde el borde izquierdo
      const xs = [...new Set(holes.map(h => (h.circle ? h.circle[0] : ((h.slot || h.rect)[0] + (h.slot || h.rect)[2]) / 2)).map(v => Math.round(v * 10) / 10))].sort((a, c) => a - c);
      xs.forEach(u => { if (u < tu0 || u > tu0 + PW) return; b += `<line x1="${X(u)}" y1="${Y(v0) + 2}" x2="${X(u)}" y2="${Y(v0) + 9}" stroke="${DIM}" stroke-width=".2"/>` + text(X(u) + 0.6, Y(v0) + 8, f1(u - u0), 2.2, `fill="${DIM}" transform="rotate(-90 ${X(u) + 0.6} ${Y(v0) + 8})"`); });
      b += '</g>';
      // marcas de empalme y regla
      [[ox, oy], [ox + PW, oy], [ox, oy + PH], [ox + PW, oy + PH]].forEach(([x, y]) => (b += `<path d="M${x - 4} ${y}h8M${x} ${y - 4}v8" stroke="${INK}" stroke-width=".3"/>`));
      b += `<path d="M${ox} ${H - 26}h100" stroke="${INK}" stroke-width=".5"/>` + [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(k => `<path d="M${ox + k} ${H - 26}v${k % 50 ? -2 : -4}" stroke="${INK}" stroke-width=".3"/>`).join('') + text(ox + 102, H - 25, '100 mm', 2.6);
      out.push(sheet('Plantilla', `${pc.id} · trozo ${j * nx + i + 1}/${nx * ny}`, out.length + 1, 0, b, d));
    }
  });
  return out.map((s, k) => s.replace(/Hoja (\d+)\/0/, `Hoja ${k + 1}/${out.length}`));
}

export function buildSheets(d, set, snap) {
  const nDes = (() => { const rows = cutRows(d).filter(r => r.stock !== 'espuma'); const big = rows.filter(r => r.L > 500 && r.W > 60).length; return Math.ceil(big / 4) + Math.ceil((rows.length - big) / 9); })();
  const nMont = Math.ceil(planAssembly(d).length / 6);
  const nCor = Math.max(1, Math.ceil(packBoards(d).length / 2));
  const total = 1 + nDes + nCor + 2 + 1 + nMont;
  const pg = { conj: 1, des: 2, corte: 2 + nDes, taller: 2 + nDes + nCor, expl: 4 + nDes + nCor, mont: 5 + nDes + nCor };
  const s = snap || {};
  if (set === 'conjunto') return [sheetConjunto(d, pg.conj, total), sheetExplosion(d, pg.expl, total, s.explosion || (Array.isArray(snap) ? null : snap))];
  if (set === 'despiece') return sheetsDespiece(d, pg.des, total);
  if (set === 'corte') return sheetsCorte(d, pg.corte, total);
  if (set === 'taller') return [sheetTaller(d, pg.taller, total), sheetRevestimiento(d, pg.taller + 1, total)];
  if (set === 'montaje') return sheetsMontaje(d, pg.mont, total, Array.isArray(snap) ? snap : s.montaje);
  if (set === 'plantillas') return sheetsPlantillas(d);
  return [sheetConjunto(d, pg.conj, total), ...sheetsDespiece(d, pg.des, total), ...sheetsCorte(d, pg.corte, total), sheetTaller(d, pg.taller, total), sheetRevestimiento(d, pg.taller + 1, total), sheetExplosion(d, pg.expl, total, s.explosion), ...sheetsMontaje(d, pg.mont, total, s.montaje)];
}
