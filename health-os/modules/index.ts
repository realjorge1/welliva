/**
 * health-os/modules — the HealthModule plugin contract + registry (blueprint §5).
 *
 * Formalizes how capabilities register with the core. The built-ins are registered on
 * first import of this barrel, so consumers just read the registry. Future modules add a
 * single `register(...)` — no core changes.
 */
import { registerBuiltInModules } from "./builtins";

export * from "./types";
export { HealthModuleRegistry, moduleRegistry } from "./registry";
export { registerBuiltInModules } from "./builtins";

// Register the built-in companion modules on import (idempotent).
registerBuiltInModules();
