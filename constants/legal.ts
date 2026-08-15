/**
 * LEGAL — the single source of truth for everything the user has to agree to.
 *
 * Three documents live here as DATA, not as screens:
 *   privacy     what we collect, where it goes, how to get rid of it
 *   terms       the agreement to use the app (incl. the store-required clauses)
 *   disclaimer  the medical disclaimer — the one this app most needs, because it
 *               computes calorie, protein and sodium targets for people who are
 *               pregnant, diabetic or living with kidney disease
 *
 * Keeping them as structured data (not JSX, not markdown files) means:
 *   • one renderer draws all three, so they can never drift apart visually
 *   • the consent gate quotes the SAME text the full document shows
 *   • the summary bullets on the gate can't fall out of sync with the policy
 *   • the copy is greppable and diffable in review
 *
 * VERSIONING. `LEGAL_VERSION` is the contract. Bump it whenever the substance of
 * any document changes (not for typos) — every user is then asked to re-accept
 * on next launch, because their stored acceptance records the version they saw.
 * See services/legal/LegalAcceptance.ts.
 *
 * ⚠️ BEFORE STORE SUBMISSION: fill in the four `TODO(legal)` constants below and
 * host the same text at PRIVACY_POLICY_URL / TERMS_URL — both stores require a
 * publicly reachable policy URL on the listing itself, not only in-app.
 * See docs/legal/store-submission.md.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Identity & versioning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TODO(legal): replace with the operating entity's registered name, address and
 * governing jurisdiction. These strings are interpolated verbatim into the
 * documents below, so a placeholder left here ships as a placeholder.
 */
export const LEGAL_ENTITY = "Welliva";
export const LEGAL_CONTACT_EMAIL = "privacy@welliva.app";
export const LEGAL_POSTAL_ADDRESS = "[registered business address — to be completed]";
export const LEGAL_JURISDICTION = "[governing jurisdiction — to be completed]";

/** Public mirrors of these documents. Required on both store listings. */
export const PRIVACY_POLICY_URL = "https://welliva.app/legal/privacy";
export const TERMS_URL = "https://welliva.app/legal/terms";

/** Bump on any material change → every user re-accepts. */
export const LEGAL_VERSION = 1;

/** Shown in each document header. Update alongside LEGAL_VERSION. */
export const LEGAL_LAST_UPDATED = "26 July 2026";

/** Minimum age to hold an account (the onboarding age field enforces it too). */
export const MINIMUM_AGE = 13;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LegalDocId = "privacy" | "terms" | "disclaimer";

