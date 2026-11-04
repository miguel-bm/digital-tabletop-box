import { DEFAULTS, SCHEMA, PARAM_INDEX, PRESETS, PLY, PROTECTORS, COVERS } from './params.js';
import { buildDesign, pieceCut } from './model.js';
import { Viewer, LAYERS, fmt } from './scene.js';
import { COVER_SWATCHES, FRAME_SWATCHES } from './materials.js';
import { planAssembly } from './assembly.js';
import { cutRows, cutListCSV, boardUsage } from './cutlist.js';
import { icon, decorate, setupTips } from './icons.js';
import { renderDecisions } from './decisions.js';
import { buildBOM } from './bom.js';

const STORE_KEY = 'tabletop.v1';
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const f1 = v => fmt(v).replace('.', ',');
const eur = v => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

// ───────── estado ─────────
let params = { ...DEFAULTS };
let ui = { dimLayers: ['general'], hidden: ['tapa'], explode: 0, edges: true, xray: false, section: false, dims: true, tab: 'acabados', groupsOpen: ['caja', 'marco'], collapsed: [], lidOn: false };
try {
  const s = JSON.parse(localStorage.getItem(STORE_KEY));
  if (s) { params = { ...DEFAULTS, ...s.params }; ui = { ...ui, ...s.ui }; }
} catch { /* sin almacenamiento */ }
const urlStep = new URLSearchParams(location.search).get('paso');
let fromLink = false;
try {
  const hm = location.hash.match(/d=([\w-]+)/);
  if (hm) {
    const json = decodeURIComponent(escape(atob(hm[1].replace(/-/g, '+').replace(/_/g, '/'))));
    params = { ...DEFAULTS, ...JSON.parse(json) };
    fromLink = true;
    history.replaceState(null, '', location.pathname + location.search);
  }
} catch { /* enlace roto */ }
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ params, ui })); } catch { /* lleno o bloqueado */ } };

const hist = { past: [], future: [] };
function commit(next, { record = true } = {}) {
  if (record) { hist.past.push({ ...params }); if (hist.past.length > 80) hist.past.shift(); hist.future = []; }
  params = next;
  save();
  schedule();
}

// ───────── visor ─────────
const tooltip = $('#tooltip');
const viewer = new Viewer($('#viewport'), {
  onHover: (pc, e) => {
    if (!pc || !e) { tooltip.hidden = true; return; }
    const c = pc.role === 'tv' ? null : pieceCut(pc);
    tooltip.innerHTML = `<strong>${pc.id} · ${pc.name}</strong>${c ? `<span class="mono">${f1(c.L)} × ${f1(c.W)} × ${f1(c.T)}</span>${c.notes ? `<small>${c.notes}</small>` : ''}` : `<span class="mono">${f1(params.tvW)} × ${f1(params.tvH)} × ${f1(params.tvD)} · ${f1(params.tvKg)} kg</span>`}`;
    tooltip.hidden = false;
    tooltip.style.left = Math.min(innerWidth - 310, e.clientX + 14) + 'px';
    tooltip.style.top = e.clientY + 14 + 'px';
  },
  onPick: pc => { if (pc && pc.role !== 'tv') { selectTab('despiece'); const row = document.querySelector(`[data-pid="${pc.id}"]`); if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1200); } } },
});
window.viewer = viewer;

let design = null, timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(rebuild, 30); }
function rebuild() {
  design = buildDesign(params);
  window.design = design;
  viewer.setDesign(design);
  viewer.setHidden(new Set(ui.hidden));
  renderSide();
  renderParams(true);
  renderReadouts();
  if (guide.on) showStep(guide.i, false);
  if (plans.on) renderPlans();
  if (sim.on) sim.render && sim.render();
}

