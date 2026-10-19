import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";
import { cardFromPattern, retiredHabitCard } from "../../../components/home/coachDeck";
import { isSyncedKey } from "../../sync/syncKeys";
import { strategyFor } from "../../sync/mergeStrategies";
import { clearGozlinMemory } from "../GozlinMemoryStore";
import {
  INSIGHT_LEDGER_KEY,
  LEDGER_CAP,
  insightKey,
  isInsightSeen,
  loadLedger,
  openInsight,
  recordOpened,
  subscribeLedger,
  unseenCards,
  type InsightEntry,
  type LedgerCard,
} from "../InsightLedger";

const TODAY = "2026-10-17";
const TOMORROW = "2026-10-18";

function pacing(id: string, message = "About 800ml to go today."): LedgerCard {
  return {
    id,
    type: "hydration",
    tone: "nudge",
    icon: "water-outline",
    title: "Hydration is behind",
    message,
    priority: 5,
  };
}

function habit(message: string): LedgerCard {
  return {
    id: "gozlin-habit",
    type: "motivation",
    tone: "positive",
    icon: "sparkles",
    title: "Your keystone habit",
    message,
    priority: 6,
    isHabit: true,
  };
}

beforeEach(async () => {
  await AsyncStorage.multiRemove(await AsyncStorage.getAllKeys());
});

describe("what makes an insight the same insight", () => {
  it("keys a pacing card by the card AND the day", () => {
    const c = pacing("low-water");
    expect(insightKey(c, TODAY)).toBe(`low-water:${TODAY}`);
    expect(insightKey(c, TODAY)).not.toBe(insightKey(c, TOMORROW));
  });

  it("ignores the live numbers inside a pacing card within one day", () => {
    // 800ml to go at noon and 600ml at four are one occurrence of one nudge.
    expect(insightKey(pacing("low-water", "About 800ml to go."), TODAY)).toBe(
      insightKey(pacing("low-water", "About 600ml to go."), TODAY),
    );
  });

  it("keys a learned finding by its content, not by the day or the card id", () => {
    const a = habit("Your keystone is a morning walk.");
    expect(insightKey(a, TODAY)).toBe(insightKey(a, TOMORROW));
    expect(insightKey(a, TODAY)).not.toBe(
      insightKey(habit("Your keystone is water first."), TODAY),
    );
  });

  it("is one insight whether it arrives as the weekly card or the carousel card", () => {
    const pattern = {
      kind: "anchor",
      message: "Your keystone is a morning walk.",
      icon: "walk",
    } as never;
    const weekly = cardFromPattern(pattern, "weekly-insight");
    const carousel = cardFromPattern(pattern);
    expect(insightKey(weekly, TODAY)).toBe(insightKey(carousel, TODAY));
  });

  it("is not thrown by whitespace or case in a finding", () => {
    expect(insightKey(habit("Your  keystone\nis a walk."), TODAY)).toBe(
      insightKey(habit("your keystone is a walk."), TODAY),
    );
  });

  it("keeps a retired-habit beat on its permanent fact id", () => {
    const card = retiredHabitCard({
      fact: { id: "fact-7" },
      title: "Remember reading?",
      message: "You stopped a while back.",
      prompt: "x",
    } as never);
    expect(insightKey(card, TODAY)).toBe("gozlin-retired-fact-7");
    expect(insightKey(card, TOMORROW)).toBe("gozlin-retired-fact-7");
  });
});

