/**
 * health-os/privacy — consent + the data boundary.
 *
 * The companion-phase subset of the privacy domain (docs/architecture/09): the
 * per-integration consent categories every sense and the notification reach are gated by.
 * Full M3 (encryption, export, erase, AI-boundary lint) lands with that milestone; this
 * is the consent spine the Proactive Companion needs now.
 *
 * See docs/companion/00-proactive-companion-blueprint.md §6.
 */
export * from "./consent";
export { ConsentRepository, consent } from "./ConsentRepository";
