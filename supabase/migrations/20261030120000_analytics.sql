-- ───────────────────────────────────────────────────────────────────────────────
-- PRODUCT ANALYTICS — first-party, anonymous, append-only.
--
-- WHY THIS IS IN OUR OWN DATABASE AND NOT POSTHOG/AMPLITUDE/SENTRY.
-- The privacy policy (constants/legal.ts) states that welliva contains "no
-- third-party analytics". That sentence is a product promise on a health app, and
-- the Trust screen is built around it. Shipping a vendor SDK would make a live
-- legal document false and hand a third party a stream of behavioural data about
-- people's eating, training and menstrual cycles. So the pipeline is ours: these
-- two tables, the anon key the app already ships, and nothing else.
--
-- WHAT IS IN HERE. Event NAMES and a tiny allowlisted props bag — never a health
-- value. The client enforces that (services/telemetry/events.ts defines the only
-- events and props that exist; sanitize() drops anything else). No weight, no
-- calories, no cycle data, no free text, no advertising identifier.
--
-- IDENTITY. `install_id` is a random UUID generated on the device at first launch
-- and stored locally. It is not the ad id, not the device id, and survives neither
-- reinstall nor "Reset app data". `user_id` is attached only once someone signs in,
-- so the pre-signup funnel — where activation actually bleeds — is still measurable.
--
-- APPEND-ONLY, WRITE-ONLY. The client can INSERT and can do nothing else: no
-- select, no update, no delete, for anon or authenticated. A stolen anon key can
-- therefore write junk events (inherent to any client-side analytics) but cannot
-- read a single row back out. Reporting happens through the views at the bottom,
-- which are reachable only with the service role / SQL editor.
-- ───────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────── events ──────────────────────────────────────

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,

  -- Anonymous per-install id (see header). Not a foreign key: events are kept
  -- when an account is deleted only in anonymous form — see the deletion note.
  install_id   uuid        not null,

  -- Null until sign-in. ON DELETE SET NULL, so erasing an account de-identifies
  -- its events rather than punching holes in historical cohort counts.
  user_id      uuid        references auth.users (id) on delete set null,

  event        text        not null check (char_length(event) between 1 and 64),
  props        jsonb       not null default '{}'::jsonb,

  platform     text        check (platform in ('ios', 'android', 'web')),
  app_version  text        check (char_length(app_version) <= 32),

  -- Device clock. Useful for ordering within a session, NEVER for day-bucketing:
  -- a wrong phone clock would land a user in the wrong retention cohort.
  occurred_at  timestamptz not null,
  -- Server clock. This is what every view below buckets on.
  received_at  timestamptz not null default now()
);

-- Retention and funnel queries all group by install, then by day.
create index if not exists analytics_events_install_idx
  on public.analytics_events (install_id, received_at);
create index if not exists analytics_events_event_idx
  on public.analytics_events (event, received_at desc);

alter table public.analytics_events enable row level security;

-- INSERT only. The `user_id` check stops a client attributing its events to
-- somebody else's account; everything else is deliberately unconstrained because
-- the table holds nothing worth protecting from its own writer.
drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- No select/update/delete policy exists, so none is permitted. Stated explicitly
-- because "no policy" and "forgot the policy" look identical in a schema dump.
revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon, authenticated;

-- ────────────────────────────── crash reports ────────────────────────────────

create table if not exists public.crash_reports (
  id               bigint generated always as identity primary key,
  install_id       uuid        not null,
  user_id          uuid        references auth.users (id) on delete set null,

  -- Which <AppErrorBoundary> caught it: "root" | "navigation" | "tab:diet" | …
  surface          text        not null check (char_length(surface) <= 64),
  message          text        not null check (char_length(message) <= 300),
  stack            text        check (char_length(stack) <= 2000),
  component_stack  text        check (char_length(component_stack) <= 2000),

  platform         text        check (platform in ('ios', 'android', 'web')),
  app_version      text        check (char_length(app_version) <= 32),
  occurred_at      timestamptz not null,
  received_at      timestamptz not null default now()
);

-- The length caps above are the schema half of the exfil guard in
-- services/telemetry/CrashLog.ts: an error message can carry a value its throw
-- site interpolated, so there is a ceiling on how much of one can ever arrive.

create index if not exists crash_reports_surface_idx
  on public.crash_reports (surface, received_at desc);

alter table public.crash_reports enable row level security;

drop policy if exists crash_reports_insert on public.crash_reports;
create policy crash_reports_insert
  on public.crash_reports
  for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke all on public.crash_reports from anon, authenticated;
grant insert on public.crash_reports to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- THE FOUR NUMBERS
--
-- These views exist so the questions an investor asks are one SELECT away rather
-- than a weekend of SQL archaeology. They are owned by the migration role, so
-- they read past RLS — which is exactly why they are granted to service_role and
-- to nobody else. Never grant these to anon: that would turn a write-only table
-- into a readable one through the back door.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. ACTIVATION ─────────────────────────────────────────────────────────────
-- "Did a new install actually get going?" Activation = finished onboarding AND
-- logged something. Onboarding alone is not activation: a user who completes
-- setup and never logs a meal has not started using the product, and counting
-- them would flatter the number that matters most.
create or replace view public.analytics_activation as
with per_install as (
  select
    install_id,
    min(received_at)::date                            as cohort_day,
    bool_or(event = 'onboarding_start')               as started_setup,
    bool_or(event = 'onboarding_complete')            as finished_setup,
    bool_or(event in ('food_logged', 'water_logged', 'workout_logged')) as logged_anything,
    bool_or(event = 'activated')                      as activated
  from public.analytics_events
  group by install_id
)
select
  cohort_day,
  count(*)                                   as installs,
  count(*) filter (where started_setup)      as started_setup,
  count(*) filter (where finished_setup)     as finished_setup,
  count(*) filter (where logged_anything)    as logged_anything,
  count(*) filter (where activated)          as activated,
  round(100.0 * count(*) filter (where activated) / nullif(count(*), 0), 1)
                                             as activation_pct
