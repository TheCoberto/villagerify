// "Photo face" look: pastes the real face from the photo onto the texture.
// The photo is rotated and stretched so the eyes and chin land where the
// villager's (or skin's) eyes and chin are. The villager's big 3D nose gets
// the photo's nose.

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

// anchors: { eyeL, eyeR, chin } in photo pixels (eyeL = left in the image).
export function applyPhoto(ctx, S, photo, anchors, layout) {
  const { eyeL, eyeR, chin } = anchors;
  const mid = [(eyeL[0] + eyeR[0]) / 2, (eyeL[1] + eyeR[1]) / 2];
  const d = Math.hypot(eyeR[0] - eyeL[0], eyeR[1] - eyeL[1]) || 1;
  const ex = [(eyeR[0] - eyeL[0]) / d, (eyeR[1] - eyeL[1]) / d]; // along the eyes
  const ey = [-ex[1], ex[0]];                                     // down the face
  const down = (chin[0] - mid[0]) * ey[0] + (chin[1] - mid[1]) * ey[1] || d;
  const sx = (layout.sep * S) / d;
  const sy = ((layout.chin - layout.eyes[1]) * S) / down;

  const paint = (rect, faceX, faceY) => {
    // where the eye midpoint lands, in texture pixels, for this rect
    const tx = (rect.x + layout.eyes[0] - faceX) * S;
    const ty = (rect.y + layout.eyes[1] - faceY) * S;
    const a = sx * ex[0], c = sx * ex[1], b = sy * ey[0], dd = sy * ey[1];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x * S, rect.y * S, rect.w * S, rect.h * S);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(a, b, c, dd, tx - (a * mid[0] + c * mid[1]), ty - (b * mid[0] + dd * mid[1]));
    ctx.drawImage(photo, 0, 0);
    ctx.restore();
  };

  paint(layout.face, 0, 0);
  if (layout.nose) paint(layout.nose, layout.nose.fx, layout.nose.fy);
}
