/**
 * health-os — the Personal Health OS domain layer.
 *
 * Public API barrel. Consumers (contexts/, app/) import from "@/health-os".
 * Architecture: docs/architecture/.
 *
 * Shipped so far: platform (storage port, clock, id, migration runner) + timeline
 * (event store) + memory (L2 summaries + compaction, L3 long-term facts). Context /
 * Insights / Profile / Goals / Preferences / Privacy land in subsequent milestones
 * (docs/architecture/12-implementation-roadmap.md).
 */
export * from "./platform";
export * from "./timeline";
export * from "./memory";
export * from "./lifecontext";
export * from "./signals";
export * from "./privacy";
export * from "./notifications";
export * from "./multimodal";
export * from "./modules";
