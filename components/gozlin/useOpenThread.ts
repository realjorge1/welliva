/**
 * useOpenThread — "you left one hanging", as a fact rather than a feeling.
 *
 * Reads the persisted coach conversation and asks `findOpenThread` whether it
 * is genuinely mid-exchange (see services/gozlin/conversationTitle for the
 * definition — it is deliberately narrow). The Action Bar turns the answer into
 * its "come back to this" rung.
 *
 * ── WHAT IT RE-READS, AND WHEN ──────────────────────────────────────────────
 *
 * On mount, on every navigation, and on the caller's own tick. Those are the
 * three ways the answer can change:
 *
 *   · NAVIGATION is the important one. Walking off the coach screen is the
 *     exact moment a thread becomes something you left, and the bar on the
 *     screen you land on is the thing that has to know.
 *   · THE TICK covers the age window. A thread is not offered for its first two
 *     minutes and stops being offered after thirty-six hours, so the answer
 *     changes on the clock with no user action at all. The caller passes its
 *     own minute counter, so this costs one small read a minute and never
 *     invents a timer of its own.
 *   · MOUNT covers a cold start, which is the case the whole rung was built
 *     for: the app was killed mid-answer and reopened somewhere else.
 *
 * ── THE SEED IS HELD, NOT REROLLED ──────────────────────────────────────────
 *
 * The bar's phrasing varies, and it varies PER THREAD-MOMENT, not per read. A
 * label that reshuffles itself every sixty seconds while you look at it is not
 * "unpredictable", it is broken. So the draw is kept against the thread's last
 * timestamp and only replaced when the conversation itself has moved on.
 *
 * And the returned object is identity-stable while nothing has changed, because
 * it feeds a `useMemo` that resolves the whole ladder — a fresh object every
 * minute would re-derive the bar on every screen for no reason.
 */

import { findOpenThread, loadConversation } from "@/services/gozlin";
import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";

/** What the Action Bar needs: the topic to name, and a seed for the phrasing. */
export interface OpenThreadCue {
  topic: string;
  nudgeSeed: number;
}

export function useOpenThread(tick: number): OpenThreadCue | null {
  const [cue, setCue] = useState<OpenThreadCue | null>(null);
  /** The phrasing draw, held against the thread moment it was made for. */
  const seed = useRef<{ at: number; value: number } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    void loadConversation()
      .then((messages) => {
        if (!alive) return;
        const open = findOpenThread(messages);
        if (!open) {
          seed.current = null;
          setCue(null);
          return;
        }
        if (!seed.current || seed.current.at !== open.lastAt) {
          seed.current = { at: open.lastAt, value: Math.floor(Math.random() * 1e6) };
        }
        const value = seed.current.value;
        setCue((prev) =>
          prev && prev.topic === open.topic && prev.nudgeSeed === value
            ? prev
            : { topic: open.topic, nudgeSeed: value },
        );
      })
      .catch(() => {
        // A conversation we cannot read is a conversation we do not nudge about.
      });
    return () => {
      alive = false;
    };
  }, [tick, pathname]);

  return cue;
}
