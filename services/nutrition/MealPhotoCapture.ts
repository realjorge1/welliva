/**
 * MEAL PHOTO CAPTURE — photograph a plate, get the same log you'd have typed.
 *
 * THE ONE DESIGN DECISION HERE
 *
 * A photo does not get its own logging pipeline. It gets turned into the SAME
 * free-text line a user would have typed ("2 slices of bread and a boiled egg")
 * and handed to the existing analyzer. Everything downstream — the USDA / FAO
 * resolution, the per-item confidence rungs, the "did you mean" corrections, the
 * unmatched list, the commit — is the text path, untouched.
 *
 * That is not laziness, it is the only version that keeps the app's central
 * promise. Welliva's rule is that a model may PARSE but never NUMBER: the vision
 * endpoint is contractually forbidden from returning calories (see
 * `MealPhotoResponse` in services/api/WellivaApi.ts), because a plausible
 * invented number is indistinguishable from a measured one the moment it lands
 * in a daily total. Routing photos through the text analyzer means there is
 * physically nowhere for a model-invented macro to enter — the same guarantee
 * GozlinFoodAnalyst already makes for typed food.
 *
 * It also means the failure mode is excellent: when the endpoint is down or the
 * model cannot read the plate, the user is already standing on the screen with
 * the text box, and can just describe it. A degraded photo log is a typed log.
 *
 * RELATIONSHIP TO health-os/multimodal
 *
 * That module owns the richer capture → `LogDraft` → confirm-card pipeline built
 * for M4 conversation-first logging, whose `MealPhotoAnalysis` carries macros
 * because M4 commits drafts directly. This file is the path that ships against
 * today's nutrition stack; when M4 lands, its confirm card can consume the same
 * endpoint by mapping items through `draftsFromAnalysis`. Neither supersedes the
 * other — this one has a screen.
 *
 * FAIL-SOFT, WITH THE REASON KEPT
 *
 * Every failure resolves to a typed outcome rather than throwing, because the UI
 * has to say which one happened. "Nothing occurred" is the one unacceptable
 * response to someone who just pointed a camera at their dinner: cancelled,
 * permission denied, no native module, unreadable plate and dead endpoint all
 * need different sentences.
 */
import type * as ImagePicker from "expo-image-picker";

import { consent } from "@/health-os/privacy";
import type { MealType } from "@/models/diet";
import { WellivaApi } from "@/services/api";

/**
 * Load expo-image-picker on demand, tolerating its absence.
 *
 * Same contract as services/sync/pickAndUpload.ts, and for the same reason: it
 * is a NATIVE module, so a dev client that predates it would throw at import
 * time and take the whole screen down with it. Required lazily inside a
 * try/catch, the worst case is a button that can explain itself.
 */
function loadImagePicker(): typeof import("expo-image-picker") | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-image-picker");
  } catch {
    return null;
  }
}

/** Whether the OS picker/camera can open at all in this build. */
export function isMealPhotoAvailable(): boolean {
  return loadImagePicker() !== null;
}

/** One food the vision model identified, before any numbers are attached. */
export interface MealPhotoItem {
  quantity: number;
  unit: string;
  food: string;
}

/**
 * What a capture attempt produced. Distinct failures rather than `null`, so the
 * screen can say which thing went wrong — see the header.
 */
export type MealPhotoOutcome =
  | {
      status: "ok";
      /** The free-text line to drop into the analyzer, exactly as if typed. */
      text: string;
      /** The meal the model thinks it is, when it can tell. */
      slot: MealType | null;
      /** Optional remark to show above the parsed text. */
      note?: string;
      items: MealPhotoItem[];
    }
  /** The user backed out of the picker. Say nothing at all. */
  | { status: "cancelled" }
  /** No native module — a build that predates expo-image-picker. */
  | { status: "unavailable" }
  /** The OS permission was refused. Offer the text box. */
  | { status: "denied" }
  /** The photo was read but held no recognisable food. */
  | { status: "unreadable" }
  /** The endpoint failed, timed out, or is not deployed yet. */
  | { status: "failed"; message: string };

