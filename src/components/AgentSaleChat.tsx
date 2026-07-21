import { useState } from "react";
import { CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const EXAMPLES = [
  "Sold 3 crates Fanta to Ngwa for 1500 francs",
  "Restock 20 bags rice",
  "Show today's revenue",
  "What's my best seller this week?",
];

export function AgentSaleChat({ businessId }: { businessId: string }) {
  const [text, setText] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setConfirmation(null);
    setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/agent-sale", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ businessId, text: trimmed }),
      });
      const payload = await response.json().catch(() => ({ error: "Network unavailable. Please try again." }));
      if (!response.ok) throw new Error(payload.error ?? "Could not complete that request.");
      setConfirmation(payload.confirmation);
      setText("");
      toast.success(payload.confirmation);
      window.dispatchEvent(new CustomEvent("stockdesk:agent-complete", { detail: payload }));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not complete that request.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-full bg-primary p-2 text-primary-foreground shadow-sm"><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-primary">StockDesk Copilot</div>
          <p className="text-xs text-muted-foreground">Log sales, restock inventory, or ask owner-only report questions in natural language.</p>
        </div>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {EXAMPLES.map(example => (
          <button key={example} type="button" onClick={() => setText(example)} disabled={submitting}
            className="shrink-0 rounded-full border border-primary/20 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50">
            {example}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          placeholder="Try: sold three crates of fanta"
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-3 text-sm tap-target focus:outline-none focus:ring-2 focus:ring-ring"
          maxLength={500}
          disabled={submitting}
        />
        <button
          disabled={submitting || !text.trim()}
          className="tap-target rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send to StockDesk Copilot"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {submitting && <p className="mt-2 text-sm text-muted-foreground">Copilot is checking inventory…</p>}
      {confirmation && <p className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-2 text-sm font-medium text-success"><CheckCircle2 className="h-4 w-4" />{confirmation}</p>}
      {error && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-sm font-medium text-destructive">{error}</p>}
    </section>
  );
}
