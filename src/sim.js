import { PLY, PROTECTORS } from './params.js';
import { buildDesign } from './model.js';

// Cálculos de ingeniería de la caja. Unidades: N, mm, MPa (N/mm²), s, W, K.
// Placas: solución de Navier (placa rectangular apoyada en sus 4 bordes, carga en parche).
// Vigas: Euler-Bernoulli. Térmico: red de dos nudos con tiro natural o ventiladores.

const G = 9.81;

// ───────── placa de Navier ─────────
// a × b (mm), D (N·mm), cargas: [{P (N), x, y, u, v}] parche u×v centrado en (x,y)
export function navierPlate({ a, b, t, E, nu, loads, nx = 41, ny = 25, terms = 39 }) {
  const D = (E * t ** 3) / (12 * (1 - nu * nu));
  const W = new Float64Array(nx * ny), Mx = new Float64Array(nx * ny), My = new Float64Array(nx * ny);
  const xs = Array.from({ length: nx }, (_, i) => (a * i) / (nx - 1));
  const ys = Array.from({ length: ny }, (_, j) => (b * j) / (ny - 1));
  const sinX = [], sinY = [];
  for (let m = 1; m <= terms; m += 1) { sinX[m] = xs.map(x => Math.sin((m * Math.PI * x) / a)); }
  for (let n = 1; n <= terms; n += 1) { sinY[n] = ys.map(y => Math.sin((n * Math.PI * y) / b)); }
  for (let m = 1; m <= terms; m++) for (let n = 1; n <= terms; n++) {
    let q = 0;
    for (const L of loads) {
      const su = L.u > 0 ? Math.sin((m * Math.PI * L.u) / (2 * a)) / ((m * Math.PI * L.u) / (2 * a)) : 1;
      const sv = L.v > 0 ? Math.sin((n * Math.PI * L.v) / (2 * b)) / ((n * Math.PI * L.v) / (2 * b)) : 1;
      q += ((4 * L.P) / (a * b)) * Math.sin((m * Math.PI * L.x) / a) * Math.sin((n * Math.PI * L.y) / b) * su * sv;
    }
    if (Math.abs(q) < 1e-14) continue;
    const k2 = (m / a) ** 2 + (n / b) ** 2;
    const Wmn = q / (D * Math.PI ** 4 * k2 * k2);
    const cx = Math.PI ** 2 * D * Wmn * ((m / a) ** 2 + nu * (n / b) ** 2);
    const cy = Math.PI ** 2 * D * Wmn * ((n / b) ** 2 + nu * (m / a) ** 2);
    const sx = sinX[m], sy = sinY[n];
    for (let j = 0; j < ny; j++) {
      const yv = sy[j];
      if (yv === 0) continue;
      for (let i = 0; i < nx; i++) {
        const s = sx[i] * yv, k = j * nx + i;
        W[k] += Wmn * s; Mx[k] += cx * s; My[k] += cy * s;
      }
    }
  }
  let wmax = 0, mmax = 0, at = [0, 0];
  for (let k = 0; k < W.length; k++) {
    if (W[k] > wmax) { wmax = W[k]; at = [xs[k % nx], ys[(k / nx) | 0]]; }
    mmax = Math.max(mmax, Math.abs(Mx[k]), Math.abs(My[k]));
  }
  const smax = (6 * mmax) / (t * t);
  return { W, nx, ny, a, b, wmax, smax, D, at };
}

// ───────── sección compuesta (paredes + marco + listón) ─────────
function composite(parts) {
  // parts: [{b, h, yc, E}] → EI respecto al eje neutro (flexión en el plano vertical)
  const EA = parts.reduce((s, p) => s + p.E * p.b * p.h, 0);
  const yn = parts.reduce((s, p) => s + p.E * p.b * p.h * p.yc, 0) / EA;
  const EI = parts.reduce((s, p) => s + p.E * ((p.b * p.h ** 3) / 12 + p.b * p.h * (p.yc - yn) ** 2), 0);
  const ymax = Math.max(...parts.map(p => Math.max(Math.abs(p.yc + p.h / 2 - yn), Math.abs(p.yc - p.h / 2 - yn))));
  return { EI, yn, ymax };
}

