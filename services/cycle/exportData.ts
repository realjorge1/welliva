/**
 * services/cycle/exportData.ts — her data, out, in two shapes.
 *
 *   doctorSummary — a page a clinician can read in thirty seconds: lengths,
 *                   ranges, the symptoms she logged most, and any notes the app
 *                   raised. Plain text so it pastes into anything.
 *   cycleCsv      — everything, one row per period and one per logged day, for
 *                   her records or another app.
 *
 * Both go out through the share sheet, which she controls; nothing here sends
 * anything anywhere on its own.
 */

import { contraceptionForDoctor } from "./contraception";
import { daysBetween, formatDay } from "./dates";
import { liveEpisodes } from "./episodes";
import type { DoctorNote } from "./flags";
import { median, type CycleRecord, type Prediction } from "./predict";
import { RELIEF_NOUN, RELIEF_OPTIONS, reliefRecalls } from "./relief";
import {
  ENERGY_LABEL,
  FLOW_LABEL,
  isEmptyDayLog,
  MOOD_LABEL,
  SYMPTOM_LABEL,
  type CycleData,
  type CycleDayLog,
  type Symptom,
} from "./types";

export function doctorSummary(input: {
  data: CycleData;
  cycles: readonly CycleRecord[];
  prediction: Prediction | null;
  notes: readonly DoctorNote[];
  today: string;
}): string {
  const { data, cycles, prediction, notes, today } = input;
  const live = liveEpisodes(data.periods);
  const lines: string[] = [];
  // On hormonal contraception the bleeds follow the method, and a doctor reads
  // "period" and "cycle length" as claims about her own cycle — so say "bleed".
  const hormonal = data.settings.contraception?.answer === "hormonal";
  const noun = hormonal ? "bleed" : "period";
  lines.push("Cycle summary");
  lines.push(`From the welliva app, ${formatDay(today, { year: true })}. Self-logged, not a medical record.`);
  const method = contraceptionForDoctor(data.settings.contraception);
  if (method) lines.push(method);
  lines.push("");

  if (!live.length) {
    lines.push(`No ${noun}s logged yet.`);
    return lines.join("\n");
  }
  lines.push(
    `Logged since ${formatDay(live[0].start, { year: true })}: ${live.length} ${noun}${live.length === 1 ? "" : "s"}.`,
  );
  lines.push(`Last ${noun} started: ${formatDay(live[live.length - 1].start, { year: true })}.`);

  const counted = cycles.filter((c) => c.status === "counted").slice(-6);
  if (counted.length) {
    const lengths = counted.map((c) => c.length);
    lines.push("");
    lines.push(
      `${hormonal ? "Days between bleeds" : "Cycle length"} (start to start), last ${lengths.length}: ${lengths.join(", ")} days.`,
    );
    lines.push(
      `Median ${median(lengths)} days; range ${Math.min(...lengths)}–${Math.max(...lengths)} days.`,
    );
  }
  const skipped = cycles.filter((c) => c.status === "gap" || c.status === "pause");
  if (skipped.length) {
    lines.push(
      `Not counted: ${skipped
        .map((c) => `${formatDay(c.start, { year: true })} (${c.length} days, ${c.status === "pause" ? "a pause" : "possible missed log"})`)
        .join("; ")}.`,
    );
  }

  const bleeds = live
    .filter((e) => e.end && !e.endEstimated)
    .slice(-6)
    .map((e) => daysBetween(e.start, e.end as string) + 1);
  if (bleeds.length) {
    lines.push(`${hormonal ? "Bleed" : "Period"} length, last ${bleeds.length}: ${bleeds.join(", ")} days.`);
  }

  if (prediction) {
    // Its basis, so the window is read as the estimate it is.
    const basis =
      prediction.basedOn > 0
        ? `from ${prediction.basedOn} logged cycle${prediction.basedOn === 1 ? "" : "s"}`
        : data.settings.usualCycleDays
          ? "from the usual length entered at setup"
          : "from a typical cycle length, before any logged cycles";
    lines.push(
      `Next period estimated: ${formatDay(prediction.earliest)} to ${formatDay(prediction.latest)}, ${basis}.`,
    );
  }

  const symptomDays = new Map<Symptom, number>();
  let heavyDays = 0;
  for (const log of Object.values(data.days)) {
    if (log.flow === "heavy") heavyDays += 1;
    for (const s of log.symptoms ?? []) symptomDays.set(s, (symptomDays.get(s) ?? 0) + 1);
  }
  const top = [...symptomDays.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length || heavyDays) {
    lines.push("");
    const parts = top.map(([s, n]) => `${SYMPTOM_LABEL[s].toLowerCase()} (${n} day${n === 1 ? "" : "s"})`);
    if (heavyDays) parts.push(`heavy flow (${heavyDays} day${heavyDays === 1 ? "" : "s"})`);
    lines.push(`Most logged: ${parts.join(", ")}.`);
  }

  // Only answers that met the standard (./relief): what a clinician asks next.
  const helped = reliefRecalls(data.days);
  if (helped.length) {
    lines.push(`What helped most, as answered in the app: ${helped.map((r) => r.fact).join("; ")}.`);
  }

  if (notes.length) {
    lines.push("");
    lines.push("Noted by the app:");
    for (const n of notes) lines.push(`- ${n.body}`);
  }
  return lines.join("\n");
}

