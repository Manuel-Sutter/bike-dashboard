create table if not exists activities (
  id bigint generated always as identity primary key,
  garmin_activity_id bigint not null unique,
  name text,
  activity_type text,
  started_at timestamptz,
  duration_s integer,
  distance_m double precision,
  elevation_gain_m double precision,
  avg_power_w double precision,
  avg_heart_rate double precision,
  avg_cadence double precision,
  summary jsonb not null,
  streams jsonb,
  -- Compact one-value-per-second watts array, derived from streams at sync
  -- time. streams itself can be 1MB+ per ride (mostly GPS trace we never
  -- use) - querying it for every ride in a dashboard/rides-page window was
  -- taking 5+ seconds and transferring ~30MB for just 39 rides. Everything
  -- that needs power data (TSS, FTP estimate, ride classification) should
  -- read this column, never streams.
  power_series jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists activities_started_at_idx on activities (started_at desc);

-- One row per calendar day. Populated from the Garmin watch (HRV, body
-- battery, sleep, training readiness) plus the Edge 840 (VO2max, training
-- status) - see scripts/garmin_sync.py. vo2max_cycling and training_status
-- are extracted best-effort since Garmin doesn't publish a typed schema for
-- those two endpoints; raw always has the full untouched response.
create table if not exists daily_wellness (
  id bigint generated always as identity primary key,
  date date not null unique,

  readiness_score integer,
  readiness_level text,
  readiness_feedback text,

  sleep_score integer,
  recovery_time_minutes integer,

  hrv_status text,
  hrv_weekly_avg_ms double precision,
  hrv_last_night_avg_ms double precision,

  body_battery_high integer,
  body_battery_low integer,

  vo2max_cycling double precision,
  training_status text,

  raw jsonb not null,
  synced_at timestamptz not null default now()
);

create index if not exists daily_wellness_date_idx on daily_wellness (date desc);

-- Manual daily check-in - the one signal Garmin can't provide. Kept to just
-- knee status for now; expand later (fatigue/RPE) if that alone proves
-- useful once there's a few weeks of real data.
create table if not exists checkins (
  id bigint generated always as identity primary key,
  date date not null unique,
  knee_status integer not null check (knee_status between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists checkins_date_idx on checkins (date desc);
