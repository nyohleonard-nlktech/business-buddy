import { createFileRoute, Link, Outlet, useNavigate, useLocation, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppProvider, useApp } from "@/hooks/use-app";
import type { User } from "@supabase/supabase-js";
import { Package, ShoppingCart, BarChart3, MoreHorizontal, LogOut } from "lucide-react";
import Onboarding from "@/components/onboarding";
import { SyncStatusPill } from "@/components/SyncStatus";

export const Route = createFileRoute("/app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
      } else {
        setUser(data.user);
      }
      setChecked(true);
    });
  }, [navigate]);

  if (!checked || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <AppProvider user={user}>
      <AppShell />
    </AppProvider>
  );
}

function AppShell() {
  const { memberships, active, setActiveBusinessId, refresh } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  if (memberships.length === 0) {
    return <Onboarding onDone={refresh} onSignOut={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }} />;
  }

  if (!active) return null;

  const isOwner = active.role === "owner";
    const tabs = [
    { to: "/app", label: "Stock", Icon: Package, exact: true },
    { to: "/app/sale", label: "Sale", Icon: ShoppingCart },
    ...(isOwner ? [{ to: "/app/reports", label: "Reports", Icon: BarChart3 }] : []),
    { to: "/app/more", label: "More", Icon: MoreHorizontal },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 bg-brand text-brand-foreground">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {memberships.length > 1 ? (
              <select
                value={active.business_id}
                onChange={(e) => setActiveBusinessId(e.target.value)}
                className="w-full rounded-md bg-transparent font-semibold truncate focus:outline-none text-brand-foreground">
                {memberships.map(m => (
                  <option key={m.business_id} value={m.business_id} className="text-foreground">{m.business.name}</option>
                ))}
              </select>
            ) : (
              <div className="font-semibold truncate">{active.business.name}</div>
            )}
            <div className="text-xs text-brand-foreground/70 uppercase tracking-wide">{active.role}</div>
          </div>
          <SyncStatusPill />
          <button onClick={signOut} className="tap-target rounded-md p-2 text-brand-foreground/80 hover:text-brand-foreground" aria-label="Sign out">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card z-20">
        <div className="mx-auto max-w-3xl grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
          {tabs.map(({ to, label, Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to}
                className={`flex flex-col items-center justify-center py-2 tap-target text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
                <span className="mt-1">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// Guard against direct import if authenticated route was needed elsewhere.
void redirect;
