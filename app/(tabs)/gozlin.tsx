/**
 * GOZLIN — the coach screen.
 *
 * A persistent conversation with your AI health coach. The shell stays quiet
 * and airy on purpose — a light header and a clean composer — so the
 * conversation (the briefing opener, structured cards, smart-prompt chips) is
 * the hero. All coaching logic lives in services/gozlin/*; this screen is
 * presentation + input.
 *
 * ── THE FOUR THINGS THIS SCREEN OWNS ────────────────────────────────────────
 *
 * 1. THE KEYBOARD. Not `KeyboardAvoidingView` — it does not work under Android
 *    edge-to-edge, which this app enables. `useKeyboardInset` pads this
 *    container by the live keyboard height on the UI thread instead, so the
 *    chips, the field and the send button ride the keyboard rather than being
 *    left under it. See components/ui/useKeyboardInset.ts.
 *
 * 2. THE PULL. Dragging the thread down at the top uncovers CoachPulse — the
 *    day's numbers, straight off the Twin, with no turn spent and no network.
 *    The panel is a real sibling above the list, so the conversation is pushed
 *    down rather than covered (./components/gozlin/usePullReveal.ts).
 *
 * 3. WHAT YOU CAN DO TO A MESSAGE. Copy, answer again, rate, deep dive, and —
 *    on your own messages — edit and re-ask. The screen owns these rather than
 *    the bubble because every one of them is about the THREAD: a regeneration
 *    replaces a reply, an edit branches the conversation, and a deep dive opens
 *    one reader shared by every message rather than a modal per bubble.
 *
 * 4. THE MENU. Four commands about the conversation, in a popover that grows
 *    out of the ⋯ button (./components/gozlin/GozlinCoachMenu.tsx).
 */

