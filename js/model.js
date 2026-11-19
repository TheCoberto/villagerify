// Villager and player models. The bone lists use Bedrock geometry coordinates so
// the same data drives the three.js preview and the exported .geo.json.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const VILLAGER_BONES = [
  { name: 'head', pivot: [0, 24, 0], cubes: [{ origin: [-4, 24, -4], size: [8, 10, 8], uv: [0, 0] }] },
  { name: 'nose', parent: 'head', pivot: [0, 26, 0], cubes: [{ origin: [-1, 23, -6], size: [2, 4, 2], uv: [24, 0] }] },
  {
    name: 'body', pivot: [0, 24, 0], cubes: [
      { origin: [-4, 12, -3], size: [8, 12, 6], uv: [16, 20] },
      { origin: [-4, 4, -3], size: [8, 20, 6], uv: [0, 38], inflate: 0.5 },
    ],
  },
  {
    name: 'arms', pivot: [0, 21, -1], rotation: [-42.97, 0, 0], cubes: [
      { origin: [-8, 15, -3], size: [4, 8, 4], uv: [44, 22] },
      { origin: [4, 15, -3], size: [4, 8, 4], uv: [44, 22], mirror: true },
      { origin: [-4, 15, -3], size: [8, 4, 4], uv: [40, 38] },
    ],
  },
  { name: 'leg0', pivot: [-2, 12, 0], cubes: [{ origin: [-4, 0, -2], size: [4, 12, 4], uv: [0, 22] }] },
  { name: 'leg1', pivot: [2, 12, 0], cubes: [{ origin: [0, 0, -2], size: [4, 12, 4], uv: [0, 22], mirror: true }] },
];

const PLAYER_BONES = [
  {
    name: 'head', pivot: [0, 24, 0], cubes: [
      { origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 0] },
      { origin: [-4, 24, -4], size: [8, 8, 8], uv: [32, 0], inflate: 0.5 },
    ],
  },
  { name: 'body', pivot: [0, 24, 0], cubes: [{ origin: [-4, 12, -2], size: [8, 12, 4], uv: [16, 16] }] },
  { name: 'arm0', pivot: [-5, 22, 0], cubes: [{ origin: [-8, 12, -2], size: [4, 12, 4], uv: [40, 16] }] },
  { name: 'arm1', pivot: [5, 22, 0], cubes: [{ origin: [4, 12, -2], size: [4, 12, 4], uv: [32, 48] }] },
  { name: 'leg0', pivot: [-1.9, 12, 0], cubes: [{ origin: [-3.9, 0, -2], size: [4, 12, 4], uv: [0, 16] }] },
  { name: 'leg1', pivot: [1.9, 12, 0], cubes: [{ origin: [-0.1, 0, -2], size: [4, 12, 4], uv: [16, 48] }] },
];

// three.js BoxGeometry face order: +x, -x, +y, -y, +z, -z.
// Front is +z here (Bedrock's -z), so the entity's right side is -x.
const FACE_ORDER = ['left', 'right', 'top', 'bottom', 'front', 'back'];

function boxUV(geo, [u, v], [w, h, d], mirror) {
  const rects = {
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h], front: [u + d, v + d, w, h],
    left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  };
  const uv = geo.attributes.uv;
  FACE_ORDER.forEach((name, i) => {
    let key = name;
    if (mirror && (name === 'left' || name === 'right')) key = name === 'left' ? 'right' : 'left';
    const [x, y, fw, fh] = rects[key];
    let u0 = x / 64, u1 = (x + fw) / 64;
    if (mirror) [u0, u1] = [u1, u0];
    const vt = 1 - y / 64, vb = 1 - (y + fh) / 64;
    const k = i * 4;
    uv.setXY(k, u0, vt); uv.setXY(k + 1, u1, vt); uv.setXY(k + 2, u0, vb); uv.setXY(k + 3, u1, vb);
  });
  uv.needsUpdate = true;
}

function buildModel(bones, material) {
  const root = new THREE.Group();
  const groups = {};
  for (const b of bones) {
    const g = new THREE.Group();
    const parent = b.parent ? groups[b.parent] : null;
    const pv = new THREE.Vector3(b.pivot[0], b.pivot[1], -b.pivot[2]);
    const parentPv = parent ? parent.userData.pivot : new THREE.Vector3();
    g.position.copy(pv).sub(parentPv);
    g.userData.pivot = pv;
    if (b.rotation) g.rotation.set(THREE.MathUtils.degToRad(b.rotation[0]), 0, 0);
    for (const c of b.cubes) {
      const inf = c.inflate || 0;
      const [w, h, d] = c.size;
      const geo = new THREE.BoxGeometry(w + inf * 2, h + inf * 2, d + inf * 2);
      boxUV(geo, c.uv, c.size, c.mirror);
      const m = new THREE.Mesh(geo, material);
      const cx = c.origin[0] + w / 2, cy = c.origin[1] + h / 2, cz = -(c.origin[2] + d / 2);
      m.position.set(cx - pv.x, cy - pv.y, cz - pv.z);
      g.add(m);
    }
    (parent || root).add(g);
    groups[b.name] = g;
  }
  root.userData.bones = groups;
  return root;
}

export class Viewer {
  constructor(canvas, villagerCanvas, skinCanvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 1, 500);
    this.camera.position.set(28, 30, 62);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 17, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 140;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.6;

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(20, 50, 40);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-30, 10, -20);
    this.scene.add(fill);

    const tex = c => {
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false;
      return t;
    };
    this.vTex = tex(villagerCanvas);
    this.sTex = tex(skinCanvas);
    const mat = t => new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, transparent: false, side: THREE.FrontSide });
    this.villager = buildModel(VILLAGER_BONES, mat(this.vTex));
    this.player = buildModel(PLAYER_BONES, mat(this.sTex));
    this.scene.add(this.villager, this.player);
    this.setMode('villager');

    this.walk = true;
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    const loop = () => { this.tick(); requestAnimationFrame(loop); };
    loop();
  }
  setMode(mode) {
    this.mode = mode;
    this.villager.visible = mode === 'villager';
    this.player.visible = mode === 'skin';
    this.controls.target.set(0, mode === 'villager' ? 17 : 16, 0);
  }
  refresh() { this.vTex.needsUpdate = true; this.sTex.needsUpdate = true; }
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  tick() {
    const t = this.clock.getElapsedTime();
    const swing = this.walk ? Math.sin(t * 4) * 0.5 : 0;
    for (const model of [this.villager, this.player]) {
      const b = model.userData.bones;
      b.leg0.rotation.x = swing; b.leg1.rotation.x = -swing;
      if (b.arm0) { b.arm0.rotation.x = -swing; b.arm1.rotation.x = swing; }
      b.head.rotation.y = Math.sin(t * 0.7) * 0.25;
      b.head.rotation.x = Math.sin(t * 0.45) * 0.08;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  // Renders the current view at a fixed size with a transparent background.
  snapshot(size = 1024) {
    const prev = new THREE.Vector2();
    this.renderer.getSize(prev);
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.camera.aspect = 1; this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(prev.x, prev.y, false);
    this.resize();
    return url;
  }
}
