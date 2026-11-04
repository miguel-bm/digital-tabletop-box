import { buildDesign } from './model.js';
import { runCases, thermal, fmtSim as f } from './sim.js';
import { PROTECTORS, COVERS } from './params.js';
import { PROT_EUR_M2 } from './bom.js';

// Pestaña «Decisiones»: comparativas calculadas de las opciones principales y el porqué del diseño.

const eur = v => Math.round(v) + ' €';
const protCost = (k, d) => { const r = d.metrics.protRect; if (!r) return 0; return (r[2] - r[0]) * (r[3] - r[1]) * 1e-6 * PROT_EUR_M2[k]; };

export function renderDecisions(host, params, apply) {
  const base = buildDesign(params);
  let h = '';
  // protector
  h += `<div class="h-sub">Protector de pantalla</div><table class="cut cmpt"><thead><tr><th>Opción</th><th class="n">kg</th><th class="n">€</th><th class="n">Toca con</th><th class="n">Seg.</th><th></th></tr></thead><tbody>`;
  Object.keys(PROTECTORS).forEach(k => {
    const d = buildDesign({ ...params, protector: k });
    const c = runCases(d).find(x => x.id === 'protector');
    const kg = d.metrics.mass.protector;
    const defl = c.rows.length ? c.rows[0][1] : null, gap = c.rows.length ? c.rows[2][1] : null, sf = c.rows.length ? c.rows[4][1] : null;
    const touch = defl != null && defl + c.rows[1][1] > gap;
    h += `<tr class="${params.protector === k ? 'cur' : ''}" data-apply='${JSON.stringify({ protector: k })}'><td>${PROTECTORS[k].label}</td><td class="n">${f(kg)}</td><td class="n">${k === 'ninguno' ? '—' : eur(protCost(k, d))}</td><td class="n">${defl == null ? '—' : touch ? f(c.Ptouch / 9.81) + ' kg' : '> 25 kg'}</td><td class="n">${sf == null ? '—' : '×' + f(sf)}</td><td>${k === 'ninguno' ? '<i class="tag t-bad">sin</i>' : touch ? '<i class="tag t-warn">toca</i>' : '<i class="tag t-ok">libre</i>'}</td></tr>`;
  });
  h += `</tbody></table><p class="note">«Toca con»: peso apoyado en el centro (en 5 × 5 cm) con el que el protector, apoyado en el labio, llega a la pantalla. Un codo apoyado son ~25 kg. «Toca»: llega a la pantalla; reparte la carga y no rompe, pero puede dejar una aureola momentánea. El vidrio templado es lo más rígido y resistente al rayado, pero pesa el doble que el metacrilato y no se corta después. El policarbonato no se rompe nunca pero se raya con los dados.</p>`;

  // marco
  h += `<div class="h-sub">Marco</div><table class="cut cmpt"><thead><tr><th>Opción</th><th class="n">Alto</th><th class="n">kg caja</th><th>Para</th></tr></thead><tbody>`;
  [['simple', 'Simple, protector encima', 'Una sola capa; el protector cubre toda la caja y se atornilla a los postes de esquina'], ['rebaje', 'Doble con pozo', 'Protector suelto y recambiable, dados que no se escapan; una capa más'], ['pinzado', 'Simple, protector debajo', 'Lo más fino; el protector descansa casi sobre la pantalla']].forEach(([k, l, why]) => {
    const d = buildDesign({ ...params, frame: k });
    h += `<tr class="${params.frame === k ? 'cur' : ''}" data-apply='${JSON.stringify({ frame: k })}'><td>${l}</td><td class="n">${f(d.metrics.outer.H + d.metrics.y0)}</td><td class="n">${f(d.metrics.mass.total - d.metrics.mass.tv)}</td><td>${why}</td></tr>`;
  });
  h += '</tbody></table>';

  // ventilación
  const tv = [['Sin rejillas', { vents: false, baseVents: false, fans: false }], ['Rejillas', { vents: true, baseVents: true, fans: false }], ['Rejillas + ventiladores', { vents: true, baseVents: true, fans: true }]];
  h += `<div class="h-sub">Ventilación (habitación a 25 °C)</div><table class="cut cmpt"><thead><tr><th>Opción</th><th class="n">Aire dentro</th><th class="n">Pantalla</th><th></th></tr></thead><tbody>`;
  tv.forEach(([l, o]) => {
    const r = thermal(buildDesign({ ...params, ...o }));
    h += `<tr data-apply='${JSON.stringify(o)}'><td>${l}</td><td class="n">${f(r.Ti)} °C</td><td class="n">${f(r.Ts)} °C</td><td>${r.Ti < 38 ? '<i class="tag t-ok">bien</i>' : r.Ti < 42 ? '<i class="tag t-warn">justo</i>' : '<i class="tag t-bad">caliente</i>'}</td></tr>`;
  });
  h += '</tbody></table>';

  // cualitativas
  const qual = [
    ['Sujeción de la tele', [
      ['base', 'Atornillada a la base (VESA)', 'Las 4 roscas VESA van a dos costillas de punta a punta encoladas a la base: el peso baja directo a la mesa por las patas centrales, los listones no se cortan y el marco solo lleva el protector. Al abrir quitas 4 M8 más.', { mount: 'base' }],
      ['vesa', 'Travesaños VESA colgados', 'La tele cuelga del marco por sus 4 roscas: quitas la base y todo sigue en su sitio. Pide tacos colgadores y partir los listones largos.', { mount: 'vesa' }],
      ['espuma', 'Tacos de espuma', 'Más simple: la base la aprieta contra el marco. Pero al quitar la base la tele queda suelta: solo se abre boca abajo.', { mount: 'espuma' }],
    ], 'mount'],
    ['Fijación de la base', [
      ['insertos', 'Insertos M5 + tornillos', 'Cientos de montajes sin desgastar la rosca. Lo recomendable para una tapa de servicio.', { baseFix: 'insertos' }],
      ['tirafondos', 'Tornillos para madera', 'Más barato y rápido, pero la rosca en el listón se gasta tras pocos desmontajes.', { baseFix: 'tirafondos' }],
      ['magnetos', 'Imanes + 4 tornillos', 'Se abre en segundos. Atención: la rigidez a torsión depende de lo bien unida que esté la base; con imanes es menor.', { baseFix: 'magnetos' }],
    ], 'baseFix'],
    ['Uniones de esquina', [
      ['tope', 'A tope + taco', 'Lo más fácil con herramienta manual. El taco interior hace la unión; la cola en el canto ayuda poco.', { joint: 'tope' }],
      ['rebaje', 'Galce + taco', 'Más superficie de cola y la esquina se alinea sola. Necesita fresadora o sierra de mesa.', { joint: 'rebaje' }],
      ['dedos', 'Dedos (finger joint)', 'La más bonita a la vista y la más resistente; ideal con CNC o una plantilla en la sierra de mesa. No necesita tacos.', { joint: 'dedos' }],
    ], 'joint'],
    ['Fuente de imagen', [
      ['externa', 'Portátil o PC fuera', 'Lo más potente (Foundry con módulos, niebla dinámica). Sale un HDMI por el lateral y el portátil queda junto al máster.', { source: 'externa' }],
      ['stick', 'Chromecast / Fire TV Stick dentro', 'Solo sale la corriente; se envía la mesa desde el móvil o el portátil por Wi-Fi. Algo de retraso y menos calidad en mapas grandes.', { source: 'stick' }],
      ['minipc', 'Raspberry Pi dentro', 'Autónoma: abre Owlbear o Foundry en el navegador de la Pi. Suma 5–10 W de calor y necesita ~34 mm bajo la tele.', { source: 'minipc' }],
    ], 'source'],
    ['Salida de cables', [
      ['pasamuros', 'Pasamuros', 'Dos agujeros con goma o cepillo. Barato; los cables quedan siempre conectados a la tele.', { cable: 'pasamuros' }],
      ['panel', 'Conectores de panel', 'Base IEC y HDMI hembra en el lateral: la caja se lleva sin cables colgando y se enchufa como un aparato. Lo más limpio.', { cable: 'panel' }],
      ['ranura', 'Ranura en el canto', 'No hace falta pasar el conector por un agujero: el cable entra por abajo y la base lo pinza.', { cable: 'ranura' }],
    ], 'cable'],
  ];
  qual.forEach(([title, opts, key]) => {
    h += `<div class="h-sub">${title}</div><div class="opts">${opts.map(([k, l, txt, o]) => `<button class="opt ${params[key] === k ? 'on' : ''}" data-apply='${JSON.stringify(o)}'><b>${l}</b><span>${txt}</span></button>`).join('')}</div>`;
  });

  // revestimientos
  h += `<div class="h-sub">Revestimiento</div><table class="cut cmpt"><thead><tr><th>Opción</th><th class="n">€/m²</th><th class="n">Roce</th><th class="n">Facilidad</th></tr></thead><tbody>`;
  const cv = { tolex: [22, 5, 4], polipiel: [14, 4, 3], terciopelo: [12, 2, 3], fieltro: [9, 2, 5], corcho: [10, 3, 2], pintura: [4, 2, 4], ninguno: [0, 3, 5] };
  Object.entries(COVERS).forEach(([k, c]) => { const [e, r, fa] = cv[k]; h += `<tr class="${params.cover === k ? 'cur' : ''}" data-apply='${JSON.stringify({ cover: k })}'><td>${c.label}</td><td class="n">${e || '—'}</td><td class="n">${'●'.repeat(r)}${'○'.repeat(5 - r)}</td><td class="n">${'●'.repeat(fa)}${'○'.repeat(5 - fa)}</td></tr>`; });
  h += '</tbody></table>';

  // por qué así
  const m = base.metrics;
  h += `<div class="h-sub">Por qué está diseñada así</div><ul class="why">
    <li><b>La base es la trasera de la tele</b> y la única tapa que se quita: así se monta todo boca abajo (la tele entra por detrás y apoya la pantalla sobre el burlete del marco) y luego se accede a cables sin tocar el marco ni las paredes, que van encolados.</li>
    <li><b>El asa va en el canto superior de la tele</b>: llevándola de pie, la tele viaja en su posición natural y su peso ${params.mount === 'base' ? 'pasa por los 4 tornillos VESA a las costillas de la base, que está atornillada a todo el perímetro' : 'cuelga de los travesaños hacia los tacos del frente, no del panel'}.</li>
    ${params.mount === 'base' ? `<li><b>La tele atornillada a la base por el VESA</b>: dos costillas de ${params.railW} mm de punta a punta reparten las 4 roscas y rigidizan la base; con las patas centrales el peso de la tele (y de quien se apoye) va directo a la mesa. Los listones del perímetro quedan enteros.</li>` : ''}
    ${params.frame === 'simple' ? `<li><b>Una sola capa de marco y postes en las esquinas</b>: el marco cierra la caja por arriba (sin él la torsión se dispara, ver Cálculos) pero basta una capa; el protector va encima, a ${(m.protY - m.yS).toFixed(0)} mm de la pantalla, atornillado a los cuatro postes.</li>` : ''}
    <li><b>Paredes de ${m.wallH.toFixed(0)} mm con listones</b>: un canto de ${params.t} mm no agarra tornillos; los listones de ${params.battenW}×${params.battenH} dan rosca a la base y superficie de cola.</li>
    <li><b>Cámara perimetral de ${params.margin} mm</b>: espacio para ${params.mount === 'vesa' ? 'los tacos colgadores, ' : 'los postes de esquina, '}los cables y el aire, y un marco visible de ~${(m.op1[0] + m.X / 2).toFixed(0)} mm donde apoyar las manos.</li>
    <li><b>Marco negro mate</b>: cualquier borde claro alrededor de una pantalla luminosa se refleja y cansa la vista; el labio interior va siempre pintado.</li>
    <li><b>Torsión</b>: una caja con una ventana enorme arriba es blanda al alabeo; la base, atornillada cada ~${(2 * (m.innerX + m.innerZ) / params.baseScrews).toFixed(0)} mm, cierra la caja y la rigidiza (ver Cálculos).</li>
    <li><b>Rejilla de 1"</b>: a ${m.inchPx.toFixed(1)} px por pulgada caben ${m.gridCells[0]} × ${m.gridCells[1]} casillas, un mapa de mazmorra de buen tamaño a escala de miniatura.</li>
  </ul>`;
  host.innerHTML = h;
  host.querySelectorAll('[data-apply]').forEach(el => el.addEventListener('click', () => apply(JSON.parse(el.dataset.apply))));
}
