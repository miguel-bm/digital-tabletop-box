import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { solidGeometry } from './geometry.js';
import { DimLayer, fmt } from './dims3d.js';
import { MaterialFactory, mapCanvas } from './materials.js';
import { Q } from './quality.js';

export { fmt };
const S = 0.001;

// Capas que se pueden mostrar/ocultar desde el dock
export const LAYERS = {
  caja: { label: 'Paredes', roles: ['pared'] },
  marco: { label: 'Marco', roles: ['marco', 'burlete'] },
  protector: { label: 'Protector', roles: ['protector'] },
  tv: { label: 'Tele', roles: ['tv'] },
  interior: { label: 'Listones y tacos', roles: ['liston', 'taco', 'travesano', 'espuma'] },
  base: { label: 'Base', roles: ['base'] },
  piel: { label: 'Revestimiento', roles: ['piel'] },
  herrajes: { label: 'Herrajes', roles: ['fixture'] },
  tapa: { label: 'Tapa', roles: ['tapa'] },
  escena: { label: 'Mesa y fichas', roles: ['scenery'] },
};
const roleLayer = Object.fromEntries(Object.entries(LAYERS).flatMap(([k, v]) => v.roles.map(r => [r, k])));

export class Viewer {
  constructor(host, { onHover, onPick } = {}) {
    this.host = host;
    this.onHover = onHover; this.onPick = onPick;
    this.state = { explode: 0, hidden: new Set(['tapa']), edges: true, xray: false, section: false, lidOn: false };
    this.anim = { explode: 0, lid: 0, flip: 0 };
    this.flipTarget = 0;
    this.mats = new MaterialFactory();

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Q.pixelRatio);
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = Q.shadows;
    r.shadowMap.type = Q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.localClippingEnabled = true;
    host.appendChild(r.domElement);

