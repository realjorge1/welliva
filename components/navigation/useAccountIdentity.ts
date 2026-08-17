/**
 * Who is signed in, as the menu header needs to show them: a photo, a name, and
 * one honest line underneath.
 *
 * Lifted verbatim out of the retired "More" tab, which was the only place that
 * knew how to turn an auth session into a human name. It's a hook now because
 * the drawer header and any future account surface should agree on the answer.
 */

import { useAuth } from "@/components/SupabaseAuthProvider";
import { useProfile } from "@/contexts/AppContext";
import { fetchAvatarUrl } from "@/services/sync/StorageSync";
import { useEffect, useState } from "react";

export interface AccountIdentity {
  name: string;
  /** Uploaded avatar, else the OAuth provider's photo, else undefined. */
  photo?: string;
  /** "34 yrs · 78 kg · 180 cm", or the nudge to finish setup. */
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
  const { userBio } = useProfile();

  const meta = user?.user_metadata as Record<string, any> | undefined;

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
    // Single spaces around the separator, not double: this line lives in a
    // ~55%-width menu panel, where the extra padding is what pushes it into an
    // ellipsis.
    subtitle: userBio
      ? [
          `${userBio.age} yrs`,
          `${Math.round(userBio.weightKg)} kg`,
          `${userBio.heightCm} cm`,
        ].join(" · ")
      : "Finish your setup to personalise your plan",
  };
}
