// Iconos de trazo (24×24, currentColor). Dibujados a propósito para este proyecto, sin dependencias.
const P = {
  cube: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  front: '<rect x="4" y="5" width="16" height="12" rx="1"/><path d="M3 20h18M9 5v12M15 5v12"/>',
  plan: '<path d="M3 4h18"/><rect x="4" y="7" width="16" height="9" rx="1"/><path d="M9 16v3h6v-3"/>',
  side: '<path d="M17 3v18H5"/><rect x="8" y="6" width="6" height="12" rx="1"/>',
  focus: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z"/>',
  setsquare: '<path d="M4 20V4l16 16H4Z"/><path d="M8 16v-4l4 4H8Z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  reset: '<path d="M4 4v6h6"/><path d="M5.5 15a7 7 0 1 0 1.6-7.4L4 10"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.7-1-2.9 0-1 .8-1.5 2-1.5h2A4.5 4.5 0 0 0 21 10.5C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="11" r=".9"/><circle cx="10" cy="7" r=".9"/><circle cx="15" cy="7.5" r=".9"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>',
  screw: '<path d="M8 3h8l-1 4H9z"/><path d="M12 7v13M10 10l4 1.5M10 13l4 1.5M10 16l4 1.5"/>',
  alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  ruler: '<path d="M3 15 15 3l6 6L9 21z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  arch: '<path d="M4 20V10a8 6 0 0 1 16 0v10"/><path d="M9.5 6.5 8 20M14.5 6.5 16 20"/>',
  nightstand: '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M5 9h14M5 14h14M11 17h2"/>',
  split: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M9 4v16M15 4v16" stroke-dasharray="2 2"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/>',
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><path d="M15 12h.01"/>',
  shelf: '<path d="M3 8h18v3H3zM6 11v9M18 11v9"/>',
  insert: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="7" rx=".5"/>',
  cabinet: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 9h8M4 15h8"/>',
  frame: '<path d="M5 20V4M19 20V4M5 7h14M5 17h14M5 7l14 10"/>',
  drawer: '<rect x="3" y="9" width="18" height="10" rx="1"/><path d="M10 14h4M5 9l2-4h10l2 4"/>',
  baseboard: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M6 16v4h12v-4"/>',
  wall: '<path d="M3 4h18v16H3zM3 9h18M3 14h18M9 4v5M15 9v5M9 14v6"/>',
  bed: '<path d="M3 19V7M21 19v-6a3 3 0 0 0-3-3h-8v5M3 13h18M3 17h18"/><circle cx="6.5" cy="10.5" r="1.5"/>',
  dooropen: '<path d="M3 21h18M6 21V4h8v17"/><path d="M14 4l5 2v15"/><path d="M11.5 12.5h.01"/>',
  explode: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  edges: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9" stroke-dasharray="1.5 2"/>',
  xray: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke-dasharray="2.5 2"/><circle cx="12" cy="12" r="3"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>',
  pillow: '<path d="M4 9c0-2 1-3 3-3h10c2 0 3 1 3 3v6c0 2-1 3-3 3H7c-2 0-3-1-3-3z"/><path d="M8 12h8"/>',
  room: '<path d="M3 20V6l9-3 9 3v14M3 20h18"/><path d="M9 20v-6h6v6"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="1"/><path d="M8 20h8M12 17v3"/>',
  box: '<path d="M3 8h18v10H3z"/><path d="M3 8l2-3h14l2 3M8 13h8"/>',
  vesa: '<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/><path d="M12 4v16"/>',
  base: '<path d="M3 15h18v3H3z"/><path d="M6 18v2M18 18v2M6 15V8h12v7"/>',
  handle: '<path d="M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/><rect x="3" y="11" width="18" height="9" rx="1.5"/>',
  sim: '<path d="M3 17c3 0 4-8 9-8s6 8 9 8"/><path d="M3 21h18M12 9V3"/>',
  dice: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  section: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16" stroke-dasharray="3 2"/><path d="M8 4v8"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 10v6"/>',
  cart: '<path d="M3 4h2l2.4 11h11L21 8H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

// Sustituye/antepone iconos en los elementos con data-icon y activa los tooltips de data-tip
export function decorate(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    if (el.querySelector(':scope > svg.ic')) return;
    // quitar el texto suelto (queda el icono y, si hay, data-label)
    [...el.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); });
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon) + (el.dataset.label ? `<span class="lbl">${el.dataset.label}</span>` : ''));
    if (!el.getAttribute('aria-label') && el.dataset.tip) el.setAttribute('aria-label', el.dataset.tip);
  });
}

let tipEl;
export function setupTips() {
  tipEl = document.createElement('div');
  tipEl.className = 'tip';
  tipEl.hidden = true;
  document.body.append(tipEl);
  let cur = null, timer;
  document.addEventListener('pointerover', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === cur) return;
    cur = t;
    clearTimeout(timer);
    tipEl.hidden = true;
    if (!t || e.pointerType === 'touch') return;
    timer = setTimeout(() => {
      tipEl.textContent = t.dataset.tip;
      tipEl.hidden = false;
      const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      const below = r.top < innerHeight / 2;
      tipEl.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px';
      tipEl.style.top = (below ? r.bottom + 7 : r.top - h - 7) + 'px';
    }, 180);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(timer); tipEl.hidden = true; });
}
