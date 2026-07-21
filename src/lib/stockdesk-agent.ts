import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AgentResult = {
  action: "sale" | "restock" | "report";
  confirmation: string;
};

type Role = "owner" | "worker";
type Product = { id: string; name: string; unit: string; sale_price: number; cost_price?: number; current_stock: number; business_id: string };
type ParsedItem = { product_name: string; quantity: number; price?: number | null; unit_cost?: number | null };
type ParsedCommand = { action: "sale" | "restock" | "report"; customer_name?: string | null; items?: ParsedItem[]; question?: string | null; note?: string | null };
type Txn = { product_id: string; type: "sale" | "restock" | "adjustment"; quantity: number; unit_cost_snapshot: number; unit_sale_price_snapshot: number | null; created_at: string };

export function createCallerSupabaseClient(authHeader: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function runStockdeskAgent({ supabase, businessId, text }: { supabase: SupabaseClient<Database>; businessId: string; text: string }): Promise<AgentResult> {
  const role = await getCallerRole(supabase, businessId);
  const parsed = await parseCommandText(text);
  if (parsed.action === "sale") return recordAgentSale({ supabase, businessId, parsed, role });
  if (parsed.action === "restock") return recordAgentRestock({ supabase, businessId, parsed, role });
  return answerAgentReport({ supabase, businessId, question: parsed.question || text, role });
}

async function recordAgentSale({ supabase, businessId, parsed, role }: { supabase: SupabaseClient<Database>; businessId: string; parsed: ParsedCommand; role: Role }): Promise<AgentResult> {
  const products = await loadProducts(supabase, businessId, role);
  const resolved = requireItems(parsed).map((item) => {
    const product = matchProduct(item.product_name, products);
    if (!product) throw new Error(`Could not match product: ${item.product_name}`);
    return { product, quantity: item.quantity, unit_sale_price: item.price == null ? product.sale_price : item.price / item.quantity };
  });
  const { error } = await supabase.rpc("create_sale_order", {
    _business_id: businessId,
    _items: resolved.map(({ product, quantity, unit_sale_price }) => ({ product_id: product.id, quantity, unit_sale_price })),
    _note: parsed.note ?? (parsed.customer_name ? `Customer: ${parsed.customer_name}` : null),
  });
  if (error) throw error;
  return { action: "sale", confirmation: `Logged sale: ${formatLines(resolved.map(r => ({ name: r.product.name, unit: r.product.unit, quantity: r.quantity, amount: r.unit_sale_price * r.quantity })))}${parsed.customer_name ? ` to ${parsed.customer_name}` : ""}.` };
}

async function recordAgentRestock({ supabase, businessId, parsed, role }: { supabase: SupabaseClient<Database>; businessId: string; parsed: ParsedCommand; role: Role }): Promise<AgentResult> {
  if (role !== "owner") throw new Error("Only business owners can restock through the agent.");
  const products = await loadProducts(supabase, businessId, "owner");
  const resolved = requireItems(parsed).map((item) => {
    const product = matchProduct(item.product_name, products);
    if (!product) throw new Error(`Could not match product: ${item.product_name}`);
    return { product, quantity: item.quantity, unit_cost: item.unit_cost ?? product.cost_price ?? 0 };
  });
  const { error } = await supabase.rpc("create_restock" as any, {
    _business_id: businessId,
    _items: resolved.map(({ product, quantity, unit_cost }) => ({ product_id: product.id, quantity, unit_cost, update_cost_price: false })),
    _note: parsed.note ?? "Logged by StockDesk Copilot",
  });
  if (error) throw error;
  return { action: "restock", confirmation: `Restocked: ${formatLines(resolved.map(r => ({ name: r.product.name, unit: r.product.unit, quantity: r.quantity })))}.` };
}

async function answerAgentReport({ supabase, businessId, question, role }: { supabase: SupabaseClient<Database>; businessId: string; question: string; role: Role }): Promise<AgentResult> {
  if (role !== "owner") throw new Error("Only business owners can ask profit or report questions.");
  const since = question.toLowerCase().includes("today") ? startOfDayIso(new Date()) : question.toLowerCase().includes("week") ? new Date(Date.now() - 7 * 86400_000).toISOString() : new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ data: txns, error: txError }, { data: products, error: pError }] = await Promise.all([
    supabase.from("stock_transactions_owner_view").select("product_id,type,quantity,unit_cost_snapshot,unit_sale_price_snapshot,created_at").eq("business_id", businessId).gte("created_at", since),
    supabase.from("products_owner_view").select("id,name,unit,cost_price,current_stock,business_id").eq("business_id", businessId),
  ]);
  if (txError || pError) throw new Error((txError || pError)!.message);
  const stats = summarizeReport((txns as Txn[] | null) ?? [], (products as Product[] | null) ?? []);
  const q = question.toLowerCase();
  const period = q.includes("today") ? "today" : q.includes("week") ? "this week" : "the last 30 days";
  const top = stats.top[0];
  let confirmation = `For ${period}: revenue is ${formatMoney(stats.revenue)}, profit is ${formatMoney(stats.profit)}, and ${stats.units} units were sold.`;
  if (q.includes("best") || q.includes("top")) confirmation = top ? `${top.name} is your best seller for ${period}: ${top.units} sold, ${formatMoney(top.revenue)} revenue, ${formatMoney(top.profit)} profit.` : `I don't see any sales for ${period}.`;
  return { action: "report", confirmation };
}