// ───────── parámetros ─────────
const filterInput = $('#param-filter');
function renderParams(onlyValues) {
  const host = $('#params');
  if (onlyValues && host.childElementCount) {
    host.querySelectorAll('[data-k]').forEach(row => {
      const k = row.dataset.k, v = params[k];
      row.classList.toggle('changed', v !== DEFAULTS[k]);
      const inp = row.querySelector('input.n, select, input.toggle');
      if (!inp || document.activeElement === inp) return;
      if (inp.type === 'checkbox') inp.checked = !!v; else inp.value = v;
      const rng = row.querySelector('input[type=range]');
      if (rng) { rng.value = v; setPct(rng); }
    });
    return;
  }
  host.innerHTML = '';
  for (const g of SCHEMA) {
    const det = el('details', { className: 'group' });
    det.open = ui.groupsOpen.includes(g.id);
    det.addEventListener('toggle', () => { ui.groupsOpen = det.open ? [...new Set([...ui.groupsOpen, g.id])] : ui.groupsOpen.filter(x => x !== g.id); save(); });
    det.append(el('summary', {}, `${icon(g.icon, 'gi')}${g.label}<span class="count">${g.params.length}</span>`));
    for (const pd of g.params) det.append(paramRow(pd));
    host.append(det);
  }
  decorate(host);
  applyFilter();
}
function setPct(r) { r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'); }
function paramRow(pd) {
  const row = el('div', { className: 'prow' + (pd.type === 'bool' ? ' bool' : '') });
  row.dataset.k = pd.k;
  row.dataset.search = (pd.l + ' ' + pd.k).toLowerCase();
  row.classList.toggle('changed', params[pd.k] !== DEFAULTS[pd.k]);
  const lab = el('label', {}, pd.l);
  row.append(lab);
  const set = v => commit({ ...params, [pd.k]: v });
  if (pd.type === 'bool') {
    const t = el('input', { type: 'checkbox', className: 'toggle', checked: !!params[pd.k] });
    t.addEventListener('change', () => set(t.checked));
    row.append(t);
  } else if (pd.type === 'select') {
    const s = el('select');
    Object.entries(pd.opts).forEach(([v, l]) => s.append(el('option', { value: v, textContent: l })));
    s.value = params[pd.k];
    s.addEventListener('change', () => set(isNaN(Number(s.value)) || typeof DEFAULTS[pd.k] === 'string' ? s.value : Number(s.value)));
    row.append(s);
  } else {
    const box = el('div', { className: 'num' });
    const n = el('input', { className: 'n', value: params[pd.k], inputMode: 'decimal' });
    const apply = () => {
      let v = Number(String(n.value).replace(',', '.'));
      if (/^[\d.+\-*/ ()]+$/.test(n.value) && isNaN(v)) { try { v = Function('return (' + n.value + ')')(); } catch { v = NaN; } }
      if (!isFinite(v)) { n.value = params[pd.k]; return; }
      v = Math.max(pd.min, Math.min(pd.max, v));
      if (v !== params[pd.k]) set(v); else n.value = v;
    };
    n.addEventListener('change', apply);
    n.addEventListener('keydown', e => {
      if (e.key === 'Enter') { n.blur(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const st = (pd.step || 1) * (e.shiftKey ? 10 : 1); n.value = Math.round((params[pd.k] + (e.key === 'ArrowUp' ? st : -st)) * 100) / 100; apply(); }
    });
    box.append(n, el('em', {}, pd.u || ''));
    row.append(box);
    const r = el('input', { type: 'range', min: pd.min, max: pd.max, step: pd.step || 1, value: params[pd.k] });
    setPct(r);
    r.addEventListener('input', () => { setPct(r); n.value = r.value; commit({ ...params, [pd.k]: Number(r.value) }, { record: false }); });
    r.addEventListener('change', () => { hist.past.push({ ...params }); });
    row.append(r);
  }
  return row;
}
function applyFilter() {
  const q = filterInput.value.trim().toLowerCase();
  document.querySelectorAll('#params details.group').forEach(det => {
    let any = false;
    det.querySelectorAll('.prow').forEach(r => { const on = !q || r.dataset.search.includes(q); r.classList.toggle('hide', !on); any = any || on; });
    det.style.display = any ? '' : 'none';
    if (q && any) det.open = true;
  });
}
filterInput.addEventListener('input', applyFilter);

function renderPresets() {
  const host = $('#presets');
  host.innerHTML = '';
  PRESETS.forEach(pr => {
    const b = el('button', {}, `<i><b style="background:${pr.p.coverColor || '#333'}"></b><b style="background:${pr.p.frameFinish === 'madera' ? '#d6b183' : '#1d1d1f'}"></b></i><span><strong>${pr.label}</strong><small>${pr.sub}</small></span>`);
    b.addEventListener('click', () => { commit({ ...params, ...pr.p }); toast(`Diseño «${pr.label}» aplicado`); });
    host.append(b);
  });
}

// ───────── panel derecho ─────────
function selectTab(t, open = true) {
  ui.tab = t; save();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('section[data-pane]').forEach(s => s.classList.toggle('on', s.dataset.pane === t));
  if (open) $('#panel-side').classList.remove('collapsed');
  if (t === 'decisiones' && design) renderDecisions($('#pane-decisiones'), params, o => commit({ ...params, ...o }));
}
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
addEventListener('resize', () => { if (viewer.autoFit) viewer.fit(false); });

function renderSide() {
  renderFinishes();
  renderCut();
  renderHardware();
  renderData();
  renderWarnings();
  if (ui.tab === 'decisiones') renderDecisions($('#pane-decisiones'), params, o => commit({ ...params, ...o }));
}

function swatchRow(list, cur, onPick) {
  const w = el('div', { className: 'swatches' });
  list.forEach(c => {
    const b = el('button', { title: c });
    b.style.background = c;
    if (c.toLowerCase() === String(cur).toLowerCase()) b.classList.add('on');
    b.addEventListener('click', () => onPick(c));
    w.append(b);
  });
  return w;
}

function renderFinishes() {
  const host = $('#pane-acabados');
  host.innerHTML = '';
  const block = (title, sub) => { const d = el('div', { className: 'finish' }); d.append(el('h4', {}, `${title}<small>${sub || ''}</small>`)); host.append(d); return d; };
  // revestimiento
  const b1 = block('Revestimiento exterior', design.metrics.coverArea ? f1(design.metrics.coverArea) + ' m²' : '');
  const r1 = el('div', { className: 'row' });
  const s1 = el('select');
  Object.entries(COVERS).forEach(([k, v]) => s1.append(el('option', { value: k, textContent: v.label })));
  s1.value = params.cover;
  s1.addEventListener('change', () => commit({ ...params, cover: s1.value }));
  const c1 = el('input', { type: 'color', value: params.coverColor });
  c1.addEventListener('input', () => commit({ ...params, coverColor: c1.value }, { record: false }));
  r1.append(s1, c1);
  b1.append(r1, swatchRow(COVER_SWATCHES, params.coverColor, c => commit({ ...params, coverColor: c })));
  b1.append(el('p', { className: 'note' }, coverNote(params.cover)));
  // marco
  const b2 = block('Cara superior del marco', '');
  const r2 = el('div', { className: 'row' });
  const s2 = el('select');
  [['negro', 'Pintado (color)'], ['madera', 'Madera vista aceitada'], ['mismo', 'Forrado como el exterior']].forEach(([k, l]) => s2.append(el('option', { value: k, textContent: l })));
  s2.value = params.frameFinish;
  s2.addEventListener('change', () => commit({ ...params, frameFinish: s2.value }));
  const c2 = el('input', { type: 'color', value: params.frameColor });
  c2.addEventListener('input', () => commit({ ...params, frameColor: c2.value }, { record: false }));
  r2.append(s2, c2);
  b2.append(r2, swatchRow(FRAME_SWATCHES, params.frameColor, c => commit({ ...params, frameColor: c, frameFinish: 'negro' })));
  b2.append(el('p', { className: 'note' }, 'El borde que rodea la imagen conviene que sea oscuro y mate: un marco claro o brillante refleja la pantalla y cansa la vista. Los labios interiores se pintan siempre de negro.'));
  // tablero
  const b3 = block('Contrachapado', PLY[params.plyType].rho + ' kg/m³');
  const s3 = el('select');
  Object.entries(PLY).forEach(([k, v]) => s3.append(el('option', { value: k, textContent: `${v.label} · E ${v.E} MPa` })));
  s3.value = params.plyType;
  s3.addEventListener('change', () => commit({ ...params, plyType: s3.value }));
  b3.append(s3);
  b3.append(el('p', { className: 'note' }, 'Afecta al peso y a los cálculos de rigidez. Si no sabes qué tienes, elige chopo (lo más desfavorable).'));
  // combinaciones rápidas
  host.append(el('div', { className: 'h-sub' }, 'Combinaciones'));
  const combos = el('div', { className: 'presets' });
  [
    ['Negro clásico', 'tolex', '#232325', 'negro', '#1d1d1f'],
    ['Cuero y nogal', 'polipiel', '#5b3a26', 'madera', '#1d1d1f'],
    ['Terciopelo burdeos', 'terciopelo', '#4a1f24', 'negro', '#1d1d1f'],
    ['Verde mesa de juego', 'fieltro', '#1f3a2e', 'madera', '#1d1d1f'],
    ['Corcho natural', 'corcho', '#b88d5f', 'negro', '#2b2d30'],
    ['Madera vista', 'ninguno', '#232325', 'madera', '#1d1d1f'],
  ].forEach(([l, cv, cc, ff, fc]) => {
    const b = el('button', {}, `<i><b style="background:${cv === 'ninguno' ? '#e7d3b4' : cc}"></b><b style="background:${ff === 'madera' ? '#d6b183' : fc}"></b></i>${l}`);
    b.addEventListener('click', () => commit({ ...params, cover: cv, coverColor: cc, frameFinish: ff, frameColor: fc }));
    combos.append(b);
  });
  host.append(combos);
}
function coverNote(c) {
  return {
    tolex: 'El vinilo de los amplificadores: muy resistente al roce, lavable y fácil de doblar en las esquinas con calor (secador). La opción «maleta» de verdad.',
    polipiel: 'Aspecto cuero; se estira peor que el tolex en las esquinas. Elige uno con soporte de tejido, no el de espuma.',
    terciopelo: 'Precioso y cálido, pero coge polvo y pelos y se marca al roce. Mejor en el marco o el frente que en los cantos que apoyan.',
    fieltro: 'Barato, fácil de pegar, aspecto de mesa de juego. Se ensucia con facilidad; elige 2 mm.',
    corcho: 'Ligero y cálido; las esquinas hay que hacerlas a inglete porque no se dobla bien.',
    pintura: 'Lo más simple: imprimación, lijado y esmalte satinado. Los golpes en los cantos se ven más.',
    ninguno: 'Contrachapado de abedul aceitado o barnizado: los cantos con chapas a la vista quedan muy bonitos.',
  }[c] || '';
}

function renderCut() {
  const host = $('#pane-despiece');
  const rows = cutRows(design);
  const groups = {};
  rows.forEach(r => (groups[r.stockLabel] = groups[r.stockLabel] || []).push(r));
  let h = '<table class="cut"><thead><tr><th>Pieza</th><th class="n">Largo</th><th class="n">Ancho</th><th class="n">Gr.</th><th class="n">Ud</th></tr></thead><tbody>';
  Object.entries(groups).forEach(([g, list]) => {
    h += `<tr class="mat"><td colspan="5">${g}</td></tr>`;
    list.forEach(r => { h += `<tr data-pid="${r.ids[0]}"><td><span class="pid">${r.ids.join(' ')}</span>${r.name}${r.notes ? `<small>${r.notes}</small>` : ''}</td><td class="n">${f1(r.L)}</td><td class="n">${f1(r.W)}</td><td class="n">${f1(r.T)}</td><td class="n">${r.qty}</td></tr>`; });
  });
  h += '</tbody></table>';
  const u = boardUsage(design);
  h += `<div class="tot"><span>Tableros 2440×1220 de ${params.t} mm</span><span>${u.boards}</span><span>${Math.round(u.area * 100) / 100} m²</span><span>Listón ${params.battenW}×${params.battenH} y tacos</span><span>${f1(u.battenM)} m</span><span></span></div>`;
  h += `<div class="btnrow"><button id="csv-btn">Descargar CSV</button><button id="plans-btn2">Ver plano de corte</button></div>`;
  host.innerHTML = h;
  $('#csv-btn').onclick = () => download('despiece.csv', cutListCSV(design), 'text/csv');
  $('#plans-btn2').onclick = () => openPlans('corte');
}

let bought = {};
try { bought = JSON.parse(localStorage.getItem('tabletop.bought') || '{}'); } catch { /* nada */ }
function renderHardware() {
  const host = $('#pane-herrajes');
  const bom = buildBOM(design);
  const left = bom.items.filter(it => !it.own && !bought[it.key]).reduce((s, it) => s + it.cost, 0);
  let h = '<p class="note">Precios orientativos (España, 2026). Marca lo que ya tengáis o hayáis comprado: se recuerda en este navegador.</p><table class="cut buy"><tbody>';
  Object.entries(bom.groups).forEach(([g, list]) => {
    h += `<tr class="mat"><td colspan="4">${g}</td></tr>`;
    list.forEach(it => { const on = it.own || bought[it.key]; h += `<tr class="${on ? 'got' : ''}"><td><input type="checkbox" data-key="${it.key}" ${on ? 'checked' : ''} ${it.own ? 'disabled' : ''}></td><td>${it.name}${it.own ? ' <small style="display:inline">· tenéis</small>' : ''}</td><td class="n">${String(it.qty).replace('.', ',')}${it.u ? ' ' + it.u : ''}</td><td class="n">${eur(it.cost)}</td></tr>`; });
  });
  h += '</tbody></table>';
  h += `<div class="tot"><span>Total estimado</span><span></span><span>${eur(bom.total)}</span><span>Falta por comprar</span><span></span><span>${eur(left)}</span></div><div class="btnrow"><button id="buy-print">Hoja de compra (planos)</button></div>`;
  host.innerHTML = h;
  host.querySelectorAll('input[data-key]').forEach(c => c.addEventListener('change', () => { bought[c.dataset.key] = c.checked; try { localStorage.setItem('tabletop.bought', JSON.stringify(bought)); } catch { /* nada */ } renderHardware(); }));
  $('#buy-print').onclick = () => openPlans('taller');
}

function bar(parts) {
  const tot = parts.reduce((s, p) => s + p.v, 0);
  return `<div class="mbar">${parts.map(p => `<i style="flex:${p.v};background:${p.c}" title="${p.l}: ${f1(p.v)} kg"></i>`).join('')}</div><div class="mleg">${parts.map(p => `<span><i style="background:${p.c}"></i>${p.l} ${f1(p.v)}</span>`).join('')}</div>`;
}
function renderData() {
  const m = design.metrics, p = params;
  const M = m.mass;
  const host = $('#pane-datos');
  host.innerHTML = `
    <div class="h-sub">Medidas exteriores</div>
    <dl class="facts">
      <dt>Largo × ancho</dt><dd>${f1(m.outer.X)} × ${f1(m.outer.Z)} mm</dd>
      <dt>Alto (con patas)</dt><dd>${f1(m.outer.H + m.y0)} mm</dd>
      <dt>Interior libre</dt><dd>${f1(m.innerX)} × ${f1(m.innerZ)} × ${f1(m.yF - m.yBaseTop)}</dd>
      <dt>Marco visible (lado / arriba / abajo)</dt><dd>${f1(m.op1[0] - (-m.X / 2))} / ${f1(m.op1[1] + m.Z / 2)} / ${f1(m.Z / 2 - m.op1[3])}</dd>
    </dl>
    <div class="h-sub">Peso · ${f1(M.total)} kg</div>
    ${bar([{ l: 'Tele', v: M.tv, c: '#5ad1e6' }, { l: 'Tablero', v: M.ply, c: '#e7d3b4' }, { l: 'Listón', v: M.batten, c: '#c99b62' }, { l: 'Protector', v: M.protector, c: '#a9c7e0' }, { l: 'Forro', v: M.cover, c: '#8a919b' }, { l: 'Herrajes', v: M.hw, c: '#ffb020' }].filter(x => x.v > 0.01))}
    <div class="h-sub">Pantalla para jugar</div>
    <dl class="facts">
      <dt>Área visible</dt><dd>${f1(p.screenW)} × ${f1(p.screenH)} mm</dd>
      <dt>Resolución</dt><dd>1920 × 1080 · ${f1(m.pxPerMm * 25.4)} ppp</dd>
      <dt>Casilla de 1" (25,4 mm)</dt><dd>${f1(m.inchPx)} px</dd>
      <dt>Rejilla de 1" que cabe</dt><dd>${m.gridCells[0]} × ${m.gridCells[1]} casillas</dd>
      <dt>Peana 25 mm / 32 mm</dt><dd>${f1(25 * m.pxPerMm)} / ${f1(32 * m.pxPerMm)} px</dd>
    </dl>
    <p class="note">En Foundry, Owlbear o Roll20 pon el tamaño de casilla a <b>${Math.round(m.inchPx * 10) / 10} px</b> y la imagen a pantalla completa sin escalado: las peanas de 25 mm coincidirán con las casillas.</p>
    <div class="h-sub">Pila de capas (de abajo arriba)</div>
    <table class="cut stack"><tbody>
      ${m.y0 ? `<tr><td>Patas</td><td class="n">0 → ${f1(m.y0)}</td></tr>` : ''}
      <tr><td>Base</td><td class="n">${f1(m.y0)} → ${f1(m.yBaseTop)}</td></tr>
      <tr><td>${p.mount === 'vesa' ? 'Travesaño VESA / aire' : 'Espuma'}</td><td class="n">${f1(m.yBaseTop)} → ${f1(m.yB)}</td></tr>
      <tr><td>Tele (joroba → pantalla)</td><td class="n">${f1(m.yB)} → ${f1(m.yS)}</td></tr>
      ${!m.twoLayer && m.pt ? `<tr><td>Protector</td><td class="n">${f1(m.yS)} → ${f1(m.yS + m.pt)}</td></tr>` : ''}
      <tr><td>Burlete</td><td class="n">→ ${f1(m.yF)}</td></tr>
      <tr><td>Marco${m.twoLayer ? ' (2 capas)' : ''}</td><td class="n">${f1(m.yF)} → ${f1(m.yTop)}</td></tr>
      ${m.twoLayer && m.pt ? `<tr><td>Protector (en el pozo)</td><td class="n">${f1(m.yF + p.t)} → ${f1(m.yF + p.t + m.pt)}</td></tr>` : ''}
    </tbody></table>`;
}

function renderWarnings() {
  const w = design.warnings;
  $('#warn-count').textContent = w.filter(x => x.level !== 'info').length || '';
  $('#pane-avisos').innerHTML = w.length ? w.map(x => `<div class="warn ${x.level}">${x.text}</div>`).join('') : '<p class="ok">Sin avisos: todas las comprobaciones geométricas pasan.</p>';
}

function renderReadouts() {
  const m = design.metrics;
  $('#brand-dims').textContent = `${f1(m.outer.X)} × ${f1(m.outer.Z)} × ${f1(m.outer.H + m.y0)} mm · ${f1(m.mass.total)} kg`;
  $('#readouts').innerHTML = `<span>Rejilla <b>${m.gridCells[0]}×${m.gridCells[1]}</b> casillas de 1"</span><span>Peso <b>${f1(m.mass.total)} kg</b></span>`;
}

// ───────── dock ─────────
const DIM_LAYERS = { general: 'Generales', pantalla: 'Pantalla y marco', construccion: 'Construcción', tv: 'Tele' };
function renderDimChips() {
  const host = $('#dim-layers');
  host.innerHTML = '';
  Object.entries(DIM_LAYERS).forEach(([k, l]) => {
    const b = el('button', { className: 'chip dimchip' + (ui.dimLayers.includes(k) ? ' on' : ''), textContent: l });
    b.addEventListener('click', () => { ui.dimLayers = ui.dimLayers.includes(k) ? ui.dimLayers.filter(x => x !== k) : [...ui.dimLayers, k]; b.classList.toggle('on'); save(); viewer.setDimLayers(new Set(ui.dimLayers)); });
    host.append(b);
  });
}
function renderDock() {
  renderDimChips();
  const host = $('#vis-layers');
  host.innerHTML = '';
  Object.entries(LAYERS).forEach(([k, v]) => {
    const b = el('button', { className: 'chip' + (ui.hidden.includes(k) ? '' : ' on'), textContent: v.label });
    b.addEventListener('click', () => {
      ui.hidden = ui.hidden.includes(k) ? ui.hidden.filter(x => x !== k) : [...ui.hidden, k];
      b.classList.toggle('on'); save(); viewer.setHidden(new Set(ui.hidden));
    });
    host.append(b);
  });
}
const explodeIn = $('#explode');
explodeIn.addEventListener('input', () => { ui.explode = Number(explodeIn.value); viewer.setExplode(ui.explode); explodeIn.style.setProperty('--pct', ui.explode * 100 + '%'); });
const tg = (id, key, fn) => { const b = $(id); b.classList.toggle('on', !!ui[key]); b.addEventListener('click', () => { ui[key] = !ui[key]; b.classList.toggle('on', ui[key]); save(); fn(ui[key]); }); };
tg('#tg-edges', 'edges', v => viewer.setEdges(v));
tg('#tg-xray', 'xray', v => viewer.setXray(v));
tg('#tg-section', 'section', v => viewer.setSection(v));
tg('#tg-lid', 'lidOn', v => { if (v && !params.lid) commit({ ...params, lid: true }); if (v) { ui.hidden = ui.hidden.filter(x => x !== 'tapa'); renderDock(); viewer.setHidden(new Set(ui.hidden)); } viewer.setLid(v); });
const mapSel = $('#map-style');
mapSel.value = params.mapStyle;
mapSel.addEventListener('change', () => commit({ ...params, mapStyle: mapSel.value }));

// vistas
document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
function setView(v) {
  document.querySelectorAll('#views button').forEach(x => x.classList.toggle('on', x.dataset.view === v));
  if (v === 'section' && !ui.section) { ui.section = true; $('#tg-section').classList.add('on'); viewer.setSection(true); }
  viewer.view(v);
}

// ───────── guía de montaje ─────────
const guide = { on: false, i: 0, steps: [] };
let doneSteps = {};
try { doneSteps = JSON.parse(localStorage.getItem('tabletop.done') || '{}'); } catch { /* nada */ }
$('#guide-done').addEventListener('change', e => {
  const st = guide.steps[guide.i]; doneSteps[st.key] = e.target.checked;
  try { localStorage.setItem('tabletop.done', JSON.stringify(doneSteps)); } catch { /* nada */ }
  showStep(guide.i, false);
});
function openGuide(i = 0) {
  guide.on = true; guide.steps = planAssembly(design);
  document.body.classList.add('guiding');
  $('#guide').hidden = false;
  closeSim();
  showStep(Math.min(i, guide.steps.length - 1));
}
function closeGuide() {
  guide.on = false;
  document.body.classList.remove('guiding');
  $('#guide').hidden = true;
  viewer.setHighlight(null); viewer.setFlip && viewer.setFlip(false);
  viewer.setExplode(ui.explode); viewer.setLid(ui.lidOn);
  viewer.setHidden(new Set(ui.hidden));
}
function showStep(i, fly = true) {
  guide.steps = planAssembly(design);
  guide.i = i = Math.max(0, Math.min(guide.steps.length - 1, i));
  const st = guide.steps[i];
  const fxSteps = new Set();
  guide.steps.slice(0, i + 1).forEach(s => { fxSteps.add(s.key); (s.fixtures || []).forEach(f => fxSteps.add(f)); });
  viewer.setHidden(new Set(st.lid ? [] : ['tapa']));
  viewer.setHighlight({ now: new Set(st.now), done: new Set(st.done || []), fixtures: fxSteps });
  viewer.setFlip && viewer.setFlip(!!st.flip);
  viewer.setLid(!!st.lid);
  const ex = Number($('#guide-explode').value);
  viewer.setExplode(st.explode * (ex / 0.35));
  $('#guide-n').textContent = `${i + 1}/${guide.steps.length}`;
  $('#guide-title').textContent = st.title + (st.flip ? ' · boca abajo' : '');
  $('#guide-text').textContent = st.text;
  $('#guide-access').innerHTML = st.access ? `<b>Ojo</b>${st.access}` : '';
  const parts = st.now.map(id => design.pieces.find(p => p.id === id)).filter(Boolean);
  $('#guide-parts').innerHTML = parts.map(p => `<span class="gp"><b>${p.id}</b> ${p.name}</span>`).join('') + (st.hw || []).map(h => `<span class="gp hw">${h}</span>`).join('');
  $('#guide-done').checked = !!doneSteps[st.key];
  $('#guide-chapters').innerHTML = guide.steps.map((s, k) => `<button data-k="${k}" class="${k === i ? 'on' : ''} ${doneSteps[s.key] ? 'done' : ''}"><b>${doneSteps[s.key] ? '✓' : k + 1}</b>${s.title.split(':')[0]}</button>`).join('');
  $('#guide-chapters').querySelectorAll('button').forEach(b => b.addEventListener('click', () => showStep(Number(b.dataset.k))));
  $('#guide-chapters .on').scrollIntoView({ inline: 'center', block: 'nearest' });
  $('#guide-prev').disabled = i === 0;
  $('#guide-next').textContent = i === guide.steps.length - 1 ? 'Terminar ✓' : 'Siguiente ›';
  if (fly) viewer.view('persp');
  history.replaceState(null, '', '?paso=' + (i + 1));
}
$('#btn-guide').addEventListener('click', () => (guide.on ? closeGuide() : openGuide(0)));
$('#guide-close').addEventListener('click', closeGuide);
$('#guide-prev').addEventListener('click', () => showStep(guide.i - 1));
$('#guide-next').addEventListener('click', () => (guide.i === guide.steps.length - 1 ? (closeGuide(), history.replaceState(null, '', location.pathname)) : showStep(guide.i + 1)));
$('#guide-explode').addEventListener('input', () => showStep(guide.i, false));
$('#guide-min').addEventListener('click', () => $('#guide').classList.toggle('min'));

// ───────── planos (carga diferida) ─────────
const plans = { on: false, set: 'conjunto' };
async function renderPlans() {
  const { buildSheets } = await import('./plans.js');
  let snap = null;
  if (plans.set === 'conjunto') { try { snap = viewer.snapshot(); } catch (e) { console.warn(e); } }
  const sheets = buildSheets(design, plans.set, snap);
  $('#sheets').innerHTML = sheets.join('');
  $('#plans-info').textContent = `${sheets.length} hoja${sheets.length > 1 ? 's' : ''} A3 · cotas en mm`;
}
function openPlans(set = plans.set) {
  plans.on = true; plans.set = set;
  document.querySelectorAll('#plans-tabs button').forEach(b => b.classList.toggle('on', b.dataset.set === set));
  $('#plans').hidden = false;
  renderPlans();
}
$('#btn-plans').addEventListener('click', () => openPlans());
$('#plans-close').addEventListener('click', () => { plans.on = false; $('#plans').hidden = true; });
document.querySelectorAll('#plans-tabs button').forEach(b => b.addEventListener('click', () => openPlans(b.dataset.set)));
$('#plans-print').addEventListener('click', () => print());
$('#plans-dxf').addEventListener('click', async () => { const { boardsDXF } = await import('./dxf.js'); download('tablero-digital-corte.dxf', boardsDXF(design), 'application/dxf'); toast('DXF descargado: capas CORTE_EXT, CORTE_INT, TALADRO'); });
$('#plans-csv').addEventListener('click', () => download('despiece.csv', cutListCSV(design), 'text/csv'));
$('#plans-svg').addEventListener('click', () => {
  [...document.querySelectorAll('#sheets svg')].forEach((s, i) => download(`plano-${plans.set}-${i + 1}.svg`, s.outerHTML, 'image/svg+xml'));
});

// ───────── cálculos (carga diferida) ─────────
const sim = { on: false };
async function openSim() {
  if (guide.on) closeGuide();
  const mod = await import('./simui.js');
  sim.on = true;
  document.body.classList.add('simming');
  $('#sim').hidden = false;
  sim.render = () => mod.renderSim($('#sim'), design, viewer, { close: closeSim });
  sim.render();
}
function closeSim() {
  if (!sim.on) return;
  sim.on = false;
  document.body.classList.remove('simming');
  $('#sim').hidden = true;
  viewer.setOverlay && viewer.setOverlay(null);
}
$('#btn-sim').addEventListener('click', () => (sim.on ? closeSim() : openSim()));

// ───────── acciones ─────────
function download(name, data, type) {
  const a = el('a', { download: name, href: typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type })) });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200);
}
$('#btn-png').addEventListener('click', () => download('tablero-digital.png', viewer.png()));
$('#btn-export').addEventListener('click', () => download('tablero-digital.json', JSON.stringify({ params }, null, 2), 'application/json'));
$('#file-import').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const j = JSON.parse(await f.text()); commit({ ...DEFAULTS, ...(j.params || j) }); toast('Diseño cargado'); } catch { toast('No se pudo leer el archivo'); }
});
$('#btn-reset').addEventListener('click', () => { commit({ ...DEFAULTS }); toast('Valores por defecto'); });
$('#btn-share').addEventListener('click', async () => {
  const diff = Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== DEFAULTS[k]));
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(diff)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = location.origin + location.pathname + '#d=' + b64;
  try { await navigator.clipboard.writeText(url); toast('Enlace copiado: ábrelo en otro dispositivo o pásaselo a tu amigo'); }
  catch { prompt('Copia este enlace', url); }
});
const helpEl = $('#help');
$('#btn-help').addEventListener('click', () => (helpEl.hidden = !helpEl.hidden));
$('#help-close').addEventListener('click', () => (helpEl.hidden = true));
helpEl.addEventListener('click', e => { if (e.target === helpEl) helpEl.hidden = true; });
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
function undo() { if (!hist.past.length) return; hist.future.push({ ...params }); params = hist.past.pop(); save(); schedule(); }
function redo() { if (!hist.future.length) return; hist.past.push({ ...params }); params = hist.future.pop(); save(); schedule(); }

addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  const views = { 1: 'persp', 2: 'top', 3: 'front', 4: 'side', 5: 'section' };
  if (views[e.key]) setView(views[e.key]);
  if (e.key === 'x' || e.key === 'X') $('#tg-xray').click();
  if (e.key === 's' || e.key === 'S') $('#tg-section').click();
  if (e.key === '?') helpEl.hidden = !helpEl.hidden;
  if (e.key === 'Escape' && !helpEl.hidden) { helpEl.hidden = true; return; }
  if (e.key === 'Escape') { if (plans.on) $('#plans-close').click(); else if (guide.on) closeGuide(); else if (sim.on) closeSim(); }
  if (guide.on && e.key === 'ArrowRight') showStep(guide.i + 1);
  if (guide.on && e.key === 'ArrowLeft') showStep(guide.i - 1);
});

// paneles plegables
['#panel-params', '#panel-side'].forEach((sel, i) => {
  const p = $(sel);
  const tab = el('button', { className: 'panel-tab' }, `<span>${i ? 'Datos' : 'Diseño'}</span>`);
  tab.addEventListener('click', () => { p.classList.toggle('collapsed'); ui.collapsed = [...document.querySelectorAll('.panel.collapsed')].map(x => '#' + x.id); save(); });
  p.append(tab);
  if (ui.collapsed.includes(sel)) p.classList.add('collapsed');
});

