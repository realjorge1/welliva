/**
 * welliva navigation — the swipe menu shell.
 *
 *   import { AppDrawer, MenuButton, useDrawer } from "@/components/navigation";
 *
 * `AppDrawer` wraps the whole app once, in app/_layout. `MenuButton` is the
 * hamburger each root screen puts at the top-left of its header. Everything
 * else here is the model those two share.
 */
export { AppDrawer } from "./AppDrawer";
export { DeckHost } from "./Deck";
export {
  DECK_BASE_GAP,
  DECK_BLOCK,
  DECK_GUTTER,
  RAIL_CONDENSED,
  RAIL_HEIGHT,
  useDeck,
  useDeckOptional,
} from "./DeckContext";
export type { DeckApi } from "./DeckContext";
export { MenuButton } from "./MenuButton";
export type { MenuButtonProps } from "./MenuButton";
export { ScreenTopBar } from "./ScreenTopBar";
export type { ScreenTopBarProps } from "./ScreenTopBar";
export { useDrawer, useDrawerOptional } from "./DrawerContext";
export type { DrawerApi } from "./DrawerContext";
export {
  ALL_MENU_ITEMS,
  PRIMARY_ITEMS,
  PROFILE_ITEM,
  RAIL_ITEMS,
  RAIL_ROUTES,
  SECONDARY_ITEMS,
  SETTINGS_ITEM,
  SWIPEABLE_PATHS,
  isRailItem,
} from "./menu";
export type { MenuItem } from "./menu";
export {
  MEAL_WINDOWS,
  finishedDayMove,
  mealDueAt,
  mealMissedBy,
  resolveAgenda,
  resolveDayProgress,
  resolveNextMove,
} from "./nextMove";
export type {
  DayProgress,
  MealSlot,
  NextMove,
  NextMoveAction,
  NextMoveInput,
} from "./nextMove";
export { useAccountIdentity } from "./useAccountIdentity";
export type { AccountIdentity } from "./useAccountIdentity";
