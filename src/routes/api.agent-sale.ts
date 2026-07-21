import { createFileRoute } from "@tanstack/react-router";
import { createCallerSupabaseClient, recordAgentSale } from "@/lib/agent-sale";

export const Route = createFileRoute("/api/agent-sale")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
          let body: { businessId?: string; text?: string };
          try {
            body = await request.json() as { businessId?: string; text?: string };
          } catch {
            return json({ error: "Malformed JSON. Please send a valid request." }, 400);
          }
          if (!/^[0-9a-f-]{36}$/i.test(body.businessId ?? "") || !body.text?.trim()) {
            return json({ error: "Missing or invalid business and request text." }, 400);
          }
          const supabase = createCallerSupabaseClient(authHeader);
          const result = await recordAgentSale({ supabase, businessId: body.businessId, text: body.text.trim() });
          return json(result);
        } catch (error: any) {
          return json({ error: error?.message ?? "Could not complete that request." }, 400);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