// navegación móvil
const mq = matchMedia('(max-width: 760px)');
function mobileInit() {
  if (!mq.matches) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.add('collapsed'));
}
mobileInit();
document.querySelectorAll('#mnav button').forEach(b => b.addEventListener('click', () => {
  const s = b.dataset.sheet;
  const left = $('#panel-params'), right = $('#panel-side');
  const was = b.classList.contains('on');
  document.querySelectorAll('#mnav button').forEach(x => x.classList.remove('on'));
  left.classList.add('collapsed'); right.classList.add('collapsed'); document.body.classList.remove('dock-open');
  if (was) return;
  if (s === 'left') { left.classList.remove('collapsed'); b.classList.add('on'); }
  if (s === 'right') { right.classList.remove('collapsed'); b.classList.add('on'); }
  if (s === 'dock') { document.body.classList.add('dock-open'); b.classList.add('on'); }
  if (s === 'guide') openGuide(0);
  if (s === 'sim') openSim();
  if (s === 'plans') openPlans();
}));

// el modelo se centra en el hueco que dejan los paneles
function updateInsets() {
  if (mq.matches) { viewer.setInsets(0, 0, document.body.classList.contains('guiding') ? Math.max(0, $('#guide').offsetHeight - 40) : 0); return; }
  const L = !$('#panel-params').classList.contains('collapsed') && !document.body.classList.contains('guiding') ? 342 : 0;
  const R = document.body.classList.contains('simming') ? 424 : !$('#panel-side').classList.contains('collapsed') && !document.body.classList.contains('guiding') ? 384 : 0;
  const B = document.body.classList.contains('guiding') ? Math.max(0, $('#guide').offsetHeight - 60) : 0;
  viewer.setInsets(L, R, B);
}
new MutationObserver(updateInsets).observe(document.body, { attributes: true, attributeFilter: ['class'] });
['#panel-params', '#panel-side'].forEach(s => new MutationObserver(updateInsets).observe($(s), { attributes: true, attributeFilter: ['class'] }));

// ───────── arranque ─────────
decorate();
setupTips();
renderPresets();
renderDock();
selectTab(ui.tab, false);
design = buildDesign(params);
viewer.setDesign(design);
viewer.setHidden(new Set(ui.hidden));
viewer.setEdges(ui.edges);
viewer.setXray(ui.xray);
if (ui.section) viewer.setSection(true);
viewer.setDimLayers(new Set(ui.dimLayers || ['general']));
viewer.view('persp', false);
renderParams(false);
renderSide();
renderReadouts();
updateInsets();
if (urlStep) openGuide(Number(urlStep) - 1);
if (fromLink) { save(); toast('Diseño cargado desde el enlace'); }
try { if (!localStorage.getItem('tabletop.seenHelp')) { helpEl.hidden = false; localStorage.setItem('tabletop.seenHelp', '1'); } } catch { /* nada */ }
