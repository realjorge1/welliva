/**
 * upload-catalogs.mjs — publish the runtime catalogs to Supabase Storage (D.4).
 *
 * Uploads the JSON built by scripts/build-diet-dictionary.mjs (in catalogs-dist/)
 * to the PUBLIC `catalogs` bucket, so the app fetches + caches them instead of
 * shipping ~1 MB in the binary.
 *
 * Prereqs:
 *   1. Apply the bucket migration:  supabase db push
 *      (creates the `catalogs` bucket — supabase/migrations/*_catalogs_bucket.sql)
 *   2. Build the JSON:              node scripts/build-diet-dictionary.mjs
 *   3. Set env (do NOT commit the service-role key):
 *        EXPO_PUBLIC_SUPABASE_URL     your project URL
 *        SUPABASE_SERVICE_ROLE_KEY    service-role key (Settings → API)
 *
 * Run:
 *   node scripts/upload-catalogs.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "catalogs-dist");
const BUCKET = "catalogs";
const FILES = ["diet_library.json", "food_dictionary.json", "manifest.json"];

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing env. Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  for (const file of FILES) {
    let body;
    try {
      body = readFileSync(join(DIST, file));
    } catch {
      console.error(
        `Missing ${file} in catalogs-dist/. Run: node scripts/build-diet-dictionary.mjs`,
      );
      process.exit(1);
    }
    const { error } = await supabase.storage.from(BUCKET).upload(file, body, {
      contentType: "application/json",
      upsert: true,
    });
    if (error) {
      console.error(`Upload ${file} failed:`, error.message);
      process.exit(1);
    }
    console.log(`✓ uploaded ${file} (${(body.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`Done. ${FILES.length} files → ${BUCKET} bucket.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
