// Valida el elemento de lámina contra soluciones analíticas: placa apoyada (Navier) y voladizo en su plano.
const S = new URL('../src/', import.meta.url).href;
const { solve } = await import(S + 'fem.js');
const { navierPlate } = await import(S + 'sim.js');
let fail = 0;
const check = (name, got, ref, tol) => { const e = Math.abs(got - ref) / ref; console.log(`${name}: FEM ${got.toFixed(3)} · ref ${ref.toFixed(3)} · error ${(e * 100).toFixed(1)} %`); if (e > tol) fail++; };

// placa 600×400×10 apoyada en sus 4 bordes, 1000 N en el centro
{
  const a = 600, b = 400, t = 10, E = 7000, nu = 0.3, nx = 24, ny = 16;
  const nodes = [], els = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) nodes.push([a * i / nx, 0, b * j / ny]);
  const id = (i, j) => j * (nx + 1) + i;
  const mat = { E, nu, G12: E / 2 / (1 + nu), G13: E / 2 / (1 + nu), t, rho: 0 };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) els.push({ n: [id(i, j + 1), id(i + 1, j + 1), id(i + 1, j), id(i, j)], mat });
  const fix = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { if (i === 0 || j === 0 || i === nx || j === ny) fix.push({ n: id(i, j), c: 1 }); fix.push({ n: id(i, j), c: 0 }, { n: id(i, j), c: 2 }, { n: id(i, j), c: 4 }); }
  const c = id(nx / 2, ny / 2);
  const r = solve({ nodes, els, springs: [] }, { g: { dir: [0, -1, 0], factor: 0 }, points: [{ n: c, f: [0, -1000, 0] }], fix });
  const nav = navierPlate({ a, b, t, E, nu, loads: [{ P: 1000, x: a / 2, y: b / 2, u: 0.01, v: 0.01 }], terms: 99 });
  check('Placa apoyada, carga central', -r.U[c * 6 + 1], nav.wmax, 0.03);
}
// voladizo 1000×100×10 cargado en su plano (flexión + cortante de Timoshenko)
{
  const L = 1000, Hh = 100, t = 10, E = 7000, nx = 20, ny = 4;
  const nodes = [], els = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) nodes.push([L * i / nx, Hh * j / ny, 0]);
  const id = (i, j) => j * (nx + 1) + i;
  const mat = { E, nu: 0, G12: E / 2, G13: E / 2, t, rho: 0 };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) els.push({ n: [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)], mat });
  const fix = [];
  for (let j = 0; j <= ny; j++) [0, 1, 2, 3, 4, 5].forEach(c => fix.push({ n: id(0, j), c }));
  for (let n = 0; n < nodes.length; n++) fix.push({ n, c: 2 }, { n, c: 3 }, { n, c: 4 });
  const pts = []; for (let j = 0; j <= ny; j++) pts.push({ n: id(nx, j), f: [0, -1000 / (ny + 1), 0] });
  const r = solve({ nodes, els, springs: [] }, { g: { dir: [0, -1, 0], factor: 0 }, points: pts, fix });
  const I = t * Hh ** 3 / 12;
  check('Voladizo en su plano', -r.U[id(nx, 0) * 6 + 1], 1000 * L ** 3 / (3 * E * I) + 1000 * L / (5 / 6 * E / 2 * t * Hh), 0.05);
}
if (fail) { console.error(fail + ' comprobación(es) fuera de tolerancia'); process.exit(1); }
