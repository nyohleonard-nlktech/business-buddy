import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AgentSaleResult = {
  orderId: string;
  confirmation: string;
  items: Array<{ product_id: string; name: string; quantity: number; unit_sale_price: number }>;
};

type Product = { id: string; name: string; unit: string; sale_price: number; current_stock: number; business_id: string };
type ParsedItem = { product_name: string; quantity: number; price?: number | null };
type ParsedSale = { customer_name?: string | null; items: ParsedItem[]; note?: string | null };

export function createCallerSupabaseClient(authHeader: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function recordAgentSale({
  supabase,
  businessId,
  text,
}: {
  supabase: SupabaseClient<Database>;
  businessId: string;
  text: string;
}): Promise<AgentSaleResult> {
  const role = await getCallerRole(supabase, businessId);
  const table = role === "owner" ? "products_owner_view" : "products_worker_view";
  const parsed = await parseSaleText(text);

  const { data: products, error: productsError } = await supabase
    .from(table)
    .select("id,name,unit,sale_price,current_stock,business_id")
    .eq("business_id", businessId)
    .order("name");
  if (productsError) throw productsError;

  const resolved = parsed.items.map((item) => {
    const product = matchProduct(item.product_name, (products ?? []) as Product[]);
    if (!product) throw new Error(`Could not match product: ${item.product_name}`);
    return {
      product,
      quantity: item.quantity,
      unit_sale_price: item.price == null ? product.sale_price : item.price / item.quantity,
    };
  });

  const rpcItems = resolved.map(({ product, quantity, unit_sale_price }) => ({
    product_id: product.id,
    quantity,
    unit_sale_price,
  }));
  const note = parsed.note ?? (parsed.customer_name ? `Customer: ${parsed.customer_name}` : null);

  const { data: orderId, error: rpcError } = await supabase.rpc("create_sale_order", {
    _business_id: businessId,
    _items: rpcItems,
    _note: note,
  });
  if (rpcError) throw rpcError;

  return {
    orderId,
    confirmation: formatConfirmation(resolved, parsed.customer_name),
    items: resolved.map(({ product, quantity, unit_sale_price }) => ({
      product_id: product.id,
      name: product.name,
      quantity,
      unit_sale_price,
    })),
  };
}

async function getCallerRole(supabase: SupabaseClient<Database>, businessId: string): Promise<"owner" | "worker"> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");
  const { data, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userData.user.id)
    .single();
  if (error) throw error;
  if (data.role !== "owner" && data.role !== "worker") throw new Error("Unsupported role");
  return data.role;
}

async function parseSaleText(text: string): Promise<ParsedSale> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-5.6",
      input: [
        {
          role: "system",
          content: "Parse informal shop sale text into JSON only. Use total line price when the user gives a price for the sold quantity. Extract customer name when present after words like to/for customer.",
        },
        { role: "user", content: text },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sale_parse",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items", "customer_name", "note"],
            properties: {
              customer_name: { type: ["string", "null"] },
              note: { type: ["string", "null"] },
              items: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["product_name", "quantity", "price"],
                  properties: {
                    product_name: { type: "string" },
                    quantity: { type: "number", exclusiveMinimum: 0 },
                    price: { type: ["number", "null"], minimum: 0 },
                  },
                },
              },
            },
          },
          strict: true,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI parse failed: ${await response.text()}`);
  const payload = await response.json();
  const outputText = payload.output_text ?? payload.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
  if (!outputText) throw new Error("OpenAI did not return parsed sale JSON");
  const parsed = JSON.parse(outputText) as ParsedSale;
  if (!parsed.items?.length) throw new Error("No sale items found");
  return parsed;
}

function matchProduct(name: string, products: Product[]): Product | null {
  const wanted = normalize(name);
  const exact = products.find((p) => normalize(p.name) === wanted);
  if (exact) return exact;
  const contains = products.filter((p) => normalize(p.name).includes(wanted) || wanted.includes(normalize(p.name)));
  return contains.length === 1 ? contains[0] : null;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatConfirmation(items: Array<{ product: Product; quantity: number; unit_sale_price: number }>, customer?: string | null) {
  const itemText = items.map(({ product, quantity, unit_sale_price }) => `${quantity} ${product.unit} ${product.name} for ${formatMoney(unit_sale_price * quantity)}`).join(", ");
  return `Logged: ${itemText}${customer ? ` to ${customer}` : ""}`;
}

function formatMoney(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} francs`;
}
