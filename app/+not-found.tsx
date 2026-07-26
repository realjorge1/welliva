import { AmbientCanvas, AppText, Button, IconBadge, useColors } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotFoundScreen() {
  const { colors } = useColors();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.flex}>
        <AmbientCanvas />
        <SafeAreaView style={[styles.flex, styles.center]}>
          <IconBadge name="compass-outline" tone={colors.primary} size={80} />
          <AppText variant="title" align="center" style={styles.title}>
            This screen doesn&apos;t exist
          </AppText>
          <AppText variant="body" color="secondary" align="center" style={styles.sub}>
            The page you&apos;re looking for couldn&apos;t be found.
          </AppText>
          <Button label="Go to home" icon="home" fullWidth={false} onPress={() => router.replace("/")} />
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", padding: Spacing.huge },
  title: { marginTop: Spacing.xl },
  sub: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
});
