/**
 * WHAT A CONVERSATION IS CALLED, AND WHETHER IT WAS FINISHED.
 *
 * Two claims made in the product's chrome, so both are correctness questions:
 * the coach header names the thread you are in, and the Action Bar offers to
 * take you back to one you walked out of. A title that reads as a truncated
 * sentence, or a "come back to this" that fires on a conversation that plainly
 * ended, are the two ways this stops being worth having.
 *
 * The topic rules are asserted by OUTCOME, not by rule index — the vocabulary
 * is allowed to grow, the answers are not allowed to drift.
 */
import { describe, expect, it } from "vitest";

import type { GozlinMessage } from "../gozlin.types";
import {
  deriveConversationTitle,
  findOpenThread,
  OPEN_MAX_AGE_MS,
  OPEN_MIN_AGE_MS,
  pickCoachSubhead,
  COACH_SUBHEADS,
} from "../conversationTitle";

const NOW = 1_700_000_000_000;

const user = (content: string, at = NOW): GozlinMessage => ({
  id: `u_${at}_${content.slice(0, 4)}`,
  role: "user",
  content,
  createdAt: at,
});

const coach = (content: string, at = NOW): GozlinMessage => ({
  id: `c_${at}_${content.slice(0, 4)}`,
  role: "coach",
  content,
  createdAt: at,
});

/** The day's opener: a coach message nobody asked for. */
const briefing = (at = NOW) => coach("Good morning. Three days running.", at);

describe("deriveConversationTitle", () => {
  it("has nothing to name until the user has spoken", () => {
    expect(deriveConversationTitle([])).toBeNull();
    expect(deriveConversationTitle([briefing()])).toBeNull();
  });

  it("names the topic, not the sentence", () => {
    expect(
      deriveConversationTitle([briefing(), user("Am I getting enough protein?")]),
    ).toBe("Protein intake");
    expect(deriveConversationTitle([user("Should I train today?")])).toBe(
      "Training today",
    );
    expect(
      deriveConversationTitle([user("My weight has stalled, what would you change?")]),
    ).toBe("Why progress stalled");
  });

  it("prefers the specific reading over the general one", () => {
    // Mentions training, but the subject is the soreness.
    expect(deriveConversationTitle([user("I'm sore — should I still train?")])).toBe(
      "Training while sore",
    );
    // Mentions nutrition, but the subject is protein.
    expect(
      deriveConversationTitle([user("Is my nutrition giving me enough protein?")]),
    ).toBe("Protein intake");
    // Mentions "this week", but the subject is hydration.
    expect(
      deriveConversationTitle([user("Have I been drinking enough water this week?")]),
    ).toBe("Hydration");
  });

  it("takes the FIRST thing the user asked, not the latest", () => {
    const thread = [
      briefing(),
      user("How is my sleep affecting my results?"),
      coach("Two bad nights showed up in your Thursday session."),
      user("And what about my protein?"),
    ];
    expect(deriveConversationTitle(thread)).toBe("Sleep and results");
  });

  it("falls back to the user's own words, stripped of filler", () => {
    expect(
      deriveConversationTitle([user("Hey, can you tell me about creatine loading")]),
    ).toBe("Creatine loading");
    expect(deriveConversationTitle([user("gozlin, what is a superset")])).toBe(
      "What is a superset",
    );
  });

  it("never produces a question, an ellipsis, or an over-long label", () => {
    const long = user(
      "Could you tell me whether the supplement stack I have been putting together over the last few months is worth continuing",
    );
    const title = deriveConversationTitle([long]);
    expect(title).not.toBeNull();
    expect(title!.length).toBeLessThanOrEqual(34);
    expect(title).not.toMatch(/[?…]/);
    // Cut at a word boundary — no half-words on the end.
    expect(title).not.toMatch(/\s$/);
  });

  it("is stable — the same thread always gets the same name", () => {
    const thread = [briefing(), user("What should I eat for my next meal?")];
    expect(deriveConversationTitle(thread)).toBe(deriveConversationTitle(thread));
  });
});

describe("pickCoachSubhead", () => {
  it("is total across the seed range and always yields a real line", () => {
    for (const seed of [0, 0.001, 0.5, 0.999, 1]) {
      expect(COACH_SUBHEADS).toContain(pickCoachSubhead(seed));
    }
  });

  it("varies with the seed, so a new thread reads as a new greeting", () => {
    const drawn = new Set(
      Array.from({ length: 40 }, (_, i) => pickCoachSubhead(i / 40)),
    );
    expect(drawn.size).toBeGreaterThan(5);
  });
});

describe("findOpenThread", () => {
  const older = NOW - 10 * 60_000; // ten minutes ago — inside the window

  it("says nothing about a thread the user never joined", () => {
    expect(findOpenThread([], NOW)).toBeNull();
    expect(findOpenThread([briefing(older)], NOW)).toBeNull();
  });

  it("is open when a question got no answer", () => {
    const open = findOpenThread([briefing(older), user("Why am I stuck?", older)], NOW);
    expect(open?.reason).toBe("no-reply");
    expect(open?.topic).toBe("Why progress stalled");
  });

  it("is open when a reply died mid-stream", () => {
    const open = findOpenThread(
      [user("Should I train today?", older), coach("", older)],
      NOW,
    );
    expect(open?.reason).toBe("no-reply");
  });

  it("is open when Gozlin asked something back and nobody answered", () => {
    const open = findOpenThread(
      [
        user("Tune my training", older),
        coach("I'd drop a set on Thursday. Want me to adjust anything?", older),
      ],
      NOW,
    );
    expect(open?.reason).toBe("coach-asked");
    expect(open?.topic).toBe("Tuning your plan");
  });

  it("is CLOSED when the coach answered and stopped", () => {
    expect(
      findOpenThread(
        [user("Am I recovered?", older), coach("Yes — you're fresh.", older)],
        NOW,
      ),
    ).toBeNull();
  });

  it("does not shadow the user out of a thread they just left", () => {
    const justNow = NOW - (OPEN_MIN_AGE_MS - 1000);
    expect(findOpenThread([user("Why am I stuck?", justNow)], NOW)).toBeNull();
  });

  it("lets go once the moment has passed", () => {
    const ancient = NOW - (OPEN_MAX_AGE_MS + 60_000);
    expect(findOpenThread([user("Why am I stuck?", ancient)], NOW)).toBeNull();
  });

  it("reports when it was left, so the caller can hold a stable phrasing", () => {
    const open = findOpenThread([user("Why am I stuck?", older)], NOW);
    expect(open?.lastAt).toBe(older);
  });
});
