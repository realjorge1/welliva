/**
 * services/smart — the "notice, ask once, remember, say it back" layer.
 *
 *   types         the shapes every moment shares
 *   arbiter       the quiet layer: which moment may speak, and when nothing does
 *   ledger        what was shown (this phone) and answered (synced)
 *   reminderMove  reminders that offer to move to when you actually do the thing
 *   usual         "your usual?" — the meal eaten again and again, one tap
 *   usualStore    usuals the user turned away ("not my usual any more")
 *   usualLog      logging a usual, exactly as recorded (app and lock screen)
 *   roughDay      "rough day?" — today made gentle, the streak paused (capped)
 *   welcomeBack   welcome back without guilt, and fresh-start moments
 *   hardDay       the weekday that keeps getting missed, offered a short version
 *   why           their own reason, quoted back word for word, rarely
 *   anchor        tying a habit to something they already do
 *   goodDays      what your best days have in common, both numbers, never a cause
 */
export * from "./types";
export * from "./arbiter";
export * from "./ledger";
export * from "./reminderMove";
export * from "./usual";
export * from "./usualStore";
export * from "./usualLog";
export * from "./roughDay";
export * from "./welcomeBack";
export * from "./hardDay";
export * from "./why";
export * from "./anchor";
export * from "./goodDays";
