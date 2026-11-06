/**
 * services/cycle/lifeMoments.ts — the trips and races ./upcoming reads, from the phone.
 *
 * Read straight from storage, not through the health-os barrel, because the
 * Android headless task reaches this through relayCycleReminders and must stay
 * lean (see ./reminders). `CycleContext` and that task call this same function,
 * so the reminder the provider lays and the one the task re-lays can't disagree.
 *
 * Calendar-sourced entries count only while calendar consent stands: switching
 * that off stops them being read here, whatever the store still holds. On a
 * phone with no calendar module there are simply no such entries, and the trips
 * she typed in still work.
 */
import { K } from "../../health-os/platform/storage/keys";
import { isGrantedIn, type ConsentRecord } from "../../health-os/privacy/consent";
import { readJSON } from "../OfflineStorage";
import { momentsFrom, type LifeEventLike, type LifeMoment } from "./upcoming";

/** Never throws: no trips is always a safe answer. */
export async function loadLifeMoments(today: string): Promise<LifeMoment[]> {
  try {
    const [events, record] = await Promise.all([
      readJSON<unknown>(K.LIFECONTEXT, []),
      readJSON<ConsentRecord | null>(K.CONSENT, null),
    ]);
    return momentsFrom(Array.isArray(events) ? (events as LifeEventLike[]) : [], {
      calendarAllowed: record ? isGrantedIn(record, "calendar") : false,
      today,
    });
  } catch {
    return [];
  }
}
