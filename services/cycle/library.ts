/**
 * services/cycle/library.ts — what the app knows, written down.
 *
 * THE PROBLEM THIS SOLVES. welliva could already tell a woman that two of her
 * last six cycles were shorter than 21 days and that it was worth mentioning to
 * a doctor — and then it went quiet. It named a thing and explained nothing: not
 * what a cycle is doing, not why a short one happens, not what the appointment
 * would even look like. The flags (./flags) are the app at its most useful and
 * its most frightening in the same sentence, and the only honest answer to
 * "worth mentioning to a doctor" is a page that says what is being mentioned.
 *
 * NINETEEN PAGES, in four groups, each one reachable three ways: from the
 * library, from the flag that raised it (`READING_FOR_NOTE`), and from whatever
 * she logged today (`suggestedReading`).
 *
 * ── THE RULES THE WRITING FOLLOWS ───────────────────────────────────────────
 * The same ones as the rest of the cycle module, because a page that breaks
 * them does more damage than no page at all:
 *
 *  · IT NEVER DIAGNOSES. Not once, not hedged, not "this could mean". A page
 *    says what is typical, what is common, what a doctor can check, and what
 *    would make it worth going sooner. The word for a condition appears only as
 *    something to ASK about.
 *  · IT NEVER CONTRADICTS THE NUMBERS. Every threshold here is the one the app
 *    already acts on: 21–35 days (./flags), seven days of bleeding, the FIGO
 *    2018 regularity limits of 7 and 9 days by age, 90 days for a missed period.
 *    A page that said "most cycles are 28 days" while the app predicted from her
 *    own 31 would teach her to distrust both.
 *  · IT NEVER PROMISES A PREDICTION IS CONTRACEPTION. The fertile-window page is
 *    the one that has to say so hardest, because it is the page she arrives at
 *    with that question.
 *  · IT IS NOT A SYMPTOM CHECKER. Nothing here reads her log and tells her what
 *    she has. `suggestedReading` picks which page to OFFER from what she logged;
 *    the page itself is the same page for everyone.
 *  · PLAIN, CALM, SHORT SENTENCES. The register of ./copy. No cute, no alarm,
 *    no "girl", no exclamation marks.
 *
 * Pure data and pure selectors — no React, no storage — so the copy is testable
 * and the whole library is one import for the reader screen.
 */

import type { DoctorNoteId } from "./flags";
import type { CycleSettings, Symptom } from "./types";
import type { CycleView } from "./view";

/* ─────────────────────────────── the shape ─────────────────────────────── */

export type CycleArticleId =
  // the basics
  | "how-it-works"
  | "whats-typical"
  | "tracking-well"
  // through the month
  | "cramps"
  | "heavy-bleeding"
  | "headaches"
  | "bloating-and-skin"
  | "mood"
  | "energy-and-training"
  | "food-and-iron"
  // when something changes
  | "late-period"
  | "cycle-length"
  | "irregular-cycles"
  | "long-periods"
  // life and context
  | "ovulation"
  | "contraception"
  | "after-a-birth"
  | "perimenopause"
  | "seeing-a-doctor";

export type CycleArticleGroup = "basics" | "month" | "changes" | "context";

export interface ArticleSection {
  heading: string;
  /** Paragraphs. Rendered in order, one block each. */
  body?: string[];
  /** A short list, rendered as rows. Never a wall of bullets. */
  points?: string[];
}

export interface CycleArticle {
  id: CycleArticleId;
  group: CycleArticleGroup;
  /** Sentence case, the way a person would say it. */
  title: string;
  /** The one line the library card shows. */
  blurb: string;
  icon: string;
  /** Minutes, honest to about ±1. Shown so she can decide before she opens it. */
  minutes: number;
  sections: ArticleSection[];
  /**
   * "Worth seeing someone about" — the short, specific list that closes a page.
   * Omitted where there is genuinely nothing urgent to say, rather than padded.
   */
  seeSomeone?: string[];
  seeAlso: CycleArticleId[];
}

export const GROUP_LABEL: Record<CycleArticleGroup, string> = {
  basics: "The basics",
  month: "Through the month",
  changes: "When something changes",
  context: "Life and context",
};

export const GROUP_ORDER: readonly CycleArticleGroup[] = ["basics", "month", "changes", "context"];

/* ──────────────────────────────── the pages ───────────────────────────────
 * Order inside a group is the reading order: the page someone lands on first
 * assumes the least.
 */

