/**
 * health-os/modules/registry.ts — the module registry.
 *
 * Collects registered HealthModules and exposes uniform lookups: every introduced event
 * type, every consent category in play, and every external sense with its live status.
 * This is the composition seam — the one place allowed to know the concrete modules — so
 * the rest of the app reads capabilities generically instead of hard-coding each one.
 */
import type { ConsentCategory } from "../privacy";
import type { HealthModule, ModuleSignalStatus, SignalSourceRef } from "./types";

export class HealthModuleRegistry {
  private modules = new Map<string, HealthModule>();

  /** Register (or replace) a module by id. Returns the registry for chaining. */
  register(module: HealthModule): this {
    this.modules.set(module.id, module);
    return this;
  }

  get(id: string): HealthModule | undefined {
    return this.modules.get(id);
  }

  all(): HealthModule[] {
    return [...this.modules.values()];
  }

  /** Every external sense across all modules. */
  signalSources(): SignalSourceRef[] {
    return this.all().flatMap((m) => m.signalSources ?? []);
  }

  /** Every consent category any registered module depends on (de-duplicated). */
  consentCategories(): ConsentCategory[] {
    const set = new Set<ConsentCategory>();
    for (const m of this.all()) for (const c of m.consent ?? []) set.add(c);
    return [...set];
  }

  /** Every Timeline event type introduced by a module (de-duplicated). */
  eventTypes(): string[] {
    const set = new Set<string>();
    for (const m of this.all()) for (const t of m.eventTypes ?? []) set.add(t);
    return [...set];
  }

  /** Modules that emit proactive notification candidates. */
  notificationProducers(): HealthModule[] {
    return this.all().filter((m) => m.producesNotifications);
  }

  /** Resolve the live status of every registered sense (consent + permission). */
  async statuses(): Promise<ModuleSignalStatus[]> {
    const out: ModuleSignalStatus[] = [];
    for (const m of this.all()) {
      for (const s of m.signalSources ?? []) {
        out.push({
          moduleId: m.id,
          sourceId: s.id,
          label: s.label,
          consent: s.consent,
          status: await s.getStatus(),
        });
      }
    }
    return out;
  }
}

/** The default, app-wide module registry (built-ins registered in ./builtins). */
export const moduleRegistry = new HealthModuleRegistry();
