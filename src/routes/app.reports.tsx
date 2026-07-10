import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { formatMoney } from "./app.index";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

type Txn = {
  id: string; product_id: string; type: "sale" | "restock" | "adjustment";
  quantity: number; unit_cost_snapshot: number; unit_sale_price_snapshot: number | null;
  created_at: string;
};
type Prod = { id: string; name: string; cost_price: number; current_stock: number };

function ReportsPage() {
  const { active } = useApp();
  if (active!.role !== "owner") {
    throw redirect({ to: "/app" });
  }
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = range === "all" ? null : new Date(Date.now() - parseInt(range) * 86400_000).toISOString();
      let q = supabase.from("stock_transactions_owner_view").select("*").eq("business_id", active!.business_id);
      if (since) q = q.gte("created_at", since);
      const [{ data: t, error: e1 }, { data: p, error: e2 }] = await Promise.all([
        q,
        supabase.from("products_owner_view").select("id,name,cost_price,current_stock").eq("business_id", active!.business_id),
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
    return { revenue, profit: revenue - cost, unitsSold, valuation, top };
  }, [txns, products]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Reports</h1>
        <select value={range} onChange={(e) => setRange(e.target.value as any)} className="rounded-md border border-input bg-card px-2 py-2 text-sm tap-target">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Revenue" value={formatMoney(stats.revenue)} />
            <Stat label="Profit" value={formatMoney(stats.profit)} accent />
            <Stat label="Units sold" value={stats.unitsSold.toString()} />
            <Stat label="Stock value" value={formatMoney(stats.valuation)} />
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
