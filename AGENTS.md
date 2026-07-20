<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bike Dashboard

Personal project: cycling dashboard + adaptive coach built on Strava data.
See `PROJECT.md` for the full vision, phased roadmap, and architecture
decisions.

## Stack

- Next.js 15 (App Router) + TypeScript, single app — no separate backend
  service for the MVP (see `PROJECT.md` for why FIT parsing isn't needed).
- Supabase (Postgres + Auth + Storage).
- Package manager: npm.

## Rules

- Solo project — optimize for momentum over process. Small, direct commits.
- Training-engine calculations (FTP, CTL/ATL/TSB, knee load score, etc.) are
  plain, testable TypeScript functions, separate from anything that calls an
  LLM. The LLM explains numbers computed elsewhere; it never computes or
  invents them itself.
- No comments unless the WHY is genuinely non-obvious (same convention as
  the day job).