const RELIEF_WORD = Object.fromEntries(RELIEF_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]));

/** "what helped: cramps: heat" — her answers on this day, a skipped question included (it is stored, so it is exported). */
function reliefDetail(log: CycleDayLog): string {
  const answers = log.relief ?? [];
  if (!answers.length) return "";
  const said = answers.map(
    (r) => `${RELIEF_NOUN[r.symptom]}: ${r.helped === "skipped" ? "skipped" : RELIEF_WORD[r.helped]}`,
  );
  return `what helped: ${said.join("; ")}`;
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const CONTRACEPTION_CSV = {
  hormonal: "hormonal contraception: yes",
  none: "hormonal contraception: no",
  unsaid: "hormonal contraception: prefer not to say",
} as const;

export function cycleCsv(data: CycleData): string {
  const rows: string[] = ["type,date,end,flow,symptoms,mood,energy,ovulation_test,detail"];
  const c = data.settings.contraception;
  if (c) {
    const detail = c.restartFrom
      ? `${CONTRACEPTION_CSV[c.answer]}; cycles count from ${c.restartFrom}`
      : CONTRACEPTION_CSV[c.answer];
    rows.push(["contraception", c.since, "", "", "", "", "", "", detail].map(csvCell).join(","));
  }
  const s = data.settings;
  if (s.planHungryWeek) {
    rows.push(["hungrier_week_plan", s.hungryPlanFrom ?? "", "", "", "", "", "", "", "on"].map(csvCell).join(","));
  }
  for (const date of Object.keys(s.hungryLedger).sort()) {
    const kcal = s.hungryLedger[date];
    const change = `calorie target ${kcal > 0 ? "+" : ""}${kcal} kcal`;
    rows.push(["target_change", date, "", "", "", "", "", "", change].map(csvCell).join(","));
  }
  for (const e of liveEpisodes(data.periods)) {
    rows.push(["period", e.start, e.end ?? "", "", "", "", "", "", ""].map(csvCell).join(","));
  }
  for (const date of Object.keys(data.days).sort()) {
    const log = data.days[date];
    if (isEmptyDayLog(log)) continue;
    rows.push(
      [
        "day",
        date,
        "",
        log.flow ? FLOW_LABEL[log.flow] : "",
        (log.symptoms ?? []).map((s) => SYMPTOM_LABEL[s]).join("; "),
        log.mood ? MOOD_LABEL[log.mood] : "",
        log.energy ? ENERGY_LABEL[log.energy] : "",
        log.ovulationTest ?? "",
        reliefDetail(log),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return rows.join("\n");
}