async function loadProducts(supabase: SupabaseClient<Database>, businessId: string, role: Role) {
  const table = role === "owner" ? "products_owner_view" : "products_worker_view";
  const columns = role === "owner" ? "id,name,unit,sale_price,cost_price,current_stock,business_id" : "id,name,unit,sale_price,current_stock,business_id";
  const { data, error } = await supabase.from(table).select(columns).eq("business_id", businessId).order("name");
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function getCallerRole(supabase: SupabaseClient<Database>, businessId: string): Promise<Role> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");
  const { data, error } = await supabase.from("business_members").select("role").eq("business_id", businessId).eq("user_id", userData.user.id).single();
  if (error) throw error;
  if (data.role !== "owner" && data.role !== "worker") throw new Error("Unsupported role");
  return data.role;
}

async function parseCommandText(text: string): Promise<ParsedCommand> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackParse(text);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-5.6",
      input: [{ role: "system", content: "Parse shopkeeper commands into JSON only. action is sale, restock, or report. For sales, price is the total amount paid for that line. For restocks, unit_cost is optional." }, { role: "user", content: text }],
      text: { format: { type: "json_schema", name: "stockdesk_command", strict: true, schema: { type: "object", additionalProperties: false, required: ["action", "customer_name", "items", "question", "note"], properties: { action: { enum: ["sale", "restock", "report"] }, customer_name: { type: ["string", "null"] }, question: { type: ["string", "null"] }, note: { type: ["string", "null"] }, items: { type: ["array", "null"], items: { type: "object", additionalProperties: false, required: ["product_name", "quantity", "price", "unit_cost"], properties: { product_name: { type: "string" }, quantity: { type: "number", exclusiveMinimum: 0 }, price: { type: ["number", "null"], minimum: 0 }, unit_cost: { type: ["number", "null"], minimum: 0 } } } } } } } },
    }),
  });
  if (!response.ok) return fallbackParse(text);
  const payload = await response.json();
  const outputText = payload.output_text ?? payload.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
  return outputText ? JSON.parse(outputText) as ParsedCommand : fallbackParse(text);
}

function fallbackParse(text: string): ParsedCommand {
  const lower = text.toLowerCase();
  if (/profit|best|top|seller|revenue|sales today|sales this week/.test(lower)) return { action: "report", question: text, items: null, customer_name: null, note: null };
  const action = /restock|received|bought stock|add stock/.test(lower) ? "restock" : "sale";
  const cleaned = text.replace(/^(sold|sell|restock|received|add stock|bought stock)\s+/i, "");
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s+(.*?)(?:\s+to\s+([^0-9]+?))?(?:\s+(?:for|at)?\s*(\d+(?:\.\d+)?)(?:\s*(?:francs?|fcfa|xaf))?)?$/i);
  if (!m) throw new Error("I could not understand that command. Try: sold 3 crates Fanta to Ngwa 1500 francs");
  return { action, customer_name: m[3]?.trim() || null, note: null, question: null, items: [{ quantity: Number(m[1]), product_name: m[2].trim(), price: action === "sale" && m[4] ? Number(m[4]) : null, unit_cost: action === "restock" && m[4] ? Number(m[4]) : null }] };
}

function requireItems(parsed: ParsedCommand) {
  if (!parsed.items?.length) throw new Error("No products found in that command.");
  return parsed.items;
}

function matchProduct(name: string, products: Product[]): Product | null {
  const wanted = normalize(name);
  const exact = products.find((p) => normalize(p.name) === wanted);
  if (exact) return exact;
  const contains = products.filter((p) => normalize(p.name).includes(wanted) || wanted.includes(normalize(p.name)));
  return contains.length === 1 ? contains[0] : null;
}

function summarizeReport(txns: Txn[], products: Product[]) {
  let revenue = 0, cost = 0, units = 0;
  const per = new Map<string, { units: number; revenue: number; profit: number }>();
  for (const t of txns.filter(t => t.type === "sale")) {
    const rev = (t.unit_sale_price_snapshot ?? 0) * t.quantity;
    const c = t.unit_cost_snapshot * t.quantity;
    revenue += rev; cost += c; units += t.quantity;
    const row = per.get(t.product_id) ?? { units: 0, revenue: 0, profit: 0 };
    row.units += t.quantity; row.revenue += rev; row.profit += rev - c; per.set(t.product_id, row);
  }
  const top = [...per.entries()].map(([id, row]) => ({ ...row, name: products.find(p => p.id === id)?.name ?? "Unknown" })).sort((a, b) => b.units - a.units);
  return { revenue, profit: revenue - cost, units, top };
}

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function formatLines(items: Array<{ name: string; unit: string; quantity: number; amount?: number }>) { return items.map(i => `${i.quantity} ${i.unit} ${i.name}${i.amount == null ? "" : ` for ${formatMoney(i.amount)}`}`).join(", "); }
function formatMoney(value: number) { return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} francs`; }
function startOfDayIso(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d.toISOString(); }
