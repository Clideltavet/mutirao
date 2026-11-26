"use client";
import { useEffect } from "react";
import { refreshConfirmed } from "./confirmedStore";
export default function SharedDataSync() {
  useEffect(() => {
    let active = true;
    async function sync() {
      window.dispatchEvent(
        new CustomEvent("deltaVetSyncState", { detail: { syncing: true } }),
      );
      try {
        const data = await refreshConfirmed();
        if (active)
          window.dispatchEvent(
            new CustomEvent("deltaVetSyncResult", {
              detail: {
                ok: true,
                syncedAt: data.syncedAt,
                counts: { patients: data.patients?.length || 0 },
              },
            }),
          );
      } catch (e) {
        if (active)
          window.dispatchEvent(
            new CustomEvent("deltaVetSyncResult", {
              detail: { ok: false, error: e.message },
            }),
          );
      } finally {
        if (active)
          window.dispatchEvent(
            new CustomEvent("deltaVetSyncState", {
              detail: { syncing: false },
            }),
          );
      }
    }
    sync();
    const timer = setInterval(sync, 5000);
    const events = [
      "deltaVetManualSyncRequest",
      "online",
      "focus",
      "deltaVetAuthenticated",
    ];
    events.forEach((e) => window.addEventListener(e, sync));
    return () => {
      active = false;
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, sync));
    };
  }, []);
  return null;
}
