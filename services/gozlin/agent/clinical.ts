/**
 * GOZLIN AGENT — clinical safety gate.
 *
 * Two layers, and the order matters.
 *
 *   1. screenForClinicalRisk() runs BEFORE the model is ever called. If it
 *      fires, no request goes out — we answer deterministically and refer out.
 *      A gate the model can be talked around is not a gate.
 *
 *   2. conditionRules() emits hard constraints for this user's conditions,
 *      injected into the volatile system block (see ./context.ts). These bound
 *      what the model may advise for someone whose physiology makes ordinary
 *      advice wrong — the CKD-and-protein case being the sharpest.
 *
 * We support pregnancy, diabetes, renal disease and medications. The model must
 * not free-associate on any of them.
 */

import type { MedicalCondition, UserBio } from "../../../models/user";

// ════════════════════════════════════════════════════════════════
// 1. Pre-model screen
// ════════════════════════════════════════════════════════════════

export type ClinicalRiskKind =
  | "emergency" // acute symptoms — stop everything, refer now
  | "symptom" // "why does X hurt / is X normal" — clinician, not coach
  | "diagnosis" // "do I have X"
  | "medication" // dosage, interactions, starting/stopping
  | "mental_health" // self-harm / crisis
  | "disordered_eating";

export interface ClinicalRisk {
  kind: ClinicalRiskKind;
  /** The reply to send verbatim. Deterministic — never model-generated. */
  reply: string;
}

/**
 * Acute red flags. Deliberately narrow and anchored to body words so ordinary
 * training talk ("my legs are dead", "that session killed me") doesn't trip it.
 */
