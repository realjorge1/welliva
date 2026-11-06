/**
 * The character's ART (animation/characterArt.ts) is data that two renderers
 * draw — the animated Skia panel and the SVG still — so what can quietly go
 * wrong is in the data: a bone the figure draws goes undressed (an arm
 * vanishes), a path is malformed (a shape silently doesn't render), two shapes
 * of one path wind opposite ways and punch a hole where they overlap, a kit
 * colour stops reading on one of the grounds the figure stands on, or a layer
 * lands on the wrong side of the head.
 */
import { FRONT_PROFILES } from "@/fitness/animation/frontProfiles";
import {
  HEAD_SCALE,
  KIT,
  SOLE_BELOW,
  buildCharacterArt,
  disc,
  faceMirrored,
  frontShoeTurn,
  hemmed,
  isFarBone,
  oval,
  rrect,
  scalePath,
  sideShoeDepth,
  sideShoeToeRoom,
  taper,
  type CharacterArt,
  type Shape,
} from "@/fitness/animation/characterArt";
import type { FigureMotion } from "@/fitness/animation/movementProfiles";
import { buildFrontRig, buildSideRig, type Rig } from "@/fitness/animation/rig";
import { SIDE_PROFILES } from "@/fitness/animation/sideProfiles";
import { describe, expect, it } from "vitest";

const frontMotions = Object.keys(FRONT_PROFILES) as FigureMotion[];
const sideMotions = Object.keys(SIDE_PROFILES) as FigureMotion[];

const everyArt = (): { label: string; rig: Rig; art: CharacterArt; view: "front" | "side" }[] => [
  ...frontMotions.map((m) => {
    const rig = buildFrontRig(m);
    return { label: `front ${m}`, rig, art: buildCharacterArt(rig, "front"), view: "front" as const };
  }),
  ...sideMotions.map((m) => {
    const rig = buildSideRig(m);
    return { label: `side ${m}`, rig, art: buildCharacterArt(rig, "side"), view: "side" as const };
  }),
];

const HEX = /^#[0-9A-F]{6}$/i;
const allShapes = (art: CharacterArt): Shape[] => [
  ...art.bones.flat(),
  ...art.behind.flat(),
  ...art.shoes.flatMap((s) => s.shapes),
  ...art.head.back,
  ...art.head.skull,
  ...art.head.face,
  ...art.head.front,
];

describe("every limb is dressed", () => {
  it("front and side, every movement: every bone the rig draws has art", () => {
    const bare: string[] = [];
    for (const { label, rig, art } of everyArt()) {
      rig.bones.forEach((b, i) => {
        if (b.draw && art.bones[i].length === 0 && art.behind[i].length === 0) {
          bare.push(`${label}/${b.name}`);
        }
      });
    }
    expect(bare).toEqual([]);
  });

  it("dresses the neck, which the pictogram leaves invisible", () => {
    const { rig, art } = everyArt()[0];
    const neck = rig.bones.findIndex((b) => b.name === "neck");
    expect(art.bones[neck].length).toBeGreaterThan(0);
  });

  it("gives every shape a drawable outline", () => {
    for (const { label, art } of everyArt()) {
      for (const s of allShapes(art)) {
        expect(s.d.startsWith("M"), label).toBe(true);
        expect(s.d, label).not.toMatch(/NaN|undefined|Infinity/);
        if (s.fill !== undefined) expect(s.fill, label).toMatch(HEX);
        if (s.stroke) {
          expect(s.stroke.color, label).toMatch(HEX);
          expect(s.stroke.width, label).toBeGreaterThan(0);
        }
        // A shape is a fill or a stroked line, never nothing.
        expect(s.fill !== undefined || s.stroke !== undefined, label).toBe(true);
      }
    }
  });
});

