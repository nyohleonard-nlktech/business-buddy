import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { Plus, Minus, Trash2, PackagePlus, Search } from "lucide-react";
import { formatMoney } from "./app.index";
import { enqueue, newLocalId, syncNow, cacheProducts, readCachedProducts, type CachedProduct } from "@/lib/offline";
import { useOfflineSync } from "@/hooks/use-offline-sync";

export const Route = createFileRoute("/app/restock")({
  component: RestockPage,
});

type P = { id: string; name: string; unit: string; cost_price: number; current_stock: number };
type Line = { product_id: string; name: string; unit: string; quantity: number; unit_cost: number; update_cost_price: boolean };

function RestockPage() {
  const { active, user } = useApp();
  if (active!.role !== "owner") throw redirect({ to: "/app" });
  const navigate = useNavigate();
  const { online, syncNow: doSync } = useOfflineSync(active!.business_id);
  const [products, setProducts] = useState<P[]>([]);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // 1) Read local cache immediately so offline reopen works.
    readCachedProducts(active!.business_id, "owner").then(cached => {
      if (!cancelled && cached && cached.length) setProducts(cached as unknown as P[]);
    });
    // 2) If online, refresh from network and update cache.
    if (online) {
      supabase.from("products_owner_view")
        .select("id,name,unit,cost_price,current_stock").eq("business_id", active!.business_id).order("name")
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) { /* keep cache */ }
          else if (data) {
            setProducts(data as P[]);
            void cacheProducts(active!.business_id, "owner", data as CachedProduct[]);
          }
        });
    }
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [active, online]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(p => p.name.toLowerCase().includes(s));
  }, [q, products]);

  function addLine(p: P) {
    if (lines.find(l => l.product_id === p.id)) return;
    setLines([...lines, { product_id: p.id, name: p.name, unit: p.unit, quantity: 1, unit_cost: p.cost_price, update_cost_price: true }]);
  }
  function update(pid: string, patch: Partial<Line>) {
    setLines(lines.map(l => l.product_id === pid ? { ...l, ...patch } : l));
  }
  function remove(pid: string) {
    setLines(lines.filter(l => l.product_id !== pid));
  }

  const totalCost = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);

  async function submit() {
    if (lines.length === 0) return;
    setSubmitting(true);
    try {
      const items = lines.map(l => ({
        product_id: l.product_id, quantity: l.quantity, unit_cost: l.unit_cost, update_cost_price: l.update_cost_price,
      }));
      await enqueue({
        kind: "restock",
        localId: newLocalId(),
        businessId: active!.business_id,
        userId: user.id,
        createdAt: new Date().toISOString(),
        note: note.trim() || null,
        retries: 0,
        items,
      });
      toast.success(online
        ? `Restocked ${lines.length} product(s)`
        : `Saved locally — will sync when online`);
      if (online) void doSync().then(() => void syncNow(active!.business_id));
      navigate({ to: "/app" });
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="pb-40">
      <h1 className="text-xl font-bold mb-3">New restock</h1>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add product to restock…"
          className="w-full rounded-lg border border-input bg-card pl-10 pr-3 py-3 tap-target" />
      </div>

      {q && (
        <ul className="space-y-2 mb-4">
          {filtered.slice(0, 6).map(p => (
            <li key={p.id}>
              <button onClick={() => { addLine(p); setQ(""); }} disabled={!!lines.find(l => l.product_id === p.id)}
                className="w-full text-left rounded-xl border border-border bg-card p-3 flex items-center gap-3 disabled:opacity-40">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Stock {p.current_stock} · cost {formatMoney(p.cost_price)}</div>
                </div>
                <Plus className="h-5 w-5 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Search above to add products to this restock.
        </div>
      ) : (
        <ul className="space-y-3">
          {lines.map(l => (
            <li key={l.product_id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{l.name}</div>
                <button onClick={() => remove(l.product_id)} className="text-muted-foreground p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Qty received</div>
                  <div className="flex items-stretch gap-1">
                    <button onClick={() => update(l.product_id, { quantity: Math.max(1, l.quantity - 1) })} className="tap-target rounded-lg border border-input bg-background px-3"><Minus className="h-4 w-4" /></button>
                    <input type="number" inputMode="numeric" min={1} value={l.quantity}
                      onChange={(e) => update(l.product_id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="flex-1 rounded-lg border border-input bg-background px-2 py-2 text-center font-bold tabular-nums" />
                    <button onClick={() => update(l.product_id, { quantity: l.quantity + 1 })} className="tap-target rounded-lg border border-input bg-background px-3"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Cost per {l.unit}</div>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={l.unit_cost}
                    onChange={(e) => update(l.product_id, { unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center font-bold tabular-nums" />
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={l.update_cost_price} onChange={(e) => update(l.product_id, { update_cost_price: e.target.checked })} />
                Update product's cost price to {formatMoney(l.unit_cost)}
              </label>
              <div className="mt-2 text-right text-sm">Line total: <span className="font-bold tabular-nums">{formatMoney(l.quantity * l.unit_cost)}</span></div>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-10 border-t border-border bg-card">
          <div className="mx-auto max-w-3xl p-3">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier / note (optional)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-2" />
            <button onClick={submit} disabled={submitting}
              className="w-full rounded-xl bg-success py-4 text-lg font-bold text-success-foreground tap-target flex items-center justify-center gap-2 disabled:opacity-50">
              <PackagePlus className="h-5 w-5" />
              {submitting ? "…" : `Complete restock · ${formatMoney(totalCost)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