/** Meal slots the server may name, narrowed to the app's own union. */
const SLOTS: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function toSlot(value: string | undefined): MealType | null {
  return value && (SLOTS as readonly string[]).includes(value) ? (value as MealType) : null;
}

/**
 * Render identified items as the sentence a person would have typed.
 *
 * Deliberately plain and comma-joined with a trailing "and": this string is
 * shown to the user in the text box before anything is analyzed, so it has to
 * read like their own words rather than a serialized payload. They can edit it —
 * which is the cheapest correction path in the whole feature, and the reason the
 * text box is the confirm step instead of a bespoke card.
 */
export function describeItems(items: MealPhotoItem[]): string {
  const parts = items
    .map((i) => {
      const food = (i.food ?? "").trim();
      if (!food) return "";
      const qty = Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : 1;
      const unit = (i.unit ?? "").trim();
      // "1 serving of rice" reads worse than "rice" when the unit is a non-unit.
      if (!unit || unit === "serving" || unit === "servings") {
        return qty === 1 ? food : `${qty} ${food}`;
      }
      return `${qty} ${unit} ${food}`;
    })
    .filter(Boolean);

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Pick or shoot a photo, tolerating a missing module and a refused permission. */
async function pick(
  camera: boolean,
): Promise<
  | { ok: true; asset: ImagePicker.ImagePickerAsset }
  | { ok: false; reason: "unavailable" | "denied" | "cancelled" }
> {
  const Picker = loadImagePicker();
  if (!Picker) return { ok: false, reason: "unavailable" };

  const perm = camera
    ? await Picker.requestCameraPermissionsAsync()
    : await Picker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "denied" };

  // quality 0.6: the model reads a plate perfectly well at this size, and the
  // base64 crosses a phone connection. Larger costs seconds and buys nothing.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.6,
    base64: true,
    allowsEditing: false,
  };
  const res = camera
    ? await Picker.launchCameraAsync(options)
    : await Picker.launchImageLibraryAsync(options);

  if (res.canceled) return { ok: false, reason: "cancelled" };
  const asset = res.assets?.[0];
  if (!asset?.base64) return { ok: false, reason: "cancelled" };
  return { ok: true, asset };
}

/**
 * Capture a meal photo and turn it into an analyzable line of text.
 *
 * Nothing is logged here and nothing is stored: the bytes go to the endpoint,
 * the items come back, and the image is dropped. That is exactly what the camera
 * permission string promises, so it has to stay true.
 *
 * The user's explicit tap IS the consent moment for the "photo" category — they
 * pressed a camera button on a screen about logging a meal — so consent is
 * recorded here rather than behind a second dialog asking the same question
 * twice. It stays revocable on the Trust screen like every other category.
 */
export async function captureMealPhoto(opts: {
  camera: boolean;
  /** The user's country/region, so a local dish parses the way they mean it. */
  region?: string;
}): Promise<MealPhotoOutcome> {
  const picked = await pick(opts.camera);
  if (!picked.ok) return { status: picked.reason };

  // Recorded only after the OS dialog was actually accepted, so the Trust screen
  // never claims a permission the user declined at the system level.
  await consent.grant("photo").catch(() => {});

  try {
    const res = await WellivaApi.describeMealPhoto({
      imageBase64: picked.asset.base64!,
      mimeType: picked.asset.mimeType ?? "image/jpeg",
      ...(opts.region ? { region: opts.region } : {}),
    });

    const items = (res.items ?? []).filter((i) => (i.food ?? "").trim().length > 0);
    const text = describeItems(items);
    if (!text) return { status: "unreadable" };

    return {
      status: "ok",
      text,
      slot: toSlot(res.slot),
      ...(res.note ? { note: res.note } : {}),
      items,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read that photo.";
    return { status: "failed", message };
  }
}