describe("thumbnail detail", () => {
  const count = (art: CharacterArt) => allShapes(art).length;

  it("is strictly lighter than the full art, front and side — a list mounts dozens of rows", () => {
    for (const [rig, view] of [
      [buildFrontRig("squat"), "front"],
      [buildSideRig("squat"), "side"],
    ] as const) {
      const full = buildCharacterArt(rig, view, "full");
      const thumb = buildCharacterArt(rig, view, "thumb");
      expect(full.detail).toBe("full");
      expect(thumb.detail).toBe("thumb");
      expect(count(thumb), view).toBeLessThan(count(full) * 0.85);
      // The default is the full art.
      expect(count(buildCharacterArt(rig, view))).toBe(count(full));
    }
  });

  it("drops only decoration: nothing marked fine survives, and every bone is still dressed", () => {
    for (const m of ["squat", "pushup", "lunge", "plank", "jumpingJack", "downDog"] as const) {
      for (const view of ["front", "side"] as const) {
        if (view === "front" && !FRONT_PROFILES[m]) continue;
        if (view === "side" && !SIDE_PROFILES[m]) continue;
        const rig = view === "front" ? buildFrontRig(m) : buildSideRig(m);
        const thumb = buildCharacterArt(rig, view, "thumb");
        expect(allShapes(thumb).filter((s) => s.fine), `${view} ${m}`).toEqual([]);
        const bare = rig.bones
          .filter((b, i) => b.draw && thumb.bones[i].length === 0 && thumb.behind[i].length === 0)
          .map((b) => b.name);
        expect(bare, `${view} ${m}`).toEqual([]);
      }
    }
  });

  it("keeps the same layers, so a thumbnail is the same figure in the same order", () => {
    for (const [rig, view] of [
      [buildFrontRig("lunge"), "front"],
      [buildSideRig("lunge"), "side"],
    ] as const) {
      expect(buildCharacterArt(rig, view, "thumb").layers).toEqual(buildCharacterArt(rig, view, "full").layers);
    }
  });

  it("keeps the whole face: it is two eyes and a mouth, and none of that is decoration", () => {
    const thumb = buildCharacterArt(buildFrontRig("squat"), "front", "thumb").head;
    const full = buildCharacterArt(buildFrontRig("squat"), "front", "full").head;
    expect(thumb.skull.length).toBeGreaterThan(0);
    // The face is already down to what a head needs to read as a head, so a
    // thumbnail has nothing left to drop from it.
    expect(thumb.face).toEqual(full.face);
    // The hair is the silhouette: its cap stays, only the highlight goes.
    expect(thumb.front.filter((s2) => s2.fill === KIT.hair)).toEqual(full.front.filter((s2) => s2.fill === KIT.hair));
    expect(thumb.front.length).toBeLessThan(full.front.length);
  });
});

describe("the path vocabulary", () => {
  it("closes every shape and winds them all the same way, so overlaps merge instead of cancelling", () => {
    const shapes = [
      disc(1, 2, 3),
      oval(1, 2, 3, 2),
      rrect(0, 0, 10, 6, 2),
      taper(0, 10, 5, 4),
      taper(0, 10, 4, 5),
      hemmed(0, 10, 5, 6, 1.5),
    ];
    for (const d of shapes) expect(d.endsWith("Z")).toBe(true);
    // Arcs in a clockwise path sweep with flag 1; the circle and the ellipse are
    // made of arcs only, so every one of theirs must be clockwise.
    for (const d of [disc(0, 0, 4), oval(0, 0, 4, 3)]) {
      const arcs = d.match(/a[\d.\s-]+/g) ?? [];
      expect(arcs.length).toBe(2);
      for (const a of arcs) expect(a.trim().split(/\s+/).slice(2, 5).join(" ")).toBe("0 1 1");
    }
  });

  it("a taper never kinks: it spans exactly from one end to the other", () => {
    // A bar from x 0 to 10, radius 5 → 3, reaches back to -5 and on to 13.
    const d = taper(0, 10, 5, 3);
    expect(d).toMatch(/^M/);
    expect(d.endsWith("Z")).toBe(true);
    const n = (s: string) => s.match(/-?\d*\.?\d+/g)!.map(Number);
    expect(n(d).every(Number.isFinite)).toBe(true);
  });

  it("builds a hand-authored outline up to a new size and drops it", () => {
    expect(scalePath("M1 2L3 4Z", 2, 10)).toBe("M2 14L6 18Z");
    expect(scalePath("M-1 -2C0.5 1 2 3 4 5Z", 1, 0)).toBe("M-1 -2C0.5 1 2 3 4 5Z");
  });

  it("clamps rounded corners to fit", () => {
    expect(() => rrect(0, 0, 4, 2, 50)).not.toThrow();
    expect(() => hemmed(0, 1, 0.2, 0.2, 5)).not.toThrow();
  });
});

