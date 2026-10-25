/**
 * THE MENU MODEL — the app's navigation, as data.
 *
 * Every entry here is a ROOT screen: a file under `app/(tabs)/`, switched by the
 * tab navigator with no push and no back arrow, exactly like picking a chat in
 * ChatGPT's swipe menu. That's why `route` and `href` look redundant but aren't:
 *
 *   · `route` is the file name inside `app/(tabs)/` — what
 *     `navigation.navigate()` takes and what the navigator reports back as
 *     active, so the highlighted row can never drift from the visible screen.
 *   · `href` is the public URL. `(tabs)` is a route GROUP, so it never appears
 *     in a path — `app/(tabs)/settings.tsx` is still `/settings`. Every deep
 *     link, notification route and `router.push` in the codebase kept working
 *     unchanged when these screens moved into the group.
 *
 * ORDER IS THE SPEC. Primary destinations in the order they were asked for,
 * a hairline, the two exploratory surfaces the retired "More" tab used to hold,
 * then the footer: Upgrade, and Settings pinned last.
 */

import type { Ionicons } from "@expo/vector-icons";

export type IconName = keyof typeof Ionicons.glyphMap;

export interface MenuItem {
  /** Route name under `app/(tabs)/` — the navigator's identifier. */
  route: string;
  /** Public URL. Same string every existing link in the app already uses. */
  href: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  /**
   * Render Gozlin's own mark instead of an Ionicon. The coach has an identity
   * and a generic glyph throws it away. Since 2026-10-15 the mark is the gold
   * and cyan diamond (the old app icon) in its own colours — the owner wanted
   * it "exactly as is", so it is never tinted; the label still carries the
   * gold that means "you are here".
   */
  mark?: "gozlin";
}

/**
 * THE ONE CONDITIONAL ROW. Cycle is a daily surface for the people who track
 * one and noise for everyone else, so it is the only destination the menu shows
 * or hides — see {@link primaryItems}.
 *
 * It is a `(tabs)` child like every other row (app/(tabs)/cycle.tsx). That move
 * is the whole reason this row can exist: the drawer SWITCHES between (tabs)
 * children and never pushes, so a row pointing at a pushed screen would hand
 * the next destination a back arrow instead of a hamburger. Before it moved,
 * the cycle screen was reachable only from Home's card and a Settings row.
 */
export const CYCLE_ITEM: MenuItem = {
  route: "cycle",
  href: "/cycle",
  label: "Cycle",
  icon: "water-outline",
  activeIcon: "water",
};

/**
 * The main list — Home through Logs, in the order the menu shows them.
 *
 * STILL THE SPEC, STILL STATIC. Use {@link primaryItems} to render the menu;
 * this is the fixed spine, and the navigator, SWIPEABLE_PATHS and the rail all
 * read from the full set below rather than from what is currently visible.
 */
export const PRIMARY_ITEMS: MenuItem[] = [
  {
    route: "index",
    href: "/",
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
  },
  {
    route: "diet",
    href: "/diet",
    label: "Diet",
    icon: "restaurant-outline",
    activeIcon: "restaurant",
  },
  {
    route: "exercise",
    href: "/exercise",
    label: "Fitness",
    icon: "barbell-outline",
    activeIcon: "barbell",
  },
  {
    route: "gozlin",
    href: "/gozlin",
    label: "Gozlin",
    // Fallbacks only — `mark` wins. Kept so the item is still renderable by
    // anything that doesn't know about the coach's mark.
    icon: "sparkles-outline",
    activeIcon: "sparkles",
    mark: "gozlin",
  },
  {
    route: "habits",
    href: "/habits",
    label: "Habits",
    icon: "grid-outline",
    activeIcon: "grid",
  },
  {
    route: "logs",
    href: "/logs",
    label: "Logs",
    icon: "reader-outline",
    activeIcon: "reader",
  },
];