const EMERGENCY =
  /\b(chest (pain|tightness|pressure)|can'?t breathe|cannot breathe|short(ness)? of breath at rest|passed out|fainted|blacked out|coughing up blood|blood in my (stool|urine|vomit)|numbness (in|on) (my )?(one side|left|right)|slurred speech|suicidal|kill myself|end my life)\b/i;

/** Symptom interpretation — "is this normal", "why does this hurt". */
const SYMPTOM =
  /\b(sharp pain|stabbing pain|shooting pain|pain in my (chest|head|joint|knee|back|shoulder|hip|stomach|abdomen)|swollen|swelling|dizzy|dizziness|light[- ]?headed|nauseous|nausea|vomiting|fever|rash|lump|numb|tingling|palpitations?|irregular heartbeat|can'?t sleep at all|(gives?|gave) (out|way)|buckl(es|ed|ing)|locks? up|clicks? and|pops? and|(what|why).{0,30}\b(hurts?|aching|ache)\b.{0,20}\?|is (it|this) normal (that|to|for).{0,40}(pain|hurt|blood|dizzy|numb))\b/i;

/** Diagnosis-seeking. */
const DIAGNOSIS =
  /\b(do (i|you think i) have\b|am i (diabetic|an?a?emic|hypothyroid|pregnant|deficient)|diagnose|is (this|it) (cancer|diabetes|a tear|broken|fractured|an infection)|what'?s wrong with me|(could|might|maybe) (my|it be my) (thyroid|iron|b12|hormones?|blood sugar|metabolism)|(could|do you think) (i|this) (be|is|have) (an?|my)? ?(deficiency|thyroid|anemia|anaemia|infection)|(be|is) my (thyroid|iron|b12|hormones?) (off|low|the problem))\b/i;

/**
 * Medication / supplement-as-treatment. A milligram figure or a "dosage" is
 * NOT in here — see medicationDose() below, which reads what the figure is of.
 */
const MEDICATION =
  /\b(how much (should i take|of my (meds?|medication|medicine|pills?|tablets?|insulin|prescription|dose))|(should|can|is it (ok|fine|safe)) (i |to )?(take|stop|start|skip|double|halve|come off|quit) (my |taking |taking my )?(meds?|medication|medicine|pill|insulin|metformin|statin|steroid|antibiotic|thyroid|blood thinner|antidepressants?|ssri|lithium|beta blocker|ozempic|semaglutide|wegovy)|(with|alongside|while (on|taking)) my (meds?|medication|medicine|insulin|lithium|statin|thyroid|antidepressants?|blood thinner|prescription)|(interact|interfere|mess) (with|up) (my )?(meds?|medication|thyroid|insulin|prescription)|drug interactions?|instead of my (meds?|medication)|(take|start|get|try) (ozempic|wegovy|semaglutide|mounjaro|tirzepatide))\b/i;

/** Disordered-eating signals. Coach the person, never the behaviour. */
const DISORDERED_EATING =
  /\b(purg(e|ing|ed)|make myself (throw up|sick|vomit)|made myself sick|laxatives?|diet pills?|appetite suppressant|starv(e|ing) myself|([0-9]|10)\d{2} calories? (a|per) day|(under|below|only) \d{3} calories|fast(ing)? for \d+ ?(days?|weeks?)|water fast(ing)?|(burn|work) off (what|everything|all) i ate|cancel out (a|the|my|that) (binge|meal|eating)|compensate for (eating|the binge|overeating)|punish myself for eating|hate my body|disgusted (with|by) myself)\b/i;

const REFER =
  "This needs someone who can actually examine you — please talk to a doctor or another qualified professional.";

const REPLIES: Record<ClinicalRiskKind, string> = {
  emergency:
    "I want to stop here — what you're describing needs urgent medical attention, not a coach. " +
    "Please contact emergency services or get to urgent care now. " +
    "I'll be right here when you're safe and looked after.",
  symptom:
    `That's outside what I can read from your training and nutrition data. ${REFER} ` +
    "Once you know what's going on, tell me the limits they give you and I'll build around them.",
  diagnosis:
    `I can't tell you that — diagnosing anything needs tests and an examination I can't do. ${REFER} ` +
    "What I can do is show you exactly what you've logged, if that's useful to bring along.",
  medication:
    "I don't advise on medication — not dosage, not timing, not stopping or starting. " +
    "That's strictly between you and your prescriber or pharmacist. " +
    "Tell me any restrictions they give you and I'll fit your plan around them.",
  mental_health:
    "I'm glad you told me, and I want to be honest: this is beyond what I can help with, and you deserve real support. " +
    "Please reach out to a crisis line or a mental-health professional right now — if you're in immediate danger, contact emergency services. " +
    "You don't have to handle this by yourself.",
  disordered_eating:
    "I'm not going to help with that, and I want to say why rather than just refuse: what you're describing " +
    "hurts you, and it isn't something coaching should be steering. Please consider talking to a doctor or " +
    "a therapist who works with eating — that's a real, treatable thing and reaching out is not an overreaction. " +
    "I'm still here for the training side whenever you want it.",
};

// ── Goal weights and loss rates: judged by the number, not the sentence ──
//
// Both used to be regex branches here — `get (down )?to \d{2} ?kg` and
// `lose \d+kg in <n> <weeks|months>` — and both fired on the ordinary business
// of a weight-loss app. "I want to get down to 75kg by Christmas", "my goal is
// to get to 68 kg" and "lose 10 kg in 3 months" each got the eating-disorder
// script and a therapist referral before the model ever saw them. The signal
// was never the SHAPE of the sentence. It is the number: a target body weight
// nobody can safely be at, or a pace nobody should try to lose at. So the
// numbers are read out and measured.

/** Below this BMI, a TARGET is itself the red flag (ICD-10's anorexia line). */
const UNSAFE_TARGET_BMI = 17.5;

/**
 * With no height to judge by, a floor few adults can safely be under. Errs
 * toward catching: at 150cm, 45kg is still a healthy BMI of 20, so a very short
 * user with no height on file can be deflected — the cheaper of the two
 * mistakes. Onboarding records height, so this is the rare path.
 */
const UNSAFE_TARGET_KG_NO_HEIGHT = 45;

/**
 * Faster than this is crash-diet territory. Sustained guidance is 0.5–1 kg a
 * week. Between 1 and 1.5 the MODEL answers, under a system prompt that forbids
 * encouraging restriction — for a pace that is merely ambitious, "that's too
 * fast, here's a pace that holds" beats a canned referral.
 */
const UNSAFE_LOSS_KG_PER_WEEK = 1.5;

const KG_PER_UNIT: Record<string, number> = {
  kg: 1, kgs: 1, kilo: 1, kilos: 1, kilogram: 1, kilograms: 1,
  lb: 0.4536, lbs: 0.4536, pound: 0.4536, pounds: 0.4536,
  st: 6.35, stone: 6.35, stones: 6.35,
};
const WEEKS_PER_UNIT: Record<string, number> = {
  day: 1 / 7, days: 1 / 7, week: 1, weeks: 1, month: 4.345, months: 4.345,
};
const COUNT_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

const WEIGHT_UNIT = String.raw`(kgs?|kilos?|kilograms?|lbs?|pounds?|stones?|st)`;

/** "get down to 40kg", "reach 90 lbs", "want to be 7 stone", "goal weight is 50kg". */
const TARGET_WEIGHT = new RegExp(
  String.raw`\b(?:(?:get|go|drop|come|slim|cut)(?: back)?(?: down)? to|reach|weigh|(?:want|wanna|like|need|hope|trying) to be(?: at)?|goal(?: weight)?(?: is| of)?|target(?: weight)?(?: is| of)?)\s*(?:around |about |under |below )?(\d{1,3}(?:\.\d+)?)\s*${WEIGHT_UNIT}\b`,
  "gi",
);

/** "lose 20kg in a month", "drop 15 pounds in 10 days". */
const LOSS_RATE = new RegExp(
  String.raw`\b(?:los(?:e|ing)|drop(?:ping)?|shed(?:ding)?|cut(?:ting)?)\s+(?:about |around |like |over )?(\d{1,3}(?:\.\d+)?)\s*${WEIGHT_UNIT}\s+(?:in|within)\s+(?:the next |just |only )?(\d{1,2}|${Object.keys(COUNT_WORDS).join("|")})\s+(days?|weeks?|months?)\b`,
  "gi",
);

/**
 * A lift is not a body weight. "Get to 40kg on bench" is a strength goal, and
 * the old pattern refused it as an eating disorder too. When the message is
 * about lifting and says nothing about the scale, a kg figure is the bar's.
 */
const LIFT_TALK =
  /\b(bench|squat|deadlift|press|row|curls?|lift(ing)?|pull-?ups?|clean|snatch|dumbbells?|barbell|kettlebells?|plates?|1rm|pr)\b/i;
const BODY_TALK = /\b(weigh|body ?weight|my weight|scale|lose|losing|slim|diet)\b/i;

function unitKg(unit: string): number {
  return KG_PER_UNIT[unit.toLowerCase()] ?? 1;
}

/** Height the message itself states — "im 170cm", "1.65m", "5'6", "5 ft 4". */
function statedHeightCm(text: string): number | null {
  const cm = /\b(1[2-9]\d|2[0-2]\d)\s?cm\b/i.exec(text);
  if (cm) return Number(cm[1]);
  const m = /\b([12]\.\d{1,2})\s?m\b/i.exec(text);
  if (m) return Number(m[1]) * 100;
  const ft = /\b([4-7])\s?(?:'|’|ft|foot|feet)\s?(?:(\d{1,2})\s?(?:"|”|''|in(?:ches)?)?)?/i.exec(text);
  if (ft) return (Number(ft[1]) * 12 + (ft[2] ? Number(ft[2]) : 0)) * 2.54;
  return null;
}

function plausibleHeight(cm: number | null | undefined): number | null {
  return cm != null && Number.isFinite(cm) && cm >= 120 && cm <= 230 ? cm : null;
}

/** A stated target body weight that is unsafe for THIS person's height. */
function unsafeTargetWeight(text: string, heightCm: number | null): boolean {
  if (LIFT_TALK.test(text) && !BODY_TALK.test(text)) return false;
  for (const m of text.matchAll(TARGET_WEIGHT)) {
    const kg = Number(m[1]) * unitKg(m[2]);
    // "Get to 5kg dumbbells" — a figure no adult body weighs.
    if (!Number.isFinite(kg) || kg < 20) continue;
    if (heightCm != null) {
      const bmi = kg / (heightCm / 100) ** 2;
      if (bmi < UNSAFE_TARGET_BMI) return true;
    } else if (kg < UNSAFE_TARGET_KG_NO_HEIGHT) {
      return true;
    }
  }
  return false;
}

// ── Vomiting and missed meals: judged by what surrounds them ──
//
// "threw up" and "skipping meals" were bare phrases in the pattern above, and
// both deflected ordinary questions with the eating-disorder script: "I threw
// up after that HIIT class, was it too hard?" is about intensity, and "I'm
// skipping meals at work because I'm too busy" is about logistics. The signal
// is what the words are FOR — food framed as a debt, eating avoided on purpose
// — so that is what these read.

/** Food as something owed or punished — the part that makes it disordered. */
const FOOD_DEBT =
  /\b(overate|over-?eat(ing)?|binge[ds]?|bingeing|binging|ate too much|too much food|make up for|cancel (it )?out|lose weight|to lose|burn (it|that|off)|deficit|punish|on purpose|guilt(y)?|disgust(ed|ing)?)\b/i;

/** Being sick FROM effort: "after that HIIT class", "during my run". */
const AFTER_EXERTION =
  /^\s*(?:right\s+|straight\s+)?(?:after|during|at|in|mid|from)\s+(?:(?:my|the|that|a|this|today'?s|last night'?s)\s+)?(?:\w+\s+){0,2}?(?:hiit|workout|session|run|running|race|training|class|gym|sprints?|intervals?|practice|game|match|spin|crossfit|circuit|lifting|leg day|cardio|swim|ride)\b/i;

function purgeSignal(text: string): boolean {
  for (const m of text.matchAll(/\b(threw up|throwing up)\b/gi)) {
    const after = text.slice((m.index ?? 0) + m[0].length);
    if (AFTER_EXERTION.test(after) && !FOOD_DEBT.test(text)) continue;
    return true;
  }
  return false;
}

const SKIPPED_EATING =
  /\b(skip(ping|ped)?\s+(eating|meals|food)|not eat(ing)?\s+(for|at all|today|anything))\b/i;

/** A reason that is circumstance, not restriction — time, work, travel, faith. */
const CIRCUMSTANCE =
  /\b(busy|no time|(don'?t|didn'?t) have time|forg[eo]t|work(ing)? (late|through)|shifts?|meetings?|rush(ed)?|travel(l?ing)?|commut\w*|until (my |the )?(lunch|dinner|breakfast|noon|midday|\d{1,2}(:\d{2})?\s*(am|pm)?)|ramadan|lent|appetite)\b/i;

/**
 * Not eating is flagged when it comes with food-as-debt language, or with no
 * reason at all — the conservative default stays. A stated circumstance with
 * nothing compensatory in it goes to the coach, who can actually help with it.
 */
function restrictionSignal(text: string): boolean {
  if (!SKIPPED_EATING.test(text)) return false;
  if (FOOD_DEBT.test(text)) return true;
  return !CIRCUMSTANCE.test(text);
}

// ── Milligrams: judged by what they are OF ──
//
// `\d+ ?mg`, `mg of` and `dosage` sat in MEDICATION bare, so "is 200 mg of
// caffeine before a run too much?" and "this soup has 900mg sodium" got the
// prescriber script. A milligram is a unit, not a drug: what makes it a dosing
// question is the thing being measured. So the figure's object is read, and
// only coffee and the nutrients printed on a food label are let through.
// Everything else — an unknown name, a vitamin, creatine — stays deflected,
// because an unrecognised word next to "mg" is more often a drug than a food.

/** What a food label or a coffee is measured in. Deliberately short. */
const FOOD_NUTRIENT = String.raw`(?:caffeine|coffee|espresso|tea|energy drinks?|pre-?workout|sodium|salt|cholesterol|potassium|calcium|magnesium|iron|zinc)\b`;
const NUTRIENT_AFTER = new RegExp(String.raw`^(?:\w+\s+)?${FOOD_NUTRIENT}`, "i");
const NUTRIENT_BEFORE = new RegExp(String.raw`${FOOD_NUTRIENT}\W{0,3}(?:\w+\W{1,3}){0,2}$`, "i");

/**
 * A mineral is food-label talk in "spinach has 3 mg of iron" and supplement
 * dosing in "should I take 65 mg of iron". The verb is the difference.
 */
const MINERAL = /\b(potassium|calcium|magnesium|iron|zinc)\b/i;
const SUPPLEMENTING = /\b(take|taking|took|supplement\w*)\b/i;

const DOSE_FIGURE = /\b(?:\d+(?:\.\d+)?\s?(?:mg|milligrams?)|(?:mg|milligrams?)(?= of\b)|dosage)\b/gi;

/**
 * Anything pharmaceutical anywhere in the message decides it — "200mg caffeine
 * pills" and "coffee, then 50mg of sertraline" are both dosing questions.
 */
const PHARMA =
  /\b(pills?|tablets?|capsules?|meds?|medications?|medicines?|prescri\w*|drugs?|ibuprofen|paracetamol|acetaminophen|aspirin|naproxen|melatonin|metformin|insulin|statins?|steroids?|antibiotics?|antidepressants?|ssris?|lithium|levothyroxine|thyroxine)\b/i;

function medicationDose(text: string): boolean {
  const pharma = PHARMA.test(text) || (MINERAL.test(text) && SUPPLEMENTING.test(text));
  for (const m of text.matchAll(DOSE_FIGURE)) {
    if (pharma) return true;
    const start = m.index ?? 0;
    const after = text.slice(start + m[0].length);
    const before = text.slice(Math.max(0, start - 40), start);
    // "mg of X" names its object outright; X decides, not whatever came
    // earlier in the sentence.
    const of = /^\s*of\s+/i.exec(after);
    const isNutrient = of
      ? NUTRIENT_AFTER.test(after.slice(of[0].length))
      : NUTRIENT_AFTER.test(after.trimStart()) || NUTRIENT_BEFORE.test(before);
    if (!isNutrient) return true;
  }
  return false;
}

/** A stated loss pace faster than anyone should attempt. */
function unsafeLossRate(text: string): boolean {
  for (const m of text.matchAll(LOSS_RATE)) {
    const kg = Number(m[1]) * unitKg(m[2]);
    const count = /^\d+$/.test(m[3]) ? Number(m[3]) : COUNT_WORDS[m[3].toLowerCase()];
    const weeks = count * (WEEKS_PER_UNIT[m[4].toLowerCase()] ?? 1);
    if (!Number.isFinite(kg) || !weeks) continue;
    if (kg / weeks > UNSAFE_LOSS_KG_PER_WEEK) return true;
  }
  return false;
}

/**
 * Screen a user message before any model call.
 *
 * Ordered by severity: an emergency phrase wins even if the message also looks
 * like an ordinary question.
 *
 * `bio` supplies the height a stated goal weight is judged against. A height
 * written in the message itself wins — it is what the person is asking about.
 */
export function screenForClinicalRisk(
  text: string,
  bio?: Pick<UserBio, "heightCm"> | null,
): ClinicalRisk | null {
  const t = text.trim();
  if (!t) return null;
  const heightCm = plausibleHeight(statedHeightCm(t)) ?? plausibleHeight(bio?.heightCm);

  // Broad on purpose. A false positive here costs one deflected coaching
  // question; a false negative costs something we cannot take back. Inflections
  // matter — people write "ending my life", not the dictionary form.
  if (
    /\b(suicidal|suicide|kill(ing)? myself|end(ing)? (my|it|thing|things|this) ?(life|all)?|want(ing)? to die|do(n'?t| not) want to (be here|wake up|exist|go on)|no (point|reason) (in |to )?(living|keeping going|keep going|carry on|carrying on|going on)|do(n'?t| not) see a (point|reason) to (keep|carry) (going|on)|better off without me|everyone would be better off|self[- ]harm|hurt(ing)? myself|cut(ting)? myself|can'?t (do this|go on) any ?more|tired of (living|being alive))\b/i.test(
      t,
    )
  ) {
    return { kind: "mental_health", reply: REPLIES.mental_health };
  }
  if (EMERGENCY.test(t)) return { kind: "emergency", reply: REPLIES.emergency };
  if (
    DISORDERED_EATING.test(t) ||
    purgeSignal(t) ||
    restrictionSignal(t) ||
    unsafeTargetWeight(t, heightCm) ||
    unsafeLossRate(t)
  ) {
    return { kind: "disordered_eating", reply: REPLIES.disordered_eating };
  }
  if (MEDICATION.test(t) || medicationDose(t)) {
    return { kind: "medication", reply: REPLIES.medication };
  }
  if (DIAGNOSIS.test(t)) return { kind: "diagnosis", reply: REPLIES.diagnosis };
  if (SYMPTOM.test(t)) return { kind: "symptom", reply: REPLIES.symptom };
  return null;
}

// ════════════════════════════════════════════════════════════════
// 2. Per-condition constraints
// ════════════════════════════════════════════════════════════════

/**
 * Hard rules per condition. Phrased as instructions the model cannot satisfy
 * by hedging — "never suggest increasing protein" leaves no room to be helpful
 * in the wrong direction.
 */
const CONDITION_RULES: Partial<Record<MedicalCondition, string>> = {
  renal_issues:
    "Renal impairment: NEVER suggest increasing protein, protein supplements, or a high-protein diet. " +
    "Do not advise on potassium, phosphorus, sodium or fluid targets. Defer every protein and " +
    "electrolyte question to their nephrologist or renal dietitian.",
  diabetes_type1:
    "Type 1 diabetes: never advise on insulin, carb-to-insulin ratios, or fasting. Do not suggest " +
    "skipping meals or training on an empty stomach. Defer all glycaemic management to their care team.",
  diabetes_type2:
    "Type 2 diabetes: do not advise on medication timing or fasting protocols. Keep nutrition advice " +
    "to what their plan already sets; defer glycaemic targets to their clinician.",
  pregnancy:
    "Pregnant: never suggest a calorie deficit, weight loss, fasting, or intensity progression. " +
    "Do not advise on supplements or on how much caffeine is safe. Frame all training around comfort and continuation, not performance, " +
    "and defer anything obstetric to their midwife or doctor.",
  postpartum:
    "Postpartum: do not push weight-loss framing or intensity progression. Defer return-to-exercise " +
    "clearance and anything about recovery timelines to their doctor.",
  gerd: "GERD: avoid suggesting large pre-training meals or lying-down protocols soon after eating.",
  celiac:
    "Coeliac disease: never suggest any food containing gluten, wheat, barley or rye — this is not a preference.",
  ibd: "IBD: do not suggest high-fibre pushes or elimination protocols; defer flare management to their clinician.",
  pancreatitis:
    "Pancreatitis history: never suggest high-fat meals or alcohol; defer all dietary fat targets to their clinician.",
  gallbladder:
    "Gallbladder condition: avoid suggesting high-fat meals; defer dietary fat targets to their clinician.",
  gout: "Gout: do not suggest increasing purine-rich foods (organ meat, anchovies, heavy red meat) or protein loading.",
  hypothyroidism:
    "Hypothyroidism: do not attribute weight changes to metabolism or advise on iodine/supplements — defer to their clinician.",
  hyperthyroidism:
    "Hyperthyroidism: do not advise on stimulants or aggressive deficits; defer to their clinician.",
  osteoporosis:
    "Osteoporosis: never suggest high-impact plyometrics, heavy spinal loading, or deep spinal flexion.",
  arthritis: "Arthritis: keep training advice low-impact and joint-sparing; do not push through joint pain.",
  anemia: "Anaemia: do not advise on iron supplementation or dosage — defer to their clinician.",
  hypertension:
    "Hypertension: do not advise on sodium targets, caffeine limits, or breath-holding/Valsalva under load; defer to their clinician.",
};

const MEDICATION_RULES: Record<string, string> = {
  blood_thinners:
    "On blood thinners: never suggest changing vitamin-K/leafy-green intake, and avoid contact or fall-risk activities.",
  diabetes:
    "On diabetes medication: do not suggest fasting, skipping meals, or fasted training.",
  corticosteroids:
    "On corticosteroids: do not advise on sodium or bone-loading changes; defer to their clinician.",
  diuretics:
    "On diuretics: do not set or adjust fluid or electrolyte targets; defer to their clinician.",
  blood_pressure:
    "On blood-pressure medication: do not advise on sodium; flag dizziness on standing as a clinician question.",
  thyroid:
    "On thyroid medication: do not advise on timing relative to food or supplements; defer to their prescriber.",
};

/**
 * Build this user's hard constraints. Returns [] for an unremarkable profile,
 * which keeps the volatile block small for most users.
 */
export function conditionRules(bio: UserBio | null): string[] {
  if (!bio) return [];
  const rules: string[] = [];

  for (const c of bio.medicalConditions ?? []) {
    const rule = CONDITION_RULES[c];
    if (rule) rules.push(rule);
  }

  if (bio.medicalConditions?.includes("pregnancy") && bio.pregnancyTrimester) {
    rules.push(`Currently in trimester ${bio.pregnancyTrimester}.`);
  }

  for (const m of bio.medicationCategories ?? []) {
    const rule = MEDICATION_RULES[m];
    if (rule) rules.push(rule);
  }

  if ((bio.medications?.length ?? 0) > 0) {
    rules.push(
      "This user takes prescription medication. Never comment on their medication, " +
        "its effects, or anything that could interact with it.",
    );
  }

  const allergies = (bio.allergies ?? []).filter(Boolean);
  if (allergies.length > 0) {
    rules.push(
      `Allergies — never suggest any food containing: ${allergies.join(", ")}. Treat this as absolute.`,
    );
  }

  const injuries = (bio.injuries ?? []).filter(Boolean);
  if (injuries.length > 0) {
    rules.push(
      `Current injuries (${injuries.join(", ")}): never suggest loading these areas, and do not ` +
        "assess or advise on the injury itself.",
    );
  }

  return rules;
}
