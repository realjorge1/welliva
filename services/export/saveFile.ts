/**
 * services/export/saveFile.ts — save a file where the person chooses.
 *
 * The phone's own folder picker opens (Android's "Files" picker, iOS's Files
 * app), the person picks a folder, and the file is written there. Nothing is
 * shared, uploaded or kept anywhere else.
 *
 * It uses expo-file-system's `Directory.pickDirectoryAsync`, which works on
 * both platforms. expo-file-system ships inside every welliva build (the
 * `expo` package depends on it), so no new build is needed. It is still loaded
 * through `requireOptionalNativeModule` first, the way lib/deviceUnlock loads
 * its modules: a build without it gets "unavailable", never a crash at import.
 */
import { requireOptionalNativeModule } from "expo";
import type * as FileSystemTypes from "expo-file-system";
import { displayName } from "./names";

type FileSystemModule = typeof FileSystemTypes;

let fs: FileSystemModule | null | undefined;

function loadFileSystem(): FileSystemModule | null {
  if (fs === undefined) {
    try {
      fs = requireOptionalNativeModule("FileSystem")
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require("expo-file-system") as FileSystemModule)
        : null;
    } catch (e) {
      console.log("[export] file system unavailable", e);
      fs = null;
    }
  }
  return fs;
}

/** Whether this build can save a file to a chosen folder at all. */
export function canSaveToFolder(): boolean {
  return loadFileSystem() !== null;
}

export type SaveOutcome =
  | { outcome: "saved"; folder: string; name: string }
  | { outcome: "cancelled" }
  | { outcome: "unavailable" }
  | { outcome: "failed"; error: string };

function isCancel(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return /cancel/i.test(`${err?.code ?? ""} ${err?.message ?? ""}`);
}

/** Ask for a folder, then write `bytes` there as `name`. Never throws. */
export async function saveToChosenFolder(name: string, mimeType: string, bytes: Uint8Array): Promise<SaveOutcome> {
  const m = loadFileSystem();
  if (!m) return { outcome: "unavailable" };
  let dir: Awaited<ReturnType<FileSystemModule["Directory"]["pickDirectoryAsync"]>>;
  try {
    dir = await m.Directory.pickDirectoryAsync();
  } catch (e) {
    if (isCancel(e)) return { outcome: "cancelled" };
    console.log("[export] folder picker failed", e);
    return { outcome: "failed", error: String((e as Error)?.message ?? e) };
  }
  try {
    const file = dir.createFile(name, mimeType);
    file.write(bytes);
    return { outcome: "saved", folder: displayName(dir.uri), name: displayName(file.uri) || name };
  } catch (e) {
    console.log("[export] could not write the file", e);
    return { outcome: "failed", error: String((e as Error)?.message ?? e) };
  }
}
