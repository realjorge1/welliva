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

/** Medication / supplement-as-treatment. */
const MEDICATION =
  /\b(dosage|how much (should i take|of my)|\d+ ?mg\b|mg of\b|(should|can|is it (ok|fine|safe)) (i |to )?(take|stop|start|skip|double|halve|come off|quit) (my |taking |taking my )?(meds?|medication|medicine|pill|insulin|metformin|statin|steroid|antibiotic|thyroid|blood thinner|antidepressants?|ssri|lithium|beta blocker|ozempic|semaglutide|wegovy)|(with|alongside|while (on|taking)) my (meds?|medication|medicine|insulin|lithium|statin|thyroid|antidepressants?|blood thinner|prescription)|(interact|interfere|mess) (with|up) (my )?(meds?|medication|thyroid|insulin|prescription)|drug interactions?|instead of my (meds?|medication)|(take|start|get|try) (ozempic|wegovy|semaglutide|mounjaro|tirzepatide))\b/i;

/** Disordered-eating signals. Coach the person, never the behaviour. */
const DISORDERED_EATING =
  /\b(purg(e|ing|ed)|make myself (throw up|sick|vomit)|threw up|throwing up|made myself sick|laxatives?|diet pills?|appetite suppressant|starv(e|ing) myself|not eat(ing)? (for|at all|today|anything)|skip(ping)? (eating|meals|food)|([0-9]|10)\d{2} calories? (a|per) day|(under|below|only) \d{3} calories|get (down )?to \d{2} ?kg|lose \d{2,3} ?(kg|kgs|lbs|pounds|kilos) (in|within) (a|one|\d+) (week|month|weeks|months)|fast(ing)? for \d+ ?(days?|weeks?)|water fast(ing)?|(burn|work) off (what|everything|all) i ate|cancel out (a|the|my|that) (binge|meal|eating)|compensate for (eating|the binge|overeating)|punish myself for eating|hate my body|disgusted (with|by) myself)\b/i;

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

/**
 * Screen a user message before any model call.
 *
 * Ordered by severity: an emergency phrase wins even if the message also looks
 * like an ordinary question.
 */
export function screenForClinicalRisk(text: string): ClinicalRisk | null {
  const t = text.trim();
  if (!t) return null;

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
  if (DISORDERED_EATING.test(t)) {
    return { kind: "disordered_eating", reply: REPLIES.disordered_eating };
  }
  if (MEDICATION.test(t)) return { kind: "medication", reply: REPLIES.medication };
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
    "Do not advise on supplements. Frame all training around comfort and continuation, not performance, " +
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
    "Hypertension: do not advise on sodium targets or breath-holding/Valsalva under load; defer to their clinician.",
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
