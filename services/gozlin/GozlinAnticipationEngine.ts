/**
 * GOZLIN — Anticipation Engine (P1 of the Proactive Companion).
 *
 * The brain that makes Gozlin ANTICIPATE rather than react. Where `GozlinMomentEngine`
 * ranks PRESENT-tense beats from the Twin, this reads FORWARD time — Life Context
 * (upcoming events), the user's health profile (pregnancy / injuries / medications,
 * captured at onboarding), today's weather, and the Twin's recovery — and emits ranked,
 * time-aware coaching plus a computed `CoachingMode`.
 *
 * Pure & deterministic (inject `now`); no storage, no LLM. It RE-SCORES nothing — it
 * reads trusted signals and produces forward guidance + explanations. The deterministic
 * voice keeps it consistent with every other Gozlin surface.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §3.3.
 */
import type {
  MedicalCondition,
  MedicationCategory,
  UserBio,
} from "../../models/user";
import { parseLocalDate, toLocalDateString } from "../OfflineStorage";
import type { GozlinTone, GozlinTwin } from "./gozlin.types";
// Type-only imports from the substrate (erased at runtime — no cycle).
import type {
  LifeEvent,
  LifeEventKind,
  WeatherSnapshot,
  WearableSnapshot,
  WorkoutWeatherHint,
} from "@/health-os";
import { wearableHints } from "@/health-os";

// ── coaching modes ──

export type CoachingMode =
  | "normal"
  | "prenatal"
  | "medical"
  | "recovery"
  | "event_taper"
  | "travel"
  | "exam"
  | "work_pressure"
  | "maintenance";

export interface CoachingModeMeta {
  label: string;
  blurb: string;
  icon: string;
}

export const COACHING_MODE_META: Record<CoachingMode, CoachingModeMeta> = {
  normal: { label: "On plan", blurb: "Coaching you at your normal pace.", icon: "checkmark-circle" },
  prenatal: { label: "Prenatal care", blurb: "Training and nutrition adapted for pregnancy.", icon: "heart" },
  medical: { label: "Medical care", blurb: "Easing around a medical event and recovery.", icon: "medkit" },
  recovery: { label: "Recovery", blurb: "Pulling intensity back so your body adapts.", icon: "bed" },
  event_taper: { label: "Taper", blurb: "Sharpening you for an event that's close.", icon: "trophy" },
  travel: { label: "Travel", blurb: "Hotel-friendly sessions and a maintenance target.", icon: "airplane" },
  exam: { label: "Exam season", blurb: "Protecting sleep and keeping sessions short.", icon: "school" },
  work_pressure: { label: "Busy stretch", blurb: "Short workouts so your streak survives the crunch.", icon: "briefcase" },
  maintenance: { label: "Maintenance", blurb: "Holding your ground so you can enjoy the break.", icon: "sunny" },
};

// ── anticipations ──

export type AnticipationKind = "health" | "life" | "weather" | "recovery";

export interface Anticipation {
  id: string;
  kind: AnticipationKind;
  icon: string;
  title: string;
  /** The forward, time-aware coaching, in Gozlin's voice. */
  message: string;
  tone: GozlinTone;
  /** Leverage rank (higher first), same scale as GozlinMomentEngine. */
  priority: number;
  /** Days until the trigger (0 today/active, undefined for non-dated). */
  leadDays?: number;
  /** The "why Gozlin said this" trail. */
  explanation: string;
  /** A seed prompt for opening Gozlin chat about it. */
  prompt: string;
  /** Short CTA button label, if any. */
  cta?: string;
  /**
   * When the CTA should add a dated Life Context entry (so future coaching becomes
   * time-aware), the kind to pre-select. Drives the "add the date" loop.
   */
  addKind?: LifeEventKind;
}

export interface AnticipationInput {
  twin: GozlinTwin | null;
  bio: UserBio | null;
  /** Active life events (e.g. lifeContext.listActive()). */
  lifeEvents: LifeEvent[];
  /**
   * Free-text health facts the user told Gozlin (the L3 identity "constraints" —
   * e.g. "asthma", "lactose intolerant", "bad left knee"). Considered alongside the
   * structured profile so ANY health info the user has shared shapes coaching.
   */
  healthConstraints?: string[];
  weather?: WeatherSnapshot | null;
  weatherHint?: WorkoutWeatherHint | null;
  /** Real wearable metrics (sleep / HRV) — drive sleep-debt + strain anticipations (P4). */
  wearable?: WearableSnapshot | null;
  now?: Date;
}

