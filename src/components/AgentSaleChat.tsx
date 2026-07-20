import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function AgentSaleChat({ businessId }: { businessId: string }) {
  const [text, setText] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setConfirmation(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again");
      const response = await fetch("/api/agent-sale", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, text: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The agent could not complete that request");
      setConfirmation(payload.confirmation);
      setText("");
      toast.success(payload.confirmation);
    } catch (error: any) {
      toast.error(error?.message ?? "The agent could not complete that request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" /> StockDesk Copilot
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="sold 3 crates Fanta to Ngwa 1500 francs · restock 20 bags rice · how much profit today"
          className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-3 text-sm tap-target"
        />
        <button
          disabled={submitting || !text.trim()}
          className="tap-target rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          aria-label="Send command to StockDesk Copilot"
        >
          {submitting ? "…" : <Send className="h-4 w-4" />}
        </button>
      </form>
      {confirmation && <p className="mt-2 text-sm font-medium text-primary">{confirmation}</p>}
    </section>
  );
}
