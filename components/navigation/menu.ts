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
 * then Settings pinned last on its own.
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
   * Render Gozlin's own animated mark instead of an Ionicon. The coach has an
   * identity; a generic chat bubble would throw it away.
   */
  mark?: "gozlin";
}

/** The main list — Home through Private, in the order the menu shows them. */
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
  {
    route: "privacy",
    href: "/privacy",
    // The route keeps its name so every deep link still resolves; only the
    // label changed. "Private" was the one adjective in a menu of nouns, and
    // it named a mood rather than a destination. See app/(tabs)/privacy.tsx.
    label: "Trust",
    icon: "shield-checkmark-outline",
    activeIcon: "shield-checkmark",
  },
];

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

/** Every root screen the menu can reach, in navigator order. */
export const ALL_MENU_ITEMS: MenuItem[] = [
  ...PRIMARY_ITEMS,
  ...SECONDARY_ITEMS,
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