/**
 * The primary list as the menu should draw it right now.
 *
 * Cycle slots in after Habits and before Logs — with the other things you keep
 * rather than with the record you read. The order of everything else is
 * untouched, so a row never moves under someone's thumb between launches:
 * a destination appearing is a change she made, a destination shuffling is a
 * bug she can feel.
 */
export function primaryItems(options: { cycle: boolean }): MenuItem[] {
  if (!options.cycle) return PRIMARY_ITEMS;
  const at = PRIMARY_ITEMS.findIndex((i) => i.route === "logs");
  const insert = at === -1 ? PRIMARY_ITEMS.length : at;
  return [...PRIMARY_ITEMS.slice(0, insert), CYCLE_ITEM, ...PRIMARY_ITEMS.slice(insert)];
}

/**
 * THE FOUR ON THE RAIL — a pinned SUBSET of the list above, not a second list.
 *
 * This is the whole reason a bottom rail and a swipe menu can coexist instead
 * of competing: the rail renders these entries out of `PRIMARY_ITEMS` by route
 * name, lights them with the same gold, and reads its active state from the
 * same navigator. One vocabulary, two altitudes. The drawer stays the map —
 * eleven destinations — and the rail is the fast lane to four of them.
 *
 * THE TEST FOR A SLOT. A tab is a screen you open WITHOUT a reason: an ambient
 * check, several times a day. Habits and Logs fail it — they are screens you
 * open to answer a question, and a question is exactly what the drawer is for.
 * Gozlin passes it twice over: it is the thing people come back to, and it is
 * what Pro is, so one thumb-tap away on every screen is where it belongs.
 *
 * FOUR, AND NOT FIVE. The fifth slot at the base of the screen is the gold
 * action, which is not a destination at all — see the Deck. A rail of five tabs
 * plus an action is one object too many for a 393pt phone, and the labels start
 * truncating, which is where a tab bar stops looking premium.
 */
export const RAIL_ROUTES: readonly string[] = ["index", "diet", "exercise", "gozlin"];

export const RAIL_ITEMS: MenuItem[] = RAIL_ROUTES.map((route) => {
  const item = PRIMARY_ITEMS.find((i) => i.route === route);
  if (!item) {
    // A rail that silently drops a slot would look like a rendering fault, and
    // the cause (a renamed route in PRIMARY_ITEMS) would be nowhere near it.
    throw new Error(`RAIL_ROUTES names "${route}", which PRIMARY_ITEMS does not have`);
  }
  return item;
});

/** True when the drawer should mark this row as also living on the rail. */
export function isRailItem(item: MenuItem): boolean {
  return RAIL_ROUTES.includes(item.route);
}

/*
 * WHERE TRUST WENT. `/privacy` (labelled "Trust") used to sit here as a primary
 * destination. It is excellent content and none of it changed — but it is read
 * ONCE, usually before signing up or when something worries you, and a menu
 * slot is rent paid every session for a screen visited twice a year.
 *
 * It now hangs off Settings → "Privacy & legal", which is where both users and
 * store reviewers already look for it, and which carries the one fact the Trust
 * screen cannot: which policy version this account actually accepted.
 *
 * The route is untouched, so every deep link and `router.push("/privacy")`
 * still resolves. It simply stops being swipe-reachable — correct, because it
 * is now a pushed screen and keeps the stack's own swipe-back instead.
 */

/**
 * The two surfaces the "More" tab used to hold. Kept below a hairline rather
 * than dropped: deleting the tab without rehoming these would have stranded the
 * whole food catalog and the memory/transparency screen.
 */
export const SECONDARY_ITEMS: MenuItem[] = [
  {
    route: "foods",
    href: "/foods",
    label: "Foods",
    icon: "nutrition-outline",
    activeIcon: "nutrition",
  },
  {
    route: "knows",
    href: "/knows",
    // The route keeps its original name so every existing deep link and
    // `router.push("/knows")` still resolves; only the label a person reads
    // changed. Labels are copy, URLs are a contract.
    label: "Memory",
    icon: "planet-outline",
    activeIcon: "planet",
  },
];

