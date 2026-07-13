import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { RefreshCw, Copy, UserMinus } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

type Member = { id: string; user_id: string; role: "owner" | "worker"; invited_at: string };
type Profile = { user_id: string; name: string | null; phone: string | null };

function SettingsPage() {
  const { active, refresh } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });

  const [inviteCode, setInviteCode] = useState(active!.business.invite_code);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("business_members").select("*").eq("business_id", active!.business_id);
    if (error) toast.error(error.message);
    const list = (data as Member[]) ?? [];
    setMembers(list);
    if (list.length) {
      const ids = list.map(m => m.user_id);
      const { data: profs } = await supabase.from("profiles" as never).select("user_id,name,phone").in("user_id", ids);
      const map: Record<string, Profile> = {};
      for (const p of ((profs as unknown as Profile[]) ?? [])) map[p.user_id] = p;
      setProfiles(map);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active!.business_id]);

  async function regen() {
    const { data, error } = await supabase.rpc("regenerate_invite_code", { _business_id: active!.business_id });
    if (error) { toast.error(error.message); return; }
    setInviteCode(data as string);
    await refresh();
    toast.success("New code generated");
  }

  async function copy() {
    await navigator.clipboard.writeText(inviteCode);
    toast.success("Copied");
  }

  async function removeMember(m: Member) {
    if (m.role === "owner") return;
    if (!confirm("Remove this worker? Their past sales stay in the records.")) return;
    const { error } = await supabase.from("business_members").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); load(); }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">Worker invite code</h2>
        <p className="text-sm text-muted-foreground mt-1">Share this so workers can join.</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-input bg-background px-4 py-3 font-mono text-xl tracking-widest text-center">{inviteCode}</div>
          <button onClick={copy} className="tap-target rounded-lg border border-input bg-card px-3" aria-label="Copy"><Copy className="h-5 w-5" /></button>
          <button onClick={regen} className="tap-target rounded-lg border border-input bg-card px-3" aria-label="Regenerate"><RefreshCw className="h-5 w-5" /></button>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Team ({members.length})</h2>
        {loading ? <div className="text-muted-foreground text-sm">Loading…</div> : (
          <ul className="space-y-2">
            {members.map(m => {
              const p = profiles[m.user_id];
              const displayName = p?.name?.trim() || (m.role === "owner" ? "Owner" : "Worker");
              const initials = displayName.split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase() || "?";
              return (
                <li key={m.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${m.role === "owner" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {p?.phone || "no phone"} · <span className="uppercase">{m.role}</span>
                    </div>
                  </div>
                  {m.role === "worker" && (
                    <button onClick={() => removeMember(m)} className="tap-target text-destructive p-2" aria-label="Remove"><UserMinus className="h-5 w-5" /></button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
