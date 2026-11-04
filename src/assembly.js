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
    text: `Antes de cortar nada, mide la tele real (sin peana) y corrige los valores de Diseño › Televisor marcados «medir»: fondo en el borde fino (ahora ${f1(p.tvRimD)} mm) y en el centro de la trasera (${f1(p.tvD)}); ancho y alto de la zona donde la trasera curva ya alcanza el fondo máximo (${p.bumpW} × ${p.bumpH}) y cuánto está desplazada hacia el canto inferior (${p.bumpDz}); la posición del centro de las 4 roscas VESA respecto al centro de la tele (${f1(p.vesaDx)} lateral, ${f1(p.vesaDz)} hacia abajo); el marco inferior de la pantalla (${f1(p.bezelBottom)}) y dónde está el receptor del mando (${f1(p.irDx)} desde el centro). Con esto salen bien ${p.mount === 'base' ? 'las costillas VESA de la base' : 'los tacos colgadores'}, la ventana del marco y el agujero IR.`,
    access: 'Mide con la tele boca abajo sobre una manta: regla apoyada en el dorso y calibre o escuadra para los fondos. Todo en milímetros.',
    hw: ['Metro', 'Calibre', 'Escuadra'],
  });
  add({
    key: 'corte', title: 'Cortar y mecanizar', flip: false, explode: 0.9,
    now: [...walls, ...ids('marco'), ...ids('base')], fixtures: [],
    text: `Corta del tablero de ${p.t} mm las cuatro paredes${p.lid ? ` (y del de ${p.lidT} mm la tapa)` : ''}, ${m.twoLayer ? 'las dos capas' : 'la capa'} del marco y la base (medidas en «Despiece» y plano de corte). Marca cada pieza con su ID a lápiz en la cara interior. ${m.edge ? 'Los huecos de la franja baja de las paredes (tornillos de la base, rejillas, pasamuros) se taladran luego junto con los tacos de la bandeja; ahora haz solo los demás:' : 'Antes de montar haz todos los taladros:'} ${p.cable === 'pasamuros' ? `dos pasamuros Ø${p.cableDia} con corona` : p.cable === 'panel' ? 'huecos rectangulares para la base IEC y el HDMI de panel (taladro en las esquinas + caladora + lima)' : 'las ranuras de cable en el canto inferior'} en el lateral de conexiones, ${p.vents ? `${p.ventCount} ranuras de ventilación (dos taladros Ø8 y caladora)` : 'sin rejillas'}${p.speakerSlots ? ', las rejillas de los altavoces en el frente' : ''}${p.baseVents ? ' y la ventilación de la base' : ''}. La ventana del marco: taladro Ø10 en cada esquina y caladora o fresadora con guía; lija los cantos interiores.`,
    access: 'Todo es plano todavía: es el momento de lijar (grano 120 → 180) y de sellar con una mano de tapaporos las caras que quedarán vistas.',
    hw: ['Corona Ø' + p.cableDia, 'Caladora + hoja fina', 'Lija 120/180'],
  });
  if (has('listones')) add({
    key: 'listones', title: 'Listones en las paredes', flip: false, explode: 0.45,
    done: walls, now: byStep('listones'),
    text: `Encola los listones de ${p.battenW}×${p.battenH} en la cara interior de las paredes, enrasados a ${p.t} mm del canto inferior (justo el grueso de la base: usa un recorte de tablero como galga). Atornilla desde fuera con 3,5×25 cada ~12 cm; las cabezas quedarán bajo el revestimiento. ${d.pieces.filter(pc => pc.role === 'liston').length > 4 ? 'Algunos listones van partidos para dejar paso (travesaños VESA o ranura de cables).' : `Los dos largos van de punta a punta de la pared (${f1(m.innerX)} mm) y los cortos entre ellos: así cada esquina queda atada por un listón entero.`}`,
    access: 'Las paredes aún están sueltas: atornilla cómodamente desde fuera, sobre el banco.',
    hw: ['Cola D3', 'Tornillo 3,5×25', 'Galga de ' + p.t + ' mm'],
  });
  add({
    key: 'caja', title: 'Cerrar el perímetro', flip: false, explode: 0.15,
    done: [...byStep('listones')], now: [...walls, ...byStep('caja').filter(i => !walls.includes(i))],
    text: `${p.joint === 'dedos' ? 'Encola los dedos y cierra las cuatro esquinas con sargentos.' : p.joint === 'rebaje' ? 'Las paredes largas llevan en cada extremo un galce de ' + p.t + ' × ' + f1(p.t / 2) + ' mm (ancho × fondo) por la cara interior; encaja ahí las laterales con cola.' : 'Unión a tope: las paredes largas pasan por delante de las laterales.'} ${p.cornerBlocks && !m.edge ? 'Pega los cuatro postes de esquina, apoyados en el cruce de los listones, y atornilla cada pared a ellos desde fuera (dos tornillos por cara): atan las esquinas y reciben luego el marco' + (m.protTop ? ' y los tornillos del protector' : '') + '.' : ''} ${p.handle === 'maleta' ? 'Encola también la contraplaca del asa detrás de sus dos taladros.' : ''} Comprueba la escuadra midiendo las dos diagonales: deben ser iguales (±1 mm) antes de que fragüe.`,
    access: `Diagonal teórica: ${f1(Math.hypot(m.X, m.Z))} mm. Trabaja sobre una superficie plana para que la caja no quede alabeada.`,
    hw: ['Cola D3', '4 sargentos', 'Tornillo 3,5×25'],
  });
  add({
    key: 'marco', title: m.twoLayer ? 'Marco: capa inferior (labio)' : 'Marco', flip: false, explode: 0.1,
    done: [...walls, ...byStep('listones'), ...byStep('caja')], now: byStep('marco'),
    text: `Pinta de negro mate el canto interior de la ventana${m.twoLayer ? ' y la cara superior de esta capa (se verá a través del protector)' : ''}: evita reflejos alrededor de la imagen. Encola el marco sobre el canto de las paredes y los postes, centrado, y clávalo con puntas sin cabeza cada ~8 cm. Pon peso encima o sargentos con listones.`,
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
  // base preparada sobre el banco: costillas VESA y, con bandeja, los tacos de apoyo
  const trayStep = () => {
    const nb = d.pieces.filter(pc => pc.role === 'liston' && pc.step === 'costillas').length;
    const ribTxt = m.ribs.length ? `encola las dos costillas VESA de ${p.railW} × ${f1(Math.min(...m.ribs.map(r => r.h)))} mm de punta a punta, con sus ejes a ${f1(m.ribs[0].z)} y ${f1(m.ribs[1].z)} mm del centro (las filas de roscas VESA), y atorníllalas desde debajo con 4 tornillos 3,5×30 cada una. Cuando seque, taladra Ø10 los 4 agujeros VESA (${p.vesa} × ${p.vesa}) atravesando costilla y base y avellana por debajo para que la cabeza del M8 quede enrasada.` : '';
    if (!m.edge) return {
      key: 'costillas', title: 'Costillas VESA en la base', flip: false, explode: 0.05,
      done: ids('base'), now: byStep('costillas'),
      text: `Sobre el banco, con la base boca arriba: ${ribTxt} La altura de la costilla es la que hay de la base al dorso de la tele: así la tele apoya en ellas y no en los tornillos.`,
      access: 'Comprueba con una regla que las costillas no tocan los listones del perímetro: la base tiene que seguir entrando entre ellos.',
      hw: ['Cola D3', 'Tornillo 3,5×30 ×8', 'Broca Ø10', 'Avellanador'],
    };
    return {
      key: 'costillas', title: 'Bandeja: tacos de apoyo' + (m.ribs.length ? ' y costillas' : ''), flip: false, explode: 0.05,
      done: [...ids('base'), ...walls], now: byStep('costillas'),
      text: `Sobre el banco, con la base boca arriba, encola en su perímetro los ${nb} tacos de apoyo de ${p.battenW} × ${f1(m.battenTop - m.yBaseTop)} mm, enrasados con el canto: los dos largos de punta a punta (${f1(m.innerX - 1)} mm) y los cortos entre ellos. Atorníllalos desde debajo cada ~15 cm. ${ribTxt ? 'Luego ' + ribTxt + ' ' : ''}Con todo seco, mete la bandeja en la caja (boca abajo) y taladra a la vez pared y taco desde fuera: los ${p.baseScrews} tornillos de la base (Ø5,5 avellanado en la pared, Ø7 en el taco para el inserto M5)${p.vents ? ', las ranuras de ventilación' : ''}${p.speakerSlots ? ', las rejillas de los altavoces' : ''}${p.handle === 'maleta' ? ', los dos taladros del asa' : ''} y ${p.cable === 'pasamuros' ? `los pasamuros con la corona Ø${p.cableDia}` : 'los huecos de cables'}. Saca la bandeja: en el taco, abre cada hueco de cable con la caladora hasta su canto superior (así la bandeja sale sin desenchufar nada) y rosca los insertos. Termina pegando el burlete de apoyo en el canto de los tacos: ahí descansa el borde de la tele.`,
      access: 'Los tacos entran justos entre las paredes (0,5 mm por lado): si rozan, lija su cara exterior, nunca la pared.',
      hw: ['Cola D3', 'Tornillo 3,5×30', 'Inserto M5 ×' + p.baseScrews, 'Broca Ø7', ...(m.ribs.length ? ['Broca Ø10', 'Avellanador'] : [])],
    };
  };
  const doneBox = [...walls, ...byStep('listones'), ...byStep('caja'), ...byStep('marco'), ...byStep('tacos'), ...byStep('marco2')];
  if (has('costillas') && m.edge) add(trayStep());
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
  if (has('costillas') && !m.edge) add(trayStep());
  add({
    key: 'tv', title: 'Meter la tele', flip: true, explode: 0.3,
    done: doneTV, now: byStep('tv'),
    text: p.mount === 'vesa'
      ? `${!m.twoLayer && m.pt ? 'Primero deja el protector, limpio y sin film por la cara de la pantalla, sobre el burlete. ' : ''}Quita la peana. Con la caja boca abajo, mete la tele boca abajo sobre el ${!m.twoLayer && m.pt ? 'protector' : 'burlete'} (dos personas, guantes de algodón). Atornilla cada travesaño a la tele con dos M8×${p.railH + 12} y arandela ancha (rosca VESA ${p.vesa}×${p.vesa}, no aprietes más de lo necesario), y luego sus extremos a los insertos de los tacos colgadores con M5. Si el travesaño no apoya a la vez en tele y tacos, calza con arandelas.`
      : p.mount === 'base'
        ? `${m.protTop || !m.pt || m.twoLayer ? '' : 'Primero deja el protector, limpio, sobre el burlete. '}Quita la peana. Con la caja boca abajo, mete la tele boca abajo sobre el burlete (dos personas, guantes de algodón)${m.edge ? `: entra justa entre las paredes, con ${f1(p.fit)} mm de holgura por lado` : ` y céntrala: debe quedar la misma holgura (${f1(p.fit)} mm) a los cuatro lados`}. Enrosca a mano dos varillas M8 de 80 mm en dos roscas VESA en diagonal: serán las guías para bajar la base.`
        : `Quita la peana. Con la caja boca abajo, mete la tele boca abajo sobre el burlete. Los tacos de espuma van pegados en la base: al cerrarla, la aprietan contra el marco.`,
    access: 'Antes de cerrar enciende la tele y comprueba que la imagen queda centrada en la ventana del marco.',
    hw: p.mount === 'vesa' ? ['M8 ×4 + arandelas', 'M5 ×4', 'Llave Allen'] : p.mount === 'base' ? ['Varillas guía M8 ×2'] : ['Espuma EVA'],
  });
  if (has('cables')) add({
    key: 'cables', title: 'Cables' + (p.fans ? ' y ventiladores' : ''), flip: true, explode: 0.2,
    done: [...doneTV, ...byStep('tv')], now: byStep('cables'),
    text: `${p.source === 'stick' ? 'Enchufa el stick al HDMI de la tele con el alargo en ángulo y pégalo con velcro al dorso. ' : p.source === 'minipc' ? 'Fija el mini-PC con velcro a la base junto al lateral de conexiones (ventilador hacia una ranura), conecta su HDMI a la tele y alimenta tele y mini-PC desde la regleta interior. ' : ''}${p.cable === 'panel' ? (p.source === 'externa' ? 'Atornilla la base IEC y el HDMI de panel al lateral. Conecta por dentro el cable IEC→figura 8 y el alargo HDMI a la tele.' : 'Atornilla la base IEC al lateral y conecta por dentro el cable IEC→figura 8' + (p.source === 'minipc' ? ' a la regleta.' : ' a la tele.')) : p.cable === 'pasamuros' ? (p.source === 'externa' ? 'Pasa el cable de corriente y el HDMI por los pasamuros y conéctalos a la tele.' : 'Pasa el cable de corriente por el pasamuros.') : 'Conecta los cables a la tele y sácalos por las ranuras del canto inferior; la base los pinza al cerrar.'} Fija los cables con bridas adhesivas a las paredes, sin tensión en los conectores. ${p.fans ? 'Atornilla los ventiladores a la pared del fondo (soplando hacia fuera) y enchúfalos al USB de la tele: se encienden con ella.' : ''}`,
    access: 'Deja un bucle de cable dentro: si alguien tira desde fuera, que no arranque el conector de la tele.',
    hw: ['Bridas adhesivas', p.cable === 'panel' ? 'Tornillos M3' : 'Pasamuros'],
  });
  add({
    key: 'base', title: 'Cerrar la base', flip: true, explode: 0.25,
    done: [...doneTV, ...byStep('tv'), ...byStep('cables')], now: [...byStep('base'), ...byStep('costillas')],
    text: m.edge
      ? `Baja la bandeja con los tacos hacia dentro${p.mount === 'base' ? ' por las dos varillas guía' : ''}: los tacos entran entre las paredes y pisan el borde de la tele a través de su burlete, así que la tele queda pinzada entre los tacos y el marco. Atornilla los ${p.baseScrews} M5×20 avellanados por fuera de las paredes a los insertos de los tacos${p.mount === 'base' ? `; luego mete los cuatro M8×${m.boltL} por debajo (cambiando las varillas) y apriétalos con suavidad: solo sujetan la tele contra el burlete, el peso lo llevan los tacos` : ''}${p.handle === 'maleta' ? '. Atornilla el asa con sus dos M6 a los insertos del taco del fondo' : ''}. ${p.footH ? `Atornilla las ${d.fixtures.filter(f => f.kind === 'foot').length} patas de goma.` : ''}`
      : `${p.mount === 'base' ? `Baja la base con las costillas hacia dentro por las dos varillas guía hasta que asiente en los listones. Mete los dos M8×${m.boltL} avellanados en los agujeros libres y apriétalos con suavidad, cambia las varillas por los otros dos y aprieta los cuatro (firme, sin pasarte: la rosca de la tele es de plástico reforzado). Si la base no llega a apoyar en los listones porque la pantalla ya pisa el burlete, calza con arandelas entre costilla y tele, o lija la costilla. ` : ''}Presenta la base (${f1(m.innerX - 1)} × ${f1(m.innerZ - 1)} mm, 0,5 mm de holgura por lado) sobre los listones y atorníllala con ${p.baseFix === 'magnetos' ? '4 tornillos M5 de seguridad (los imanes la sujetan el resto del tiempo)' : `${p.baseScrews} tornillos ${p.baseFix === 'insertos' ? 'M5×16 avellanados a los insertos' : 'para madera 4×25'}`}. ${p.footH ? `Atornilla las ${d.fixtures.filter(f => f.kind === 'foot').length} patas de goma${d.fixtures.some(f => f.center) ? ' (las cuatro centrales, junto a los tornillos VESA: llevan el peso de la tele directo a la mesa)' : ''}.` : ''} Esta es la tapa de servicio: se quita siempre con la caja boca abajo.`,
    access: m.edge ? `Para volver a entrar: boca abajo, quita los ${p.baseScrews} tornillos de los costados${p.mount === 'base' ? ' y los 4 M8' : ''}${p.handle === 'maleta' ? ' y el asa' : ''} y levanta la bandeja; la tele se queda en la caja apoyada en el burlete del marco.` : p.mount === 'base' ? 'Para volver a entrar: boca abajo, quita los tornillos de la base y los 4 M8 y levántala; la tele se queda en la caja apoyada en el burlete.' : 'Para volver a acceder a cables o a la tele: boca abajo, fuera tornillos, fuera base. Nada más.',
    hw: [...(p.mount === 'base' ? ['M8×' + m.boltL + ' avellanado ×4'] : []), ...(m.edge ? ['M5×20 ×' + p.baseScrews, 'Llave Allen 3'] : p.baseFix === 'insertos' ? ['M5×16 ×' + p.baseScrews, 'Llave Allen 3'] : ['Destornillador'])],
  });
  if (has('protector')) add({
    key: 'protector', title: 'Protector de pantalla', flip: false, explode: 0.2,
    done: d.pieces.filter(pc => !['protector', 'tapa'].includes(pc.role) && !['remate'].includes(pc.step)).map(pc => pc.id), now: byStep('protector'),
    text: m.protTop
      ? `Dale la vuelta. Pega cuatro tiras de fieltro de 1 mm en las esquinas del marco, limpia la pantalla, quita el film de la cara de abajo y apoya el ${d.pieces.find(x => x.role === 'protector').name.toLowerCase()} encima, enrasado con los cantos de la caja. Atorníllalo en las cuatro esquinas a los postes con 3,5×30 y arandela de copa (taladros Ø5 holgados: el metacrilato dilata). Queda a ${f1(m.protY - m.yS)} mm de la pantalla.`
      : `Dale la vuelta. Quita el film protector solo por la cara de abajo, limpia la pantalla con un paño de microfibra y deja caer el ${d.pieces.find(x => x.role === 'protector').name.toLowerCase()} en el pozo. Debe entrar sin forzar (1 mm de holgura por lado). Puedes poner dos tiras de fieltro adhesivo de 1 mm sobre el labio para que no vibre.`,
    access: m.protTop ? 'Para limpiar por debajo: cuatro tornillos y fuera. Los cantos pulidos del metacrilato quedan a la vista: con cantoneras, estas los protegen.' : 'Se puede sacar con una ventosa para limpiar por debajo.',
    hw: m.protTop ? ['Tornillo 3,5×30 + arandela de copa ×4', 'Fieltro 1 mm', 'Microfibra'] : ['Ventosa', 'Microfibra'],
  });
  if (has('remate')) add({
    key: 'remate', title: 'Asa, cantoneras y topes', flip: false, explode: 0,
    done: d.pieces.filter(pc => pc.role !== 'tapa').map(pc => pc.id), now: byStep('remate'), fixtures: ['remate'],
    text: `${p.handle === 'maleta' ? (m.edge ? 'El asa ya va atornillada al taco del fondo. ' : 'Atornilla el asa con dos M6 pasantes a la contraplaca (tuercas de garra por dentro). ') : p.handle !== 'ninguna' ? 'Encaja el cazo del asa embutida y atorníllalo. ' : ''}${p.corners ? 'Clava las 8 cantoneras metálicas: protegen el revestimiento en los golpes. ' : ''}${p.standFeet ? 'Los dos topes de goma van en el frente: así la puedes dejar de pie apoyada en ellos, con el asa arriba. ' : ''}Llévala siempre con el asa arriba: la tele viaja en su posición natural (de pie).`,
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
  // tiempos orientativos (min de trabajo + espera de secado)
  const T = { medir: [20, 0], corte: [100, 0], listones: [40, 30], caja: [45, 60], marco: [30, 60], tacos: [30, 60], marco2: [30, 60], piel: [100, 20], burlete: [10, 0], costillas: [30, 45], tv: [25, 0], cables: [20, 0], base: [15, 0], protector: [5, 0], remate: [30, 0], tapa: [70, 30] };
  steps.forEach(s => { const [w, dry] = T[s.key] || [20, 0]; s.min = w; s.dry = dry; });
  return steps;
}
export const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
