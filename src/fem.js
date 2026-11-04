// Elementos finitos de lámina plana para la caja: cuadriláteros de 4 nudos con 6 gdl
// (u, v, w, θx, θy, θz). Membrana Q4 con modos incompatibles (QM6, Taylor) y flexión
// Mindlin MITC4 (deformación de cortante interpolada en los puntos medios de los lados:
// sin bloqueo). Material ortótropo simplificado: E igual en las dos direcciones del tablero
// pero módulo de cortante propio del contrachapado (G ≪ E/2(1+ν)).
// Resolución directa: LDLᵀ en perfil (skyline) con numeración RCM. Unidades N, mm, MPa.

const GP = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];
const NAT = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

function shape(xi, eta) {
  const N = NAT.map(([a, b]) => 0.25 * (1 + a * xi) * (1 + b * eta));
  const dXi = NAT.map(([a, b]) => 0.25 * a * (1 + b * eta));
  const dEta = NAT.map(([a, b]) => 0.25 * b * (1 + a * xi));
  return { N, dXi, dEta };
}
function jac(xy, dXi, dEta) {
  let j11 = 0, j12 = 0, j21 = 0, j22 = 0;
  for (let i = 0; i < 4; i++) { j11 += dXi[i] * xy[i][0]; j12 += dXi[i] * xy[i][1]; j21 += dEta[i] * xy[i][0]; j22 += dEta[i] * xy[i][1]; }
  const det = j11 * j22 - j12 * j21;
  return { j11, j12, j21, j22, det, i11: j22 / det, i12: -j12 / det, i21: -j21 / det, i22: j11 / det };
}
const zeros = (r, c) => Array.from({ length: r }, () => new Float64Array(c));

