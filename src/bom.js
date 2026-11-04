import { boardUsage } from './cutlist.js';
import { PROTECTORS } from './params.js';

export const PROT_EUR_M2 = { ninguno: 0, acrilico3: 55, acrilico4: 70, acrilico5: 90, policarb4: 95, vidrio4: 120 };

// Lista de compra: material + herrajes del modelo, con precio orientativo.
export function buildBOM(d) {
  const p = d.params;
  const u = boardUsage(d);
  const items = [];
  items.push({ g: 'Material', name: `Tablero contrachapado ${p.t} mm (2440×1220)`, qty: u.boards, unit: p.plyType === 'abedul' ? 75 : 45, own: true });
  items.push({ g: 'Material', name: `Listón de pino ${p.battenW}×${p.battenH}${p.mount === 'vesa' ? ` y taco ${p.railW}×${p.railH}` : ''}`, qty: Math.ceil(u.battenM), unit: 1.6, u: 'm', own: true });
  const prot = d.pieces.find(x => x.role === 'protector');
  if (prot) { const c = prot.cut; items.push({ g: 'Material', name: `${PROTECTORS[p.protector].label} a medida ${String(c.L).replace('.', ',')}×${String(c.W).replace('.', ',')}`, qty: 1, unit: Math.round(c.L * c.W * 1e-6 * PROT_EUR_M2[p.protector]) }); }
  d.hw.forEach(h => items.push({ ...h }));
  items.forEach((it, i) => { it.key = it.g + '|' + it.name.replace(/[\d,.×x ]+/g, '').slice(0, 40); it.cost = it.qty * it.unit; });
  const total = items.reduce((s, it) => s + it.cost, 0), own = items.filter(it => it.own).reduce((s, it) => s + it.cost, 0);
  const groups = {};
  items.forEach(it => (groups[it.g] = groups[it.g] || []).push(it));
  return { items, groups, total, own };
}
