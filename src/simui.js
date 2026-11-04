import * as THREE from 'three';
import { runCases, femSpec, fmtSim as f } from './sim.js';
import { buildDesign } from './model.js';
import { PLY } from './params.js';
import { icon, decorate } from './icons.js';

// Panel de cálculos: veredicto, simulación FEM de la caja (en un Web Worker) y cálculos
// rápidos analíticos. Los resultados se pintan en 3D con un mapa de color.

const FEM_CASES = [
  { id: 'trespatas', label: 'Mesa coja', sub: 'apoyada en 3 esquinas', icon: 'box' },
  { id: 'sinbase', label: 'Sin la base', sub: 'mismo caso, base quitada', icon: 'base' },
  { id: 'asa', label: 'Del asa', sub: 'de pie, tirón × 2,5', icon: 'handle' },
  { id: 'borde', label: 'Apoyarse', sub: '400 N en el canto frontal', icon: 'frame' },
];

const st = { fem: 'trespatas', h: 35, scale: 20, field: 'u', card: null, busy: false, results: new Map(), job: 0 };
let worker = null;

// rampa de color (azul → cian → verde → amarillo → rojo)
const RAMP = ['#30123b', '#4662d7', '#36aaf9', '#1ae4b6', '#72fe5e', '#c7ef34', '#fbb938', '#f56918', '#c92903', '#7a0403'];
function ramp(v) {
  const x = Math.max(0, Math.min(1, v)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x)), t = x - i;
  const a = new THREE.Color(RAMP[i]), b = new THREE.Color(RAMP[i + 1]);
  return a.lerp(b, t);
}
const legend = (lo, hi, unit) => `<div class="legend"><span>${f(lo)}</span><i style="background:linear-gradient(90deg,${RAMP.join(',')})"></i><span>${f(hi)} ${unit}</span></div>`;

function femMesh(r, scale, field) {
  const pos = [], col = [];
  const vmax = Math.max(1e-9, r.vmax), umax = Math.max(1e-9, r.umax);
  const um = n => Math.hypot(r.U[n * 6], r.U[n * 6 + 1], r.U[n * 6 + 2]);
  r.els.forEach((e, k) => {
    const q = e.n.map(n => [r.nodes[n][0] + r.U[n * 6] * scale, r.nodes[n][1] + r.U[n * 6 + 1] * scale, r.nodes[n][2] + r.U[n * 6 + 2] * scale]);
    const cs = e.n.map(n => (field === 'u' ? ramp(um(n) / umax) : ramp(r.vm[k] / vmax)));
    [0, 1, 2, 0, 2, 3].forEach(i => { pos.push(...q[i]); col.push(cs[i].r, cs[i].g, cs[i].b); });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  grp.add(mesh);
  // malla
  const lp = [];
  r.els.forEach(e => { const q = e.n.map(n => [r.nodes[n][0] + r.U[n * 6] * scale, r.nodes[n][1] + r.U[n * 6 + 1] * scale, r.nodes[n][2] + r.U[n * 6 + 2] * scale]); for (let i = 0; i < 4; i++) lp.push(...q[i], ...q[(i + 1) % 4]); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x15171a, transparent: true, opacity: 0.25 })));
  // contorno sin deformar
  const op = [];
  r.els.forEach(e => { const q = e.n.map(n => r.nodes[n]); for (let i = 0; i < 4; i++) op.push(...q[i], ...q[(i + 1) % 4]); });
  const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(op, 3));
  grp.add(new THREE.LineSegments(og, new THREE.LineBasicMaterial({ color: 0x8a919b, transparent: true, opacity: 0.12 })));
  // apoyos
  const sg = new THREE.ConeGeometry(14, 26, 16);
  const smat = new THREE.MeshStandardMaterial({ color: 0x15171a });
  (st.fem === 'asa' ? [] : r.feet.slice(0, st.fem === 'trespatas' || st.fem === 'sinbase' ? 3 : 99)).forEach(n => {
    const c = new THREE.Mesh(sg, smat); const p = r.nodes[n];
    c.position.set(p[0], p[1] - 22, p[2]); grp.add(c);
  });
  if (r.probe != null) {
    const p = r.nodes[r.probe];
    const m = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    m.position.set(p[0] + r.U[r.probe * 6] * scale, p[1] + r.U[r.probe * 6 + 1] * scale, p[2] + r.U[r.probe * 6 + 2] * scale);
    grp.add(m);
  }
  return grp;
}

