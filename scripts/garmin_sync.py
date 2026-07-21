#!/usr/bin/env python3
"""Pull recent cycling activities and daily wellness data from Garmin Connect,
storing both in Supabase.

Resumes from a cached session only (see garmin_login_once.py) - never prompts
for credentials, so it can run unattended in GitHub Actions.

Required env vars:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
Optional:
    GARMINTOKENS (default ~/.garminconnect)
    SYNC_LIMIT (how many recent activities to check each run, default 20)
    WELLNESS_SYNC_DAYS (how many trailing days of wellness data to refresh
        each run, default 3 - covers a day or two of Garmin's own processing
        lag plus a missed run)
"""

import math
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import requests
from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TOKENSTORE = str(Path(os.getenv("GARMINTOKENS", "~/.garminconnect")).expanduser())
SYNC_LIMIT = int(os.getenv("SYNC_LIMIT", "20"))
WELLNESS_SYNC_DAYS = int(os.getenv("WELLNESS_SYNC_DAYS", "3"))

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def _to_int(value):
    # Garmin often sends whole-number fields (duration, scores) as floats
    # (e.g. 2607.376953125 seconds) - Postgres `integer` columns reject that
    # outright rather than truncating, so round explicitly before sending.
    return None if value is None else round(value)


def _sanitize_json(value):
    # Garmin's raw responses can contain NaN/Infinity for missing readings.
    # Python's default JSON encoder emits those as bare, non-standard tokens
    # that Postgres's jsonb parser rejects outright - swap them for null.
    if isinstance(value, float):
        return None if (math.isnan(value) or math.isinf(value)) else value
    if isinstance(value, dict):
        return {k: _sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_json(v) for v in value]
    return value


def _post_with_diagnostics(url, **kwargs):
    resp = requests.post(url, **kwargs)
    if not resp.ok:
        print(f"  Supabase error {resp.status_code} for {url}: {resp.text}")
    resp.raise_for_status()
    return resp


def login():
    try:
        garmin = Garmin()
        garmin.login(TOKENSTORE)
        return garmin
    except (GarminConnectAuthenticationError, GarminConnectConnectionError) as err:
        print(f"Could not resume Garmin session from {TOKENSTORE}: {err}")
        print("Re-run scripts/garmin_login_once.py locally and update the GitHub secret.")
        sys.exit(1)
    except GarminConnectTooManyRequestsError as err:
        print(f"Rate limited by Garmin: {err}")
        sys.exit(1)


def already_synced(garmin_activity_id):
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/activities",
        headers=SUPABASE_HEADERS,
        params={"garmin_activity_id": f"eq.{garmin_activity_id}", "select": "garmin_activity_id"},
        timeout=30,
    )
    resp.raise_for_status()
    return len(resp.json()) > 0


def extract_power_series(streams):
    # Port of src/lib/activity-streams.ts's extractPowerSeries. Garmin's
    # activity-details response is a sparse, irregularly-sampled "metrics
    # matrix" (observed ~7s between samples on longer rides, not a clean
    # 1-per-second series) - this resamples via forward-fill into a dense
    # array so the training engine's power functions (which assume one
    # sample per second) get something they can use. Keep in sync with the
    # TS version if the resampling logic ever changes.
    if not isinstance(streams, dict):
        return None
    descriptors = streams.get("metricDescriptors")
    rows = streams.get("activityDetailMetrics")
    if not isinstance(descriptors, list) or not isinstance(rows, list):
        return None

    power_idx = None
    duration_idx = None
    for d in descriptors:
        if d.get("key") == "directPower":
            power_idx = d.get("metricsIndex")
        elif d.get("key") == "sumDuration":
            duration_idx = d.get("metricsIndex")
    if power_idx is None or duration_idx is None:
        return None

    samples = []
    for row in rows:
        metrics = row.get("metrics")
        if not isinstance(metrics, list) or len(metrics) <= max(power_idx, duration_idx):
            continue
        t, watts = metrics[duration_idx], metrics[power_idx]
        if isinstance(t, (int, float)) and isinstance(watts, (int, float)):
            samples.append((round(t), watts))

    if not samples:
        return None

    samples.sort(key=lambda s: s[0])
    max_t = samples[-1][0]
    if max_t <= 0:
        return None

    series = [0] * (max_t + 1)
    sample_idx = 0
    last_watts = 0
    for t in range(max_t + 1):
        while sample_idx < len(samples) and samples[sample_idx][0] <= t:
            last_watts = samples[sample_idx][1]
            sample_idx += 1
        series[t] = last_watts
    return series


def insert_activity(summary, details):
    row = {
        "garmin_activity_id": summary["activityId"],
        "name": summary.get("activityName"),
        "activity_type": summary.get("activityType", {}).get("typeKey"),
        "started_at": summary.get("startTimeGMT"),
        "duration_s": _to_int(summary.get("duration")),
        "distance_m": summary.get("distance"),
        "elevation_gain_m": summary.get("elevationGain"),
        "avg_power_w": summary.get("avgPower"),
        "avg_heart_rate": summary.get("averageHR"),
        "avg_cadence": summary.get("averageBikingCadenceInRevPerMinute"),
        "summary": summary,
        "streams": details,
        "power_series": extract_power_series(details),
    }
    _post_with_diagnostics(
        f"{SUPABASE_URL}/rest/v1/activities",
        headers={**SUPABASE_HEADERS, "Prefer": "return=minimal"},
        json=_sanitize_json(row),
        timeout=30,
    )


def _latest_readiness(readiness_raw):
    if isinstance(readiness_raw, dict):
        return readiness_raw
    if isinstance(readiness_raw, list) and readiness_raw:
        return max(readiness_raw, key=lambda r: r.get("timestamp") or "")
    return {}