export interface AnticipationResult {
  mode: CoachingMode;
  modeLabel: string;
  modeReason: string;
  anticipations: Anticipation[];
}

const MAX_ANTICIPATIONS = 6;

// ── date helpers (local, mirror GozlinTwin) ──

function daysBetween(fromDate: string, toDate: string): number {
  const a = parseLocalDate(fromDate).getTime();
  const b = parseLocalDate(toDate).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Days from today to an event's start (negative once it's begun). */
function startIn(e: LifeEvent, today: string): number {
  return daysBetween(today, e.window.start);
}

/** True if `today` falls inside the event window. */
function isActive(e: LifeEvent, today: string): boolean {
  const s = startIn(e, today);
  const end = e.window.end ? daysBetween(today, e.window.end) : s;
  return s <= 0 && end >= 0;
}

function within(e: LifeEvent, today: string, days: number): boolean {
  const s = startIn(e, today);
  return (s >= 0 && s <= days) || isActive(e, today);
}

function countdown(daysAhead: number): string {
  if (daysAhead > 1) return `in ${daysAhead} days`;
  if (daysAhead === 1) return "tomorrow";
  if (daysAhead === 0) return "today";
  return "happening now";
}

/** Proximity weight added to a life-event anticipation's base priority. */
function proximityBoost(e: LifeEvent, today: string): number {
  const s = startIn(e, today);
  if (s <= 0) return 12;
  if (s <= 2) return 10;
  if (s <= 7) return 7;
  if (s <= 21) return 3;
  return 0;
}

// ── coaching mode ──

function deriveMode(
  input: AnticipationInput,
  today: string,
): { mode: CoachingMode; reason: string } {
  const { bio, twin, lifeEvents } = input;
  const cond = bio?.medicalConditions ?? [];
  const find = (k: LifeEventKind) => lifeEvents.find((e) => e.kind === k);

  if (cond.includes("pregnancy")) {
    return { mode: "prenatal", reason: "You're pregnant — keeping training and nutrition pregnancy-safe." };
  }
  const surgery = find("surgery");
  if (
    (surgery && within(surgery, today, 14)) ||
    cond.includes("postpartum") ||
    (find("illness_recovery") && isActive(find("illness_recovery")!, today))
  ) {
    return { mode: "medical", reason: "There's a medical event in play — easing around it." };
  }
  const comp = find("competition");
  if (comp && within(comp, today, 10)) {
    return { mode: "event_taper", reason: `'${comp.title}' is close — tapering you for it.` };
  }
  if (twin?.recovery.level === "red") {
    return { mode: "recovery", reason: "Your recovery is reading low — backing off to let you adapt." };
  }
  const travel = find("travel");
  if (travel && (isActive(travel, today) || startIn(travel, today) <= 3)) {
    return { mode: "travel", reason: `'${travel.title}' — switching to travel-friendly coaching.` };
  }
  const exam = find("exam_period");
  if (exam && within(exam, today, 7)) {
    return { mode: "exam", reason: `'${exam.title}' — protecting your sleep and focus.` };
  }
  const vac = find("vacation");
  if (vac && isActive(vac, today)) {
    return { mode: "maintenance", reason: `You're on '${vac.title}' — holding your ground.` };
  }
  const deadline = find("deadline");
  if (deadline && within(deadline, today, 5)) {
    return { mode: "work_pressure", reason: `'${deadline.title}' is near — keeping workouts short.` };
  }
  return { mode: "normal", reason: "Nothing unusual ahead — coaching at your normal pace." };
}

// ── health-profile anticipations (the onboarding-aware coaching) ──