export interface LegalSection {
  heading: string;
  /** Paragraphs, rendered in order. */
  body?: string[];
  /** Bulleted lines, rendered after the paragraphs. */
  bullets?: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  /** One line — used on link rows and under the document title. */
  summary: string;
  /** Ionicons name for link rows and the document header badge. */
  icon: string;
  sections: LegalSection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Short disclaimers — the inline reminders used across the app
// ─────────────────────────────────────────────────────────────────────────────

/** The one-liner shown wherever Welliva hands out a number or a plan. */
export const SHORT_MEDICAL_DISCLAIMER =
  "Welliva offers general wellness guidance, not medical advice. Talk to a qualified clinician before acting on it — especially during pregnancy or with a health condition.";

/** Compact variant for tight surfaces (chat, card footers). */
export const INLINE_MEDICAL_DISCLAIMER =
  "Not medical advice — check with your clinician.";

/** Shown under the Gozlin composer. AI-specific, since the coach is generative. */
export const COACH_DISCLAIMER =
  "Gozlin is an AI coach, not a doctor. It can be wrong — never use it for diagnosis, medication or emergencies.";

// ─────────────────────────────────────────────────────────────────────────────
// Privacy Policy
// ─────────────────────────────────────────────────────────────────────────────

const PRIVACY: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  summary: "What Welliva collects, where it lives, and how to erase it.",
  icon: "lock-closed",
  sections: [
    {
      heading: "The short version",
      body: [
        `${LEGAL_ENTITY} is a personal health and fitness app. To build your plan it needs health information about you — including sensitive information such as pregnancy status, medical conditions, medications and injuries.`,
        "Welliva is built device-first: your detailed history (meals, workouts, check-ins, the coach's memory) is stored on your phone. What leaves the device is limited to what is needed to sign you in, to keep your account in sync across your devices, and — only if you switch it on — a short, minimised summary sent to the AI coach.",
        "We do not sell your data, we do not run advertising, and we never share your health information with employers, insurers or data brokers.",
      ],
    },
    {
      heading: "Who we are",
      body: [
        `This app is operated by ${LEGAL_ENTITY} ("we", "us"). For privacy questions, or to exercise any right described below, contact ${LEGAL_CONTACT_EMAIL}. Postal: ${LEGAL_POSTAL_ADDRESS}.`,
        "Where data-protection law applies to you (for example the UK/EU GDPR, or comparable national law), we act as the controller of the personal data described here.",
      ],
    },
    {
      heading: "What we collect",
      body: [
        "Account details. Your email address and an authentication credential when you sign up. If you sign in with Google, we receive your name, email address and profile picture from that provider — not your password.",
        "Health and profile information you enter. This is the core of the app and you choose what to give us:",
      ],
      bullets: [
        "Body and lifestyle: age, biological sex, height, weight, daily activity level, training experience, available equipment, goals and region",
        "Food: dietary style, cuisine preference, meals per day, allergies and foods you dislike",
        "Health context: medical conditions (including pregnancy and trimester, diabetes, kidney, liver, thyroid, digestive and hormonal conditions), injuries or pain areas, and medications or medication categories",
        "Your logs: meals and foods eaten, water, workouts and sessions completed, body measurements and weigh-ins, habits, streaks, and mood/energy/sleep check-ins",
        "Photos, if you add them: a profile picture, progress photos, and meal photos you ask the coach to analyse",
        "Messages you send to the AI coach",
      ],
    },
    {
      heading: "Device signals — off unless you turn them on",
      body: [
        "Welliva can read a small number of device signals to make coaching fit your real life. Every one of them is OFF by default and each has its own switch under More → Privacy. Turning one off stops the reads immediately.",
      ],
      bullets: [
        "Calendar: read-only, to spot travel and big days so the plan can bend around them",
        "Location: coarse location only (rounded to roughly 1 km) and used solely to fetch the local forecast",
        "Wearable and health metrics: sleep, heart-rate variability and steps, to make recovery real rather than estimated",
        "Health records: medications and conditions from your phone's health store",
        "Meal photos and voice: analysed to draft a log you confirm — nothing is saved without your okay",
        "Notifications: reminders and briefings, within your quiet hours and daily limit",
      ],
    },
    {
      heading: "Why we use it (and our legal basis)",
      bullets: [
        "To create your nutrition targets, meal plan and training plan — this is the service you asked for (performance of a contract)",
        "To keep you safe: allergies, conditions, injuries and medications are used to filter foods and exercises out of your plan",
        "To sync your account across your devices and restore it if you change phone",
        "To send reminders you have enabled",
        "To keep the service secure and to diagnose faults",
      ],
      body: [
        "Health data is a special category of personal data. Where the law requires it, we rely on your explicit consent — given at sign-up and revocable at any time — to process it. Withdrawing consent means we can no longer personalise your plan; you can delete your account at the same time.",
      ],
    },
    {
      heading: "Where your data lives",
      body: [
        "On your device. Your timeline, logs, summaries and the coach's memory are stored locally on your phone.",
        "In your private cloud account. So your account survives a lost phone, your profile and logs are synced to our hosted database (Supabase). Rows are protected by per-user row-level security: your account can only read and write its own data. Photos and voice notes go to private storage buckets scoped to your user id, and are served through short-lived signed links — never public URLs.",
        "With the AI coach, only if enabled. When you use Gozlin's cloud features, a minimised summary of the relevant context — not your full history — is sent over an encrypted connection to our backend, which uses Anthropic's Claude models to generate the reply. It is used to answer you, and not to train third-party models.",
        "Weather. If you enable weather, coarse coordinates are sent to Open-Meteo to fetch a forecast. No account identifier is attached.",
      ],
    },
    {
      heading: "Who we share it with",
      body: [
        "We do not sell personal data and we do not share it for advertising. We use a small number of processors who act on our instructions:",
      ],
      bullets: [
        "Supabase — authentication, database and file storage",
        "Anthropic — AI model inference for the coach and plan generation, called through our own backend",
        "Google — only if you choose to sign in with Google",
        "Open-Meteo — weather lookup, if you enable it",
      ],
    },
    {
      heading: "International transfers",
      body: [
        "Our processors may store or process data outside your country. Where required, transfers are covered by appropriate safeguards such as standard contractual clauses. Contact us if you would like details of the safeguards in place.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "On-device data stays until you delete it — Settings → Reset data erases every local record, and Gozlin's \"Forget everything\" clears its memory and chat history.",
        "Cloud data is kept while your account exists. When you delete your account we remove your profile, logs and files; backup copies age out within 30 days.",
        "Deletions are recorded so they propagate to your other devices rather than reappearing on the next sync.",
      ],
    },
    {
      heading: "Your rights",
      bullets: [
        "Access a copy of what we hold about you",
        "Correct anything wrong — most of it is editable in Settings",
        "Delete your data, or your whole account",
        "Withdraw a consent you gave, at any time, under More → Privacy",
        "Object to or restrict certain processing",
        "Complain to your local data-protection authority",
      ],
      body: [
        `Write to ${LEGAL_CONTACT_EMAIL} and we will respond within 30 days. We never charge for a request, and never require a reason.`,
      ],
    },
    {
      heading: "Security",
      body: [
        "Traffic is encrypted in transit (TLS). Sign-in tokens are held in the device's secure keystore. Cloud rows and files are isolated per user by row-level security, and file links expire. No system is perfect: if a breach ever affects your data, we will tell you and the relevant regulator as the law requires.",
      ],
    },
    {
      heading: "Children",
      body: [
        `Welliva is not for children under ${MINIMUM_AGE}, and accounts cannot be created below that age. Where local law sets a higher age for consenting to data processing (16 in parts of Europe), a parent or guardian must consent on the user's behalf. If you believe a child has given us data, contact ${LEGAL_CONTACT_EMAIL} and we will delete it.`,
      ],
    },
    {
      heading: "Analytics and tracking",
      body: [
        "Welliva contains no advertising SDKs, no third-party analytics and no cross-app tracking. We do not use your data to build advertising profiles, and we do not ask for the advertising identifier.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If we change this policy materially we will ask you to review and accept the new version inside the app before you continue. The version and date at the top of this document tell you which one you accepted.",
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Terms of Use
// ─────────────────────────────────────────────────────────────────────────────

const TERMS: LegalDoc = {
  id: "terms",
  title: "Terms of Use",
  summary: "The agreement between you and Welliva for using the app.",
  icon: "document-text",
  sections: [
    {
      heading: "Agreement",
      body: [
        `These Terms are a contract between you and ${LEGAL_ENTITY} covering your use of the Welliva app. By accepting them — or by continuing to use the app — you agree to them. If you do not agree, do not use Welliva.`,
        "The Privacy Policy and the Medical Disclaimer form part of these Terms.",
      ],
    },
    {
      heading: "Who may use Welliva",
      body: [
        `You must be at least ${MINIMUM_AGE} years old and able to enter a binding agreement. If you are under the age of digital consent where you live, a parent or guardian must agree on your behalf.`,
        "You are responsible for your account and for keeping your sign-in details secure. Tell us promptly if you believe someone else has access to it.",
      ],
    },
    {
      heading: "What Welliva is — and is not",
      body: [
        "Welliva is a general wellness and fitness product. It generates suggested calorie and macronutrient targets, meal plans, workouts and coaching messages from the information you give it.",
        "Welliva is not a medical device. It does not diagnose, treat, cure or prevent any disease, and it is not a substitute for professional medical, nutritional or psychological care. Read the Medical Disclaimer — it is short and it matters.",
      ],
    },
    {
      heading: "Your responsibilities",
      bullets: [
        "Give accurate information. Plans are computed from what you enter — a wrong weight, a missing allergy or an unlisted condition produces a wrong plan",
        "Keep your health details up to date, particularly a new pregnancy, diagnosis, medication or injury",
        "Get clearance from a clinician before starting a new diet or exercise programme if you are pregnant or postpartum, managing a chronic condition, taking prescription medication, recovering from injury or surgery, or over 65",
        "Check food labels yourself. Our allergen filtering is a help, not a guarantee",
        "Stop and seek help if you feel unwell",
      ],
    },
    {
      heading: "The AI coach",
      body: [
        "Gozlin generates its replies with an AI model. AI output can be incomplete, out of date or plainly wrong, and it does not know anything about you beyond what the app has stored. Treat it as a knowledgeable friend, not a clinician: never rely on it for diagnosis, medication decisions, or anything urgent.",
        "The app deliberately refuses some requests — symptoms, diagnoses, medication and crisis topics are referred to a professional rather than answered. Do not attempt to work around those refusals.",
      ],
    },
    {
      heading: "Acceptable use",
      bullets: [
        "Do not use Welliva to support disordered eating or extreme restriction",
        "Do not use it to give health advice to other people",
        "Do not attempt to break, probe, overload or reverse-engineer the service, or to access another user's data",
        "Do not upload content you have no right to upload, or anything unlawful",
        "Do not resell, scrape or redistribute the app's content, plans or databases",
      ],
    },
    {
      heading: "Your content",
      body: [
        "Your logs, photos and messages remain yours. You grant us only the limited licence needed to store, process and display them back to you — including sending a minimised summary to our AI provider when you use cloud coaching. We do not use your content for advertising, and we do not sell it.",
      ],
    },
    {
      heading: "Availability and changes",
      body: [
        "We may update, change or discontinue features. We aim to keep the app working offline, but cloud features (sync, AI coaching) depend on connectivity and third-party services and may be unavailable at times.",
        "If we change these Terms materially, you will be asked to accept the new version in-app.",
      ],
    },
    {
      heading: "Price",
      body: [
        "Welliva is currently offered without charge. If paid features are introduced, the price and terms will be shown to you before you buy, and purchases will be handled by the app store you installed from, under its own refund rules.",
      ],
    },
    {
      heading: "Ending your use",
      body: [
        "You can stop using Welliva at any time and delete your account and data from Settings. We may suspend or end an account that breaks these Terms or puts other users or the service at risk.",
      ],
    },
    {
      heading: "Disclaimer of warranties",
      body: [
        "To the fullest extent permitted by law, Welliva is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including fitness for a particular purpose and the accuracy of any plan, target or coaching output.",
      ],
    },
    {
      heading: "Limitation of liability",
      body: [
        `To the fullest extent permitted by law, ${LEGAL_ENTITY} is not liable for indirect, incidental, special or consequential losses, or for any loss arising from your reliance on the app's guidance where you have not obtained professional advice. Nothing in these Terms excludes liability that cannot lawfully be excluded — including liability for death or personal injury caused by negligence, or for fraud.`,
        "Some jurisdictions do not allow certain exclusions, so parts of this section may not apply to you.",
      ],
    },
    {
      heading: "Apple App Store terms",
      body: [
        "If you obtained Welliva from the Apple App Store, the following apply: this agreement is between you and us only, not with Apple; Apple has no obligation to provide maintenance or support; Apple is not responsible for any claim relating to the app, including product liability, legal-compliance or intellectual-property claims; and Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them against you.",
      ],
    },
    {
      heading: "Governing law",
      body: [
        `These Terms are governed by the laws of ${LEGAL_JURISDICTION}, without regard to conflict-of-law rules. Mandatory consumer protections in your country of residence still apply to you.`,
      ],
    },
    {
      heading: "Contact",
      body: [`Questions about these Terms: ${LEGAL_CONTACT_EMAIL}.`],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Medical Disclaimer
// ─────────────────────────────────────────────────────────────────────────────

const DISCLAIMER: LegalDoc = {
  id: "disclaimer",
  title: "Medical Disclaimer",
  summary: "Welliva is a wellness app, not a clinician. Where the line sits.",
  icon: "medkit",
  sections: [
    {
      heading: "Not medical advice",
      body: [
        "Welliva provides general information about food, movement and habits for healthy adults. Nothing in the app — no calorie target, macro split, meal plan, workout, insight or message from the AI coach — is medical advice, a diagnosis, a treatment plan or a prescription.",
        "Using Welliva does not create a doctor–patient, dietitian–client or therapist–client relationship. The app's plans are generated by software from the details you type in; no clinician reviews them.",
      ],
    },
    {
      heading: "Talk to a professional first",
      body: [
        "Please get clearance from a qualified healthcare professional before starting or changing a diet or exercise programme, and follow their instructions over the app's if the two ever disagree. This matters especially if any of the following apply to you:",
      ],
      bullets: [
        "You are pregnant, trying to conceive, postpartum or breastfeeding",
        "You have diabetes, kidney, liver, heart, thyroid, digestive or autoimmune disease",
        "You take prescription medication of any kind",
        "You have high or low blood pressure, or a history of cardiac events",
        "You are recovering from injury, surgery or illness",
        "You have or have had an eating disorder or a disordered relationship with food",
        "You are under 18 or over 65",
      ],
    },
    {
      heading: "About the numbers Welliva shows you",
      body: [
        "Calorie, macronutrient, hydration and sodium targets are estimates produced by population-level formulas (Mifflin–St Jeor for energy, with WHO/AHA/ADA-informed adjustments). They are starting points for a typical adult, not a prescription calculated for your physiology.",
        "The app applies conservative safety limits — for example it will not put a pregnant or postpartum user into a calorie deficit, and it caps protein for users who report kidney issues. These limits exist so the default is cautious, not because they are correct for your case. If a clinician has given you targets, theirs are the ones to follow.",
      ],
    },
    {
      heading: "Allergies and food safety",
      body: [
        "Welliva filters meals against the allergies and restrictions you enter, but ingredient data can be incomplete and recipes vary. Always read labels and check with whoever prepared the food. If you have a severe allergy, treat the app as a suggestion engine only, and carry your medication.",
      ],
    },
    {
      heading: "Exercise carries risk",
      body: [
        "Physical activity involves risk of injury. Warm up, use a weight and pace you can control, and stop immediately if you feel chest pain, dizziness, faintness, shortness of breath at rest, or sharp joint pain. By using the training features you accept that risk and agree to train within your own limits.",
      ],
    },
    {
      heading: "The AI coach has limits",
      body: [
        "Gozlin is an AI. It can be confidently wrong, and it only knows what the app has recorded. It is built to refuse symptom, diagnosis, medication and crisis questions and to refer you to a professional instead — please take that referral seriously rather than rephrasing the question.",
      ],
    },
    {
      heading: "In an emergency",
      body: [
        "Do not use Welliva. Contact your local emergency number or go to the nearest emergency department. If you are thinking about harming yourself, please contact a crisis line or a mental-health professional right now — you deserve real support, and this app cannot provide it.",
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: PRIVACY,
  terms: TERMS,
  disclaimer: DISCLAIMER,
};

/** Document order for link lists (Settings, the consent gate footer). */
export const LEGAL_DOC_ORDER: LegalDocId[] = ["privacy", "terms", "disclaimer"];

export function getLegalDoc(id: string | undefined): LegalDoc | null {
  if (!id) return null;
  return LEGAL_DOCS[id as LegalDocId] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Consent gate — the summary the user actually reads
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsentSummaryCard {
  icon: string;
  title: string;
  lines: string[];
  /** Draws in the warning tone — reserved for the medical card. */
  emphasis?: boolean;
}

/**
 * The plain-language digest shown after sign-in, before onboarding. Every claim
 * here is backed by a section of the full documents above — if you change one,
 * change the other.
 */
export const CONSENT_SUMMARY: ConsentSummaryCard[] = [
  {
    icon: "clipboard",
    title: "What you'll share",
    lines: [
      "Your age, body metrics, goals and food preferences.",
      "Health context you choose to give: conditions, pregnancy, injuries, medications, allergies.",
      "What you log — meals, workouts, weigh-ins, habits and check-ins.",
    ],
  },
  {
    icon: "phone-portrait",
    title: "Where it lives",
    lines: [
      "Your detailed history stays on this phone.",
      "Your profile and logs sync to a private cloud account only you can read.",
      "The AI coach receives a short summary, never your full history — and only when you switch cloud coaching on.",
    ],
  },
  {
    icon: "shield-checkmark",
    title: "What we never do",
    lines: [
      "No selling your data. No advertising. No tracking you across other apps.",
      "Nothing shared with employers, insurers or data brokers.",
      "Calendar, location, wearable, photos and voice stay off until you turn them on.",
    ],
  },
  {
    icon: "medkit",
    title: "Welliva is not a doctor",
    emphasis: true,
    lines: [
      "Calorie targets, meal plans, workouts and coaching are general wellness guidance — not medical advice, diagnosis or treatment.",
      "Check with a qualified clinician before you start, especially if you're pregnant, managing a condition or taking medication.",
      "In an emergency, contact your local emergency services — not the app.",
    ],
  },
  {
    icon: "options",
    title: "You stay in control",
    lines: [
      "Turn any data source off at any time under More → Privacy.",
      "Erase everything from Settings → Reset data, or delete your account entirely.",
    ],
  },
];

/** The checkbox label on the gate. Kept here so the wording is reviewable. */
export const CONSENT_CHECKBOX_LABEL =
  "I have read and accept the Privacy Policy, the Terms of Use and the Medical Disclaimer, and I understand Welliva does not provide medical advice.";