// Matriz de rigidez local 24×24 de un elemento plano (coordenadas locales xy[4][2]).
export function shellK(xy, mat) {
  const { E, nu, G12, G13, t } = mat;
  const q = E / (1 - nu * nu);
  const Q = [[q, nu * q, 0], [nu * q, q, 0], [0, 0, G12]];
  const K = zeros(24, 24);
  // ── membrana con modos incompatibles ──
  const Kcc = zeros(8, 8), Kci = zeros(8, 4), Kii = zeros(4, 4);
  const J0 = jac(xy, shape(0, 0).dXi, shape(0, 0).dEta);
  for (const xi of GP) for (const eta of GP) {
    const s = shape(xi, eta), J = jac(xy, s.dXi, s.dEta);
    const dx = s.dXi.map((a, i) => J.i11 * a + J.i12 * s.dEta[i]);
    const dy = s.dXi.map((a, i) => J.i21 * a + J.i22 * s.dEta[i]);
    const Bc = zeros(3, 8);
    for (let i = 0; i < 4; i++) { Bc[0][2 * i] = dx[i]; Bc[1][2 * i + 1] = dy[i]; Bc[2][2 * i] = dy[i]; Bc[2][2 * i + 1] = dx[i]; }
    // incompatibles: N5 = 1-ξ², N6 = 1-η² (derivadas con J0 y factor det0/det)
    const r = J0.det / J.det;
    const d5 = [-2 * xi, 0], d6 = [0, -2 * eta];
    const inc = [d5, d6].map(([a, b]) => [r * (J0.i11 * a + J0.i12 * b), r * (J0.i21 * a + J0.i22 * b)]);
    const Bi = zeros(3, 4);
    inc.forEach(([ddx, ddy], k) => { Bi[0][2 * k] = ddx; Bi[1][2 * k + 1] = ddy; Bi[2][2 * k] = ddy; Bi[2][2 * k + 1] = ddx; });
    const w = J.det * t;
    const QB = (B, n) => { const o = zeros(3, n); for (let a = 0; a < 3; a++) for (let c = 0; c < n; c++) o[a][c] = Q[a][0] * B[0][c] + Q[a][1] * B[1][c] + Q[a][2] * B[2][c]; return o; };
    const QBc = QB(Bc, 8), QBi = QB(Bi, 4);
    for (let a = 0; a < 8; a++) {
      for (let c = 0; c < 8; c++) Kcc[a][c] += w * (Bc[0][a] * QBc[0][c] + Bc[1][a] * QBc[1][c] + Bc[2][a] * QBc[2][c]);
      for (let c = 0; c < 4; c++) Kci[a][c] += w * (Bc[0][a] * QBi[0][c] + Bc[1][a] * QBi[1][c] + Bc[2][a] * QBi[2][c]);
    }
    for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) Kii[a][c] += w * (Bi[0][a] * QBi[0][c] + Bi[1][a] * QBi[1][c] + Bi[2][a] * QBi[2][c]);
  }
  const KiiInv = inv4(Kii);
  const map8 = i => (i >> 1) * 6 + (i & 1);
  for (let a = 0; a < 8; a++) for (let c = 0; c < 8; c++) {
    let s = 0;
    for (let k = 0; k < 4; k++) for (let l = 0; l < 4; l++) s += Kci[a][k] * KiiInv[k][l] * Kci[c][l];
    K[map8(a)][map8(c)] += Kcc[a][c] - s;
  }
  // ── flexión (Mindlin) + cortante MITC4 ──
  // gdl locales por nudo: w, βx, βy  (βx = θy, βy = −θx)
  const Db = Q.map(r => r.map(v => (v * t ** 3) / 12));
  const ks = (5 / 6) * G13 * t;
  const Kb = zeros(12, 12);
  // cortante covariante en los puntos de amarre A(0,1) B(-1,0) C(0,-1) D(1,0)
  const tie = (xi, eta) => {
    const s = shape(xi, eta);
    let xXi = 0, yXi = 0, xEta = 0, yEta = 0;
    for (let i = 0; i < 4; i++) { xXi += s.dXi[i] * xy[i][0]; yXi += s.dXi[i] * xy[i][1]; xEta += s.dEta[i] * xy[i][0]; yEta += s.dEta[i] * xy[i][1]; }
    const gXi = new Float64Array(12), gEta = new Float64Array(12);
    for (let i = 0; i < 4; i++) {
      gXi[3 * i] = s.dXi[i]; gXi[3 * i + 1] = s.N[i] * xXi; gXi[3 * i + 2] = s.N[i] * yXi;
      gEta[3 * i] = s.dEta[i]; gEta[3 * i + 1] = s.N[i] * xEta; gEta[3 * i + 2] = s.N[i] * yEta;
    }
    return { gXi, gEta };
  };
  const A = tie(0, 1), B = tie(-1, 0), C = tie(0, -1), Dd = tie(1, 0);
  for (const xi of GP) for (const eta of GP) {
    const s = shape(xi, eta), J = jac(xy, s.dXi, s.dEta);
    const dx = s.dXi.map((a, i) => J.i11 * a + J.i12 * s.dEta[i]);
    const dy = s.dXi.map((a, i) => J.i21 * a + J.i22 * s.dEta[i]);
    const Bb = zeros(3, 12);
    for (let i = 0; i < 4; i++) { Bb[0][3 * i + 1] = dx[i]; Bb[1][3 * i + 2] = dy[i]; Bb[2][3 * i + 1] = dy[i]; Bb[2][3 * i + 2] = dx[i]; }
    const gx = new Float64Array(12), ge = new Float64Array(12);
    for (let c = 0; c < 12; c++) { gx[c] = 0.5 * (1 + eta) * A.gXi[c] + 0.5 * (1 - eta) * C.gXi[c]; ge[c] = 0.5 * (1 + xi) * Dd.gEta[c] + 0.5 * (1 - xi) * B.gEta[c]; }
    // [γxz, γyz] = J⁻¹ [γξ, γη]
    const Bs = [new Float64Array(12), new Float64Array(12)];
    for (let c = 0; c < 12; c++) { Bs[0][c] = J.i11 * gx[c] + J.i12 * ge[c]; Bs[1][c] = J.i21 * gx[c] + J.i22 * ge[c]; }
    const w = J.det;
    for (let a = 0; a < 12; a++) for (let c = 0; c < 12; c++) {
      let sb = 0;
      for (let p = 0; p < 3; p++) for (let r = 0; r < 3; r++) sb += Bb[p][a] * Db[p][r] * Bb[r][c];
      Kb[a][c] += w * (sb + ks * (Bs[0][a] * Bs[0][c] + Bs[1][a] * Bs[1][c]));
    }
  }
  // (w, βx, βy) → (w, θx, θy): βx = θy, βy = −θx
  const mapB = (i) => { const n = (i / 3) | 0, k = i % 3; return k === 0 ? [n * 6 + 2, 1] : k === 1 ? [n * 6 + 4, 1] : [n * 6 + 3, -1]; };
  for (let a = 0; a < 12; a++) { const [ia, sa] = mapB(a); for (let c = 0; c < 12; c++) { const [ic, sc] = mapB(c); K[ia][ic] += sa * sc * Kb[a][c]; } }
  // giro de taladro: rigidez ficticia pequeña
  const area = Math.abs(polyArea(xy));
  const kd = 1e-4 * E * t * area / 4;
  for (let n = 0; n < 4; n++) K[n * 6 + 5][n * 6 + 5] += kd;
  return K;
}