const TRIMESTER_GUIDANCE: Record<1 | 2 | 3, string> = {
  1: "First trimester — fatigue and nausea are normal. Keep movement gentle (walking, light strength), prioritise sleep, and sip water through the day. No need to push intensity.",
  2: "Second trimester — usually your best energy window. Strength work and brisk walks are great; avoid long spells lying flat, keep core work gentle, and keep hydration high.",
  3: "Third trimester — shift to mobility, pelvic-floor and breathing work, short sessions and extra rest. Hydrate well and stop anything that strains or overheats you.",
};

const MED_NOUN: Record<MedicationCategory, string> = {
  antibiotics: "antibiotics",
  antidepressants: "antidepressants",
  blood_thinners: "blood thinners",
  blood_pressure: "blood-pressure medication",
  corticosteroids: "corticosteroids",
  diabetes: "diabetes medication",
  diuretics: "diuretics",
  thyroid: "thyroid medication",
  nsaids: "anti-inflammatories",
  other: "your medication",
};

const MED_QUESTION: Record<MedicationCategory, string> = {
  antibiotics: "Finishing the full course matters — how are you feeling on it?",
  antidepressants: "How are your energy, sleep and mood lately?",
  blood_thinners: "Keeping leafy greens steady, and noticing any unusual bruising?",
  blood_pressure: "How's your energy holding up during workouts?",
  corticosteroids: "Watching appetite and sodium — how do you feel?",
  diabetes: "How are your energy and blood-sugar swings around training?",
  diuretics: "Staying on top of hydration and electrolytes?",
  thyroid: "How's your energy and temperature regulation?",
  nsaids: "How's the pain you were managing?",
  other: "How are you feeling on it?",
};

/**
 * Supportive, NON-prescriptive coaching per structured medical condition (we never give
 * medical orders — we check in and shape training/nutrition gently). Pregnancy/postpartum
 * are handled separately above; "none" is skipped.
 */
const CONDITION_GUIDANCE: Partial<
  Record<MedicalCondition, { icon: string; title: string; message: string; priority: number }>
> = {
  hypertension: {
    icon: "pulse",
    title: "Keeping your blood pressure in mind",
    message:
      "You've noted high blood pressure. I keep sodium sensible and favour steady cardio over max-effort strain, and I'll cue you to breathe through lifts rather than hold. How's it been reading lately?",
    priority: 74,
  },
  diabetes_type2: {
    icon: "water",
    title: "Working with your blood sugar",
    message:
      "With type-2 diabetes, a walk after meals and steady, fibre-rich carbs help most. How are your energy and blood-sugar swings around training — any lows I should plan around?",
    priority: 74,
  },
  renal_issues: {
    icon: "medical",
    title: "Mindful of your kidneys",
    message:
      "With your kidney considerations I keep protein and sodium sensible and hydration steady rather than extreme. How have you been feeling — anything your clinician has adjusted?",
    priority: 72,
  },
};

