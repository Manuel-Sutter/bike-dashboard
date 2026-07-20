#!/usr/bin/env python3
"""Run this once, locally, to authenticate with Garmin Connect and cache a session.

Usage:
    python scripts/garmin_login_once.py

Prompts for your Garmin email/password and, if enabled, an MFA code.
Saves a reusable session to ~/.garminconnect/garmin_tokens.json, which is what
the GitHub Actions sync workflow relies on (never your raw password).
"""

import sys
from getpass import getpass
from pathlib import Path

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

TOKENSTORE = str(Path("~/.garminconnect").expanduser())


def main():
    email = input("Garmin email: ").strip()
    password = getpass("Garmin password: ")

    try:
        garmin = Garmin(
            email=email,
            password=password,
            prompt_mfa=lambda: input("MFA code: ").strip(),
        )
        garmin.login(TOKENSTORE)
    except GarminConnectAuthenticationError:
        print("Login failed: wrong email/password or MFA code.")
        sys.exit(1)
    except GarminConnectTooManyRequestsError as err:
        print(f"Rate limited by Garmin, try again later: {err}")
        sys.exit(1)
    except GarminConnectConnectionError as err:
        print(f"Connection error: {err}")
        sys.exit(1)

    print(f"Login successful. Session cached at: {TOKENSTORE}/garmin_tokens.json")
    print()
    print("Next: turn that file into a GitHub Actions secret with:")
    print()
    print(
        f'  "/c/Program Files/GitHub CLI/gh.exe" secret set GARMIN_TOKENS_B64 '
        f'--repo Manuel-Sutter/bike-dashboard --body "$(base64 -w0 '
        f'\'{TOKENSTORE}/garmin_tokens.json\')"'
    )


if __name__ == "__main__":
    main()