import {
  CoachPulse,
  DeepDiveReader,
  EditMessageSheet,
  GozlinActionSheet,
  GozlinAvatar,
  GozlinCoachMenu,
  GozlinHistorySheet,
  GozlinMessageBubble,
  GozlinSuggestionBar,
  GozlinToast,
  ReceiptSheet,
  useGozlin,
  usePullReveal,
  useToast,
  type ActionSheetOption,
  type CoachMenuStat,
  type DeepDiveState,
} from "@/components/gozlin";
import { MenuButton } from "@/components/navigation";
import { AmbientCanvas, AppText, useKeyboardInset } from "@/components/ui";
import { useColors } from "@/components/ui/useColors";
import { useBilling } from "@/contexts/BillingContext";
import { COACH_DISCLAIMER } from "@/constants/legal";
import { Radius, Spacing } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Receipt } from "@/services/gozlin/agent";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function GozlinScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openUpgrade } = useBilling();
  const {
    twin,
    briefing,
    messages,
    suggestions,
    isThinking,
    activity,
    pendingConfirm,
    respondToConfirm,
    motivation,
    send,
    regenerate,
    editMessage,
    rateMessage,
    deepDive,
    resetConversation,
    archive,
    openArchived,
    deleteArchived,
    forgetMe,
  } = useGozlin();

  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // ONE receipt sheet for the whole conversation. Held here rather than per
  // bubble so a long history does not mount a modal per message.
  const [openReceipt, setOpenReceipt] = useState<Receipt | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [forgetOpen, setForgetOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(64);
  const listRef = useRef<FlatList>(null);
  const autoAskedRef = useRef(false);
  const toast = useToast();

  const keyboard = useKeyboardInset({ bottomInset: insets.bottom, gap: Spacing.sm });

  const onSend = useCallback(
    (text?: string) => {
      const value = (text ?? input).trim();
      if (!value) return;
      setInput("");
      send(value);
    },
    [input, send],
  );

  // ── The pull ──
  //
  // Disabled while the menu is up: a gesture that keeps working under a modal
  // scrim is how a panel ends up open behind a sheet nobody dismissed yet.
  const pull = usePullReveal({ enabled: !menuOpen });

  const askFromPulse = useCallback(
    (text: string) => {
      pull.close();
      onSend(text);
    },
    [pull, onSend],
  );

  // Keep the latest turn in view.
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, isThinking]);

  // Deep-link from a GozlinMoment card elsewhere in the app: open with the
  // surface's question already asked, so a tap on any screen lands mid-answer.
  useEffect(() => {
    if (autoAskedRef.current || !prompt) return;
    autoAskedRef.current = true;
    const t = setTimeout(() => send(prompt), 220);
    return () => clearTimeout(t);
  }, [prompt, send]);

  // ── What you can do to a message ───────────────────────────────────

  /**
   * The newest reply. It gets its actions without being asked, and it is the
   * ONLY one that may be regenerated: re-running an older reply would have to
   * discard everything said after it, which is a data loss nobody asked for
   * from a button that only says "answer again".
   */
  const lastCoachId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "coach") return messages[i].id;
    }
    return null;
  }, [messages]);

  const [editing, setEditing] = useState<{
    id: string;
    text: string;
    replacing: number;
  } | null>(null);

  const openEdit = useCallback(
    (id: string) => {
      const idx = messages.findIndex((m) => m.id === id);
      if (idx < 0) return;
      setEditing({
        id,
        text: messages[idx].content,
        replacing: messages.length - idx - 1,
      });
    },
    [messages],
  );

  // ── The deep dive ──
  //
  // ONE reader for the whole conversation, same reason as the receipt sheet:
  // a long history must never mount a modal per message.
  const [dive, setDive] = useState<{ id: string; subject: string } | null>(null);
  const [diveState, setDiveState] = useState<DeepDiveState>("loading");
  const [diveText, setDiveText] = useState("");
  const [diveOffline, setDiveOffline] = useState(false);
  const [divingId, setDivingId] = useState<string | null>(null);

  const openDive = useCallback(
    async (messageId: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;

      // The question behind the reply is the piece's TITLE — a dive is about
      // the subject of the question, so the question is what names it.
      let subject = "";
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          subject = messages[i].content;
          break;
        }
      }

      const cached = messages[idx].deepDive;
      setDive({ id: messageId, subject });
      setDiveOffline(false);
      setDiveText(cached ?? "");
      setDiveState(cached ? "ready" : "loading");
      if (cached) return;

      setDivingId(messageId);
      const out = await deepDive(messageId, (delta) =>
        setDiveText((prev) => prev + delta),
      );
      setDivingId(null);

      if (out.status === "ready") {
        setDiveText(out.text ?? "");
        setDiveState("ready");
      } else if (out.status === "locked") {
        // Nothing was fetched and nothing was spent — clear whatever the stream
        // had put on screen so the offer isn't sitting under a half-answer.
        setDiveText("");
        setDiveState("locked");
      } else {
        setDiveState("error");
        setDiveOffline(!!out.offline);
      }
    },
    [messages, deepDive],
  );

  /**
   * The coach's menu — about the CONVERSATION, and nothing else.
   *
   * It used to open with "Check in" and "Log a weigh-in". Those are ordinary
   * logging actions with no more to do with a chat screen than a meal does;
   * they sat here only because this menu happened to exist first. They now live
   * on `/logs`, which is the screen named for the record and can therefore own
   * every way of adding to it. What's left is the four things that are
   * genuinely about talking to Gozlin — start, revisit, read the record, forget.
   */
  const menuOptions = useMemo<ActionSheetOption[]>(
    () => [
      {
        key: "reset",
        label: "New conversation",
        caption: "File this one and start fresh",
        icon: "add-circle-outline",
        onPress: () => {
          resetConversation();
          toast.show("Started a new conversation");
        },
      },
      {
        key: "history",
        label: "Chat history",
        caption:
          archive.length > 0
            ? "Reopen an earlier conversation"
            : "Past conversations appear here",
        icon: "time-outline",
        badge: archive.length > 0 ? String(archive.length) : undefined,
        navigates: true,
        onPress: () => setHistoryOpen(true),
      },
      {
        // Used to be its own header icon. The header is the coach's identity —
        // a second destination up there competed with it for attention and,
        // being icon-only, never said where it went. As a menu row it gets a
        // name and a caption, and the header gets back to one control.
        key: "logs",
        label: "View logs",
        caption: "Everything you've recorded",
        icon: "reader-outline",
        navigates: true,
        onPress: () => router.push("/logs" as any),
      },
      {
        key: "forget",
        label: "Clear memory",
        caption: "Forget everything Gozlin knows",
        icon: "trash-outline",
        destructive: true,
        onPress: () => setForgetOpen(true),
      },
    ],
    [archive.length, resetConversation, router, toast],
  );

  /** The conversation in three figures, above the menu's verbs. */
  const menuStats = useMemo<CoachMenuStat[]>(
    () => [
      { value: String(messages.length), label: "messages" },
      { value: String(archive.length), label: "filed" },
      {
        value: briefing.dayCount ? String(briefing.dayCount) : "—",
        label: "day",
      },
    ],
    [messages.length, archive.length, briefing.dayCount],
  );

  /**
   * The write-tool gate. Gozlin can log a food or save a fact about you, but
   * never silently — the tool blocks on this sheet and takes "no" for an
   * answer. Dismissing counts as declining, so there's no way to end up with
   * a mutation the user didn't actively approve.
   */
  const confirmOptions = useMemo<ActionSheetOption[]>(
    () => [
      {
        key: "confirm-tool",
        label: "Yes, go ahead",
        icon: "checkmark-circle-outline",
        onPress: () => respondToConfirm(true),
      },
      {
        key: "decline-tool",
        label: "No thanks",
        icon: "close-circle-outline",
        onPress: () => respondToConfirm(false),
      },
    ],
    [respondToConfirm],
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

  // Naming the work turns the agent loop's latency into a trust signal — the
  // user watches the coach dig through their data instead of staring at dots.
  const statusLine = activity
    ? activity
    : isThinking
      ? "Typing…"
      : motivation
        ? `For ${motivation}`
        : twin.identitySummary || "Your AI coach";

  const canSend = !!input.trim() && !isThinking;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <AmbientCanvas />
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {/* ── Header — quiet & airy ──
          Three zones, evenly weighted: the hamburger, the coach's identity, one
          overflow control. The identity block is grouped in its own row so the
          avatar always sits tight against the name instead of drifting apart as
          the status line changes width. */}
        <View
          style={[styles.header, { borderBottomColor: colors.divider }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          {/* Gozlin is a menu destination now, not a modal pushed over a screen —
            so this is the hamburger, not a way back to where you came from. */}
          <MenuButton size={36} />
          <View style={styles.identity}>
            <GozlinAvatar size={34} pulsing={isThinking} />
            <View style={styles.headerText}>
              <AppText variant="headline" numberOfLines={1}>
                Gozlin
              </AppText>
              <View style={styles.statusRow}>
                {!isThinking ? (
                  <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                ) : null}
                <AppText
                  variant="footnote"
                  color="secondary"
                  numberOfLines={1}
                  style={styles.flex}
                >
                  {statusLine}
                </AppText>
              </View>
            </View>
          </View>
          {/* The only control on the right. A new conversation, your history,
            your logs and "clear memory" all live behind it — see menuOptions. */}
          <Pressable
            onPress={openMenu}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Coach options"
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] },
            ]}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Everything below the header shrinks by the keyboard's height, so the
          list gives up the space and the composer keeps its seat on top of the
          keys. This is the job KeyboardAvoidingView could not do here. */}
        <Animated.View style={[styles.flex, keyboard.containerStyle]}>
          {/* ── The pull-down panel ──
            Height is driven by the gesture; the panel inside is laid out at its
            full size and clipped, so `onLayout` can report a real height while
            the window above it is two points tall. */}
          <Animated.View style={[styles.pulseClip, pull.panelStyle]}>
            <CoachPulse
              twin={twin}
              briefing={briefing}
              height={pull.height}
              panelHeight={pull.panelHeight}
              armed={pull.armedNow}
              onMeasure={pull.measure}
              onClose={pull.close}
              onAsk={askFromPulse}
              onOpenLogs={() => {
                pull.close();
                router.push("/logs" as any);
              }}
            />
          </Animated.View>

          <GestureDetector gesture={pull.gesture}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <GozlinMessageBubble
                  message={item}
                  onOpenReceipt={setOpenReceipt}
                  expanded={item.id === lastCoachId && !isThinking}
                  onRegenerate={
                    item.id === lastCoachId && !isThinking ? regenerate : undefined
                  }
                  onFeedback={item.role === "coach" ? rateMessage : undefined}
                  onDetails={item.role === "coach" ? openDive : undefined}
                  onEdit={item.role === "user" && !isThinking ? openEdit : undefined}
                  regenerating={isThinking && item.id === lastCoachId}
                  detailsBusy={divingId === item.id}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              ListFooterComponent={isThinking ? <TypingIndicator /> : null}
              {...pull.scrollProps}
            />
          </GestureDetector>

          {/* ── Composer ── */}
          <Animated.View
            style={[
              styles.composerWrap,
              { borderTopColor: colors.divider, backgroundColor: colors.background },
              keyboard.restingStyle,
            ]}
          >
            {/* The prompt chips belong TO the composer, not to the conversation.
              They are shortcuts for what to type, so they sit directly on top of
              the field — and inside this block they ride the keyboard up with it
              rather than being left behind the message list. `suggestionBleed`
              cancels this block's gutter so the row still scrolls edge to edge. */}
            <GozlinSuggestionBar
              suggestions={suggestions}
              onPick={onSend}
              disabled={isThinking}
              style={styles.suggestionBleed}
            />
            <View style={styles.composer}>
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
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !canSend }}
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

            {/* Generative output on health topics needs a standing reminder, but a
              two-line paragraph above the input was the loudest thing on a screen
              whose job is conversation — and it re-read as new every session. It
              is a mark now: always present, never shouting, one tap to the full
              disclaimer. The sentence itself is the accessibility label, so a
              screen reader still hears it in full. */}
            <Pressable
              onPress={() => router.push("/legal/disclaimer" as any)}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel={`${COACH_DISCLAIMER} Read the full disclaimer.`}
              style={({ pressed }) => [styles.disclaimerMark, pressed && { opacity: 0.6 }]}
            >
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.textTertiary}
              />
            </Pressable>
          </Animated.View>
        </Animated.View>

        <GozlinCoachMenu
          visible={menuOpen}
          options={menuOptions}
          stats={menuStats}
          // Hangs off the ⋯ button: the header's own height, measured, plus the
          // safe area above it, less a few points of overlap so the panel reads
          // as attached to the control rather than parked under it.
          top={insets.top + headerHeight - 6}
          onClose={() => setMenuOpen(false)}
        />

        <GozlinActionSheet
          visible={!!pendingConfirm}
          title={pendingConfirm?.summary ?? ""}
          subtitle="Gozlin never changes your data without asking."
          options={confirmOptions}
          // Dismissing is a decline, not a no-op — otherwise the tool waits
          // forever on a sheet that's no longer on screen.
          onClose={() => respondToConfirm(false)}
          // ...but PICKING is not a dismissal. Both options answer the tool
          // themselves, and `respondToConfirm` consumes its resolver, so routing
          // a pick through `onClose` would decline the request a beat before the
          // chosen answer arrived at a resolver that was already gone. The
          // answer clears `pendingConfirm`, which is what closes this sheet.
          onAfterPick={() => {}}
        />

        <GozlinActionSheet
          visible={forgetOpen}
          title="Clear memory?"
          subtitle="Gozlin will clear your motivation, remembered notes and chat history."
          options={forgetOptions}
          onClose={() => setForgetOpen(false)}
        />

        <GozlinHistorySheet
          visible={historyOpen}
          conversations={archive}
          onClose={() => setHistoryOpen(false)}
          onOpen={openArchived}
          onDelete={deleteArchived}
        />

        <EditMessageSheet
          visible={!!editing}
          value={editing?.text ?? ""}
          replacing={editing?.replacing ?? 0}
          onClose={() => setEditing(null)}
          onSubmit={(text) => {
            const target = editing;
            setEditing(null);
            if (target) editMessage(target.id, text);
          }}
        />
      </SafeAreaView>

      <ReceiptSheet receipt={openReceipt} onClose={() => setOpenReceipt(null)} />

      <DeepDiveReader
        visible={!!dive}
        state={diveState}
        text={diveText}
        subject={dive?.subject}
        offline={diveOffline}
        onClose={() => setDive(null)}
        onUpgrade={() => {
          setDive(null);
          openUpgrade("deep-dive");
        }}
        onRetry={() => {
          if (dive) void openDive(dive.id);
        }}
      />

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
  const d0 = useRef(new RNAnimated.Value(0)).current;
  const d1 = useRef(new RNAnimated.Value(0)).current;
  const d2 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const dots = [d0, d1, d2];
    const loops = dots.map((d, i) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(i * 160),
          RNAnimated.timing(d, { toValue: 1, duration: 360, useNativeDriver: true }),
          RNAnimated.timing(d, { toValue: 0, duration: 360, useNativeDriver: true }),
          RNAnimated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [d0, d1, d2]);

  return (
    <View style={styles.thinkingRow}>
      <View
        style={[
          styles.typingBubble,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {[d0, d1, d2].map((d, i) => (
          <RNAnimated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: colors.textTertiary,
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [
                  { translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
                ],
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
    gap: Spacing.sm,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  /** Avatar + name + status, kept together so they read as one object. */
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.md },
  headerText: { flex: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  /** Matches MenuButton's 36pt target so the header's two ends balance. */
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  /**
   * The window CoachPulse is revealed through. Height comes from the gesture;
   * `overflow: hidden` is what makes the reveal a wipe instead of a panel
   * hanging over the conversation.
   */
  pulseClip: { overflow: "hidden" },

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

  /**
   * The composer's chrome: hairline top rule, background, and a bottom inset
   * that comes from `keyboard.restingStyle` — the safe area when the keyboard
   * is down, spent down to nothing as it rises.
   */
  composerWrap: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  /**
   * The chip row runs edge to edge even though the composer block is guttered:
   * a scroller that stops short of the screen edge looks clipped rather than
   * scrollable. The bar re-applies the same gutter as content padding, so the
   * first and last chip still line up with the input above and below them.
   */
  suggestionBleed: {
    marginHorizontal: -Spacing.screen,
    marginBottom: Spacing.xs,
  },
  /** The input row itself. */
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  /** The AI-not-a-doctor mark, centred under the input. */
  disclaimerMark: {
    alignSelf: "center",
    paddingTop: Spacing.sm,
    paddingBottom: 2,
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
