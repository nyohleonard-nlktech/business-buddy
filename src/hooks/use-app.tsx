import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type Membership = {
  business_id: string;
  role: "owner" | "worker";
  business: { id: string; name: string; invite_code: string; owner_id: string };
};

type Ctx = {
  user: User;
  memberships: Membership[];
  activeBusinessId: string | null;
  setActiveBusinessId: (id: string) => void;
  active: Membership | null;
  refresh: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be inside AppProvider");
  return c;
}

const STORAGE_KEY = "sd_active_business";

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeBusinessId, setActiveState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("business_members")
      .select("business_id, role, business:businesses!inner(id, name, invite_code, owner_id, deactivated_at)")
      .eq("user_id", user.id);
    if (error) {
      console.error(error);
      setMemberships([]);
    } else {
      const raw = (data ?? []) as unknown as (Membership & { business: Membership["business"] & { deactivated_at: string | null } })[];
      const list = raw.filter(m => !m.business.deactivated_at) as Membership[];
      setMemberships(list);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const valid = list.find(m => m.business_id === stored);
      setActiveState(valid ? valid.business_id : (list[0]?.business_id ?? null));
    }
    setLoaded(true);
  }


  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user.id]);

  function setActiveBusinessId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveState(id);
  }

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const active = memberships.find(m => m.business_id === activeBusinessId) ?? null;

  return (
    <AppCtx.Provider value={{ user, memberships, activeBusinessId, setActiveBusinessId, active, refresh: load }}>
      {children}
    </AppCtx.Provider>
  );
}