def _extract_vo2max_cycling(max_metrics_raw):
    # Undocumented endpoint (garminconnect returns dict[str, Any], no typed
    # schema) - best-effort guess at the shape, unverified against a real
    # response. If this keeps logging the "could not find" note below, print
    # max_metrics_raw during a manual run and fix the path.
    try:
        entry = max_metrics_raw[0] if isinstance(max_metrics_raw, list) else max_metrics_raw
        cycling = entry.get("cycling") or {}
        return cycling.get("vo2MaxValue") or cycling.get("vo2MaxPreciseValue")
    except (AttributeError, IndexError, KeyError, TypeError):
        return None


def _extract_training_status(training_status_raw):
    # trainingStatus is a numeric enum code, but the exact code->label
    # mapping proved unreliable when checked against this account's own
    # real data (a third-party mapping claimed 5="peaking"; this account
    # returned 5 alongside trainingStatusFeedbackPhrase="RECOVERY_1").
    # trainingStatusFeedbackPhrase is a human-readable string on the same
    # object ("RECOVERY_1", "PRODUCTIVE_2", etc.) - use that instead and
    # strip the trailing "_N" variant suffix.
    try:
        latest = training_status_raw["mostRecentTrainingStatus"]["latestTrainingStatusData"]
        for device_data in latest.values():
            phrase = device_data.get("trainingStatusFeedbackPhrase")
            if phrase:
                return phrase.split("_")[0]
    except (AttributeError, KeyError, TypeError):
        pass
    return None


def fetch_daily_wellness(garmin, day):
    readiness = _latest_readiness(garmin.get_training_readiness(day))
    hrv_raw = garmin.get_hrv_data(day) or {}
    hrv_summary = hrv_raw.get("hrvSummary") or {}
    stats = garmin.get_stats(day) or {}
    max_metrics = garmin.get_max_metrics(day)
    training_status = garmin.get_training_status(day)

    vo2max_cycling = _extract_vo2max_cycling(max_metrics)
    training_status_key = _extract_training_status(training_status)
    if vo2max_cycling is None:
        print(f"  note: could not find cycling VO2max in get_max_metrics({day}) response")
    if training_status_key is None:
        print(f"  note: could not find training status in get_training_status({day}) response")

    return {
        "date": day,
        "readiness_score": _to_int(readiness.get("score")),
        "readiness_level": readiness.get("level"),
        "readiness_feedback": readiness.get("feedbackLong"),
        "sleep_score": _to_int(readiness.get("sleepScore")),
        "recovery_time_minutes": _to_int(readiness.get("recoveryTime")),
        "hrv_status": hrv_summary.get("status"),
        "hrv_weekly_avg_ms": hrv_summary.get("weeklyAvg"),
        "hrv_last_night_avg_ms": hrv_summary.get("lastNightAvg"),
        "body_battery_high": _to_int(stats.get("bodyBatteryHighestValue")),
        "body_battery_low": _to_int(stats.get("bodyBatteryLowestValue")),
        "vo2max_cycling": vo2max_cycling,
        "training_status": training_status_key,
        "raw": {
            "training_readiness": readiness,
            "hrv": hrv_raw,
            "stats": stats,
            "max_metrics": max_metrics,
            "training_status": training_status,
        },
    }


def upsert_daily_wellness(row):
    _post_with_diagnostics(
        f"{SUPABASE_URL}/rest/v1/daily_wellness",
        headers={
            **SUPABASE_HEADERS,
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        params={"on_conflict": "date"},
        json=_sanitize_json(row),
        timeout=30,
    )


def sync_wellness(garmin):
    synced = 0
    for days_ago in range(WELLNESS_SYNC_DAYS):
        day = (date.today() - timedelta(days=days_ago)).isoformat()
        row = fetch_daily_wellness(garmin, day)
        upsert_daily_wellness(row)
        synced += 1
        print(f"Synced wellness for {day}")
    return synced


# Gym sessions matter for the knee-vs-load correlation (squats/quad loading
# affect the knee same as cycling does), so pull them alongside rides rather
# than filtering to cycling only. Filtering server-side via activitytype=
# turned out to be unreliable - Garmin's API rejects some values with
# "Activity type cannot be an activity sub type" depending on internal
# taxonomy quirks not documented anywhere. Fetching unfiltered and
# classifying by the real typeKey client-side sidesteps that entirely.
INTERESTING_ACTIVITY_TYPE_KEYS = {
    "cycling",
    "road_biking",
    "gravel_cycling",
    "mountain_biking",
    "virtual_ride",
    "indoor_cycling",
    "cyclocross",
    "track_cycling",
    "strength_training",
}


def main():
    garmin = login()

    raw_activities = garmin.get_activities(0, SYNC_LIMIT)
    activities = [
        a for a in raw_activities
        if (a.get("activityType") or {}).get("typeKey") in INTERESTING_ACTIVITY_TYPE_KEYS
    ]

    seen_type_keys = {(a.get("activityType") or {}).get("typeKey") for a in raw_activities}
    unmatched = seen_type_keys - INTERESTING_ACTIVITY_TYPE_KEYS
    if unmatched:
        print(f"  note: skipped activity type(s) not in our allowlist: {sorted(unmatched)}")

    new_count = 0
    for summary in activities:
        activity_id = summary["activityId"]
        if already_synced(activity_id):
            continue

        details = garmin.get_activity_details(activity_id)
        insert_activity(summary, details)
        new_count += 1
        print(f"Synced activity {activity_id}: {summary.get('activityName')}")

    print(f"Done. {new_count} new activity(ies) synced, {len(activities)} checked.")

    wellness_count = sync_wellness(garmin)
    print(f"Done. {wellness_count} day(s) of wellness data synced.")


if __name__ == "__main__":
    main()
