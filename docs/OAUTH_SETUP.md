# OAuth Setup Guide for Welliva

This guide covers setting up Email/Password, Google OAuth, and Facebook OAuth in Supabase.

## Prerequisites

- Active Supabase project
- Supabase URL and anon key in `.env`

## 1. Email/Password Authentication

**Already enabled by default in Supabase!**

### Configuration Steps:

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Email** provider (should be enabled by default)
3. Optional settings:
   - **Confirm email**: Toggle to require email verification before sign-in
   - **Secure email change**: Require confirmation for email updates
   - **Secure password change**: Require old password to set new password

### Email Templates (Optional Customization)

Go to **Authentication** → **Email Templates** to customize:

- **Confirm signup**: Email sent after registration
- **Magic Link**: Passwordless login email
- **Reset password**: Password reset email
- **Change email**: Email confirmation for address changes

---

## 2. Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure consent screen if prompted:
   - User Type: **External**
   - App name: **Welliva**
   - User support email: Your email
   - Developer contact: Your email
6. Select Application type: **Web application**
7. Add authorized redirect URIs:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with your Supabase project reference ID
8. Click **Create**
9. Copy your **Client ID** and **Client Secret**

### Step 2: Configure in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Google** provider and click to expand
3. Toggle **Enable Sign in with Google**
4. Paste your **Client ID** and **Client Secret**
5. Click **Save**

### Step 3: Mobile App Configuration (Expo)

For native mobile apps, you need to configure additional redirect URIs:

1. In Google Cloud Console, add these redirect URIs:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   com.yourcompany.welliva:/oauth
   ```

2. Add scheme to `app.json`:
   ```json
   {
     "expo": {
       "scheme": "welliva"
     }
   }
   ```

---

## 3. Facebook OAuth Setup

### Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Choose **Consumer** as app type
4. Fill in app details:
   - App Name: **Welliva**
   - App Contact Email: Your email
5. Click **Create App**

### Step 2: Configure Facebook Login

1. From the dashboard, click **Add Product**
2. Find **Facebook Login** and click **Set Up**
3. Choose platform: **Website**
4. Site URL: `https://<your-project-ref>.supabase.co`
5. Go to **Facebook Login** → **Settings**
6. Add Valid OAuth Redirect URIs:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
7. Click **Save Changes**

### Step 3: Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy your **App ID**
3. Click **Show** on **App Secret** and copy it
4. Add your app domain:
   - App Domains: `<your-project-ref>.supabase.co`

### Step 4: Configure in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Facebook** provider and click to expand
3. Toggle **Enable Sign in with Facebook**
4. Paste your **App ID** as **Client ID**
5. Paste your **App Secret** as **Client Secret**
6. Click **Save**

### Step 5: Make App Live (Important!)

Your Facebook app is in **Development Mode** by default, which limits login to developers/testers only.

To allow public sign-ins:

1. Complete all required settings in **App Review** → **Requests**
2. Add a **Privacy Policy URL** in **Settings** → **Basic**
3. Add an **App Icon** (1024x1024px)
4. Submit for **App Review** or switch to **Live Mode**

**Note**: For testing, you can add test users in **Roles** → **Test Users**

---

## 4. Testing Authentication

### Testing Email/Password

1. Run app: `npx expo start`
2. Navigate to Sign Up screen
3. Enter email and password
4. Check email for verification link (if enabled)
5. Sign in with same credentials

### Testing Google OAuth

1. Click "Sign in with Google" button
2. Browser will open with Google consent screen
3. Choose account and grant permissions
4. App will receive auth callback and sign you in

### Testing Facebook OAuth

1. Click "Sign in with Facebook" button
2. Browser will open with Facebook login
3. Log in and approve permissions
4. App will receive auth callback and sign you in

---

## Troubleshooting

### Google OAuth Issues

- **"redirect_uri_mismatch"**: Check redirect URI exactly matches in Google Console
- **"invalid_client"**: Verify Client ID and Secret are correct
- **Web browser closed**: User canceled login - this is normal

### Facebook OAuth Issues

- **"App Not Setup"**: Make sure Facebook Login product is added and configured
- **"URL Blocked"**: Add your Supabase domain to App Domains in Facebook settings
- **Only admins can log in**: Your app is in Development Mode - add test users or go live

### Email/Password Issues

- **"Email not confirmed"**: Check email for verification link
- **"Invalid login credentials"**: Verify email/password are correct
- **No verification email received**: Check spam folder, verify SMTP settings in Supabase

---

## Production Checklist

Before going live:

- [ ] Email confirmation enabled for production
- [ ] Google OAuth redirect URIs include production domain
- [ ] Facebook app is in **Live Mode** with approved permissions
- [ ] Privacy Policy and Terms of Service URLs configured
- [ ] Rate limiting configured in Supabase
- [ ] Email templates customized with your branding
- [ ] Test all auth flows on production URLs
- [ ] Configure custom SMTP provider (optional, for better deliverability)

---

## Security Best Practices

1. **Never commit credentials**: Keep `.env` in `.gitignore`
2. **Use environment variables**: Store all secrets in `.env`
3. **Enable email confirmation**: Prevent fake account creation
4. **Rate limit auth endpoints**: Prevent brute force attacks
5. **Use strong password requirements**: Minimum 6 characters (consider increasing)
6. **Enable MFA**: For additional security (Supabase Pro feature)
7. **Monitor auth logs**: Check for suspicious activity in Supabase dashboard

---

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Expo AuthSession Guide](https://docs.expo.dev/guides/authentication/#google)

---

## Support

If you encounter issues:

1. Check Supabase logs: **Dashboard** → **Authentication** → **Logs**
2. Check browser console for error messages
3. Verify all redirect URIs match exactly
4. Test in incognito/private browsing mode
