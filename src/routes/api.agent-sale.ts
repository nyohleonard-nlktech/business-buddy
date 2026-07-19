import { createFileRoute } from "@tanstack/react-router";
import { createCallerSupabaseClient, recordAgentSale } from "@/lib/agent-sale";

export const Route = createFileRoute("/api/agent-sale")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
          const body = await request.json() as { businessId?: string; text?: string };
          if (!body.businessId || !body.text?.trim()) return json({ error: "Missing businessId or text" }, 400);
          const supabase = createCallerSupabaseClient(authHeader);
          const result = await recordAgentSale({ supabase, businessId: body.businessId, text: body.text.trim() });
          return json(result);
        } catch (error: any) {
          return json({ error: error?.message ?? "Could not record sale" }, 400);
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
