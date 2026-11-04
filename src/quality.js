// Calidad de render según el dispositivo. Escalones: alta → baja → minima → 2d (sin WebGL).
// En táctil/pantalla pequeña se empieza en 'baja'. Se fuerza con ?q=alta|baja|minima|2d (se recuerda).
const KEY = 'tabletop.quality';
const LEVELS = ['alta', 'baja', 'minima', '2d'];
function pick() {
  if (typeof window === 'undefined') return 'alta';             // Node (pruebas, generación de planos)
  const url = new URLSearchParams(location.search).get('q');
  if (LEVELS.includes(url)) { save(url); return url; }
  try { const s = localStorage.getItem(KEY); if (LEVELS.includes(s)) return s; } catch { /* sin almacenamiento */ }
  const touch = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 820;
  return touch || small ? 'baja' : 'alta';
}
function save(q) { try { localStorage.setItem(KEY, q); } catch { /* sin almacenamiento */ } }
export const QUALITY = pick();
export const LOW = QUALITY !== 'alta';
const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
export const Q = {
  alta:   { pixelRatio: Math.min(2, dpr),   antialias: true,  shadows: true,  shadowSize: 4096, softShadows: true,  areaLights: true,  env: true,  woodSize: 1024, floorSize: 2048, physical: true },
  baja:   { pixelRatio: Math.min(1.5, dpr), antialias: true,  shadows: true,  shadowSize: 1024, softShadows: false, areaLights: false, env: true,  woodSize: 512,  floorSize: 1024, physical: false },
  minima: { pixelRatio: 1,                  antialias: false, shadows: false, shadowSize: 512,  softShadows: false, areaLights: false, env: false, woodSize: 256,  floorSize: 512,  physical: false },
  '2d':   { pixelRatio: 1,                  antialias: false, shadows: false, shadowSize: 512,  softShadows: false, areaLights: false, env: false, woodSize: 256,  floorSize: 512,  physical: false },
}[QUALITY];
export const nextLevel = q => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(q) + 1)];
export function setQuality(q) { save(q); }

// Qué ofrece el navegador (para el diagnóstico)
export function glSupport() {
  const test = type => { try { const c = document.createElement('canvas'); const gl = c.getContext(type); if (gl) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return true; } } catch { /* nada */ } return false; };
  return { webgl2: test('webgl2'), webgl1: test('webgl') || test('experimental-webgl') };
}