// ───────── modelo térmico ─────────
export function thermal(d, { fans = d.params.fans, vents = d.params.vents, baseVents = d.params.baseVents, Troom = 25, P = 54 + (d.params.source === 'minipc' ? 8 : d.params.source === 'stick' ? 3 : 0) } = {}) {
  const p = d.params, m = d.metrics;
  const Ascr = (p.screenW * p.screenH) * 1e-6;
  // frente: pantalla → (cámara de aire + protector) → habitación
  const hOut = 9;   // convección natural (placa horizontal hacia arriba) + radiación
  let Ufront = hOut;
  if (m.twoLayer && m.pt) {
    const gap = (m.yF + p.t - m.yS) / 1000;          // m
    const hGap = Math.max(1, 0.026 / gap * 1.1) + 5;  // conducción/convección débil + radiación entre caras
    const Rprot = (m.pt / 1000) / 0.19;               // PMMA k≈0,19
    Ufront = 1 / (1 / hGap + Rprot + 1 / hOut);
  } else if (m.pt) {
    Ufront = 1 / ((m.pt / 1000) / 0.19 + 1 / hOut + 0.02);
  }
  const Gfront = Ufront * Ascr;
  // paredes y base → habitación
  const Awalls = (2 * (m.X + m.Z) * m.wallH + m.innerX * m.innerZ) * 1e-6;
  const Uwall = 1 / (1 / 3 + (p.t / 1000) / 0.13 + 1 / 7);
  const Gwall = Uwall * Awalls;
  // aberturas
  let Ain = 0, Aout = 0;
  d.pieces.forEach(pc => (pc.solids || []).forEach(so => (so.holes || []).forEach(h => {
    const ar = h.circle ? Math.PI * h.circle[2] ** 2 : h.slot ? (h.slot[2] - h.slot[0]) * (h.slot[3] - h.slot[1]) : (h.rect[2] - h.rect[0]) * (h.rect[3] - h.rect[1]);
    if (pc.role === 'base' && h.tag && h.tag.startsWith('Ventil')) Ain += ar;
    if (pc.role === 'pared' && h.tag && (h.tag.startsWith('Ranura') || h.tag.startsWith('Rejilla'))) Aout += ar;
  })));
  if (!baseVents) Ain = 0;
  if (!vents) Aout = d.pieces.filter(pc => pc.role === 'pared').reduce((s, pc) => s, 0);
  // si no hay entrada por la base, la entrada son las ranuras de altavoz (más bajas)
  if (!Ain) Ain = Aout * 0.5;
  const Aeff = Ain && Aout ? 1 / Math.sqrt(1 / (Ain * Ain) + 1 / (Aout * Aout)) * 1e-6 : 0; // m²
  const Hst = Math.max(0.02, (m.yF - m.y0 - 25) / 1000);
  const rho = 1.16, cp = 1007, T0 = Troom + 273.15;
  const fanQ = fans ? 2 * 15 / 3600 * 0.6 : 0;   // 2 ventiladores de 15 m³/h al 60 % por pérdidas
  // reparto: ~45 % de la potencia sale por el panel (retroiluminación), ~55 % por detrás (fuente, placa, disipador LED)
  const Pf = P * 0.45, Pb = P * 0.55;
  // pantalla ↔ interior a través del cuerpo de la tele
  const Gtv = 4 * ((p.tvW * p.tvH) * 1e-6);
  let Ti = Troom + 10, Ts = Troom + 10;
  for (let it = 0; it < 200; it++) {
    const dT = Math.max(0.01, Ti - Troom);
    const Qst = Aeff ? 0.6 * Aeff * Math.sqrt((2 * G * Hst * dT) / T0) : 0;
    const Q = Math.max(Qst, fanQ + (fans ? 0 : 0));
    const Gvent = rho * cp * Q;
    // balance: Pb = Gwall(Ti-Tr) + Gvent(Ti-Tr) + Gtv(Ti-Ts) ; Pf + Gtv(Ti-Ts) = Gfront(Ts-Tr)
    const a11 = Gwall + Gvent + Gtv, a12 = -Gtv, b1 = Pb + (Gwall + Gvent) * Troom;
    const a21 = -Gtv, a22 = Gfront + Gtv, b2 = Pf + Gfront * Troom;
    const det = a11 * a22 - a12 * a21;
    const nTi = (b1 * a22 - a12 * b2) / det, nTs = (a11 * b2 - a21 * b1) / det;
    Ti += (nTi - Ti) * 0.5; Ts += (nTs - Ts) * 0.5;
  }
  const dT = Ti - Troom;
  const Qst = Aeff ? 0.6 * Aeff * Math.sqrt((2 * G * Hst * Math.max(0.01, dT)) / T0) : 0;
  return { Ti, Ts, dT, Q: Math.max(Qst, fanQ), Ain, Aout, Aeff: Aeff * 1e6, Gfront, Gwall, Ufront, P, Troom, fans, vents };
}

