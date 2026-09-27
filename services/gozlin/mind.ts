/**
 * mind.ts — the vocabulary and arithmetic of a state-of-mind entry.
 *
 * ── WHY VALENCE REPLACED THE 1–5 DIAL ───────────────────────────────────────
 * The old check-in asked for mood, energy and stress on three 1–5 dot rows. Two
 * problems. First, only `mood` and `sleepHours` were ever READ — `energy` and
 * `stress` were scored by nothing, so two of the four questions were asked for
 * no reason (a cosmetic counter in question form). Second, "3 out of 5" is a
 * number nobody feels. People do not experience a 3; they experience "kind of
 * flat", and a scale that cannot say that collects compliance rather than truth.
 *
 * So the primary reading is now VALENCE: one continuous axis from −1 (very
 * unpleasant) to +1 (very pleasant), named at seven stops. It is continuous in
 * storage and named on screen, which is the only arrangement that is both
 * honest to the feeling and usable by an average.
 *
 * ── WHAT REPLACED THE DIALS THAT WENT ───────────────────────────────────────
 * Nothing is lost, because the two dials that died were never read. What the
 * engine actually needed from `stress` — "was this a hard day?" — is now read
 * off the LABELS, which is strictly better information: "Stressed, Overwhelmed"
 * is a fact the person chose, where "stress: 4" was a number they estimated.
 * `sleepHours` survives untouched; it is not a feeling and detectSleepLink and
 * the learning engine both still read it.
 *
 * ── THE SCALE IS A CONTRACT ─────────────────────────────────────────────────
 * Valence is −1…+1 everywhere: in storage, in the engine, in the payload. The
 * legacy 1–5 values are remapped once by migration 004 and then never seen
 * again. `valenceFromLegacyMood` is that migration's arithmetic, kept here so
 * the mapping is stated in one place rather than inlined at the call site.
 */

/** Momentary = "how you feel right now". Daily = "how you've felt overall". */
export type MindKind = "momentary" | "daily";

/** The seven named stops on the valence axis, unpleasant → pleasant. */
export const VALENCE_STOPS = [
  "Very Unpleasant",
  "Unpleasant",
  "Slightly Unpleasant",
  "Neutral",
  "Slightly Pleasant",
  "Pleasant",
  "Very Pleasant",
] as const;

export type ValenceStop = (typeof VALENCE_STOPS)[number];

/**
 * Hue per stop, unpleasant → pleasant: deep indigo through slate to warm amber.
 * Deliberately NOT red-to-green — an unpleasant feeling is not an error state,
 * and colouring it like one editorialises the answer before it is given.
 */
export const VALENCE_COLORS = [
  "#4C3A93", // very unpleasant — deep indigo
  "#5E5BB5", // unpleasant
  "#6F82C9", // slightly unpleasant
  "#7E9BB8", // neutral — cool slate
  "#E8B06A", // slightly pleasant
  "#F0A04B", // pleasant
  "#F58F2E", // very pleasant — warm amber
] as const;

export const STOP_COUNT = VALENCE_STOPS.length;

