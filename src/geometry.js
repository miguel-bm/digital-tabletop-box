import * as THREE from 'three';

const EPS = 0.01;

// Resta una lista de rectángulos (u0,v0,u1,v1) a un rectángulo exterior.
// Devuelve una lista de regiones { outer: [[u,v]...], holes: [[[u,v]...]] }
// (vacía si el corte se come la pieza entera). Funciona sobre la rejilla que forman
// los bordes de todos los rectángulos y traza el contorno de las celdas que quedan.
export function rectMinusRects(o, cuts) {
  const cs = cuts
    .map(c => [Math.max(c[0], o[0]), Math.max(c[1], o[1]), Math.min(c[2], o[2]), Math.min(c[3], o[3])])
    .filter(c => c[2] - c[0] > EPS && c[3] - c[1] > EPS);
  if (!cs.length) return [{ outer: rectLoop(o), holes: [] }];

  const uniq = a => [...new Set(a.map(v => Math.round(v * 1000) / 1000))].sort((x, y) => x - y);
  const xs = uniq([o[0], o[2], ...cs.flatMap(c => [c[0], c[2]])]);
  const ys = uniq([o[1], o[3], ...cs.flatMap(c => [c[1], c[3]])]);
  const nx = xs.length - 1, ny = ys.length - 1;
  const kept = (i, j) => {
    if (i < 0 || j < 0 || i >= nx || j >= ny) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return !cs.some(c => cx > c[0] && cx < c[2] && cy > c[1] && cy < c[3]);
  };

  const edges = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!kept(i, j)) continue;
    const a = [i, j], b = [i + 1, j], c = [i + 1, j + 1], d = [i, j + 1];
    if (!kept(i, j - 1)) edges.push([a, b]);
    if (!kept(i + 1, j)) edges.push([b, c]);
    if (!kept(i, j + 1)) edges.push([c, d]);
    if (!kept(i - 1, j)) edges.push([d, a]);
  }
  if (!edges.length) return [];

  const key = p => p[0] + ',' + p[1];
  const byStart = new Map();
  edges.forEach(e => { const k = key(e[0]); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(e); });
  const used = new Set();
  const loops = [];
  for (const e0 of edges) {
    if (used.has(e0)) continue;
    const loop = [];
    let e = e0;
    while (e && !used.has(e)) {
      used.add(e);
      loop.push(e[0]);
      const next = (byStart.get(key(e[1])) || []).find(n => !used.has(n));
      e = next;
    }
    loops.push(simplify(loop.map(([i, j]) => [xs[i], ys[j]])));
  }

  const outers = loops.filter(l => area(l) > 0).map(outer => ({ outer, holes: [] }));
  loops.filter(l => area(l) < 0).forEach(h => {
    const host = outers.find(o => pointInPoly(h[0], o.outer, true)) || outers[0];
    if (host) host.holes.push(h);
  });
  return outers;
}

function simplify(pts) {
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[(k - 1 + pts.length) % pts.length], c = pts[k], n = pts[(k + 1) % pts.length];
    const cross = (c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0]);
    if (Math.abs(cross) > 1e-6) out.push(c);
  }
  return out;
}

export const rectLoop = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];

export function area(l) {
  let s = 0;
  for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

export function pointInPoly(p, poly, inclusive) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (inclusive) {
      const onSeg = Math.abs((xj - xi) * (p[1] - yi) - (yj - yi) * (p[0] - xi)) < 1e-6 &&
        p[0] >= Math.min(xi, xj) - 1e-6 && p[0] <= Math.max(xi, xj) + 1e-6 &&
        p[1] >= Math.min(yi, yj) - 1e-6 && p[1] <= Math.max(yi, yj) + 1e-6;
      if (onSeg) return true;
    }
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// Ejes de cada plano: u, v (contorno) y t (grosor) en coordenadas de mundo.
export const PLANES = {
  XY: { u: 'x', v: 'y', t: 'z' },
  XZ: { u: 'x', v: 'z', t: 'y' },
  YZ: { u: 'z', v: 'y', t: 'x' },
};

export function shapeFromRegion(region) {
  const s = new THREE.Shape(region.outer.map(([u, v]) => new THREE.Vector2(u, v)));
  region.holes.forEach(h => s.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v)))));
  return s;
}

