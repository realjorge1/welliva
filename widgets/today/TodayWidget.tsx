/**
 * The "Today" home-screen widget: the gold word, its reason, and the line of
 * the day underneath (owner's pick, 2026-11-14).
 *
 * ⚠️ Only ever loaded through widgets/index.ts, AFTER it has confirmed the
 * native widget module is in this build. Importing react-native-android-widget
 * on a build without it throws at module load (TurboModuleRegistry.getEnforcing),
 * so nothing else may import this file.
 *
 * Built from the library's widget primitives, which are drawn by Android's
 * widget host, not by React Native: no animation, no React state, one still
 * picture per render.
 */
import React from "react";
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from "react-native-android-widget";

/** The script font, bundled into the widget by the config plugin (app.json). */
const SCRIPT = "Pacifico-Regular";
const GOLD = "#EDB623";

export interface TodayWidgetProps {
  word: string;
  why: string;
  /** The sky and the line, from services/widget/todayArt.ts. */
  svg: string;
  wide: boolean;
}

export function TodayWidget({ word, why, svg, wide }: TodayWidgetProps) {
  return (
    <OverlapWidget
      clickAction="OPEN_APP"
      style={{ height: "match_parent", width: "match_parent" }}
    >
      <SvgWidget svg={svg} style={{ height: "match_parent", width: "match_parent" }} />
      <FlexWidget
        style={{
          height: "match_parent",
          width: "match_parent",
          flexDirection: "column",
          paddingTop: 4,
          paddingLeft: wide ? 18 : 14,
          paddingRight: wide ? 72 : 12,
        }}
      >
        <TextWidget
          text={word}
          maxLines={1}
          allowFontScaling={false}
          style={{
            fontFamily: SCRIPT,
            fontSize: wide ? 40 : 30,
            color: GOLD,
            adjustsFontSizeToFit: true,
            textShadowColor: "#EDB62366",
            textShadowRadius: 12,
            textShadowOffset: { width: 0, height: 0 },
          }}
        />
        <TextWidget
          text={why}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 11, color: "#FFFFFFA8", marginTop: -2 }}
        />
      </FlexWidget>
      {wide ? (
        <FlexWidget
          style={{
            height: "match_parent",
            width: "match_parent",
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingTop: 12,
            paddingRight: 16,
          }}
        >
          <TextWidget
            text="welliva"
            allowFontScaling={false}
            style={{ fontFamily: SCRIPT, fontSize: 14, color: "#EDB623E6" }}
          />
        </FlexWidget>
      ) : null}
    </OverlapWidget>
  );
}
