/**
 * Who is signed in, as the menu header needs to show them: a photo, a name, and
 * one honest line underneath.
 *
 * Lifted verbatim out of the retired "More" tab, which was the only place that
 * knew how to turn an auth session into a human name. It's a hook now because
 * the drawer header and any future account surface should agree on the answer.
 */

import { useAuth } from "@/components/SupabaseAuthProvider";
import { useGamification } from "@/contexts/AppContext";
import {
  getLatestUnlocked,
  type EvaluatedAchievement,
} from "@/services/AchievementService";
import { fetchAvatarUrl } from "@/services/sync/StorageSync";
import { useEffect, useMemo, useState } from "react";

export interface AccountIdentity {
  name: string;
  /** Uploaded avatar, else the OAuth provider's photo, else undefined. */
  photo?: string;
  /**
   * The most recent achievement unlocked, or null.
   *
   * This line used to be the body stats — "34 yrs · 78 kg · 180 cm". Those are
   * facts about a body, not about a person's week; they never change, so the
   * line never had anything to say, and they're already on the profile screen
   * one tap away. The latest achievement earns its place by moving.
   */
  latestAchievement: EvaluatedAchievement | null;
  /** The achievement's name, or the nudge to finish setup / get started. */
  subtitle: string;
}

/**
 * Pull a human name out of whatever the provider gave us. Google/Facebook/Apple
 * all land in `user_metadata` under slightly different keys; email sign-ups have
 * none of them, so we fall back to the address' local part ("jane.doe" → "Jane
 * Doe") and finally to a neutral label.
 */
function displayName(
  meta: Record<string, any> | undefined,
  email?: string,
): string {
  const named =
    meta?.full_name ?? meta?.name ?? meta?.user_name ?? meta?.preferred_username;
  if (typeof named === "string" && named.trim()) return named.trim();

  const local = email?.split("@")[0];
  if (!local) return "Your profile";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Provider avatar URL, whichever key it arrived under. */
function providerAvatar(meta: Record<string, any> | undefined): string | undefined {
  const url = meta?.avatar_url ?? meta?.picture ?? meta?.photo_url;
  return typeof url === "string" && url ? url : undefined;
}

export function useAccountIdentity(): AccountIdentity {
  const { user } = useAuth();
  const { achievements } = useGamification();

  const meta = user?.user_metadata as Record<string, any> | undefined;

  const latestAchievement = useMemo(
    () => getLatestUnlocked(achievements),
    [achievements],
  );

  // Prefer the avatar uploaded in-app (users.avatar_url) over the OAuth
  // provider photo; fall back to the provider's when none has been set.
  const [uploaded, setUploaded] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setUploaded(null);
      return;
    }
    fetchAvatarUrl(user.id).then((url) => {
      if (alive) setUploaded(url);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return {
    name: displayName(meta, user?.email ?? undefined),
    photo: uploaded ?? providerAvatar(meta),
    latestAchievement,
    // Before the first unlock there's nothing to celebrate yet, and saying so
    // beats an empty line or a fake one.
    subtitle: latestAchievement
      ? latestAchievement.def.name
      : "Your first achievement is waiting",
  };
}