function healthAnticipations(
  bio: UserBio,
  lifeEvents: LifeEvent[],
  today: string,
  constraints: string[],
): Anticipation[] {
  const out: Anticipation[] = [];
  const cond = bio.medicalConditions ?? [];
  const find = (k: LifeEventKind) => lifeEvents.find((e) => e.kind === k);

  // Pregnancy — time-aware via trimester (and a due-date countdown if present).
  if (cond.includes("pregnancy")) {
    const tri = bio.pregnancyTrimester;
    const due = find("pregnancy_due");
    const dueIn = due ? Math.max(0, startIn(due, today)) : null;
    const weeksToDue = dueIn != null ? Math.round(dueIn / 7) : null;
    const guidance = tri
      ? TRIMESTER_GUIDANCE[tri]
      : "Tell me which trimester you're in and I'll tailor each stage — training, hydration and rest.";
    const dueLine = weeksToDue != null ? ` About ${weeksToDue} week${weeksToDue === 1 ? "" : "s"} to your due date.` : "";
    out.push({
      id: "health_pregnancy",
      kind: "health",
      icon: "heart",
      title: tri ? `Trimester ${tri} — let's adapt` : "Tailoring for your pregnancy",
      message: guidance + dueLine,
      tone: "gentle",
      priority: 94,
      explanation: tri
        ? `Because your profile says you're pregnant (trimester ${tri}).`
        : "Because your profile says you're pregnant.",
      prompt: "I'm pregnant — tailor my training, hydration and rest for this stage.",
      ...(due ? {} : { cta: "Add your due date", addKind: "pregnancy_due" as LifeEventKind }),
    });
  } else if (cond.includes("postpartum")) {
    out.push({
      id: "health_postpartum",
      kind: "health",
      icon: "heart-half",
      title: "Easing back postpartum",
      message:
        "We'll rebuild gently — pelvic-floor and core first, sleep and hydration protected, intensity only when you're ready. How are you feeling and recovering?",
      tone: "gentle",
      priority: 88,
      explanation: "Because your profile says you're postpartum.",
      prompt: "I'm postpartum — help me ease back into training safely.",
    });
  }

  // Injuries — "it's been N weeks since…" when a recovery date exists, else prompt for it.
  if (bio.injuries && bio.injuries.length > 0) {
    const inj = bio.injuries.join(", ");
    const rec = find("illness_recovery");
    const weeks = rec ? Math.floor(daysBetween(rec.window.start, today) / 7) : null;
    const message =
      weeks != null && weeks >= 0
        ? `It's been about ${weeks} week${weeks === 1 ? "" : "s"} since your ${inj}. Do you still feel pain or stiffness when you load it? If it's settling, we can start carefully reloading — tell me how it feels.`
        : `You told me about a ${inj} issue. How's it feeling now — still painful, or ready to start reloading? Either way I'll keep training around it.`;
    out.push({
      id: "health_injury",
      kind: "health",
      icon: "bandage",
      title: "Checking on your injury",
      message,
      tone: weeks != null ? "honest" : "curious",
      priority: 84,
      explanation: `Because your profile lists an injury (${inj}).`,
      prompt: `About my ${inj} — here's how it feels, adjust my training.`,
      ...(rec ? {} : { cta: "Log when it started", addKind: "illness_recovery" as LifeEventKind }),
    });
  }

  // Medications — category-aware check-in, with a course-end countdown if present.
  const cat = bio.medicationCategories?.[0];
  if (cat || (bio.medications && bio.medications.length > 0)) {
    const noun = cat ? MED_NOUN[cat] : "your medication";
    const question = cat ? MED_QUESTION[cat] : MED_QUESTION.other;
    const course = find("medication_course");
    const endsIn = course?.window.end ? daysBetween(today, course.window.end) : null;
    const message =
      endsIn != null && endsIn >= 0
        ? `Your ${noun} course wraps up in about ${endsIn} day${endsIn === 1 ? "" : "s"}. ${question} Has your dosage changed or been extended?`
        : `You're taking ${noun}. ${question} Still on the same dose, or has it changed? Tell me and I'll factor it in.`;
    out.push({
      id: "health_medication",
      kind: "health",
      icon: "medical",
      title: "About your medication",
      message,
      tone: "curious",
      priority: 76,
      explanation: `Because your profile notes ${noun}.`,
      prompt: `I'm on ${noun} — here's how I feel, factor it into my plan.`,
      ...(course ? {} : { cta: "Add course end date", addKind: "medication_course" as LifeEventKind }),
    });
  }

  // Any OTHER structured medical condition (hypertension / diabetes / renal).
  for (const c of cond) {
    const g = CONDITION_GUIDANCE[c];
    if (!g) continue;
    out.push({
      id: `health_condition_${c}`,
      kind: "health",
      icon: g.icon,
      title: g.title,
      message: g.message,
      tone: "curious",
      priority: g.priority,
      explanation: `Because your profile notes ${c.replace(/_/g, " ")}.`,
      prompt: `I have ${c.replace(/_/g, " ")} — factor it into my training and meals.`,
    });
  }

  // Free-text health facts the user told Gozlin (L3 constraints) — catch-all so ANY
  // health info shapes coaching, even what isn't a structured field.
  const extra = constraints
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
  if (extra.length > 0) {
    const list = extra.join("; ");
    out.push({
      id: "health_constraints",
      kind: "health",
      icon: "clipboard",
      title: extra.length === 1 ? "Something you told me" : "Things you told me",
      message: `You mentioned: ${list}. How's that going lately? I keep it in mind for every plan — tell me if anything's changed.`,
      tone: "curious",
      priority: 70,
      explanation: "Because you shared this with me earlier.",
      prompt: `About what I told you (${list}) — here's an update.`,
    });
  }

  return out;
}