/**
 * Pinned above Settings, in the same footer — the one door to the storefront.
 *
 * It sits in the footer rather than in the scrolling list because it is not a
 * place you go to DO something with your data; like Settings, it's a place you
 * go to change the app itself. And it sits ABOVE Settings because that is where
 * a subscription question is actually asked from — "what am I paying for" used
 * to mean opening Settings and hunting, which is how a subscription screen ends
 * up feeling like admin instead of a product.
 */
export const UPGRADE_ITEM: MenuItem = {
  route: "upgrade",
  href: "/upgrade",
  label: "Upgrade",
  icon: "diamond-outline",
  activeIcon: "diamond",
};

/** Pinned to the bottom, alone — the one door to Settings. */
export const SETTINGS_ITEM: MenuItem = {
  route: "settings",
  href: "/settings",
  label: "Settings",
  icon: "settings-outline",
  activeIcon: "settings",
};

/** Profile is the menu's header row, not a list item — but it is still a tab. */
export const PROFILE_ITEM: MenuItem = {
  route: "profile",
  href: "/profile",
  label: "Profile",
  icon: "person-outline",
  activeIcon: "person",
};

/**
 * Every root screen the menu can reach, in navigator order.
 *
 * CYCLE IS IN HERE UNCONDITIONALLY, even though the list may not be showing it.
 * This set is what the gesture, the rail's altitudes and the navigator are
 * derived from, and all three are about the screen you are ON, not about what
 * the panel currently lists. A `/cycle` that fell out of SWIPEABLE_PATHS when
 * the row was hidden would strand someone who arrived from a notification with
 * no swipe out.
 */
export const ALL_MENU_ITEMS: MenuItem[] = [
  ...PRIMARY_ITEMS,
  CYCLE_ITEM,
  ...SECONDARY_ITEMS,
  UPGRADE_ITEM,
  SETTINGS_ITEM,
  PROFILE_ITEM,
];

/**
 * Pathnames the swipe gesture is live on — precisely the menu's own
 * destinations. Anything else (a pushed detail screen, the auth flow, the
 * consent gate, a running workout) keeps its own horizontal gestures: the
 * drawer must never steal the stack's swipe-back or fight a carousel.
 */
export const SWIPEABLE_PATHS: ReadonlySet<string> = new Set(
  ALL_MENU_ITEMS.map((i) => i.href),
);

/**
 * Destinations where the rail never shows its four tabs — only Home, the
 * prompt and the gold action, whatever the scroll position.
 *
 * These are the screens you open to answer a question or change the app
 * (the record, the storefront, your settings), not the ones you move between
 * several times a day, and a full tab row under them reads as noise. Home is
 * the one way back, and the prompt keeps the day in view.
 */
export const COMPACT_RAIL_ROUTES: readonly string[] = [
  "habits",
  "logs",
  "upgrade",
  "settings",
  "profile",
];

export const COMPACT_RAIL_PATHS: ReadonlySet<string> = new Set(
  COMPACT_RAIL_ROUTES.map((route) => {
    const item = ALL_MENU_ITEMS.find((i) => i.route === route);
    if (!item) {
      throw new Error(`COMPACT_RAIL_ROUTES names "${route}", which the menu does not have`);
    }
    return item.href;
  }),
);

/**
 * Destinations with NO rail at all — the Deck draws nothing there.
 *
 * The coach is the one screen whose bottom edge is a composer. With the rail
 * under it as well, the composer and the rail were stacked bars at the base
 * (owner, 2026-10-15). The rail is the thing that goes: the hamburger and the
 * drawer's swipe are still the way out.
 */
export const RAILLESS_ROUTES: readonly string[] = ["gozlin"];

export const RAILLESS_PATHS: ReadonlySet<string> = new Set(
  RAILLESS_ROUTES.map((route) => {
    const item = ALL_MENU_ITEMS.find((i) => i.route === route);
    if (!item) {
      throw new Error(`RAILLESS_ROUTES names "${route}", which the menu does not have`);
    }
    return item.href;
  }),
);
