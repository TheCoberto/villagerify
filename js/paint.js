// Paints villager and player-skin textures (64x64) from a set of face features.
// Box UV layout follows Minecraft: for a box of size (w,h,d) at (u,v):
//   top (u+d, v, w, d)      bottom (u+d+w, v, w, d)
//   right (u, v+d, d, h)    front (u+d, v+d, w, h)
//   left (u+d+w, v+d, d, h) back (u+2d+w, v+d, w, h)

export const SIZE = 64;

// ---------- colour helpers ----------
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(c => Math.round(clamp(c)).toString(16).padStart(2, '0')).join('');
}
const clamp = c => Math.max(0, Math.min(255, c));
export const shade = (c, f) => c.map(v => clamp(v * f));
export const mix = (a, b, t) => a.map((v, i) => clamp(v + (b[i] - v) * t));
export const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- canvas helper ----------
class Pix {
  constructor(seed) {
    this.data = new Uint8ClampedArray(SIZE * SIZE * 4);
    this.rand = rng(seed);
  }
  set(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !c) return;
    const i = (y * SIZE + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a;
  }
  // slight per-pixel variation so flat colours look like Minecraft textures
  jit(c, amt) {
    return shade(c, 1 + (this.rand() * 2 - 1) * amt);
  }
  box(u, v, w, h, d, fn) {
    const faces = {
      top: [u + d, v, w, d], bottom: [u + d + w, v, w, d],
      right: [u, v + d, d, h], front: [u + d, v + d, w, h],
      left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
    };
    for (const [face, [fx, fy, fw, fh]] of Object.entries(faces)) {
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        const c = fn(face, x, y, fw, fh);
        if (c) this.set(fx + x, fy + y, c);
      }
    }
  }
}

// distance (in pixels) from the front edge on a side face
const toFront = (face, x, fw) => face === 'right' ? fw - 1 - x : x;

function palette(f) {
  return {
    skin: f.skin, skinDark: shade(f.skin, 0.86), skinLight: shade(f.skin, 1.07),
    hair: f.hair, hairDark: shade(f.hair, 0.8),
    robe: f.robe, robeDark: shade(f.robe, 0.82), trim: f.trim,
    pants: f.pants, shoes: f.shoes,
    white: [236, 236, 230], eye: f.eye, brow: f.brow, beard: f.beard,
    frame: [28, 28, 32], lens: [40, 46, 60],
  };
}

// ---------- head (shared by villager and skin) ----------
// rows: how tall the head is. layout gives the rows used for each feature.
function paintHead(p, f, P, u, v, w, h, d, L) {
  const hasHair = f.hairStyle !== 'none';
  const long = f.hairStyle === 'long';
  const bald = !hasHair;
  p.box(u, v, w, h, d, (face, x, y, fw, fh) => {
    if (face === 'top') return hasHair ? p.jit(P.hair, 0.08) : p.jit(P.skinLight, 0.03);
    if (face === 'bottom') {
      if (f.beardStyle === 'full') return p.jit(P.beard, 0.08);
      return p.jit(P.skinDark, 0.03);
    }
    if (face === 'back') {
      const hairRows = long ? h : Math.ceil(h * 0.6);
      if (hasHair && y < hairRows) return p.jit(y === hairRows - 1 && !long ? P.hairDark : P.hair, 0.08);
      return p.jit(P.skin, 0.03);
    }
    if (face === 'left' || face === 'right') {
      const tf = toFront(face, x, fw);
      let hairRows = long ? h : (tf >= 2 ? 3 : 2);
      if (!long && tf >= fw - 3) hairRows = Math.ceil(h * 0.6); // toward the back
      if (hasHair && y < hairRows) return p.jit(P.hair, 0.08);
      if (f.beardStyle === 'full' && tf <= 2 && y >= L.beardTop) return p.jit(P.beard, 0.08);
      if (f.beardStyle === 'stubble' && tf <= 1 && y >= L.beardTop + 1) return mix(P.skin, P.beard, 0.35);
      return p.jit(y === fh - 1 ? P.skinDark : P.skin, 0.03);
    }
    // front face
    return frontPixel(p, f, P, x, y, w, h, L, hasHair, long, bald);
  });
}

