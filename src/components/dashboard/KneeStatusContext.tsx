"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface KneeStatusContextValue {
  kneeStatus: number;
  saved: boolean;
  setKneeStatus: (n: number) => void;
}

const KneeStatusContext = createContext<KneeStatusContextValue | null>(null);

export function KneeStatusProvider({
  initialKneeStatus,
  children,
}: {
  initialKneeStatus: number | null;
  children: ReactNode;
}) {
  const [kneeStatus, setKneeStatusState] = useState(initialKneeStatus ?? 1);
  const [saved, setSaved] = useState(initialKneeStatus !== null);

  function setKneeStatus(n: number) {
    setKneeStatusState(n);
    setSaved(false);
    fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kneeStatus: n }),
    })
      .then(() => setSaved(true))
      .catch(() => {});
  }

  return (
    <KneeStatusContext.Provider value={{ kneeStatus, saved, setKneeStatus }}>
      {children}
    </KneeStatusContext.Provider>
  );
}

export function useKneeStatus(): KneeStatusContextValue {
  const ctx = useContext(KneeStatusContext);
  if (!ctx) throw new Error("useKneeStatus must be used within a KneeStatusProvider");
  return ctx;
}
