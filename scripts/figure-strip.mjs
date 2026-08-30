/**
 * FIGURE STRIP — render the demonstration figure to a PNG without a device.
 *
 * The figure only exists on a Skia surface, which means the only way to judge
 * a new movement used to be: author keyframes blind, run a native build, hold
 * a phone, squint, repeat. That loop is far too slow to author a pose against,
 * and authoring poses blind is how you get a figure that passes every test and
 * still reads as nonsense.
 *
 * So this rasterises the SAME rig the app draws, straight to a frame strip.
 * The point is fidelity, not prettiness: the pose walk, the per-bone follow
 * lag, the draw order, the dimmed far-side echo and the capsule geometry are
 * all mirrored from ExerciseFigure.skia.tsx. If the strip reads wrong, the
 * device reads wrong — that is the whole value of it.
 *
 *   node scripts/figure-strip.mjs --motion cloudHands --out ./out
 *
 * Movements that are not in the shipped FRONT_PROFILES registry (a spike, an
 * unlanded practice) are loaded with `--module <path>` + `--export <name>`,
 * so a prototype never has to be committed into the exercise vocabulary just
 * to be looked at.
 */
import { createJiti } from "jiti";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": ROOT } });

/* ─────────────────────────── Renderer constants ─────────────────────────
 * Mirrored from ExerciseFigure.skia.tsx / ExerciseFigure.tsx. Changing them
 * here without changing them there makes this tool lie, which is worse than
 * not having it.
 * ─────────────────────────────────────────────────────────────────────── */
const FOLLOW_LAG = 0.013;
const FAR_OPACITY = 0.42;
const SIDE_FAR_BONES = [4, 5, 6, 7, 8];
/** Supersampling factor. The figure is a silhouette; jaggies read as noise. */
const SS = 3;

/* ───────────────────────────────── CLI ─────────────────────────────────── */

function args() {
  const out = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    out[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  }
  return out;
}

/* ──────────────────────────── Rasteriser core ──────────────────────────── */

/**
 * Exact distance to a capsule with different radii at each end (a round cone).
 * The Skia path is a trapezoid closed with cubic caps; this is the analytic
 * form of the same shape, so a bone rasterised here has the silhouette the
 * device draws rather than a stroked-line approximation of it.
 */
function sdRoundCone(px, py, ax, ay, bx, by, r1, r2) {
  const bax = bx - ax;
  const bay = by - ay;
  const l2 = bax * bax + bay * bay;
  if (l2 < 1e-9) return Math.hypot(px - ax, py - ay) - Math.max(r1, r2);
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - ax;
  const pay = py - ay;
  const y = pax * bax + pay * bay;
  const z = y - l2;
  const cx = pax * l2 - bax * y;
  const cy = pay * l2 - bay * y;
  const x2 = cx * cx + cy * cy;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/** A solid disc — the pictogram's detached head. */
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

/** A ring — the proposed foot-load indicator, drawn hollow so it is not a limb. */
function sdRing(px, py, cx, cy, r, t) {
  return Math.abs(Math.hypot(px - cx, py - cy) - r) - t;
}

/**
 * Union a group of shapes into a coverage mask, then composite it at one
 * opacity. Grouping matters: the far-side limbs are drawn as ONE translucent
 * group, so where they overlap each other they must not double-darken — which
 * is exactly what a per-shape composite would do.
 */
function paintGroup(cov, w, h, shapes, opacity, mask) {
  mask.fill(0);
  for (const s of shapes) {
    const minX = Math.max(0, Math.floor(s.minX));
    const maxX = Math.min(w - 1, Math.ceil(s.maxX));
    const minY = Math.max(0, Math.floor(s.minY));
    const maxY = Math.min(h - 1, Math.ceil(s.maxY));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = s.sd(x + 0.5, y + 0.5);
        if (d >= 0) continue;
        const i = y * w + x;
        if (mask[i] < 1) mask[i] = 1;
      }
    }
  }
  for (let i = 0; i < cov.length; i++) {
    if (mask[i]) cov[i] = cov[i] + (1 - cov[i]) * opacity;
  }
}

/* ───────────────────────────── Pose evaluation ─────────────────────────── */

