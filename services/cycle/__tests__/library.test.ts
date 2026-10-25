/**
 * THE CYCLE LIBRARY — the content, and the three doors into it.
 *
 * The writing itself can only be judged by reading it. What a test CAN hold is
 * everything that would quietly rot:
 *
 *   · every doctor note has a page. A note that says "worth mentioning to a
 *     doctor" and offers nothing to read is the exact gap this library exists
 *     to close, and a new note id added to ./flags must not be able to reopen
 *     it silently.
 *   · every cross-reference resolves. A "Next" row pointing at a page that was
 *     renamed is a dead end on the one screen whose job is not being one.
 *   · the suggestions are ordered by what bears on today, never empty, never
 *     repeat, and never exceed what the section can show.
 *   · the pages do not contradict the thresholds the app acts on. A page saying
 *     "most cycles are 28 days" while the app predicts from her own 31 teaches
 *     her to distrust both.
 */
import { describe, expect, it } from "vitest";

import {
  CYCLE_ARTICLES,
  CYCLE_LIBRARY,
  GROUP_ORDER,
  READING_FOR_NOTE,
  SUGGESTED_COUNT,
  articlesInGroup,
  findArticle,
  suggestedReading,
  type CycleArticleId,
} from "../library";
import { DEFAULT_CYCLE_SETTINGS, type CycleSettings } from "../types";
import type { CycleView } from "../view";

/* A view is a big object and these selectors read five fields of it. */
type Narrow = Parameters<typeof suggestedReading>[0];

function view(over: Partial<CycleView> = {}): Narrow {
  const status = {
    mode: "normal",
    cycleDay: 14,
    periodDay: null,
    inPeriod: false,
    periodOpen: false,
    periodStale: false,
    expectedEnd: null,
    phase: "luteal",
    predicting: true,
    toEarliest: 10,
    toLatest: 13,
    lateBy: 0,
    ringDays: 28,
    ...(over.status ?? {}),
  } as CycleView["status"];
  return {
    mode: over.mode ?? "normal",
    status,
    notes: over.notes ?? [],
    todayLog: over.todayLog,
    // `in`, not `??`: a test that passes `prediction: null` means null, and a
    // nullish fallback would hand it four logged cycles instead.
    prediction:
      "prediction" in over
        ? (over.prediction ?? null)
        : ({ basedOn: 4 } as CycleView["prediction"]),
  };
}

const settings = (over: Partial<CycleSettings> = {}): CycleSettings => ({
  ...DEFAULT_CYCLE_SETTINGS,
  enabled: true,
  ...over,
});

const ids = (list: { id: CycleArticleId }[]) => list.map((a) => a.id);

