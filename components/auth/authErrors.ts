/**
 * AUTH ERRORS — one place that turns a GoTrue failure into a sentence.
 *
 * Auth is the one screen where a user has no context to interpret a raw error,
 * and Supabase's are written for developers: "email rate limit exceeded",
 * "Invalid login credentials", "otp_expired". Each screen used to paraphrase a
 * couple of these inline and pass the rest through untouched, so the failures
 * that matter most were the ones shown most bluntly.
 *
 * Pure and dependency-free so every mapping is testable in a Node process.
 *
 * ── ON `over_email_send_rate_limit` ─────────────────────────────────────────
 *
 * This one deserves its own note, because it is the single most confusing
 * failure this app can produce and it looks like a bug in the app.
 *
 * Supabase's BUILT-IN e-mail sender is capped at a couple of messages per hour
 * for the whole project — it exists for development, not for real users. Past
 * that cap `signUp` fails with this code, and critically **no account is
 * created**. So the user sees "nothing happened", and when they then try to
 * sign in with the details they just typed they are told their credentials are
 * invalid — because they are: there is no such account.
 *
 * The cure is a custom SMTP provider on the project (docs/OAUTH_SETUP.md §1).
 * Until then this message at least tells the truth about what went wrong.
 */

/**
 * Whatever was thrown — a GoTrue `AuthError`, an `Error`, a bare string, or
 * something nobody anticipated.
 *
 * `unknown` rather than a union, because that is the type `catch` actually
 * hands you: a narrower parameter would push a cast into every call site, and
 * a cast at a call site is a promise about a value that only the runtime knows.
 * The narrowing belongs here, once.
 */
type Thrown = unknown;

/** Read a string field off a thrown value, whatever shape it turned out to be. */
function field(err: Thrown, key: string): string {
  if (!err || typeof err !== "object") return "";
  const value = (err as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/** GoTrue's stable machine code, when there is one. */
function codeOf(err: Thrown): string {
  return (field(err, "code") || field(err, "error_code")).toLowerCase();
}

function messageOf(err: Thrown): string {
  return typeof err === "string" ? err : field(err, "message");
}

/**
 * True when sign-in failed only because the address was never confirmed.
 *
 * Split out because this is the one auth failure with somewhere better to go
 * than an error line: the account exists and the password was right, so the
 * screen sends them to /verify-email to get a fresh link instead.
 */
export function isEmailNotConfirmed(err: Thrown): boolean {
  return (
    codeOf(err) === "email_not_confirmed" ||
    /email not confirmed/i.test(messageOf(err))
  );
}

/** True when the failure was the project's e-mail quota, not the user. */
export function isEmailRateLimited(err: Thrown): boolean {
  return (
    codeOf(err) === "over_email_send_rate_limit" ||
    /email rate limit/i.test(messageOf(err))
  );
}

/**
 * A short, honest, user-facing sentence for any auth failure.
 *
 * Matching is by GoTrue's `code` first and message text only as a fallback,
 * because the codes are stable across Supabase releases and the prose is not.
 */
export function friendlyAuthError(err: Thrown): string {
  const code = codeOf(err);
  const message = messageOf(err);
  const says = (pattern: RegExp) => pattern.test(message);

  // ── The project's own limits ──────────────────────────────────────────────
  if (isEmailRateLimited(err)) {
    return "Too many emails have been sent from this app in the last hour, so this one couldn't go out. Please wait a little and try again.";
  }
  if (code === "over_request_rate_limit" || says(/rate limit|too many requests/i)) {
    return "Too many attempts just now. Please wait a moment and try again.";
  }
  if (code === "signup_disabled" || says(/signups? (are )?(not allowed|disabled)/i)) {
    return "New accounts are closed at the moment. Please try again later.";
  }

  // ── Credentials ───────────────────────────────────────────────────────────
  if (isEmailNotConfirmed(err)) {
    return "Please confirm your email address first — tap the link we sent you.";
  }
  if (code === "invalid_credentials" || says(/invalid login credentials/i)) {
    return "Incorrect email or password.";
  }
  if (code === "user_already_exists" || says(/already registered|already been registered/i)) {
    return "That email is already registered. Try signing in instead.";
  }
  if (code === "weak_password" || says(/password/i)) {
    return "Please choose a stronger password (at least 6 characters).";
  }
  // Checked BEFORE the address branch below: a disabled provider also comes
  // back as `validation_failed`, and telling someone who tapped Facebook to
  // check their email address would be nonsense.
  if (says(/provider is not enabled|unsupported provider/i)) {
    return "That sign-in method isn't available yet. Please use another way in.";
  }
  if (
    code === "email_address_invalid" ||
    code === "validation_failed" ||
    says(/valid email|invalid email|unable to validate/i)
  ) {
    // Worth knowing: Supabase rejects reserved test domains such as
    // `example.com` outright with this code, which reads as a typo to a user
    // who meant it. There is nothing better to say than "use a real address".
    return "Please enter a valid email address.";
  }

  // ── Links ─────────────────────────────────────────────────────────────────
  if (code === "otp_expired" || says(/invalid or has expired|expired/i)) {
    return "That link has expired. Request a new one and tap it soon after it arrives.";
  }
  if (code === "bad_oauth_state" || says(/oauth state/i)) {
    return "That sign-in took too long to complete. Please try again.";
  }
  if (code === "access_denied" || says(/access_denied|consent/i)) {
    return "Sign-in was cancelled before it finished.";
  }

  // ── The network ───────────────────────────────────────────────────────────
  if (says(/network request failed|failed to fetch|timeout|timed out/i)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }

  return message || "Something went wrong. Please try again.";
}