function frontPixel(p, f, P, x, y, w, h, L, hasHair, long) {
  const ex = [1, 2, w - 3, w - 2]; // eye columns: white, iris, iris, white
  // hair
  if (hasHair) {
    if (y === 0) return p.jit(P.hair, 0.08);
    if (y === 1 && ![3, 4].includes(x) && !(x === 2 && long)) return p.jit(P.hairDark, 0.06);
    if (long && (x === 0 || x === w - 1) && y <= L.eye + 1) return p.jit(P.hair, 0.08);
  }
  // glasses
  if (f.glasses !== 'none' && y === L.eye) {
    if (x === 0 || x === w - 1 || x === 3 || x === 4) return P.frame;
    if (f.glasses === 'shades') return P.lens;
  }
  if (f.glasses !== 'none' && y === L.eye + 1 && [1, 2, w - 3, w - 2].includes(x)) return P.frame;
  // brows
  if (y === L.brow) {
    if (f.browStyle === 'uni' && x >= 1 && x <= w - 2) return p.jit(P.brow, 0.05);
    if (f.browStyle === 'two' && [1, 2, w - 3, w - 2].includes(x)) return p.jit(P.brow, 0.05);
  }
  // eyes
  if (y === L.eye) {
    if (x === ex[0] || x === ex[3]) return P.white;
    if (x === ex[1] || x === ex[2]) return P.eye;
  }
  const nose = (x === 3 || x === 4) && y >= L.noseTop;
  // facial hair
  if (!nose && y >= L.beardTop) {
    if (f.beardStyle === 'full') return p.jit(P.beard, 0.08);
    if (f.beardStyle === 'mustache' && y <= L.beardTop + 1 && x >= 1 && x <= w - 2) return p.jit(P.beard, 0.06);
    if (f.beardStyle === 'stubble') return p.jit(mix(P.skin, P.beard, 0.35), 0.06);
  }
  if (y === h - 1) return p.jit(P.skinDark, 0.03);
  if (y === L.eye + 1 && (x === 1 || x === w - 2)) return p.jit(mix(P.skin, [220, 90, 90], 0.12), 0.02); // cheeks
  return p.jit(P.skin, 0.03);
}

// ---------- villager ----------
export function paintVillager(f) {
  const p = new Pix(f.seed);
  const P = palette(f);
  // head 8x10x8 at (0,0)
  paintHead(p, f, P, 0, 0, 8, 10, 8, { brow: 4, eye: 5, noseTop: 7, beardTop: 7 });
  // nose 2x4x2 at (24,0)
  p.box(24, 0, 2, 4, 2, (face, x, y, fw, fh) => {
    if (face === 'bottom') return P.skinDark;
    if (face === 'top') return P.skinLight;
    if (face === 'front' && y === 0) return P.skinLight;
    if (y === fh - 1) return P.skinDark;
    return p.jit(P.skin, 0.03);
  });
  // body 8x12x6 at (16,20)
  p.box(16, 20, 8, 12, 6, () => p.jit(P.robeDark, 0.05));
  // robe overlay 8x20x6 at (0,38)
  p.box(0, 38, 8, 20, 6, (face, x, y, fw, fh) => {
    if (face === 'top' || face === 'bottom') return p.jit(P.robeDark, 0.05);
    if (y >= fh - 2) return p.jit(P.trim, 0.05);           // hem
    if (y === 8) return p.jit(P.trim, 0.04);                // belt
    if (face === 'front' && f.beardStyle === 'full' && y <= 1 && x >= 2 && x <= 5) return p.jit(P.beard, 0.08);
    if (face === 'front' && (x === 3 || x === 4) && y < 8) return p.jit(P.robeDark, 0.05);
    return p.jit(P.robe, 0.06);
  });
  // arms: two sleeves 4x8x4 at (44,22) and the crossed bar 8x4x4 at (40,38)
  p.box(44, 22, 4, 8, 4, (face, x, y, fw, fh) => {
    if (face === 'bottom') return p.jit(P.trim, 0.04);
    if (face !== 'top' && y === fh - 1) return p.jit(P.trim, 0.04);
    return p.jit(P.robe, 0.06);
  });
  p.box(40, 38, 8, 4, 4, (face, x, y, fw) => {
    if ((face === 'front' || face === 'top' || face === 'bottom') && x >= 2 && x <= fw - 3) return p.jit(P.skin, 0.03);
    if (face === 'front' && (x === 1 || x === fw - 2)) return p.jit(P.trim, 0.04);
    return p.jit(P.robe, 0.06);
  });
  // legs 4x12x4 at (0,22)
  p.box(0, 22, 4, 12, 4, (face, x, y, fw, fh) => {
    if (face === 'bottom' || y >= fh - 2) return p.jit(P.shoes, 0.05);
    return p.jit(P.pants, 0.05);
  });
  return p.data;
}

