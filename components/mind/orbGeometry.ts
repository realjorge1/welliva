/**
 * How far the mood orb's canvas runs past the orb on every side, as a share of
 * the orb's size — so its blurred glow fades out well inside the canvas instead
 * of being cut off at the edge (see MoodOrb.skia, "the glow never meets an
 * edge"). Its own module, free of Skia, because the sheet sizes the orb by it
 * and must load on a surface where Skia is absent.
 */
export const ORB_BLEED = 0.35;