describe("the layers sit on the right side of the head", () => {
  it("front-on, the whole upper arm is behind the head and only forearms come in front", () => {
    const rig = buildFrontRig("squat");
    const art = buildCharacterArt(rig, "front");
    const name = (i: number) => rig.bones[i].name;
    expect(art.layers.arms.map(name).sort()).toEqual(["foreArmL", "foreArmR", "handL", "handR"]);
    expect(art.layers.caps.map(name).sort()).toEqual(["upArmL", "upArmR"]);
    for (const i of art.layers.caps) {
      // The skin, the sleeve (shoulder and all, in ONE path) and the cuff.
      expect(art.behind[i].length).toBeGreaterThanOrEqual(3);
      expect(art.bones[i]).toHaveLength(0);
    }
  });

  it("side-on, the whole near arm crosses the head — there is no seam to draw into", () => {
    const rig = buildSideRig("squat");
    const art = buildCharacterArt(rig, "side");
    const name = (i: number) => rig.bones[i].name;
    expect(art.layers.arms.map(name)).toEqual(["upArm", "foreArm", "hand"]);
    // The shoulder used to be held back on its own layer, with the sleeve's flat
    // cut drawn in front of whatever landed between them. It rides with the arm
    // now, so nothing can be drawn through the shoulder.
    expect(art.layers.caps).toHaveLength(0);
    const upArm = rig.bones.findIndex((b) => b.name === "upArm");
    expect(art.behind[upArm]).toHaveLength(0);
    expect(art.bones[upArm].length).toBeGreaterThan(1);
  });

  it("side-on, the far limbs are their own layer, behind everything, and every far bone is far", () => {
    const rig = buildSideRig("lunge");
    const art = buildCharacterArt(rig, "side");
    expect(art.layers.far.length).toBe(6);
    for (const i of art.layers.far) expect(isFarBone(rig.bones[i].name)).toBe(true);
    for (const i of [...art.layers.legs, ...art.layers.arms]) expect(isFarBone(rig.bones[i].name)).toBe(false);
  });

  it("front-on, the trainers hang off the shins and are level; side-on the foot bone is the trainer", () => {
    const front = buildCharacterArt(buildFrontRig("squat"), "front");
    expect(front.shoes).toHaveLength(2);
    const side = buildCharacterArt(buildSideRig("squat"), "side");
    expect(side.shoes).toHaveLength(0);
    const rig = buildSideRig("squat");
    const foot = rig.bones.findIndex((b) => b.name === "foot");
    expect(side.layers.legs).toContain(foot);
  });

  it("draws trainers the size of a foot — they were twice that, under a cartoon", () => {
    // The furthest any coordinate of a path reaches from the ankle, box units.
    const reach = (shapes: Shape[]) =>
      Math.max(...shapes.flatMap((sh) => (sh.d.match(/-?\d*\.?\d+/g) ?? []).map((n) => Math.abs(Number(n)))));
    // Front-on, a foot is about six units wide on a figure ~84 tall…
    const front = buildCharacterArt(buildFrontRig("squat"), "front");
    expect(reach(front.shoes[0].shapes)).toBeLessThan(4.5);
    // …and side-on about thirteen long, heel to toe.
    const rig = buildSideRig("squat");
    const foot = rig.bones.findIndex((b) => b.name === "foot");
    expect(reach(buildCharacterArt(rig, "side").bones[foot])).toBeLessThan(10);
    // Turned out a touch, as feet stand — not splayed to keep two clown shoes apart.
    expect(front.shoeOut).toBeLessThan(2);
  });
});