// Extruye contornos (en u,v) a lo largo de t y los coloca en el plano indicado.
export function extrudePlanar(shapes, plane, t0, t1, opts = {}) {
  const depth = t1 - t0;
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: opts.curveSegments || 48, ...opts.extrude });
  orient(geo, plane, t0, t1);
  return geo;
}

export function orient(geo, plane, t0, t1) {
  if (plane === 'XY') geo.translate(0, 0, t0);
  else if (plane === 'XZ') { geo.rotateX(Math.PI / 2); geo.translate(0, t1, 0); }
  else if (plane === 'YZ') { geo.rotateY(-Math.PI / 2); geo.translate(t1, 0, 0); }
  return geo;
}

// Proyección de un rectángulo de corte 3D (caja) al plano (u,v) de una pieza.
export function boxToPlane(box, plane) {
  const ax = PLANES[plane];
  const r = a => [box[a + '0'], box[a + '1']];
  const [u0, u1] = r(ax.u), [v0, v1] = r(ax.v), [t0, t1] = r(ax.t);
  return { rect: [u0, v0, u1, v1], t: [t0, t1] };
}

export function loopLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

// Descompone una región ortogonal (contorno + huecos) en rectángulos [u0,v0,u1,v1].
export function regionCells(region) {
  const all = [region.outer, ...region.holes].flat();
  const us = [...new Set(all.map(q => q[0]))].sort((a, b) => a - b);
  const vs = [...new Set(all.map(q => q[1]))].sort((a, b) => a - b);
  const cells = [];
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
    const c = [(us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2];
    if (pointInPoly(c, region.outer) && !region.holes.some(h => pointInPoly(c, h))) cells.push([us[i], vs[j], us[i + 1], vs[j + 1]]);
  }
  return cells;
}

// ── huecos interiores no rectangulares (círculos, ranuras redondeadas) ──
export function holePath(h, Ctor = THREE.Path) {
  const p = new Ctor();
  if (h.circle) { const [u, v, r] = h.circle; p.absarc(u, v, r, 0, Math.PI * 2, true); return p; }
  if (h.slot) {
    const [u0, v0, u1, v1] = h.slot, w = u1 - u0, hh = v1 - v0;
    if (w >= hh) {
      const r = hh / 2, cy = (v0 + v1) / 2;
      p.moveTo(u0 + r, v0); p.absarc(u0 + r, cy, r, -Math.PI / 2, Math.PI / 2, true);
      p.lineTo(u1 - r, v1); p.absarc(u1 - r, cy, r, Math.PI / 2, -Math.PI / 2, true); p.lineTo(u0 + r, v0);
    } else {
      const r = w / 2, cx = (u0 + u1) / 2;
      p.moveTo(u1, v0 + r); p.absarc(cx, v0 + r, r, 0, Math.PI, true);
      p.lineTo(u0, v1 - r); p.absarc(cx, v1 - r, r, Math.PI, 0, true); p.lineTo(u1, v0 + r);
    }
    return p;
  }
  const [u0, v0, u1, v1] = h.rect;
  p.moveTo(u0, v0); p.lineTo(u0, v1); p.lineTo(u1, v1); p.lineTo(u1, v0); p.lineTo(u0, v0);
  return p;
}

export function holeBounds(h) {
  if (h.circle) { const [u, v, r] = h.circle; return [u - r, v - r, u + r, v + r]; }
  return h.slot || h.rect;
}

// Sólido plano: contorno rectangular − muescas en el canto (rects) + huecos interiores.
export function solidGeometry(s) {
  const regions = rectMinusRects(s.rect, (s.notches || []));
  const shapes = regions.map(reg => {
    const sh = shapeFromRegion(reg);
    (s.holes || []).forEach(h => {
      const b = holeBounds(h), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      if (pointInPoly(c, reg.outer)) sh.holes.push(holePath(h));
    });
    return sh;
  });
  if (!shapes.length) return null;
  return extrudePlanar(shapes, s.plane, s.t[0], s.t[1], { curveSegments: 20 });
}
