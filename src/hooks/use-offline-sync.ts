import { useEffect, useState, useCallback } from "react";
import { computeDeltas, listPending, subscribe, syncNow, isSyncing, type Pending } from "@/lib/offline";

export function useOfflineSync(businessId: string | null) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [deltas, setDeltas] = useState<Map<string, number>>(new Map());
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!businessId) { setPending([]); setDeltas(new Map()); return; }
    const [p, d] = await Promise.all([listPending(businessId), computeDeltas(businessId)]);
    setPending(p);
    setDeltas(d);
    setSyncing(isSyncing());
  }, [businessId]);

  useEffect(() => {
    refresh();
    const unsub = subscribe(refresh);
    const on = () => { setOnline(true); void trigger(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { unsub(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const trigger = useCallback(async () => {
    if (!businessId) return;
    await syncNow(businessId);
    await refresh();
  }, [businessId, refresh]);

  // auto-sync on mount if online and there are pending items
  useEffect(() => {
    if (online && pending.length > 0 && !syncing) void trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, businessId]);

  return { pending, deltas, online, syncing, syncNow: trigger, refresh };
}
