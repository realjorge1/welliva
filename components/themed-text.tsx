import { FORCED_COLOR_SCHEME, LIGHT_MODE_ENABLED } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { StyleSheet, Text, type TextProps } from "react-native";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const systemScheme = useColorScheme() ?? "light";
  // Pinned while light mode is disabled — this reads the system scheme directly
  // rather than going through the ThemeContext.
  const colorScheme = LIGHT_MODE_ENABLED ? systemScheme : FORCED_COLOR_SCHEME;
  const color =
    lightColor && colorScheme === "light"
      ? lightColor
      : darkColor && colorScheme === "dark"
        ? darkColor
        : colorScheme === "dark"
          ? "#ECEDEE"
          : "#11181C";

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: "#0a7ea4",
  },
});
