import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, TrendingUp, Users, ShieldCheck, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">S</div>
            <span className="font-semibold text-lg tracking-tight">StockDesk</span>
          </div>
          <Link to={authed ? "/app" : "/auth"} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground tap-target inline-flex items-center gap-1">
            {authed ? "Open app" : "Sign in"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Built for small businesses
            </span>
            <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              Inventory & sales,<br /><span className="text-primary">made for the counter.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl">
              Register your business, add any product, invite workers, log sales in seconds — and see real profit at a glance. Mobile-first for real workdays.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground tap-target inline-flex items-center gap-2 shadow-sm">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/auth" className="rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground tap-target inline-flex items-center">
                Sign in
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {["No credit card", "Free to start", "Works on any phone"].map(t => (
                <li key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" /> {t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-4 py-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: Package, title: "Any product", body: "Bottles, books, kilos — track anything with your own units." },
              { Icon: Users, title: "Invite workers", body: "Share a code so staff can record sales and restocks." },
              { Icon: ShieldCheck, title: "Role-safe", body: "Workers never see cost price. Owners see profit." },
              { Icon: TrendingUp, title: "Live reports", body: "Profit, top sellers, stock valuation — no spreadsheets." },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to know your real profit?</h2>
          <p className="mt-3 text-muted-foreground">Set up your business in under a minute.</p>
          <Link to="/auth" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground tap-target shadow-sm">
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <section id="about" className="border-t border-border bg-brand text-brand-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold tracking-tight">About us</h2>
          <p className="mt-2 max-w-2xl text-sm text-brand-foreground/80 leading-relaxed">
            StockDesk helps small business owners track stock, record sales, and know their real profit — without spreadsheets or accounting jargon.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 max-w-2xl">
            {[
              { initials: "NLK", name: "Nyoh Leonard Kanyi (NLK)", title: "Co-founder & CEO" },
              { initials: "HS", name: "Herman Sedar", title: "Co-founder & COO" },
            ].map(f => (
              <div key={f.initials} className="flex items-center gap-3 rounded-xl border border-brand-foreground/10 bg-brand-foreground/5 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {f.initials}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{f.name}</div>
                  <div className="text-xs text-brand-foreground/70">{f.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} StockDesk · <a href="#about" className="underline hover:text-foreground">About</a>
      </footer>
    </div>
  );
}