// ---------- player skin (classic 64x64, 4px arms) ----------
export function paintSkin(f) {
  const p = new Pix(f.seed + 1);
  const P = palette(f);
  paintHead(p, f, P, 0, 0, 8, 8, 8, { brow: 2, eye: 3, noseTop: 4, beardTop: 5 });
  // villager nose on the hat layer so it pops out a little (not in the photo look)
  p.box(32, 0, 8, 8, 8, (face, x, y) => {
    if (f.photoFace || face !== 'front' || (x !== 3 && x !== 4) || y < 3) return null;
    if (y === 3) return P.skinLight;
    if (y === 7) return P.skinDark;
    return p.jit(P.skin, 0.03);
  });
  const robeBody = (face, x, y, fw, fh) => {
    if (face === 'top' || face === 'bottom') return p.jit(P.robeDark, 0.05);
    if (y === 8) return p.jit(P.trim, 0.04);
    if (face === 'front' && f.beardStyle === 'full' && y <= 1 && x >= 2 && x <= 5) return p.jit(P.beard, 0.08);
    if (face === 'front' && (x === 3 || x === 4) && y < 8) return p.jit(P.robeDark, 0.05);
    return p.jit(P.robe, 0.06);
  };
  p.box(16, 16, 8, 12, 4, robeBody);
  const arm = (face, x, y, fw, fh) => {
    if (face === 'bottom') return p.jit(P.skin, 0.03);
    if (face === 'top') return p.jit(P.robe, 0.06);
    if (y >= fh - 2) return p.jit(P.skin, 0.03);
    if (y === fh - 3) return p.jit(P.trim, 0.04);
    return p.jit(P.robe, 0.06);
  };
  p.box(40, 16, 4, 12, 4, arm);
  p.box(32, 48, 4, 12, 4, arm);
  const leg = (face, x, y, fw, fh) => {
    if (face === 'bottom' || y >= fh - 2) return p.jit(P.shoes, 0.05);
    if (face === 'top') return p.jit(P.robeDark, 0.05);
    if (y < 7) return p.jit(P.robe, 0.06);
    if (y === 7) return p.jit(P.trim, 0.04);
    return p.jit(P.pants, 0.05);
  };
  p.box(0, 16, 4, 12, 4, leg);
  p.box(16, 48, 4, 12, 4, leg);
  return p.data;
}

// ---------- defaults ----------
export function defaultFeatures() {
  return {
    skin: [198, 146, 112], hair: [74, 50, 34], hairStyle: 'short',
    eye: [52, 120, 60], brow: [60, 40, 28], browStyle: 'uni',
    beard: [74, 50, 34], beardStyle: 'none', glasses: 'none',
    robe: [120, 84, 56], trim: [84, 58, 38], pants: [62, 48, 40], shoes: [48, 34, 26],
    seed: 7,
  };
}
