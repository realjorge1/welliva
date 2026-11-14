/**
 * services/export/names.ts — the file's name, and how a saved file or folder is named back to people.
 * Pure, so the tests can reach it without the native file system.
 */

/** "welliva-data-2026-11-14.docx" — lowercase brand, the day it was made. */
export function exportFileName(today: string): string {
  return `welliva-data-${today}.docx`;
}

/**
 * The last part of a file or folder address, as a person knows it. Android
 * hands back content addresses: a folder ends "tree/primary%3ADownload" (that
 * reads "Download"), a file ends "document/primary%3ADownload%2Fname.docx"
 * (that reads "name.docx", including any "(1)" Android added to avoid a clash).
 */
export function displayName(address: string): string {
  let s = address;
  try {
    s = decodeURIComponent(address);
  } catch {
    // keep it as it came
  }
  const parts = s.split(/[:/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