const ease = (raw) => {
  const tri = raw < 0.5 ? raw * 2 : (1 - raw) * 2;
  const c = tri < 0 ? 0 : tri > 1 ? 1 : tri;
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/**
 * The renderer's own pose walk, per-bone follow lag included. Copied rather
 * than imported because the shipped version is a Reanimated worklet closed
 * over panel geometry; a divergence here shows up as a strip that does not
 * match the device, so it is deliberately kept literal.
 */
function posePanel(rig, geo, p) {
  const { k, cx, pad } = geo;
  const n = rig.bones.length;
  const rootAx = cx + (rig.rootA[0] - 50) * k;
  const rootAy = pad + rig.rootA[1] * k;
  const rootBx = cx + (rig.rootB[0] - 50) * k;
  const rootBy = pad + rig.rootB[1] * k;

  const tRoot = ease(p);
  const rootX = rootAx + (rootBx - rootAx) * tRoot;
  const rootY = rootAy + (rootBy - rootAy) * tRoot;

  const out = new Array(n * 3);
  const tipX = new Array(n);
  const tipY = new Array(n);
  for (let i = 0; i < n; i++) {
    const bone = rig.bones[i];
    let lagged = p - bone.depth * FOLLOW_LAG;
    if (lagged < 0) lagged += 1;
    const t = ease(lagged);
    const a = rig.anglesA[i] + (rig.anglesB[i] - rig.anglesA[i]) * t;
    const sx = bone.parent < 0 ? rootX : tipX[bone.parent];
    const sy = bone.parent < 0 ? rootY : tipY[bone.parent];
    tipX[i] = sx + bone.length * k * Math.cos(a);
    tipY[i] = sy + bone.length * k * Math.sin(a);
    out[i * 3] = sx;
    out[i * 3 + 1] = sy;
    out[i * 3 + 2] = a;
  }
  return out;
}

/** Panel framing, mirrored from buildGeometry(). */
function buildGeometry(rig, view, size) {
  const pad = size * 0.08;
  const panelW = size * (view === "side" ? 0.78 : 0.94);
  const k = Math.min((size - pad * 2) / 100, (panelW / 2 - size * 0.03) / (rig.reach + 9));
  return { pad, panelW, k, cx: panelW / 2, depth: 3.2 * k };
}

/** One bone's drawable round cone at this pose, in panel pixels. */
function boneShape(rig, pose, i, k, dx = 0) {
  const bone = rig.bones[i];
  const ax = pose[i * 3] + dx;
  const ay = pose[i * 3 + 1];
  const a = pose[i * 3 + 2];
  const drawn = (bone.length - bone.drawInset) * k;
  const bx = ax + drawn * Math.cos(a);
  const by = ay + drawn * Math.sin(a);
  const r1 = (bone.w0 / 2) * k;
  const r2 = Math.max((bone.w1 / 2) * k, bone.tip * k);
  const pad = Math.max(r1, r2) + 1;
  return {
    sd: (px, py) => sdRoundCone(px, py, ax, ay, bx, by, r1, r2),
    minX: Math.min(ax, bx) - pad,
    maxX: Math.max(ax, bx) + pad,
    minY: Math.min(ay, by) - pad,
    maxY: Math.max(ay, by) + pad,
  };
}

/**
 * The joint a bone's tip lands on, in panel pixels — the shoulder the arm
 * hangs off, the hip the thigh hangs off, the foot the shin ends in.
 */
function tipOf(rig, pose, name, k) {
  const i = rig.bones.findIndex((b) => b.name === name);
  if (i < 0) return null;
  const a = pose[i * 3 + 2];
  return [
    pose[i * 3] + rig.bones[i].length * k * Math.cos(a),
    pose[i * 3 + 1] + rig.bones[i].length * k * Math.sin(a),
  ];
}

/**
 * DIAGNOSTIC OVERLAY — the shoulder line, the hip line, the pelvis plumb and
 * the floor, drawn over the silhouette in a second colour.
 *
 * This exists to separate two failures that look identical on a plain strip:
 * a turn that is not ENCODED in the geometry, and a turn that is encoded and
 * simply cannot be SEEN through a flat one-colour silhouette. Only the second
 * is worth trying to fix, so it is worth being able to tell them apart.
 */
function diagShapes(rig, pose, k, geo, size) {
  const out = [];
  const rule = (x1, y1, x2, y2, w) =>
    out.push({
      sd: (px, py) => sdRoundCone(px, py, x1, y1, x2, y2, w, w),
      minX: Math.min(x1, x2) - w - 1,
      maxX: Math.max(x1, x2) + w + 1,
      minY: Math.min(y1, y2) - w - 1,
      maxY: Math.max(y1, y2) + w + 1,
    });

  const t = 0.9 * (size / 190) * SS;
  const shR = tipOf(rig, pose, "clavR", k);
  const shL = tipOf(rig, pose, "clavL", k);
  const hipR = tipOf(rig, pose, "pelvisR", k);
  const hipL = tipOf(rig, pose, "pelvisL", k);
  if (shR && shL) rule(shR[0], shR[1], shL[0], shL[1], t);
  if (hipR && hipL) rule(hipR[0], hipR[1], hipL[0], hipL[1], t);

  // Pelvis plumb: where the body's mass is parked, left to right.
  const rootX = pose[0];
  const rootY = pose[1];
  rule(rootX, rootY - 6 * SS, rootX, geo.pad * SS + rig.groundY * k, t * 0.7);
  // Floor.
  const gy = geo.pad * SS + rig.groundY * k;
  rule(2 * SS, gy, geo.panelW * SS - 2 * SS, gy, t * 0.7);
  return out;
}

/**
 * FOOT-LOAD RINGS — the candidate fix for "which leg is weighted?".
 *
 * The load is not decorative and not authored: it is read off the pose, as how
 * far the pelvis has travelled toward each foot along the line joining them.
 * A ring centred on a foot, sized by that share, therefore cannot drift out of
 * agreement with the figure standing above it — which is the repo's standing
 * rule that a thing which says it counts must count exactly that.
 */
function loadShapes(rig, pose, k, feet, size) {
  const pts = feet.map((n) => tipOf(rig, pose, n, k)).filter(Boolean);
  if (pts.length !== 2) return [];
  const rootX = pose[0];
  const [a, b] = pts;
  const span = b[0] - a[0];
  // Share on foot A: 1 when the pelvis is over A, 0 when it is over B.
  let sa = Math.abs(span) < 1e-6 ? 0.5 : 1 - (rootX - a[0]) / span;
  sa = Math.max(0, Math.min(1, sa));
  const shares = [sa, 1 - sa];
  const rMax = 13 * (size / 190) * SS;
  return pts.map((p, i) => {
    // Area tracks load, so a 70/30 split looks like 70/30 and not 84/55.
    const r = rMax * Math.sqrt(Math.max(shares[i], 0.02));
    const t = 1.1 * (size / 190) * SS;
    return {
      sd: (px, py) => sdRing(px, py, p[0], p[1] + 6 * SS, r, t),
      minX: p[0] - r - t - 1,
      maxX: p[0] + r + t + 1,
      minY: p[1] + 6 * SS - r - t - 1,
      maxY: p[1] + 6 * SS + r + t + 1,
    };
  });
}

/**
 * GAZE NUB — a small wedge on the head pointing where the figure is looking.
 *
 * The pictogram head is a featureless disc, so it carries no rotation
 * information at all. In tai chi the gaze follows the working hand, which
 * makes the head one of the strongest turn cues available — and currently the
 * only body part that is guaranteed to be un-occluded.
 */
function gazeShapes(rig, pose, k, size, dirX) {
  const hb = rig.headBone;
  const a = pose[hb * 3 + 2];
  const hx = pose[hb * 3] + rig.bones[hb].length * k * Math.cos(a);
  const hy = pose[hb * 3 + 1] + rig.bones[hb].length * k * Math.sin(a);
  const hr = rig.headR * k;
  const r = hr * 0.34;
  const cx = hx + dirX * hr * 0.86;
  return [
    {
      sd: (px, py) => sdCircle(px, py, cx, hy + hr * 0.05, r),
      minX: cx - r - 1,
      maxX: cx + r + 1,
      minY: hy - r - 1,
      maxY: hy + r + hr,
    },
  ];
}

/**
 * Render one panel at one instant, at SS× then box-filtered down. Returns a
 * coverage map (0–1 per pixel) rather than pixels, so the strip can tint it
 * however it likes and stack panels without re-rasterising.
 */
function renderPanel(rig, view, size, opts = {}) {
  const geo = buildGeometry(rig, view, size);
  const W = Math.round(geo.panelW);
  const H = Math.round(size);
  const ssW = W * SS;
  const ssH = H * SS;

  const indices = (test) => {
    const out = [];
    rig.bones.forEach((b, i) => {
      if (b.draw && test(b.name)) out.push(i);
    });
    return out;
  };
  const legs = indices((n) => /^(thigh|shin|foot)/.test(n));
  const arms = indices((n) => /^(upArm|foreArm)/.test(n));
  const spine = indices((n) => n.endsWith("Spine"));
  const far = view === "side" ? SIDE_FAR_BONES.filter((i) => rig.bones[i]?.draw) : [];

  const ssGeo = { ...geo, k: geo.k * SS, cx: geo.cx * SS, pad: geo.pad * SS };

  const down = (src) => {
    const out = new Float32Array(W * H);
    const inv = 1 / (SS * SS);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let sy = 0; sy < SS; sy++) {
          const row = (y * SS + sy) * ssW + x * SS;
          for (let sx = 0; sx < SS; sx++) acc += src[row + sx];
        }
        out[y * W + x] = acc * inv;
      }
    }
    return out;
  };

  return (p) => {
    const pose = posePanel(rig, ssGeo, p);
    const cov = new Float32Array(ssW * ssH);
    const acc = new Float32Array(ssW * ssH);
    const mask = new Uint8Array(ssW * ssH);
    const shapes = (list, dx) => list.map((i) => boneShape(rig, pose, i, ssGeo.k, dx));

    // Draw order is the renderer's: dim far side, then legs, spine, arms, head.
    if (far.length) paintGroup(cov, ssW, ssH, shapes(far, -geo.depth * SS), FAR_OPACITY, mask);

    const hb = rig.headBone;
    const ha = pose[hb * 3 + 2];
    const hx = pose[hb * 3] + rig.bones[hb].length * ssGeo.k * Math.cos(ha);
    const hy = pose[hb * 3 + 1] + rig.bones[hb].length * ssGeo.k * Math.sin(ha);
    const hr = rig.headR * ssGeo.k;

    const body = [
      ...shapes(legs, 0),
      ...shapes(spine, 0),
      ...shapes(arms, 0),
      {
        sd: (px, py) => sdCircle(px, py, hx, hy, hr),
        minX: hx - hr - 1,
        maxX: hx + hr + 1,
        minY: hy - hr - 1,
        maxY: hy + hr + 1,
      },
    ];
    // The gaze nub is part of the FIGURE, not an annotation — it has to union
    // with the head rather than sit on top of it, or it reads as a sticker.
    if (opts.gaze && view === "front") {
      const turn = pose[0] - ssGeo.cx;
      body.push(...gazeShapes(rig, pose, ssGeo.k, size, Math.sign(turn) || 1));
    }
    paintGroup(cov, ssW, ssH, body, 1, mask);

    const overlay = [];
    if (opts.diag) overlay.push(...diagShapes(rig, pose, ssGeo.k, geo, size));
    if (opts.weight && view === "front") {
      overlay.push(...loadShapes(rig, pose, ssGeo.k, ["shinR", "shinL"], size));
    }
    if (overlay.length) paintGroup(acc, ssW, ssH, overlay, 1, mask);

    return { cov: down(cov), accent: down(acc), W, H };
  };
}

