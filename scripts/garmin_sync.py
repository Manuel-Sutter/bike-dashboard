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


def insert_activity(summary, details):
    row = {
        "garmin_activity_id": summary["activityId"],
        "name": summary.get("activityName"),
        "activity_type": summary.get("activityType", {}).get("typeKey"),
        "started_at": summary.get("startTimeGMT"),
        "duration_s": summary.get("duration"),
        "distance_m": summary.get("distance"),
        "elevation_gain_m": summary.get("elevationGain"),
        "avg_power_w": summary.get("avgPower"),
        "avg_heart_rate": summary.get("averageHR"),
        "avg_cadence": summary.get("averageBikingCadenceInRevPerMinute"),
        "summary": summary,
        "streams": details,
    }
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/activities",
        headers={**SUPABASE_HEADERS, "Prefer": "return=minimal"},
        json=row,
        timeout=30,
    )
    resp.raise_for_status()


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
    # Same caveat as _extract_vo2max_cycling - undocumented endpoint shape.
    try:
        latest = training_status_raw["mostRecentTrainingStatus"]["latestTrainingStatusData"]
        for device_data in latest.values():
            status = device_data.get("trainingStatus")
            if status:
                return status
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
        "readiness_score": readiness.get("score"),
        "readiness_level": readiness.get("level"),
        "readiness_feedback": readiness.get("feedbackLong"),
        "sleep_score": readiness.get("sleepScore"),
        "recovery_time_minutes": readiness.get("recoveryTime"),
        "hrv_status": hrv_summary.get("status"),
        "hrv_weekly_avg_ms": hrv_summary.get("weeklyAvg"),
        "hrv_last_night_avg_ms": hrv_summary.get("lastNightAvg"),
        "body_battery_high": stats.get("bodyBatteryHighestValue"),
        "body_battery_low": stats.get("bodyBatteryLowestValue"),
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
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/daily_wellness",
        headers={
            **SUPABASE_HEADERS,
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        params={"on_conflict": "date"},
        json=row,
        timeout=30,
    )
    resp.raise_for_status()


def sync_wellness(garmin):
    synced = 0
    for days_ago in range(WELLNESS_SYNC_DAYS):
        day = (date.today() - timedelta(days=days_ago)).isoformat()
        row = fetch_daily_wellness(garmin, day)
        upsert_daily_wellness(row)
        synced += 1
        print(f"Synced wellness for {day}")
    return synced


def main():
    garmin = login()
    activities = garmin.get_activities(0, SYNC_LIMIT, activitytype="cycling")

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