function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function inv4(M) {
  const n = 4, A = M.map(r => [...r]), I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [I[c], I[p]] = [I[p], I[c]];
    const d = A[c][c];
    for (let k = 0; k < n; k++) { A[c][k] /= d; I[c][k] /= d; }
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let k = 0; k < n; k++) { A[r][k] -= f * A[c][k]; I[r][k] -= f * I[c][k]; } }
  }
  return I;
}

// Tensión de von Mises en el centro del elemento (máx. de cara superior/inferior)
export function shellStress(xy, mat, ul) {
  const { E, nu, G12, t } = mat;
  const q = E / (1 - nu * nu);
  const s = shape(0, 0), J = jac(xy, s.dXi, s.dEta);
  const dx = s.dXi.map((a, i) => J.i11 * a + J.i12 * s.dEta[i]);
  const dy = s.dXi.map((a, i) => J.i21 * a + J.i22 * s.dEta[i]);
  let ex = 0, ey = 0, gxy = 0, kx = 0, ky = 0, kxy = 0;
  for (let i = 0; i < 4; i++) {
    const u = ul[i * 6], v = ul[i * 6 + 1], bx = ul[i * 6 + 4], by = -ul[i * 6 + 3];
    ex += dx[i] * u; ey += dy[i] * v; gxy += dy[i] * u + dx[i] * v;
    kx += dx[i] * bx; ky += dy[i] * by; kxy += dy[i] * bx + dx[i] * by;
  }
  let vm = 0;
  for (const z of [-t / 2, t / 2]) {
    const e1 = ex + z * kx, e2 = ey + z * ky, g = gxy + z * kxy;
    const s1 = q * (e1 + nu * e2), s2 = q * (e2 + nu * e1), s12 = G12 * g;
    vm = Math.max(vm, Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2 + 3 * s12 * s12));
  }
  return vm;
}

// ───────── malla de la caja ─────────
function grid(a, b, breaks, h) {
  const pts = [...new Set([a, b, ...breaks.filter(v => v > a + 1 && v < b - 1)].map(v => Math.round(v * 100) / 100))].sort((x, y) => x - y);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const n = Math.max(1, Math.round((pts[i] - pts[i - 1]) / h));
    for (let k = 1; k <= n; k++) out.push(pts[i - 1] + ((pts[i] - pts[i - 1]) * k) / n);
  }
  return out;
}

