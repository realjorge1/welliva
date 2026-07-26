/**
 * GOZLIN — the coach screen.
 *
 * A persistent conversation with your AI health coach. The shell stays quiet
 * and airy on purpose — a light header and a clean composer — so the
 * conversation (the briefing opener, structured cards, smart-prompt chips) is
 * the hero. All coaching logic lives in services/gozlin/*; this screen is
 * presentation + input.
 */

import {
  CheckinModal,
  GozlinActionSheet,
  GozlinAvatar,
  GozlinMessageBubble,
  GozlinSuggestionBar,
  GozlinToast,
  WeighInModal,
  useGozlin,
  useToast,
  type ActionSheetOption,
  type CheckinPayload,
  type WeighInPayload,
} from "@/components/gozlin";
import { AmbientCanvas, AppText } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function GozlinScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    twin,
    messages,
    suggestions,
    isThinking,
    motivation,
    send,
    resetConversation,
    forgetMe,
    logWeighIn,
    setGoalWeight,
    todayCheckin,
    logCheckin,
  } = useGozlin();

  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [weighInOpen, setWeighInOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const autoAskedRef = useRef(false);
  const toast = useToast();

  const onSaveWeighIn = useCallback(
    async (data: WeighInPayload) => {
      if (data.goalWeightKg != null) await setGoalWeight(data.goalWeightKg);
      if (data.weightKg != null) await logWeighIn(data.weightKg, data.waistCm);
    },
    [logWeighIn, setGoalWeight],
  );

  const onSaveCheckin = useCallback(
    async (data: CheckinPayload) => {
      await logCheckin(data);
    },
    [logCheckin],
  );

  // Keep the latest turn in view.
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, isThinking]);

  const onSend = useCallback(
    (text?: string) => {
      const value = (text ?? input).trim();
      if (!value) return;
      setInput("");
      send(value);
    },
    [input, send],
  );

  // Deep-link from a GozlinMoment card elsewhere in the app: open with the
  // surface's question already asked, so a tap on any screen lands mid-answer.
  useEffect(() => {
    if (autoAskedRef.current || !prompt) return;
    autoAskedRef.current = true;
    const t = setTimeout(() => send(prompt), 220);
    return () => clearTimeout(t);
  }, [prompt, send]);

  // Single quiet menu — a themed bottom sheet (no native alerts), keeping
  // Check-in / Weigh-in / manage out of the header.
  const menuOptions = useMemo<ActionSheetOption[]>(
    () => [
      {
        key: "checkin",
        label: todayCheckin ? "Update today's check-in" : "Check in",
        caption: "Mood, energy, sleep & more",
        icon: "sunny-outline",
        onPress: () => setCheckinOpen(true),
      },
      {
        key: "weighin",
        label: "Log a weigh-in",
        caption: "Update weight & waist",
        icon: "scale-outline",
        onPress: () => setWeighInOpen(true),
      },
      {
        key: "reset",
        label: "New conversation",
        caption: "Start a fresh chat",
        icon: "add-circle-outline",
        onPress: () => {
          resetConversation();
          toast.show("Started a new conversation");
        },
      },
      {
        key: "forget",
        label: "Forget what you know",
        caption: "Clear memory & history",
        icon: "trash-outline",
        destructive: true,
        onPress: () => setForgetOpen(true),
      },
    ],
    [todayCheckin, resetConversation, toast],
  );

  const forgetOptions = useMemo<ActionSheetOption[]>(
    () => [
      {
        key: "confirm-forget",
        label: "Forget everything",
        caption: "This can't be undone",
        icon: "trash-outline",
        destructive: true,
        onPress: () => {
          forgetMe();
          toast.show("Memory cleared", { icon: "sparkles" });
        },
      },
    ],
    [forgetMe, toast],
  );

  const openMenu = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setMenuOpen(true);
  }, []);

  const statusLine = isThinking
    ? "Typing…"
    : motivation
      ? `For ${motivation}`
      : twin.identitySummary || "Your AI coach";

  const canSend = !!input.trim() && !isThinking;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top"]}>
      {/* ── Header — quiet & airy ── */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <GozlinAvatar size={34} pulsing={isThinking} />
        <View style={styles.headerText}>
          <AppText variant="headline" numberOfLines={1}>
            Gozlin
          </AppText>
          <View style={styles.statusRow}>
            {!isThinking ? (
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
            ) : null}
            <AppText variant="footnote" color="secondary" numberOfLines={1} style={styles.flex}>
              {statusLine}
            </AppText>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/memory-center" as any)}
          hitSlop={10}
          style={styles.iconBtn}
          accessibilityLabel="What I remember"
        >
          <Ionicons name="journal-outline" size={21} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={openMenu} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <GozlinMessageBubble message={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={isThinking ? <TypingIndicator /> : null}
        />

        <GozlinSuggestionBar suggestions={suggestions} onPick={onSend} disabled={isThinking} />

        {/* ── Composer ── */}
        <View style={[styles.composer, { borderTopColor: colors.divider, backgroundColor: colors.background }]}>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.surface,
                borderColor: focused ? colors.primary : colors.border,
              },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Talk to your coach…"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.text }]}
              maxFontSizeMultiplier={1.3}
              multiline
              onSubmitEditing={() => onSend()}
              blurOnSubmit={false}
            />
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onSend();
            }}
            disabled={!canSend}
            style={({ pressed }) => ({ opacity: !canSend ? 0.4 : pressed ? 0.85 : 1 })}
          >
            <LinearGradient
              colors={colors.brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <GozlinActionSheet
        visible={menuOpen}
        title="Gozlin"
        subtitle="What would you like to do?"
        options={menuOptions}
        onClose={() => setMenuOpen(false)}
      />

      <GozlinActionSheet
        visible={forgetOpen}
        title="Forget everything?"
        subtitle="Gozlin will clear your motivation, remembered notes and chat history."
        options={forgetOptions}
        onClose={() => setForgetOpen(false)}
      />

      <WeighInModal
        visible={weighInOpen}
        currentWeightKg={twin.body.currentWeightKg}
        goalWeightKg={twin.body.goalWeightKg}
        onClose={() => setWeighInOpen(false)}
        onSave={onSaveWeighIn}
      />

      <CheckinModal
        visible={checkinOpen}
        existing={todayCheckin}
        onClose={() => setCheckinOpen(false)}
        onSave={onSaveCheckin}
      />
      </SafeAreaView>

      <GozlinToast controller={toast} topOffset={insets.top} />
    </View>
  );
}

/**
 * The coach's "thinking" beat — three softly bouncing dots in a left-aligned
 * coach bubble, matching the coach's message style so it reads as Gozlin
 * speaking (no avatar, no label).
 */
function TypingIndicator() {
  const { colors } = useColors();
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dots = [d0, d1, d2];
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 360, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 360, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [d0, d1, d2]);

  return (
    <View style={styles.thinkingRow}>
      <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[d0, d1, d2].map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: colors.textTertiary,
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  iconBtn: { padding: Spacing.xs },

  listContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  thinkingRow: {
    alignItems: "flex-start",
    marginVertical: Spacing.sm,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderTopLeftRadius: Radius.xs,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
  },
  inputWrap: {
    flex: 1,
    justifyContent: "center",
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    maxHeight: 132,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
    margin: 0,
    // Give the field real vertical room so the placeholder never looks cramped.
    minHeight: Platform.OS === "ios" ? 22 : 26,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
