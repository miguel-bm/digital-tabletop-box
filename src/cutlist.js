import { pieceCut } from './model.js';

const STOCK = {
  tablero: p => `Contrachapado ${p.t} mm`,
  taco: () => 'Listón / taco de pino',
  protector: () => 'Protector (a medida)',
  espuma: () => 'Espuma',
};

export const BOARD = { W: 2440, H: 1220, kerf: 4, edge: 10 };

// Filas del despiece: piezas iguales agrupadas.
export function cutRows(d) {
  const rows = new Map();
  d.pieces.forEach(pc => {
    if (pc.role === 'tv' || pc.skin || pc.role === 'burlete') return;
    const c = pieceCut(pc);
    const stock = c.stock || 'tablero';
    const k = [stock, pc.name.replace(/ (izq\.|der\.|izquierdo|derecho|fondo|frente|frontal|del fondo)$/i, ''), c.L, c.W, c.T].join('|');
    if (!rows.has(k)) rows.set(k, { stock, stockLabel: stock === 'tablero' ? `Contrachapado ${String(c.T).replace('.', ',')} mm` : STOCK[stock](d.params), name: pc.name, L: c.L, W: c.W, T: c.T, qty: 0, ids: [], notes: c.notes || notesFor(pc) });
    const r = rows.get(k); r.qty += c.n || 1; r.ids.push(pc.id);
    if (r.qty > 1) r.name = r.name.replace(/ (izq\.|der\.|izquierdo|derecho|fondo|frente|frontal|del fondo)$/i, '');
  });
  const order = ['tablero', 'taco', 'protector', 'espuma'];
  return [...rows.values()].sort((a, b) => order.indexOf(a.stock) - order.indexOf(b.stock) || b.L * b.W - a.L * a.W);
}

function notesFor(pc) {
  const tags = new Map();
  pc.solids.forEach(s => (s.holes || []).forEach(h => { if (h.tag) tags.set(h.tag, (tags.get(h.tag) || 0) + 1); }));
  pc.solids.forEach(s => (s.notches || []).forEach(() => tags.set('Muesca en canto', (tags.get('Muesca en canto') || 0) + 1)));
  if (pc.role === 'marco' && pc.solids[0].holes && pc.solids[0].holes.some(h => h.rect && !h.tag)) tags.set('Ventana interior', 1);
  return [...tags.entries()].map(([t, n]) => (n > 1 ? `${n}× ` : '') + t).join(' · ');
}

export function cutListCSV(d) {
  const rows = cutRows(d);
  const lines = [['ID', 'Pieza', 'Material', 'Largo', 'Ancho', 'Grueso', 'Ud', 'Notas'].join(';')];
  rows.forEach(r => lines.push([r.ids.join(' '), r.name, r.stockLabel, r.L, r.W, r.T, r.qty, r.notes || ''].map(v => String(v).replace(/;/g, ',')).join(';')));
  return lines.join('\n');
}

// Optimización de corte en tableros (guillotina por franjas, giro permitido), un juego por grosor.
export function packBoards(d) {
  const byT = new Map();
  d.pieces.forEach(pc => {
    if (pc.role === 'tv' || pc.skin || pc.role === 'burlete') return;
    const c = pieceCut(pc);
    if ((c.stock || 'tablero') !== 'tablero') return;
    const T = Math.round(c.T * 10) / 10;
    if (!byT.has(T)) byT.set(T, []);
    for (let i = 0; i < (c.n || 1); i++) byT.get(T).push({ id: pc.id, name: pc.name, w: c.L, h: c.W, frame: pc.role === 'marco' || pc.role === 'tapa' && pc.key === 'lidTop' });
  });
  const { W, H, kerf, edge } = BOARD;
  const boards = [];
  [...byT.entries()].sort((a, b) => b[0] - a[0]).forEach(([T, parts]) => {
    const mine = [];
    parts.sort((a, b) => b.h - a.h || b.w - a.w);
    const newBoard = () => { const b = { strips: [], used: edge, parts: [], T }; mine.push(b); boards.push(b); return b; };
    for (const pt of parts) {
      let w = pt.w, h = pt.h;
      if (w > W - 2 * edge && h <= W - 2 * edge) [w, h] = [h, w];
      let placed = false;
      for (const b of mine) {
        for (const s of b.strips) {
          if (h <= s.h && s.x + w <= W - edge) { b.parts.push({ ...pt, x: s.x, y: s.y, w, h }); s.x += w + kerf; placed = true; break; }
        }
        if (placed) break;
        if (b.used + h <= H - edge) {
          const s = { y: b.used, h, x: edge };
          b.strips.push(s); b.used += h + kerf;
          b.parts.push({ ...pt, x: s.x, y: s.y, w, h }); s.x += w + kerf; placed = true; break;
        }
      }
      if (!placed) {
        const b = newBoard();
        const s = { y: b.used, h, x: edge };
        b.strips.push(s); b.used += h + kerf;
        b.parts.push({ ...pt, x: s.x, y: s.y, w, h }); s.x += w + kerf;
      }
    }
  });
  return boards;
}

export function boardUsage(d) {
  const boards = packBoards(d);
  let area = 0, battenM = 0;
  d.pieces.forEach(pc => {
    if (pc.role === 'tv' || pc.skin) return;
    const c = pieceCut(pc);
    if ((c.stock || 'tablero') === 'tablero') area += c.L * c.W * (c.n || 1) * 1e-6;
    if (c.stock === 'taco') battenM += (c.L + 5) / 1000;
  });
  const byT = {};
  boards.forEach(b => (byT[b.T] = (byT[b.T] || 0) + 1));
  return { boards: boards.length, byT, area, battenM, packed: boards };
}
