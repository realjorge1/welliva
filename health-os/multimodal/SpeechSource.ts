/**
 * health-os/multimodal/SpeechSource.ts
 *
 * The voice capture path: listen (SpeechProvider seam) → speech-to-text → normalized,
 * routed `VoiceCapture`. Voice is an INPUT modality only — it feeds the EXISTING chat /
 * log-extract pipeline; it never adds parallel logic. Consent-gated on "voice"; degrades
 * to a safe no-op when no provider is registered.
 *
 * The default provider is null so this builds today; a real STT provider
 * (`@react-native-voice/voice` or platform STT) is the EAS-build cutover.
 * See docs/companion/00-proactive-companion-blueprint.md §4 (P5).
 */
import { consent as defaultConsent, type ConsentRepository } from "../privacy";
import type { SignalStatus } from "../signals/types";
import { toVoiceCapture } from "./voice";
import type { VoiceCapture } from "./types";

/** Device speech-to-text. A platform/library STT adapter implements this. */
export interface SpeechProvider {
  getStatus(): Promise<SignalStatus>;
  requestAccess(): Promise<SignalStatus>;
  /** Listen once and return the raw transcript, or null if nothing was heard. */
  listen(): Promise<string | null>;
}

export const nullSpeechProvider: SpeechProvider = {
  getStatus: async () => ({ permission: "unavailable", ready: false }),
  requestAccess: async () => ({ permission: "unavailable", ready: false }),
  listen: async () => null,
};

export class SpeechSource {
  constructor(
    private readonly provider: SpeechProvider = nullSpeechProvider,
    private readonly consent: ConsentRepository = defaultConsent,
  ) {}

  getStatus(): Promise<SignalStatus> {
    return this.provider.getStatus();
  }

  async requestAccess(): Promise<SignalStatus> {
    await this.consent.grant("voice");
    return this.provider.requestAccess();
  }

  /**
   * Capture one utterance as a routed VoiceCapture. Returns null when consent is absent,
   * the provider is unavailable, or nothing was transcribed — never throws.
   */
  async capture(): Promise<VoiceCapture | null> {
    if (!(await this.consent.isGranted("voice"))) return null;
    try {
      const status = await this.provider.getStatus();
      if (!status.ready) return null;
      const raw = await this.provider.listen();
      if (!raw || !raw.trim()) return null;
      return toVoiceCapture(raw);
    } catch {
      return null;
    }
  }
}

/** The default, app-wide speech source (real provider registered in the dev build). */
export const speechSource = new SpeechSource();