    const scene = (this.scene = new THREE.Scene());
    if (Q.env) {
      const pmrem = new THREE.PMREMGenerator(r);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.5;
      pmrem.dispose();
    }
    this.persp = new THREE.PerspectiveCamera(30, 1, 0.02, 60);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 40);
    this.camera = this.persp;
    this.persp.position.set(-0.9, 1.25, 1.55);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.05, 0);
    this.controls.maxDistance = 8;

    scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb9b2a6, Q.env ? 0.5 : 1.2));
    const key = (this.key = new THREE.DirectionalLight(0xfff3e2, 2.2));
    key.position.set(-1.2, 2.6, 1.6);
    key.castShadow = true;
    key.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
    Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.5, far: 6 });
    key.shadow.bias = -0.0002; key.shadow.normalBias = 0.01; key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe9ff, 0.5); fill.position.set(2, 1.5, -1); scene.add(fill);

    // mesa
    this.tableGroup = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 1.3), this.mats.table());
    table.position.y = -0.02; table.receiveShadow = true;
    this.tableGroup.add(table);
    this.tableGroup.userData.layer = 'escena';
    scene.add(this.tableGroup);

    this.model = new THREE.Group(); this.model.scale.setScalar(S); scene.add(this.model);
    this.fx = new THREE.Group(); this.fx.scale.setScalar(S); scene.add(this.fx);
    this.dims = new DimLayer(S); scene.add(this.dims.group);
    this.dimLayers = new Set(['general']);
    this.overlay = new THREE.Group(); this.overlay.scale.setScalar(S); scene.add(this.overlay);

    this.section = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.mats.clip = [];

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    r.domElement.addEventListener('pointermove', e => this.pointerMove(e));
    r.domElement.addEventListener('pointerleave', () => this.setHover(null));
    r.domElement.addEventListener('pointerdown', e => { this.downAt = { x: e.clientX, y: e.clientY }; });
    r.domElement.addEventListener('pointerup', e => {
      if (!this.downAt || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 4) return;
      this.onPick && this.onPick(this.hovered ? this.hovered.userData.piece : null);
    });
    this.highlight = null;   // { now:Set(ids), done:Set(ids) } en la guía
    this.autoFit = true;
    this.controls.addEventListener('start', () => { this.autoFit = false; this.camTween = null; });
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.clock = new THREE.Clock();
    r.setAnimationLoop(() => this.tick());
  }

  // desplaza el centro óptico para que el modelo quede entre los paneles laterales
  setInsets(left, right, bottom = 0) { this.insets = [left, right, bottom]; this.resize(); if (this.autoFit && this.design) this.fit(true); }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.renderer.setSize(w, h);
    this.persp.aspect = w / h;
    const [l, r, b = 0] = this.insets || [0, 0, 0];
    const shift = (l - r) / 2, vs = b / 2;
    if (Math.abs(shift) > 1 || vs > 1) { this.persp.setViewOffset(w, h, -shift, vs, w, h); this.ortho.setViewOffset(w, h, -shift, vs, w, h); }
    else { this.persp.clearViewOffset(); this.ortho.clearViewOffset(); }
    this.persp.updateProjectionMatrix();
    this.updateOrtho();
    this.dims.setResolution(w, h);
  }
  updateOrtho() {
    const w = this.host.clientWidth, h = this.host.clientHeight, s = this.orthoSpan || 1.4;
    const a = w / h;
    Object.assign(this.ortho, { left: -s * a / 2, right: s * a / 2, top: s / 2, bottom: -s / 2 });
    this.ortho.updateProjectionMatrix();
  }

  // ───────── construcción ─────────
  setDesign(d) {
    this.design = d;
    this.mats.setStyle(d.params);
    this.mats.clip = this.state.section ? [this.section] : [];
    const dispose = g => g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    dispose(this.model); this.model.clear();
    dispose(this.fx); this.fx.clear();
    this.groups = new Map();
    const edgeMat = (this.edgeMat = new THREE.LineBasicMaterial({ color: 0x3a3226, transparent: true, opacity: 0.28 }));
    this.hiMat = new THREE.LineBasicMaterial({ color: 0xff8a1a, transparent: true, opacity: 1, depthTest: false });
    edgeMat.clippingPlanes = this.mats.clip; this.hiMat.clippingPlanes = this.mats.clip;
    for (const pc of d.pieces) {
      const g = new THREE.Group();
      g.userData = { piece: pc, layer: roleLayer[pc.role] || 'caja', explode: pc.explode || [0, 0, 0] };
      if (pc.role === 'tv') this.buildTV(g, pc, d);
      else {
        for (const so of pc.solids) {
          const geo = solidGeometry(so);
          if (!geo) continue;
          const th = Math.abs(so.t[1] - so.t[0]);
          const mesh = new THREE.Mesh(geo, this.mats.get(pc.mat, pc.role === 'pared' && pc.solids.length > 1 ? th * 2 : th));
          mesh.castShadow = pc.role !== 'protector'; mesh.receiveShadow = true;
          mesh.userData.piece = pc;
          if (pc.role === 'protector') mesh.renderOrder = 5;
          g.add(mesh);
          const eg = new THREE.EdgesGeometry(geo, 25);
          const lines = new THREE.LineSegments(eg, edgeMat);
          lines.userData.edges = true;
          g.add(lines);
        }
      }
      this.model.add(g);
      this.groups.set(pc.id, g);
    }
    for (const f of d.fixtures) this.buildFixture(f);
    const lt = d.pieces.find(pc => pc.key === 'lidTop');
    this.lidTop = lt ? { top: lt.solids[0].t[1], Z: lt.solids[0].rect[3] - lt.solids[0].rect[1] } : null;
    this.buildScenery(d);
    this.dims.build(d.dims.map(x => ({ ...x, off: [0, 0, 0], readonly: true, value: x.v })));
    this.applyVisibility();
    this.setEdges(this.state.edges);
    if (this.state.xray) this.mats.setXray(true);
    if (this.autoFit) this.fit(false);
  }

  buildTV(g, pc, d) {
    const tv = pc.tv, p = d.params;
    const w = tv.x1 - tv.x0, h = tv.z1 - tv.z0;
    const bodyMat = this.mats.get('tvback'), bezel = this.mats.get('plastic');
    const rimT = tv.yS - tv.yRim;
    const rim = new THREE.Mesh(new RoundedBoxGeometry(w, rimT, h, 2, 3), [bezel, bezel, bezel, bodyMat, bezel, bezel]);
    rim.position.set((tv.x0 + tv.x1) / 2, tv.yRim + rimT / 2, (tv.z0 + tv.z1) / 2);
    const bump = new THREE.Mesh(new RoundedBoxGeometry(tv.bump.w, tv.yRim - tv.yB + 4, tv.bump.h, 3, 14), bodyMat);
    bump.position.set(tv.bump.cx, (tv.yB + tv.yRim + 4) / 2, tv.bump.cz);
    const mapTex = new THREE.CanvasTexture(mapCanvas(p.mapStyle, d.metrics.inchPx));
    mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 8;
    this.mapTex && this.mapTex.dispose(); this.mapTex = mapTex;
    const scrMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: mapTex, emissiveIntensity: p.mapStyle === 'apagada' ? 0 : 0.95, roughness: 0.25, ...(Q.physical ? { clearcoat: 0.6, clearcoatRoughness: 0.15 } : {}) });
    scrMat.clippingPlanes = this.mats.clip;
    const sw = tv.scr.x1 - tv.scr.x0, sh = tv.scr.z1 - tv.scr.z0;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), scrMat);
    screen.rotation.x = -Math.PI / 2;
    screen.position.set((tv.scr.x0 + tv.scr.x1) / 2, tv.yS + 0.3, (tv.scr.z0 + tv.scr.z1) / 2);
    // VESA
    const vm = this.mats.get('darkmetal');
    const vg = new THREE.CylinderGeometry(6, 6, 2, 12);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const m = new THREE.Mesh(vg, vm); m.position.set(tv.vesa.x + a * tv.vesa.s / 2, tv.yB - 0.5, tv.vesa.z + b * tv.vesa.s / 2); g.add(m);
    });
    // logo
    [rim, bump, screen].forEach(m => { m.castShadow = true; m.receiveShadow = true; m.userData.piece = pc; g.add(m); });
    rim.material.forEach && rim.material.forEach(m => (m.clippingPlanes = this.mats.clip));
  }

  buildFixture(f) {
    const m = this.mats;
    const grp = new THREE.Group();
    grp.userData = { layer: f.lid ? 'tapa' : 'herrajes', fixture: f, explode: [0, 0, 0] };
    const add = (geo, mat, x, y, z, rot) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); if (rot) me.rotation.set(...rot); me.castShadow = true; grp.add(me); return me; };
    const [x, y, z] = f.pos;
    if (f.kind === 'foot') add(new THREE.CylinderGeometry(f.r, f.r * 0.85, f.h, 20), m.get('rubber'), x, f.h / 2, z);
    else if (f.kind === 'handle') {
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(-f.span / 2, 0, 0), new THREE.Vector3(-f.span / 2 + 8, 0, -26), new THREE.Vector3(0, 0, -32), new THREE.Vector3(f.span / 2 - 8, 0, -26), new THREE.Vector3(f.span / 2, 0, 0),
      ]), 40, 9, 12);
      add(tube, m.get('rubber'), x, y, z - 2);
      [-1, 1].forEach(s => add(new THREE.BoxGeometry(26, 34, 8), m.get('metal'), x + s * f.span / 2, y, z - 4));
      grp.userData.explode = [0, 0, -120];
    } else if (f.kind === 'dish') {
      // asa embutida: brida metálica, cazo oscuro y barra
      const ax = f.axis === 'x';
      const dims = (a, b, c) => (ax ? [c, b, a] : [a, b, c]);
      const out = ax ? -f.sgn : -1;   // hacia fuera de la pared
      const plate = add(new RoundedBoxGeometry(...dims(f.w, f.h, 2.5), 2, 4), m.get('metal'), x + (ax ? out * 1.2 : 0), y, z + (ax ? 0 : out * 1.2));
      const recess = add(new RoundedBoxGeometry(...dims(f.w - 18, f.h - 16, 1), 2, 6), m.get('plastic'), x + (ax ? out * 2.6 : 0), y, z + (ax ? 0 : out * 2.6));
      const bar = add(new RoundedBoxGeometry(...dims(f.w - 40, 9, 7), 2, 3), m.get('rubber'), x + (ax ? out * 3.5 : 0), y + f.h * 0.12, z + (ax ? 0 : out * 3.5));
      [plate, recess, bar].forEach(o => (o.castShadow = false));
    } else if (f.kind === 'corner') {
      const [sx, sy, sz] = f.s, L = 32, th = 1.5;
      const mat = m.get('metal');
      const shell = new THREE.Group();
      [[L, th, L, 0, 0], [th, L, L, 1, 0], [L, L, th, 0, 1]].forEach(([a, b, c]) => {
        const me = new THREE.Mesh(new RoundedBoxGeometry(a, b, c, 1, 0.6), mat);
        me.position.set(-sx * (a / 2 - th), sy * (b / 2 - th), -sz * (c / 2 - th));
        shell.add(me);
      });
      shell.position.set(x + sx * th, y + (sy > 0 ? -th : th), z + sz * th);
      grp.add(shell);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10, 0, 6.3, 0, 1.2), mat);
      dot.position.set(x + sx * 0.5, y, z + sz * 0.5);
      dot.lookAt(x + sx * 100, y + sy * -100 * -1, z + sz * 100);
      grp.add(dot);
    } else if (f.kind === 'bumper') add(new THREE.CylinderGeometry(10, 10, 6, 16), m.get('rubber'), x, y, z + 3, [Math.PI / 2, 0, 0]);
    else if (f.kind === 'fan') {
      add(new THREE.BoxGeometry(60, 60, 15), m.get('plastic'), x, y, z + 7.5);
      const hub = add(new THREE.CylinderGeometry(14, 14, 16, 20), m.get('darkmetal'), x, y, z + 7.5, [Math.PI / 2, 0, 0]);
      hub.userData.spin = true;
    } else if (f.kind === 'iec') {
      add(new THREE.BoxGeometry(4, 22, 50), m.get('plastic'), x + f.sgn * 2, y, z);
      add(new THREE.BoxGeometry(5, 14, 20), m.get('rubber'), x + f.sgn * 3, y, z);
    } else if (f.kind === 'hdmi') {
      add(new THREE.BoxGeometry(3, 16, 40), m.get('darkmetal'), x + f.sgn * 1.5, y, z);
      add(new THREE.BoxGeometry(4, 6, 15), m.get('rubber'), x + f.sgn * 2.5, y, z);
    } else if (f.kind === 'grommet') {
      add(new THREE.TorusGeometry(f.r, 2.5, 8, 28), m.get('rubber'), x + f.sgn * 1, y, z, [0, Math.PI / 2, 0]);
    } else if (f.kind === 'port') {
      add(new THREE.BoxGeometry(6, 12, f.k === 'power' ? 22 : 60), m.get('darkmetal'), x + f.sgn * 2, y, z);
    } else if (f.kind === 'cable') {
      const curve = new THREE.CatmullRomCurve3(f.pts.map(q => new THREE.Vector3(...q)));
      const me = add(new THREE.TubeGeometry(curve, 80, f.r, 8), new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.55 }), 0, 0, 0);
      me.userData.cable = true;
    } else if (f.kind === 'ir') {
      add(new THREE.CylinderGeometry(3, 3, 1, 12), new THREE.MeshStandardMaterial({ color: 0x3a0d0d, emissive: 0x550000, roughness: 0.3 }), x, y + 0.2, z);
    } else if (f.kind === 'latch') {
      add(new RoundedBoxGeometry(36, 44, 8, 2, 2), m.get('metal'), x, y, z + f.s * 4);
    }
    grp.traverse(o => { if (o.isMesh) o.userData.fixture = f; });
    this.fx.add(grp);
  }

  buildScenery(d) {
    const g = new THREE.Group();
    g.userData = { layer: 'escena', explode: [0, 0, 0], scenery: true };
    const m = d.metrics, top = m.twoLayer && m.pt ? m.yF + d.params.t + m.pt : m.yS + (m.pt && !m.twoLayer ? m.pt : 0);
    const cell = 25.4;
    const colors = [0x7a2e2e, 0x2e4f7a, 0x3d6b3a, 0x7a6a2e, 0x5b3a7a];
    const minis = [[-6, -2], [-5, -3], [-4, -1], [3, 2], [4, 1], [7, -4]];
    minis.forEach(([cx, cz], i) => {
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.6 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(12, 12.5, 3, 24), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 }));
      base.position.set(m.tv.cx + cx * cell + cell / 2, top + 1.5, cz * cell + cell / 2);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(5, 14, 4, 10), mat);
      body.position.set(base.position.x, top + 3 + 12, base.position.z);
      const head = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8), mat);
      head.position.set(base.position.x, top + 3 + 25, base.position.z);
      [base, body, head].forEach(o => { o.castShadow = true; g.add(o); });
    });
    const d20 = new THREE.Mesh(new THREE.IcosahedronGeometry(11), new THREE.MeshPhysicalMaterial({ color: 0x9b1d2a, roughness: 0.3, ...(Q.physical ? { clearcoat: 0.8 } : {}) }));
    d20.position.set(m.tv.cx + 250, top + 9, 140); d20.rotation.set(0.4, 0.8, 0.1); d20.castShadow = true;
    const d6 = new THREE.Mesh(new RoundedBoxGeometry(16, 16, 16, 2, 2.5), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.4 }));
    d6.position.set(m.tv.cx + 285, top + 8, 165); d6.rotation.y = 0.5; d6.castShadow = true;
    g.add(d20, d6);
    // dados en los bolsillos del marco
    (m.pockets || []).forEach((r, i) => {
      const y = m.yF + d.params.t;
      for (let k = 0; k < 3; k++) {
        const die = k === 1 ? new THREE.Mesh(new THREE.OctahedronGeometry(8), new THREE.MeshStandardMaterial({ color: [0x2e4f7a, 0x7a2e2e][i % 2], roughness: 0.35 })) : new THREE.Mesh(new RoundedBoxGeometry(14, 14, 14, 2, 2), new THREE.MeshStandardMaterial({ color: [0xe9e4d8, 0x1c1c1c][(i + k) % 2], roughness: 0.4 }));
        die.position.set((r[0] + r[2]) / 2 + (k - 1) * 3, y + 7, r[1] + 40 + k * 55);
        die.rotation.set(k, k * 0.7, 0.3); die.castShadow = true; g.add(die);
      }
    });
    this.fx.add(g);
  }

  // ───────── estado visual ─────────
  applyVisibility() {
    const hid = this.state.hidden, hi = this.highlight;
    const vis = o => {
      const L = o.userData.layer;
      if (hid.has(L)) return false;
      if (hi) {
        const pc = o.userData.piece;
        if (pc) return hi.now.has(pc.id) || hi.done.has(pc.id);
        if (o.userData.fixture) return hi.fixtures.has(o.userData.fixture.step);
        if (o.userData.scenery) return false;
      }
      if (o.userData.scenery && this.state.lidOn) return false;
      return true;
    };
    this.model.children.forEach(g => { g.visible = vis(g); });
    this.fx.children.forEach(g => { g.visible = vis(g); });
    this.tableGroup.visible = (!hid.has('escena') || !!hi) && !this.overlayHides;
    // resaltado
    this.model.children.forEach(g => {
      const on = hi && hi.now.has(g.userData.piece.id);
      g.children.forEach(c => { if (c.userData.edges) { c.material = on ? this.hiMat : this.edgeMat; c.visible = on || this.state.edges; c.renderOrder = on ? 10 : 0; } });
    });
    this.dims.setLayers(hi ? new Set() : this.dimLayers);
  }
  setHidden(set) { this.state.hidden = set; this.applyVisibility(); }
  setDimLayers(set) { this.dimLayers = set; this.applyVisibility(); }
  setEdges(on) { this.state.edges = on; this.applyVisibility(); }
  setXray(on) { this.state.xray = on; this.mats.setXray(on); }
  setSection(on) {
    this.state.section = on;
    if (this.design) this.setDesign(this.design);
  }
  setExplode(v) { this.state.explode = v; }
  setLid(on) { this.state.lidOn = on; this.applyVisibility(); }
  // capa de resultados (cálculos): oculta el modelo si se pide
  setOverlay(obj, { hideModel = false } = {}) {
    this.overlay.clear();
    if (obj) this.overlay.add(obj);
    this.overlayHides = !!(obj && hideModel);
    this.model.visible = !this.overlayHides;
    this.fx.visible = !this.overlayHides;
    this.tableGroup.visible = !this.overlayHides && !this.state.hidden.has('escena');
    this.dims.group.visible = !obj;
  }
  setFlip(on) { this.flipTarget = on ? 1 : 0; }
  setHighlight(h) { this.highlight = h; this.applyVisibility(); }

  // ───────── interacción ─────────
  pointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = [];
    this.model.traverseVisible(o => { if (o.isMesh && o.userData.piece) meshes.push(o); });
    const hits = this.raycaster.intersectObjects(meshes, false).filter(h => !this.state.section || h.point.z / S <= 0.01 || true);
    const hit = hits.find(h => h.object.userData.piece.role !== 'protector') || hits[0];
    this.setHover(hit ? hit.object : null, e);
  }
  setHover(obj, e) {
    if (this.hovered === obj) { if (obj && this.onHover) this.onHover(obj.userData.piece, e); return; }
    if (this.hovered && this.hovered.material && this.hovered.userData.hiMat) { this.hovered.material = this.hovered.userData.hiMat; }
    this.hovered = obj;
    this.onHover && this.onHover(obj ? obj.userData.piece : null, e);
    this.renderer.domElement.style.cursor = obj ? 'pointer' : '';
  }

  // ───────── cámara ─────────
  view(name, animate = true) {
    this.viewName = name;
    const M = this.design ? this.design.metrics : { X: 1040, Z: 640, H: 110 };
    const span = Math.max(M.outer.X, M.outer.Z * 1.6) * S;
    const cy = (M.H / 2) * S;
    let pos, target = new THREE.Vector3(0, cy, 0), ortho = true, up = new THREE.Vector3(0, 1, 0);
    if (name === 'persp') { ortho = false; const w = this.host.clientWidth - ((this.insets || [0, 0])[0] + (this.insets || [0, 0])[1]), h = this.host.clientHeight - 190 - ((this.insets || [])[2] || 0);
      const vf = THREE.MathUtils.degToRad(this.persp.fov) / 2, hf = Math.atan(Math.tan(vf) * Math.max(0.3, w / Math.max(200, h)));
      const dist = Math.max((0.74 * span) / Math.tan(hf), (0.42 * span) / Math.tan(vf));
      pos = new THREE.Vector3(-0.85, 1.35, 1.85).normalize().multiplyScalar(dist); target.set(0.04 * span, 0, 0.05 * span); }
    else if (name === 'top') { pos = new THREE.Vector3(0, 3, 0.0001); up = new THREE.Vector3(0, 0, -1); }
    else if (name === 'front') { pos = new THREE.Vector3(0, cy, 3); }
    else if (name === 'side') { pos = new THREE.Vector3(3, cy, 0); }
    else if (name === 'section') { ortho = false; pos = new THREE.Vector3(0.55 * span, 0.25 * span, 0.75 * span); target.set(0.25 * span, cy, 0); }
    this.useCamera(ortho ? this.ortho : this.persp);
    if (ortho) { this.orthoSpan = name === 'top' ? Math.max(M.outer.Z * 1.25, M.outer.X * 0.9 * this.host.clientHeight / this.host.clientWidth) * S : M.outer.X * 0.72 * S * this.host.clientHeight / this.host.clientWidth + 0.2; this.updateOrtho(); }
    this.camera.up.copy(up);
    if (!animate) { this.camera.position.copy(pos); this.controls.target.copy(target); this.controls.update(); return; }
    this.camTween = { from: this.camera.position.clone(), to: pos, tf: this.controls.target.clone(), tt: target, t: 0 };
  }
  useCamera(cam) {
    if (this.camera === cam) return;
    this.camera = cam;
    this.controls.object = cam;
    this.controls.enableRotate = cam === this.persp;
  }
  fit(animate = true) { this.view(this.viewName || 'persp', animate); }
  flyTo(pos, target) {
    this.useCamera(this.persp);
    this.camera.up.set(0, 1, 0);
    this.camTween = { from: this.camera.position.clone(), to: new THREE.Vector3(...pos).multiplyScalar(S), tf: this.controls.target.clone(), tt: new THREE.Vector3(...target).multiplyScalar(S), t: 0 };
  }

  tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const k = 1 - Math.pow(0.0015, dt);
    this.anim.explode += (this.state.explode - this.anim.explode) * k;
    this.anim.lid += ((this.state.lidOn ? 1 : 0) - this.anim.lid) * k;
    this.anim.flip += (this.flipTarget - this.anim.flip) * k * 0.8;
    this.pose(dt);
    if (this.camTween) {
      const c = this.camTween; c.t = Math.min(1, c.t + dt * 2.2);
      const s = c.t * c.t * (3 - 2 * c.t);
      this.camera.position.lerpVectors(c.from, c.to, s);
      this.controls.target.lerpVectors(c.tf, c.tt, s);
      if (c.t >= 1) this.camTween = null;
    }
    this.controls.update();
    this.dims.update(this.camera, this.host.clientWidth / this.host.clientHeight);
    this.renderer.render(this.scene, this.camera);
  }

  // coloca piezas y herrajes según explosión, volteo y tapa
  pose(dt = 0) {
    const th = Math.PI * this.anim.flip, cyS = (this.design ? (this.design.metrics.y0 + this.design.metrics.outer.H) / 2 : 50) * S;
    const lift = Math.sin(th) * 0.35;
    const e = this.anim.explode;
    const exLift = e * 0.2 * (1 - this.anim.flip) + e * 0.05;
    for (const g of [this.model, this.fx]) {
      g.rotation.x = th;
      g.position.set(0, cyS * (1 - Math.cos(th)) + lift + exLift, -cyS * Math.sin(th));
    }
    // tapa: puesta (1) o de pie apoyada detrás de la caja (0)
    const la = this.anim.lid, lt = this.lidTop;
    const lidPos = new THREE.Vector3(), lidQ = new THREE.Quaternion();
    if (lt) {
      const offQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 * 0.93);
      const offP = new THREE.Vector3(0, lt.Z / 2 + 4, -(lt.top) - lt.Z / 2 - 140);
      lidQ.copy(offQ).slerp(new THREE.Quaternion(), la);
      lidPos.copy(offP).multiplyScalar(1 - la).add(new THREE.Vector3(0, Math.sin(Math.PI * la) * 260, 0));
    }
    for (const g of this.model.children) {
      const v = g.userData.explode;
      const pc = g.userData.piece;
      if (pc.lid) { g.quaternion.copy(lidQ); g.position.set(lidPos.x, lidPos.y + v[1] * e * la, lidPos.z); continue; }
      g.position.set(v[0] * e, v[1] * e, v[2] * e);
    }
    for (const g of this.fx.children) {
      const f = g.userData.fixture;
      if (!f) continue;
      const fol = f.follow && this.groups && this.groups.get(f.follow);
      const pcExp = f.kind === 'foot' ? [0, -200, 0] : fol ? fol.userData.explode : g.userData.explode;
      if (f.lid) { g.quaternion.copy(lidQ); g.position.copy(lidPos); }
      else g.position.set(pcExp[0] * e, pcExp[1] * e, pcExp[2] * e);
      g.traverse(o => { if (o.userData.spin) o.rotation.y += dt * 12; });
    }
  }

  // Imagen fija (para los planos): vista isométrica con piezas separadas y la posición en pantalla de cada pieza
  snapshot({ w = 2000, h = 1200, explode = 1, hide = ['escena', 'tapa', 'piel'] } = {}) {
    const saved = { anim: { ...this.anim }, hidden: this.state.hidden, hi: this.highlight, ov: this.overlay.visible, dims: this.dims.group.visible, flip: this.flipTarget };
    Object.assign(this.anim, { explode, flip: 0, lid: 0 });
    this.highlight = null; this.state.hidden = new Set(hide);
    this.applyVisibility();
    this.overlay.visible = false; this.dims.group.visible = false; this.tableGroup.visible = false;
    this.model.visible = true; this.fx.visible = true;
    this.pose(0);
    const M = this.design.metrics, span = M.outer.X * S;
    const cam = new THREE.PerspectiveCamera(24, w / h, 0.02, 60);
    cam.position.set(-0.9 * span, 1.55 * span, 1.75 * span);
    const tgt = new THREE.Vector3(0, 0.12, 0);
    cam.lookAt(tgt);
    // encuadre: aleja hasta que quepan todas las piezas
    const box = new THREE.Box3();
    this.model.children.forEach(g => { if (g.visible) box.expandByObject(g); });
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const dir = cam.position.clone().sub(sph.center).normalize();
    cam.position.copy(sph.center).addScaledVector(dir, sph.radius / Math.sin(THREE.MathUtils.degToRad(12)) * 0.92);
    cam.lookAt(sph.center);
    cam.updateMatrixWorld();
    const r = this.renderer;
    r.setPixelRatio(1); r.setSize(w, h, false);
    r.setClearColor(0xffffff, 1);
    r.render(this.scene, cam);
    const url = r.domElement.toDataURL('image/jpeg', 0.9);
    const labels = [];
    this.model.children.forEach(g => {
      if (!g.visible) return;
      const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).project(cam);
      labels.push({ id: g.userData.piece.id, name: g.userData.piece.name, x: (c.x + 1) / 2 * w, y: (1 - c.y) / 2 * h });
    });
    // restaurar
    this.anim = saved.anim; this.state.hidden = saved.hidden; this.highlight = saved.hi; this.flipTarget = saved.flip;
    this.overlay.visible = saved.ov; this.dims.group.visible = saved.dims;
    if (this.overlayHides) { this.model.visible = false; this.fx.visible = false; }
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Q.pixelRatio); this.resize();
    this.applyVisibility();
    return { url, labels, w, h };
  }

  png() { return this.renderer.domElement.toDataURL('image/png'); }
}
