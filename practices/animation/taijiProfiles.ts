/**
 * TAIJI FIGURE PROFILES — keyframe poses for guided tai chi movements.
 *
 * SPIKE. One movement, Cloud Hands, authored to answer a single question:
 * can the exercise pictogram rig show WAIST ROTATION and WEIGHT TRANSFER —
 * the two things tai chi actually consists of? Everything else about a tai chi
 * pillar is downstream of that answer, so nothing else is built yet.
 *
 * These reuse the exercise rig's coordinate space (0–100 box, y down, x=50 the
 * centreline) and its `FrontProfile` / `SideProfile` shapes, but deliberately
 * NOT its `FigureMotion` registry: tai chi is a modality, not an exercise, and
 * adding a `cloudHands` key to that union would force every exhaustive
 * `Record<FigureMotion, …>` in the fitness layer to carry a tai chi column.
 * `buildFrontRigFrom` / `buildSideRigFrom` exist so a profile can be rigged
 * without being registered.
 *
 * ── WHAT THE PROBE FOUND ─────────────────────────────────────────────────
 *
 * These coordinates encode a 40° waist turn as ORTHOGRAPHIC FORESHORTENING —
 * turn the trunk by θ and the shoulder line's projected half-width scales by
 * cos θ, so 10 units either side of the trunk's centre becomes 7.7, and the
 * hip line's 6 becomes 4.6. That is how a flat pictogram has always drawn a
 * turn, and it is the only channel a viewless 2D figure has.
 *
 * THE RIG DELETES IT. Every bone's length is frozen at the average of the two
 * keyframes — the invariant that stopped limbs behaving like rubber, and not
 * negotiable — and a clavicle is a bone. So the shoulder line is a bar of
 * fixed width for the whole cycle no matter what is authored here: two
 * completely different drafts of this file produced spans identical to five
 * significant figures. Foreshortening is a length change, and length is the
 * one thing the rig will not animate. See practices/__tests__/rigProbe.test.ts,
 * which holds that finding as an assertion so it cannot quietly stop being
 * true.
 *
 * What DOES survive is carried by translation and angle, which the rig does
 * animate: the pelvis travels toward the loaded foot, the loaded knee takes
 * more bend than the empty one, both feet stay planted, and the head holds its
 * height. So the weight half of the movement reads and the rotation half does
 * not — which is why these poses are a spike result and not a shipped feature.
 *
 * The stance is deliberately authored at a constant knee bend and a level head
 * because that is correct Yang form; it is also, conveniently, what keeps the
 * two keyframes' leg lengths close enough that the averaged bones do not slide
 * the planted feet.
 *
 * The figure is authored as a MIRROR demonstrator (its right limb on the
 * viewer's right), matching the exercise profiles, so a practitioner can copy
 * the screen limb-for-limb instead of transposing.
 */
import type { FrontProfile } from "@/fitness/animation/frontProfiles";
import type { SideProfile } from "@/fitness/animation/sideProfiles";

const P = (
  head: [number, number],
  chest: [number, number],
  pelvis: [number, number],
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [
  ...head,
  ...chest,
  ...pelvis,
  ...shoulder,
  ...elbow,
  ...hand,
  ...hip,
  ...knee,
  ...foot,
];

const L = (
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [...shoulder, ...elbow, ...hand, ...hip, ...knee, ...foot];

const S = (
  head: [number, number],
  shoulder: [number, number],
  elbow: [number, number],
  hand: [number, number],
  hip: [number, number],
  knee: [number, number],
  foot: [number, number],
): number[] => [...head, ...shoulder, ...elbow, ...hand, ...hip, ...knee, ...foot];

export interface TaijiFigureProfiles {
  front: FrontProfile;
  side: SideProfile;
}

/**
 * CLOUD HANDS (云手 Yúnshǒu) — Yang style.
 *
 * Chosen as the probe because it is the one classical movement that is
 * genuinely CYCLIC: the waist turns left and right without end, the weight
 * crosses between two planted feet, and the hands trade places at each turn.
 * That maps cleanly onto the rig's two-keyframe ping-pong while stressing
 * exactly what is at risk.
 *
 * Keyframe A is the full turn to the viewer's left with the weight settled on
 * the left foot; B is its mirror. Because B is A reflected with the arms
 * swapped, every bone's two authored lengths land within a unit of each other
 * — which matters, since the rig averages them into ONE constant length and a
 * large disagreement would slide the planted feet.
 */
export const CLOUD_HANDS: TaijiFigureProfiles = {
  front: {
    frames: [
      // A — waist turned left, 70% on the left foot, left hand riding high.
      P([47, 22], [46, 39], [46, 64], [54, 40], [63, 49], [56, 58], [51, 64], [57, 81], [64, 97]),
      // B — the mirror: waist right, weight right, right hand high.
      P([53, 22], [54, 39], [54, 64], [61, 40], [72, 48], [70, 36], [59, 64], [63, 81], [64, 97]),
    ],
    framesL: [
      L([39, 40], [28, 48], [30, 36], [41, 64], [37, 81], [36, 97]),
      L([46, 40], [37, 49], [44, 58], [49, 64], [43, 81], [36, 97]),
    ],
    // One full left→right→left cycle. Yang tempo is roughly a four-second
    // weight shift; anything quicker stops being the practice.
    loopMs: 7200,
  },
  side: {
    frames: [
      // Seen from the side the SAME turn can only show up as the shoulder and
      // the knee swinging fore and aft while the hip and foot hold station —
      // the weight shift itself happens across the camera and is edge-on.
      S([50, 22], [55, 39], [58, 50], [52, 38], [50, 64], [53, 81], [50, 97]),
      S([50, 22], [45, 39], [42, 50], [50, 56], [50, 64], [47, 81], [50, 97]),
    ],
    loopMs: 7200,
  },
};