// ── life-event anticipations (forward, kind-templated) ──

interface LifeTemplate {
  icon: string;
  tone: GozlinTone;
  base: number;
  build: (title: string, cd: string) => { title: string; message: string };
}

const LIFE_TEMPLATES: Partial<Record<LifeEventKind, LifeTemplate>> = {
  travel: {
    icon: "airplane",
    tone: "warm",
    base: 70,
    build: (t, cd) => ({
      title: "A trip is coming",
      message: `'${t}' is ${cd}. I'll switch you to hotel/bodyweight sessions and a maintenance calorie target while you're away — want me to prep travel workouts?`,
    }),
  },
  vacation: {
    icon: "sunny",
    tone: "warm",
    base: 64,
    build: (t, cd) => ({
      title: "Vacation ahead",
      message: `'${t}' starts ${cd}. I'll ease you into maintenance mode so you enjoy it without losing your progress.`,
    }),
  },
  wedding: {
    icon: "heart",
    tone: "warm",
    base: 72,
    build: (t, cd) => ({
      title: "Your big day's coming",
      message: `${cd} to '${t}'. Let's lock in steady nutrition and good sleep so you look and feel your best — no crash diets, I've got you.`,
    }),
  },
  competition: {
    icon: "trophy",
    tone: "steady",
    base: 80,
    build: (t, cd) => ({
      title: "Race week approaching",
      message: `${cd} to '${t}'. Time to taper — I'll trim volume, keep intensity sharp, and prioritise sleep and carbs.`,
    }),
  },
  exam_period: {
    icon: "school",
    tone: "gentle",
    base: 68,
    build: (t, cd) => ({
      title: "Exam season ahead",
      message: `'${t}' is ${cd}. I'll protect your sleep and keep sessions short and stress-busting — movement sharpens focus.`,
    }),
  },
  surgery: {
    icon: "medkit",
    tone: "gentle",
    base: 86,
    build: (t, cd) => ({
      title: "Procedure coming up",
      message: `'${t}' is ${cd}. Let's build you up beforehand and I'll plan a gentle recovery ramp for after.`,
    }),
  },
  deadline: {
    icon: "briefcase",
    tone: "warm",
    base: 60,
    build: (t, cd) => ({
      title: "Busy stretch ahead",
      message: `'${t}' ${cd} — a crunch is coming. I'll keep your workouts short so your streak survives it.`,
    }),
  },
  relocation: {
    icon: "home",
    tone: "warm",
    base: 52,
    build: (t, cd) => ({
      title: "A move is coming",
      message: `'${t}' ${cd}. Moving is exhausting — I'll keep things light and flexible around it.`,
    }),
  },
  holiday: {
    icon: "gift",
    tone: "warm",
    base: 48,
    build: (t, cd) => ({
      title: "A holiday's near",
      message: `'${t}' ${cd}. I'll plan around it so you can enjoy the day guilt-free.`,
    }),
  },
  anniversary: {
    icon: "ribbon",
    tone: "warm",
    base: 44,
    build: (t, cd) => ({
      title: "Something to mark",
      message: `'${t}' ${cd}.`,
    }),
  },
  other: {
    icon: "calendar",
    tone: "warm",
    base: 46,
    build: (t, cd) => ({
      title: "On your horizon",
      message: `'${t}' is ${cd}. Want me to plan around it?`,
    }),
  },
};

// Kinds owned by the health-profile anticipations (so we don't double-emit).
const HEALTH_OWNED: ReadonlySet<LifeEventKind> = new Set<LifeEventKind>([
  "pregnancy_due",
  "illness_recovery",
  "medication_course",
]);

