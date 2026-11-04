// Parámetros del diseño (mm, kg). Los valores de la tele vienen de la ficha del
// Samsung UE43M5575AU; los marcados «medir» conviene comprobarlos con la tele delante.

export const DEFAULTS = {
  // ── televisor ──
  tvW: 972.9, tvH: 570, tvD: 55.1, tvRimD: 27, tvKg: 9.5,
  screenW: 951.8, screenH: 535.4, bezelBottom: 20,
  bumpW: 720, bumpH: 380, bumpDz: 25,
  vesa: 200, vesaDx: 0, vesaDz: 25,
  portSide: 'derecha', irHole: true, irDx: 0,

  // ── caja ──
  t: 10, plyType: 'abedul',
  fit: 3, margin: 20, portBay: 0,
  gapBelow: 22, gasket: 3,
  joint: 'tope', battenW: 20, battenH: 20, cornerBlocks: true,
  footH: 8, feet: 6,

  // ── marco y protector ──
  frame: 'rebaje', frame2Split: true, pockets: false, cardSlots: false, reveal: 1, protector: 'acrilico4', protOverlap: 10,

  // ── soporte de la tele ──
  mount: 'vesa', railW: 40, railH: 20, hangerW: 20,

  // ── base extraíble ──
  baseFix: 'insertos', baseScrews: 14, baseVents: true,

  // ── cables, aire y sonido ──
  source: 'externa', cable: 'pasamuros', cableDia: 30, cableY: 0.5,
  vents: true, ventCount: 6, fans: false, speakerSlots: true,

  // ── transporte ──
  handle: 'maleta', corners: true, standFeet: true,
  lid: false, lidT: 6, lidSkirt: 30, latches: 2,

  // ── acabado ──
  cover: 'tolex', coverColor: '#232325', frameFinish: 'negro', frameColor: '#1d1d1f', coverT: 1.2,

  // ── mesa (contexto) ──
  scenery: true, mapStyle: 'mazmorra',
};

export const PLY = {
  abedul: { label: 'Abedul (báltico)', rho: 680, E: 8500, G: 620, MOR: 60 },
  chopo: { label: 'Chopo', rho: 460, E: 5500, G: 420, MOR: 35 },
  pino: { label: 'Pino / okumen', rho: 520, E: 6500, G: 500, MOR: 40 },
};

export const PROTECTORS = {
  ninguno: { label: 'Sin protector', t: 0 },
  acrilico3: { label: 'Metacrilato 3 mm', t: 3, rho: 1190, E: 3200, nu: 0.37, MOR: 70, mat: 'acrylic' },
  acrilico4: { label: 'Metacrilato 4 mm', t: 4, rho: 1190, E: 3200, nu: 0.37, MOR: 70, mat: 'acrylic' },
  acrilico5: { label: 'Metacrilato 5 mm', t: 5, rho: 1190, E: 3200, nu: 0.37, MOR: 70, mat: 'acrylic' },
  policarb4: { label: 'Policarbonato 4 mm', t: 4, rho: 1200, E: 2300, nu: 0.38, MOR: 90, mat: 'acrylic' },
  vidrio4: { label: 'Vidrio templado 4 mm', t: 4, rho: 2500, E: 70000, nu: 0.22, MOR: 120, mat: 'glass' },
};

export const COVERS = {
  ninguno: { label: 'Sin revestir (madera vista)', kgm2: 0 },
  tolex: { label: 'Tolex (vinilo de amplificador)', kgm2: 0.55 },
  polipiel: { label: 'Polipiel / cuero sintético', kgm2: 0.5 },
  terciopelo: { label: 'Terciopelo', kgm2: 0.35 },
  fieltro: { label: 'Fieltro 2 mm', kgm2: 0.4 },
  corcho: { label: 'Corcho 2 mm', kgm2: 0.45 },
  pintura: { label: 'Pintura / esmalte', kgm2: 0.15 },
};

