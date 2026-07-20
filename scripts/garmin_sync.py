#!/usr/bin/env python3
"""Pull recent cycling activities from Garmin Connect and store new ones in Supabase.

Resumes from a cached session only (see garmin_login_once.py) - never prompts
for credentials, so it can run unattended in GitHub Actions.

Required env vars:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
Optional:
    GARMINTOKENS (default ~/.garminconnect)
    SYNC_LIMIT (how many recent activities to check each run, default 20)
"""

import os
import sys
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


if __name__ == "__main__":
    main()
