/**
 * LOADING OVERLAY COMPONENT
 * A professional, animated loading indicator for the Welliva app
 *
 * Features:
 * - Beautiful gradient circle animation
 * - Automatic display after 3 seconds delay (configurable)
 * - Theme-aware styling
 * - Optional message display
 * - Blur backdrop option
 */

import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "./ThemeContext";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  delay?: number; // ms before showing (default 300ms for fast operations)
  fullScreen?: boolean;
  showAfterDelay?: number; // Only show if loading takes longer than this (ms)
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = "Loading...",
  delay = 300,
  fullScreen = true,
  showAfterDelay = 0,
}) => {
  const { isDarkMode, currentTheme } = useTheme();
  const colors = Colors[currentTheme];

  const [shouldShow, setShouldShow] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  // Handle delayed showing
  useEffect(() => {
    let showTimeout: ReturnType<typeof setTimeout> | undefined;
    let delayTimeout: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      // If showAfterDelay is set, only show if loading takes longer than that
      if (showAfterDelay > 0) {
        showTimeout = setTimeout(() => {
          setShouldShow(true);
        }, showAfterDelay);
      } else {
        // Normal delay for immediate feedback
        delayTimeout = setTimeout(() => {
          setShouldShow(true);
        }, delay);
      }
    } else {
      setShouldShow(false);
    }

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(delayTimeout);
    };
  }, [visible, delay, showAfterDelay]);

  // Spin animation
  useEffect(() => {
    if (shouldShow) {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinAnimation.start();
      return () => spinAnimation.stop();
    }
  }, [shouldShow, spinValue]);

  // Pulse animation
  useEffect(() => {
    if (shouldShow) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [shouldShow, pulseValue]);

  // Fade in animation
  useEffect(() => {
    if (shouldShow) {
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeValue.setValue(0);
    }
  }, [shouldShow, fadeValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!shouldShow) return null;

  const LoadingContent = () => (
    <Animated.View
      style={[
        styles.contentContainer,
        {
          opacity: fadeValue,
          transform: [{ scale: pulseValue }],
        },
      ]}
    >
      {/* Spinning gradient ring */}
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <LinearGradient
          colors={["#4CAF50", "#2196F3", "#9C27B0", "#FF5722", "#4CAF50"]}
          style={styles.gradientRing}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View
            style={[
              styles.innerCircle,
              { backgroundColor: isDarkMode ? "#1a1a2e" : "#ffffff" },
            ]}
          >
            <Ionicons
              name="leaf"
              size={32}
              color={isDarkMode ? "#4CAF50" : "#2E7D32"}
            />
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Loading dots animation */}
      <LoadingDots isDarkMode={isDarkMode} />

      {/* Message */}
      {message && (
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      )}
    </Animated.View>
  );

  if (fullScreen) {
    return (
      <Modal transparent visible={shouldShow} animationType="none">
        <View style={styles.modalContainer}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={30}
              style={StyleSheet.absoluteFill}
              tint={isDarkMode ? "dark" : "light"}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(0,0,0,0.7)"
                    : "rgba(255,255,255,0.85)",
                },
              ]}
            />
          )}
          <LoadingContent />
        </View>
      </Modal>
    );
  }

  return (
    <View
      style={[
        styles.inlineContainer,
        { backgroundColor: isDarkMode ? "#1a1a2e" : "#ffffff" },
      ]}
    >
      <LoadingContent />
    </View>
  );
};

// Animated loading dots
const LoadingDots: React.FC<{ isDarkMode: boolean }> = ({ isDarkMode }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 150);
    const anim3 = animateDot(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.3],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsContainer}>
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: isDarkMode ? "#4CAF50" : "#2E7D32" },
          dotStyle(dot1),
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: isDarkMode ? "#2196F3" : "#1565C0" },
          dotStyle(dot2),
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: isDarkMode ? "#9C27B0" : "#7B1FA2" },
          dotStyle(dot3),
        ]}
      />
    </View>
  );
};

// Hook for managing loading state with automatic timeout
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = useState(initialState);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const startLoading = (message?: string, autoHideAfter?: number) => {
    if (message) setLoadingMessage(message);
    setIsLoading(true);

    if (autoHideAfter) {
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
      }, autoHideAfter);
    }
  };

  const stopLoading = () => {
    setIsLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    setLoadingMessage,
  };
}

// Simple inline loading spinner
export const LoadingSpinner: React.FC<{
  size?: "small" | "large";
  color?: string;
}> = ({ size = "small", color }) => {
  const { isDarkMode } = useTheme();
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const iconSize = size === "small" ? 20 : 32;
  const iconColor = color || (isDarkMode ? "#4CAF50" : "#2E7D32");

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Ionicons name="sync" size={iconSize} color={iconColor} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inlineContainer: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradientRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  innerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    marginTop: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
  },
});

export default LoadingOverlay;
