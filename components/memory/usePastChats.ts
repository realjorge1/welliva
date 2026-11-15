/**
 * What Gozlin may bring up from earlier conversations, for the Memory screen.
 *
 * The same derivation the coach reads (services/gozlin/pastChats.ts), over the
 * same stores, so the list here is exactly what Gozlin can remember: nothing
 * more, nothing less. Forgetting a row stops Gozlin bringing that chat up; the
 * chat itself stays in the history, where deleting it removes this too.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadExperiences, subscribeExperiences } from "@/services/gozlin/ExperienceStore";
import { loadArchive, loadIdentity } from "@/services/gozlin/GozlinMemoryStore";
import {
  derivePastChats,
  forgetPastChat,
  loadForgottenPastChats,
  subscribePastChats,
  type PastChat,
} from "@/services/gozlin/pastChats";

export interface UsePastChats {
  chats: PastChat[];
  forget: (id: string) => Promise<void>;
}

export function usePastChats(): UsePastChats {
  const [chats, setChats] = useState<PastChat[]>([]);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const [archive, experiences, identity, forgotten] = await Promise.all([
        loadArchive(),
        loadExperiences(),
        loadIdentity(),
        loadForgottenPastChats(),
      ]);
      if (alive.current) setChats(derivePastChats({ archive, experiences, identity, forgotten }));
    } catch (e) {
      console.log("[memory] could not read past chats", e);
    }
  }, []);

  // The chat history changes on the Gozlin screen, so re-read on every visit.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    alive.current = true;
    const offChats = subscribePastChats(() => void reload());
    const offNotes = subscribeExperiences(() => void reload());
    return () => {
      alive.current = false;
      offChats();
      offNotes();
    };
  }, [reload]);

  const forget = useCallback(async (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    try {
      await forgetPastChat(id);
    } catch (e) {
      console.log("[memory] could not forget a past chat", e);
      void reload();
    }
  }, [reload]);

  return { chats, forget };
}
