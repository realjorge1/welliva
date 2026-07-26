# Welliva Authentication Quick Reference

## Auth Methods Available

✅ **Email/Password** - Free, built-in  
✅ **Google OAuth** - Free  
✅ **Facebook OAuth** - Free (popular in Africa/Nigeria)

---

## Sign In Screen Features

- Email + password form with validation
- Password visibility toggle
- Google OAuth button
- Facebook OAuth button
- Link to sign-up screen
- Loading states for each auth method
- Gradient background with animations

---

## Sign Up Screen Features

- Email + password + confirm password form
- Password validation (min 6 characters)
- Password match validation
- Email verification flow
- Google OAuth button (instant sign-up)
- Facebook OAuth button (instant sign-up)
- Link to sign-in screen
- Loading states for each auth method

---

## Auth Provider (`SupabaseAuthProvider`)

### Available Functions

```typescript
const {
  user, // Current user object
  isLoading, // Auth loading state
  signInWithEmail, // (email, password) => Promise<void>
  signUpWithEmail, // (email, password) => Promise<void>
  signInWithGoogle, // () => Promise<void>
  signInWithFacebook, // () => Promise<void>
  signOut, // () => Promise<void>
  refreshSession, // () => Promise<void>
} = useSupabaseAuth();
```

### Usage Examples

#### Email/Password Sign In

```typescript
await signInWithEmail("user@example.com", "password123");
```

#### Email/Password Sign Up

```typescript
await signUpWithEmail("user@example.com", "password123");
// User receives verification email (if enabled in Supabase)
```

#### Google OAuth

```typescript
await signInWithGoogle();
// Opens browser with Google consent screen
```

#### Facebook OAuth

```typescript
await signInWithFacebook();
// Opens browser with Facebook login
```

#### Sign Out

```typescript
await signOut();
// Clears session and redirects to sign-in
```

---

## OAuth Configuration Status

| Provider | Status          | Cost | Setup Required                  |
| -------- | --------------- | ---- | ------------------------------- |
| Email    | ✅ Active       | Free | None (enabled by default)       |
| Google   | ⚙️ Needs Config | Free | Get Client ID from Google Cloud |
| Facebook | ⚙️ Needs Config | Free | Get App ID from Facebook        |

---

## Next Steps for OAuth Setup

### 1. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://[your-project].supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase Dashboard

### 2. Facebook OAuth

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create new app (Consumer type)
3. Add Facebook Login product
4. Configure OAuth redirect URI
5. Copy App ID and Secret to Supabase Dashboard
6. **Important**: Switch app to Live Mode for public access

**See `docs/OAUTH_SETUP.md` for detailed step-by-step instructions**

---

## Testing Auth Flows

### Test Email/Password

```bash
npx expo start
```

1. Navigate to Sign Up
2. Enter email and password
3. Check email for verification (if enabled)
4. Sign in with credentials

### Test Google OAuth

1. Click "Sign in with Google"
2. Browser opens with Google login
3. Choose account
4. Grant permissions
5. Redirects back to app

### Test Facebook OAuth

1. Click "Sign in with Facebook"
2. Browser opens with Facebook login
3. Log in and approve
4. Redirects back to app

---

## Common Auth Errors

### Email/Password

- **"Invalid login credentials"** → Wrong email or password
- **"Email not confirmed"** → Check verification email
- **"User already exists"** → Email already registered

### Google OAuth

- **"redirect_uri_mismatch"** → Check redirect URI in Google Console
- **"invalid_client"** → Wrong Client ID or Secret
- **Browser closed** → User canceled (normal behavior)

### Facebook OAuth

- **"App Not Setup"** → Facebook Login product not configured
- **"URL Blocked"** → Add domain to Facebook app settings
- **Only admins can log in** → App in Development Mode

---

## Security Features

✅ Row Level Security (RLS) on all tables  
✅ Auth tokens stored in `expo-secure-store`  
✅ Password hashing by Supabase  
✅ Email verification (optional)  
✅ OAuth tokens never exposed to client  
✅ Automatic session refresh

---

## File Locations

| File                                  | Purpose                        |
| ------------------------------------- | ------------------------------ |
| `components/SupabaseAuthProvider.tsx` | Auth provider with all methods |
| `app/sign-in.tsx`                     | Sign-in screen UI              |
| `app/sign-up.tsx`                     | Sign-up screen UI              |
| `components/AuthWrapper.tsx`          | Auth state wrapper             |
| `lib/supabase.ts`                     | Supabase client config         |
| `hooks/useSupabase.ts`                | Database CRUD hooks            |

---

## Environment Variables

Required in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

Get these from: **Supabase Dashboard** → **Project Settings** → **API**

---

## Quick Commands

```bash
# Start development server
npx expo start

# Clear cache and restart
npx expo start --clear

# Run on iOS
npx expo start --ios

# Run on Android
npx expo start --android

# Check for errors
npx tsc --noEmit
```

---

## Production Checklist

Before going live:

- [ ] Configure Google OAuth with production redirect URI
- [ ] Configure Facebook OAuth and switch to Live Mode
- [ ] Enable email verification in Supabase
- [ ] Customize email templates
- [ ] Test all auth flows on production URLs
- [ ] Set up database backups
- [ ] Configure rate limiting
- [ ] Add Privacy Policy and Terms of Service URLs

---

**Last Updated**: January 2025  
**Migration Status**: ✅ Complete  
**Auth Status**: ✅ Functional (OAuth needs provider config)
