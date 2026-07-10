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

function SettingsPage() {
  const { active, refresh } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });

  const [inviteCode, setInviteCode] = useState(active!.business.invite_code);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("business_members").select("*").eq("business_id", active!.business_id);
    if (error) toast.error(error.message);
    else setMembers((data as Member[]) ?? []);
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
    if (!confirm("Remove this worker?")) return;
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
            {members.map(m => (
              <li key={m.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {m.role === "owner" ? "O" : "W"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono truncate">{m.user_id.slice(0, 8)}…</div>
                  <div className="text-xs text-muted-foreground uppercase">{m.role}</div>
                </div>
                {m.role === "worker" && (
                  <button onClick={() => removeMember(m)} className="tap-target text-destructive p-2" aria-label="Remove"><UserMinus className="h-5 w-5" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