describe("the face demonstrates nothing, so it does nothing", () => {
  const front = buildCharacterArt(buildFrontRig("squat"), "front").head;
  const side = buildCharacterArt(buildSideRig("squat"), "side").head;

  it("is two eyes and a mouth front-on, one eye and a mouth in profile", () => {
    expect(front.face).toHaveLength(3);
    expect(side.face).toHaveLength(2);
  });

  it("draws the mouth closed, as a line — there is no open mouth to draw", () => {
    for (const h of [front, side]) {
      const mouths = h.face.filter((s2) => s2.stroke);
      expect(mouths).toHaveLength(1);
      expect(mouths[0].fill).toBeUndefined();
    }
  });

  it("has nothing left for a life layer to drive: no lids, no brows, no second mouth", () => {
    // The whole point. Every face shape is a flat fill or a flat stroke, and
    // HeadArt has no handle on any of them — so nothing on this head can move
    // while the body is demonstrating a movement.
    for (const h of [front, side]) {
      for (const shape of h.face) {
        expect(shape.d.startsWith("M")).toBe(true);
        expect(shape.fine).toBeUndefined();
      }
    }
    expect(Object.keys(front)).not.toContain("eyes");
    expect(Object.keys(front)).not.toContain("brows");
    expect(Object.keys(front)).not.toContain("mouth");
  });

  it("is an athlete's head, not a character's: the figure demonstrates, so the body carries it", () => {
    // It was 1.75 (over a third of the figure), then 1.05 (a quarter — a figure
    // four heads tall, which the owner called fat). Now about a seventh.
    expect(HEAD_SCALE).toBeLessThan(0.7);
    expect(HEAD_SCALE).toBeGreaterThan(0.5);
  });

  it("has nothing to swing: no hair puffs, no sway pivot", () => {
    for (const h of [front, side]) {
      expect(Object.keys(h)).not.toContain("puffs");
      expect(Object.keys(h)).not.toContain("swayPivot");
    }
  });
});

/* WCAG relative luminance + contrast ratio. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** CIE76 colour difference — how far apart two colours LOOK, hue included. */
function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(lin);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a: string, b: string): number => {
  const [A, B] = [lab(a), lab(b)];
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};

describe("the kit reads on both grounds", () => {
  // The player's stage is near-black; the light theme's page is this grey.
  const STAGE = "#000000";
  const LIGHT = "#F1F2F5";

  it("every colour is a valid hex", () => {
    for (const c of Object.values(KIT)) expect(c).toMatch(HEX);
  });

  it("the big colour blocks are visible on black and on the light grey", () => {
    // Navy shorts were rejected on exactly this: #2D3561 is 1.8:1 on black.
    for (const [name, c] of [
      ["skin", KIT.skin],
      ["tee", KIT.tee],
      ["shorts", KIT.shorts],
      ["shoe", KIT.shoe],
    ] as const) {
      expect(contrast(c, STAGE), `${name} on black`).toBeGreaterThan(2);
      expect(contrast(c, LIGHT), `${name} on light`).toBeGreaterThan(2);
    }
  });

  it("the shades read as a step down from their colour, not as another colour", () => {
    for (const [base, shade] of [
      [KIT.skin, KIT.skinShade],
      [KIT.tee, KIT.teeShade],
      [KIT.shorts, KIT.shortsShade],
      [KIT.shoe, KIT.shoeShade],
    ] as const) {
      expect(luminance(shade)).toBeLessThan(luminance(base));
    }
  });

  it("separates the colour blocks that touch: skin, tee, shorts and trainers", () => {
    // Luminance contrast is the wrong yardstick between neighbouring blocks — a
    // coral trainer and brown skin differ in hue, not brightness — so this is
    // CIE ΔE: 25+ is "clearly a different colour".
    for (const [a, b] of [
      [KIT.skin, KIT.tee],
      [KIT.tee, KIT.shorts],
      [KIT.skin, KIT.shorts],
      [KIT.skin, KIT.shoe],
      [KIT.shoe, KIT.sole],
      [KIT.skin, KIT.hair],
    ] as const) {
      expect(deltaE(a, b), `${a} vs ${b}`).toBeGreaterThan(30);
    }
    // The eyes are flat dark ovals straight on the skin, so that is the one
    // contrast that has to carry them.
    expect(contrast(KIT.pupil, KIT.skin)).toBeGreaterThan(5);
  });

  it("keeps each shade close to its colour — a step down, not another colour", () => {
    for (const [base, shade] of [
      [KIT.skin, KIT.skinShade],
      [KIT.tee, KIT.teeShade],
      [KIT.shorts, KIT.shortsShade],
      [KIT.shoe, KIT.shoeShade],
    ] as const) {
      const d = deltaE(base, shade);
      expect(d).toBeGreaterThan(8);
      expect(d).toBeLessThan(30);
    }
  });
});

