import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { AlertTriangle, Bot, PackagePlus, Send, TrendingUp } from "lucide-react";
import { computeReportStats, rangeToSince, type ReportProduct, type ReportRange, type ReportTransaction } from "@/lib/report-stats";
import { askReportsAgent } from "./app.reports.agent.server";
import { formatMoney } from "./app.index";

export const Route = createFileRoute("/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { active } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });
  const [range, setRange] = useState<ReportRange>("30");
  const [txns, setTxns] = useState<ReportTransaction[]>([]);
  const [products, setProducts] = useState<ReportProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = rangeToSince(range);
      let q = supabase.from("stock_transactions_owner_view").select("*").eq("business_id", active!.business_id);
      if (since) q = q.gte("created_at", since);
      const [{ data: t, error: e1 }, { data: p, error: e2 }] = await Promise.all([
        q,
        supabase.from("products_owner_view").select("id,name,cost_price,current_stock,low_stock_threshold,unit").eq("business_id", active!.business_id),
      ]);
      if (e1 || e2) toast.error((e1 || e2)!.message);
      setTxns((t as ReportTransaction[]) ?? []);
      setProducts((p as ReportProduct[]) ?? []);
      setLoading(false);
    })();
  }, [active, range]);

  const stats = useMemo(() => computeReportStats(txns, products, range), [txns, products, range]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <select value={range} onChange={(e) => setRange(e.target.value as ReportRange)} className="rounded-md border border-input bg-card px-2 py-2 text-sm tap-target">
          <option value="today">Today</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <ReportsAgent businessId={active!.business_id} />

      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <>
          {stats.negativeStock.length > 0 && (
            <div className="rounded-xl border-2 border-destructive/50 bg-destructive/10 p-3 mb-4">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Stock discrepancy on {stats.negativeStock.length} product{stats.negativeStock.length > 1 ? "s" : ""}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                These went below zero — likely two people sold the last units offline before syncing. Restock or adjust to reconcile.
              </p>
              <div className="mt-2 text-sm space-y-1">
                {stats.negativeStock.map(p => (
                  <div key={p.id} className="flex justify-between">
                    <span className="truncate">{p.name}</span>
                    <span className="font-bold tabular-nums text-destructive">{p.current_stock} {p.unit}</span>
                  </div>
                ))}
              </div>
              <Link to="/app/restock" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-destructive text-destructive-foreground px-3 py-2 text-sm font-semibold tap-target">
                <PackagePlus className="h-4 w-4" /> Reconcile
              </Link>
            </div>
          )}
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

function ReportsAgent({ businessId }: { businessId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAnswer("");
    try {
      const result = await askReportsAgent({ data: { businessId, question: q } });
      setAnswer(result.answer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not answer that question";
      toast.error(message);
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3 mb-4">
      <div className="flex items-start gap-2">
        <div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-5 w-5" /></div>
        <div>
          <h2 className="font-semibold">Ask your reports</h2>
          <p className="text-xs text-muted-foreground">Owner-only. Try “how much profit today?” or “what's my best-selling product this week?”</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a business question…"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          maxLength={500}
          disabled={asking}
        />
        <button type="submit" disabled={asking || !question.trim()} className="tap-target rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60" aria-label="Ask reports">
          <Send className="h-5 w-5" />
        </button>
      </form>
      {asking && <div className="mt-3 text-sm text-muted-foreground">Checking your report data…</div>}
      {answer && <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm leading-relaxed">{answer}</div>}
    </section>
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
