/**
 * services/routine — when this person usually does things.
 *
 *   clock      the pure reading: usual time, spread, the gate, midnight-safe
 *   tickTimes  the one new record: when a habit was ticked (beside the log)
 *   sources    every existing record that knows a time, read as samples
 *   load       those records, loaded in one pass for a screen
 */
export * from "./clock";
export * from "./tickTimes";
export * from "./sources";
export * from "./load";