describe("the library's shape", () => {
  it("has every page in exactly one group, and every group populated", () => {
    const counted = GROUP_ORDER.flatMap((g) => articlesInGroup(g));
    expect(counted).toHaveLength(CYCLE_ARTICLES.length);
    for (const g of GROUP_ORDER) expect(articlesInGroup(g).length).toBeGreaterThan(0);
  });

  it("has unique ids, and a title, blurb and sections on every page", () => {
    expect(new Set(ids([...CYCLE_ARTICLES])).size).toBe(CYCLE_ARTICLES.length);
    for (const a of CYCLE_ARTICLES) {
      expect(a.title.length).toBeGreaterThan(3);
      expect(a.blurb.length).toBeGreaterThan(10);
      expect(a.sections.length).toBeGreaterThanOrEqual(3);
      expect(a.minutes).toBeGreaterThan(0);
      for (const s of a.sections) {
        // A heading with nothing under it is a page that looks finished.
        expect((s.body?.length ?? 0) + (s.points?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it("resolves every cross-reference, and never links a page to itself", () => {
    for (const a of CYCLE_ARTICLES) {
      for (const next of a.seeAlso) {
        expect(CYCLE_LIBRARY[next], `${a.id} → ${next}`).toBeDefined();
        expect(next).not.toBe(a.id);
      }
    }
  });

  it("reads an unknown or missing id as nothing rather than throwing", () => {
    expect(findArticle("not-a-page")).toBeNull();
    expect(findArticle(undefined)).toBeNull();
    expect(findArticle("cramps")?.title).toBe("Cramps");
  });
});

describe("the writing", () => {
  const all = CYCLE_ARTICLES.flatMap((a) => [
    a.blurb,
    ...a.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.points ?? [])]),
    ...(a.seeSomeone ?? []),
  ]);

  it("quotes the same thresholds the app acts on", () => {
    const text = all.join(" ");
    expect(text).toContain("21 to 35");
    expect(text).toContain("more than seven days");
    expect(text).toContain("90 days");
    // The FIGO regularity limits, which ./flags applies by age.
    expect(text).toMatch(/7 days.*\b26 and 41\b|\b26 and 41\b.*7 days/s);
  });

  it("never promises a prediction is contraception — it says the opposite", () => {
    const ovulation = CYCLE_LIBRARY.ovulation;
    const text = [
      ...ovulation.sections.flatMap((s) => [s.heading, ...(s.body ?? []), ...(s.points ?? [])]),
    ].join(" ");
    expect(text).toContain("not a contraceptive");
    // And it leads with it, rather than burying it at the end.
    expect(ovulation.sections[0].heading.toLowerCase()).toContain("not birth control");
  });

  it("gives its \"see someone\" lines specific triggers, not a general worry", () => {
    for (const a of CYCLE_ARTICLES) {
      for (const line of a.seeSomeone ?? []) {
        expect(line.length, `${a.id}: "${line}"`).toBeGreaterThan(25);
        expect(line.toLowerCase(), a.id).not.toBe("see a doctor if you are worried.");
      }
    }
  });

  it("writes the brand in lower case everywhere", () => {
    for (const line of all) {
      expect(line, line.slice(0, 50)).not.toMatch(/\bWelliva\b/);
    }
  });
});

describe("READING_FOR_NOTE", () => {
  it("gives every doctor note a page that exists", () => {
    for (const [note, id] of Object.entries(READING_FOR_NOTE)) {
      expect(CYCLE_LIBRARY[id], `${note} → ${id}`).toBeDefined();
    }
  });

  it("sends the two length notes to the page that covers both", () => {
    expect(READING_FOR_NOTE.short_cycles).toBe("cycle-length");
    expect(READING_FOR_NOTE.long_cycles).toBe("cycle-length");
  });
});

describe("suggestedReading", () => {
  const note = (id: CycleArticleId extends never ? never : string) =>
    ({ id, title: "t", body: "b", signature: "s" }) as never;

  it("always offers something, even on day one with nothing logged", () => {
    // Nothing logged: no cycle day, so no phase either — `todayStatus` cannot
    // report one, and neither can this fixture.
    const out = suggestedReading(
      view({ prediction: null, status: { cycleDay: null, predicting: false, phase: null } as never }),
      settings(),
    );
    expect(out).toHaveLength(SUGGESTED_COUNT);
    expect(ids(out)).toContain("tracking-well");
  });

  it("never repeats a page and never exceeds what the section shows", () => {
    const out = suggestedReading(
      view({
        todayLog: { date: "2026-10-21", flow: "heavy", symptoms: ["cramps", "headache"], updatedAt: "" },
      }),
      settings(),
    );
    expect(out).toHaveLength(SUGGESTED_COUNT);
    expect(new Set(ids(out)).size).toBe(out.length);
  });

  it("leads with what the app has already raised with her", () => {
    const out = suggestedReading(
      view({ notes: [note("irregular")], todayLog: { date: "x", symptoms: ["cramps"], updatedAt: "" } }),
      settings(),
    );
    // The flag outranks today's symptom: it is the thing she was told to act on.
    expect(ids(out)[0]).toBe("irregular-cycles");
    expect(ids(out)).toContain("cramps");
  });

  it("puts a heavy flow above the symptoms logged beside it", () => {
    const out = suggestedReading(
      view({ todayLog: { date: "x", flow: "heavy", symptoms: ["bloating"], updatedAt: "" } }),
      settings(),
    );
    expect(ids(out)[0]).toBe("heavy-bleeding");
  });

  it("answers a late period with the page about one", () => {
    const out = suggestedReading(view({ status: { lateBy: 3 } as never }), settings());
    expect(ids(out)).toContain("late-period");
  });

  it("follows the life stage on her profile", () => {
    expect(ids(suggestedReading(view({ mode: "postpartum" }), settings()))).toContain("after-a-birth");
    expect(ids(suggestedReading(view({ mode: "menopause" }), settings()))).toContain("perimenopause");
  });

  it("only offers the fertile-window page to someone who asked to see one", () => {
    const off = ids(suggestedReading(view(), settings({ showFertileWindow: false })));
    const on = ids(suggestedReading(view(), settings({ showFertileWindow: true })));
    expect(off).not.toContain("ovulation");
    expect(on).toContain("ovulation");
  });

  it("offers every page it names from the real library", () => {
    for (const a of suggestedReading(view(), settings())) {
      expect(CYCLE_LIBRARY[a.id]).toBe(a);
    }
  });
});
