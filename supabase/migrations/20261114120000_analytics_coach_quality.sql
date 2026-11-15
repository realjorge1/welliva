-- ═══════════════════════════════════════════════════════════════════════════════
-- HOW SMART IS THE COACH, REALLY — analytics_coach_quality
--
-- One row per day from the app's `coach_turn` event (services/telemetry/events.ts):
-- how many coach turns there were, what share the model actually answered, and,
-- when it didn't, why. Before this, nothing recorded whether Gozlin answered or
-- fell back to its simpler offline replies; the in-memory counters reset every
-- time the app closed.
--
-- The event carries three props and nothing else: `result` (a closed list of
-- outcome words the code chooses), `tools` (a count) and `seconds` (the wait,
-- one decimal). No question, no reply, no tool names.
--
-- answered_share = turns the model's reply reached the person (first time or
-- after one correction) ÷ all turns. Every turn counts in the denominator,
-- including the safety screen and turns with no connection, because from the
-- person's side those are all "asked the coach something".
--
-- Bucketed on received_at (the server clock), like every other analytics view.
-- Props are read defensively: the table accepts inserts from the app's anon key,
-- so a malformed value must give a NULL, never break the view.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace view public.analytics_coach_quality as
with turns as (
  select
    received_at::date as day,
    props ->> 'result' as result,
    case when jsonb_typeof(props -> 'tools') = 'number'
         then (props ->> 'tools')::numeric end as tools,
    case when jsonb_typeof(props -> 'seconds') = 'number'
         then (props ->> 'seconds')::numeric end as seconds
  from public.analytics_events
  where event = 'coach_turn'
)
select
  day,
  count(*)                                                        as turns,
  round(
    count(*) filter (where result in ('answered',
                                      'answered_after_fix_number',
                                      'answered_after_fix_safety'))::numeric
    / nullif(count(*), 0), 3)                                     as answered_share,
  count(*) filter (where result = 'answered')                     as answered,
  count(*) filter (where result = 'answered_after_fix_number')    as answered_after_fix_number,
  count(*) filter (where result = 'answered_after_fix_safety')    as answered_after_fix_safety,
  count(*) filter (where result = 'ungrounded')                   as ungrounded,
  count(*) filter (where result = 'unsafe')                       as unsafe,
  count(*) filter (where result = 'refused')                      as refused,
  count(*) filter (where result = 'empty')                        as empty,
  count(*) filter (where result = 'malformed')                    as malformed,
  count(*) filter (where result = 'loop_cap')                     as loop_cap,
  count(*) filter (where result = 'offline')                      as offline,
  count(*) filter (where result = 'no_backend')                   as no_backend,
  count(*) filter (where result = 'cancelled')                    as cancelled,
  count(*) filter (where result = 'clinical_screen')              as clinical_screen,
  count(*) filter (where result = 'locked')                       as locked,
  percentile_cont(0.5) within group (order by seconds)            as median_seconds,
  round(avg(tools), 2)                                            as avg_tool_calls
from turns
group by day
order by day desc;

-- Reporting is a service-role activity (the grants pattern of
-- 20261030120000_analytics.sql). The view is owned by the migration role, so it
-- reads past RLS — which is exactly why the app's keys must never read it.
revoke all on public.analytics_coach_quality from anon, authenticated;
grant select on public.analytics_coach_quality to service_role;
