import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { AlertTriangle, TrendingUp, PackagePlus } from "lucide-react";
import { formatMoney } from "./app.index";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

type Txn = {
  id: string; product_id: string; type: "sale" | "restock" | "adjustment";
  quantity: number; unit_cost_snapshot: number; unit_sale_price_snapshot: number | null;
  created_at: string;
};
type Prod = { id: string; name: string; cost_price: number; current_stock: number; low_stock_threshold: number; unit: string };

function ReportsPage() {
  const { active } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });
  const [range, setRange] = useState<"today" | "7" | "30" | "90" | "all">("30");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let since: string | null = null;
      if (range === "today") { const d = new Date(); d.setHours(0, 0, 0, 0); since = d.toISOString(); }
      else if (range !== "all") since = new Date(Date.now() - parseInt(range) * 86400_000).toISOString();
      let q = supabase.from("stock_transactions_owner_view").select("*").eq("business_id", active!.business_id);
      if (since) q = q.gte("created_at", since);
      const [{ data: t, error: e1 }, { data: p, error: e2 }] = await Promise.all([
        q,
        supabase.from("products_owner_view").select("id,name,cost_price,current_stock,low_stock_threshold,unit").eq("business_id", active!.business_id),
      ]);
      if (e1 || e2) toast.error((e1 || e2)!.message);
      setTxns((t as Txn[]) ?? []);
      setProducts((p as Prod[]) ?? []);
      setLoading(false);
    })();
  }, [active, range]);

  const stats = useMemo(() => {
    const sales = txns.filter(t => t.type === "sale");
    let revenue = 0, cost = 0, unitsSold = 0;
    const perProduct = new Map<string, { units: number; revenue: number; profit: number }>();
    for (const s of sales) {
      const rev = (s.unit_sale_price_snapshot ?? 0) * s.quantity;
      const c = s.unit_cost_snapshot * s.quantity;
      revenue += rev; cost += c; unitsSold += s.quantity;
      const cur = perProduct.get(s.product_id) ?? { units: 0, revenue: 0, profit: 0 };
      cur.units += s.quantity; cur.revenue += rev; cur.profit += rev - c;
      perProduct.set(s.product_id, cur);
    }
    const valuation = products.reduce((sum, p) => sum + p.cost_price * p.current_stock, 0);
    const top = [...perProduct.entries()]
      .map(([pid, v]) => ({ ...v, name: products.find(p => p.id === pid)?.name ?? "Unknown" }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    // daily trend last N days
    const days = range === "today" ? 1 : range === "7" ? 7 : range === "30" ? 30 : range === "90" ? 90 : 30;
    const byDay: { day: string; rev: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay.push({ day: key, rev: 0 });
    }
    const dayMap = new Map(byDay.map(x => [x.day, x]));
    for (const s of sales) {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) bucket.rev += (s.unit_sale_price_snapshot ?? 0) * s.quantity;
    }
    const maxRev = Math.max(1, ...byDay.map(d => d.rev));
    const lowStock = products.filter(p => p.current_stock <= p.low_stock_threshold);
    return { revenue, profit: revenue - cost, unitsSold, valuation, top, byDay, maxRev, lowStock };
  }, [txns, products, range]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <select value={range} onChange={(e) => setRange(e.target.value as any)} className="rounded-md border border-input bg-card px-2 py-2 text-sm tap-target">
          <option value="today">Today</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <>
          {stats.lowStock.length > 0 && (
            <div className="rounded-xl border-2 border-warning/50 bg-warning/10 p-3 mb-4">
              <div className="flex items-center gap-2 font-semibold text-warning-foreground">
                <AlertTriangle className="h-5 w-5 text-warning" />
                {stats.lowStock.length} product{stats.lowStock.length > 1 ? "s" : ""} low on stock
              </div>
              <div className="mt-2 text-sm space-y-1">
                {stats.lowStock.slice(0, 4).map(p => (
                  <div key={p.id} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="font-bold tabular-nums">{p.current_stock} {p.unit}</span>
                  </div>
                ))}
                {stats.lowStock.length > 4 && <div className="text-xs text-muted-foreground">and {stats.lowStock.length - 4} more…</div>}
              </div>
              <Link to="/app/restock" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-warning text-warning-foreground px-3 py-2 text-sm font-semibold tap-target">
                <PackagePlus className="h-4 w-4" /> Restock now
              </Link>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Revenue" value={formatMoney(stats.revenue)} />
            <Stat label="Profit" value={formatMoney(stats.profit)} accent />
            <Stat label="Units sold" value={stats.unitsSold.toString()} />
            <Stat label="Stock value" value={formatMoney(stats.valuation)} />
          </div>

          <h2 className="mt-6 mb-2 font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Daily revenue</h2>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-end gap-1 h-24">
              {stats.byDay.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-t bg-primary/70" style={{ height: `${(d.rev / stats.maxRev) * 100}%`, minHeight: d.rev > 0 ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{stats.byDay[0]?.day.slice(5)}</span>
              <span>{stats.byDay[stats.byDay.length - 1]?.day.slice(5)}</span>
            </div>
          </div>

          <h2 className="mt-6 mb-2 font-semibold">Top products</h2>
          {stats.top.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No sales in this range yet.</div>
          ) : (
            <ul className="space-y-2">
              {stats.top.map((row, i) => (
                <li key={i} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.units} sold · rev {formatMoney(row.revenue)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-success">{formatMoney(row.profit)}</div>
                    <div className="text-xs text-muted-foreground">profit</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`text-xs ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