function lifeAnticipations(lifeEvents: LifeEvent[], today: string): Anticipation[] {
  const out: Anticipation[] = [];
  for (const e of lifeEvents) {
    if (HEALTH_OWNED.has(e.kind)) continue;
    const tpl = LIFE_TEMPLATES[e.kind];
    if (!tpl) continue;
    const s = startIn(e, today);
    if (s > 45 && !isActive(e, today)) continue; // too far to anticipate yet
    const cd = countdown(s);
    const built = tpl.build(e.title, cd);
    out.push({
      id: `life_${e.id}`,
      kind: "life",
      icon: tpl.icon,
      title: built.title,
      message: built.message,
      tone: tpl.tone,
      priority: tpl.base + proximityBoost(e, today),
      leadDays: s,
      explanation: `Because '${e.title}' is on your horizon (${cd}).`,
      prompt: `'${e.title}' is coming up — help me plan around it.`,
    });
  }
  return out;
}

// ── weather + recovery anticipations ──

function contextAnticipations(input: AnticipationInput): Anticipation[] {
  const out: Anticipation[] = [];
  const { twin, weather, weatherHint, wearable } = input;
  const workoutPending = !!twin?.flags.includes("WORKOUT_PENDING");

  // ── Wearable: sleep-debt + strain beats (the real-recovery payoff of P4). ──
  const wHints = wearable ? wearableHints(wearable) : [];
  for (const h of wHints) {
    out.push({
      id: `wearable_${h.kind}`,
      kind: "recovery",
      icon: h.kind === "sleep" ? "moon" : "pulse",
      title: h.title,
      message: h.message,
      tone: "gentle",
      priority: h.priority,
      explanation:
        h.kind === "sleep"
          ? "Because your wearable shows you slept short last night."
          : "Because your HRV is reading below your personal baseline.",
      prompt:
        h.kind === "sleep"
          ? "I slept badly — adjust today's training and food."
          : "My recovery's low today — ease my plan.",
    });
  }

  // The score-based recovery beat is redundant once a wearable beat already explains it.
  if (twin?.recovery.level === "red" && wHints.length === 0) {
    out.push({
      id: "recovery_red",
      kind: "recovery",
      icon: "bed",
      title: "Let's bank some recovery",
      message: `Your recovery is reading ${twin.recovery.score}/100. Let's pull intensity back today and let your body adapt — it pays off this week.`,
      tone: "gentle",
      priority: 82,
      explanation: "Because your training-load recovery score is in the red.",
      prompt: "My recovery is low — adjust today's training.",
    });
  }

  if (weather && weatherHint && workoutPending) {
    if (weatherHint.indoor) {
      out.push({
        id: "weather_indoor",
        kind: "weather",
        icon: weather.icon,
        title: "Weather's turning",
        message: `${weatherHint.reason} Want me to swap today's session to an indoor version?`,
        tone: "honest",
        priority: 58,
        explanation: `Because today's forecast is ${weather.condition.toLowerCase()} (${weather.tempC}°).`,
        prompt: "Swap my workout to an indoor version for today's weather.",
        cta: "Make it indoor",
      });
    } else {
      out.push({
        id: "weather_outdoor",
        kind: "weather",
        icon: weather.icon,
        title: "Great day to move",
        message: weatherHint.reason,
        tone: "warm",
        priority: 40,
        explanation: `Because today's forecast is ${weather.condition.toLowerCase()} (${weather.tempC}°).`,
        prompt: "Plan an outdoor session for today.",
      });
    }
  }

  return out;
}

// ── entry point ──

export function buildAnticipations(input: AnticipationInput): AnticipationResult {
  const now = input.now ?? new Date();
  const today = toLocalDateString(now);

  const { mode, reason } = deriveMode(input, today);

  const constraints = input.healthConstraints ?? [];
  const anticipations: Anticipation[] = [
    ...(input.bio
      ? healthAnticipations(input.bio, input.lifeEvents, today, constraints)
      : constraints.length > 0
        ? healthAnticipations(
            { medicalConditions: [] } as unknown as UserBio,
            input.lifeEvents,
            today,
            constraints,
          )
        : []),
    ...lifeAnticipations(input.lifeEvents, today),
    ...contextAnticipations(input),
  ]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_ANTICIPATIONS);

  return {
    mode,
    modeLabel: COACHING_MODE_META[mode].label,
    modeReason: reason,
    anticipations,
  };
}
