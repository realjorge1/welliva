# Health Connect on Google Play: what to do, step by step

For: the owner. No code, no commands. Written 15 November 2026.

welliva will read three things from Health Connect, Google's health hub on Android:

- **sleep**
- **heart-rate variability** (how much the gap between heartbeats varies; a sign of how rested the body is)
- **resting heart rate**

All three feed one feature you can see: the daily **recovery score**, which decides how hard the suggested workout is. welliva only reads; it never writes anything into Health Connect.

---

## Plain answers to your questions

- **Does it cost anything?** No. Health Connect is free.
- **Do I need to register or subscribe?** No. You fill in one form in Play Console (below), and Google reviews it.
- **Is it safe?** Yes. It's Google's official way for apps to read health data. The phone owner chooses exactly what welliva may read, and can take it back at any time.
- **Could I get sued?** Using Health Connect itself isn't the risk. The real risks are:
  - breaking Google's rules: using the data for ads, selling it, or reading more than a feature needs. Google can then block the app.
  - mishandling the data.

  welliva is set up to avoid all of these: three types only, read-only, the readings stay on the phone, no ads, nothing sold.

---

## What has to happen, in this order

1. **The privacy policy on the website must describe Health Connect.** ✅ **Done 15 November 2026:** version 5 is on the website. To check, open the privacy page and look for the date 15 November 2026 near the top and the words "Health Connect". *Not optional:* Google checks the policy before approving the form.
2. **Your next app build.** Health Connect is prepared and arrives with the next build you make. It also raises the minimum to Android 8, as you approved. *Not optional.*
3. **The Data safety form: check it** (Part 1 below). *Recommended.*
4. **The Health apps form** (Part 2 below). *Not optional:* without it, Google won't accept a build that asks for Health Connect data.

You can fill in the forms before or after uploading the build. Google reviews them together.

---

## Part 1: Data safety (a check, probably already right)

**Why:** this form tells people on the Play Store what data welliva handles. Health Connect readings themselves never leave the phone. But when someone uses Gozlin, the coach's short summary can include the recovery score and last night's hours of sleep worked out from them, and welliva already syncs health logs to the person's account. So the form should already say health and fitness information is collected.

1. Go to **play.google.com/console** and sign in.
2. Click **welliva**.
3. In the left menu, click **Policy and programs**, then **App content**.
4. Find **Data safety** and click **Manage** (or **View details**, then **Edit**).
5. Go to the data types list. Under **Health and fitness**, check that **Health info** and **Fitness info** are both ticked as **collected**.
   - Purpose: **App functionality** (and **Personalization**, if it's offered and already ticked).
   - **Shared:** No.
   - **Optional or required:** optional (people choose whether to set up Health Connect).
6. Check that **Data is encrypted in transit** is answered **Yes**, and **People can request that data be deleted** is **Yes**.
7. If you changed anything, click **Save**, then **Submit**.

If all of that was already right, you don't need to submit anything.

---

## Part 2: The Health apps form

**Why:** Google needs to know which Health Connect data welliva reads, and why, before it lets the app ask for it.

1. In Play Console, open **welliva**, then **Policy and programs**, then **App content**.
2. Find **Health apps** and click **Start**. If it shows **Manage**, you filled it in before (for example, for the period tracker); click **Manage** and update it.
3. **Health features:** tick every box that describes welliva. It has:
   - fitness and workouts
   - nutrition and weight
   - sleep (from now on)
   - period and cycle tracking
   - mood check-ins
4. **Health Connect data types:** choose **only** these three, all **read**:
   - **Sleep**
   - **Heart rate variability**
   - **Resting heart rate**

   Do not tick anything else, and never a **write** type.
5. For each type, Google asks how welliva uses it. Copy and paste these answers exactly:

   **Sleep**
   > welliva reads last night's sleep sessions on the user's phone to work out how many hours they slept. That feeds the daily recovery score shown on the Fitness screen and used by the in-app coach, which sets how hard the suggested workout is. Read-only, read only while the app is open, never used for advertising, never sold and never shared with third parties.

   **Heart rate variability**
   > welliva reads the user's overnight heart rate variability (RMSSD) on their phone and compares it with their own 30-day average. The difference adjusts the daily recovery score, which sets how hard the suggested workout is. Read-only, read only while the app is open, never used for advertising, never sold and never shared with third parties.

   **Resting heart rate**
   > welliva reads the user's resting heart rate on their phone and compares it with their own 30-day average. A raised resting heart rate lowers the daily recovery score, so the suggested workout is lighter. Read-only, read only while the app is open, never used for advertising, never sold and never shared with third parties.

6. If it asks whether welliva reads data **in the background**, answer **No**. If it asks whether welliva reads **data older than 30 days**, answer **No**.
7. **Privacy policy link:** `https://realjorge1.github.io/welliva/privacy/`
   - It must be the same policy people see from Health Connect's permission screen. It is: that link inside the app opens welliva's privacy policy, the same text as the website.
   - The website already has the Health Connect wording (published 15 November 2026).
8. Click **Save**, then **Submit**. Google reviews it, which can take a few days. You'll get an email.

---

## After your next build: try it

1. On your phone, open the side menu and tap **Memory**.
2. Scroll to **What's ahead** and tap **Set up Health Connect**.
3. Health Connect asks which data to share. Allow the three.
4. Back in welliva, the row should show last night's sleep, e.g. "Last night: 7.1h". If it shows something odd, like 20 hours, tell me and I'll fix it.
5. On Health Connect's permission screen, tap the **privacy policy** link. welliva's privacy policy should open.

If the phone has no sleep data yet (no watch or sleep app writing to Health Connect), the row stays empty. That's expected: welliva then uses the sleep you log by hand.

---

## iPhone (later)

You said an iPhone release isn't planned yet, so Apple Health is **not** in this build. When it is, it needs:

- a different package
- an Apple permission (HealthKit)
- two sentences Apple shows when asking
- a question in Apple's review about health data

The same three types and the same privacy wording apply. The code that reads Apple Health is already written and tested; only that setup and a build remain.