/* ─────────────────────────────── Strip output ──────────────────────────── */

const INK = [17, 20, 24];
const PAPER = [250, 250, 249];
const RULE = [222, 222, 220];
/** Overlay colour for the diagnostic rules and the load rings. */
const ACCENT = [201, 61, 42];

function writeStrip(file, rows, frames, size, opts = {}) {
  const gap = 6;
  const cellW = Math.max(...rows.flatMap((r) => r.panels.map((p) => p.W)));
  const cellH = size;
  const labelW = 0;
  const W = labelW + frames * (cellW + gap) + gap;
  const H = rows.length * (cellH + gap) + gap;
  const png = new PNG({ width: W, height: H });

  for (let i = 0; i < W * H; i++) {
    png.data[i * 4] = PAPER[0];
    png.data[i * 4 + 1] = PAPER[1];
    png.data[i * 4 + 2] = PAPER[2];
    png.data[i * 4 + 3] = 255;
  }

  const put = (x, y, rgb, a) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) {
      png.data[i + c] = Math.round(png.data[i + c] * (1 - a) + rgb[c] * a);
    }
  };

  rows.forEach((row, ri) => {
    const oy = gap + ri * (cellH + gap);
    row.panels.forEach((panel, fi) => {
      const ox = labelW + gap + fi * (cellW + gap) + Math.round((cellW - panel.W) / 2);
      // A hairline cell border: without it a strip of silhouettes on one flat
      // ground gives the eye no frame to measure lateral drift against, which
      // is the exact thing a weight-shift movement has to be judged on.
      for (let x = 0; x < cellW; x++) {
        put(labelW + gap + fi * (cellW + gap) + x, oy - 1, RULE, 1);
        put(labelW + gap + fi * (cellW + gap) + x, oy + cellH, RULE, 1);
      }
      for (let y = -1; y <= cellH; y++) {
        put(labelW + gap + fi * (cellW + gap) - 1, oy + y, RULE, 1);
        put(labelW + gap + fi * (cellW + gap) + cellW, oy + y, RULE, 1);
      }
      if (opts.centerline) {
        const mid = labelW + gap + fi * (cellW + gap) + Math.round(cellW / 2);
        for (let y = 0; y < cellH; y += 4) put(mid, oy + y, RULE, 1);
      }
      for (let y = 0; y < panel.H; y++) {
        for (let x = 0; x < panel.W; x++) {
          put(ox + x, oy + y, INK, panel.cov[y * panel.W + x]);
          if (panel.accent) put(ox + x, oy + y, ACCENT, panel.accent[y * panel.W + x]);
        }
      }
    });
  });

  fs.writeFileSync(file, PNG.sync.write(png));
  return { W, H };
}

