"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike } from "lucide-react";
import styles from "./SyncNowButton.module.css";

type SyncState = "idle" | "dispatching" | "polling" | "completed" | "failed" | "timed_out" | "error";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 36; // 3 minutes

// Rotates while we wait on the Action - the raw GitHub run status
// ("queued"/"in_progress") isn't meaningful to glance at, so show something
// fun instead.
const IN_PROGRESS_LINES = [
  "Clipping in…",
  "Spinning up the legs…",
  "Chasing your watts down from Garmin…",
  "Drafting behind the Actions runner…",
  "Climbing the data mountain…",
  "Bunny-hopping past rate limits…",
];

export function SyncNowButton() {
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pollCount = useRef(0);
  const router = useRouter();

  async function poll(since: string) {
    if (pollCount.current >= MAX_POLLS) {
      setState("timed_out");
      setMessage("Still running after 3 min — check the GitHub Actions tab.");
      return;
    }
    pollCount.current += 1;

    try {
      const res = await fetch(`/api/sync-now?since=${encodeURIComponent(since)}`);
      const data = await res.json();

      if (data.status === "completed") {
        if (data.conclusion === "success") {
          setState("completed");
          setMessage("Synced! Refreshing…");
          router.refresh();
        } else {
          setState("failed");
          setMessage(`Sync failed (${data.conclusion}). Check the Actions tab.`);
        }
        return;
      }

      setState("polling");
      setMessage(IN_PROGRESS_LINES[pollCount.current % IN_PROGRESS_LINES.length]);
      setTimeout(() => poll(since), POLL_INTERVAL_MS);
    } catch {
      setState("error");
      setMessage("Couldn't check sync status.");
    }
  }

  async function handleClick() {
    setState("dispatching");
    setMessage(IN_PROGRESS_LINES[0]);
    pollCount.current = 0;

    try {
      const res = await fetch("/api/sync-now", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Failed to start sync.");
        return;
      }
      setState("polling");
      setMessage(IN_PROGRESS_LINES[1]);
      setTimeout(() => poll(data.dispatchedAt), POLL_INTERVAL_MS);
    } catch {
      setState("error");
      setMessage("Couldn't reach the sync endpoint.");
    }
  }

  const busy = state === "dispatching" || state === "polling";

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={handleClick} disabled={busy}>
        <Bike size={14} className={busy ? styles.spinning : undefined} />
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {message && <span className={styles.message}>{message}</span>}
    </div>
  );
}
