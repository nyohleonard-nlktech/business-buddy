import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, LogOut, Send, Megaphone, Power, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/control-panel")({
  ssr: false,
  component: ControlPanel,
});

function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}
function phoneToEmail(phone: string): string {
  return `p${normalizePhone(phone)}@stockdesk.app`;
}

type BizRow = {
  business_id: string;
  name: string;
  owner_user_id: string;
  owner_name: string;
  owner_phone: string;
  workers_count: number;
  created_at: string;
  deactivated_at: string | null;
};

function ControlPanel() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  async function verifyAdmin() {
    setChecking(true);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { setIsAdmin(false); setChecking(false); return; }
    // Try to claim (idempotent — only succeeds if phone matches allowlist)
    await supabase.rpc("claim_platform_admin" as never);
    const { data, error } = await supabase.from("platform_admins" as never)
      .select("user_id").eq("user_id", sess.session.user.id).maybeSingle();
    if (error) console.error(error);
    setIsAdmin(!!data);
    setChecking(false);
  }
  useEffect(() => { verifyAdmin(); }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    try {
      const digits = normalizePhone(phone);
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(digits), password,
      });
      if (error) throw new Error("Wrong phone number or password");
      await verifyAdmin();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Control Panel</h1>
            <p className="text-sm text-muted-foreground">Authorized personnel only</p>
          </div>
          <form onSubmit={signIn} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Phone number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" required
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target" />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target" />
            </div>
            <button disabled={signingIn} className="w-full rounded-lg bg-brand py-3 font-semibold text-brand-foreground tap-target disabled:opacity-50">
              {signingIn ? "…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDashboard onSignOut={signOut} />;
}

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [rows, setRows] = useState<BizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgOpen, setMsgOpen] = useState<BizRow | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastBody, setBroadcastBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_businesses" as never);
    if (error) toast.error(error.message);
    setRows((data as unknown as BizRow[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleDeactivate(row: BizRow) {
    const restore = !!row.deactivated_at;
    if (!restore && !confirm(`Deactivate "${row.name}"? This hides it from all users. You can restore it later.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_soft_delete_business" as never, { _business_id: row.business_id, _restore: restore } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(restore ? "Restored" : "Deactivated");
    load();
  }

  async function sendMessage() {
    if (!msgOpen || !msgBody.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_send_message" as never, {
      _target_user: msgOpen.owner_user_id, _body: msgBody.trim(),
    } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Message sent");
    setMsgOpen(null); setMsgBody("");
  }

  async function broadcast() {
    if (!broadcastBody.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_broadcast_message" as never, { _body: broadcastBody.trim() } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Sent to ${data} owner${data === 1 ? "" : "s"}`);
    setBroadcastOpen(false); setBroadcastBody("");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand text-brand-foreground sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <div>
              <div className="font-semibold">Control Panel</div>
              <div className="text-xs text-brand-foreground/70">Platform administration</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setBroadcastOpen(true)} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground inline-flex items-center gap-1">
              <Megaphone className="h-4 w-4" /> Broadcast
            </button>
            <button onClick={onSignOut} className="tap-target rounded-md p-2 text-brand-foreground/80" aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <h2 className="text-lg font-bold mb-3">Businesses ({rows.length})</h2>
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No businesses yet.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.business_id} className={`rounded-xl border p-4 ${r.deactivated_at ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{r.name}</div>
                      {r.deactivated_at && <span className="rounded bg-destructive px-2 py-0.5 text-[10px] uppercase font-semibold text-destructive-foreground">Deactivated</span>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Owner: <span className="font-medium text-foreground">{r.owner_name || "—"}</span> · {r.owner_phone || "no phone"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.workers_count} worker{r.workers_count === 1 ? "" : "s"} · created {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setMsgOpen(r); setMsgBody(""); }} className="rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold inline-flex items-center gap-1">
                      <Send className="h-4 w-4" /> Message
                    </button>
                    <button disabled={busy} onClick={() => toggleDeactivate(r)} className={`rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center gap-1 ${r.deactivated_at ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                      {r.deactivated_at ? <><RotateCcw className="h-4 w-4" /> Restore</> : <><Power className="h-4 w-4" /> Deactivate</>}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {msgOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-4">
            <h3 className="font-bold mb-1">Message {msgOpen.owner_name || "owner"}</h3>
            <p className="text-xs text-muted-foreground mb-3">{msgOpen.name}</p>
            <textarea value={msgBody} onChange={(e) => setMsgBody(e.target.value)} rows={5} placeholder="Type your message…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setMsgOpen(null)} className="rounded-lg border border-input bg-card py-2 font-semibold">Cancel</button>
              <button disabled={busy || !msgBody.trim()} onClick={sendMessage} className="rounded-lg bg-primary py-2 font-semibold text-primary-foreground disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}

      {broadcastOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-4">
            <h3 className="font-bold mb-1 flex items-center gap-2"><Megaphone className="h-4 w-4" /> Broadcast to all owners</h3>
            <p className="text-xs text-muted-foreground mb-3">Every active business owner will receive this message.</p>
            <textarea value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} rows={5} placeholder="Announcement…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setBroadcastOpen(false)} className="rounded-lg border border-input bg-card py-2 font-semibold">Cancel</button>
              <button disabled={busy || !broadcastBody.trim()} onClick={broadcast} className="rounded-lg bg-primary py-2 font-semibold text-primary-foreground disabled:opacity-50">Send to all</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
