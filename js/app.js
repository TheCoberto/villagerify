import { SIZE, paintVillager, paintSkin, defaultFeatures, hexToRgb, rgbToHex } from './paint.js';
import { Viewer } from './model.js';
import { villagerTexturePack, villagerVariantPack, skinPack, villagerAddon, canvasBlob, download, slugify } from './export.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let features = defaultFeatures();
const edits = { villager: new Map(), skin: new Map() };
let mode = 'villager';
let tool = 'paint';

const tex = {
  villager: Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }),
  skin: Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }),
};
const viewer = new Viewer($('#viewer'), tex.villager, tex.skin);
const editor = $('#editor');
const ectx = editor.getContext('2d');

// ---------- painting ----------
function render() {
  draw(tex.villager, paintVillager(features), edits.villager);
  draw(tex.skin, paintSkin(features), edits.skin);
  viewer.refresh();
  drawEditor();
}
function draw(canvas, data, overrides) {
  const img = new ImageData(new Uint8ClampedArray(data), SIZE, SIZE);
  for (const [k, c] of overrides) {
    const i = k * 4;
    if (c) { img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
    else img.data[i + 3] = 0;
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
}
function drawEditor() {
  const s = editor.width / SIZE;
  ectx.imageSmoothingEnabled = false;
  ectx.clearRect(0, 0, editor.width, editor.height);
  ectx.drawImage(tex[mode], 0, 0, editor.width, editor.height);
  ectx.strokeStyle = 'rgba(128,128,128,0.18)';
  ectx.lineWidth = 1;
  ectx.beginPath();
  for (let i = 0; i <= SIZE; i += 1) {
    ectx.moveTo(i * s + 0.5, 0); ectx.lineTo(i * s + 0.5, editor.height);
    ectx.moveTo(0, i * s + 0.5); ectx.lineTo(editor.width, i * s + 0.5);
  }
  ectx.stroke();
}

// ---------- controls ----------
const COLOR_KEYS = ['skin', 'hair', 'eye', 'brow', 'beard', 'robe', 'trim', 'pants', 'shoes'];
const SELECT_KEYS = ['hairStyle', 'browStyle', 'beardStyle', 'glasses'];
function syncControls() {
  for (const k of COLOR_KEYS) $(`#c-${k}`).value = rgbToHex(features[k]);
  for (const k of SELECT_KEYS) $(`#s-${k}`).value = features[k];
}
for (const k of COLOR_KEYS) $(`#c-${k}`).addEventListener('input', e => { features[k] = hexToRgb(e.target.value); render(); });
for (const k of SELECT_KEYS) $(`#s-${k}`).addEventListener('change', e => { features[k] = e.target.value; render(); });
$('#shuffle').addEventListener('click', () => { features.seed = (Math.random() * 1e9) | 0; render(); });

// ---------- photo ----------
const photo = $('#photo');
const pctx = photo.getContext('2d', { willReadFrequently: true });
const status = $('#status');
function setStatus(msg, kind = '') { status.textContent = msg; status.dataset.kind = kind; }

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return setStatus('That file is not an image.', 'error');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    URL.revokeObjectURL(url);
    const k = Math.min(1, 900 / Math.max(img.width, img.height));
    photo.width = Math.round(img.width * k); photo.height = Math.round(img.height * k);
    pctx.drawImage(img, 0, 0, photo.width, photo.height);
    const clean = pctx.getImageData(0, 0, photo.width, photo.height);
    $('#dropzone').classList.add('has-photo');
    setStatus('Finding your face…', 'busy');
    try {
      const { analyze } = await import('./face.js');
      const { features: f, overlay } = await analyze(photo, features);
      features = { ...f, seed: features.seed };
      edits.villager.clear(); edits.skin.clear();
      pctx.putImageData(clean, 0, 0);
      drawOverlay(overlay);
      syncControls();
      render();
      setStatus('Done! Tweak anything below that doesn’t look right.', 'ok');
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Could not read that photo. You can still build a villager by hand below.', 'error');
    }
  };
  img.onerror = () => setStatus('Could not open that image.', 'error');
  img.src = url;
}
function drawOverlay({ outline, samples }) {
  const w = photo.width, h = photo.height, lw = Math.max(2, w / 250);
  pctx.lineWidth = lw;
  pctx.strokeStyle = 'rgba(80, 220, 120, 0.9)';
  pctx.beginPath();
  outline.forEach(([x, y], i) => (i ? pctx.lineTo(x * w, y * h) : pctx.moveTo(x * w, y * h)));
  pctx.closePath();
  pctx.stroke();
  pctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  pctx.strokeStyle = 'rgba(20, 60, 30, 0.9)';
  for (const [x, y] of samples) {
    pctx.beginPath(); pctx.arc(x * w, y * h, lw * 2.2, 0, Math.PI * 2); pctx.fill(); pctx.stroke();
  }
}
$('#file').addEventListener('change', e => loadFile(e.target.files[0]));
const dz = $('#dropzone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); loadFile(e.dataTransfer.files[0]); });
window.addEventListener('paste', e => {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

// ---------- view mode ----------
function setMode(m) {
  mode = m;
  viewer.setMode(m);
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  drawEditor();
}
$$('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#spin').addEventListener('change', e => { viewer.controls.autoRotate = e.target.checked; });
$('#walk').addEventListener('change', e => { viewer.walk = e.target.checked; });

// ---------- pixel editor ----------
let drawing = false;
function paintAt(e) {
  const r = editor.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * SIZE);
  const y = Math.floor(((e.clientY - r.top) / r.height) * SIZE);
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const key = y * SIZE + x;
  if (tool === 'pick') {
    const d = tex[mode].getContext('2d').getImageData(x, y, 1, 1).data;
    if (d[3]) $('#brush').value = rgbToHex([d[0], d[1], d[2]]);
    setTool('paint');
    return;
  }
  edits[mode].set(key, tool === 'erase' ? null : hexToRgb($('#brush').value));
  render();
}
editor.addEventListener('pointerdown', e => { drawing = true; editor.setPointerCapture(e.pointerId); paintAt(e); });
editor.addEventListener('pointermove', e => { if (drawing && tool !== 'pick') paintAt(e); });
editor.addEventListener('pointerup', () => { drawing = false; });
function setTool(t) {
  tool = t;
  $$('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
}
$$('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#clear-edits').addEventListener('click', () => { edits[mode].clear(); render(); });

// ---------- downloads ----------
const name = () => ($('#name').value.trim() || 'Villager').replace(/[\r\n=]/g, '').slice(0, 40);
const fileBase = () => slugify(name()).replace(/_/g, '-');

function iconBlob() {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.fillStyle = rgbToHex(features.robe);
  x.fillRect(0, 0, 128, 128);
  // the villager's face (8x10) with its nose (2x4) on top
  x.drawImage(tex.villager, 8, 8, 8, 10, 24, 4, 80, 100);
  x.drawImage(tex.villager, 26, 2, 2, 4, 54, 64, 20, 40);
  return canvasBlob(c);
}
async function run(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { console.error(e); alert('Something went wrong: ' + e.message); }
  finally { btn.disabled = false; }
}
const actions = {
  'villager-png': async () => download(await canvasBlob(tex.villager), `${fileBase()}-villager.png`),
  'villager-pack': async () => download(await villagerTexturePack(await canvasBlob(tex.villager), await iconBlob(), name()), `${fileBase()}-villagers.mcpack`),
  'variant-pack': async () => download(await villagerVariantPack(await canvasBlob(tex.villager), await iconBlob(), name(), +$('#variant-slots').value), `${fileBase()}-villager-variant.mcpack`),
  'skin-png': async () => download(await canvasBlob(tex.skin), `${fileBase()}-skin.png`),
  'skin-pack': async () => download(await skinPack(await canvasBlob(tex.skin), name()), `${fileBase()}-skin.mcpack`),
  'addon': async () => download(await villagerAddon(await canvasBlob(tex.villager), await iconBlob(), name(), features), `${fileBase()}-villager.mcaddon`),
  'render': async () => {
    const url = viewer.snapshot(1024);
    download(await (await fetch(url)).blob(), `${fileBase()}-${mode === 'villager' ? 'villager' : 'skin'}-render.png`);
  },
};
$$('[data-download]').forEach(b => b.addEventListener('click', () => run(b, actions[b.dataset.download])));

syncControls();
render();// TEMP-TEST
if (location.search.includes('zt')) (async () => { HTMLAnchorElement.prototype.click = () => {};
  for (const k of ['villager-pack', 'variant-pack', 'skin-pack', 'addon']) {
    const orig = window.URL.createObjectURL;
    let blob; URL.createObjectURL = b => { blob = b; return 'about:blank'; };
    await actions[k](); URL.createObjectURL = orig;
    const z = await JSZip.loadAsync(blob);
    const ent = z.file('entity/villager_v2.entity.json');
    console.log('ZT ' + k + ' ' + blob.size + ' ' + Object.keys(z.files).filter(n => !n.endsWith('/')).join(',') + (ent ? ' TEX=' + JSON.stringify(JSON.parse(await ent.async('string'))['minecraft:client_entity'].description.textures).slice(0, 400) : ''));
  }
})();
