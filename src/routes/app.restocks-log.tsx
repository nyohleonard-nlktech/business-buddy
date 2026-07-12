import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { formatMoney } from "./app.index";

export const Route = createFileRoute("/app/restocks-log")({
  component: RestocksLog,
});

type T = { id: string; created_at: string; product_id: string; quantity: number; unit_cost_snapshot: number; recorded_by: string; note: string | null };
type Prod = { id: string; name: string; unit: string };

function RestocksLog() {
  const { active } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });
  const [txns, setTxns] = useState<T[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    let q = supabase.from("stock_transactions_owner_view").select("id,created_at,product_id,quantity,unit_cost_snapshot,recorded_by,note")
      .eq("business_id", active!.business_id).eq("type", "restock");
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to + "T23:59:59");
    const [{ data: t, error }, { data: p }] = await Promise.all([
      q.order("created_at", { ascending: false }),
      supabase.from("products_owner_view").select("id,name,unit").eq("business_id", active!.business_id),
    ]);
    if (error) toast.error(error.message);
    setTxns((t as T[]) ?? []);
    setProds((p as Prod[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active, from, to]);

  const prodMap = useMemo(() => new Map(prods.map(p => [p.id, p])), [prods]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">Restock log</h1>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <label className="text-xs text-muted-foreground">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-card px-2 py-2 text-sm" />
        </label>
        <label className="text-xs text-muted-foreground">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-card px-2 py-2 text-sm" />
        </label>
      </div>

      {loading ? <div className="text-muted-foreground text-sm">Loading…</div> : txns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No restocks yet.</div>
      ) : (
        <ul className="space-y-2">
          {txns.map(t => {
            const p = prodMap.get(t.product_id);
            const total = t.quantity * t.unit_cost_snapshot;
            return (
              <li key={t.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{p?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · by {t.recorded_by.slice(0, 8)}…</div>
                    {t.note && <div className="text-xs text-muted-foreground mt-1">{t.note}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums">+{t.quantity} {p?.unit}</div>
                    <div className="text-xs text-muted-foreground">@ {formatMoney(t.unit_cost_snapshot)}</div>
                    <div className="text-sm font-semibold tabular-nums mt-1">{formatMoney(total)}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