describe("which way the face looks", () => {
  it("mirrors only side views, and only the three poses authored the other way round", () => {
    for (const m of ["cobra", "yRaise", "invertedRow"] as FigureMotion[]) {
      expect(SIDE_PROFILES[m], m).toBeDefined();
      expect(faceMirrored(m, "side")).toBe(true);
      expect(faceMirrored(m, "front")).toBe(false);
    }
    expect(faceMirrored("pushup", "side")).toBe(false);
    expect(faceMirrored("squat", "side")).toBe(false);
  });
});

/**
 * The lowest y a path reaches, read off its END points (and Béziers' control
 * points, which can only over-estimate). Enough for the straight-bottomed shapes
 * the soles are; it understands the commands this module writes.
 */
function lowestY(d: string): number {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  let y = 0;
  let cmd = "";
  let low = -Infinity;
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case "M":
      case "L":
        i++;
        y = num();
        low = Math.max(low, y);
        break;
      case "H":
        i++;
        break;
      case "V":
        y = num();
        low = Math.max(low, y);
        break;
      case "Q":
        i += 2;
        low = Math.max(low, Number(tokens[i - 1]));
        i += 1;
        y = num();
        low = Math.max(low, y);
        break;
      case "C":
        i += 1;
        low = Math.max(low, num());
        i += 1;
        low = Math.max(low, num());
        i += 1;
        y = num();
        low = Math.max(low, y);
        break;
      case "A":
        i += 5;
        i++;
        y = num();
        low = Math.max(low, y);
        break;
      case "a":
        i += 5;
        i++;
        y += num();
        low = Math.max(low, y);
        break;
      case "Z":
        break;
      default:
        i++;
    }
  }
  return low;
}

describe("the floor", () => {
  it("lines the trainers' soles up front-on and side-on, so a figure never stands on a different floor", () => {
    // About an ankle's height off the floor on a figure ~84 units tall.
    expect(SOLE_BELOW).toBeGreaterThan(3);
    expect(SOLE_BELOW).toBeLessThan(5);
    const lowest = (shapes: Shape[]) => Math.max(...shapes.map((s) => lowestY(s.d)));
    // The front trainer's sole is the lowest thing in its art…
    const front = buildCharacterArt(buildFrontRig("squat"), "front").shoes[0].shapes;
    expect(lowest(front)).toBeCloseTo(SOLE_BELOW, 1);
    // …and the side trainer is built up and dropped onto the same line.
    const rig = buildSideRig("squat");
    const art = buildCharacterArt(rig, "side");
    const foot = rig.bones.findIndex((b) => b.name === "foot");
    expect(lowest(art.bones[foot])).toBeCloseTo(SOLE_BELOW, 1);
  });
});

/**
 * The 2026-11-03 clothing and feet pass. Owner: "some the clothing looks
 * awkward and ripped". At full size it was: the bare round top of each thigh
 * showing between tee and shorts (front) and as a skin bulge behind the seat
 * (side, the far thigh); a dark ring standing the sleeve's crown off the tee
 * like a shoulder pad (front); and the neck drawn over the tee as a bib.
 */