export const SCHEMA = [
  { id: 'tv', label: 'Televisor', icon: 'tv', params: [
    { k: 'tvW', l: 'Ancho total', u: 'mm', min: 600, max: 1500, step: 0.1 },
    { k: 'tvH', l: 'Alto total', u: 'mm', min: 350, max: 900, step: 0.1 },
    { k: 'tvD', l: 'Fondo máximo (joroba)', u: 'mm', min: 20, max: 120, step: 0.1 },
    { k: 'tvRimD', l: 'Fondo en el borde · medir', u: 'mm', min: 6, max: 80, step: 0.5 },
    { k: 'tvKg', l: 'Peso sin peana', u: 'kg', min: 3, max: 30, step: 0.1 },
    { k: 'screenW', l: 'Área visible · ancho', u: 'mm', min: 500, max: 1500, step: 0.1 },
    { k: 'screenH', l: 'Área visible · alto', u: 'mm', min: 300, max: 900, step: 0.1 },
    { k: 'bezelBottom', l: 'Marco inferior de la tele · medir', u: 'mm', min: 4, max: 60, step: 0.5 },
    { k: 'bumpW', l: 'Joroba trasera · ancho · medir', u: 'mm', min: 100, max: 1400, step: 1 },
    { k: 'bumpH', l: 'Joroba trasera · alto · medir', u: 'mm', min: 100, max: 800, step: 1 },
    { k: 'bumpDz', l: 'Joroba · desplazada hacia abajo', u: 'mm', min: -200, max: 200, step: 1 },
    { k: 'vesa', l: 'Patrón VESA', u: 'mm', min: 75, max: 400, step: 25 },
    { k: 'vesaDx', l: 'VESA · desvío lateral · medir', u: 'mm', min: -200, max: 200, step: 1 },
    { k: 'vesaDz', l: 'VESA · desvío hacia abajo · medir', u: 'mm', min: -200, max: 200, step: 1 },
    { k: 'portSide', l: 'Lado de conexiones', type: 'select', opts: { derecha: 'Derecha (mirando la pantalla)', izquierda: 'Izquierda' } },
    { k: 'irHole', l: 'Ventana para el receptor del mando (IR)', type: 'bool' },
    { k: 'irDx', l: 'Receptor IR · desvío desde el centro · medir', u: 'mm', min: -480, max: 480, step: 1 },
  ] },
  { id: 'caja', label: 'Caja', icon: 'box', params: [
    { k: 't', l: 'Grosor del contrachapado', u: 'mm', min: 6, max: 18, step: 1 },
    { k: 'plyType', l: 'Tipo de contrachapado', type: 'select', opts: Object.fromEntries(Object.entries(PLY).map(([k, v]) => [k, v.label])) },
    { k: 'fit', l: 'Holgura tele ↔ caja', u: 'mm', min: 0, max: 15, step: 0.5 },
    { k: 'margin', l: 'Margen interior (cámara perimetral)', u: 'mm', min: 0, max: 120, step: 1 },
    { k: 'portBay', l: 'Bahía extra en el lado de conexiones', u: 'mm', min: 0, max: 200, step: 1 },
    { k: 'gapBelow', l: 'Hueco bajo la joroba', u: 'mm', min: 5, max: 80, step: 1 },
    { k: 'gasket', l: 'Burlete bajo el marco', u: 'mm', min: 0, max: 10, step: 0.5 },
    { k: 'joint', l: 'Unión de esquinas', type: 'select', opts: { tope: 'A tope + taco interior', rebaje: 'Rebaje (galce) + taco', dedos: 'Dedos (finger joint, CNC o sierra)' } },
    { k: 'battenW', l: 'Listón interior · ancho', u: 'mm', min: 10, max: 40, step: 1 },
    { k: 'battenH', l: 'Listón interior · alto', u: 'mm', min: 10, max: 40, step: 1 },
    { k: 'cornerBlocks', l: 'Tacos verticales en esquinas', type: 'bool' },
    { k: 'footH', l: 'Altura de patas de goma', u: 'mm', min: 0, max: 30, step: 1 },
    { k: 'feet', l: 'Número de patas', type: 'select', opts: { 4: '4', 6: '6', 8: '8' } },
  ] },
  { id: 'marco', label: 'Marco y protector', icon: 'frame', params: [
    { k: 'frame', l: 'Tipo de marco', type: 'select', opts: { rebaje: 'Doble capa con pozo para el protector', simple: 'Simple (protector pinzado bajo el marco)' } },
    { k: 'frame2Split', l: 'Capa superior en 4 listones (ahorra un tablero)', type: 'bool' },
    { k: 'pockets', l: 'Bolsillos para dados en el marco (necesita margen ≥ 40)', type: 'bool' },
    { k: 'cardSlots', l: 'Ranuras para cartas en el canto del jugador', type: 'bool' },
    { k: 'reveal', l: 'Holgura sobre área visible', u: 'mm', min: -5, max: 10, step: 0.5 },
    { k: 'protector', l: 'Protector de pantalla', type: 'select', opts: Object.fromEntries(Object.entries(PROTECTORS).map(([k, v]) => [k, v.label])) },
    { k: 'protOverlap', l: 'Apoyo del protector en el marco', u: 'mm', min: 4, max: 30, step: 1 },
  ] },
  { id: 'soporte', label: 'Sujeción de la tele', icon: 'vesa', params: [
    { k: 'mount', l: 'Sistema', type: 'select', opts: { vesa: 'Travesaños VESA colgados', espuma: 'Tacos de espuma sobre la base' } },
    { k: 'railW', l: 'Travesaño · ancho', u: 'mm', min: 20, max: 80, step: 1 },
    { k: 'railH', l: 'Travesaño · alto', u: 'mm', min: 10, max: 50, step: 1 },
    { k: 'hangerW', l: 'Taco colgador · fondo', u: 'mm', min: 10, max: 60, step: 1 },
  ] },
  { id: 'base', label: 'Base extraíble', icon: 'base', params: [
    { k: 'baseFix', l: 'Fijación', type: 'select', opts: { insertos: 'Tornillos M5 + insertos roscados', tirafondos: 'Tornillos para madera', magnetos: 'Imanes + 4 tornillos' } },
    { k: 'baseScrews', l: 'Número de tornillos', u: 'ud', min: 4, max: 30, step: 1 },
    { k: 'baseVents', l: 'Agujeros de ventilación en la base', type: 'bool' },
  ] },
  { id: 'cables', label: 'Cables, aire y sonido', icon: 'plug', params: [
    { k: 'source', l: 'Fuente de imagen', type: 'select', opts: { externa: 'Portátil / PC fuera (sale HDMI + corriente)', stick: 'Chromecast / Fire TV Stick dentro (solo corriente)', minipc: 'Mini-PC (Raspberry Pi) dentro (solo corriente)' } },
    { k: 'cable', l: 'Salida de cables', type: 'select', opts: { pasamuros: '2 pasamuros redondos', panel: 'Conectores de panel (HDMI + IEC)', ranura: 'Ranura abierta al canto inferior' } },
    { k: 'cableDia', l: 'Diámetro pasamuros', u: 'mm', min: 16, max: 50, step: 1 },
    { k: 'cableY', l: 'Altura relativa de la salida', u: '', min: 0.2, max: 0.8, step: 0.05 },
    { k: 'vents', l: 'Rejillas de ventilación laterales', type: 'bool' },
    { k: 'ventCount', l: 'Ranuras por lado', u: 'ud', min: 2, max: 16, step: 1 },
    { k: 'fans', l: 'Ventiladores USB 5 V (2 × 60 mm)', type: 'bool' },
    { k: 'speakerSlots', l: 'Ranuras para los altavoces', type: 'bool' },
  ] },
  { id: 'transporte', label: 'Transporte', icon: 'handle', params: [
    { k: 'handle', l: 'Asa', type: 'select', opts: { maleta: 'Asa de maleta (canto largo)', embutida: 'Asa embutida (canto largo)', laterales: 'Dos asas embutidas laterales', ninguna: 'Sin asa' } },
    { k: 'corners', l: 'Cantoneras metálicas', type: 'bool' },
    { k: 'standFeet', l: 'Topes para dejarla de pie', type: 'bool' },
    { k: 'lid', l: 'Tapa de transporte', type: 'bool' },
    { k: 'lidT', l: 'Tapa · grosor del tablero', type: 'select', opts: { 4: '4 mm (muy ligera)', 6: '6 mm', 10: '10 mm (el mismo de la caja)' } },
    { k: 'lidSkirt', l: 'Tapa · alto del faldón', u: 'mm', min: 15, max: 80, step: 1 },
    { k: 'latches', l: 'Cierres de palanca', type: 'select', opts: { 2: '2', 4: '4' } },
  ] },
];

