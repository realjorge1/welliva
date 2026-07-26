/**
 * health-os/privacy/ConsentRepository.ts
 *
 * The ONLY code that reads/writes the consent record. A thin, storage-backed wrapper over
 * the pure helpers in `consent.ts`. Every external sense (Signals) and the notification
 * reach asks `isGranted(category)` before it touches a native API or the network — so
 * consent is enforced in one place, and a denied category degrades to a safe no-op.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §6, docs/architecture/09 §2.
 */
import { store as defaultStore } from "../platform/storage/AsyncStorageAdapter";
import { K } from "../platform/storage/keys";
import type { KeyValueStore } from "../platform/storage/KeyValueStore";
import {
  CONSENT_CATEGORY_META,
  defaultConsent,
  grantedIntegrations,
  isGrantedIn,
  needsReconsent,
  reconcile,
  withDecision,
  type ConsentCategory,
  type ConsentRecord,
} from "./consent";

export class ConsentRepository {
  constructor(private readonly store: KeyValueStore = defaultStore) {}

  /** The current record (defaults on first read; forward-compat reconciled). */
  async get(now: Date = new Date()): Promise<ConsentRecord> {
    const stored = await this.store.get<ConsentRecord | null>(K.CONSENT, null);
    if (!stored || !stored.decisions) {
      const fresh = defaultConsent(now);
      await this.store.set(K.CONSENT, fresh);
      return fresh;
    }
    const reconciled = reconcile(stored, now);
    if (reconciled !== stored) await this.store.set(K.CONSENT, reconciled);
    return reconciled;
  }

  /** Is `category` granted? The single gate every integration calls before a native read. */
  async isGranted(category: ConsentCategory): Promise<boolean> {
    return isGrantedIn(await this.get(), category);
  }

  /** Flip one category. Returns the updated record. */
  async set(
    category: ConsentCategory,
    granted: boolean,
    now: Date = new Date(),
  ): Promise<ConsentRecord> {
    if (CONSENT_CATEGORY_META[category].group === "core" && category === "local_processing") {
      // local_processing is the non-optional baseline — never stored as denied.
      granted = true;
    }
    const current = await this.get(now);
    const next = withDecision(current, category, granted, now);
    await this.store.set(K.CONSENT, next);
    return next;
  }

  grant(category: ConsentCategory, now: Date = new Date()): Promise<ConsentRecord> {
    return this.set(category, true, now);
  }

  revoke(category: ConsentCategory, now: Date = new Date()): Promise<ConsentRecord> {
    return this.set(category, false, now);
  }

  /** Whether the policy version moved on and the user should re-confirm. */
  async needsReconsent(): Promise<boolean> {
    return needsReconsent(await this.get());
  }

  /** Switched-on integrations (for the "what Gozlin is watching" surface). */
  async grantedIntegrations(): Promise<ConsentCategory[]> {
    return grantedIntegrations(await this.get());
  }

  /** Reset every decision to defaults (part of the "forget everything" hook). */
  async reset(now: Date = new Date()): Promise<void> {
    await this.store.set(K.CONSENT, defaultConsent(now));
  }
}

/** The default, app-wide consent repository. */
export const consent = new ConsentRepository();
