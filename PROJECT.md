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

- **Data source: Garmin Connect (Edge 840 + a Garmin watch), not Strava.**
  Strava gated Standard Tier API access behind a paid subscription in June
  2026; since the ride data already originates on Garmin devices, Strava
  would just be a costly middleman copy of it.
  - The Edge 840 alone gives ride data, Cycling VO2max, and Training
    Status/Load.
  - The watch adds HRV Status, Body Battery, and Sleep - none of these are
    available from an Edge-only setup (confirmed against Garmin's own docs
    and forums), so they only work because a watch is also synced.
  - Garmin's own daily "Training Readiness" score (0-100, blends HRV, sleep,
    recovery time, and acute:chronic workload) is pulled too and combined
    with our own power-based TSB for the readiness recommendation - see
    `src/lib/training/readiness.ts`. Two independent signals agreeing is a
    stronger basis for "take it easy today" than either alone.
- **Single Next.js + TypeScript app** for the product itself. Matches the
  day-job stack, one language end to end, no separate service to
  deploy/monitor for a solo side project.
- **Supabase** (Postgres + Auth + Storage) for data and file storage.
- **Garmin sync is a small, separate Python component, not a backend
  service.** `python-garminconnect` (the actively-maintained unofficial
  client) hits Garmin Connect's own internal web API, which returns
  pre-parsed per-second time series (power, cadence, HR, altitude, ...) as
  JSON — no FIT file parsing needed for data pulled this way.
  - This library is an arms race against Garmin's bot defenses (it broke for
    ~2 weeks in March 2026 before catching up) — acceptable for a scheduled
    job you can notice and fix, not something to build product-critical
    real-time flows on top of.
  - One-time local login (`scripts/garmin_login_once.py`, handles MFA)
    caches a session token; that cached token — not the raw password — is
    stored as a GitHub Actions secret and reused for ~a year.
  - `scripts/garmin_sync.py` runs in GitHub Actions: daily via `schedule`,
    or on demand via `workflow_dispatch` (triggered from the app through
    GitHub's API for a "sync now" button). Chosen over a Vercel Python
    function because Vercel's Hobby-tier 10s timeout is risky for a live
    login handshake; GitHub Actions has no such constraint.
  - New-ride ingestion from the app's own UI (manual FIT upload) is a
    fallback path, not the primary one — would need a JS FIT parser (e.g.
    `fit-file-parser`) since manually-downloaded files aren't pre-parsed.
- **Training engine** (FTP estimate, CTL/ATL/TSB, power-duration curve,
  interval detection, knee load score, readiness recommendation) is a plain
  TypeScript lib inside the Next.js app (`src/lib/training/`, unit-tested
  with vitest), callable from API routes. Keep it decoupled from the LLM
  layer — it produces structured facts (e.g. `{ recommendation: "easy",
  signals: {...} }`); the LLM only explains them in plain language, it never
  invents the recommendation itself.
- Workout generation triggers a sync in the background (non-blocking) rather
  than gating on it — the recommendation uses whatever's already in
  Supabase; the daily cron is what keeps that generally fresh.

## Phases

1. Garmin one-time historical import (locally run), then daily automated
   sync via GitHub Actions. Dashboard: ride list, FTP estimate, CTL/ATL/TSB,
   power-duration curve, plain-language AI ride summary.
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

- `activities` (built so far — see `supabase/schema.sql`): raw Garmin
  summary + parsed detail streams as jsonb, keyed by `garmin_activity_id`.
- `daily_wellness` (built so far): one row per calendar day — Garmin's
  training readiness score, HRV status, body battery, sleep, VO2max,
  training status, plus the full raw response as jsonb. `vo2max_cycling` and
  `training_status` are extracted best-effort since those two Garmin
  endpoints have no published schema — first real sync will confirm or fix
  the field paths in `scripts/garmin_sync.py`.
- `computed_metrics` (per-activity, output of the training engine) — the
  engine itself exists (`src/lib/training/`), this persisted table doesn't
  yet; add once an API route calls the engine on sync.
- `checkins` (post-ride subjective: knee, sleep, fatigue) — phase 3.
- `training_state` (CTL/ATL/TSB rollups over time) — same as
  `computed_metrics`: the calculation exists, the persisted rollup table
  doesn't yet.

## Explicitly deferred

- Strava as a data source — revisit only if Garmin sync proves too fragile
  and paying for Strava's API becomes worth it.
- Route-aware workout instructions ("ride to Döltschi, repeat this climb
  6x") — needs a segment/route database for regular loops. Phase 3+.