export const PARAM_INDEX = Object.fromEntries(SCHEMA.flatMap(g => g.params.map(p => [p.k, { ...p, group: g.id }])));

// Combinaciones de partida: geometría + montaje + estética.
export const PRESETS = [
  { id: 'maleta', label: 'Maleta', sub: 'tolex negro, asa, cantoneras', p: { frame: 'rebaje', cover: 'tolex', coverColor: '#232325', frameFinish: 'negro', handle: 'maleta', corners: true, lid: false, margin: 20, protector: 'acrilico4' } },
  { id: 'flight', label: 'Flight case', sub: 'con tapa y cierres', p: { frame: 'rebaje', cover: 'tolex', coverColor: '#2e2f31', frameFinish: 'negro', handle: 'maleta', corners: true, lid: true, latches: 4, margin: 20, protector: 'acrilico4' } },
  { id: 'taberna', label: 'Taberna', sub: 'madera vista y terciopelo', p: { frame: 'rebaje', cover: 'terciopelo', coverColor: '#4a1f24', frameFinish: 'madera', handle: 'laterales', corners: false, lid: false, margin: 60, protector: 'vidrio4', pockets: true } },
  { id: 'minimal', label: 'Mínima', sub: 'lo más fina y ligera', p: { frame: 'simple', cover: 'pintura', coverColor: '#2b2d30', frameFinish: 'negro', handle: 'ninguna', corners: false, lid: false, margin: 8, protector: 'ninguno', gapBelow: 22, cornerBlocks: true } },
  { id: 'cuero', label: 'Biblioteca', sub: 'polipiel marrón, asa embutida', p: { frame: 'rebaje', cover: 'polipiel', coverColor: '#5b3a26', frameFinish: 'madera', handle: 'embutida', corners: true, lid: false, margin: 30, protector: 'acrilico5' } },
];
