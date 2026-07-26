/**
 * health-os/platform — the foundation layer (storage port, clock, id, migrations).
 * Imports nothing from any domain (docs/architecture/01-domain-architecture.md §4).
 */
export * from "./clock";
export * from "./id";
export type { KeyValueStore } from "./storage/KeyValueStore";
export { AsyncStorageAdapter, store } from "./storage/AsyncStorageAdapter";
export { K, LEGACY } from "./storage/keys";
export * from "./migrations";
