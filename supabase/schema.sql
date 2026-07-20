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
  synced_at timestamptz not null default now()
);

create index if not exists activities_started_at_idx on activities (started_at desc);
