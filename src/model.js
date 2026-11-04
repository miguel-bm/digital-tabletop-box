import { PLY, PROTECTORS, COVERS } from './params.js';

// Modelo puro: a partir de los parámetros genera piezas (sólidos planos con huecos),
// herrajes, cotas de referencia, métricas y avisos. Ejes: X largo, Z corto (+Z = canto
// inferior de la tele, hacia el jugador), Y arriba. Unidades: mm.

const r1 = v => Math.round(v * 10) / 10;

export function buildDesign(p) {
  const t = p.t;
  const prot = PROTECTORS[p.protector] || PROTECTORS.ninguno;
  const pt = prot.t;
  const ply = PLY[p.plyType] || PLY.abedul;
  const pieces = [];
  const fixtures = [];
  const warnings = [];
  const hw = [];
  const warn = (level, text) => warnings.push({ level, text });
  const add = (pc) => { pieces.push(pc); return pc; };

  // ── huecos y cotas horizontales ──
  const g = p.fit + p.margin;
  const portRight = p.portSide !== 'izquierda';
  const gR = g + (portRight ? p.portBay : 0), gL = g + (portRight ? 0 : p.portBay);
  const innerX = p.tvW + gL + gR, innerZ = p.tvH + 2 * g;
  const X = innerX + 2 * t, Z = innerZ + 2 * t;
  const xi0 = -innerX / 2, xi1 = innerX / 2, zi0 = -innerZ / 2, zi1 = innerZ / 2;
  const xo0 = -X / 2, xo1 = X / 2, zo0 = -Z / 2, zo1 = Z / 2;
  const tv = { x0: xi0 + gL, x1: xi0 + gL + p.tvW, z0: zi0 + g, z1: zi1 - g };
  tv.cx = (tv.x0 + tv.x1) / 2; tv.cz = 0;
  const scr = { x0: tv.cx - p.screenW / 2, x1: tv.cx + p.screenW / 2, z1: tv.z1 - p.bezelBottom };
  scr.z0 = scr.z1 - p.screenH;
  const bezelTop = scr.z0 - tv.z0, bezelSide = (p.tvW - p.screenW) / 2;

  // ── niveles ──
  const y0 = p.footH;
  const yBaseTop = y0 + t;
  const mountGap = p.gapBelow;
  const yB = yBaseTop + mountGap;           // dorso de la joroba
  const yS = yB + p.tvD;                    // cara de la pantalla
  const yRim = yS - p.tvRimD;               // dorso del borde fino
  const twoLayer = p.frame === 'rebaje';
  const protUnder = !twoLayer && pt > 0;
  const yF = yS + (protUnder ? pt : 0) + p.gasket;   // cara inferior del marco
  const layers = twoLayer ? 2 : 1;
  const yTop = yF + layers * t;
  const H = yTop - y0;                      // alto de la caja (sin patas)
  const wallH = yF - y0;

  // ── aberturas del marco ──
  const op1 = [scr.x0 - p.reveal, scr.z0 - p.reveal, scr.x1 + p.reveal, scr.z1 + p.reveal];
  let protRect = null, op2 = null;
  if (pt > 0) {
    if (twoLayer) {
      protRect = [op1[0] - p.protOverlap, op1[1] - p.protOverlap, op1[2] + p.protOverlap, op1[3] + p.protOverlap];
      op2 = [protRect[0] - 1, protRect[1] - 1, protRect[2] + 1, protRect[3] + 1];
    } else {
      protRect = [tv.x0 + 1, tv.z0 + 1, tv.x1 - 1, tv.z1 - 1];
    }
  } else if (twoLayer) {
    op2 = [op1[0] - p.protOverlap, op1[1] - p.protOverlap, op1[2] + p.protOverlap, op1[3] + p.protOverlap];
  }

  const ring = (o, op) => Math.min(op[0] - o[0], op[1] - o[1], o[2] - op[2], o[3] - op[3]);
  const outerRect = [xo0, zo0, xo1, zo1];
  const ring1 = ring(outerRect, op1);
  const ring2 = op2 ? ring(outerRect, op2) : null;

  // ── uniones de esquina ──
  // Las paredes largas (frente/fondo) van de punta a punta; las laterales entre ellas.
  const fingers = p.joint === 'dedos';
  const rabbet = p.joint === 'rebaje';
  const nF = Math.max(3, Math.round(wallH / 18) | 1);   // número impar de dedos
  const fingerCuts = (uStart, uEnd, invert) => {
    const cuts = [], h = wallH / nF;
    for (let i = 0; i < nF; i++) {
      const isCut = invert ? i % 2 === 0 : i % 2 === 1;
      if (isCut) cuts.push([uStart, y0 + i * h, uEnd, y0 + (i + 1) * h]);
    }
    return cuts;
  };

  const wallHoles = { back: [], front: [], left: [], right: [] };
  const wallNotches = { back: [], front: [], left: [], right: [] };
  const portWall = portRight ? 'right' : 'left';
  const midY = (a, b) => (a + b) / 2;

  // salida de cables (en la pared lateral del lado de conexiones; u = z)
  const cy = y0 + t + (wallH - t) * p.cableY;
  const cz = [tv.cz - innerZ * 0.18, tv.cz + innerZ * 0.12];
  const cableZones = [];
  if (p.cable === 'pasamuros') {
    cz.forEach(z => { wallHoles[portWall].push({ circle: [z, cy, p.cableDia / 2], tag: 'Pasamuros Ø' + p.cableDia }); cableZones.push([z - p.cableDia / 2, z + p.cableDia / 2]); });
  } else if (p.cable === 'panel') {
    wallHoles[portWall].push({ rect: [cz[0] - 13.75, cy - 9.9, cz[0] + 13.75, cy + 9.9], tag: 'Hueco IEC C14 27,5×19,8' });
    wallHoles[portWall].push({ circle: [cz[0] - 20, cy, 1.6] }, { circle: [cz[0] + 20, cy, 1.6] });
    wallHoles[portWall].push({ rect: [cz[1] - 11, cy - 7.5, cz[1] + 11, cy + 7.5], tag: 'Hueco HDMI de panel 22×15' });
    wallHoles[portWall].push({ circle: [cz[1] - 15, cy, 1.6] }, { circle: [cz[1] + 15, cy, 1.6] });
    cz.forEach(z => cableZones.push([z - 25, z + 25]));
  } else {
    const nh = Math.min(wallH - t - 6, t + p.cableDia * 0.8);
    cz.forEach(z => { wallNotches[portWall].push([z - p.cableDia / 2, y0 - 1, z + p.cableDia / 2, y0 + nh]); cableZones.push([z - p.cableDia / 2 - 3, z + p.cableDia / 2 + 3]); });
  }

  // ventilación: ranuras verticales en la pared del fondo (salida, parte alta)
  const fanX = [tv.cx - innerX * 0.26, tv.cx + innerX * 0.26];
  const battenTop = yBaseTop + p.battenH;
  const freeH = yF - battenTop;
  if (p.fans) {
    if (freeH < 62) warn('warn', `Los ventiladores de 60 mm no caben entre el listón inferior y el marco (hay ${r1(freeH)} mm). Sube el hueco bajo la tele o usa ventiladores de 40 mm.`);
    const fy = battenTop + Math.max(31, freeH / 2);
    fanX.forEach(x => {
      wallHoles.back.push({ circle: [x, fy, 28.5], tag: 'Ventilador 60 mm' });
      [[-25, -25], [25, -25], [-25, 25], [25, 25]].forEach(([dx, dy]) => wallHoles.back.push({ circle: [x + dx, fy + dy, 2] }));
    });
  }
  if (p.vents) {
    const n = p.ventCount, sw = 8, sh = Math.max(12, Math.min(48, (yF - battenTop) - 18));
    const span = innerX * 0.62, yv0 = yF - 8 - sh;
    for (let i = 0; i < n; i++) {
      const x = tv.cx - span / 2 + (span * (i + 0.5)) / n;
      if (p.fans && fanX.some(f => Math.abs(f - x) < 45)) continue;
      if (p.handle === 'maleta' && Math.abs(x) < 90) continue;
      if (p.handle === 'embutida' && Math.abs(x) < 100) continue;
      wallHoles.back.push({ slot: [x - sw / 2, yv0, x + sw / 2, yv0 + sh], tag: 'Ranura ventilación' });
    }
  }
  // altavoces (disparan hacia el canto inferior de la tele: pared frontal)
  if (p.speakerSlots) {
    const ys0 = Math.max(battenTop + 4, yRim - 14), ys1 = Math.min(yF - 6, yS - 2);
    const hh = ys1 - ys0;
    if (hh > 10) {
      const rows = Math.max(1, Math.floor(hh / 11));
      [tv.cx - p.tvW * 0.32, tv.cx + p.tvW * 0.32].forEach(x => {
        for (let k = 0; k < rows; k++) {
          const yc = ys0 + hh * (k + 0.5) / rows;
          wallHoles.front.push({ slot: [x - 55, yc - 2.5, x + 55, yc + 2.5], tag: 'Rejilla altavoz' });
        }
      });
    }
  }
  // asas
  const dishD = 28;
  if (p.handle === 'maleta') {
    [-60, 60].forEach(x => wallHoles.back.push({ circle: [x, midY(battenTop, yF), 3.2], tag: 'Taladro Ø6,5 asa' }));
  } else if (p.handle === 'embutida') {
    const hh = Math.min(56, wallH - 34);
    wallHoles.back.push({ rect: [-70, midY(battenTop, yF) - hh / 2, 70, midY(battenTop, yF) + hh / 2], tag: 'Hueco asa embutida 140×' + r1(hh) });
    if (g < dishD + 2) warn('warn', `El cazo del asa embutida (${dishD} mm) choca con la tele: el margen interior es de ${r1(g)} mm. Sube el margen a ${dishD + 3} mm o usa asa de maleta.`);
  } else if (p.handle === 'laterales') {
    const hh = Math.min(50, wallH - 34);
    ['left', 'right'].forEach(w => wallHoles[w].push({ rect: [-60, midY(battenTop, yF) - hh / 2, 60, midY(battenTop, yF) + hh / 2], tag: 'Hueco asa embutida 120×' + r1(hh) }));
    const gs = Math.min(gL, gR);
    if (gs < dishD + 2) warn('warn', `Las asas laterales embutidas necesitan ~${dishD + 2} mm libres a los lados de la tele; hay ${r1(gs)} mm.`);
  }

  // ── paredes ──
  const longNotch = (side) => {
    const n = [];
    if (fingers) {
      n.push(...fingerCuts(xo0 - 1, xo0 + t, false), ...fingerCuts(xo1 - t, xo1 + 1, false));
    }
    return n.concat(wallNotches[side]);
  };
  const shortNotch = (side) => {
    const n = [];
    if (fingers) n.push(...fingerCuts(zo0 - 1, zo0 + t, true), ...fingerCuts(zo1 - t, zo1 + 1, true));
    return n.concat(wallNotches[side]);
  };
  const wallSolidsLong = (z0, z1, side) => {
    if (rabbet) {
      const inner = side === 'back' ? [z0 + t / 2, z1] : [z0, z1 - t / 2];
      const outer = side === 'back' ? [z0, z0 + t / 2] : [z1 - t / 2, z1];
      return [
        { plane: 'XY', rect: [xo0, y0, xo1, yF], t: outer, holes: wallHoles[side], notches: wallNotches[side] },
        { plane: 'XY', rect: [xo0 + t / 2, y0, xo1 - t / 2, yF], t: inner, holes: wallHoles[side], notches: wallNotches[side] },
      ];
    }
    return [{ plane: 'XY', rect: [xo0, y0, xo1, yF], t: [z0, z1], holes: wallHoles[side], notches: longNotch(side) }];
  };
  const shortSpan = fingers ? [zo0, zo1] : rabbet ? [zo0 + t / 2, zo1 - t / 2] : [zi0, zi1];
  add({ id: 'W1', key: 'back', name: 'Pared del fondo (lado asa)', role: 'pared', mat: 'ply', step: 'caja',
    solids: wallSolidsLong(zo0, zo0 + t, 'back'), explode: [0, 0, -170] });
  add({ id: 'W2', key: 'front', name: 'Pared frontal (lado jugador)', role: 'pared', mat: 'ply', step: 'caja',
    solids: wallSolidsLong(zo1 - t, zo1, 'front'), explode: [0, 0, 170] });
  add({ id: 'W3', key: 'left', name: 'Lateral izquierdo' + (portRight ? '' : ' (cables)'), role: 'pared', mat: 'ply', step: 'caja',
    solids: [{ plane: 'YZ', rect: [shortSpan[0], y0, shortSpan[1], yF], t: [xo0, xo0 + t], holes: wallHoles.left, notches: shortNotch('left') }], explode: [-190, 0, 0] });
  add({ id: 'W4', key: 'right', name: 'Lateral derecho' + (portRight ? ' (cables)' : ''), role: 'pared', mat: 'ply', step: 'caja',
    solids: [{ plane: 'YZ', rect: [shortSpan[0], y0, shortSpan[1], yF], t: [xo1 - t, xo1], holes: wallHoles.right, notches: shortNotch('right') }], explode: [190, 0, 0] });

  // ── marco ──
  const frameMat = p.frameFinish === 'madera' ? 'plyFinish' : p.frameFinish === 'negro' ? 'black' : 'cover';
  add({ id: 'F1', key: 'frame1', name: twoLayer ? 'Marco · capa inferior (labio)' : 'Marco', role: 'marco', mat: twoLayer ? 'black' : frameMat, step: 'marco',
    solids: [{ plane: 'XZ', rect: outerRect, t: [yF, yF + t], holes: [{ rect: op1 }] }], explode: [0, 200, 0] });
  if (twoLayer) {
    add({ id: 'F2', key: 'frame2', name: 'Marco · capa superior (pozo)', role: 'marco', mat: frameMat, step: 'marco2',
      solids: [{ plane: 'XZ', rect: outerRect, t: [yF + t, yF + 2 * t], holes: [{ rect: op2 }] }], explode: [0, 280, 0] });
  }
  if (ring1 < 22) warn('warn', `El marco queda muy estrecho (${r1(ring1)} mm en su lado más fino): frágil al cortar y manipular. Aumenta el margen interior.`);
  if (ring2 !== null && ring2 < 18) warn('warn', `La capa superior del marco queda de ${r1(ring2)} mm en su lado más fino. Aumenta el margen o reduce el apoyo del protector.`);
  if (protRect && twoLayer && (protRect[0] < xi0 + 2 || protRect[2] > xi1 - 2 || protRect[1] < zi0 + 2 || protRect[3] > zi1 - 2)) {
    // el protector apoya sobre la capa 1 por fuera de la pared interior: correcto pero lo anotamos
  }

  // ── base extraíble ──
  const bc = 0.5;
  const baseRect = [xi0 + bc, zi0 + bc, xi1 - bc, zi1 - bc];
  const baseHoles = [];
  if (p.baseVents) {
    const nx = 9, nz = 3, bw = p.bumpW * 0.8, cxv = tv.cx, z0v = tv.z1 - 70;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = cxv - bw / 2 + (bw * (i + 0.5)) / nx;
      if (p.mount === 'vesa' && Math.abs(x - (tv.cx + p.vesaDx)) - p.vesa / 2 < p.railW / 2 + 8 && Math.abs(Math.abs(x - (tv.cx + p.vesaDx)) - p.vesa / 2) < p.railW / 2 + 8) continue;
      baseHoles.push({ circle: [x, z0v - j * 22, 6], tag: 'Ventilación Ø12' });
    }
  }

  // ── travesaños VESA y tacos colgadores ──
  const vx = tv.cx + p.vesaDx, vz = tv.cz + p.vesaDz;
  const railX = [vx - p.vesa / 2, vx + p.vesa / 2];
  const hangerW = Math.min(p.hangerW, g - 1);
  const railGaps = [];
  const railOverlapsBatten = p.mount === 'vesa' && (mountGap - p.railH) < p.battenH;
  if (p.mount === 'vesa') {
    if (mountGap < p.railH + 1) warn('error', `El travesaño VESA (${p.railH} mm) no cabe bajo la tele: el hueco es de ${mountGap} mm. Súbelo a ${p.railH + 2} mm.`);
    if (g - 1 < p.hangerW) warn('warn', `Los tacos colgadores se recortan a ${r1(hangerW)} mm de fondo porque el margen interior es de ${r1(g)} mm.`);
    if (hangerW < 10) warn('error', 'No hay sitio para los tacos colgadores de los travesaños: aumenta el margen interior (≥ 12 mm).');
    railX.forEach((x, i) => {
      const holes = [-1, 1].map(s => ({ circle: [vz + s * p.vesa / 2, 0, 4.5], tag: 'Taladro Ø9 VESA M8' }));
      add({ id: 'R' + (i + 1), key: 'rail' + i, name: 'Travesaño VESA ' + (i ? 'derecho' : 'izquierdo'), role: 'travesano', mat: 'batten', step: 'tv',
        solids: [{ plane: 'YZ', rect: [zi0 + 0.5, yB - p.railH, zi1 - 0.5, yB], t: [x - p.railW / 2, x + p.railW / 2], holes: [] }],
        cut: { L: innerZ - 1, W: p.railW, T: p.railH, stock: 'taco', notes: `2 taladros Ø9 a ${p.vesa} mm (VESA) · 2 taladros Ø5,5 en los extremos` },
        drill: [...holes.map(h => h.circle), [zi0 + hangerW / 2, 0, 2.75], [zi1 - hangerW / 2, 0, 2.75]], explode: [0, -40, 0] });
      [zi0, zi1 - hangerW].forEach((z, k) => add({ id: 'H' + (i * 2 + k + 1), key: 'hanger' + i + k, name: 'Taco colgador ' + (k ? 'frontal' : 'del fondo') + ' ' + (i ? 'der.' : 'izq.'), role: 'taco', mat: 'batten', step: 'tacos',
        solids: [{ plane: 'XY', rect: [x - p.railW / 2, yB, x + p.railW / 2, yF], t: [z, z + hangerW] }],
        cut: { L: r1(yF - yB), W: p.railW, T: r1(hangerW), stock: 'taco', notes: 'Inserto M5 en la cara inferior · encolar a pared y marco' }, explode: [0, 60, k ? 60 : -60] }));
      railGaps.push([x - p.railW / 2 - 3, x + p.railW / 2 + 3]);
    });
    hw.push({ g: 'TV', name: 'Tornillo M8 × ' + (p.railH + 12) + ' (VESA) + arandela ancha', qty: 4, unit: 0.4 });
    hw.push({ g: 'TV', name: 'Inserto roscado M5 (tacos colgadores)', qty: 4, unit: 0.35 });
    hw.push({ g: 'TV', name: 'Tornillo M5 × ' + (p.railH + 12) + ' avellanado (travesaño → taco)', qty: 4, unit: 0.15 });
  } else {
    // tacos de espuma sobre la base
    const fw = 80, fd = 60;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
      const x = tv.cx + sx * p.bumpW * 0.35, z = p.bumpDz + sz * p.bumpH * 0.3;
      add({ id: 'E' + (i + 1), key: 'foam' + i, name: 'Taco de espuma EVA', role: 'espuma', mat: 'foam', step: 'tv',
        solids: [{ plane: 'XZ', rect: [x - fw / 2, z - fd / 2, x + fw / 2, z + fd / 2], t: [yBaseTop, yB] }],
        cut: { L: fw, W: fd, T: mountGap, stock: 'espuma', notes: 'EVA o goma espuma de alta densidad, pegada a la base' }, explode: [0, -60, 0] });
    });
    hw.push({ g: 'TV', name: 'Plancha EVA alta densidad ' + mountGap + ' mm (4 tacos 80×60)', qty: 1, unit: 6 });
  }

  // ── listones inferiores (apoyo y roscas de la base) ──
  const bw = p.battenW, bh = p.battenH;
  const splitRanges = (a, b, gaps) => {
    let segs = [[a, b]];
    gaps.forEach(([g0, g1]) => {
      segs = segs.flatMap(([s0, s1]) => (g1 <= s0 || g0 >= s1) ? [[s0, s1]] : [[s0, g0], [g1, s1]].filter(([u, v]) => v - u > 20));
    });
    return segs;
  };
  let bi = 0;
  const battens = [];
  ['back', 'front'].forEach((side) => {
    const z = side === 'back' ? [zi0, zi0 + bw] : [zi1 - bw, zi1];
    splitRanges(xi0, xi1, railOverlapsBatten ? railGaps : []).forEach(([a, b]) => {
      bi++;
      battens.push(add({ id: 'L' + bi, key: 'batten' + bi, name: 'Listón inferior ' + (side === 'back' ? 'fondo' : 'frente'), role: 'liston', mat: 'batten', step: 'listones',
        solids: [{ plane: 'XY', rect: [a, yBaseTop, b, yBaseTop + bh], t: z }],
        cut: { L: r1(b - a), W: bw, T: bh, stock: 'taco', notes: 'Encolar y atornillar desde fuera · insertos M5 para la base' }, explode: [0, -30, side === 'back' ? -120 : 120] }));
    });
  });
  ['left', 'right'].forEach(side => {
    const x = side === 'left' ? [xi0, xi0 + bw] : [xi1 - bw, xi1];
    const gaps = side === portWall && p.cable === 'ranura' ? cableZones : [];
    splitRanges(zi0 + bw, zi1 - bw, gaps).forEach(([a, b]) => {
      bi++;
      battens.push(add({ id: 'L' + bi, key: 'batten' + bi, name: 'Listón inferior ' + (side === 'left' ? 'izq.' : 'der.'), role: 'liston', mat: 'batten', step: 'listones',
        solids: [{ plane: 'YZ', rect: [a, yBaseTop, b, yBaseTop + bh], t: x }],
        cut: { L: r1(b - a), W: bw, T: bh, stock: 'taco', notes: 'Encolar y atornillar desde fuera' }, explode: [side === 'left' ? -140 : 140, -30, 0] }));
    });
  });

  // tacos verticales de esquina
  if (p.cornerBlocks) {
    const cb = Math.min(bw, 30);
    [[xi0, zi0], [xi1 - cb, zi0], [xi0, zi1 - cb], [xi1 - cb, zi1 - cb]].forEach(([x, z], i) => add({
      id: 'C' + (i + 1), key: 'corner' + i, name: 'Taco de esquina', role: 'taco', mat: 'batten', step: 'caja',
      solids: [{ plane: 'XY', rect: [x, yBaseTop + bh, x + cb, yF], t: [z, z + cb] }],
      cut: { L: r1(yF - yBaseTop - bh), W: cb, T: cb, stock: 'taco', notes: 'Encolar a las dos paredes y al marco' },
      explode: [(x < 0 ? -1 : 1) * 150, 20, (z < 0 ? -1 : 1) * 150] }));
    if (Math.min(gL, gR, g) < cb && yRim < yF) warn('warn', `Los tacos de esquina (${cb} mm) invaden las esquinas de la tele: el margen es de ${r1(Math.min(gL, gR, g))} mm. Achaflánalos o súbelos de margen.`);
  }

  // refuerzo interior del asa
  if (p.handle === 'maleta') {
    const d = Math.min(bw, g - 1);
    add({ id: 'A1', key: 'handleBlock', name: 'Contraplaca del asa', role: 'taco', mat: 'batten', step: 'caja',
      solids: [{ plane: 'XY', rect: [-80, battenTop, 80, yF], t: [zi0, zi0 + d] }],
      cut: { L: 160, W: r1(yF - battenTop), T: r1(d), stock: 'taco', notes: '2 taladros Ø6,5 pasantes + tuercas de garra M6' }, explode: [0, 30, -90] });
  }

  // base
  const screwPts = [];
  {
    const perim = [];
    // recorridos por el eje de los listones
    const off = bw / 2;
    perim.push({ a: [xi0 + off, zi0 + off], b: [xi1 - off, zi0 + off] }, { a: [xi1 - off, zi0 + off], b: [xi1 - off, zi1 - off] },
      { a: [xi1 - off, zi1 - off], b: [xi0 + off, zi1 - off] }, { a: [xi0 + off, zi1 - off], b: [xi0 + off, zi0 + off] });
    const total = perim.reduce((s, e) => s + Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), 0);
    const n = p.baseFix === 'magnetos' ? 4 : p.baseScrews;
    for (let i = 0; i < n; i++) {
      let d = (total * (i + 0.5)) / n;
      for (const e of perim) {
        const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
        if (d <= L) {
          let x = e.a[0] + (e.b[0] - e.a[0]) * d / L, z = e.a[1] + (e.b[1] - e.a[1]) * d / L;
          // evita los huecos del listón
          if (railOverlapsBatten && Math.abs(e.a[1] - e.b[1]) < 1) railGaps.forEach(([g0, g1]) => { if (x > g0 - 10 && x < g1 + 10) x = (x - g0 < g1 - x) ? g0 - 14 : g1 + 14; });
          screwPts.push([x, z]); break;
        }
        d -= L;
      }
    }
    screwPts.forEach(([x, z]) => baseHoles.push({ circle: [x, z, 2.75], tag: 'Taladro Ø5,5 avellanado' }));
  }
  add({ id: 'B1', key: 'base', name: 'Base extraíble (trasera de la tele)', role: 'base', mat: 'ply', step: 'base',
    solids: [{ plane: 'XZ', rect: baseRect, t: [y0, y0 + t], holes: baseHoles }], explode: [0, -200, 0] });

  // ── protector ──
  if (protRect) {
    const y = twoLayer ? yF + t : yS;
    add({ id: 'P1', key: 'protector', name: prot.label, role: 'protector', mat: prot.mat, step: twoLayer ? 'protector' : 'tv',
      solids: [{ plane: 'XZ', rect: protRect, t: [y, y + pt] }],
      cut: { L: r1(protRect[2] - protRect[0]), W: r1(protRect[3] - protRect[1]), T: pt, stock: 'protector', notes: 'Cantos pulidos, esquinas R3' }, explode: [0, twoLayer ? 340 : 120, 0] });
  }

  // ── televisor ──
  add({ id: 'TV', key: 'tv', name: 'Samsung UE43M5575AU', role: 'tv', mat: 'tv', step: 'tv', tv: {
    x0: tv.x0, x1: tv.x1, z0: tv.z0, z1: tv.z1, yB, yS, yRim, scr, bump: { w: p.bumpW, h: p.bumpH, cx: tv.cx, cz: p.bumpDz }, vesa: { x: vx, z: vz, s: p.vesa },
  }, explode: [0, 110, 0] });

  // burlete
  const gk = p.gasket;
  if (gk > 0) {
    const gy = yF - gk, gw = 8;
    const gr = [tv.x0 + 1, tv.z0 + 1, tv.x1 - 1, tv.z1 - 1];
    add({ id: 'G1', key: 'gasket', name: 'Burlete EPDM ' + gw + '×' + gk, role: 'burlete', mat: 'foam', step: 'burlete',
      solids: [{ plane: 'XZ', rect: gr, t: [gy, yF], holes: [{ rect: [gr[0] + gw, gr[1] + gw, gr[2] - gw, gr[3] - gw] }] }], explode: [0, 150, 0] });
  }

  // ── revestimiento exterior ──
  const cover = COVERS[p.cover] || COVERS.ninguno;
  const ct = p.cover === 'ninguno' ? 0 : p.coverT;
  if (ct > 0) {
    const xs = [xo0 - ct, xo1 + ct];
    add({ id: 'K1', key: 'skinBack', name: 'Revestimiento fondo', role: 'piel', mat: 'cover', step: 'piel', skin: true,
      solids: [{ plane: 'XY', rect: [xs[0], y0, xs[1], yTop], t: [zo0 - ct, zo0], holes: wallHoles.back, notches: wallNotches.back }], explode: [0, 0, -260] });
    add({ id: 'K2', key: 'skinFront', name: 'Revestimiento frente', role: 'piel', mat: 'cover', step: 'piel', skin: true,
      solids: [{ plane: 'XY', rect: [xs[0], y0, xs[1], yTop], t: [zo1, zo1 + ct], holes: wallHoles.front, notches: wallNotches.front }], explode: [0, 0, 260] });
    add({ id: 'K3', key: 'skinLeft', name: 'Revestimiento lateral izq.', role: 'piel', mat: 'cover', step: 'piel', skin: true,
      solids: [{ plane: 'YZ', rect: [zo0, y0, zo1, yTop], t: [xo0 - ct, xo0], holes: wallHoles.left, notches: wallNotches.left }], explode: [-280, 0, 0] });
    add({ id: 'K4', key: 'skinRight', name: 'Revestimiento lateral der.', role: 'piel', mat: 'cover', step: 'piel', skin: true,
      solids: [{ plane: 'YZ', rect: [zo0, y0, zo1, yTop], t: [xo1, xo1 + ct], holes: wallHoles.right, notches: wallNotches.right }], explode: [280, 0, 0] });
    if (p.frameFinish === 'mismo') {
      add({ id: 'K5', key: 'skinTop', name: 'Revestimiento del marco', role: 'piel', mat: 'cover', step: 'piel', skin: true,
        solids: [{ plane: 'XZ', rect: [xo0 - ct, zo0 - ct, xo1 + ct, zo1 + ct], t: [yTop, yTop + ct], holes: [{ rect: twoLayer ? op2 : op1 }] }], explode: [0, 360, 0] });
    }
  }
  const outer = { X: X + 2 * ct, Z: Z + 2 * ct, H: H + (p.frameFinish === 'mismo' ? ct : 0) };

  // ── herrajes visibles ──
  if (p.footH > 0) {
    const nf = Number(p.feet), cols = nf / 2;
    for (let i = 0; i < cols; i++) for (const z of [zi0 + 45, zi1 - 45]) {
      const x = xi0 + 45 + (innerX - 90) * (cols === 1 ? 0.5 : i / (cols - 1));
      fixtures.push({ kind: 'foot', pos: [x, 0, z], h: p.footH, r: 11, step: 'base' });
    }
    hw.push({ g: 'Base', name: `Pata de goma Ø22 × ${p.footH} con tornillo`, qty: nf, unit: 0.5 });
  }
  if (p.handle === 'maleta') {
    fixtures.push({ kind: 'handle', pos: [0, midY(battenTop, yF), zo0 - ct], span: 120, step: 'remate' });
    hw.push({ g: 'Transporte', name: 'Asa de maleta / amplificador 120 mm entre ejes', qty: 1, unit: 9 });
    hw.push({ g: 'Transporte', name: 'Tornillo M6 × 40 + tuerca de garra (asa)', qty: 2, unit: 0.6 });
  } else if (p.handle === 'embutida') {
    fixtures.push({ kind: 'dish', pos: [0, midY(battenTop, yF), zo0 - ct], w: 160, h: Math.min(76, wallH - 14), d: dishD, axis: 'z', sgn: 1, step: 'remate' });
    hw.push({ g: 'Transporte', name: 'Asa embutida tipo flight-case (cazo ' + dishD + ' mm)', qty: 1, unit: 12 });
  } else if (p.handle === 'laterales') {
    fixtures.push({ kind: 'dish', pos: [xo0 - ct, midY(battenTop, yF), 0], w: 140, h: Math.min(70, wallH - 14), d: dishD, axis: 'x', sgn: 1, step: 'remate' });
    fixtures.push({ kind: 'dish', pos: [xo1 + ct, midY(battenTop, yF), 0], w: 140, h: Math.min(70, wallH - 14), d: dishD, axis: 'x', sgn: -1, step: 'remate' });
    hw.push({ g: 'Transporte', name: 'Asa embutida pequeña (cazo ' + dishD + ' mm)', qty: 2, unit: 8 });
  }
  if (p.corners) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const top of [0, 1]) {
      fixtures.push({ kind: 'corner', pos: [sx * (X / 2 + ct), top ? y0 + outer.H : y0, sz * (Z / 2 + ct)], s: [sx, top ? -1 : 1, sz], step: 'remate' });
    }
    hw.push({ g: 'Transporte', name: 'Cantonera metálica de maleta 30 mm', qty: 8, unit: 1.2 });
  }
  if (p.standFeet) {
    [-1, 1].forEach(s => fixtures.push({ kind: 'bumper', pos: [s * (X / 2 - 90), y0 + H / 2, zo1 + ct], step: 'remate' }));
    hw.push({ g: 'Transporte', name: 'Tope de goma Ø20 (para dejarla de pie)', qty: 2, unit: 0.4 });
  }
  if (p.fans) {
    fanX.forEach(x => fixtures.push({ kind: 'fan', pos: [x, battenTop + Math.max(31, freeH / 2), zo0 + t], step: 'tv' }));
    hw.push({ g: 'Aire', name: 'Ventilador 60×60×15 USB 5 V (silencioso)', qty: 2, unit: 9 });
    hw.push({ g: 'Aire', name: 'Rejilla metálica 60 mm + 4 tornillos M3', qty: 2, unit: 1 });
  }
  if (p.cable === 'panel') {
    fixtures.push({ kind: 'iec', pos: [portRight ? xo1 + ct : xo0 - ct, cy, cz[0]], sgn: portRight ? 1 : -1, step: 'cables' });
    fixtures.push({ kind: 'hdmi', pos: [portRight ? xo1 + ct : xo0 - ct, cy, cz[1]], sgn: portRight ? 1 : -1, step: 'cables' });
    hw.push({ g: 'Cables', name: 'Base IEC C14 de panel con fusible (y opcional interruptor)', qty: 1, unit: 4 });
    hw.push({ g: 'Cables', name: 'Alargo HDMI macho–hembra de panel (30 cm)', qty: 1, unit: 7 });
    hw.push({ g: 'Cables', name: 'Cable interior IEC C13 → figura 8 (C7), 50 cm', qty: 1, unit: 5 });
  } else if (p.cable === 'pasamuros') {
    cz.forEach(z => fixtures.push({ kind: 'grommet', pos: [portRight ? xo1 + ct : xo0 - ct, cy, z], r: p.cableDia / 2, sgn: portRight ? 1 : -1, step: 'cables' }));
    hw.push({ g: 'Cables', name: `Pasamuros de cepillo / goma Ø${p.cableDia}`, qty: 2, unit: 1.5 });
  }
  if (p.lid) {
    const lc = 1.5, lt = t, sk = p.lidSkirt;
    const L0 = [-outer.X / 2 - lc - t, -outer.Z / 2 - lc - t, outer.X / 2 + lc + t, outer.Z / 2 + lc + t];
    const ly = y0 + outer.H + 2;
    const [sx0, sz0, sx1, sz1] = L0;
    const lid = (id, key, name, solid) => add({ id, key, name, role: 'tapa', mat: 'cover', step: 'tapa', lid: true, solids: [solid], explode: [0, 160, 0] });
    lid('T1', 'lidTop', 'Tapa · panel', { plane: 'XZ', rect: L0, t: [ly, ly + lt] });
    lid('T2', 'lidB', 'Tapa · faldón largo fondo', { plane: 'XY', rect: [sx0, ly - sk, sx1, ly], t: [sz0, sz0 + t] });
    lid('T3', 'lidF', 'Tapa · faldón largo frente', { plane: 'XY', rect: [sx0, ly - sk, sx1, ly], t: [sz1 - t, sz1] });
    lid('T4', 'lidL', 'Tapa · faldón corto izq.', { plane: 'YZ', rect: [sz0 + t, ly - sk, sz1 - t, ly], t: [sx0, sx0 + t] });
    lid('T5', 'lidR', 'Tapa · faldón corto der.', { plane: 'YZ', rect: [sz0 + t, ly - sk, sz1 - t, ly], t: [sx1 - t, sx1] });
    const nl = Number(p.latches);
    const lx = nl === 2 ? [0] : [-outer.X * 0.28, outer.X * 0.28];
    lx.forEach(x => [-1, 1].forEach(s => fixtures.push({ kind: 'latch', pos: [x, ly - sk, s * (sz1)], s, step: 'tapa', lid: true })));
    hw.push({ g: 'Tapa', name: 'Cierre de palanca de maleta', qty: lx.length * 2, unit: 3.5 });
    hw.push({ g: 'Tapa', name: 'Espuma interior de la tapa 10 mm', qty: 1, unit: 8 });
    if (sk > H - 10) warn('warn', 'El faldón de la tapa es más alto que la caja.');
  }

  // ── herrajes de montaje (no dibujados) ──
  const battenLen = battens.reduce((s, b) => s + b.cut.L, 0);
  hw.unshift(
    { g: 'Caja', name: 'Cola blanca D3 (o poliuretano)', qty: 1, unit: 6 },
    { g: 'Caja', name: 'Tornillo madera 3,5 × 25 avellanado (listones y tacos, desde fuera)', qty: Math.ceil(battenLen / 120) + (p.cornerBlocks ? 16 : 0) + (p.mount === 'vesa' ? 8 : 0), unit: 0.04 },
    { g: 'Caja', name: 'Puntas / clavos sin cabeza 1,2 × 25 (marco sobre paredes)', qty: Math.ceil((2 * (X + Z)) / 80) * layers, unit: 0.02 },
  );
  if (p.baseFix === 'insertos') {
    hw.push({ g: 'Base', name: 'Inserto roscado M5 para madera (listones)', qty: p.baseScrews, unit: 0.35 });
    hw.push({ g: 'Base', name: 'Tornillo M5 × 16 avellanado Allen (DIN 7991)', qty: p.baseScrews, unit: 0.15 });
  } else if (p.baseFix === 'tirafondos') {
    hw.push({ g: 'Base', name: 'Tornillo madera 4 × 25 avellanado', qty: p.baseScrews, unit: 0.05 });
    warn('info', 'Con tornillos para madera la rosca del listón se gasta tras varios desmontajes; los insertos M5 aguantan cientos de ciclos.');
  } else {
    hw.push({ g: 'Base', name: 'Imán de neodimio 20×3 avellanado + contraplaca', qty: 8, unit: 1 });
    hw.push({ g: 'Base', name: 'Inserto M5 + tornillo M5×16 (seguridad en transporte)', qty: 4, unit: 0.5 });
  }
  if (gk > 0) hw.push({ g: 'TV', name: `Burlete EPDM adhesivo 8 × ${gk} mm`, qty: Math.ceil((2 * (p.tvW + p.tvH)) / 1000 * 10) / 10, unit: 2, u: 'm' });
  hw.push({ g: 'Cables', name: 'Bridas adhesivas + bridas', qty: 6, unit: 0.2 });

  // ── métricas ──
  const vol = { ply: 0, batten: 0 };
  pieces.forEach(pc => {
    if (pc.mat === 'tv' || pc.skin || pc.role === 'protector' || pc.mat === 'foam') return;
    const v = pc.solids.reduce((s, so) => s + solidVolume(so), 0);
    if (pc.mat === 'batten') vol.batten += v; else vol.ply += v;
  });
  const kgPly = vol.ply * 1e-9 * ply.rho, kgBatten = vol.batten * 1e-9 * 500;
  const kgProt = protRect ? (protRect[2] - protRect[0]) * (protRect[3] - protRect[1]) * pt * 1e-9 * prot.rho : 0;
  const coverAreaReal = ct > 0 ? 2 * (X + Z) * (H + 40) * 1e-6 + (p.frameFinish === 'mismo' ? (X * Z - rectArea(op2 || op1)) * 1e-6 : 0) : 0;
  const kgCover = coverAreaReal * cover.kgm2;
  const kgHw = 0.25 + (p.handle !== 'ninguna' ? 0.35 : 0) + (p.corners ? 0.4 : 0) + (p.fans ? 0.15 : 0) + (p.cable === 'panel' ? 0.15 : 0) + p.baseScrews * 0.01;
  const kgBox = kgPly + kgBatten + kgCover + kgHw;
  const mass = { tv: p.tvKg, ply: kgPly, batten: kgBatten, protector: kgProt, cover: kgCover, hw: kgHw };
  mass.total = Object.values(mass).reduce((s, v) => s + v, 0);
  if (p.lid) { /* la tapa se incluye en ply y cover */ }
  if (coverAreaReal) hw.push({ g: 'Acabado', name: `${cover.label} (+15 % de solapes)`, qty: Math.ceil(coverAreaReal * 1.15 * 10) / 10, unit: p.cover === 'tolex' ? 22 : p.cover === 'polipiel' ? 14 : p.cover === 'terciopelo' ? 12 : 9, u: 'm²' });
  if (coverAreaReal && p.cover !== 'pintura') hw.push({ g: 'Acabado', name: 'Cola de contacto (bote 500 ml)', qty: Math.ceil(coverAreaReal / 1.6), unit: 9 });
  if (p.frameFinish === 'negro' || twoLayer) hw.push({ g: 'Acabado', name: 'Pintura negra mate (marco y labio interior, antirreflejos)', qty: 1, unit: 7 });

  if (mass.total > 22) warn('warn', `Peso total ${r1(mass.total)} kg: es mucho para una sola asa. Considera dos asas laterales o una tapa más ligera.`);
  if (prot.mat === 'glass') warn('info', `El vidrio templado añade ${r1(kgProt)} kg y no se puede cortar después de templar: pídelo a medida (${r1(protRect[2] - protRect[0])} × ${r1(protRect[3] - protRect[1])}).`);
  if (!p.vents && !p.fans) warn('warn', 'Sin rejillas ni ventiladores la tele (≈ 54 W) se calienta dentro de la caja. Activa al menos las rejillas.');
  if (p.gasket === 0) warn('info', 'Sin burlete, el marco apoya directamente en el bisel de la tele: puede marcarlo o vibrar.');
  if (wallH - t - bh < 30) warn('warn', 'Las paredes quedan muy bajas para los pasacables y las rejillas.');
  if (X > 2440 || Z > 1220) warn('error', 'Alguna pieza no cabe en un tablero estándar de 2440 × 1220.');

  const px = 1920 / p.screenW; // px por mm
  const metrics = {
    X, Z, H, outer, innerX, innerZ, wallH, g, gL, gR, ring1, ring2, y0, yBaseTop, yB, yS, yF, yTop, yRim,
    mass, coverArea: coverAreaReal, op1, op2, protRect, tv, scr, bezelTop, bezelSide, vol,
    pxPerMm: px, inchPx: 25.4 * px, gridCells: [Math.floor(p.screenW / 25.4), Math.floor(p.screenH / 25.4)],
    railX, vz, screwPts, twoLayer, pt, ct, cy, cz, portWall,
  };

  // cotas para la escena y los planos
  const dims = [
    { id: 'X', a: [xo0 - ct, y0 + outer.H, zo1 + ct + 60], b: [xo1 + ct, y0 + outer.H, zo1 + ct + 60], label: 'Largo total', v: outer.X, layer: 'general' },
    { id: 'Z', a: [xo1 + ct + 60, y0 + outer.H, zo0 - ct], b: [xo1 + ct + 60, y0 + outer.H, zo1 + ct], label: 'Ancho total', v: outer.Z, layer: 'general' },
    { id: 'H', a: [xo1 + ct + 60, 0, zo1 + ct], b: [xo1 + ct + 60, y0 + outer.H, zo1 + ct], label: 'Alto total', v: y0 + outer.H, layer: 'general' },
    { id: 'SW', a: [scr.x0, yTop + 4, scr.z0 - 30], b: [scr.x1, yTop + 4, scr.z0 - 30], label: 'Área visible', v: p.screenW, layer: 'pantalla' },
    { id: 'SH', a: [scr.x0 - 30, yTop + 4, scr.z0], b: [scr.x0 - 30, yTop + 4, scr.z1], label: 'Área visible', v: p.screenH, layer: 'pantalla' },
    { id: 'R1', a: [xo0, yTop + 4, 0], b: [op1[0], yTop + 4, 0], label: 'Marco', v: op1[0] - xo0, layer: 'pantalla' },
  ];

  return { params: p, pieces, fixtures, hw, warnings, metrics, dims };
}