const ARTICLES: CycleArticle[] = [
  /* ── the basics ─────────────────────────────────────────────────────── */
  {
    id: "how-it-works",
    group: "basics",
    title: "What's happening in a cycle",
    blurb: "Four phases, two hormones, and why the second half is the steady one.",
    icon: "sync-outline",
    minutes: 4,
    sections: [
      {
        heading: "A cycle is counted from the first day of bleeding",
        body: [
          "Day 1 is the first day of your period — the first day of real bleeding, not spotting the day before. The cycle ends the day before your next period starts, so a 29-day cycle means 29 days from one first day to the next.",
          "That is the only definition welliva uses. Every length, average and prediction on your screens is counted this way, which is why logging the first day accurately matters more than logging anything else.",
        ],
      },
      {
        heading: "The first half varies. The second half mostly doesn't",
        body: [
          "After your period, follicles in one ovary start to mature and oestrogen rises. One of them releases an egg — that's ovulation. This first stretch, the follicular phase, is the part that stretches and shrinks: stress, illness, travel, hard training and poor sleep all act here, which is why a cycle comes late far more often than it comes early.",
          "After ovulation, the luteal phase begins and progesterone rises. In most people this second half runs a fairly consistent 11 to 16 days, cycle after cycle. If no pregnancy happens, progesterone falls, the lining is shed, and day 1 comes round again.",
          "This is the single most useful fact about your own cycle: when a period is late, it is usually because ovulation was late, not because the second half dragged.",
        ],
      },
      {
        heading: "What the four phase names mean on your dial",
        points: [
          "Period — you are bleeding. Days 1 to about 5.",
          "Follicular — after bleeding, before ovulation. The variable stretch.",
          "Mid-cycle — around ovulation. Called the fertile window only if you've switched that on.",
          "Luteal — after ovulation, before your next period. Where most premenstrual symptoms sit.",
        ],
      },
      {
        heading: "Why welliva says \"likely\" and not a date",
        body: [
          "Nothing in your phone can see ovulation. A prediction is arithmetic on the cycles you have logged, so it is a window, and the window is honest about how wide it is: the more cycles you log, the narrower it gets, and if your cycles genuinely vary a lot it stays wide instead of pretending.",
        ],
      },
    ],
    seeAlso: ["whats-typical", "ovulation", "late-period"],
  },
  {
    id: "whats-typical",
    group: "basics",
    title: "What counts as typical",
    blurb: "The real ranges — 21 to 35 days, 2 to 7 of bleeding — and why 28 is a myth.",
    icon: "options-outline",
    minutes: 3,
    sections: [
      {
        heading: "28 days is an average, not a target",
        body: [
          "A typical adult cycle is anywhere from 21 to 35 days. 28 is roughly the middle of that range, which is how it ended up printed on everything — but a 24-day cycle and a 33-day cycle are both ordinary, and neither is a problem to be fixed.",
          "welliva predicts from your cycles, not from 28. Until it has a few of yours it uses what you told it at setup, and it says so on the prediction.",
        ],
      },
      {
        heading: "The ranges welliva actually uses",
        points: [
          "Cycle length: 21 to 35 days. Outside that in two of your last six cycles is when welliva mentions it.",
          "Period length: 2 to 7 days of bleeding. More than 7 is worth raising.",
          "Variation: a cycle that moves by up to 7 days from your shortest to your longest counts as regular between 26 and 41; up to 9 days outside that age range. These are the FIGO 2018 limits, and they are wider for younger and older people on purpose.",
          "No period for 90 days, outside pregnancy and menopause, is worth a conversation.",
        ],
      },
      {
        heading: "The first years and the last years are different",
        body: [
          "For a few years after periods start, cycles are often long and irregular, and that is normal rather than a sign of anything. The same is true in the years approaching menopause, from the other direction: cycles shorten, then scatter, then stop.",
          "In between, most people settle into their own rhythm — which may be nothing like anyone else's, and is the one your own numbers describe.",
        ],
      },
      {
        heading: "One odd month is a month",
        body: [
          "Almost everyone has an occasional cycle that lands somewhere strange. A single late period after a hard fortnight is not a pattern, which is why welliva waits for a thing to happen twice in six cycles before it says anything at all.",
        ],
      },
    ],
    seeAlso: ["how-it-works", "irregular-cycles", "cycle-length"],
  },
  {
    id: "tracking-well",
    group: "basics",
    title: "Logging that pays you back",
    blurb: "Three taps that sharpen everything, and the ones you can skip.",
    icon: "create-outline",
    minutes: 3,
    sections: [
      {
        heading: "The first day is the one that matters",
        body: [
          "Every prediction, average and pattern is built from first days. Getting those right is worth more than filling in everything else, and it is why welliva asks — with a button you can answer from the lock screen — rather than waiting for you to remember.",
          "If you missed one, add it from the calendar. Predictions re-tune immediately.",
        ],
      },
      {
        heading: "Telling it when a period ended is worth one tap",
        body: [
          "Without an end date welliva has to guess your period's length, and a guessed length is never counted as evidence of your real one. Two or three logged endings and it stops guessing.",
        ],
      },
      {
        heading: "Symptoms earn their keep after two cycles",
        body: [
          "A symptom logged once tells you nothing you didn't know. Logged across two or three cycles, timing appears — and timing is what turns a symptom into something you can plan around, like knowing headaches tend to arrive a day or two before your period rather than during it.",
          "Log what you'd want to be warned about. Skip the rest; a tracker you resent is a tracker you abandon.",
        ],
      },
      {
        heading: "What the app does with it",
        points: [
          "Predicts your next period, and says how sure it is and why.",
          "Eases your workout on days you log cramps or a heavy flow — and stops easing it if you keep choosing the full session.",
          "Finds iron-rich foods in what you already eat, around heavy periods.",
          "Builds a summary you can hand to a doctor, in your numbers.",
        ],
      },
    ],
    seeAlso: ["how-it-works", "seeing-a-doctor", "energy-and-training"],
  },

  /* ── through the month ──────────────────────────────────────────────── */
  {
    id: "cramps",
    group: "month",
    title: "Cramps",
    blurb: "Why they happen, what actually helps, and the line between bad and too bad.",
    icon: "flash-outline",
    minutes: 4,
    sections: [
      {
        heading: "What's going on",
        body: [
          "The womb is a muscle, and it contracts to shed its lining. Prostaglandins — compounds released as the lining breaks down — drive those contractions and also make the nerves around them more sensitive. More prostaglandins, stronger cramps.",
          "That is why cramps are usually worst on day 1 and the day before, ease over two or three days, and often come with a dull ache in the lower back or the tops of the thighs.",
        ],
      },
      {
        heading: "What helps, roughly in order of how well it works",
        points: [
          "Anti-inflammatory painkillers such as ibuprofen or naproxen, where they're safe for you. They work on prostaglandins directly, so taking them as the ache starts rather than once it's bad makes a real difference.",
          "Heat. A hot water bottle or a heat patch on the lower abdomen performs about as well as painkillers in trials, and the two together beat either alone.",
          "Movement. Walking, gentle cycling and stretching all reduce pain for most people, even though they are the last thing you want to do.",
          "Sleep. Short sleep raises pain sensitivity, which is why a bad night before day 1 makes day 1 worse.",
          "Hormonal contraception, if cramps are a monthly problem rather than an occasional one. A doctor can talk through whether it fits.",
        ],
      },
      {
        heading: "What welliva does about it",
        body: [
          "Log cramps and today's session gets lighter on its own — shorter, gentler, same shape. If you keep choosing the full session on days like this, it stops deciding for you and offers the lighter one instead.",
        ],
      },
      {
        heading: "Painful is common. This much pain isn't",
        body: [
          "Period pain that is bad enough to keep you off work or school, that painkillers barely touch, that has got noticeably worse over months or years, or that comes with pain during sex or when you go to the toilet, is worth a proper appointment rather than another month of paracetamol. Those are the patterns that have causes a doctor can look for and treat.",
        ],
      },
    ],
    seeSomeone: [
      "Pain that stops you doing your normal day, every month.",
      "Pain that painkillers and heat no longer touch.",
      "Pain that has been getting worse over months or years.",
      "Pain during sex, when peeing, or when opening your bowels.",
      "Sudden, severe, one-sided pain — that one is same-day, not next-appointment.",
    ],
    seeAlso: ["heavy-bleeding", "energy-and-training", "seeing-a-doctor"],
  },
  {
    id: "heavy-bleeding",
    group: "month",
    title: "Heavy bleeding",
    blurb: "How much is heavy, what it costs you in iron, and when to get it looked at.",
    icon: "water-outline",
    minutes: 4,
    sections: [
      {
        heading: "\"Heavy\" has a practical definition",
        body: [
          "Clinically, heavy means losing more than about 80 ml over a period — but nobody measures that, so what matters is whether it interferes with your life. The usual markers are soaking through a pad or tampon every hour or two for several hours, needing to double up, getting up at night to change, passing clots bigger than a ten-pence piece, or planning your days around it.",
          "By any of those, it is heavy, whatever the number would have said.",
        ],
      },
      {
        heading: "The part people miss: iron",
        body: [
          "Blood loss is iron loss, and heavy periods are one of the most common causes of low iron in women. Low iron shows up as the things it is easiest to blame on something else: tiredness that sleep doesn't fix, breathlessness on stairs you used to manage, cold hands, poor concentration, brittle nails, hair that sheds more than it used to.",
          "This is worth a blood test rather than a guess — both ferritin, which is your stores, and a full blood count. Iron supplements are not harmless to take on spec, so the test comes first.",
        ],
      },
      {
        heading: "Eating for it",
        points: [
          "Iron from meat, fish and shellfish is absorbed far more easily than iron from plants.",
          "Plant iron — lentils, beans, tofu, dark greens, fortified cereal — absorbs much better alongside vitamin C. Peppers, citrus, tomatoes or a glass of orange juice with the meal, not after it.",
          "Tea and coffee with a meal cut iron absorption substantially. Move them an hour either side.",
          "welliva looks for iron-rich foods in what you already log around heavy periods, and names them with their real numbers rather than handing you a generic list.",
        ],
      },
      {
        heading: "It is treatable, and it doesn't have to be forever",
        body: [
          "Heavy periods are one of the most common reasons to see a doctor about a cycle, and one of the most treatable. There are options that reduce the bleeding without touching your fertility, and a doctor will usually check iron and look for a cause before choosing between them.",
        ],
      },
    ],
    seeSomeone: [
      "Soaking a pad or tampon every hour or two, for several hours.",
      "Clots bigger than a ten-pence piece, or flooding through to clothes and bedding.",
      "Bleeding for more than seven days.",
      "Tiredness, breathlessness or dizziness alongside heavy periods — ask for iron to be checked.",
      "Bleeding between periods, after sex, or any bleeding at all after menopause.",
    ],
    seeAlso: ["long-periods", "food-and-iron", "seeing-a-doctor"],
  },
  {
    id: "headaches",
    group: "month",
    title: "Headaches and migraine",
    blurb: "The oestrogen drop, the two days it lands on, and why timing beats treating.",
    icon: "medkit-outline",
    minutes: 3,
    sections: [
      {
        heading: "It's the fall, not the level",
        body: [
          "For a lot of people, headaches and migraine cluster in a narrow window: the two days before a period and the first two or three days of it. The trigger is the sharp drop in oestrogen as the luteal phase ends, which is why the timing is so repeatable and why it tracks your cycle rather than the calendar.",
          "Migraine that arrives in that window tends to last longer, respond less well to the usual treatment, and come with more nausea than migraine at other times of the month. That is a known pattern, not bad luck.",
        ],
      },
      {
        heading: "Timing is the whole advantage of tracking this",
        body: [
          "If welliva can see that your headaches arrive a day or two before your period, it can tell you that before they do — and a treatment taken as a migraine starts works far better than one taken an hour in. Two or three logged cycles is usually enough for the timing to show up on your patterns.",
        ],
      },
      {
        heading: "What tends to help",
        points: [
          "Treating early, at the first sign, rather than waiting to see if it gets bad.",
          "Keeping sleep, meals and hydration steady across those specific days — all three are independent triggers, and they stack.",
          "Cutting back on alcohol in the few days before, if that's a trigger for you.",
          "For regular, predictable attacks, a doctor can discuss treatment taken around the window itself, or looking at your contraception if you use it.",
        ],
      },
      {
        heading: "One thing to raise specifically",
        body: [
          "If you get migraine with aura — visual changes, flashing, blind spots or tingling before the headache — tell whoever prescribes your contraception, because it changes which options are suitable. It is a common and important detail, and easy to forget to mention.",
        ],
      },
    ],
    seeSomeone: [
      "A headache that comes on suddenly and severely, unlike any you've had — that's urgent.",
      "Migraine with aura, if you use or are considering hormonal contraception.",
      "Headaches that are getting more frequent or more severe month to month.",
      "Headaches with fever, a stiff neck, weakness or confusion — urgent.",
    ],
    seeAlso: ["mood", "contraception", "seeing-a-doctor"],
  },
  {
    id: "bloating-and-skin",
    group: "month",
    title: "Bloating, breakouts and tender breasts",
    blurb: "The three that arrive together in the second half, and what moves the needle.",
    icon: "ellipse-outline",
    minutes: 3,
    sections: [
      {
        heading: "Why they cluster",
        body: [
          "Bloating, sore breasts and premenstrual breakouts mostly belong to the luteal phase — the stretch after ovulation, when progesterone is high and then falls away. They tend to arrive together, peak in the few days before a period, and ease once bleeding starts.",
          "The bloating is largely fluid and slower gut transit rather than fat, which is why it can be visible and uncomfortable and gone four days later.",
        ],
      },
      {
        heading: "Bloating",
        points: [
          "Salt, alcohol and very large meals all make it more noticeable in that window.",
          "Drinking more water helps rather than hurts — fluid retention isn't caused by drinking.",
          "Walking after meals moves things along; so does keeping fibre steady rather than spiking it.",
          "If bloating is severe, persistent, or doesn't settle after your period, that's worth raising — it's the one of these three that occasionally points elsewhere.",
        ],
      },
      {
        heading: "Breasts",
        body: [
          "Tenderness and a heavier, lumpier feel in both breasts in the week or so before a period is common and harmless. A supportive bra, including overnight if it's bad, is the most reliable comfort measure.",
          "What matters is the difference between \"both, before my period, gone afterwards\" and anything else: a new lump that stays after your period, a change in one breast only, skin or nipple changes, or any discharge should be checked, regardless of where you are in your cycle.",
        ],
      },
      {
        heading: "Skin",
        body: [
          "Premenstrual breakouts usually sit along the jaw and chin and follow the same timing every month. A routine kept steady across the whole cycle does better than one that reacts in the bad week, and persistent acne is treatable — it is worth a real conversation rather than years of trying products.",
          "Acne that is severe, scarring, or arrives with unusual hair growth or irregular cycles is worth mentioning together, because those three are more informative as a group than separately.",
        ],
      },
    ],
    seeSomeone: [
      "A breast lump that doesn't go after your period, or a change in one breast only.",
      "Skin or nipple changes, or nipple discharge.",
      "Bloating that is severe, constant, or doesn't settle once your period ends.",
      "Acne with unusual hair growth or irregular cycles — mention all three at once.",
    ],
    seeAlso: ["mood", "food-and-iron", "irregular-cycles"],
  },
  {
    id: "mood",
    group: "month",
    title: "Mood through the month",
    blurb: "PMS, the line where it becomes PMDD, and why a log is the proof.",
    icon: "cloud-outline",
    minutes: 4,
    sections: [
      {
        heading: "Premenstrual, not imaginary",
        body: [
          "Low mood, irritability, anxiety, tearfulness and a short fuse in the week or so before a period are real and common. They belong to the luteal phase and they lift within a day or two of bleeding starting — that lifting is the defining feature, and it is what separates premenstrual symptoms from everything else.",
          "Nobody has to earn this with a severity score. If it costs you something every month, it counts.",
        ],
      },
      {
        heading: "The timing is the diagnosis, which is why logging works",
        body: [
          "There is no blood test for PMS. What a doctor needs is the pattern: symptoms that appear in the second half of the cycle, go within a couple of days of a period starting, and are absent in the week after. A log across two or three cycles is far better evidence than trying to remember, and welliva lines your mood check-ins up against your cycle for exactly this.",
        ],
      },
      {
        heading: "When it's more than PMS",
        body: [
          "PMDD is the severe end: the same timing, but intense enough to damage relationships, work or your sense of yourself, month after month. It is a recognised condition with real treatments, and it is routinely dismissed as ordinary PMS — including by the people living with it.",
          "If the week before your period reliably costs you something significant, take a cycle log to a doctor and say that. The pattern you've recorded is the thing that makes the conversation short.",
        ],
      },
      {
        heading: "What tends to help in that week",
        points: [
          "Protecting sleep specifically in those days, rather than generally.",
          "Steadier meals — long gaps make irritability worse, and the premenstrual appetite change makes long gaps likely.",
          "Exercise, which has decent evidence for premenstrual mood even at low doses.",
          "Cutting alcohol in that window, since it worsens both the mood and the sleep.",
          "Treatment, if it's severe. There is more than one option and they work.",
        ],
      },
    ],
    seeSomeone: [
      "Premenstrual mood that damages your relationships, work or study, month after month.",
      "Low mood that does not lift once your period starts — that is not premenstrual, and it still deserves help.",
      "Any thoughts of harming yourself. Don't wait for an appointment; contact your doctor or emergency services now.",
    ],
    seeAlso: ["energy-and-training", "bloating-and-skin", "seeing-a-doctor"],
  },
  {
    id: "energy-and-training",
    group: "month",
    title: "Energy and training",
    blurb: "What the research actually supports — and what the phase-based plans invent.",
    icon: "barbell-outline",
    minutes: 4,
    sections: [
      {
        heading: "The honest summary",
        body: [
          "On average, across studies, your cycle has only a small effect on athletic performance, and the direction of that effect varies between individuals far more than it varies between phases. There is no good evidence for the popular plans that tell everyone to lift heavy in one phase and rest in another.",
          "What is well supported is simpler: symptoms affect training. Cramps, a heavy flow, broken sleep and low mood all make a session harder, and those are things you can actually observe in yourself.",
        ],
      },
      {
        heading: "Which is why welliva reads your log, not your phase",
        body: [
          "The app never says \"you're in your luteal phase, so rest\". It eases today's session when you log cramps or a heavy flow — a real thing, today — and it watches what you choose. Pick the full session on two of your last three days like that and it stops easing by default, and offers the lighter version instead of imposing it.",
          "Your own patterns, once you have a few cycles logged, are the useful version of this. If your training genuinely drops in the first two days of your period, that's worth planning around. If it doesn't, nothing should pretend it does.",
        ],
      },
      {
        heading: "Training through a period",
        points: [
          "Exercise reduces period pain for most people. Light movement on a bad day is usually a net win.",
          "Nothing about bleeding makes training unsafe or less effective.",
          "If you're flagging on day 1 and 2 every cycle, moving your hardest session a couple of days is a plan, not a concession.",
          "Iron is the thing most likely to be behind training fatigue in someone with heavy periods — and it's testable.",
        ],
      },
      {
        heading: "The one that is not about phases at all",
        body: [
          "If periods become light and far apart or stop altogether while you're training hard or eating less than you're using, that is a signal worth taking seriously rather than treating as a sign of fitness. Low energy availability affects bones, hormones and performance, and a period that disappears is often the first visible sign. Raise it with a doctor.",
        ],
      },
    ],
    seeSomeone: [
      "Periods becoming very light, far apart, or stopping while training hard or eating less.",
      "Fatigue out of proportion to your training, especially with heavy periods — ask for iron and ferritin.",
      "A stress fracture or repeated bone injury alongside missed periods.",
    ],
    seeAlso: ["food-and-iron", "late-period", "cramps"],
  },
  {
    id: "food-and-iron",
    group: "month",
    title: "Eating through your cycle",
    blurb: "Real appetite changes, the iron that heavy periods cost, and cravings.",
    icon: "nutrition-outline",
    minutes: 4,
    sections: [
      {
        heading: "The appetite change is real",
        body: [
          "Most people need slightly more energy in the luteal phase — the stretch after ovulation — and appetite rises with it. The difference is modest, generally a small single-digit percentage, but it is enough to explain why the week before a period feels like a failure of willpower when it isn't one.",
          "Fighting it tends to backfire. Eating enough, with protein at each meal, usually does more for the cravings than resisting them does.",
        ],
      },
      {
        heading: "Cravings",
        points: [
          "They cluster in the few days before a period, and chocolate and salt lead the list almost universally.",
          "Long gaps between meals make them much stronger. So does short sleep.",
          "Protein and fibre at each meal blunt them more reliably than willpower.",
          "Planning something you actually like into those days beats banning it and then eating it anyway.",
        ],
      },
      {
        heading: "Iron, if your periods are heavy",
        body: [
          "This is the one nutrient your cycle genuinely puts at risk. Blood loss is iron loss, and low iron is common, easy to miss and very treatable. If your periods are heavy and you are tired in a way sleep doesn't fix, ask for ferritin and a full blood count rather than buying supplements — too much iron is its own problem.",
          "Iron from meat, fish and shellfish absorbs far more easily than iron from plants. Plant iron does much better with vitamin C in the same meal, and much worse with tea or coffee in the same meal.",
          "welliva looks through what you already log around heavy periods and names your own iron-rich foods with real numbers, falling back to a short reference list — filtered for your diet and allergies — only when your log has none.",
        ],
      },
      {
        heading: "Things that get oversold",
        body: [
          "Cutting out whole food groups by cycle phase, \"seed cycling\", and most supplements sold for periods have little or no good evidence behind them. Magnesium and vitamin B6 have some support for premenstrual symptoms and are worth asking a pharmacist or doctor about; most of the rest is marketing.",
        ],
      },
    ],
    seeAlso: ["heavy-bleeding", "energy-and-training", "bloating-and-skin"],
  },

  /* ── when something changes ─────────────────────────────────────────── */
  {
    id: "late-period",
    group: "changes",
    title: "A late period",
    blurb: "The ordinary reasons, the test worth doing, and the 90-day line.",
    icon: "time-outline",
    minutes: 3,
    sections: [
      {
        heading: "Late usually means ovulation was late",
        body: [
          "The second half of a cycle is fairly fixed; the first half is the part that stretches. So a late period almost always means ovulation happened later than usual this month, and the usual culprits act there: a stressful few weeks, illness, a time-zone change, broken sleep, a sharp increase in training, or eating well below what you're using.",
          "A cycle that is a few days longer than your usual is ordinary. welliva widens its window rather than insisting on a date for exactly this reason.",
        ],
      },
      {
        heading: "If pregnancy is possible, test",
        body: [
          "Do it before spending a fortnight wondering. A test from the day your period was due is reliable; if it's negative and your period still hasn't come a week later, test again.",
          "No prediction in any app — including this one — is a pregnancy test or a contraceptive. It is arithmetic on past cycles.",
        ],
      },
      {
        heading: "Then there's nothing to do but wait",
        body: [
          "One late cycle needs no action. If it keeps happening, the useful thing is the record: how late, how often, and what else was going on. That's the thing a doctor can work with, and it's what your log already is.",
        ],
      },
      {
        heading: "Where the line is",
        body: [
          "No period for 90 days, outside pregnancy, the months after a birth, and menopause, is the point at which welliva says something — and it is a reasonable point to ask. It isn't an emergency. It's a conversation, and often a short one.",
        ],
      },
    ],
    seeSomeone: [
      "No period for 90 days, with pregnancy ruled out.",
      "Periods that have become unpredictable or far apart over several months.",
      "A missed period alongside hard training or eating well below what you use.",
      "A missed period with severe one-sided pain, or a positive test and bleeding — urgent.",
    ],
    seeAlso: ["irregular-cycles", "cycle-length", "seeing-a-doctor"],
  },
  {
    id: "cycle-length",
    group: "changes",
    title: "Cycles shorter or longer than usual",
    blurb: "Under 21 days, over 35 — what each tends to mean and what to ask.",
    icon: "resize-outline",
    minutes: 3,
    sections: [
      {
        heading: "What welliva is counting",
        body: [
          "A cycle shorter than 21 days or longer than 35, in two of your last six cycles, is when the app mentions it. Two, not one — because one odd month is a month, and a flag that fired on every stressful fortnight would be noise you learned to ignore.",
        ],
      },
      {
        heading: "Short cycles",
        body: [
          "Repeatedly short cycles usually mean the first half is running short, the second half is, or you're bleeding between periods and it's being counted as a new period. All three are worth sorting out, and the third is worth checking in your own log first: spotting is not a period, and logging it as one would shorten your average for months.",
          "Short cycles mean more periods a year, which means more blood loss and more iron lost. If they come with tiredness, ask for iron to be checked.",
          "Approaching menopause, cycles commonly shorten before they scatter. That's a context worth mentioning if it applies.",
        ],
      },
      {
        heading: "Long cycles",
        body: [
          "Repeatedly long cycles usually mean ovulation is happening late, or in some cycles not at all. Common and generally treatable. Thyroid function, weight change in either direction, hard training, significant stress and PCOS are the things a doctor will usually think about, and most of that is a blood test and a conversation.",
          "Long cycles matter more if you're trying to conceive, since there are fewer chances a year and the timing is harder to pin down.",
        ],
      },
      {
        heading: "What to bring",
        body: [
          "Your last six cycle lengths, how long you bleed for, what's changed in the last year, and whether you're using contraception. welliva's doctor summary has all of that in your own numbers — it takes one tap from the cycle screen.",
        ],
      },
    ],
    seeSomeone: [
      "Cycles under 21 days or over 35, more than once in six cycles.",
      "A clear change in your cycle length over the past year.",
      "Bleeding between periods, or after sex.",
      "Short cycles with tiredness — ask for iron and ferritin.",
    ],
    seeAlso: ["irregular-cycles", "late-period", "seeing-a-doctor"],
  },
  {
    id: "irregular-cycles",
    group: "changes",
    title: "Cycles that vary a lot",
    blurb: "Where the regularity line sits, why it moves with age, and what's behind it.",
    icon: "shuffle-outline",
    minutes: 3,
    sections: [
      {
        heading: "Regular doesn't mean identical",
        body: [
          "Nobody's cycles are the same length every time. The accepted definition of regular allows real movement: between the ages of 26 and 41, up to 7 days from your shortest recent cycle to your longest; outside that age range, up to 9 days. Those are the FIGO 2018 limits, and the range is wider for younger and older people because cycles genuinely vary more at both ends.",
          "welliva uses your age for this, and it only looks at completed cycles it actually counted.",
        ],
      },
      {
        heading: "What a wide spread usually reflects",
        body: [
          "Ovulation that happens at a different time each cycle. The reasons are mostly ordinary and often fixable: thyroid function, significant weight change in either direction, stress and sleep, heavy training, and PCOS — which is common and specifically does this.",
          "It is also simply what the first years after periods start, and the years approaching menopause, look like.",
        ],
      },
      {
        heading: "What it means for predictions",
        body: [
          "The wider your spread, the wider welliva's window. That is the app being honest rather than being vague: a narrow prediction built on cycles of 24, 33 and 29 days would be a guess wearing a confident face.",
        ],
      },
      {
        heading: "What a doctor can do with it",
        body: [
          "Quite a lot, and the first appointment is usually a conversation and a blood test. Bring your lengths — the spread is the finding, and you already have it recorded.",
        ],
      },
    ],
    seeSomeone: [
      "A spread of more than 7 to 9 days across your recent cycles, depending on your age.",
      "Cycles that have become unpredictable over the last year, when they weren't before.",
      "Irregular cycles with acne or unusual hair growth — mention them together.",
      "Irregular cycles while trying to conceive.",
    ],
    seeAlso: ["cycle-length", "whats-typical", "seeing-a-doctor"],
  },
  {
    id: "long-periods",
    group: "changes",
    title: "A period that goes on",
    blurb: "Seven days is the line. What's usually behind a longer one.",
    icon: "hourglass-outline",
    minutes: 3,
    sections: [
      {
        heading: "Where the line is",
        body: [
          "Two to seven days of bleeding is the typical range. welliva mentions a period longer than seven days — and only counts periods you ended yourself, because a period it had to guess the end of is not evidence of anything.",
          "Length and heaviness are separate questions. A long light period and a short heavy one are different situations, and both are worth describing accurately.",
        ],
      },
      {
        heading: "What tends to be behind it",
        body: [
          "Common, checkable causes: fibroids and polyps, which are growths in or on the womb and very often treatable; the lining being thicker than usual; a coil or a hormonal method, especially in the first months; thyroid function; and less commonly a bleeding disorder — which is worth raising specifically if you have also always bruised easily or bled heavily after dental work or childbirth.",
          "None of that is something to self-diagnose. All of it is something an appointment can narrow down quickly.",
        ],
      },
      {
        heading: "The thing worth doing while you wait",
        body: [
          "Ask for iron. Long or heavy periods are a leading cause of low iron, and the symptoms — tiredness, breathlessness, poor concentration — are easy to attribute to everything else. Ferritin and a full blood count, not a guess.",
        ],
      },
      {
        heading: "What to record before you go",
        points: [
          "How many days you bleed, across your last few periods.",
          "How heavy, in practical terms: how often you change, whether you double up, whether you get up at night.",
          "Any bleeding between periods or after sex.",
          "What you use for contraception, and when that changed.",
        ],
      },
    ],
    seeSomeone: [
      "Bleeding for more than seven days, more than once.",
      "Bleeding that is both long and heavy — ask for iron to be checked.",
      "Bleeding between periods, after sex, or any bleeding after menopause.",
      "A long period with easy bruising or heavy bleeding after dental work or childbirth — mention that history.",
    ],
    seeAlso: ["heavy-bleeding", "food-and-iron", "seeing-a-doctor"],
  },

  /* ── life and context ──────────────────────────────────────────────── */
  {
    id: "ovulation",
    group: "context",
    title: "Ovulation and the fertile window",
    blurb: "What an estimate can and cannot tell you. It is not contraception.",
    icon: "sparkles-outline",
    minutes: 4,
    sections: [
      {
        heading: "Start here: this is not birth control",
        body: [
          "A fertile window estimated from past cycles is not a contraceptive, and neither is any app that shows one, including this one. Ovulation moves. Sperm survive for several days. The window welliva draws is arithmetic on cycles that have already happened, and it says \"estimate\" every single time it appears.",
          "If you are avoiding pregnancy, use a method designed for it. The fertility-awareness methods that genuinely work require daily measurement and proper instruction — they are not a shaded band on a dial.",
        ],
      },
      {
        heading: "What ovulation actually is",
        body: [
          "One ovary releases an egg, roughly in the middle of a cycle but genuinely variable. The egg is viable for about a day. Sperm can survive up to about five days in the right conditions, which is why the fertile window is several days wide and sits before ovulation rather than after it.",
          "After ovulation, the luteal phase runs its fairly consistent 11 to 16 days. That consistency is what makes predicting a period easier than predicting ovulation.",
        ],
      },
      {
        heading: "Signs that are more reliable than a calendar",
        points: [
          "Cervical mucus becoming clear, stretchy and slippery in the days before ovulation — the most useful free sign.",
          "Ovulation predictor kits, which detect the LH surge a day or so before. welliva takes a positive test and uses it to sharpen your estimate.",
          "Basal body temperature, which rises slightly after ovulation — it confirms, rather than predicts.",
          "A mild one-sided ache mid-cycle, for some people. Suggestive, not definitive.",
        ],
      },
      {
        heading: "If you're trying to conceive",
        body: [
          "Sex every two to three days across the middle of the cycle does about as well as trying to hit a single day, without turning it into a project. Most couples conceive within a year. It's worth a conversation sooner — around six months — if you're over 35, if your cycles are irregular or far apart, or if either of you has a known reason to ask earlier.",
        ],
      },
    ],
    seeAlso: ["how-it-works", "irregular-cycles", "contraception"],
  },
  {
    id: "contraception",
    group: "context",
    title: "Contraception and your cycle",
    blurb: "Why your tracker's predictions stop meaning what they meant.",
    icon: "shield-checkmark-outline",
    minutes: 3,
    sections: [
      {
        heading: "Most methods change what you're tracking",
        body: [
          "On the combined pill, the bleed in the break isn't a period — it's a withdrawal bleed, and it happens because the hormones stopped, not because a cycle completed. Averages built from those bleeds describe your packet, not your body.",
          "On progestogen-only methods, the implant, the injection or a hormonal coil, bleeding can become irregular, very light, or stop completely. All of that is expected rather than a sign of anything, and none of it means your tracker is broken.",
          "A copper coil doesn't use hormones, so cycles continue — though periods are often heavier, especially at first.",
        ],
      },
      {
        heading: "So what is worth logging",
        body: [
          "Bleeding, symptoms and how you feel are all still worth recording — they are what patterns are built from, and they are what you take to an appointment. It's the predictions that lose their meaning: a window calculated from withdrawal bleeds is describing a schedule you already know.",
        ],
      },
      {
        heading: "Coming off it",
        body: [
          "Cycles can take a few months to settle after stopping a hormonal method, and after the injection it can take considerably longer. A few irregular cycles in that stretch are expected. Logging through it is useful precisely because it shows you when your own rhythm returns.",
        ],
      },
      {
        heading: "Two things to raise with whoever prescribes yours",
        points: [
          "Migraine with aura — visual changes or tingling before a headache. It changes which methods are suitable.",
          "Bleeding that is new, persistent or unexpected on a method you've been on for a while.",
        ],
      },
    ],
    seeSomeone: [
      "Bleeding that changes months after starting a method, rather than at the start.",
      "Migraine with aura, if you use or are considering a combined method.",
      "Any bleeding after sex, or between bleeds, on any method.",
    ],
    seeAlso: ["ovulation", "irregular-cycles", "heavy-bleeding"],
  },
  {
    id: "after-a-birth",
    group: "context",
    title: "After a birth",
    blurb: "When cycles come back, what breastfeeding does, and why predictions wait.",
    icon: "heart-outline",
    minutes: 3,
    sections: [
      {
        heading: "There's no normal timetable",
        body: [
          "If you're not breastfeeding, periods usually return somewhere between six weeks and three months. If you are, it can be many months, and that is ordinary rather than a problem — frequent feeding suppresses ovulation, and the effect fades as feeds spread out.",
          "The first few cycles back are often irregular, heavier or lighter than you remember, and that settles.",
        ],
      },
      {
        heading: "What welliva does in the meantime",
        body: [
          "With postpartum on your profile, predictions pause — there is nothing honest to predict from cycles that ended before a pregnancy. Logging continues, and the new history starts from your first period after the birth. The dial says it's waiting rather than guessing.",
        ],
      },
      {
        heading: "One thing worth knowing",
        body: [
          "Breastfeeding reduces the chance of pregnancy but does not remove it, and ovulation can return before your first period does. If you're avoiding pregnancy, don't rely on either breastfeeding or an app.",
        ],
      },
      {
        heading: "The bleeding right after a birth is different",
        body: [
          "The weeks of bleeding after delivery — lochia — are not a period and shouldn't be logged as one. It changes colour and reduces over a few weeks. Bleeding that suddenly becomes heavy again, smells offensive, or comes with a fever needs to be seen, not tracked.",
        ],
      },
    ],
    seeSomeone: [
      "Heavy bleeding, large clots, fever or offensive-smelling discharge after a birth — contact your midwife or doctor now.",
      "No period by around three months after stopping breastfeeding.",
      "Low mood or anxiety that is persistent rather than passing. It is common, it is treatable, and it is worth saying out loud.",
    ],
    seeAlso: ["late-period", "heavy-bleeding", "mood"],
  },
  {
    id: "perimenopause",
    group: "context",
    title: "Perimenopause and menopause",
    blurb: "Cycles shortening, then scattering — and the one symptom that's never normal.",
    icon: "partly-sunny-outline",
    minutes: 4,
    sections: [
      {
        heading: "Perimenopause is the years of change, not the end",
        body: [
          "It commonly starts in the mid-forties and lasts several years. Cycles often shorten first, then become unpredictable — some shorter, some much longer, some skipped — and periods can get heavier before they stop. All of that is the process, not a fault in it.",
          "Menopause itself is a single point looking backwards: twelve consecutive months with no period. Everything before that is perimenopause, and you only know the date afterwards.",
        ],
      },
      {
        heading: "Why predictions get less useful here",
        body: [
          "A prediction is arithmetic on recent cycles, and in perimenopause recent cycles stop describing the next one. welliva widens its window as your spread widens, and with menopause on your profile it stops predicting altogether and keeps logging — which is the honest thing to do.",
          "The log is still worth keeping. The pattern over a year is what makes an appointment short.",
        ],
      },
      {
        heading: "What else comes with it",
        body: [
          "Hot flushes and night sweats, broken sleep, mood and anxiety changes, brain fog, joint aches, vaginal dryness and changes in sex drive are all common, and they are treatable. None of it has to be endured as a rite of passage.",
          "Treatment choices depend on your own health history, so this is a conversation rather than a decision to make from an article.",
        ],
      },
      {
        heading: "The one that is never just perimenopause",
        body: [
          "Any bleeding after twelve months without a period should be checked promptly — not at your next routine appointment. It usually turns out to be something straightforward, and it is the single most important thing on this page. The same goes for bleeding between periods, bleeding after sex, or a sudden change to much heavier periods during perimenopause.",
        ],
      },
    ],
    seeSomeone: [
      "Any bleeding at all after twelve months without a period — promptly.",
      "Bleeding between periods or after sex.",
      "A sudden change to much heavier or much longer periods.",
      "Periods stopping before 45, and especially before 40 — that's worth investigating rather than accepting.",
      "Symptoms affecting your work, sleep or relationships. There is treatment.",
    ],
    seeAlso: ["irregular-cycles", "heavy-bleeding", "seeing-a-doctor"],
  },
  {
    id: "seeing-a-doctor",
    group: "context",
    title: "What a doctor can check",
    blurb: "What the appointment is actually like, what to bring, and what to say first.",
    icon: "medical-outline",
    minutes: 4,
    sections: [
      {
        heading: "\"Worth mentioning\" means exactly that",
        body: [
          "When welliva flags something, it is describing what your own logs show and saying it is worth raising. It is not a diagnosis, it is not urgent unless it says so, and most of what gets raised turns out to have an ordinary explanation. The point of going is to find out rather than to keep wondering.",
        ],
      },
      {
        heading: "What usually happens",
        points: [
          "A conversation: how long your cycles are, how long and how heavy you bleed, what's changed, what contraception you use, whether pregnancy is possible.",
          "Blood tests, often thyroid function, a full blood count and ferritin, and sometimes hormones timed to a particular day of your cycle.",
          "An examination or a scan, if what you've described points that way. You can ask what it's for and say no.",
          "A plan, which might be treatment, a test, or watching it for a few cycles with a reason given.",
        ],
      },
      {
        heading: "Bring your numbers",
        body: [
          "This is the part that changes the appointment. \"My periods are irregular\" is a sentence; \"my last six cycles were 24, 33, 27, 36, 25 and 31 days, and I bleed for eight\" is a finding. welliva builds exactly that from your log — lengths, ranges, the symptoms you log most and any notes it has raised — and sharing it takes one tap from the cycle screen.",
          "Write down your one main question before you go, and ask it first. Appointments are short and the thing you most wanted to say is the thing most likely to get lost.",
        ],
      },
      {
        heading: "If you're not taken seriously",
        body: [
          "It happens, particularly with pain and heavy bleeding. Asking directly is reasonable: what could be causing this, what would you do if it got worse, and can you note in my record that I raised it. You can ask for a second opinion, and you can go back — a log that keeps accumulating is the most persuasive thing you can bring.",
        ],
      },
      {
        heading: "Don't wait for an appointment for these",
        points: [
          "Severe, sudden pain, especially one-sided, or pain with faintness.",
          "Bleeding that soaks through a pad an hour for several hours, or that comes with dizziness.",
          "A positive pregnancy test with bleeding or pain.",
          "Fever with pelvic pain or offensive discharge.",
          "Any bleeding after twelve months without a period.",
        ],
      },
    ],
    seeAlso: ["tracking-well", "heavy-bleeding", "cramps"],
  },
];

