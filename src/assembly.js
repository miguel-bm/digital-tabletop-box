// Secuencia de montaje. Cada paso dice qué piezas aparecen (now), cuáles ya están (done),
// si la caja se ve boca abajo, el texto, el acceso que queda y la ferretería que se usa.

const f1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');

export function planAssembly(d) {
  const p = d.params, m = d.metrics;
  const byStep = s => d.pieces.filter(pc => pc.step === s).map(pc => pc.id);
  const ids = role => d.pieces.filter(pc => pc.role === role).map(pc => pc.id);
  const walls = ids('pared');
  const has = s => d.pieces.some(pc => pc.step === s) || d.fixtures.some(f => f.step === s);
  const steps = [];
  const add = st => steps.push(st);

  add({
    key: 'medir', title: 'Medir la tele', flip: false, explode: 0,
    now: ['TV'], fixtures: ['tv'],
    text: `Antes de cortar nada, mide la tele real (sin peana) y corrige los valores de Diseño › Televisor marcados «medir»: fondo en el borde fino (ahora ${f1(p.tvRimD)} mm) y de la joroba (${f1(p.tvD)}); ancho y alto de la joroba (${p.bumpW} × ${p.bumpH}) y cuánto está desplazada hacia el canto inferior; la posición del centro de las 4 roscas VESA respecto al centro de la tele (${f1(p.vesaDx)} lateral, ${f1(p.vesaDz)} hacia abajo); el marco inferior de la pantalla (${f1(p.bezelBottom)}) y dónde está el receptor del mando (${f1(p.irDx)} desde el centro). Con esto salen bien los tacos colgadores, la ventana del marco y el agujero IR.`,
    access: 'Mide con la tele boca abajo sobre una manta: regla apoyada en el dorso y calibre o escuadra para los fondos. Todo en milímetros.',
    hw: ['Metro', 'Calibre', 'Escuadra'],
  });
  add({
    key: 'corte', title: 'Cortar y mecanizar', flip: false, explode: 0.9,
    now: [...walls, ...ids('marco'), ...ids('base')], fixtures: [],
    text: `Corta del tablero de ${p.t} mm las cuatro paredes, ${m.twoLayer ? 'las dos capas' : 'la capa'} del marco y la base (medidas en «Despiece» y plano de corte). Marca cada pieza con su ID a lápiz en la cara interior. Antes de montar haz todos los taladros: ${p.cable === 'pasamuros' ? `dos pasamuros Ø${p.cableDia} con corona` : p.cable === 'panel' ? 'huecos rectangulares para la base IEC y el HDMI de panel (taladro en las esquinas + caladora + lima)' : 'las ranuras de cable en el canto inferior'} en el lateral de conexiones, ${p.vents ? `${p.ventCount} ranuras de ventilación (dos taladros Ø8 y caladora)` : 'sin rejillas'}${p.speakerSlots ? ', las rejillas de los altavoces en el frente' : ''}${p.baseVents ? ' y la ventilación de la base' : ''}. La ventana del marco: taladro Ø10 en cada esquina y caladora o fresadora con guía; lija los cantos interiores.`,
    access: 'Todo es plano todavía: es el momento de lijar (grano 120 → 180) y de sellar con una mano de tapaporos las caras que quedarán vistas.',
    hw: ['Corona Ø' + p.cableDia, 'Caladora + hoja fina', 'Lija 120/180'],
  });
  add({
    key: 'listones', title: 'Listones en las paredes', flip: false, explode: 0.45,
    done: walls, now: byStep('listones'),
    text: `Encola los listones de ${p.battenW}×${p.battenH} en la cara interior de las paredes, enrasados a ${p.t} mm del canto inferior (justo el grueso de la base: usa un recorte de tablero como galga). Atornilla desde fuera con 3,5×25 cada ~12 cm; las cabezas quedarán bajo el revestimiento. ${d.pieces.some(pc => pc.role === 'travesano') && d.pieces.filter(pc => pc.role === 'liston').length > 4 ? 'Los listones largos van partidos: deja el hueco para el extremo de cada travesaño VESA.' : ''}`,
    access: 'Las paredes aún están sueltas: atornilla cómodamente desde fuera, sobre el banco.',
    hw: ['Cola D3', 'Tornillo 3,5×25', 'Galga de ' + p.t + ' mm'],
  });
  add({
    key: 'caja', title: 'Cerrar el perímetro', flip: false, explode: 0.15,
    done: [...byStep('listones')], now: [...walls, ...byStep('caja').filter(i => !walls.includes(i))],
    text: `${p.joint === 'dedos' ? 'Encola los dedos y cierra las cuatro esquinas con sargentos.' : p.joint === 'rebaje' ? 'Las paredes largas llevan en cada extremo un galce de ' + p.t + ' × ' + f1(p.t / 2) + ' mm (ancho × fondo) por la cara interior; encaja ahí las laterales con cola.' : 'Unión a tope: las paredes largas pasan por delante de las laterales.'} ${p.cornerBlocks ? 'Pega los cuatro tacos de esquina y atornilla cada pared a ellos desde fuera (dos tornillos por cara).' : ''} ${p.handle === 'maleta' ? 'Encola también la contraplaca del asa detrás de sus dos taladros.' : ''} Comprueba la escuadra midiendo las dos diagonales: deben ser iguales (±1 mm) antes de que fragüe.`,
    access: `Diagonal teórica: ${f1(Math.hypot(m.X, m.Z))} mm. Trabaja sobre una superficie plana para que la caja no quede alabeada.`,
    hw: ['Cola D3', '4 sargentos', 'Tornillo 3,5×25'],
  });
  add({
    key: 'marco', title: m.twoLayer ? 'Marco: capa inferior (labio)' : 'Marco', flip: false, explode: 0.1,
    done: [...walls, ...byStep('listones'), ...byStep('caja')], now: byStep('marco'),
    text: `Pinta de negro mate el canto interior de la ventana${m.twoLayer ? ' y la cara superior de esta capa (se verá a través del protector)' : ''}: evita reflejos alrededor de la imagen. Encola el marco sobre el canto de las paredes y los tacos, centrado, y clávalo con puntas sin cabeza cada ~8 cm. Pon peso encima o sargentos con listones.`,
    access: 'A partir de aquí la caja es rígida: el marco y las paredes forman un cajón abierto por abajo.',
    hw: ['Cola D3', 'Puntas 1,2×25', 'Pintura negra mate'],
  });
  if (has('tacos')) add({
    key: 'tacos', title: 'Tacos colgadores (boca abajo)', flip: true, explode: 0.1,
    done: [...walls, ...byStep('listones'), ...byStep('caja'), ...byStep('marco')], now: byStep('tacos'),
    text: `Da la vuelta a la caja (marco sobre una manta). Encola los ${byStep('tacos').length} tacos colgadores contra la pared y la cara inferior del marco, en las posiciones de los travesaños VESA (ejes a ${f1(m.railX[0])} y ${f1(m.railX[1])} mm del centro). Su altura (${f1(m.yF - m.yB)} mm) es la que hay del marco al dorso de la tele: así el travesaño apoya a la vez en la tele y en los tacos. Cuando seque, taladra Ø7 y rosca un inserto M5 en cada uno.`,
    access: 'Comprueba con la tele (o una plantilla de cartón) que los tacos no tocan el borde de la tele.',
    hw: ['Inserto M5 ×4', 'Broca Ø7'],
  });
  if (has('marco2')) add({
    key: 'marco2', title: 'Marco: capa superior (pozo)', flip: false, explode: 0.1,
    done: [...walls, ...byStep('listones'), ...byStep('caja'), ...byStep('marco'), ...byStep('tacos')], now: byStep('marco2'),
    text: `${p.frame2Split ? 'La segunda capa son 4 listones: encola primero los dos largos (de punta a punta) y luego los cortos entre ellos, encima de la primera capa. Así las juntas no coinciden con las esquinas de abajo y todo sale de un solo tablero. La ventana que dejan' : 'Encola la segunda capa encima de la primera. Su ventana'} es ${f1(m.op2[2] - m.op2[0])} × ${f1(m.op2[3] - m.op2[1])} mm: deja un pozo de ${p.t} mm en el que el protector (${d.pieces.find(x => x.role === 'protector') ? d.pieces.find(x => x.role === 'protector').name : 'si lo pones'}) queda encajado y ${p.t - m.pt > 0 ? `${f1(p.t - m.pt)} mm por debajo del borde: los dados no se escapan` : 'enrasado'}. Usa el protector como plantilla para centrarla.`,
    access: 'Lija el conjunto del marco por fuera hasta que las dos capas y las paredes queden en un mismo plano.',
    hw: ['Cola D3', 'Puntas 1,2×25'],
  });
  const doneBox = [...walls, ...byStep('listones'), ...byStep('caja'), ...byStep('marco'), ...byStep('tacos'), ...byStep('marco2')];
  if (has('piel')) add({
    key: 'piel', title: 'Revestimiento exterior', flip: false, explode: 0.3,
    done: doneBox, now: byStep('piel'),
    text: `${p.cover === 'pintura' ? 'Imprima, lija suave y da dos manos de esmalte.' : `Corta el ${d.pieces.find(x => x.role === 'piel') ? (p.cover === 'tolex' ? 'tolex' : p.cover) : ''} en una tira continua que dé la vuelta a la caja (${f1(2 * (m.X + m.Z) + 40)} mm) con 20 mm de más arriba y abajo. Cola de contacto en las dos caras, espera a que tire, y aplícalo desde el centro de una pared larga con un rodillo. La junta, en una esquina trasera. En las esquinas, corte a inglete del sobrante para doblar por encima del marco${p.frameFinish === 'mismo' ? ' y forra luego el marco' : ''}, y por debajo hacia dentro del listón (no tapes el apoyo de la base). Recorta con cúter los huecos de cables, rejillas y asa.`}`,
    access: 'Revistes antes de meter la tele: así puedes manipular la caja sin miedo. Deja libre la cara inferior de los listones donde apoya la base.',
    hw: ['Cola de contacto', 'Rodillo', 'Cúter'],
  });
  if (has('burlete')) add({
    key: 'burlete', title: 'Burlete bajo el marco', flip: true, explode: 0.2,
    done: [...doneBox, ...byStep('piel')], now: byStep('burlete'),
    text: `Con la caja boca abajo, pega el burlete EPDM de 8×${p.gasket} en la cara inferior del marco, siguiendo el contorno del bisel de la tele (no debe asomar por la ventana). Es lo único que toca la tele por delante: reparte la presión y sella el polvo.`,
    access: 'Limpia con alcohol antes de pegar.',
    hw: ['Burlete EPDM 8×' + p.gasket],
  });
  const doneTV = [...doneBox, ...byStep('piel'), ...byStep('burlete')];
  add({
    key: 'tv', title: 'Meter la tele', flip: true, explode: 0.3,
    done: doneTV, now: byStep('tv'),
    text: p.mount === 'vesa'
      ? `Quita la peana. Con la caja boca abajo, mete la tele boca abajo sobre el burlete (dos personas, guantes de algodón). Atornilla cada travesaño a la tele con dos M8×${p.railH + 12} y arandela ancha (rosca VESA ${p.vesa}×${p.vesa}, no aprietes más de lo necesario), y luego sus extremos a los insertos de los tacos colgadores con M5. Si el travesaño no apoya a la vez en tele y tacos, calza con arandelas.`
      : `Quita la peana. Con la caja boca abajo, mete la tele boca abajo sobre el burlete. Los tacos de espuma van pegados en la base: al cerrarla, la aprietan contra el marco.`,
    access: 'Antes de cerrar enciende la tele y comprueba que la imagen queda centrada en la ventana del marco.',
    hw: p.mount === 'vesa' ? ['M8 ×4 + arandelas', 'M5 ×4', 'Llave Allen'] : ['Espuma EVA'],
  });
  if (has('cables')) add({
    key: 'cables', title: 'Cables' + (p.fans ? ' y ventiladores' : ''), flip: true, explode: 0.2,
    done: [...doneTV, ...byStep('tv')], now: byStep('cables'),
    text: `${p.source === 'stick' ? 'Enchufa el stick al HDMI de la tele con el alargo en ángulo y pégalo con velcro al dorso. ' : p.source === 'minipc' ? 'Fija el mini-PC con velcro a la base junto al lateral de conexiones (ventilador hacia una ranura), conecta su HDMI a la tele y alimenta tele y mini-PC desde la regleta interior. ' : ''}${p.cable === 'panel' ? (p.source === 'externa' ? 'Atornilla la base IEC y el HDMI de panel al lateral. Conecta por dentro el cable IEC→figura 8 y el alargo HDMI a la tele.' : 'Atornilla la base IEC al lateral y conecta por dentro el cable IEC→figura 8' + (p.source === 'minipc' ? ' a la regleta.' : ' a la tele.')) : p.cable === 'pasamuros' ? (p.source === 'externa' ? 'Pasa el cable de corriente y el HDMI por los pasamuros y conéctalos a la tele.' : 'Pasa el cable de corriente por el pasamuros.') : 'Conecta los cables a la tele y sácalos por las ranuras del canto inferior; la base los pinza al cerrar.'} Fija los cables con bridas adhesivas a la base de los tacos, sin tensión en los conectores. ${p.fans ? 'Atornilla los ventiladores a la pared del fondo (soplando hacia fuera) y enchúfalos al USB de la tele: se encienden con ella.' : ''}`,
    access: 'Deja un bucle de cable dentro: si alguien tira desde fuera, que no arranque el conector de la tele.',
    hw: ['Bridas adhesivas', p.cable === 'panel' ? 'Tornillos M3' : 'Pasamuros'],
  });
  add({
    key: 'base', title: 'Cerrar la base', flip: true, explode: 0.25,
    done: [...doneTV, ...byStep('tv'), ...byStep('cables')], now: byStep('base'),
    text: `Presenta la base (${f1(m.innerX - 1)} × ${f1(m.innerZ - 1)} mm, 0,5 mm de holgura por lado) sobre los listones y atorníllala con ${p.baseFix === 'magnetos' ? '4 tornillos M5 de seguridad (los imanes la sujetan el resto del tiempo)' : `${p.baseScrews} tornillos ${p.baseFix === 'insertos' ? 'M5×16 avellanados a los insertos' : 'para madera 4×25'}`}. ${p.footH ? `Atornilla las ${p.feet} patas de goma.` : ''} Esta es la tapa de servicio: se quita siempre con la caja boca abajo.`,
    access: 'Para volver a acceder a cables o a la tele: boca abajo, fuera tornillos, fuera base. Nada más.',
    hw: p.baseFix === 'insertos' ? ['M5×16 ×' + p.baseScrews, 'Llave Allen 3'] : ['Destornillador'],
  });
  if (has('protector')) add({
    key: 'protector', title: 'Protector de pantalla', flip: false, explode: 0.2,
    done: d.pieces.filter(pc => !['protector', 'tapa'].includes(pc.role) && !['remate'].includes(pc.step)).map(pc => pc.id), now: byStep('protector'),
    text: `Dale la vuelta. Quita el film protector solo por la cara de abajo, limpia la pantalla con un paño de microfibra y deja caer el ${d.pieces.find(x => x.role === 'protector').name.toLowerCase()} en el pozo. Debe entrar sin forzar (1 mm de holgura por lado). Puedes poner dos tiras de fieltro adhesivo de 1 mm sobre el labio para que no vibre.`,
    access: 'Se puede sacar con una ventosa para limpiar por debajo.',
    hw: ['Ventosa', 'Microfibra'],
  });
  if (has('remate')) add({
    key: 'remate', title: 'Asa, cantoneras y topes', flip: false, explode: 0,
    done: d.pieces.filter(pc => pc.role !== 'tapa').map(pc => pc.id), now: byStep('remate'), fixtures: ['remate'],
    text: `${p.handle === 'maleta' ? 'Atornilla el asa con dos M6 pasantes a la contraplaca (tuercas de garra por dentro). ' : p.handle !== 'ninguna' ? 'Encaja el cazo del asa embutida y atorníllalo. ' : ''}${p.corners ? 'Clava las 8 cantoneras metálicas: protegen el revestimiento en los golpes. ' : ''}${p.standFeet ? 'Los dos topes de goma van en el frente: así la puedes dejar de pie apoyada en ellos, con el asa arriba. ' : ''}Llévala siempre con el asa arriba: la tele viaja en su posición natural (de pie).`,
    access: '¡Lista! Pon un mapa en la tele y a jugar.',
    hw: [],
  });
  if (has('tapa')) add({
    key: 'tapa', title: 'Tapa de transporte', flip: false, explode: 0, lid: true,
    done: d.pieces.filter(pc => pc.role !== 'tapa').map(pc => pc.id), now: byStep('tapa'), fixtures: ['remate', 'tapa'],
    text: `La tapa es una caja baja (panel + faldón de ${p.lidSkirt} mm) que encaja por fuera con 1,5 mm de holgura. Pega espuma de 10 mm por dentro del panel para que no toque el protector, reviste igual que la caja y atornilla los ${Number(p.latches) === 2 ? 'dos' : 'cuatro'} cierres de palanca con sus contracierres alineados.`,
    access: 'Con la tapa puesta la caja aguanta que le apoyes cosas encima o la metas en el maletero.',
    hw: ['Cierres de palanca', 'Espuma 10 mm'],
  });
  return steps;
}