function plateOverlay(field, rect, y, scale) {
  const { W, nx, ny, wmax } = field;
  const [x0, z0, x1, z1] = rect;
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx - 1, ny - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = [];
  for (let k = 0; k < pos.count; k++) {
    const i = k % nx, j = Math.floor(k / nx);
    const w = W[(ny - 1 - j) * nx + i] || W[j * nx + i];
    pos.setY(k, -w * scale);
    const c = ramp(w / Math.max(1e-9, wmax)); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.9, roughness: 0.6 }));
  m.position.set((x0 + x1) / 2, y + 0.5, (z0 + z1) / 2);
  return m;
}

function verdict(d, cases, fem) {
  const bad = cases.filter(c => c.status === 'bad'), warn = cases.filter(c => c.status === 'warn');
  const p = d.params;
  const tres = fem.get('trespatas');
  const lines = [];
  lines.push(`<b>Resistencia:</b> sí. Las tensiones en el contrachapado de ${p.t} mm se quedan muy por debajo de su rotura (${PLY[p.plyType].MOR} MPa)${tres ? `: ${f(tres.vmax)} MPa como mucho en la mesa coja, coeficiente ${f(PLY[p.plyType].MOR / tres.vmax)}` : ''}.`);
  lines.push(`<b>Rigidez:</b> el punto débil es la <b>torsión</b>: una caja con una ventana enorme en la tapa es blanda al alabeo y casi todo lo aguanta la base. ${tres ? `En una mesa coja la esquina sin apoyo baja ${f(-tres.probeU[1])} mm.` : ''} Atornilla bien la base y apóyala en 6 patas.`);
  if (bad.length || warn.length) lines.push(`<b>A vigilar:</b> ${[...bad, ...warn].map(c => c.title.toLowerCase()).join(', ')}.`);
  return `<div class="verdict s-${bad.length ? 'bad' : warn.length ? 'warn' : 'ok'}"><strong>¿Basta con contrachapado de ${p.t} mm?</strong>${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
}

export function renderSim(host, d, viewer, { close }) {
  const cases = runCases(d);
  const fem = st.results.get(keyOf(d));
  const cur = fem && fem.get(st.fem);
  host.innerHTML = `
    <div class="sim-head"><span data-icon="sim"></span><strong>Cálculos</strong><button class="x" id="sim-close">✕</button></div>
    <div class="sim-body">
      ${verdict(d, cases, fem || new Map())}
      <div class="h-sub">Simulación FEM de la caja</div>
      <div class="femcases">${FEM_CASES.map(c => `<button data-fem="${c.id}" class="${st.fem === c.id && st.card === null ? 'on' : ''}">${icon(c.icon)}<span><b>${c.label}</b><small>${c.sub}</small></span></button>`).join('')}</div>
      <div class="femctl">
        <label>Malla <select id="fem-h"><option value="45">rápida · 45 mm</option><option value="35">media · 35 mm</option><option value="25">fina · 25 mm</option></select></label>
        <label>Color <select id="fem-field"><option value="u">desplazamiento</option><option value="s">tensión (von Mises)</option></select></label>
        <label class="slider"><span>× ${st.scale}</span><input id="fem-scale" type="range" min="1" max="100" step="1" value="${st.scale}"/></label>
      </div>
      <div id="fem-prog"></div>
      <div id="fem-out">${cur ? femSummary(d, cur) : '<p class="muted">Calculando…</p>'}</div>
      <div class="h-sub">Estudios: ¿qué cambia la rigidez?</div>
      <div class="femctl"><label>Variar <select id="sens-kind">${Object.entries(STUDIES).map(([k, v]) => `<option value="${k}" ${st.sensKind === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label></div>
      <div id="sens">${sensView(d)}</div>
      <div class="h-sub">Cálculos rápidos</div>
      ${cases.map(c => card(c)).join('')}
      <p class="note">Cálculos de orientación, no de certificación. FEM: láminas MITC4 + membrana con modos incompatibles, contrachapado ${PLY[d.params.plyType].label.toLowerCase()} con E = ${Math.round(PLY[d.params.plyType].E * 0.62)} MPa en su plano y G = ${PLY[d.params.plyType].G} MPa; la base se une a las paredes solo en los ${d.params.baseScrews} tornillos (muelles de 1,5 kN/mm). La tele se modela como carga, no aporta rigidez (lo que deja los resultados del lado seguro).</p>
    </div>`;
  decorate(host);
  host.querySelector('#sim-close').onclick = close;
  host.querySelector('#fem-h').value = String(st.h);
  host.querySelector('#fem-field').value = st.field;
  host.querySelectorAll('[data-fem]').forEach(b => b.onclick = () => { st.fem = b.dataset.fem; st.card = null; renderSim(host, d, viewer, { close }); });
  host.querySelector('#fem-h').onchange = e => { st.h = Number(e.target.value); st.results.delete(keyOf(d)); renderSim(host, d, viewer, { close }); };
  host.querySelector('#fem-field').onchange = e => { st.field = e.target.value; renderSim(host, d, viewer, { close }); };
  const sc = host.querySelector('#fem-scale');
  sc.style.setProperty('--pct', st.scale + '%');
  sc.oninput = () => { st.scale = Number(sc.value); sc.previousElementSibling.textContent = '× ' + st.scale; sc.style.setProperty('--pct', st.scale + '%'); show3D(d, viewer, cases); };
  host.querySelectorAll('.simcard[data-card]').forEach(el => el.onclick = () => { st.card = st.card === el.dataset.card ? null : el.dataset.card; renderSim(host, d, viewer, { close }); });
  host.querySelector('#sens-kind').onchange = e => { st.sensKind = e.target.value; const el = host.querySelector('#sens'); el.innerHTML = sensView(d); const b2 = host.querySelector('#sens-run'); if (b2) b2.onclick = () => runSens(d); };
  const sb = host.querySelector('#sens-run');
  if (sb) sb.onclick = () => runSens(d);
  show3D(d, viewer, cases);
  st.rerender = () => sim_isOpen(host) && renderSim(host, window.design || d, viewer, { close });
  if (!cur) runAll(d, () => st.rerender());
}

const keyOf = d => JSON.stringify(femSpec(d)) + st.h;

function show3D(d, viewer, cases) {
  if (st.card) {
    const c = cases.find(x => x.id === st.card);
    if (c && c.field && c.id === 'protector') {
      const m = d.metrics;
      const y = m.twoLayer ? m.yF + d.params.t + m.pt : m.yS + m.pt;
      const a = c.field.a, b = c.field.b, cx = (m.op1[0] + m.op1[2]) / 2, cz = (m.op1[1] + m.op1[3]) / 2;
      viewer.setOverlay(plateOverlay(c.field, [cx - a / 2, cz - b / 2, cx + a / 2, cz + b / 2], y, Math.min(1, st.scale / 20)), { hideModel: false });
      return;
    }
    viewer.setOverlay(null);
    return;
  }
  const fem = st.results.get(keyOf(d));
  const r = fem && fem.get(st.fem);
  if (r) viewer.setOverlay(femMesh(r, st.scale, st.field), { hideModel: true });
  else viewer.setOverlay(null);
}

const sim_isOpen = host => !host.hidden;
function runAll(d, done) {
  const key = keyOf(d);
  if (st.busy && st.busyKey === key) return;
  st.busyKey = key;
  const spec = femSpec(d);
  if (!worker) worker = new Worker(new URL('./fem.worker.js', import.meta.url), { type: 'module' });
  st.busy = true;
  const out = new Map();
  const ids = [st.fem, ...FEM_CASES.map(c => c.id).filter(i => i !== st.fem)];
  let i = 0;
  const job = ++st.job;
  const next = () => {
    if (i >= ids.length) { st.busy = false; st.results.set(key, out); const el = document.querySelector('#fem-prog'); if (el) el.innerHTML = ''; done(); return; }
    const id = ids[i];
    worker.onmessage = e => {
      if (e.data.id !== job + ':' + id) return;
      if (e.data.progress != null) { const el = document.querySelector('#fem-prog'); if (el) el.innerHTML = `<div class="progress"><i style="width:${Math.round(((i + e.data.progress) / ids.length) * 100)}%"></i></div><p class="muted">Resolviendo «${FEM_CASES.find(c => c.id === id).label}»…</p>`; return; }
      if (job !== st.job) return;
      out.set(id, e.data.result);
      i++;
      if (i === 1) { st.results.set(key, out); done(); st.busy = true; }
      next();
    };
    worker.postMessage({ spec, caseId: id, h: st.h, id: job + ':' + id });
  };
  next();
}

function femSummary(d, r) {
  const p = d.params, ply = PLY[p.plyType];
  const c = FEM_CASES.find(x => x.id === st.fem);
  const probe = st.fem === 'asa' ? Math.hypot(...r.probeU) : -r.probeU[1];
  const extra = {
    trespatas: `Es lo que se alabea la caja en una mesa que no es plana (o al levantarla por una esquina). Con la base atornillada en ${p.baseScrews} puntos.`,
    sinbase: 'Sin la base, la caja es una bandeja abierta por los dos lados: mucho más blanda. No la muevas destapada.',
    asa: 'De pie y colgada del asa: la caja gira un poco alrededor de la contraplaca; las tensiones se concentran alrededor del asa.',
    borde: 'La caja sobre sus patas y alguien apoyando 40 kg en el centro del canto del jugador.',
  }[st.fem];
  return `<div class="femres">
    <div class="big"><span>${r.probeLabel || 'Desplazamiento máximo'}</span><b>${f(probe)} <small>mm</small></b></div>
    <div class="big"><span>Tensión máxima</span><b>${f(r.vmax)} <small>MPa</small></b><em>${r.els[r.vAt] ? r.els[r.vAt].part : ''} · seguridad ×${f(ply.MOR / r.vmax)}</em></div>
  </div>
  ${st.field === 'u' ? legend(0, r.umax, 'mm') : legend(0, r.vmax, 'MPa')}
  <p class="note">${extra} <span class="muted">${r.nEl} elementos · ${r.nDof} gdl · ${Math.round(r.ms || 0)} ms · deformada × ${st.scale}</span></p>
  ${compareTable(d)}`;
}

function compareTable(d) {
  const fem = st.results.get(keyOf(d));
  if (!fem || fem.size < 2) return '';
  const a = fem.get('trespatas'), b = fem.get('sinbase');
  if (!a || !b) return '';
  return `<div class="cmp"><span>Mesa coja con base</span><b>${f(-a.probeU[1])} mm</b><span>Sin base</span><b>${f(-b.probeU[1])} mm</b><span>La base aporta</span><b>× ${f(b.probeU[1] / a.probeU[1])}</b></div>`;
}

function card(c) {
  const rows = c.rows.filter(r => r[0]).map(r => `<span>${r[0]}</span><b>${typeof r[1] === 'number' ? (isFinite(r[1]) ? f(r[1]) : '∞') : r[1]} <small>${r[2]}</small></b>`).join('');
  const th = c.thermal ? thermalBars(c.thermal) : '';
  return `<div class="simcard s-${c.status} ${st.card === c.id ? 'on' : ''}" ${c.field ? `data-card="${c.id}"` : ''}>
    <div class="sc-head">${icon(c.icon || 'info')}<strong>${c.title}</strong><em>${{ ok: 'OK', warn: 'Ojo', bad: 'Mal' }[c.status]}</em></div>
    ${c.load ? `<div class="sc-load">${c.load}</div>` : ''}
    ${rows ? `<div class="sc-rows">${rows}</div>` : ''}
    ${th}
    <p>${c.text}</p>
    ${c.model ? `<small>${c.model}${c.field ? ' · <u>clic para verlo en 3D</u>' : ''}</small>` : ''}
  </div>`;
}

function thermalBars(t) {
  const list = [['Cerrada, sin rejillas', t.none], ['Con rejillas (tiro natural)', t.vOnly], ['Rejillas + 2 ventiladores USB', t.withFans], ['Tu configuración', t.now]];
  const max = 50, min = 20;
  return `<div class="tbars">${list.map(([l, r]) => `<div><span>${l}</span><i style="width:${((r.Ti - min) / (max - min)) * 100}%;background:${r.Ti < 38 ? '#8fd18b' : r.Ti < 42 ? '#ffc14d' : '#ff6b5b'}"></i><b>${f(r.Ti)} °C</b></div>`).join('')}<div class="tlim" style="left:calc(${((40 - min) / (max - min)) * 100}% * .62 + 38%)"></div></div>`;
}

// ───────── estudios de sensibilidad (FEM «mesa coja» con una variable cambiada) ─────────
const STUDIES = {
  tornillos: { label: 'Tornillos de la base', line: true, vars: [4, 6, 8, 10, 14, 20, 30].map(n => ({ x: n, label: String(n), over: { baseScrews: n } })) },
  grosor: { label: 'Grosor del tablero', vars: [8, 10, 12, 15, 18].map(t => ({ x: t, label: t + ' mm', over: { t } })) },
  tablero: { label: 'Tipo de contrachapado', vars: [['chopo', 'Chopo'], ['pino', 'Pino / okumen'], ['abedul', 'Abedul']].map(([k, l]) => ({ x: k, label: l, over: { plyType: k } })) },
  marco: { label: 'Marco y margen', vars: [['simple', 8, 'Simple · margen 8'], ['simple', 20, 'Simple · margen 20'], ['rebaje', 20, 'Doble · margen 20'], ['rebaje', 40, 'Doble · margen 40'], ['rebaje', 60, 'Doble · margen 60']].map(([fr, mg, l]) => ({ x: l, label: l, over: { frame: fr, margin: mg } })) },
  base: { label: 'Fijación de la base', vars: [['insertos', 'Tornillos M5'], ['magnetos', 'Imanes + 4 M5']].map(([k, l]) => ({ x: k, label: l, over: { baseFix: k } })) },
};
st.sensKind = 'tornillos';
const sensKey = d => st.sensKind + JSON.stringify(femSpec(d));
function sensView(d) {
  const S = STUDIES[st.sensKind];
  const r = st.sens && st.sens.key === sensKey(d) ? st.sens : null;
  if (!r) return `<p class="note">Repite la simulación «mesa coja» cambiando ${S.label.toLowerCase()} (${S.vars.map(v => v.label).join(', ')}). Malla rápida, ~${Math.ceil(S.vars.length * 0.4)} s.</p><button class="btn-sm" id="sens-run">Calcular</button>`;
  if (r.pts.length < S.vars.length) return `<div class="progress"><i style="width:${(r.pts.length / S.vars.length) * 100}%"></i></div><p class="muted">Calculando «${S.vars[r.pts.length].label}»…</p>`;
  return S.line ? lineChart(r.pts, d.params.baseScrews) : barChart(r.pts, S);
}
function runSens(d) {
  if (!worker) worker = new Worker(new URL('./fem.worker.js', import.meta.url), { type: 'module' });
  const S = STUDIES[st.sensKind];
  st.sens = { key: sensKey(d), pts: [] };
  const job = ++st.job;
  st.busy = false;
  let i = 0;
  const paint = () => { const el = document.querySelector('#sens'); if (el) el.innerHTML = sensView(window.design || d); };
  paint();
  const next = () => {
    if (i >= S.vars.length || job !== st.job) return;
    const v = S.vars[i];
    const dv = buildDesign({ ...d.params, ...v.over });
    worker.onmessage = e => {
      if (e.data.id !== job + ':s' + i || e.data.progress != null) return;
      st.sens.pts.push([v.x, -e.data.result.probeU[1], e.data.result.vmax, v.label, dv.metrics.mass.total]);
      i++; paint(); next();
    };
    worker.postMessage({ spec: femSpec(dv), caseId: 'trespatas', h: 45, id: job + ':s' + i });
  };
  next();
}
function barChart(pts, S) {
  const max = Math.max(...pts.map(p => p[1]));
  return `<div class="bars">${pts.map(p => `<div title="${p[3]}: ${f(p[1])} mm · ${f(p[2])} MPa · ${f(p[4])} kg"><span>${p[3]}</span><i style="width:${(p[1] / max) * 100}%"></i><b>${f(p[1])} mm</b><em>${f(p[4])} kg</em></div>`).join('')}</div>
  <p class="note">Alabeo de la esquina sin apoyo en una mesa coja (menos es mejor) y peso total. ${S.label === 'Grosor del tablero' ? 'La rigidez a torsión crece con el cubo del grosor, pero el peso también sube: 12 mm es un buen compromiso si os parece blanda.' : S.label === 'Fijación de la base' ? 'Los imanes no transmiten cortante: la base deja de trabajar como tapa de la caja.' : ''}</p>`;
}
function lineChart(pts, cur) {
  const W = 360, H = 170, L = 36, R = 12, T = 14, B = 30;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = 0, x1 = Math.max(...xs) + 2, y0 = 0, y1 = Math.ceil(Math.max(...ys) / 5) * 5;
  const X = v => L + ((v - x0) / (x1 - x0)) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticksY = Array.from({ length: y1 / 5 + 1 }, (_, i) => i * 5);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join('');
  const best = pts[pts.length - 1][1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Alabeo frente a número de tornillos">
    ${ticksY.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="ax" text-anchor="end">${v}</text>`).join('')}
    ${xs.map(v => `<text x="${X(v)}" y="${H - B + 14}" class="ax" text-anchor="middle">${v}</text>`).join('')}
    <text x="${(L + W - R) / 2}" y="${H - 3}" class="ax" text-anchor="middle">tornillos en la base</text>
    <text x="${L}" y="${T - 4}" class="ax">alabeo de la esquina (mm)</text>
    <line x1="${X(cur)}" x2="${X(cur)}" y1="${T}" y2="${H - B}" class="cur"/>
    <path d="${path}" class="ln"/>
    ${pts.map(p => `<g class="pt"><circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4"/><circle cx="${X(p[0])}" cy="${Y(p[1])}" r="12" class="hit"><title>${p[0]} tornillos: ${f(p[1])} mm de alabeo · ${f(p[2])} MPa</title></circle></g>`).join('')}
  </svg>
  <p class="note">Por encima de ~${pts.find(p => p[1] < best * 1.1)?.[0] ?? 14} tornillos ya no se gana casi nada: el resto de la flexibilidad es la propia torsión del tablero. Por debajo de 8 la base «flota» entre tornillos y la caja pierde rigidez. La línea vertical marca tu diseño (${cur}).</p>`;
}
