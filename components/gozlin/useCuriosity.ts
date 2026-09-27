/**
 * useCuriosity — "trying something new", wired to the coach screen.
 * docs/gozlin/11-trying-something-new.md.
 *
 * The engines (services/gozlin/novelty) are pure and decide everything. This
 * hook only feeds them — the ledger, the log, the memories, the clock, the
 * switch — and writes back what happened. Three things about HOW it does that
 * are load-bearing:
 *
 *   1. A question is recorded as OPENED once, from an effect, the first time
 *      the selector returns it — never on render. Budget and back-off read
 *      that record, so a write per render would spend the week's budget in a
 *      scroll.
 *   2. `enabled` is the Trust switch AND the tier (the whole feature is Pro —
 *      the owner's call, D7). Off, the brief carries nothing, the chip never
 *      shows, and note_experience refuses: the engines enforce it, not this UI.
 *   3. The clock ticks. A question's window opens at a time of day (05:00 the
 *      morning after), and a coach screen left open overnight must notice.
 */

import { useBilling } from "@/contexts/BillingContext";
import { consent } from "@/health-os";
import type { WorkoutSession } from "@/models/workout";
import type { SessionSummaryData } from "@/models/session";
import type { UserBio } from "@/models/user";
import { ingestIntoLedger } from "@/services/ExerciseLedger";
import {
  clipQuote,
  forgetExperience,
  loadCuriosityLog,
  loadExperiences,
  markRecalled,
  recordCareFlag,
  saveExperience,
  subscribeExperiences,
  upsertCuriosity,
} from "@/services/gozlin/ExperienceStore";
import {
  afterTurn,
  chipVisible,
  detectNovelty,
  emptyLedger,
  markAnswered,
  markDismissed,
  selectQuestion,
  subjectFor,
  wasTried,
  type CuriosityEntry,
  type Enjoyed,
  type ExperienceBrief,
  type ExperienceRecord,
  type SeenLedger,
  type Soreness,
} from "@/services/gozlin/novelty";
import {
  screenForClinicalRisk,
  type ClinicalRisk,
  type ExperienceNote,
  type TurnCuriosity,
} from "@/services/gozlin/agent";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

/** How often the clock is re-read while the screen is open. */
const TICK_MS = 5 * 60_000;

/** What a tap in the answer sheet says. Every field optional after the first tap. */
export interface ChipAnswer {
  soreness?: Soreness | null;
  enjoyed?: Enjoyed | null;
  feelings?: string[];
  /** Free text, their words. Screened before it is kept. */
  note?: string;
}

export interface UseCuriosity {
  /** For the chat context — see ExperienceBrief. */
  brief: ExperienceBrief;
  /** The question the chip asks about, or null when there is no chip. */
  chip: CuriosityEntry | null;
  /**
   * Record an answer from the sheet. The first call creates the record; later
   * calls with its id amend it. Returns the id, and the clinical screen's
   * verdict when their words tripped it — the sheet shows that reply verbatim.
   */
  answer: (patch: ChipAnswer, recordId?: string) => Promise<{ id: string; clinical: ClinicalRisk | null }>;
  /** "Not now" — counts as ignored for back-off, and the chip goes. */
  dismiss: () => Promise<void>;
  /** "Don't ask me these" — the Trust switch, turned off from here. */
  stopAsking: () => Promise<void>;
  /** What an agent turn did with the question and the memories. */
  recordTurn: (c: TurnCuriosity | undefined) => Promise<void>;
  /** note_experience's write. */
  saveNote: (note: ExperienceNote) => Promise<{ ok: true; id: string } | { ok: false; reason: string }>;
  /** Undo a note — it is forgotten (tombstoned), not un-answered. */
  undo: (id: string) => Promise<void>;
  /** Re-read everything — after "Clear memory". */
  reload: () => Promise<void>;
}

