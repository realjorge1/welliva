/**
 * WHICH SIGN-IN METHODS WE OFFER — a product decision, not a capability.
 *
 * socialProviders.ts answers "what would work": it asks the Supabase project
 * which providers are switched on. This answers the other question — what we
 * choose to put on the sheet — and a method is drawn only when BOTH say yes.
 * Keeping the two apart is what stops either one lying: the server can never
 * make us show a method we have pulled, and this file can never make us show a
 * button the project would refuse with "provider is not enabled".
 *
 * Current offer (2026-09): Google and Facebook only.
 * · Email is pulled, not deleted. Every screen still carries the full form
 *   behind this switch, so turning it back on is this one line. While it is
 *   off, an existing email-password account can only get in through a social
 *   provider that shares its address.
 * · Apple is pulled too. Note that shipping Google or Facebook on iOS without
 *   Sign in with Apple is an App Store guideline 4.8 rejection, so this has to
 *   flip back (with the native entitlement) before an iOS submission.
 */
import type { SocialProviders } from "./socialProviders";

export interface SignInMethods extends SocialProviders {
  email: boolean;
}

export const OFFERED_SIGN_IN: SignInMethods = {
  google: true,
  facebook: true,
  apple: false,
  email: false,
};

/** The providers to draw: switched on by the project AND offered by us. */
export function visibleProviders(
  enabled: SocialProviders,
  offered: SignInMethods = OFFERED_SIGN_IN,
): SocialProviders {
  return {
    google: enabled.google && offered.google,
    facebook: enabled.facebook && offered.facebook,
    apple: enabled.apple && offered.apple,
  };
}
