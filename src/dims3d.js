// Cotas dibujadas dentro de la escena 3D: líneas gruesas con trazos a 45° y el valor como
// texto plano alineado con su línea, que gira sobre el eje de la cota para mirar a la cámara.
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export const DIM_COLORS = { edit: 0xc24e14, hover: 0xff7a1a, ro: 0x6f7780, note: 0x2c8597 };
const FONT = '600 120px "JetBrains Mono", ui-monospace, monospace';

const texCache = new Map();
function textTextures(str) {
  if (texCache.has(str)) return texCache.get(str);
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = FONT;
  const w = Math.ceil(ctx.measureText(str).width) + 48, h = 168;
  c.width = w; c.height = h;
  const make = halo => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.font = FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (halo) {
      x.lineJoin = 'round'; x.lineWidth = 26; x.strokeStyle = '#f3f0ea';
      x.strokeText(str, w / 2, h / 2 + 6); x.fillStyle = '#f3f0ea';
    } else x.fillStyle = '#ffffff';
    x.fillText(str, w / 2, h / 2 + 6);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const res = { fill: make(false), halo: make(true), aspect: w / h };
  texCache.set(str, res);
  return res;
}
export function clearTextCache() { texCache.forEach(t => { t.fill.dispose(); t.halo.dispose(); }); texCache.clear(); }