export function clampValence(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

/** Index 0–6 of the stop a valence falls in. */
export function valenceStopIndex(v: number): number {
  const t = (clampValence(v) + 1) / 2; // 0…1
  return Math.min(STOP_COUNT - 1, Math.round(t * (STOP_COUNT - 1)));
}

export function valenceLabel(v: number): ValenceStop {
  return VALENCE_STOPS[valenceStopIndex(v)];
}

export function valenceColor(v: number): string {
  return VALENCE_COLORS[valenceStopIndex(v)];
}

/** The exact valence at a stop index — what the slider snaps to. */
export function valenceAtStop(i: number): number {
  const clamped = Math.max(0, Math.min(STOP_COUNT - 1, i));
  return (clamped / (STOP_COUNT - 1)) * 2 - 1;
}

/* ───────────────────────────── Legacy bridge ───────────────────────────── */

/**
 * Legacy 1–5 mood → valence, as 1→−1, 2→−⅓, 3→0, 4→+⅓, 5→+1.
 *
 * ── WHY NOT THE OBVIOUS (mood − 3) / 2 ──────────────────────────────────────
 * That formula gives ±0.5 for moods 2 and 4, and ±0.5 falls EXACTLY between two
 * stops — stop index 1.5 and 4.5. Rounding sends both halves upward, so mood 2
 * landed on "Slightly Unpleasant" (index 2) while mood 4 landed on "Pleasant"
 * (index 5). Those are not mirror images: the mirror of index 2 is index 4. The
 * same answer either side of neutral came out at different distances from it,
 * which would have tilted every historical average upward.
 *
 * So the five old points are mapped onto five stops directly and symmetrically:
 *
 *     1 → Very Unpleasant   (−1)
 *     2 → Slightly Unpleasant (−⅓)
 *     3 → Neutral           ( 0)
 *     4 → Slightly Pleasant (+⅓)
 *     5 → Very Pleasant     (+1)
 *
 * The plain "Unpleasant" and "Pleasant" stops stay unoccupied by history, which
 * is the honest outcome: a 5-point scale cannot distinguish "unpleasant" from
 * "slightly unpleasant", and the milder reading is the one that does not
 * overstate what the user actually said.
 */
export function valenceFromLegacyMood(mood: number): number {
  const stop = LEGACY_MOOD_STOPS[Math.round(mood)];
  return stop === undefined ? 0 : valenceAtStop(stop);
}

/** Stop index for each legacy 1–5 answer. Symmetric about Neutral. */
const LEGACY_MOOD_STOPS: Record<number, number> = { 1: 0, 2: 2, 3: 3, 4: 4, 5: 6 };

/** Valence → the old 1–5, for any legacy read that still wants it. */
export function legacyMoodFromValence(v: number): number {
  return Math.round(clampValence(v) * 2 + 3);
}

/**
 * THE reader for an entry's feeling. Every surface goes through this.
 *
 * Records come in two vintages — `valence` since migration 004, a 1–5 `mood`
 * before it — and timeline events backfilled by migration 001 keep the legacy
 * shape forever, because L1 is append-only. Five different screens were about to
 * each carry their own copy of the conversion, which is how the duplicated
 * confidence ranks in the food lookup came apart: the day one copy is corrected
 * the others quietly disagree, and the same record starts reading differently
 * depending on which screen you are on.
 *
 * Returns null when the record carries no feeling at all — a sleep-only
 * check-in. Callers must render that as absent, never as Neutral, because
 * Neutral is a real answer somebody chose.
 */
export function readEntryValence(entry: {
  valence?: number;
  mood?: number;
}): number | null {
  if (typeof entry.valence === "number" && Number.isFinite(entry.valence)) {
    return clampValence(entry.valence);
  }
  if (typeof entry.mood === "number" && Number.isFinite(entry.mood)) {
    return valenceFromLegacyMood(entry.mood);
  }
  return null;
}

/* ─────────────────────────────── Labels ────────────────────────────────── */

/**
 * Polarity is what makes the label step feel like it read the slider: after
 * "Very Pleasant" the pleasant words come first, and the list still holds every
 * word so a mixed feeling ("Pleasant, but Anxious") is always sayable.
 */
export type Polarity = -1 | 0 | 1;

export interface MindLabel {
  value: string;
  polarity: Polarity;
}

export const MIND_LABELS: readonly MindLabel[] = [
  { value: "Amazed", polarity: 1 },
  { value: "Amused", polarity: 1 },
  { value: "Angry", polarity: -1 },
  { value: "Annoyed", polarity: -1 },
  { value: "Anxious", polarity: -1 },
  { value: "Ashamed", polarity: -1 },
  { value: "Brave", polarity: 1 },
  { value: "Calm", polarity: 1 },
  { value: "Confident", polarity: 1 },
  { value: "Content", polarity: 1 },
  { value: "Disappointed", polarity: -1 },
  { value: "Discouraged", polarity: -1 },
  { value: "Disgusted", polarity: -1 },
  { value: "Drained", polarity: -1 },
  { value: "Embarrassed", polarity: -1 },
  { value: "Excited", polarity: 1 },
  { value: "Frustrated", polarity: -1 },
  { value: "Grateful", polarity: 1 },
  { value: "Guilty", polarity: -1 },
  { value: "Happy", polarity: 1 },
  { value: "Hopeful", polarity: 1 },
  { value: "Hopeless", polarity: -1 },
  { value: "Indifferent", polarity: 0 },
  { value: "Irritated", polarity: -1 },
  { value: "Jealous", polarity: -1 },
  { value: "Joyful", polarity: 1 },
  { value: "Lonely", polarity: -1 },
  { value: "Overwhelmed", polarity: -1 },
  { value: "Passionate", polarity: 1 },
  { value: "Peaceful", polarity: 1 },
  { value: "Proud", polarity: 1 },
  { value: "Relieved", polarity: 1 },
  { value: "Sad", polarity: -1 },
  { value: "Satisfied", polarity: 1 },
  { value: "Scared", polarity: -1 },
  { value: "Stressed", polarity: -1 },
  { value: "Surprised", polarity: 0 },
  { value: "Tired", polarity: -1 },
  { value: "Worried", polarity: -1 },
];

/**
 * The labels that mean "this was a hard day", which is the signal the old
 * `stress` dial was standing in for. detectMoodLink reads this set.
 *
 * Deliberately narrower than "every unpleasant word": Sad and Lonely are
 * genuinely unpleasant but they are not the load-under-pressure state that
 * drives stress eating, and folding them in would blur the pattern the coach
 * reports. This set is about pressure, not about low feeling.
 */
export const STRESS_LABELS: ReadonlySet<string> = new Set([
  "Angry",
  "Anxious",
  "Drained",
  "Frustrated",
  "Irritated",
  "Overwhelmed",
  "Scared",
  "Stressed",
  "Tired",
  "Worried",
]);

/** Labels ordered so the chosen valence's own polarity leads. Stable within a band. */
export function labelsForValence(v: number): readonly MindLabel[] {
  const stop = valenceStopIndex(v);
  // The middle stop is genuinely ambivalent — leave the alphabet alone there
  // rather than nudging someone toward a polarity they did not pick.
  if (stop === 3) return MIND_LABELS;
  const want: Polarity = stop > 3 ? 1 : -1;
  const lead = MIND_LABELS.filter((l) => l.polarity === want);
  const rest = MIND_LABELS.filter((l) => l.polarity !== want);
  return [...lead, ...rest];
}

/* ──────────────────────────── Associations ─────────────────────────────── */

export interface MindAssociation {
  value: string;
  label: string;
  icon: string;
}

/**
 * "What's having the biggest impact on you?" — the life domains an entry can be
 * attributed to. These are the reason the whole feature earns its place in a
 * health app: a valence trend on its own is a mood ring, but a valence trend
 * that knows Work was named on every unpleasant day is a finding.
 */
export const MIND_ASSOCIATIONS: readonly MindAssociation[] = [
  { value: "community", label: "Community", icon: "people-outline" },
  { value: "current_events", label: "Current Events", icon: "newspaper-outline" },
  { value: "dating", label: "Dating", icon: "heart-outline" },
  { value: "education", label: "Education", icon: "school-outline" },
  { value: "family", label: "Family", icon: "home-outline" },
  { value: "fitness", label: "Fitness", icon: "barbell-outline" },
  { value: "friends", label: "Friends", icon: "chatbubbles-outline" },
  { value: "health", label: "Health", icon: "medkit-outline" },
  { value: "hobbies", label: "Hobbies", icon: "color-palette-outline" },
  { value: "identity", label: "Identity", icon: "person-outline" },
  { value: "money", label: "Money", icon: "cash-outline" },
  { value: "partner", label: "Partner", icon: "heart-circle-outline" },
  { value: "self_care", label: "Self-Care", icon: "leaf-outline" },
  { value: "spirituality", label: "Spirituality", icon: "sparkles-outline" },
  { value: "tasks", label: "Tasks", icon: "checkbox-outline" },
  { value: "travel", label: "Travel", icon: "airplane-outline" },
  { value: "weather", label: "Weather", icon: "partly-sunny-outline" },
  { value: "work", label: "Work", icon: "briefcase-outline" },
];

const ASSOCIATION_LABELS = new Map(
  MIND_ASSOCIATIONS.map((a) => [a.value, a.label] as const),
);

/** Display name for a stored association key, falling back to the key itself. */
export function associationLabel(value: string): string {
  return ASSOCIATION_LABELS.get(value) ?? value;
}
