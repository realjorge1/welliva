/**
 * The receipt every accepted smart change leaves — "Moved to 9:30 PM · Undo",
 * "Logged · Undo" — shown in the app's one toast (components/gozlin/GozlinToast),
 * the same face as the coach's "Noted · Undo". Nothing a suggestion did is ever
 * one-way.
 */
import type { ToastController } from "@/components/gozlin/GozlinToast";
import { useCallback } from "react";

export interface Receipt {
  message: string;
  /** Present when the change can be taken back. */
  onUndo?: () => void | Promise<void>;
}

export function showReceipt(toast: Pick<ToastController, "show">, r: Receipt): void {
  const undo = r.onUndo;
  if (!undo) {
    toast.show(r.message, { icon: "checkmark-circle" });
    return;
  }
  toast.show(r.message, {
    icon: "checkmark-circle",
    action: {
      label: "Undo",
      onPress: () => {
        void Promise.resolve(undo())
          .then(() => toast.show("Undone", { icon: "arrow-undo", tone: "default" }))
          .catch(() => toast.show("Couldn't undo that", { icon: "alert-circle", tone: "default" }));
      },
    },
  });
}

/** A stable `(receipt) => void` for a screen's toast. */
export function useReceipts(toast: Pick<ToastController, "show">): (r: Receipt) => void {
  const show = toast.show;
  return useCallback((r: Receipt) => showReceipt({ show }, r), [show]);
}
