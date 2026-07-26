/**
 * health-os/lifecontext — the forward-time domain.
 *
 * Future-dated, auto-expiring, user-controlled life events (weddings, surgery, exams,
 * travel, medication courses) that bend coaching before they arrive. The keystone the
 * Anticipation engine + Coaching Modes (P1) read. See
 * docs/companion/00-proactive-companion-blueprint.md §3.1.
 */
export * from "./lifecontext.types";
export {
  LifeContextRepository,
  lifeContext,
  type LifeEventInput,
  type ListOptions,
} from "./LifeContextRepository";