export function fmt(v) {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export class DimLayer {
  constructor(scale) {
    this.S = scale;
    this.group = new THREE.Group();
    this.group.scale.setScalar(scale);
    this.items = [];
    this.mats = [];
    this.res = new THREE.Vector2(1, 1);
    this.plane = new THREE.PlaneGeometry(1, 1);
  }

  setResolution(w, h) { this.res.set(w, h); this.mats.forEach(m => m.resolution.set(w, h)); }

  lineMat(color, width, opacity, overlay) {
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: !overlay, worldUnits: false });
    m.resolution.copy(this.res);
    this.mats.push(m);
    return m;
  }

  clear() {
    for (const it of this.items) {
      it.root.traverse(o => { if (o.geometry && o.geometry !== this.plane) o.geometry.dispose(); });
      it.textMat.dispose(); it.haloMat.dispose();
    }
    this.mats.forEach(m => m.dispose());
    this.mats = [];
    this.items = [];
    this.group.clear();
  }

  build(dims) {
    this.clear();
    for (const dm of dims) {
      if (dm.hidden) continue;
      const root = new THREE.Group();
      root.userData.layer = dm.layer;
      const overlay = !!dm.overlay;
      let a2, b2, dir, len, value;
      if (dm.type === 'note') {
        a2 = new THREE.Vector3(...dm.at); b2 = a2.clone(); dir = new THREE.Vector3(1, 0, 0); len = 0;
      } else {
        const a = new THREE.Vector3(...dm.a), b = new THREE.Vector3(...dm.b);
        dir = b.clone().sub(a); len = dir.length();
        if (len < 0.5) continue;
        dir.normalize();
        const off = new THREE.Vector3(...dm.off);
        a2 = a.clone().add(off); b2 = b.clone().add(off);
        value = dm.value ?? len;
        const col = dm.readonly ? DIM_COLORS.ro : DIM_COLORS.edit;
        // líneas de referencia
        if (off.length() > 1) {
          const e = off.clone().normalize();
          const ext = [a.clone().addScaledVector(e, 12), a2.clone().addScaledVector(e, 22), b.clone().addScaledVector(e, 12), b2.clone().addScaledVector(e, 22)];
          const lg = new LineSegmentsGeometry().setPositions(ext.flatMap(v => v.toArray()));
          const l = new LineSegments2(lg, this.lineMat(col, 1, 0.5, overlay));
          l.renderOrder = 900;
          root.add(l);
        }
        // línea de cota + trazos oblicuos
        let nrm = off.length() > 1 ? off.clone().normalize() : new THREE.Vector3(0, 0, 1).cross(dir);
        if (nrm.lengthSq() < 0.1) nrm = new THREE.Vector3(1, 0, 0).cross(dir);
        nrm.normalize();
        const tick = dir.clone().add(nrm).normalize().multiplyScalar(16);
        const seg = [
          a2.clone().addScaledVector(dir, -14), b2.clone().addScaledVector(dir, 14),
          a2.clone().sub(tick), a2.clone().add(tick), b2.clone().sub(tick), b2.clone().add(tick),
        ];
        const mg = new LineSegmentsGeometry().setPositions(seg.flatMap(v => v.toArray()));
        const main = new LineSegments2(mg, this.lineMat(col, 1.7, 0.95, overlay));
        main.renderOrder = 901;
        root.add(main);
      }

      const str = dm.type === 'note' ? dm.text : fmt(value);
      const tx = textTextures(str);
      const color = dm.type === 'note' ? DIM_COLORS.note : dm.readonly ? DIM_COLORS.ro : DIM_COLORS.edit;
      const haloMat = new THREE.MeshBasicMaterial({ map: tx.halo, transparent: true, opacity: 0.88, depthWrite: false, depthTest: !overlay, toneMapped: false });
      const textMat = new THREE.MeshBasicMaterial({ map: tx.fill, color, transparent: true, depthWrite: false, depthTest: !overlay, toneMapped: false });
      const label = new THREE.Group();
      const halo = new THREE.Mesh(this.plane, haloMat);
      const text = new THREE.Mesh(this.plane, textMat);
      halo.renderOrder = 902; text.renderOrder = 903;
      text.position.z = 0.4;
      label.add(halo, text);
      root.add(label);
      this.group.add(root);
      const editable = dm.type !== 'note' && !dm.readonly;
      const item = { dm, root, label, text, textMat, haloMat, aspect: tx.aspect, a2, b2, dir, value, editable, base: color, hover: false };
      text.userData.dimItem = item;
      this.items.push(item);
    }
  }

  setLayers(layers) { for (const it of this.items) it.root.visible = layers.has(it.dm.layer); }

  setHover(item) {
    for (const it of this.items) {
      const on = it === item;
      if (on === it.hover) continue;
      it.hover = on;
      it.textMat.color.setHex(on && it.editable ? DIM_COLORS.hover : it.base);
    }
  }

  pickables() { return this.items.filter(it => it.root.visible && it.label.visible).map(it => it.text); }

  // Orienta y escala cada etiqueta según la cámara actual
  update(camera, aspect) {
    const S = this.S;
    const camLocal = camera.position.clone().divideScalar(S);
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const orthoSpan = camera.isOrthographicCamera ? (camera.top - camera.bottom) / camera.zoom / S : 0;
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), m = new THREE.Matrix4();
    for (const it of this.items) {
      if (!it.root.visible) continue;
      const mid = it.a2.clone().lerp(it.b2, it.dm.at ?? 0.5);
      const dist = camera.isPerspectiveCamera ? camLocal.distanceTo(mid) : orthoSpan * 1.05;
      const h = 54 * THREE.MathUtils.clamp(dist / 3600, 0.42, 1.7) * (it.hover && it.editable ? 1.12 : 1);
      let u = it.dir.clone();
      const toCam = camera.isPerspectiveCamera ? camLocal.clone().sub(mid) : fwd.clone().negate();
      let n = toCam.clone().addScaledVector(u, -toCam.dot(u));
      if (n.lengthSq() < 1e-6) n = new THREE.Vector3(0, 1, 0).cross(u);
      n.normalize();
      // legible: el texto siempre de izquierda a derecha (o de abajo arriba)
      p0.copy(mid).multiplyScalar(S).project(camera);
      p1.copy(mid).addScaledVector(u, 100).multiplyScalar(S).project(camera);
      const ang = Math.atan2(p1.y - p0.y, (p1.x - p0.x) * aspect) * 180 / Math.PI;
      if (ang > 95 || ang < -85) u.negate();
      const v = new THREE.Vector3().crossVectors(n, u).normalize();
      m.makeBasis(u, v, n);
      it.label.quaternion.setFromRotationMatrix(m);
      it.label.position.copy(mid).addScaledVector(v, it.dm.type === 'note' ? 0 : h * 0.5 + 6).addScaledVector(n, 1);
      it.label.scale.set(h * it.aspect, h, 1);
    }
  }
}
