# Bike Dashboard — Adaptive Cycling Coach

## Vision

Not "AI writes workouts" — a coach that learns from your own ride data (power,
cadence, HR, terrain) plus your own feedback (knee, sleep, fatigue) and
explains its recommendations in plain language. The differentiator vs.
TrainerRoad/TrainingPeaks: it's grounded in your specific physiology and
injury constraints (knee), not a generic TSS model.

## Core loop

Strava sync → computed training metrics (FTP estimate, CTL/ATL/TSB,
power-duration curve, cadence patterns, knee load estimate) → post-ride
subjective check-in (fatigue / knee / sleep) → coach layer explains today's
readiness and recommends the next workout, grounded in the computed metrics.
The LLM explains numbers, it does not invent them.

## Architecture decision (diverges from the original brainstorm)

- **Single Next.js + TypeScript app.** Matches the day-job stack, one
  language end to end, no separate service to deploy/monitor for a solo side
  project.
- **Supabase** (Postgres + Auth + Storage) for data and file storage.
- **No Python/FIT-parsing service in the MVP.** Strava's Activity Streams API
  (`GET /activities/{id}/streams`) already returns per-second time series
  (time, watts, heartrate, cadence, altitude, latlng, velocity_smooth, temp)
  as JSON — there's no FIT file to parse for Strava-sourced rides.
- Revisit a parsing service only if/when raw FIT files are imported directly
  from Garmin/Wahoo, bypassing Strava — and even then, try a JS FIT parser
  (e.g. `fit-file-parser`) before reaching for Python, to keep one runtime.
- **Training engine** (FTP estimate, CTL/ATL/TSB, power-duration curve,
  interval detection, knee load score) is a plain TypeScript lib, callable
  from API routes and a scheduled sync job. Keep it decoupled from the LLM
  layer — it produces structured facts; the LLM only explains them.
- **Sync strategy:** one-time full historical import via Strava API, then
  Strava webhooks for new activities. Own the data and computed metrics
  locally rather than re-fetching from Strava on every page load.

## Phases

1. Strava OAuth, one-time historical sync, webhook for new rides. Dashboard:
   ride list, FTP estimate, CTL/ATL/TSB, power-duration curve, plain-language
   AI ride summary.
2. Workout generator: rule-based recommendation from training load +
   readiness inputs.
3. Subjective tracking: knee, sleep, gym, RPE check-ins after each ride.
4. Learning layer: correlate subjective outcomes (e.g. knee soreness lag,
   cadence) with training patterns; surface as insights and feed into the
   recommender.

## Custom metrics to build toward

- **Knee Load Score** — function of time >85% FTP, inverse cadence, torque
  estimate, climbing %, eccentric braking.
- **Durability Index** — 20-min power late in a long ride vs. fresh.
- **Road Performance Score** — FTP + threshold durability + climbing power +
  cadence efficiency + fatigue resistance, tuned to actual riding (long
  Zürich climbs) rather than a single lab FTP number.

## Data model sketch (refine once building)

- `strava_accounts` (tokens)
- `activities` (raw summary from Strava)
- `activity_streams` (time series per activity — likely Storage-backed
  compressed JSON rather than one Postgres row per second)
- `computed_metrics` (per-activity, output of the training engine)
- `checkins` (post-ride subjective: knee, sleep, fatigue)
- `training_state` (CTL/ATL/TSB rollups over time)

## Explicitly deferred

- Garmin integration — no official public API, revisit via a community
  library later.
- Route-aware workout instructions ("ride to Döltschi, repeat this climb
  6x") — needs a segment/route database for regular loops. Phase 3+.