export function buildMesh(spec, h = 35) {
  const { X, Z, t, y0, yF, layers, op1, op2, screws, ply, feet, hangers, handleX, baseOn, tvKg, protKg, mount, foamPts } = spec;
  const Xm = X / 2 - t / 2, Zm = Z / 2 - t / 2;
  const yb = y0 + t / 2, yf = yF + (layers * t) / 2;
  const xb = [op1[0], op1[2], ...(op2 ? [op2[0], op2[2]] : []), ...hangers.map(p => p[0]), ...handleX];
  const zb = [op1[1], op1[3], ...(op2 ? [op2[1], op2[3]] : [])];
  const xs = grid(-Xm, Xm, xb, h), zs = grid(-Zm, Zm, zb, h);
  const ys = grid(yb, yf, [(yb + yf) / 2], Math.min(h, (yf - yb) / 3));
  const nodes = [], key = new Map();
  const node = (x, y, z, ns = '') => {
    const k = ns + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2);
    if (!key.has(k)) { key.set(k, nodes.length); nodes.push([x, y, z]); }
    return key.get(k);
  };
  const els = [];
  const plyMat = tt => ({ E: ply.E * 0.62, nu: 0.07, G12: ply.G, G13: ply.G * 0.25, t: tt, rho: ply.rho });
  const inside = (r, x, z) => r && x > r[0] && x < r[2] && z > r[1] && z < r[3];
  // marco
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (inside(op1, cx, cz)) continue;
    const tt = layers === 2 && inside(op2, cx, cz) ? t : layers * t;
    els.push({ n: [node(xs[i], yf, zs[j + 1]), node(xs[i + 1], yf, zs[j + 1]), node(xs[i + 1], yf, zs[j]), node(xs[i], yf, zs[j])], mat: plyMat(tt), part: 'marco' });
  }
  // paredes largas (z = ±Zm) y laterales (x = ±Xm)
  for (const s of [-1, 1]) {
    for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < ys.length - 1; k++) {
      const a = [node(xs[i], ys[k], s * Zm), node(xs[i + 1], ys[k], s * Zm), node(xs[i + 1], ys[k + 1], s * Zm), node(xs[i], ys[k + 1], s * Zm)];
      els.push({ n: s > 0 ? a : [a[1], a[0], a[3], a[2]], mat: plyMat(t), part: s < 0 ? 'fondo' : 'frente' });
    }
    for (let j = 0; j < zs.length - 1; j++) for (let k = 0; k < ys.length - 1; k++) {
      const a = [node(s * Xm, ys[k], zs[j + 1]), node(s * Xm, ys[k], zs[j]), node(s * Xm, ys[k + 1], zs[j]), node(s * Xm, ys[k + 1], zs[j + 1])];
      els.push({ n: s > 0 ? a : [a[1], a[0], a[3], a[2]], mat: plyMat(t), part: 'lateral' });
    }
  }
  // base (nudos propios: se une a las paredes solo por los tornillos)
  const baseNodes = [];
  if (baseOn) {
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      els.push({ n: [node(xs[i], yb, zs[j], 'b'), node(xs[i + 1], yb, zs[j], 'b'), node(xs[i + 1], yb, zs[j + 1], 'b'), node(xs[i], yb, zs[j + 1], 'b')], mat: plyMat(t), part: 'base' });
    }
  }
  const nearest = (x, y, z, ns = '') => {
    let best = -1, bd = Infinity;
    key.forEach((idx, k) => {
      if (ns === 'b' ? !k.startsWith('b') : k.startsWith('b')) return;
      const p = nodes[idx]; const dd = (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;
      if (dd < bd) { bd = dd; best = idx; }
    });
    return best;
  };
  // tornillos de la base: muelle entre el nudo de la base y el de la pared (mismo punto)
  const springs = [];
  if (baseOn) screws.forEach(([x, z]) => {
    const px = Math.abs(Math.abs(x) - Xm) < Math.abs(Math.abs(z) - Zm) ? Math.sign(x) * Xm : x;
    const pz = px === x ? Math.sign(z) * Zm : z;
    const a = nearest(px, yb, pz, 'b'), b = nearest(px, yb, pz, '');
    springs.push({ a, b, k: 1500 });   // N/mm por tornillo (deslizamiento en madera)
  });
  return { nodes, els, springs, key, Xm, Zm, yb, yf, nearest, feet: feet.map(([x, z]) => baseOn ? nearest(x, yb, z, 'b') : nearest(Math.sign(x) * Xm, yb, Math.sign(z) * Zm)), hangers: hangers.map(([x, z]) => nearest(x, yf, Math.sign(z) * Zm)), foamPts: (foamPts || []).map(([x, z]) => baseOn ? nearest(x, yb, z, 'b') : -1), handle: (() => { const out = []; key.forEach((idx, k) => { if (k.startsWith('b')) return; const q = nodes[idx]; if (Math.abs(q[2] + Zm) < 0.1 && Math.abs(q[0]) <= Math.max(...handleX.map(Math.abs)) + 20 && q[1] > yb + 1 && q[1] < yf - 1) out.push(idx); }); return out.length ? out : handleX.map(x => nearest(x, (yb + yf) / 2, -Zm)); })(), tvKg, protKg, mount, op1 };
}