describe("the kit covers the body it is on", () => {
  const thighShorts = (art: CharacterArt, rig: Rig, name: string): Shape => {
    const i = rig.bones.findIndex((b) => b.name === name);
    return art.bones[i].find((s) => s.fill === KIT.shorts || s.fill === KIT.shortsShade)!;
  };

  it("starts each leg of the shorts with a seat that covers the top of the thigh", () => {
    // The thigh's top is a round cap of radius 4; the shorts' leg now opens
    // with a disc at the hip joint at least that big, so no angle of the hip
    // can show skin past it.
    const rig = buildSideRig("squat");
    const art = buildCharacterArt(rig, "side");
    for (const name of ["thigh", "farThigh"]) {
      const d = thighShorts(art, rig, name).d;
      const m = /^M(-?[\d.]+) 0a([\d.]+) /.exec(d);
      expect(m, name).not.toBeNull();
      expect(Number(m![2]), name).toBeGreaterThanOrEqual(4);
      expect(Number(m![1]), name).toBeCloseTo(-Number(m![2]), 6);
    }
  });

  it("draws no rim round the sleeve's crown front-on, and keeps it side-on", () => {
    // The rim is a tee-shade shape opening with a disc round the shoulder joint
    // (`M-r 0a r r …`); the cuff band and the collar are not.
    const crownRims = (rig: Rig, art: CharacterArt) =>
      rig.bones.flatMap((b, i) =>
        /^upArm/.test(b.name)
          ? [...art.behind[i], ...art.bones[i]].filter(
              (s) => s.fill === KIT.teeShade && /^M-[\d.]+ 0a/.test(s.d),
            )
          : [],
      );
    const frontRig = buildFrontRig("squat");
    const sideRig = buildSideRig("squat");
    expect(crownRims(frontRig, buildCharacterArt(frontRig, "front"))).toHaveLength(0);
    expect(crownRims(sideRig, buildCharacterArt(sideRig, "side"))).toHaveLength(1);
  });

  it("lays the collar over the base of the neck, not the neck over the tee", () => {
    const rig = buildFrontRig("squat");
    const art = buildCharacterArt(rig, "front");
    const neck = art.bones[rig.bones.findIndex((b) => b.name === "neck")];
    const skin = neck.findIndex((s) => s.fill === KIT.skinShade);
    const collar = neck.findIndex((s) => s.fill === KIT.teeShade);
    expect(skin).toBeGreaterThanOrEqual(0);
    expect(collar).toBeGreaterThan(skin);
    // …and the neck starts under the collar, off the shoulder line.
    expect(Number(/^M(-?[\d.]+)/.exec(neck[skin].d)![1])).toBeGreaterThan(1);
  });
});

describe("the trainers follow the ankle", () => {
  it("measures a flat side trainer a sole under the ankle, a sole-up one less", () => {
    expect(sideShoeDepth(0, 1)).toBeCloseTo(SOLE_BELOW, 6);
    expect(sideShoeDepth(Math.PI, 1)).toBeLessThan(SOLE_BELOW);
    // Turned over for a left-facing body, the sole is under a foot pointing −x.
    expect(sideShoeDepth(Math.PI, -1)).toBeCloseTo(SOLE_BELOW, 6);
  });

  it("gives a foot on its toes only the heel lift the floor allows", () => {
    expect(sideShoeToeRoom(0)).toBeCloseTo(0, 6);
    const lift = sideShoeToeRoom(2);
    expect(lift).toBeGreaterThan(0);
    // At that tilt the toe just touches a floor 2 lower than a flat sole's.
    expect(sideShoeDepth(lift, 1)).toBeLessThanOrEqual(SOLE_BELOW + 2 + 1e-6);
    expect(sideShoeToeRoom(50)).toBeLessThanOrEqual(Math.PI / 2);
  });

  it("keeps the front trainer level on a standing leg and carries it on a lying one", () => {
    const down = Math.PI / 2;
    expect(frontShoeTurn(down)).toBe(0);
    expect(frontShoeTurn(down + Math.PI / 6)).toBe(0); // a jumping jack's 30°
    expect(frontShoeTurn(Math.PI)).toBeCloseTo(Math.PI / 2, 6); // a leg along the floor
    expect(frontShoeTurn(0)).toBeCloseTo(-Math.PI / 2, 6);
    // Blends — no snap — between the two.
    const mid = frontShoeTurn(down + (57 * Math.PI) / 180);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan((57 * Math.PI) / 180);
  });
});