/** Every page, by id. */
export const CYCLE_LIBRARY: Record<CycleArticleId, CycleArticle> = Object.fromEntries(
  ARTICLES.map((a) => [a.id, a]),
) as Record<CycleArticleId, CycleArticle>;

/** Reading order, as the library screen lists them. */
export const CYCLE_ARTICLES: readonly CycleArticle[] = ARTICLES;

export function articlesInGroup(group: CycleArticleGroup): CycleArticle[] {
  return ARTICLES.filter((a) => a.group === group);
}

/** An unknown id (a stale deep link, a typo in a route) reads as nothing. */
export function findArticle(id: string | undefined): CycleArticle | null {
  if (!id) return null;
  return (CYCLE_LIBRARY as Record<string, CycleArticle | undefined>)[id] ?? null;
}

/* ─────────────────────── where a page gets offered ───────────────────────
 * Three doors, and all three are HERE rather than in the screens, so the page a
 * flag links to and the page the cycle screen suggests can never drift apart.
 */

/**
 * The page a doctor note links to. Every id in ./flags has one — a note that
 * said "worth mentioning to a doctor" and then offered nothing to read is the
 * exact gap this library exists to close, so this map is exhaustive by type.
 */
export const READING_FOR_NOTE: Record<DoctorNoteId, CycleArticleId> = {
  short_cycles: "cycle-length",
  long_cycles: "cycle-length",
  long_bleeding: "long-periods",
  irregular: "irregular-cycles",
  missed: "late-period",
  menopause_bleeding: "perimenopause",
};

