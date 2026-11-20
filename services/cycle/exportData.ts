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
import { splitEpisodes } from "./episodes";
import type { DoctorNote } from "./flags";
import { median, type CycleRecord, type Prediction } from "./predict";
import { RELIEF_NOUN, RELIEF_OPTIONS, reliefRecalls } from "./relief";
import {
  DISCHARGE_LABEL,
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
  // Periods only; a stray is bleeding between periods and is listed as that (./episodes).
  const { periods: live, strays } = splitEpisodes(data.periods);
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
  if (strays.length) {
    lines.push(
      `Bleeding logged between ${noun}s, starting: ${strays.map((s) => formatDay(s.start, { year: true })).join(", ")}.`,
    );
  }

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
    // Late: the window that was given, and how far past it — never a rolling date.
    lines.push(
      prediction.overdue
        ? `Next period was estimated for ${formatDay(prediction.overdue.original.earliest)} to ${formatDay(
            prediction.overdue.original.latest,
          )}, ${basis}; ${prediction.overdue.days} day${prediction.overdue.days === 1 ? "" : "s"} past that, not started yet.`
        : `Next period estimated: ${formatDay(prediction.earliest)} to ${formatDay(prediction.latest)}, ${basis}.`,
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
  // Whether pain stops a normal day is the first thing a clinician asks about cramps.
  const stoppedDays = Object.values(data.days).filter(
    (log) => log.stoppedDay && log.symptoms?.includes("cramps"),
  ).length;
  if (stoppedDays) lines.push(`Days cramps stopped school, work or plans: ${stoppedDays}.`);

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

/**
 * The columns. New ones go on the END, so a sheet she made from an older
 * export still lines up: `kept_from_day` ("Kept me from school, work or
 * plans", ticked under Cramps) and `discharge` (fertile-window users only)
 * joined on 2026-11-13; `bleeding_answer` (her "No, bleeding between periods",
 * on the first day of the bleeding it answers) and `temperature_c` (resting
 * temperature on waking, always in °C) on 2026-11-20.
 */
export const CSV_COLUMNS = [
  "type",
  "date",
  "end",
  "flow",
  "symptoms",
  "mood",
  "energy",
  "ovulation_test",
  "detail",
  "kept_from_day",
  "discharge",
  "bleeding_answer",
  "temperature_c",
] as const;

/** One row, padded to every column, so a row that has nothing to say in the new ones still lines up. */
function csvRow(cells: string[]): string {
  const full = [...cells];
  while (full.length < CSV_COLUMNS.length) full.push("");
  return full.map(csvCell).join(",");
}

export function cycleCsv(data: CycleData): string {
  const rows: string[] = [CSV_COLUMNS.join(",")];
  const c = data.settings.contraception;
  if (c) {
    const method =
      c.method === "combined_pill"
        ? `; combined pill, ${c.packDays ?? 28}-day pack`
        : c.method === "other"
          ? "; another method"
          : "";
    const detail = c.restartFrom
      ? `${CONTRACEPTION_CSV[c.answer]}${method}; cycles count from ${c.restartFrom}`
      : `${CONTRACEPTION_CSV[c.answer]}${method}`;
    rows.push(csvRow(["contraception", c.since, "", "", "", "", "", "", detail]));
  }
  const s = data.settings;
  if (s.planHungryWeek) {
    rows.push(csvRow(["hungrier_week_plan", s.hungryPlanFrom ?? "", "", "", "", "", "", "", "on"]));
  }
  for (const date of Object.keys(s.hungryLedger).sort()) {
    const kcal = s.hungryLedger[date];
    const change = `calorie target ${kcal > 0 ? "+" : ""}${kcal} kcal`;
    rows.push(csvRow(["target_change", date, "", "", "", "", "", "", change]));
  }
  const split = splitEpisodes(data.periods);
  for (const e of split.periods) {
    rows.push(csvRow(["period", e.start, e.end ?? ""]));
  }
  // Episodes that started too soon after a period to be the next one (./episodes).
  for (const e of split.strays) {
    rows.push(csvRow(["bleeding_between", e.start, e.end ?? ""]));
  }
  for (const date of Object.keys(data.days).sort()) {
    const log = data.days[date];
    if (isEmptyDayLog(log)) continue;
    rows.push(
      csvRow([
        "day",
        date,
        "",
        log.flow ? FLOW_LABEL[log.flow] : "",
        (log.symptoms ?? []).map((s) => SYMPTOM_LABEL[s]).join("; "),
        log.mood ? MOOD_LABEL[log.mood] : "",
        log.energy ? ENERGY_LABEL[log.energy] : "",
        log.ovulationTest ?? "",
        reliefDetail(log),
        log.stoppedDay ? "yes" : "",
        log.discharge ? DISCHARGE_LABEL[log.discharge] : "",
        log.bleedAnswer === "between" ? "not a period" : "",
        log.temperatureC !== undefined ? log.temperatureC.toFixed(2) : "",
      ]),
    );
  }
  return rows.join("\n");
}
