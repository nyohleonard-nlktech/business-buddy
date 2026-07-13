import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogOut, Store, KeyRound } from "lucide-react";

export default function Onboarding({ onDone, onSignOut }: { onDone: () => Promise<void>; onSignOut: () => void }) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [loading, setLoading] = useState(false);


  async function createBiz(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("businesses").insert({ name, owner_id: u.user.id });
      if (error) throw error;
      toast.success("Business created");
      await onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }

  async function joinBiz(e: React.FormEvent) {
    e.preventDefault();
    const digits = workerPhone.replace(/\D+/g, "");
    if (!workerName.trim()) { toast.error("Enter your name"); return; }
    if (digits.length < 7) { toast.error("Enter a valid phone number"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.rpc("join_business_with_code" as never, {
        _code: code.trim(),
        _name: workerName.trim(),
        _phone: digits,
      } as never);
      if (error) throw error;
      toast.success("Joined!");
      await onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }


  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">S</div>
            <span className="font-semibold">StockDesk</span>
          </div>
          <button onClick={onSignOut} className="text-sm text-muted-foreground flex items-center gap-1 tap-target">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {mode === "choose" && (
          <>
            <h1 className="text-2xl font-bold">Welcome</h1>
            <p className="text-muted-foreground mt-1">Register a new business or join one as a worker.</p>
            <div className="mt-6 grid gap-3">
              <button onClick={() => setMode("create")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary tap-target">
                <Store className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Register a business</div>
                  <div className="text-sm text-muted-foreground">You'll be the owner and get an invite code.</div>
                </div>
              </button>
              <button onClick={() => setMode("join")} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary tap-target">
                <KeyRound className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <div className="font-semibold">Join with a code</div>
                  <div className="text-sm text-muted-foreground">Enter the invite code your boss shared.</div>
                </div>
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <form onSubmit={createBiz}>
            <h1 className="text-2xl font-bold">Name your business</h1>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              placeholder="e.g. Sunrise Gas & Provisions"
              className="mt-6 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target" />
            <button disabled={loading || !name.trim()} className="mt-4 w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 tap-target">
              {loading ? "…" : "Create"}
            </button>
            <button type="button" onClick={() => setMode("choose")} className="mt-3 w-full text-sm text-muted-foreground tap-target">Back</button>
          </form>
        )}

        {mode === "join" && (
          <form onSubmit={joinBiz} className="space-y-3">
            <h1 className="text-2xl font-bold">Join a business</h1>
            <p className="text-sm text-muted-foreground">The owner will see your name and phone.</p>
            <div>
              <label className="text-sm font-medium">Your name</label>
              <input value={workerName} onChange={(e) => setWorkerName(e.target.value)} required
                placeholder="Jane Doe"
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target" />
            </div>
            <div>
              <label className="text-sm font-medium">Your phone number</label>
              <input value={workerPhone} onChange={(e) => setWorkerPhone(e.target.value)} required type="tel" inputMode="tel"
                placeholder="e.g. 612345678"
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target" />
            </div>
            <div>
              <label className="text-sm font-medium">Invite code</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required
                placeholder="ABC12345" maxLength={8}
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target font-mono text-lg tracking-widest text-center" />
            </div>
            <button disabled={loading || code.trim().length < 4} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 tap-target">
              {loading ? "…" : "Join"}
            </button>
            <button type="button" onClick={() => setMode("choose")} className="w-full text-sm text-muted-foreground tap-target">Back</button>
          </form>
        )}

      </div>
    </div>
  );
}
