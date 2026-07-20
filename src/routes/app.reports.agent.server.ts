import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAgentContext, fallbackAgentAnswer, type ReportProduct, type ReportTransaction } from "@/lib/report-stats";

export const askReportsAgent = createServerFn({ method: "POST" })
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

    // The owner check happens before any owner report view is queried. Workers
    // can call this endpoint with any phrasing, but they cannot receive report
    // data unless this exact authenticated membership exists.
    const { data: ownerMembership, error: ownerError } = await authedSupabase
      .from("business_members")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (ownerError) throw new Error(ownerError.message);
    if (!ownerMembership) throw new Error("Only business owners can ask report questions.");

    const [{ data: txns, error: txnsError }, { data: products, error: productsError }] = await Promise.all([
      authedSupabase
        .from("stock_transactions_owner_view")
        .select("id,product_id,type,quantity,unit_cost_snapshot,unit_sale_price_snapshot,created_at")
        .eq("business_id", data.businessId),
      authedSupabase
        .from("products_owner_view")
        .select("id,name,cost_price,current_stock,low_stock_threshold,unit")
        .eq("business_id", data.businessId),
    ]);

    if (txnsError || productsError) throw new Error((txnsError || productsError)!.message);

    const reportContext = buildAgentContext((txns as ReportTransaction[] | null) ?? [], (products as ReportProduct[] | null) ?? []);
    const answer = await formatAnswerWithGpt(data.question, reportContext);
    return { answer };
  });

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
          content: "You answer a small-business owner's report questions in plain language. Use only the supplied JSON report summary. If data is missing, say so. Keep answers concise and include exact numbers from the data.",
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
