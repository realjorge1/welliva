/**
 * health-os/modules/builtins.ts — register the companion's modules.
 *
 * The composition root: it wires each shipped capability into the registry through the
 * HealthModule slots. Importing the concrete sources here (and nowhere else) keeps the
 * domains decoupled — every other consumer reads them generically off the registry.
 *
 * Registering these is what makes "a new health module without redesigning the core"
 * literally true: a future module (sleep coaching, glucose, mental-health) adds one
 * `register(...)` call with its own event types, consent, and senses — no rewrite.
 */
import { mealPhotoSource, speechSource } from "../multimodal";
import { notificationScheduler } from "../notifications";
import { calendarSource, weatherSource, wearableSource } from "../signals";
import { moduleRegistry } from "./registry";

let registered = false;

/** Register the built-in companion modules once (idempotent). */
export function registerBuiltInModules(): void {
  if (registered) return;
  registered = true;

  moduleRegistry
    .register({
      id: "lifecontext",
      title: "Life Context",
      description: "Forward-dated, auto-expiring events that bend coaching before they arrive.",
      eventTypes: ["life.added", "life.resolved"],
    })
    .register({
      id: "signals",
      title: "Senses",
      description: "External signals: calendar, weather, and wearable metrics.",
      consent: ["calendar", "location_weather", "wearable"],
      signalSources: [
        { id: "calendar", label: "Calendar", consent: "calendar", getStatus: () => calendarSource.getStatus() },
        { id: "weather", label: "Weather", consent: "location_weather", getStatus: () => weatherSource.getStatus() },
        { id: "wearable", label: "Wearable", consent: "wearable", getStatus: () => wearableSource.getStatus() },
      ],
    })
    .register({
      id: "notifications",
      title: "Proactive delivery",
      description: "Out-of-app briefings + anticipation alerts under an attention budget.",
      consent: ["proactive_notifications"],
      producesNotifications: true,
      signalSources: [
        {
          id: "notifications",
          label: "Notifications",
          consent: "proactive_notifications",
          getStatus: () => notificationScheduler.getStatus(),
        },
      ],
    })
    .register({
      id: "story",
      title: "Storytelling",
      description: "Long-horizon recaps: year, anniversary, five-year, documentary.",
      producesNotifications: true,
    })
    .register({
      id: "multimodal",
      title: "Multimodal logging",
      description: "Photo meal analysis + voice capture (confirm before commit).",
      consent: ["photo", "voice"],
      signalSources: [
        { id: "photo", label: "Meal photos", consent: "photo", getStatus: () => mealPhotoSource.getStatus() },
        { id: "voice", label: "Voice", consent: "voice", getStatus: () => speechSource.getStatus() },
      ],
    });
}