// ───────── ensamblado y solución ─────────
function localFrame(P) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const e1 = nrm(sub(P[1], P[0]));
  const e3 = nrm(cross(sub(P[1], P[0]), sub(P[3], P[0])));
  const e2 = cross(e3, e1);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const xy = P.map(p => { const d = sub(p, P[0]); return [dot(d, e1), dot(d, e2)]; });
  return { R: [e1, e2, e3], xy };
}

function rcm(nNodes, adj) {
  const deg = adj.map(a => a.size), visited = new Uint8Array(nNodes), order = [];
  while (order.length < nNodes) {
    let start = -1, md = Infinity;
    for (let i = 0; i < nNodes; i++) if (!visited[i] && deg[i] < md) { md = deg[i]; start = i; }
    const q = [start]; visited[start] = 1;
    while (q.length) {
      const v = q.shift(); order.push(v);
      [...adj[v]].filter(u => !visited[u]).sort((a, b) => deg[a] - deg[b]).forEach(u => { visited[u] = 1; q.push(u); });
    }
  }
  order.reverse();
  const perm = new Int32Array(nNodes); order.forEach((n, i) => (perm[n] = i));
  return perm;
}

export function solve(mesh, loadCase, onProgress) {
  const { nodes, els, springs } = mesh;
  const nN = nodes.length, nD = nN * 6;
  const adj = Array.from({ length: nN }, () => new Set());
  els.forEach(e => e.n.forEach(a => e.n.forEach(b => { if (a !== b) adj[a].add(b); })));
  springs.forEach(s => { adj[s.a].add(s.b); adj[s.b].add(s.a); });
  const perm = rcm(nN, adj);
  const dof = (n, c) => perm[n] * 6 + c;
  // perfil
  const first = new Int32Array(nD).map((_, i) => i);
  const touch = list => { let mn = Infinity; list.forEach(d => (mn = Math.min(mn, d))); list.forEach(d => (first[d] = Math.min(first[d], mn))); };
  els.forEach(e => touch(e.n.flatMap(n => [0, 1, 2, 3, 4, 5].map(c => dof(n, c)))));
  springs.forEach(s => touch([0, 1, 2].flatMap(c => [dof(s.a, c), dof(s.b, c)])));
  const diag = new Int32Array(nD + 1);
  for (let j = 0; j < nD; j++) diag[j + 1] = diag[j] + (j - first[j] + 1);
  const K = new Float64Array(diag[nD]);
  const at = (i, j) => { if (i > j) [i, j] = [j, i]; return diag[j] + (i - first[j]); };   // fila i ≤ columna j
  const F = new Float64Array(nD);
  // elementos
  els.forEach((e, k) => {
    const P = e.n.map(n => nodes[n]);
    const { R, xy } = localFrame(P);
    e.R = R; e.xy = xy;
    const Kl = shellK(xy, e.mat);
    // Kg = Tᵀ Kl T, T = diag(R) por bloques de 3
    const T = (a) => { const blk = (a / 3) | 0, r = a % 3; return [blk, r]; };
    const Kg = zeros(24, 24);
    for (let a = 0; a < 24; a++) for (let b = 0; b < 24; b++) {
      if (Kl[a][b] === 0) continue;
      const [ba, ra] = T(a), [bb, rb] = T(b);
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) Kg[ba * 3 + p][bb * 3 + q] += R[ra][p] * Kl[a][b] * R[rb][q];
    }
    const g = e.n.flatMap(n => [0, 1, 2, 3, 4, 5].map(c => dof(n, c)));
    for (let a = 0; a < 24; a++) for (let b = a; b < 24; b++) { if (g[a] <= g[b]) K[at(g[a], g[b])] += Kg[a][b]; else if (a !== b) K[at(g[b], g[a])] += Kg[a][b]; }
    for (let a = 0; a < 24; a++) for (let b = 0; b < a; b++) { /* simétrica: ya sumada */ }
    // peso propio
    const area = Math.abs(polyArea(xy));
    const wgt = e.mat.rho * 1e-9 * 9.81 * e.mat.t * area * loadCase.g.factor;
    e.n.forEach(n => { for (let c = 0; c < 3; c++) F[dof(n, c)] += (wgt / 4) * loadCase.g.dir[c]; });
    if (onProgress && k % 200 === 0) onProgress(0.25 * k / els.length);
  });
  springs.forEach(s => { for (let c = 0; c < 3; c++) { const a = dof(s.a, c), b = dof(s.b, c); K[at(a, a)] += s.k; K[at(b, b)] += s.k; K[at(Math.min(a, b), Math.max(a, b))] -= s.k; } });
  // cargas puntuales y apoyos
  (loadCase.points || []).forEach(({ n, f }) => { for (let c = 0; c < 3; c++) F[dof(n, c)] += f[c]; });
  let maxK = 0; for (let j = 0; j < nD; j++) maxK = Math.max(maxK, K[diag[j] + j - first[j]]);
  const big = maxK * 1e7;
  (loadCase.fix || []).forEach(({ n, c }) => { K[at(dof(n, c), dof(n, c))] += big; });
  // estabilizador muy blando (evita singularidades por mecanismos locales)
  for (let j = 0; j < nD; j++) K[diag[j] + j - first[j]] += maxK * 1e-9;
  // LDLᵀ en perfil
  const piv = j => diag[j] + j - first[j];
  for (let j = 0; j < nD; j++) {
    const fj = first[j];
    for (let i = fj + 1; i < j; i++) {
      const fi = first[i], k0 = Math.max(fi, fj);
      let s = 0;
      const bi = diag[i] - fi, bj = diag[j] - fj;
      for (let k = k0; k < i; k++) s += K[bi + k] * K[bj + k];
      K[bj + i] -= s;
    }
    let dj = K[piv(j)];
    const bj = diag[j] - fj;
    for (let i = fj; i < j; i++) { const tij = K[bj + i]; const l = tij / K[piv(i)]; K[bj + i] = l; dj -= tij * l; }
    K[piv(j)] = dj;
    if (onProgress && j % 600 === 0) onProgress(0.25 + 0.7 * j / nD);
  }
  // sustitución
  const x = Float64Array.from(F);
  for (let j = 0; j < nD; j++) { const fj = first[j], bj = diag[j] - fj; let s = 0; for (let i = fj; i < j; i++) s += K[bj + i] * x[i]; x[j] -= s; }
  for (let j = 0; j < nD; j++) x[j] /= K[piv(j)];
  for (let j = nD - 1; j >= 0; j--) { const fj = first[j], bj = diag[j] - fj; const xj = x[j]; for (let i = fj; i < j; i++) x[i] -= K[bj + i] * xj; }
  // desplazamientos por nudo y tensiones
  const U = new Float64Array(nN * 6);
  for (let n = 0; n < nN; n++) for (let c = 0; c < 6; c++) U[n * 6 + c] = x[dof(n, c)];
  const vm = new Float64Array(els.length);
  els.forEach((e, k) => {
    const ul = new Float64Array(24);
    e.n.forEach((n, a) => { for (let blk = 0; blk < 2; blk++) for (let p = 0; p < 3; p++) { let s = 0; for (let q = 0; q < 3; q++) s += e.R[p][q] * U[n * 6 + blk * 3 + q]; ul[a * 6 + blk * 3 + p] = s; } });
    vm[k] = shellStress(e.xy, e.mat, ul);
  });
  onProgress && onProgress(1);
  return { U, vm, nD };
}

