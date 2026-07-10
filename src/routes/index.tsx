import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, TrendingUp, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: async () => {
    // Client-side only session check happens in component; loader is neutral for SSR.
    return null;
  },
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">S</div>
            <span className="font-semibold text-lg">StockDesk</span>
          </div>
          <Link to={authed ? "/app" : "/auth"} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground tap-target inline-flex items-center">
            {authed ? "Open app" : "Sign in"}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-16">
        <section className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Inventory & sales, made for the counter.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Register your business, add products of any kind, invite workers, log sales in seconds — and see profit at a glance. Built mobile-first for real workdays.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth" className="rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground tap-target inline-flex items-center">Get started free</Link>
          </div>
        </section>
        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: Package, title: "Any product", body: "Bottles, books, kilos — track anything with your own units." },
            { Icon: Users, title: "Invite workers", body: "Share a code so staff can record sales and restocks." },
            { Icon: ShieldCheck, title: "Role-safe", body: "Workers never see cost price. Owners see profit." },
            { Icon: TrendingUp, title: "Live reports", body: "Profit, top sellers, stock valuation — no spreadsheets." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Built on Lovable Cloud.
      </footer>
    </div>
  );
}

// Silence unused import when SSR
void redirect;
