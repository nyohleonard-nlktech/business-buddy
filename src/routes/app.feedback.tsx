import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Mail, MessageCircle, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/app/feedback")({
  component: FeedbackPage,
});

const feedbackEmail = "support@stockdesk.app";
const whatsappNumber = "237683640243";

function FeedbackPage() {
  const subject = encodeURIComponent("StockDesk feedback");
  const body = encodeURIComponent("Hi StockDesk team,\n\nI have feedback about:\n\n");

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Feedback</h1>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageSquareText className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Help us improve StockDesk</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tell us what is confusing, what is missing, or what would make daily stock and sales work faster for your team.
        </p>
      </section>

      <div className="mt-4 grid gap-3">
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi StockDesk team, I have feedback about ")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target rounded-xl border border-border bg-card p-4 flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Send feedback on WhatsApp</div>
            <div className="text-xs text-muted-foreground">Fastest way to reach the StockDesk team</div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </a>

        <a
          href={`mailto:${feedbackEmail}?subject=${subject}&body=${body}`}
          className="tap-target rounded-xl border border-border bg-card p-4 flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Email feedback</div>
            <div className="text-xs text-muted-foreground">Use email if you want to include more detail</div>
          </div>
        </a>
      </div>
    </div>
  );
}