// ───────── casos de carga sobre la caja ─────────
export function femCases(spec, h) {
  const mesh = buildMesh(spec, h);
  return mesh;
}

export function runFem(spec, caseId, h, onProgress) {
  const mesh = buildMesh({ ...spec, baseOn: caseId !== 'sinbase' ? spec.baseOn : false }, h);
  const W = 9.81;
  const tvN = spec.tvKg * W, protN = spec.protKg * W;
  const lc = { g: { dir: [0, -1, 0], factor: 1 }, points: [], fix: [] };
  const fixAll = n => [0, 1, 2, 3, 4, 5].forEach(c => lc.fix.push({ n, c }));
  const tvLoad = (dir, factor) => {
    if (spec.mount === 'espuma' && mesh.foamPts.length && mesh.foamPts[0] >= 0) mesh.foamPts.forEach(n => lc.points.push({ n, f: dir.map(v => (v * tvN * factor) / mesh.foamPts.length) }));
    else mesh.hangers.forEach(n => lc.points.push({ n, f: dir.map(v => (v * tvN * factor) / mesh.hangers.length) }));
    // protector: reparte en el labio del marco
    const lip = [];
    mesh.key.forEach((idx, k) => { if (k.startsWith('b')) return; const p = mesh.nodes[idx]; if (Math.abs(p[1] - mesh.yf) < 0.1 && (Math.abs(p[0] - spec.op1[0]) < 0.1 || Math.abs(p[0] - spec.op1[2]) < 0.1 || Math.abs(p[2] - spec.op1[1]) < 0.1 || Math.abs(p[2] - spec.op1[3]) < 0.1)) lip.push(idx); });
    lip.forEach(n => lc.points.push({ n, f: dir.map(v => (v * protN * factor) / lip.length) }));
  };
  let probe = null, label = '';
  if (caseId === 'trespatas' || caseId === 'sinbase') {
    const [a, b, c, d] = mesh.feet;   // (-,-) (+,-) (-,+) (+,+)
    lc.fix.push({ n: a, c: 1 }, { n: b, c: 1 }, { n: c, c: 1 }, { n: a, c: 0 }, { n: a, c: 2 }, { n: b, c: 2 });
    tvLoad([0, -1, 0], 1);
    probe = d; label = 'Hundimiento de la esquina sin apoyo';
  } else if (caseId === 'asa') {
    lc.g = { dir: [0, 0, 1], factor: 2.5 };
    mesh.handle.forEach(fixAll);
    tvLoad([0, 0, 1], 2.5);
    probe = mesh.nearest(0, mesh.yf, mesh.Zm); label = 'Desplazamiento del canto inferior';
  } else if (caseId === 'borde') {
    mesh.feet.forEach(n => lc.fix.push({ n, c: 1 }));
    lc.fix.push({ n: mesh.feet[0], c: 0 }, { n: mesh.feet[0], c: 2 }, { n: mesh.feet[1], c: 2 });
    tvLoad([0, -1, 0], 1);
    probe = mesh.nearest(0, mesh.yf, mesh.Zm);
    lc.points.push({ n: probe, f: [0, -400, 0] });
    label = 'Flecha bajo los 400 N';
  }
  const res = solve(mesh, lc, onProgress);
  let umax = 0;
  for (let n = 0; n < mesh.nodes.length; n++) umax = Math.max(umax, Math.hypot(res.U[n * 6], res.U[n * 6 + 1], res.U[n * 6 + 2]));
  let vmax = 0, vAt = -1;
  res.vm.forEach((v, k) => { if (v > vmax) { vmax = v; vAt = k; } });
  const pr = probe != null ? [res.U[probe * 6], res.U[probe * 6 + 1], res.U[probe * 6 + 2]] : [0, 0, 0];
  return {
    nodes: mesh.nodes, els: mesh.els.map(e => ({ n: e.n, part: e.part, t: e.mat.t })), U: res.U, vm: res.vm,
    umax, vmax, vAt, probe, probeU: pr, probeLabel: label, nDof: res.nD, nEl: mesh.els.length, screws: mesh.springs.length, feet: mesh.feet,
  };
}
