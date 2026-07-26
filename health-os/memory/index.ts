/**
 * health-os/memory — the four-layer memory.
 *
 * L1 (Event History) is the Timeline; this module owns L2 (Summaries) + L3 (Long-Term
 * facts, re-homed from the Gozlin store) and the compaction pipeline between them.
 * L4 (Temporary Context) stays in-memory / the live contexts.
 *
 * See docs/architecture/03-memory-architecture.md.
 */
export * from "./layers";
export * from "./compaction";
export { SummaryStore, summaries } from "./SummaryStore";
export { MemoryRepository, memory } from "./MemoryRepository";
export { LongTermStore } from "./LongTermStore";
export type {
  IdentityFacts,
  LearnedPattern,
  LongTermSnapshot,
  Milestone,
} from "./LongTermStore";
