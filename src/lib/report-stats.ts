export type ReportTransaction = {
  id: string;
  product_id: string;
  type: "sale" | "restock" | "adjustment";
  quantity: number;
  unit_cost_snapshot: number;
  unit_sale_price_snapshot: number | null;
  created_at: string;
};

export type ReportProduct = {
  id: string;
  name: string;
  cost_price: number;
  current_stock: number;
  low_stock_threshold: number;
  unit: string;
};

export type ReportRange = "today" | "7" | "30" | "90" | "all";
export type AgentPeriod = "today" | "week" | "month" | "last90Days" | "allTime";

export type ReportStats = ReturnType<typeof computeReportStats>;
export type ReportSummary = ReturnType<typeof summarizeStats>;
export type ReportAgentContext = ReturnType<typeof buildAgentContext>;

export function computeReportStats(txns: ReportTransaction[], products: ReportProduct[], range: ReportRange) {
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

export function rangeToSince(range: ReportRange): string | null {
  if (range === "today") return startOfLocalDayIso(new Date());
  if (range === "all") return null;
  return new Date(Date.now() - parseInt(range) * 86400_000).toISOString();
}

export function startOfLocalDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function buildAgentContext(txns: ReportTransaction[], products: ReportProduct[]) {
  const now = Date.now();
  const ranges: Record<AgentPeriod, ReportStats> = {
    today: computeReportStats(txns.filter(t => new Date(t.created_at) >= new Date(startOfLocalDayIso(new Date()))), products, "today"),
    week: computeReportStats(txns.filter(t => now - new Date(t.created_at).getTime() <= 7 * 86400_000), products, "7"),
    month: computeReportStats(txns.filter(t => now - new Date(t.created_at).getTime() <= 30 * 86400_000), products, "30"),
    last90Days: computeReportStats(txns.filter(t => now - new Date(t.created_at).getTime() <= 90 * 86400_000), products, "90"),
    allTime: computeReportStats(txns, products, "all"),
  };

  return {
    generatedAt: new Date().toISOString(),
    availablePeriods: ["today", "week", "month", "last90Days", "allTime"],
    totals: {
      today: summarizeStats(ranges.today),
      week: summarizeStats(ranges.week),
      month: summarizeStats(ranges.month),
      last90Days: summarizeStats(ranges.last90Days),
      allTime: summarizeStats(ranges.allTime),
    },
    stock: {
      currentValue: roundMoney(ranges.allTime.valuation),
      lowStock: ranges.allTime.lowStock.map(p => ({ name: p.name, stock: p.current_stock, unit: p.unit, threshold: p.low_stock_threshold })).slice(0, 20),
      negativeStock: ranges.allTime.negativeStock.map(p => ({ name: p.name, stock: p.current_stock, unit: p.unit })).slice(0, 20),
    },
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

function formatReportMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fallbackAgentAnswer(question: string, reportContext: ReportAgentContext) {
  const normalized = question.toLowerCase();
  const period: AgentPeriod = normalized.includes("today") ? "today" : normalized.includes("week") ? "week" : normalized.includes("month") ? "month" : normalized.includes("90") ? "last90Days" : "allTime";
  const totals = reportContext.totals[period];
  if (normalized.includes("best") || normalized.includes("top") || normalized.includes("selling")) {
    const top = totals.topProducts[0];
    if (!top) return `I don't see any sales for ${period}.`;
    return `${top.name} is your best-selling product for ${period}, with ${top.unitsSold} sold, ${formatReportMoney(top.revenue)} revenue, and ${formatReportMoney(top.profit)} profit.`;
  }
  if (normalized.includes("profit")) return `Your profit for ${period} is ${formatReportMoney(totals.profit)} from ${formatReportMoney(totals.revenue)} revenue.`;
  if (normalized.includes("revenue") || normalized.includes("sales")) return `Your revenue for ${period} is ${formatReportMoney(totals.revenue)} across ${totals.unitsSold} units sold.`;
  return `For ${period}: revenue is ${formatReportMoney(totals.revenue)}, profit is ${formatReportMoney(totals.profit)}, and units sold are ${totals.unitsSold}.`;
}
