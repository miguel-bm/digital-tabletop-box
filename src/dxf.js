import { packBoards, BOARD } from './cutlist.js';
import { rectMinusRects } from './geometry.js';

// DXF R12 de las piezas de tablero colocadas como en el plano de corte (mm).
// Capas: CORTE_EXT (contornos), CORTE_INT (ventanas y ranuras), TALADRO (círculos), TEXTO, TABLERO.
export function boardsDXF(d) {
  const boards = packBoards(d);
  const out = ['0', 'SECTION', '2', 'ENTITIES'];
  const poly = (pts, layer) => {
    out.push('0', 'POLYLINE', '8', layer, '66', '1', '70', '1');
    pts.forEach(([x, y]) => out.push('0', 'VERTEX', '8', layer, '10', x.toFixed(3), '20', y.toFixed(3)));
    out.push('0', 'SEQEND', '8', layer);
  };
  const circle = (x, y, r, layer) => out.push('0', 'CIRCLE', '8', layer, '10', x.toFixed(3), '20', y.toFixed(3), '40', r.toFixed(3));
  const text = (x, y, h, s) => out.push('0', 'TEXT', '8', 'TEXTO', '10', x.toFixed(2), '20', y.toFixed(2), '40', String(h), '1', s);
  boards.forEach((b, k) => {
    const oy = k * (BOARD.H + 200);
    poly([[0, oy], [BOARD.W, oy], [BOARD.W, oy + BOARD.H], [0, oy + BOARD.H]], 'TABLERO');
    text(0, oy + BOARD.H + 40, 30, `Tablero ${k + 1} · ${BOARD.W}x${BOARD.H}x${b.T}`);
    b.parts.forEach(pt => {
      const pc = d.pieces.find(q => q.id === pt.id);
      const so = pc.solids.reduce((a, s) => ((s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1]) >= (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) ? s : a), pc.solids[0]);
      const [u0, v0, u1, v1] = so.rect;
      const rot = Math.abs((u1 - u0) - pt.w) > 0.5;   // colocada girada 90°
      // papel: x hacia la derecha, y hacia arriba; tablero empieza en (0, oy)
      const P = (u, v) => rot ? [pt.x + (v - v0), oy + BOARD.H - pt.y - (u1 - u)] : [pt.x + (u - u0), oy + BOARD.H - pt.y - pt.h + (v - v0)];
      rectMinusRects(so.rect, so.notches || []).forEach(reg => {
        poly(reg.outer.map(([u, v]) => P(u, v)), 'CORTE_EXT');
        reg.holes.forEach(hl => poly(hl.map(([u, v]) => P(u, v)), 'CORTE_INT'));
      });
      (so.holes || []).forEach(h => {
        if (h.circle) { const [x, y] = P(h.circle[0], h.circle[1]); circle(x, y, h.circle[2], h.circle[2] <= 5 ? 'TALADRO' : 'CORTE_INT'); }
        else if (h.slot) {
          const [a0, b0, a1, b1] = h.slot, w = a1 - a0, hh = b1 - b0, r = Math.min(w, hh) / 2, pts = [];
          const cs = w >= hh ? [[a0 + r, (b0 + b1) / 2, Math.PI / 2, 3 * Math.PI / 2], [a1 - r, (b0 + b1) / 2, -Math.PI / 2, Math.PI / 2]] : [[(a0 + a1) / 2, b1 - r, 0, Math.PI], [(a0 + a1) / 2, b0 + r, Math.PI, 2 * Math.PI]];
          cs.forEach(([cx, cy, s, e]) => { for (let i = 0; i <= 8; i++) { const t = s + ((e - s) * i) / 8; pts.push(P(cx + r * Math.cos(t), cy + r * Math.sin(t))); } });
          poly(pts, 'CORTE_INT');
        } else { const [a0, b0, a1, b1] = h.rect; poly([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], 'CORTE_INT'); }
      });
      const c = P((u0 + u1) / 2, (v0 + v1) / 2);
      text(c[0] - 40, c[1], 18, pt.id);
    });
  });
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
}
