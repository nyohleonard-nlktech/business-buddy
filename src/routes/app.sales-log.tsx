import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Receipt as ReceiptIcon } from "lucide-react";
import { formatMoney } from "./app.index";
import { ReceiptModal, type ReceiptData } from "@/components/Receipt";

export const Route = createFileRoute("/app/sales-log")({
  component: SalesLog,
});


type Order = { id: string; created_at: string; recorded_by: string; total_amount: number; note: string | null };
type Line = { id: string; order_id: string; product_id: string; quantity: number; unit_sale_price_snapshot: number | null };
type Prod = { id: string; name: string; unit: string };

function SalesLog() {
  const { active } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);
  const [sortBy, setSortBy] = useState<"created_at" | "total_amount">("created_at");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase.from("orders").select("*").eq("business_id", active!.business_id);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to + "T23:59:59");
    const [{ data: o, error: e1 }, { data: p }] = await Promise.all([
      q,
      supabase.from(active!.role === "owner" ? "products_owner_view" : "products_worker_view")
        .select("id,name,unit").eq("business_id", active!.business_id),
    ]);
    if (e1) toast.error(e1.message);
    setOrders((o as Order[]) ?? []);
    setProds((p as Prod[]) ?? []);
    // lines for these orders
    const ids = (o as Order[] | null)?.map(x => x.id) ?? [];
    if (ids.length) {
      const view = active!.role === "owner" ? "stock_transactions_owner_view" : "stock_transactions_worker_view";
      const { data: l } = await supabase.from(view).select("id,order_id,product_id,quantity,unit_sale_price_snapshot").in("order_id", ids);
      setLines((l as Line[]) ?? []);
    } else setLines([]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active, from, to]);

  const sorted = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      const av = sortBy === "created_at" ? new Date(a.created_at).getTime() : a.total_amount;
      const bv = sortBy === "created_at" ? new Date(b.created_at).getTime() : b.total_amount;
      return sortDesc ? bv - av : av - bv;
    });
    return arr;
  }, [orders, sortBy, sortDesc]);

  const prodMap = useMemo(() => new Map(prods.map(p => [p.id, p])), [prods]);
  const linesByOrder = useMemo(() => {
    const m = new Map<string, Line[]>();
    for (const l of lines) {
      const arr = m.get(l.order_id) ?? [];
      arr.push(l); m.set(l.order_id, arr);
    }
    return m;
  }, [lines]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">Sales log</h1>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-xs text-muted-foreground">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-card px-2 py-2 text-sm" />
        </label>
        <label className="text-xs text-muted-foreground">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-card px-2 py-2 text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-muted-foreground">Sort:</span>
        <button onClick={() => setSortBy("created_at")} className={`rounded-md px-2 py-1 ${sortBy === "created_at" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Date</button>
        <button onClick={() => setSortBy("total_amount")} className={`rounded-md px-2 py-1 ${sortBy === "total_amount" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Amount</button>
        <button onClick={() => setSortDesc(!sortDesc)} className="ml-auto rounded-md bg-muted px-2 py-1">{sortDesc ? "↓" : "↑"}</button>
      </div>

      {loading ? <div className="text-muted-foreground text-sm">Loading…</div> : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No sales yet.</div>
      ) : (
        <ul className="space-y-2">
          {sorted.map(o => {
            const ls = linesByOrder.get(o.id) ?? [];
            const open = expanded === o.id;
            return (
              <li key={o.id} className="rounded-xl border border-border bg-card">
                <button onClick={() => setExpanded(open ? null : o.id)} className="w-full p-3 flex items-center gap-3 text-left">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{new Date(o.created_at).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{ls.length} item{ls.length !== 1 ? "s" : ""} · by {o.recorded_by.slice(0, 8)}…</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">{formatMoney(o.total_amount)}</div>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-border p-3 space-y-1">
                    {ls.map(l => {
                      const p = prodMap.get(l.product_id);
                      const sub = (l.unit_sale_price_snapshot ?? 0) * l.quantity;
                      return (
                        <div key={l.id} className="flex items-center justify-between text-sm">
                          <div>{l.quantity}× {p?.name ?? "Unknown"} <span className="text-muted-foreground">@ {formatMoney(l.unit_sale_price_snapshot)}</span></div>
                          <div className="font-semibold tabular-nums">{formatMoney(sub)}</div>
                        </div>
                      );
                    })}
                    {o.note && <div className="text-xs text-muted-foreground pt-1 border-t border-border mt-2">Note: {o.note}</div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
