/**
 * AnimatedText / ProgressiveText — type that arrives rather than appearing.
 *
 * `AnimatedText` is one line of the flow's editorial scale, faded and risen
 * into place on the shared curve.
 *
 * `ProgressiveText` is the reference language's signature move: a sentence that
 * assembles LINE BY LINE, each line landing a beat after the last, so the
 * reader is walked through the thought instead of handed a paragraph. It is
 * deliberately rationed — used on the welcome, the stillness beat and the plan
 * hero, and nowhere else. Everywhere else a sentence is one `AnimatedText`,
 * because a question the user has to wait to finish reading is a question that
 * wastes their time.
 */
import { AppText, type AppTextProps } from "@/components/ui";
import React from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Appear } from "./Appear";
import { Dur, Stagger, Travel } from "./onboardingMotion";
import { Editorial } from "./onboardingTheme";

type EditorialVariant = keyof typeof Editorial;

export interface AnimatedTextProps extends Omit<AppTextProps, "variant" | "style"> {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  when?: boolean;
  /** How late this line leaves when its step hands over (see `Appear`). */
  exitOrder?: number;
  /** One of the onboarding's editorial sizes, or an app type variant. */
  variant?: EditorialVariant | AppTextProps["variant"];
  style?: StyleProp<TextStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
}

const isEditorial = (v: unknown): v is EditorialVariant =>
  typeof v === "string" && v in Editorial;

export function AnimatedText({
  children,
  delay = 0,
  distance = Travel.rise,
  duration = Dur.content,
  when = true,
  exitOrder = 0,
  variant = "body",
  style,
  wrapperStyle,
  ...rest
}: AnimatedTextProps) {
  const editorial = isEditorial(variant) ? (Editorial[variant] as TextStyle) : null;
  return (
    <Appear
      delay={delay}
      distance={distance}
      duration={duration}
      when={when}
      exitOrder={exitOrder}
      style={wrapperStyle}
    >
      <AppText
        variant={editorial ? "body" : (variant as AppTextProps["variant"])}
        style={[editorial, style]}
        {...rest}
      >
        {children}
      </AppText>
    </Appear>
  );
}

export interface ProgressiveTextProps extends Omit<AppTextProps, "variant" | "style"> {
  /** Each entry is one line, revealed a beat after the previous. */
  lines: string[];
  delay?: number;
  /** Gap between lines. */
  step?: number;
  duration?: number;
  exitOrder?: number;
  variant?: EditorialVariant | AppTextProps["variant"];
  style?: StyleProp<TextStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
}

export function ProgressiveText({
  lines,
  delay = 0,
  step = Stagger.layer + 60,
  duration = Dur.content,
  exitOrder = 0,
  variant = "statement",
  style,
  wrapperStyle,
  align = "center",
  ...rest
}: ProgressiveTextProps) {
  const editorial = isEditorial(variant) ? (Editorial[variant] as TextStyle) : null;
  return (
    <View
      style={[styles.block, wrapperStyle]}
      // The sentence is one thought to a screen reader, not N fragments.
      accessible
      accessibilityRole="header"
      accessibilityLabel={lines.join(" ")}
    >
      {lines.map((line, i) => (
        <Appear
          key={line + i}
          delay={delay + i * step}
          duration={duration}
          distance={Travel.rise}
          exitOrder={exitOrder}
        >
          <AppText
            variant={editorial ? "body" : (variant as AppTextProps["variant"])}
            align={align}
            importantForAccessibility="no"
            style={[editorial, style]}
            {...rest}
          >
            {line}
          </AppText>
        </Appear>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: "stretch" },
});
