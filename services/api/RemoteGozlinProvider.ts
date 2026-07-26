/**
 * RemoteGozlinProvider — wires the Gozlin chat engine's optional LLM seam to the
 * Welliva backend. The deterministic engines remain the source of truth for
 * structured coaching; this only handles open-ended conversational replies.
 *
 * `respond()` already falls back to the deterministic reply if `complete()`
 * throws, so a backend outage degrades gracefully to offline coaching.
 */
import type { GozlinProvider } from "@/services/gozlin";
import { isApiConfigured } from "./config";
import { WellivaApi } from "./WellivaApi";

export const RemoteGozlinProvider: GozlinProvider = {
  isAvailable: () => isApiConfigured,
  complete: async ({ system, user }) => {
    const { reply } = await WellivaApi.coachChat({ system, user });
    return reply;
  },
};