from per_install
group by cohort_day
order by cohort_day desc;

-- ── 2. WHERE SETUP BLEEDS ─────────────────────────────────────────────────────
-- Onboarding is 1,823 lines and the single widest funnel in the app. Counting
-- distinct installs per step turns "people drop off in setup" into "61% never get
-- past the goal picker", which is actionable.
create or replace view public.analytics_onboarding_funnel as
select
  props ->> 'step'               as step,
  count(distinct install_id)     as reached
from public.analytics_events
where event = 'onboarding_step'
  and props ? 'step'
group by 1
order by reached desc;

-- ── 3. RETENTION (D1 / D7 / D30) ──────────────────────────────────────────────
-- Cohorted on the server clock (see the note on occurred_at). `d1` is the strict
-- definition — came back on the NEXT day. `returned_in_week_1` is the forgiving
-- one, and at small N it is the more honest signal: with 100 installs, strict D1
-- is a handful of people and moves on noise.
--
-- Read this with `installs` in view. A 40% D1 on 5 installs is two people.
create or replace view public.analytics_retention as
with first_seen as (
  select install_id, min(received_at)::date as cohort_day
  from public.analytics_events
  group by install_id
),
activity as (
  select distinct
    e.install_id,
    f.cohort_day,
    (e.received_at::date - f.cohort_day)::int as day_offset
  from public.analytics_events e
  join first_seen f on f.install_id = e.install_id
)
select
  cohort_day,
  count(distinct install_id)                                               as installs,
  count(distinct install_id) filter (where day_offset = 1)                 as d1,
  count(distinct install_id) filter (where day_offset between 1 and 7)     as returned_in_week_1,
  count(distinct install_id) filter (where day_offset = 7)                 as d7,
  count(distinct install_id) filter (where day_offset = 30)                as d30,
  round(100.0 * count(distinct install_id) filter (where day_offset = 1)
        / nullif(count(distinct install_id), 0), 1)                        as d1_pct,
  round(100.0 * count(distinct install_id) filter (where day_offset = 7)
        / nullif(count(distinct install_id), 0), 1)                        as d7_pct
from activity
group by cohort_day
order by cohort_day desc;

-- ── 4. PAYWALL CONVERSION ─────────────────────────────────────────────────────
-- Of the installs that saw the upgrade screen, how many paid. Split by `source`
-- too, because WHICH lock sent them is the thing you can actually change: a user
-- who hit the paywall from the coach composer wanted the coach, and that is a
-- different product question from one who hit it from habit #1.
create or replace view public.analytics_paywall as
with per_install as (
  select
    install_id,
    bool_or(event = 'paywall_view')     as saw_paywall,
    bool_or(event = 'trial_start')      as started_trial,
    bool_or(event = 'purchase_success') as purchased
  from public.analytics_events
  group by install_id
)
select
  count(*) filter (where saw_paywall)    as saw_paywall,
  count(*) filter (where started_trial)  as started_trial,
  count(*) filter (where purchased)      as purchased,
  round(100.0 * count(*) filter (where purchased)
        / nullif(count(*) filter (where saw_paywall), 0), 1) as conversion_pct
from per_install;

create or replace view public.analytics_paywall_by_source as
select
  props ->> 'source'          as source,
  count(distinct install_id)  as views
from public.analytics_events
where event = 'paywall_view'
  and props ? 'source'
group by 1
order by views desc;

-- ── 5. COST OF GOODS ──────────────────────────────────────────────────────────
-- tiers.ts says the 100-message ceiling "is now the whole margin" and calls it a
-- bet on the distribution. This view is how that bet gets checked against reality
-- instead of assumed: coach turns per paying install per day.
create or replace view public.analytics_coach_load as
select
  received_at::date           as day,
  count(*)                    as coach_messages,
  count(distinct install_id)  as installs_chatting,
  round(count(*)::numeric / nullif(count(distinct install_id), 0), 1)
                              as messages_per_install
from public.analytics_events
where event = 'coach_message'
group by 1
order by 1 desc;

-- ── Crash health ──────────────────────────────────────────────────────────────
create or replace view public.analytics_crash_rate as
select
  surface,
  count(*)                    as crashes,
  count(distinct install_id)  as installs_affected,
  max(received_at)            as last_seen,
  (array_agg(message order by received_at desc))[1] as latest_message
from public.crash_reports
group by surface
order by crashes desc;

-- Reporting is a service-role activity. The app's anon key must never read these.
revoke all on public.analytics_activation,
              public.analytics_onboarding_funnel,
              public.analytics_retention,
              public.analytics_paywall,
              public.analytics_paywall_by_source,
              public.analytics_coach_load,
              public.analytics_crash_rate
  from anon, authenticated;

grant select on public.analytics_activation,
                public.analytics_onboarding_funnel,
                public.analytics_retention,
                public.analytics_paywall,
                public.analytics_paywall_by_source,
                public.analytics_coach_load,
                public.analytics_crash_rate
  to service_role;
