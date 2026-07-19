import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { AlertTriangle, Bot, PackagePlus, Send, TrendingUp } from "lucide-react";
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
type Range = "today" | "7" | "30" | "90" | "all";

type ReportStats = ReturnType<typeof computeReportStats>;

const askReportsAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Invalid request");
    const input = data as { businessId?: unknown; question?: unknown };
    const businessId = typeof input.businessId === "string" ? input.businessId : "";
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(businessId)) throw new Error("Invalid business");
    if (question.length < 3) throw new Error("Ask a question first");
    if (question.length > 500) throw new Error("Question is too long");
    return { businessId, question };
  })
  .handler(async ({ data, context }) => {
    const { supabase: authedSupabase, userId } = context;

    // Owner gate: never query owner report views until the authenticated user is
    // an owner member of this exact business. A worker cannot bypass this by
    // changing the wording of the natural-language question.
    const { data: ownerMembership, error: ownerError } = await authedSupabase
      .from("business_members")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (ownerError) throw new Error(ownerError.message);
    if (!ownerMembership) throw new Error("Only business owners can ask report questions.");

    const since = startOfLocalDayIso(new Date(Date.now() - 90 * 86400_000));
    const [{ data: txns, error: txnsError }, { data: products, error: productsError }] = await Promise.all([
      authedSupabase
        .from("stock_transactions_owner_view")
        .select("id,product_id,type,quantity,unit_cost_snapshot,unit_sale_price_snapshot,created_at")
        .eq("business_id", data.businessId)
        .gte("created_at", since),
      authedSupabase
        .from("products_owner_view")
        .select("id,name,cost_price,current_stock,low_stock_threshold,unit")
        .eq("business_id", data.businessId),
    ]);

    if (txnsError || productsError) throw new Error((txnsError || productsError)!.message);

    const cleanTxns = (txns as Txn[] | null) ?? [];
    const cleanProducts = (products as Prod[] | null) ?? [];
    const contextPayload = buildAgentContext(cleanTxns, cleanProducts);
    const answer = await formatAnswerWithGpt(data.question, contextPayload);
    return { answer };
  });

function ReportsPage() {
  const { active } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });
  const [range, setRange] = useState<Range>("30");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
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
      setTxns((t as Txn[]) ?? []);
      setProducts((p as Prod[]) ?? []);
      setLoading(false);
    })();
  }, [active, range]);

  const stats = useMemo(() => computeReportStats(txns, products, range), [txns, products, range]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="rounded-md border border-input bg-card px-2 py-2 text-sm tap-target">
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

function computeReportStats(txns: Txn[], products: Prod[], range: Range) {
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
  const lowStock = products.filter(p => p.current_stock <= p.low_stock_threshold && p.current_stock >= 0);
  const negativeStock = products.filter(p => p.current_stock < 0);
  return { revenue, profit: revenue - cost, unitsSold, valuation, top, byDay, maxRev, lowStock, negativeStock };
}

function rangeToSince(range: Range): string | null {
  if (range === "today") return startOfLocalDayIso(new Date());
  if (range === "all") return null;
  return new Date(Date.now() - parseInt(range) * 86400_000).toISOString();
}

function startOfLocalDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function buildAgentContext(txns: Txn[], products: Prod[]) {
  const ranges: Record<"today" | "week" | "month" | "last90Days", ReportStats> = {
    today: computeReportStats(txns.filter(t => new Date(t.created_at) >= new Date(startOfLocalDayIso(new Date()))), products, "today"),
    week: computeReportStats(txns.filter(t => Date.now() - new Date(t.created_at).getTime() <= 7 * 86400_000), products, "7"),
    month: computeReportStats(txns.filter(t => Date.now() - new Date(t.created_at).getTime() <= 30 * 86400_000), products, "30"),
    last90Days: computeReportStats(txns, products, "90"),
  };

  return {
    generatedAt: new Date().toISOString(),
    availablePeriod: "last 90 days plus current product stock/cost data",
    totals: Object.fromEntries(Object.entries(ranges).map(([key, stats]) => [key, summarizeStats(stats)])),
    lowStock: ranges.last90Days.lowStock.map(p => ({ name: p.name, stock: p.current_stock, unit: p.unit, threshold: p.low_stock_threshold })).slice(0, 20),
    negativeStock: ranges.last90Days.negativeStock.map(p => ({ name: p.name, stock: p.current_stock, unit: p.unit })).slice(0, 20),
    currentStockValue: ranges.last90Days.valuation,
  };
}

function summarizeStats(stats: ReportStats) {
  return {
    revenue: roundMoney(stats.revenue),
    profit: roundMoney(stats.profit),
    unitsSold: stats.unitsSold,
    topProducts: stats.top.slice(0, 10).map(p => ({ name: p.name, unitsSold: p.units, revenue: roundMoney(p.revenue), profit: roundMoney(p.profit) })),
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function formatAnswerWithGpt(question: string, reportContext: ReturnType<typeof buildAgentContext>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackAgentAnswer(question, reportContext);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-5.6",
      input: [
        {
          role: "system",
          content: "You answer a small-business owner's report questions in plain language. Use only the supplied JSON report context. If data is missing or outside the available period, say so. Keep answers concise and include exact numbers from the data.",
        },
        { role: "user", content: JSON.stringify({ question, reportContext }) },
      ],
    }),
  });

  if (!response.ok) throw new Error("The report agent could not format an answer right now.");
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap(item => item.content ?? []).map(part => part.text).filter(Boolean).join("\n");
  return text?.trim() || fallbackAgentAnswer(question, reportContext);
}

function fallbackAgentAnswer(question: string, reportContext: ReturnType<typeof buildAgentContext>) {
  const normalized = question.toLowerCase();
  const period = normalized.includes("today") ? "today" : normalized.includes("week") ? "week" : normalized.includes("month") ? "month" : "last90Days";
  const totals = reportContext.totals[period as keyof typeof reportContext.totals];
  if (normalized.includes("best") || normalized.includes("top") || normalized.includes("selling")) {
    const top = totals.topProducts[0];
    if (!top) return `I don't see any sales for ${period}.`;
    return `${top.name} is your best-selling product for ${period}, with ${top.unitsSold} sold, ${formatMoney(top.revenue)} revenue, and ${formatMoney(top.profit)} profit.`;
  }
  if (normalized.includes("profit")) return `Your profit for ${period} is ${formatMoney(totals.profit)} from ${formatMoney(totals.revenue)} revenue.`;
  if (normalized.includes("revenue") || normalized.includes("sales")) return `Your revenue for ${period} is ${formatMoney(totals.revenue)} across ${totals.unitsSold} units sold.`;
  return `For ${period}: revenue is ${formatMoney(totals.revenue)}, profit is ${formatMoney(totals.profit)}, and units sold are ${totals.unitsSold}.`;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-4 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`text-xs ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