// ───────── casos de carga ─────────
export function runCases(d) {
  const p = d.params, m = d.metrics, ply = PLY[p.plyType];
  const cases = [];
  const sf = (s, R) => (s > 0 ? R / s : Infinity);
  const verdict = (ok, warn) => (ok ? 'ok' : warn ? 'warn' : 'bad');

  // 1 · protector: codo apoyado en el centro
  const prot = PROTECTORS[p.protector];
  if (m.protRect) {
    const a = m.twoLayer ? (m.op1[2] - m.op1[0]) + p.protOverlap : p.screenW;
    const b = m.twoLayer ? (m.op1[3] - m.op1[1]) + p.protOverlap : p.screenH;
    const elbow = navierPlate({ a, b, t: prot.t, E: prot.E, nu: prot.nu, loads: [{ P: 250, x: a / 2, y: b / 2, u: 50, v: 50 }] });
    const selfq = (prot.rho * G * prot.t * 1e-9);   // N/mm²
    const self = navierPlate({ a, b, t: prot.t, E: prot.E, nu: prot.nu, loads: [{ P: selfq * a * b, x: a / 2, y: b / 2, u: a, v: b }], terms: 15 });
    const gap = m.twoLayer ? m.yF + p.t - m.yS : 0.3;
    const touches = elbow.wmax + self.wmax > gap;
    const Ptouch = Math.max(0, (gap - self.wmax) / elbow.wmax * 250);
    cases.push({
      id: 'protector', title: 'Codo apoyado en el protector', icon: 'dice', target: 'P1', field: elbow,
      load: '250 N (≈ 25 kg) en 50 × 50 mm, en el centro', model: `Placa de Navier ${Math.round(a)} × ${Math.round(b)} × ${prot.t} mm, apoyada en el labio (E = ${prot.E} MPa)`,
      rows: [['Flecha bajo el codo (lineal)', elbow.wmax, 'mm'], ['Flecha por peso propio', self.wmax, 'mm'], ['Hueco hasta la pantalla', gap, 'mm'], ['Tensión máxima', elbow.smax, 'MPa'], ['Coef. de seguridad (rotura)', sf(elbow.smax, prot.MOR), '×'], ['Carga que lo hace tocar', Ptouch / 9.81, 'kg']],
      Ptouch,
      status: verdict(!touches && sf(elbow.smax, prot.MOR) > 3, sf(elbow.smax, prot.MOR) > 2),
      text: touches
        ? (m.twoLayer ? `Con ${prot.t} mm el protector toca la pantalla en cuanto se apoyan ${f(Ptouch / 9.81)} kg en el centro (hay ${f(gap)} mm de hueco; la flecha lineal con un codo sería ${f(elbow.wmax)} mm, en realidad se queda en el hueco porque apoya en la pantalla). Al tocar, reparte la carga sobre el panel en vez de clavarla: no se rompe nada, pero puede verse una aureola momentánea. Sube a 5 mm o a vidrio si os apoyáis mucho.` : `El protector descansa casi sobre la pantalla: un codo lo empuja contra el panel (${f(elbow.wmax)} mm de flecha libre). Reparte la presión, pero para apoyarse sin miedo mejor el marco doble con pozo.`)
        : `Aguanta un codo sin llegar a la pantalla: baja ${f(elbow.wmax)} mm de los ${f(gap)} mm de hueco. Coeficiente de seguridad ${f(sf(elbow.smax, prot.MOR))}.`,
    });
  } else {
    cases.push({ id: 'protector', title: 'Sin protector', icon: 'dice', rows: [], status: 'warn', text: 'Sin protector, dados y miniaturas apoyan directamente en la pantalla. Las pantallas LCD soportan bien una ficha, pero un dado lanzado o un codo puede dejar marcas o dañar el panel. Recomendado: metacrilato de 4 mm en el pozo.' });
  }

  // 2 · travesaños VESA con golpe de 3 g
  if (p.mount === 'vesa') {
    const Ep = 10000, span = m.innerZ - 2 * Math.min(p.hangerW, m.g - 1) / 2;
    const I = (p.railW * p.railH ** 3) / 12;
    const P = (p.tvKg * G * 3) / 4; // por punto VESA (4 puntos), 3 g
    const a1 = (m.vz - p.vesa / 2) + span / 2, a2 = (m.vz + p.vesa / 2) + span / 2;
    // dos cargas puntuales en una viga biapoyada: superposición
    const defl = (Pa, aa, x, L) => { const bb = L - aa; return x <= aa ? (Pa * bb * x * (L * L - bb * bb - x * x)) / (6 * L * Ep * I) : (Pa * aa * (L - x) * (2 * L * x - x * x - aa * aa)) / (6 * L * Ep * I); };
    let wmax = 0;
    for (let i = 0; i <= 60; i++) { const x = (span * i) / 60; wmax = Math.max(wmax, defl(P, a1, x, span) + defl(P, a2, x, span)); }
    const Mmax = Math.max(P * a1 * (span - a1) / span + P * a1 * (span - a2) / span, P * a2 * (span - a2) / span + P * a1 * (span - a2) / span);
    const s = (Mmax * (p.railH / 2)) / I;
    cases.push({
      id: 'rail', title: 'Travesaños VESA · golpe al dejarla', icon: 'vesa', target: 'R1',
      load: `Peso de la tele × 3 g = ${f(p.tvKg * 3 * G)} N repartidos en 4 tornillos`, model: `Viga de pino ${p.railW} × ${p.railH} biapoyada en los tacos, luz ${f(span)} mm`,
      rows: [['Flecha', wmax, 'mm'], ['Tensión máxima', s, 'MPa'], ['Coef. de seguridad (pino 40 MPa)', sf(s, 40), '×'], ['Carga por taco colgador', P * 2 / 2, 'N']],
      status: verdict(wmax < 2.5 && sf(s, 40) > 3, wmax < 5),
      text: `Cada travesaño baja ${f(wmax)} mm con un golpe de 3 g. La tele queda colgada de 4 tornillos M8 (cada uno aguanta > 5 kN): sobra.`,
    });
  }

  // 3 · apoyarse en el canto del marco con la caja sobre 4 patas de esquina
  {
    const Eip = ply.E * 0.55;   // en su plano, ~la mitad de las chapas trabajan a lo largo
    const ringW = Math.max(10, m.ring1);
    const parts = [
      { b: p.t, h: m.wallH, yc: m.y0 + m.wallH / 2, E: Eip },
      { b: ringW, h: p.t, yc: m.yF + p.t / 2, E: ply.E * 0.6 },
      { b: p.battenW, h: p.battenH, yc: m.yBaseTop + p.battenH / 2, E: 10000 },
      { b: p.battenW + 20, h: p.t, yc: m.y0 + p.t / 2, E: ply.E * 0.6 },
    ];
    if (m.twoLayer) parts.push({ b: Math.max(10, m.ring2), h: p.t, yc: m.yF + 1.5 * p.t, E: ply.E * 0.6 });
    const sec = composite(parts);
    const feet = Number(p.feet);
    const L = feet >= 6 ? (m.innerX - 90) / (feet / 2 - 1) : m.innerX - 90;
    const P = 400;
    const w = (P * L ** 3) / (48 * sec.EI);
    const M = (P * L) / 4;
    const s = (M * sec.ymax * Eip) / sec.EI;
    cases.push({
      id: 'edge', title: 'Apoyarse en el borde', icon: 'frame', target: 'W2',
      load: '400 N (≈ 40 kg) en el centro del canto largo', model: `Viga compuesta: pared + marco + listón + base, luz ${f(L)} mm entre patas`,
      rows: [['Flecha del canto', w, 'mm'], ['Rigidez EI', sec.EI / 1e9, 'kN·m²'], ['Tensión máxima', s, 'MPa'], ['Coef. de seguridad', sf(s, ply.MOR * 0.6), '×']],
      status: verdict(w < 0.5, w < 1.5),
      text: `El canto largo es una viga de ${f(m.yTop - m.y0)} mm de canto: baja ${f(w)} mm aunque se apoye alguien de 40 kg entre patas. ${feet >= 6 ? 'Con 6 patas la luz se reduce a la mitad.' : 'Con 6 patas la flecha bajaría unas 8 veces.'}`,
    });
  }

  // 4 · asa (transporte de pie)
  if (p.handle !== 'ninguna') {
    const Wt = m.mass.total * G;
    const F = 2.5 * Wt;    // tirón dinámico
    const nb = p.handle === 'maleta' ? 2 : 4;
    const perBolt = F / nb;
    const washerA = Math.PI * (18 ** 2 - 6.5 ** 2) / 4;
    const crush = perBolt / washerA;
    const glueA = (m.yF - m.yBaseTop) * 160;
    cases.push({
      id: 'handle', title: 'Llevarla del asa', icon: 'handle',
      load: `Peso ${f(m.mass.total)} kg × 2,5 (tirón al levantar) = ${f(F)} N`, model: p.handle === 'maleta' ? '2 tornillos M6 pasantes a contraplaca de pino encolada' : 'Cazo atornillado al tablero',
      rows: [['Fuerza por tornillo', perBolt, 'N'], ['Presión bajo la arandela', crush, 'MPa'], ['Coef. aplastamiento (5 MPa)', sf(crush, 5), '×'], ['Cortante en la cola de la contraplaca', F / glueA, 'MPa']],
      status: verdict(sf(crush, 5) > 2, true),
      text: `Al llevarla de pie, la tele cuelga en su posición natural (canto superior arriba) y la carga pasa: tele → travesaños → tacos → marco y paredes → contraplaca → asa. Con ${f(m.mass.total)} kg conviene ${m.mass.total > 18 ? 'llevarla entre dos o con correa al hombro' : 'una sola mano sin problema'}.`,
    });
  }

  // 6 · temperatura
  {
    const now = thermal(d);
    const none = thermal(d, { fans: false, vents: false, baseVents: false });
    const dv = d.params.vents && d.params.baseVents ? d : buildDesign({ ...d.params, vents: true, baseVents: true });
    const vOnly = thermal(dv, { fans: false, vents: true, baseVents: true });
    const withFans = thermal(dv.params.fans ? dv : buildDesign({ ...dv.params, fans: true }), { fans: true, vents: true, baseVents: true });
    cases.push({
      id: 'thermal', title: 'Temperatura dentro de la caja', icon: 'thermo', thermal: { now, none, vOnly, withFans },
      load: `${now.P} W (consumo típico) · habitación a ${now.Troom} °C`, model: 'Red térmica de 2 nudos: pantalla e interior; tiro natural por rejillas o ventiladores',
      rows: [['Aire interior', now.Ti, '°C'], ['Pantalla', now.Ts, '°C'], ['Caudal de aire', now.Q * 3600, 'm³/h'], ['Área de entrada / salida', now.Ain / 100, 'cm²'], ['', now.Aout / 100, 'cm² salida']],
      status: verdict(now.Ti < 40, now.Ti < 45),
      text: `La tele está pensada para trabajar con hasta 40 °C de ambiente a su alrededor. ${now.Ti < 40 ? 'Con esta configuración el aire de dentro se queda en ' + f(now.Ti) + ' °C.' : 'Dentro llegaría a ' + f(now.Ti) + ' °C: añade rejillas o los ventiladores USB.'} El tiro natural es débil porque la caja es plana (${f(m.yF - m.y0)} mm): la mayor parte del calor sale por la propia pantalla${m.twoLayer && m.pt ? ', y el protector con su cámara de aire la abriga algo' : ''}.`,
    });
  }
  return cases;
}

