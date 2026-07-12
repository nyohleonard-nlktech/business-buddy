import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

// Normalize a phone number to digits only, so "+237 6 12 34 56 78" and
// "0612345678" map to the same account key.
function normalizePhone(input: string): string {
  return input.replace(/\D+/g, "");
}

// Supabase phone auth requires an SMS provider; to keep sign-in instant and
// SMS-free, we map the phone number to a synthetic internal email. Users only
// ever see/enter their phone number.
function phoneToEmail(phone: string): string {
  return `p${normalizePhone(phone)}@stockdesk.app`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = normalizePhone(phone);
    if (digits.length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setLoading(true);
    try {
      const email = phoneToEmail(digits);
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { name: name.trim(), phone: digits },
          },
        });
        if (error) throw error;
        // Auto-confirm is on, so sign the user in right away.
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes("invalid")) {
            throw new Error("Wrong phone number or password");
          }
          throw error;
        }
      }
      navigate({ to: "/app", replace: true });
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">S</div>
          <h1 className="mt-4 text-2xl font-bold">StockDesk</h1>
          <p className="text-sm text-muted-foreground">{mode === "signin" ? "Sign in to your business" : "Create your account"}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium">Full name</label>
              <input
                type="text" autoComplete="name" required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Phone number</label>
            <input
              type="tel" autoComplete="tel" required value={phone} inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 612345678"
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground tap-target disabled:opacity-50">
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-muted-foreground underline">
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
