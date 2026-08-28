/**
 * RemoteGozlinProvider — the app's bridge to the backend coach.
 *
 * Two seams live here:
 *
 *   coachTransport   the agent loop's pipe (services/gozlin/agent). This is the
 *                    primary path: the model picks tools, the tools run on this
 *                    device, and this only carries messages up and down.
 *
 *   RemoteGozlinProvider  the legacy single-shot completion seam used by
 *                    GozlinChatEngine.respond(). Kept for callers that haven't
 *                    moved to the agent loop.
 *
 * Neither is load-bearing. `runAgentTurn` and `respond()` both fall back to the
 * deterministic engines on any error, so a backend outage degrades to offline
 * coaching rather than a broken screen.
 */
import type { CoachTransport } from "@/services/gozlin/agent";
import type { GozlinProvider } from "@/services/gozlin";
import { isApiConfigured } from "./config";
import { WellivaApi } from "./WellivaApi";

/**
 * Which build of the prompt/tool contract this app was compiled against. The
 * backend logs a warning when it doesn't match its own, so drift between the
 * two copies of the system prompt surfaces instead of silently changing how the
 * coach behaves. Bump alongside services/gozlin/agent/context.ts.
 */
export const GOZLIN_PROMPT_VERSION = "2026-07-26.1";

/**
 * The agent-loop transport, or null when no backend is configured — the loop
 * reads null as "go deterministic" and never touches the network.
 */
export const coachTransport: CoachTransport | null = isApiConfigured
  ? async ({ messages, signal, onDelta, mode }) => {
      const res = await WellivaApi.coachTurn({
        messages,
        promptVersion: GOZLIN_PROMPT_VERSION,
        mode,
        onDelta,
        signal,
      });
      return {
        content: res.content as never[],
        stop_reason: res.stop_reason,
        model: res.model,
      };
    }
  : null;

export const RemoteGozlinProvider: GozlinProvider = {
  isAvailable: () => isApiConfigured,
  complete: async ({ system, user }) => {
    const { reply } = await WellivaApi.coachChat({ system, user });
    return reply;
  },
};
