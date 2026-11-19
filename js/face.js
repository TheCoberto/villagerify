// Reads a photo with MediaPipe Face Landmarker (runs in the browser) and turns it
// into villager features: skin, hair, eyes, brows, facial hair and shirt colour.
import { lum, dist, shade, mix } from './paint.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise = null;
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(`${MP}/vision_bundle.mjs`);
      const fileset = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE', numFaces: 1,
      });
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

// Returns { features, points } or throws if no face is found.
export async function analyze(canvas, base) {
  const lm = await getLandmarker();
  const res = lm.detect(canvas);
  const pts = res.faceLandmarks && res.faceLandmarks[0];
  if (!pts) throw new Error('No face found in that photo. Try a clearer, front-facing picture.');

  const W = canvas.width, H = canvas.height;
  const img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const P = i => [pts[i].x * W, pts[i].y * H];
  const faceH = Math.hypot(...sub(P(10), P(152)));
  const faceW = Math.hypot(...sub(P(234), P(454)));
  const up = norm(sub(P(10), P(152)));
  const r = Math.max(2, faceW * 0.035);

  const pixels = (cx, cy, rad) => {
    const out = [];
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(W - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(H - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
      const i = (y * W + x) * 4;
      out.push([img[i], img[i + 1], img[i + 2]]);
    }
    return out;
  };
  const at = (pt, rad = r) => pixels(pt[0], pt[1], rad);
  const inside = pt => pt[0] >= 0 && pt[1] >= 0 && pt[0] < W && pt[1] < H;
  const shift = (pt, v, k) => [pt[0] + v[0] * k, pt[1] + v[1] * k];

  const skin = median([...at(P(50)), ...at(P(280)), ...at(P(151))]);

  // hair: above the forehead and temples
  const hairPts = [shift(P(10), up, faceH * 0.13), shift(P(54), up, faceH * 0.1), shift(P(284), up, faceH * 0.1)].filter(inside);
  const hairSample = hairPts.length ? median(hairPts.flatMap(pt => at(pt))) : null;
  const hasHair = hairSample && dist(hairSample, skin) > 45;
  // long hair: beside the jaw looks like the hair too
  const side = norm(sub(P(454), P(234)));
  const jawPts = [shift(P(172), side, -faceW * 0.12), shift(P(397), side, faceW * 0.12)].filter(inside);
  const long = hasHair && jawPts.length === 2 && jawPts.every(pt => dist(median(at(pt)), hairSample) < 28);

  // eyes: iris ring, skipping the pupil's darkest pixels and the glare
  const irisPx = [468, 473].flatMap(i => {
    const rad = Math.hypot(...sub(P(i), P(i + 1))) * 0.8;
    return at(P(i), Math.max(1.5, rad));
  }).sort((a, b) => lum(a) - lum(b));
  let eye = irisPx.length ? median(irisPx.slice(Math.floor(irisPx.length * 0.45), Math.floor(irisPx.length * 0.85))) : [80, 60, 40];
  eye = saturate(eye, 1.6);

  // brows: darkest third of the brow samples
  const browIdx = [70, 63, 105, 66, 107, 300, 293, 334, 296, 336];
  const browPx = browIdx.flatMap(i => at(P(i), r * 0.7)).sort((a, b) => lum(a) - lum(b));
  let brow = median(browPx.slice(0, Math.max(1, Math.floor(browPx.length * 0.15))));
  if (lum(skin) - lum(brow) < 50) brow = hasHair ? shade(hairSample, 0.75) : shade(skin, 0.5);

  // facial hair: chin and upper lip compared with the cheeks
  const chin = median([...at(P(152)), ...at(P(175)), ...at(P(148)), ...at(P(377))]);
  const lipPt = [(P(0)[0] + P(164)[0]) / 2, (P(0)[1] + P(164)[1]) / 2];
  const lip = median(at(lipPt, r * 0.6));
  const beardOf = c => lum(c) < lum(skin) * 0.62 && dist(c, skin) > 70;
  let beardStyle = 'none';
  if (beardOf(chin)) beardStyle = 'full';
  else if (beardOf(lip)) beardStyle = 'mustache';
  const beard = beardStyle === 'full' ? chin : beardStyle === 'mustache' ? lip : (hasHair ? hairSample : brow);

  // glasses: a dark frame across the nose bridge, between the eyes
  const bridge = median([...at(P(168), r * 0.5), ...at(P(6), r * 0.5)]);
  const glasses = lum(bridge) < lum(skin) * 0.55 ? 'glasses' : 'none';

  // shirt: below the chin
  const shirtPt = shift(P(152), up, -faceH * 0.55);
  const robe = inside(shirtPt) ? median(at(shirtPt, r * 2)) : base.robe;

  const features = {
    ...base,
    skin, eye, brow, beard, beardStyle, glasses,
    hair: hasHair ? hairSample : base.hair,
    hairStyle: hasHair ? (long ? 'long' : 'short') : 'none',
    robe, trim: shade(robe, 0.7), pants: mix(shade(robe, 0.5), [50, 50, 55], 0.5),
  };
  const outline = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  const eyes = [P(468), P(473)].sort((a, b) => a[0] - b[0]);
  return {
    anchors: { eyeL: eyes[0], eyeR: eyes[1], chin: P(152) },
    features,
    overlay: {
      outline: outline.map(i => [pts[i].x, pts[i].y]),
      samples: [P(50), P(280), P(151), ...hairPts, P(468), P(473), P(152), lipPt, shirtPt]
        .filter(inside).map(([x, y]) => [x / W, y / H]),
    },
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function median(list) {
  if (!list.length) return [128, 128, 128];
  return [0, 1, 2].map(ch => {
    const s = list.map(c => c[ch]).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  });
}
function saturate(c, k) {
  const g = lum(c);
  return c.map(v => Math.max(0, Math.min(255, g + (v - g) * k)));
}
