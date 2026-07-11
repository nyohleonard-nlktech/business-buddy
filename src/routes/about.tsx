import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — StockDesk" },
      { name: "description", content: "Meet the team behind StockDesk and our mission to give small businesses clear visibility into stock and profit." },
      { property: "og:title", content: "About — StockDesk" },
      { property: "og:description", content: "Meet the team behind StockDesk and our mission to give small businesses clear visibility into stock and profit." },
      { property: "og:url", content: "https://business-buddy.nlk-apps.workers.dev/about" },
    ],
    links: [{ rel: "canonical", href: "https://business-buddy.nlk-apps.workers.dev/about" }],
  }),
  component: AboutPage,
});

function Founder({ initials, name, role, bio, tint }: { initials: string; name: string; role: string; bio: string; tint: "brand" | "primary" }) {
  const cls = tint === "brand"
    ? "bg-brand text-brand-foreground"
    : "bg-primary text-primary-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-6 flex-1">
      <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full font-bold text-2xl ${cls}`}>{initials}</div>
      <div className="mt-4 text-center">
        <div className="font-semibold text-lg">{name}</div>
        <div className="text-sm text-primary font-medium">{role}</div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground text-center">{bio}</p>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">S</div>
            <span className="font-semibold text-lg">StockDesk</span>
          </Link>
          <Link to="/auth" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tap-target inline-flex items-center">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">About StockDesk</h1>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Our Vision</h2>
          <p className="mt-2 text-lg">
            Every small business, regardless of size, deserves clear visibility into their stock and their real profit — not just gut feeling.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">Our Mission</h2>
          <p className="mt-2 text-lg">
            StockDesk gives shopkeepers and small business owners a simple way to track inventory, record sales, and know their real gain — without needing accounting expertise or expensive software.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">Meet the Team</h2>
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <Founder
              initials="NLK"
              name="Nyoh Leonard Kanyi"
              role="Co-founder & CEO"
              bio="Computer Engineering student and builder of StockDesk. Leads the product vision and technical direction."
              tint="brand"
            />
            <Founder
              initials="HS"
              name="Herman Sedar"
              role="Co-founder & COO"
              bio="Mechanical Engineering student and NLK's classmate. Runs operations and the business side of StockDesk."
              tint="primary"
            />
          </div>
        </section>

        <div className="mt-12 text-center">
          <Link to="/" className="text-sm text-muted-foreground underline">← Back to home</Link>
        </div>
      </main>
    </div>
  );
}
