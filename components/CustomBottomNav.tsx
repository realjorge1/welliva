/**
 * CustomBottomNav — a floating, frosted tab bar. Active tab fills with the
 * brand tint; every switch gets a spring press + a light haptic.
 */
import { Colors, Radius, Spacing, alpha } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "@/utils/haptics";
import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface NavItem {
  id: string;
  icon: string;
  activeIcon: string;
  label: string;
}

interface CustomBottomNavProps {
  items: NavItem[];
  activeTab: string;
  onTabPress: (id: string) => void;
  isDarkMode?: boolean;
}

export const CustomBottomNav: React.FC<CustomBottomNavProps> = ({
  items,
  activeTab,
  onTabPress,
  isDarkMode = false,
}) => {
  const insets = useSafeAreaInsets();
  const colors = isDarkMode ? Colors.dark : Colors.light;

  const scales = useRef(
    items.reduce(
      (acc, item) => {
        acc[item.id] = new Animated.Value(1);
        return acc;
      },
      {} as Record<string, Animated.Value>,
    ),
  ).current;

  const spring = (id: string, to: number) =>
    Animated.spring(scales[id], {
      toValue: to,
      useNativeDriver: true,
      tension: 320,
      friction: 12,
    }).start();

  const handlePress = (id: string) => {
    if (id !== activeTab) {
      Haptics.selectionAsync().catch(() => {});
    }
    onTabPress(id);
  };

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(insets.bottom, Spacing.md) }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={isDarkMode ? 48 : 64}
        tint={isDarkMode ? "dark" : "light"}
        style={[
          styles.bar,
          {
            backgroundColor: isDarkMode
              ? alpha(colors.surfaceElevated, 0.86)
              : alpha("#FFFFFF", 0.88),
            borderColor: colors.borderStrong,
          },
        ]}
      >
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <Pressable
              key={item.id}
              style={styles.item}
              onPress={() => handlePress(item.id)}
              onPressIn={() => spring(item.id, 0.88)}
              onPressOut={() => spring(item.id, 1)}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  isActive && { backgroundColor: colors.primary },
                  { transform: [{ scale: scales[item.id] }] },
                ]}
              >
                <Ionicons
                  name={(isActive ? item.activeIcon : item.icon) as any}
                  size={isActive ? 23 : 20}
                  color={isActive ? colors.onPrimary : colors.textTertiary}
                />
              </Animated.View>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={[
                  styles.label,
                  {
                    color: isActive ? colors.primary : colors.textTertiary,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: Spacing.sm,
    right: Spacing.sm,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    overflow: "hidden",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 52,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.1,
  },
});

/**
 * `id` IS THE ROUTE NAME under app/(tabs)/ — not a private nav key.
 *
 * These used to be home | meal | fitness | more while the route files were
 * index | diet | exercise | more, and a layout translated between them. One
 * vocabulary now: the id is what `navigation.navigate(id)` receives and what
 * React Navigation reports back as the active route, so the two can't drift.
 * `label` carries the display string — which is why "index" reads "Home".
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "index", icon: "home-outline", activeIcon: "home", label: "Home" },
  { id: "diet", icon: "restaurant-outline", activeIcon: "restaurant", label: "Diet" },
  { id: "exercise", icon: "barbell-outline", activeIcon: "barbell", label: "Fitness" },
  { id: "more", icon: "ellipsis-horizontal-outline", activeIcon: "ellipsis-horizontal", label: "More" },
];
