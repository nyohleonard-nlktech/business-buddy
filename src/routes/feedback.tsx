import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, Send, Sparkles } from "lucide-react";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
});

type FeedbackType = "idea" | "issue" | "praise";

const feedbackTypes: Array<{ value: FeedbackType; label: string }> = [
  { value: "idea", label: "Idea" },
  { value: "issue", label: "Problem" },
  { value: "praise", label: "Praise" },
];

function FeedbackPage() {
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");

  const whatsappHref = useMemo(() => {
    const body = [
      `StockDesk feedback (${type})`,
      message.trim(),
      contact.trim() ? `Contact: ${contact.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    return `https://wa.me/237683640243?text=${encodeURIComponent(body)}`;
  }, [contact, message, type]);

  const canSend = message.trim().length >= 10;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to StockDesk
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="h-4 w-4" /> Feedback
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Help us improve
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Tell us what would make StockDesk better.</h1>
            <p className="mt-3 text-muted-foreground">
              Share bugs, feature ideas, or anything confusing. Your message opens in WhatsApp so our team can reply quickly.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={(event) => event.preventDefault()}>
            <fieldset>
              <legend className="text-sm font-medium">What kind of feedback is this?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {feedbackTypes.map((item) => (
                  <label
                    key={item.value}
                    className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      type === item.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedback-type"
                      value={item.value}
                      checked={type === item.value}
                      onChange={() => setType(item.value)}
                      className="sr-only"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="message" className="text-sm font-medium">Your feedback</label>
              <textarea
                id="message"
                required
                minLength={10}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Example: I want low-stock alerts before a product runs out."
                className="mt-2 min-h-40 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">Please write at least 10 characters.</p>
            </div>

            <div>
              <label htmlFor="contact" className="text-sm font-medium">How can we reach you? <span className="text-muted-foreground">(optional)</span></label>
              <input
                id="contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Phone number or email"
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={canSend ? whatsappHref : undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!canSend}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold tap-target ${
                  canSend ? "bg-primary text-primary-foreground" : "pointer-events-none bg-muted text-muted-foreground"
                }`}
              >
                <MessageCircle className="h-5 w-5" /> Send on WhatsApp
              </a>
              <a
                href={`mailto:hello@stockdesk.app?subject=${encodeURIComponent(`StockDesk feedback (${type})`)}&body=${encodeURIComponent(message)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-semibold tap-target"
              >
                <Send className="h-5 w-5" /> Send by email
              </a>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