export function useCuriosity(input: {
  sessionHistory: SessionSummaryData[];
  plannedSession: WorkoutSession | null;
  currentDate: string;
  bio: UserBio | null;
}): UseCuriosity {
  const { sessionHistory, plannedSession, currentDate, bio } = input;
  const { allows } = useBilling();
  const allowed = allows("coach-limit");

  const [consentOn, setConsentOn] = useState<boolean | null>(null);
  const [ledger, setLedger] = useState<SeenLedger>(emptyLedger);
  const [log, setLog] = useState<CuriosityEntry[]>([]);
  const [records, setRecords] = useState<ExperienceRecord[]>([]);
  const [now, setNow] = useState(() => new Date());

  // ── Reading ──

  const readStores = useCallback(async () => {
    const [l, r] = await Promise.all([loadCuriosityLog(), loadExperiences()]);
    setLog(l);
    setRecords(r);
  }, []);

  const readSwitch = useCallback(async () => {
    try {
      setConsentOn(await consent.isGranted("experience_followups"));
    } catch {
      setConsentOn(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setNow(new Date());
    await Promise.all([readStores(), readSwitch()]);
  }, [readStores, readSwitch]);

  useEffect(() => {
    void reload();
    return subscribeExperiences(() => void readStores());
  }, [reload, readStores]);

  // The Trust switch lives on another screen; coming back here is when it may
  // have changed.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void readSwitch();
    }, [readSwitch]),
  );

  // The clock: a window opens at a time of day, and a day can turn while this
  // screen stays mounted.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(new Date());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  useEffect(() => setNow(new Date()), [currentDate]);

  // The ledger catches up on the whole history — idempotent, and the only pass
  // that can see a hole (services/ExerciseLedger.ts).
  useEffect(() => {
    let alive = true;
    void ingestIntoLedger(sessionHistory, { fullHistory: true }).then((l) => {
      if (alive) setLedger(l);
    });
    return () => {
      alive = false;
    };
  }, [sessionHistory]);

  // ── Deciding (all pure) ──

  const enabled = consentOn === true && allowed;

  const selection = useMemo(
    () =>
      selectQuestion({
        candidates: detectNovelty(ledger, sessionHistory, now),
        log,
        now,
        enabled,
      }),
    [ledger, sessionHistory, log, now, enabled],
  );
  const due = selection?.question ?? null;

  // Opened ONCE, from here — see the header.
  const opening = useRef(new Set<string>());
  useEffect(() => {
    if (!selection?.isNew) return;
    const q = selection.question;
    if (opening.current.has(q.id)) return;
    opening.current.add(q.id);
    void upsertCuriosity(q, now);
  }, [selection, now]);

  const planned = useMemo(
    () =>
      (plannedSession?.exercises ?? []).map((e) =>
        subjectFor({ exerciseId: e.exerciseId, name: e.name, category: e.category, difficulty: e.difficulty }),
      ),
    [plannedSession],
  );

  const logged = useMemo(
    () =>
      sessionHistory
        .filter((s) => s.date === currentDate)
        .flatMap((s) => s.exerciseResults.filter(wasTried))
        .map((r) =>
          subjectFor({ exerciseId: r.exerciseId, name: r.exerciseName, category: r.category, difficulty: r.difficulty }),
        ),
    [sessionHistory, currentDate],
  );

  const brief = useMemo<ExperienceBrief>(
    () => ({ enabled, due: enabled ? due : null, records, planned, logged }),
    [enabled, due, records, planned, logged],
  );

  const chip = enabled && chipVisible(due, now) ? due : null;

  // ── Writing ──

  /** Records this hook created or amended, by id — see `answer`. */
  const written = useRef(new Map<string, ExperienceRecord>());

  /** The live entry for an id — from the log, or the one just selected. */
  const entryById = useCallback(
    (id: string | null): CuriosityEntry | null => {
      if (!id) return null;
      return log.find((e) => e.id === id) ?? (due?.id === id ? due : null);
    },
    [log, due],
  );

  const answer = useCallback<UseCuriosity["answer"]>(
    async (patch, recordId) => {
      const at = new Date();
      const note = patch.note?.trim() ? clipQuote(patch.note) : undefined;

      // Their words go through the same screen as a chat message would. "A
      // rash after the new move" typed into this sheet never reaches the
      // model, so it would otherwise skip the referral entirely.
      const clinical = note ? screenForClinicalRisk(note, bio) : null;
      if (clinical?.kind === "disordered_eating") void recordCareFlag("disordered_eating", at);

      // The copy this hook last wrote wins over the list: the list is re-read
      // AFTER a save announces itself, so a second tap arriving first would
      // not find the record there — and would create a duplicate.
      const existing = recordId ? (written.current.get(recordId) ?? records.find((r) => r.id === recordId)) : undefined;
      const q = due;
      if (!existing && !q) throw new Error("No open question to answer.");

      const base: ExperienceRecord = existing ?? {
        id: `xp_${at.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
        kind: "exercise",
        variantKey: q!.variantKey,
        familyKey: q!.familyKey,
        label: q!.label,
        triedOn: q!.triedOn,
        answeredAt: at.toISOString(),
        source: "asked-chip",
        quote: null,
        soreness: null,
        enjoyed: null,
        feelings: [],
        updatedAt: at.toISOString(),
      };
      const next: ExperienceRecord = {
        ...base,
        ...(patch.soreness !== undefined ? { soreness: patch.soreness } : {}),
        ...(patch.enjoyed !== undefined ? { enjoyed: patch.enjoyed } : {}),
        ...(patch.feelings !== undefined ? { feelings: patch.feelings.slice(0, 2) } : {}),
        ...(note !== undefined ? { quote: note } : {}),
        ...(clinical ? { clinical: clinical.kind } : {}),
        updatedAt: at.toISOString(),
      };
      written.current.set(next.id, next);
      await saveExperience(next, at);
      if (!existing && q) await upsertCuriosity(markAnswered(q, at), at);
      return { id: next.id, clinical };
    },
    [bio, records, due],
  );

  const dismiss = useCallback(async () => {
    if (!due) return;
    const at = new Date();
    await upsertCuriosity(markDismissed(due, at), at);
  }, [due]);

  const stopAsking = useCallback(async () => {
    await consent.set("experience_followups", false);
    setConsentOn(false);
    await dismiss();
  }, [dismiss]);

  const recordTurn = useCallback<UseCuriosity["recordTurn"]>(
    async (c) => {
      if (!c) return;
      const at = new Date();
      const entry = entryById(c.entryId);
      if (entry && c.stage) {
        await upsertCuriosity(afterTurn(entry, { stage: c.stage, asked: c.asked, noted: c.noted }, at), at);
      }
      if (c.recalled.length > 0) await markRecalled(c.recalled, at);
    },
    [entryById],
  );

  const saveNote = useCallback<UseCuriosity["saveNote"]>(
    async (n) => {
      if (!enabled) return { ok: false, reason: "Follow-ups are switched off." };
      const at = new Date();
      const record: ExperienceRecord = {
        id: `xp_${at.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
        kind: "exercise",
        variantKey: n.subject.variantKey,
        familyKey: n.subject.familyKey,
        label: n.subject.label,
        triedOn: n.triedOn,
        answeredAt: at.toISOString(),
        source: n.source,
        quote: clipQuote(n.quote),
        soreness: n.soreness,
        enjoyed: n.enjoyed,
        feelings: [],
        updatedAt: at.toISOString(),
      };
      await saveExperience(record, at);
      if (n.source === "asked-chat" && due) await upsertCuriosity(markAnswered(due, at), at);
      return { ok: true, id: record.id };
    },
    [enabled, due],
  );

  const undo = useCallback(async (id: string) => {
    await forgetExperience(id);
  }, []);

  return { brief, chip, answer, dismiss, stopAsking, recordTurn, saveNote, undo, reload };
}