describe("recording and filtering", () => {
  const NOW = new Date("2026-10-17T09:00:00Z");

  it("hides an opened insight and leaves the others alone", () => {
    const a = pacing("low-water");
    const b = pacing("workout-late");
    const ledger = recordOpened([], a, TODAY, NOW);
    expect(isInsightSeen(ledger, a, TODAY)).toBe(true);
    expect(unseenCards([a, b], ledger, TODAY).map((c) => c.id)).toEqual(["workout-late"]);
  });

  it("brings a pacing card back the next day, because that is a new occurrence", () => {
    const a = pacing("low-water");
    const ledger = recordOpened([], a, TODAY, NOW);
    expect(unseenCards([a], ledger, TOMORROW)).toHaveLength(1);
  });

  it("keeps a learned finding hidden across days until its wording changes", () => {
    const a = habit("Your keystone is a morning walk.");
    const ledger = recordOpened([], a, TODAY, NOW);
    expect(unseenCards([a], ledger, TOMORROW)).toHaveLength(0);
    expect(unseenCards([habit("Your keystone is water first.")], ledger, TOMORROW)).toHaveLength(1);
  });

  it("returns the SAME ledger for a reopen, and never restamps it", () => {
    const a = pacing("low-water");
    const first = recordOpened([], a, TODAY, NOW);
    const again = recordOpened(first, a, TODAY, new Date("2026-10-17T20:00:00Z"));
    expect(again).toBe(first);
    expect(again[0].openedAt).toBe(NOW.toISOString());
  });

  it("returns every card untouched when nothing has been opened", () => {
    const cards = [pacing("a"), pacing("b")];
    expect(unseenCards(cards, [], TODAY)).toEqual(cards);
  });

  it("keeps the card as it was read, so the archive does not drift with the engine", () => {
    const ledger = recordOpened([], pacing("low-water", "About 800ml to go."), TODAY, NOW);
    expect(ledger[0].card.message).toBe("About 800ml to go.");
  });

  it("caps at 100, newest kept", () => {
    let ledger: readonly InsightEntry[] = [];
    for (let i = 0; i < LEDGER_CAP + 15; i++) {
      ledger = recordOpened(
        ledger,
        habit(`finding ${i}`),
        TODAY,
        new Date(NOW.getTime() + i * 60_000),
      );
    }
    expect(ledger).toHaveLength(LEDGER_CAP);
    expect(ledger[0].card.message).toBe(`finding ${LEDGER_CAP + 14}`);
    expect(ledger.some((e) => e.card.message === "finding 0")).toBe(false);
  });
});

describe("storage", () => {
  it("persists, announces, and survives two quick opens", async () => {
    let heard = 0;
    const off = subscribeLedger(() => {
      heard++;
    });
    await Promise.all([
      openInsight(pacing("low-water"), TODAY),
      openInsight(pacing("workout-late"), TODAY),
    ]);
    off();
    // Neither write may be lost to the other reading a stale list.
    expect((await loadLedger()).map((e) => e.card.id).sort()).toEqual([
      "low-water",
      "workout-late",
    ]);
    expect(heard).toBe(2);
  });

  it("does not write or announce for an insight already filed", async () => {
    await openInsight(pacing("low-water"), TODAY);
    let heard = 0;
    const off = subscribeLedger(() => {
      heard++;
    });
    await openInsight(pacing("low-water"), TODAY);
    off();
    expect(heard).toBe(0);
    expect(await loadLedger()).toHaveLength(1);
  });

  it("drops malformed stored entries instead of trusting them", async () => {
    await AsyncStorage.setItem(
      INSIGHT_LEDGER_KEY,
      JSON.stringify([
        null,
        { key: 1 },
        { key: "k", openedAt: "2026-10-17T09:00:00Z" },
        {
          key: "ok",
          openedAt: "2026-10-17T09:00:00Z",
          card: { title: "t", message: "m" },
        },
      ]),
    );
    expect((await loadLedger()).map((e) => e.key)).toEqual(["ok"]);
  });

  it("is removed by Clear memory, with everything else Gozlin remembers", async () => {
    await openInsight(pacing("low-water"), TODAY);
    await clearGozlinMemory();
    expect(await loadLedger()).toEqual([]);
  });
});

describe("sync", () => {
  it("syncs, and merges per entry rather than one phone replacing the other", () => {
    expect(isSyncedKey(INSIGHT_LEDGER_KEY)).toBe(true);
    expect(strategyFor(INSIGHT_LEDGER_KEY)).toMatchObject({
      kind: "mergeById",
      idField: "key",
      cap: LEDGER_CAP,
    });
  });
});