function rectArea(r) { return (r[2] - r[0]) * (r[3] - r[1]); }

export function solidVolume(s) {
  let a = rectArea(s.rect);
  (s.notches || []).forEach(n => {
    const c = [Math.max(n[0], s.rect[0]), Math.max(n[1], s.rect[1]), Math.min(n[2], s.rect[2]), Math.min(n[3], s.rect[3])];
    if (c[2] > c[0] && c[3] > c[1]) a -= rectArea(c);
  });
  (s.holes || []).forEach(h => {
    if (h.circle) a -= Math.PI * h.circle[2] ** 2;
    else if (h.slot) a -= rectArea(h.slot);
    else a -= rectArea(h.rect);
  });
  return a * Math.abs(s.t[1] - s.t[0]);
}

// Medidas de corte de una pieza de tablero (el sólido mayor).
export function pieceCut(pc) {
  if (pc.cut) return pc.cut;
  const s = pc.solids.reduce((m, so) => (rectArea(so.rect) > rectArea(m.rect) ? so : m), pc.solids[0]);
  const w = s.rect[2] - s.rect[0], h = s.rect[3] - s.rect[1];
  return { L: r1(Math.max(w, h)), W: r1(Math.min(w, h)), T: r1(Math.abs(s.t[1] - s.t[0]) * (pc.solids.length > 1 && pc.role === 'pared' ? 2 : 1)), stock: 'tablero' };
}
