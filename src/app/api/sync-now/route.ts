import { NextRequest, NextResponse } from "next/server";

const REPO_OWNER = "Manuel-Sutter";
const REPO_NAME = "bike-dashboard";
const WORKFLOW_FILE = "garmin-sync.yml";
const GITHUB_API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}`;

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function POST() {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GITHUB_ACTIONS_TOKEN not configured" }, { status: 500 });
  }

  const dispatchedAt = new Date().toISOString();
  const resp = await fetch(`${GITHUB_API_BASE}/dispatches`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: `GitHub API error: ${resp.status} ${text}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, dispatchedAt });
}

export async function GET(request: NextRequest) {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GITHUB_ACTIONS_TOKEN not configured" }, { status: 500 });
  }

  const since = request.nextUrl.searchParams.get("since");
  if (!since) {
    return NextResponse.json({ error: "missing since param" }, { status: 400 });
  }

  const resp = await fetch(`${GITHUB_API_BASE}/runs?per_page=5`, {
    headers: githubHeaders(token),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: `GitHub API error: ${resp.status} ${text}` }, { status: 502 });
  }

  const data = await resp.json();
  const sinceMs = new Date(since).getTime();
  // workflow_dispatch runs typically appear within a few seconds - a small
  // buffer avoids missing the run due to clock/API latency.
  const run = (data.workflow_runs ?? []).find(
    (r: { created_at: string }) => new Date(r.created_at).getTime() >= sinceMs - 10_000
  );

  if (!run) {
    return NextResponse.json({ status: "not_found" });
  }
  return NextResponse.json({
    status: run.status === "completed" ? "completed" : run.status,
    conclusion: run.conclusion,
    runUrl: run.html_url,
  });
}
