#!/usr/bin/env node
/**
 * a11y-report.js — per-file breakdown of the accessibility ratchet.
 *
 * Usage:  npx eslint . -f json | node scripts/a11y-report.js
 *
 * Reads an ESLint JSON report on stdin and prints the files with unlabelled
 * touchables, worst first — the burn-down order for docs/accessibility.md.
 */

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    console.error("Expected an ESLint JSON report on stdin.");
    console.error("Usage: npx eslint . -f json | node scripts/a11y-report.js");
    process.exit(1);
  }

  const perFile = {};
  let total = 0;

  for (const file of report) {
    for (const msg of file.messages) {
      if (msg.ruleId && msg.ruleId.endsWith("has-accessible-name")) {
        const key = file.filePath.replace(/^.*[\\/]welliva[\\/]/, "");
        perFile[key] = (perFile[key] || 0) + 1;
        total++;
      }
    }
  }

  const rows = Object.entries(perFile).sort((a, b) => b[1] - a[1]);
  for (const [file, count] of rows) {
    console.log(String(count).padStart(4), file);
  }

  console.log(`\n${total} unlabelled touchables across ${rows.length} files.`);
  if (total === 0) {
    console.log("Zero. Promote welliva/has-accessible-name to 'error'.");
  }
});