/* ─────────────────────────────────  Main  ──────────────────────────────── */

const a = args();
const size = Number(a.size ?? 190);
const frames = Number(a.frames ?? 9);
const outDir = a.out ?? ".";
fs.mkdirSync(outDir, { recursive: true });

const rigMod = await jiti.import(path.join(ROOT, "fitness/animation/rig.ts"));

/**
 * Resolve the two profiles to rig. A spike movement lives outside the shipped
 * registry, so `--module` names a file exporting `{ front, side }` profiles
 * under `--export`, and they are rigged directly.
 */
let buildFront;
let buildSide;
if (a.module) {
  const mod = await jiti.import(path.resolve(ROOT, a.module));
  const entry = mod[a.export ?? "default"];
  if (!entry) throw new Error(`${a.module} has no export "${a.export ?? "default"}"`);
  buildFront = () => rigMod.buildFrontRigFrom(entry.front);
  buildSide = () => rigMod.buildSideRigFrom(entry.side);
} else {
  buildFront = () => rigMod.buildFrontRig(a.motion ?? "neutral");
  buildSide = () => rigMod.buildSideRig(a.motion ?? "neutral");
}

const views = (a.views ?? "front,side").split(",");
const rows = views.map((view) => {
  const rig = view === "side" ? buildSide() : buildFront();
  const render = renderPanel(rig, view, size, {
    diag: a.diag === "1",
    weight: a.weight === "1",
    gaze: a.gaze === "1",
  });
  return {
    view,
    panels: Array.from({ length: frames }, (_, i) => render(i / (frames - 1))),
  };
});

const name = a.name ?? a.motion ?? a.export ?? "figure";
const file = path.join(outDir, `${name}.png`);
const { W, H } = writeStrip(file, rows, frames, size, { centerline: a.centerline === "1" });
console.log(`${file}  ${W}×${H}  ${views.join(" + ")}  ${frames} frames`);
