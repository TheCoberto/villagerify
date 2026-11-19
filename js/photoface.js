// "Photo face" look: pastes the real face from the photo onto the texture.
// The photo is rotated so the eyes are level, then stretched one of two ways:
//   fill    - cheek to cheek and forehead to chin cover the whole head front
//   natural - the eyes and chin land where the villager's eyes and chin are
// The villager's big 3D nose gets the photo's nose.

// Positions are in 64x64 texture pixels; `eyes` is the centre between the eyes
// on the face, `sep` the distance between eye centres, `chin` the chin row.
export const LAYOUTS = {
  villager: {
    face: { x: 8, y: 8, w: 8, h: 10 }, eyes: [4, 5.5], sep: 4, chin: 10,
    // nose front (2x4 at 26,2) sits over face columns 3-5, rows 7-11
    nose: { x: 26, y: 2, w: 2, h: 4, fx: 3, fy: 7 },
  },
  skin: { face: { x: 8, y: 8, w: 8, h: 8 }, eyes: [4, 3.5], sep: 4, chin: 8 },
};

// anchors (photo pixels): eyeL, eyeR (eyeL = left in the image), chin, top
// (top of the forehead), left and right (edges of the face).
export function applyPhoto(ctx, S, photo, anchors, layout, fit = 'fill') {
  const { eyeL, eyeR } = anchors;
  const mid = [(eyeL[0] + eyeR[0]) / 2, (eyeL[1] + eyeR[1]) / 2];
  const d = Math.hypot(eyeR[0] - eyeL[0], eyeR[1] - eyeL[1]) || 1;
  const ex = [(eyeR[0] - eyeL[0]) / d, (eyeR[1] - eyeL[1]) / d]; // along the eyes
  const ey = [-ex[1], ex[0]];                                     // down the face
  const u = p => (p[0] - mid[0]) * ex[0] + (p[1] - mid[1]) * ex[1];
  const v = p => (p[0] - mid[0]) * ey[0] + (p[1] - mid[1]) * ey[1];

  // face-texture coordinate = (u - u0) * kx, (v - v0) * ky
  let kx, ky, u0, v0;
  const { w, h } = layout.face;
  if (fit === 'fill' && anchors.left && anchors.top) {
    const uL = u(anchors.left), uR = u(anchors.right);
    const vT = v(anchors.top), vB = v(anchors.chin);
    kx = w / ((uR - uL) || d); u0 = uL;
    ky = h / ((vB - vT) || d); v0 = vT;
  } else {
    kx = layout.sep / d; u0 = -layout.eyes[0] / kx;
    ky = (layout.chin - layout.eyes[1]) / (v(anchors.chin) || d); v0 = -layout.eyes[1] / ky;
  }

  const paint = (rect, faceX, faceY) => {
    const a = S * kx * ex[0], c = S * kx * ex[1];
    const b = S * ky * ey[0], dd = S * ky * ey[1];
    const e = S * (rect.x - faceX - kx * u0) - a * mid[0] - c * mid[1];
    const f = S * (rect.y - faceY - ky * v0) - b * mid[0] - dd * mid[1];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x * S, rect.y * S, rect.w * S, rect.h * S);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(a, b, c, dd, e, f);
    ctx.drawImage(photo, 0, 0);
    ctx.restore();
  };

  paint(layout.face, 0, 0);
  if (layout.nose) paint(layout.nose, layout.nose.fx, layout.nose.fy);
}