/** The page a logged symptom leads to. */
const READING_FOR_SYMPTOM: Record<Symptom, CycleArticleId> = {
  cramps: "cramps",
  headache: "headaches",
  bloating: "bloating-and-skin",
  tender_breasts: "bloating-and-skin",
  back_pain: "cramps",
  acne: "bloating-and-skin",
  cravings: "food-and-iron",
  nausea: "cramps",
};

/** How many the cycle screen offers. Three is a shelf; ten is homework. */
export const SUGGESTED_COUNT = 3;

/**
 * What to put in front of her TODAY, from where she actually is.
 *
 * Ordered by how closely it bears on today and de-duplicated, then topped up
 * from the basics so the section is never empty and never repeats. Nothing here
 * interprets her log — it only decides which page to offer, which is the
 * difference between a library and a symptom checker (see the header).
 */
export function suggestedReading(
  view: Pick<CycleView, "status" | "mode" | "notes" | "todayLog" | "prediction">,
  settings: Pick<CycleSettings, "showFertileWindow">,
): CycleArticle[] {
  const picks: CycleArticleId[] = [];
  const add = (id: CycleArticleId) => {
    if (!picks.includes(id)) picks.push(id);
  };

  // 1. Anything the app has already raised with her. It said "worth mentioning
  //    to a doctor"; this is the page that says what is being mentioned.
  for (const note of view.notes) add(READING_FOR_NOTE[note.id]);

  // 2. Today. A heavy flow outranks the symptoms logged beside it.
  const log = view.todayLog;
  if (log?.flow === "heavy") add("heavy-bleeding");
  for (const s of log?.symptoms ?? []) add(READING_FOR_SYMPTOM[s]);
  if (log?.mood === "low" || log?.mood === "irritable" || log?.mood === "anxious") add("mood");
  if (log?.energy === "low") add("energy-and-training");

  // 3. Where she is in the cycle, and which life stage the profile says.
  if (view.mode === "postpartum") add("after-a-birth");
  if (view.mode === "menopause") add("perimenopause");
  if (view.status.lateBy > 0) add("late-period");
  if (view.status.inPeriod) add("cramps");
  if (!view.status.inPeriod && view.status.phase === "luteal") add("mood");
  if (settings.showFertileWindow) add("ovulation");

  // 4. The floor. Someone three days into tracking has no flags and no logs,
  //    and still deserves the three pages that explain what she is looking at.
  const basis = view.prediction?.basedOn ?? 0;
  if (basis < 2) add("tracking-well");
  add("how-it-works");
  add("whats-typical");
  add("seeing-a-doctor");

  return picks.slice(0, SUGGESTED_COUNT).map((id) => CYCLE_LIBRARY[id]);
}