function f(v) { const r = Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100; return String(r).replace('.', ','); }
export { f as fmtSim };

// Datos que necesita el modelo de elementos finitos (fem.js)
export function femSpec(d) {
  const p = d.params, m = d.metrics;
  const feet = d.fixtures.filter(f => f.kind === 'foot').map(f => [f.pos[0], f.pos[2]]);
  const corner = (sx, sz) => feet.reduce((best, q) => (sx * q[0] + sz * q[1] > sx * best[0] + sz * best[1] ? q : best), feet[0] || [sx * m.innerX / 2, sz * m.innerZ / 2]);
  const fc = feet.length ? [corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)] : [[-m.innerX / 2, -m.innerZ / 2], [m.innerX / 2, -m.innerZ / 2], [-m.innerX / 2, m.innerZ / 2], [m.innerX / 2, m.innerZ / 2]];
  const rest = feet.filter(q => !fc.includes(q));
  const Zm = m.Z / 2 - p.t / 2;
  const hangers = p.mount === 'vesa' ? m.railX.flatMap(x => [[x, -Zm], [x, Zm]]) : [];
  const foamPts = d.pieces.filter(pc => pc.role === 'espuma').map(pc => { const r = pc.solids[0].rect; return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; });
  return {
    X: m.X, Z: m.Z, t: p.t, y0: m.y0, yF: m.yF, layers: m.twoLayer ? 2 : 1, op1: m.op1, op2: m.op2,
    screws: m.screwPts, ply: PLY[p.plyType], feet: [...fc, ...rest], hangers: hangers.length ? hangers : [[-200, -Zm], [200, -Zm], [-200, Zm], [200, Zm]],
    handleX: p.handle === 'maleta' ? [-60, 60] : [-70, 70], handleMode: p.handle, baseOn: true, tvKg: p.tvKg, protKg: m.mass.protector + m.mass.cover, mount: p.mount, foamPts,
  };
}
