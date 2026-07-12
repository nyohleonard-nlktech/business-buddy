import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, ArrowLeft } from "lucide-react";
import { formatMoney } from "./app.index";

export const Route = createFileRoute("/app/sale")({
  component: SalePage,
});

type P = { id: string; name: string; unit: string; sale_price: number; current_stock: number };
type CartItem = { product_id: string; name: string; unit: string; unit_sale_price: number; quantity: number; stock: number };

function SalePage() {
  const { active } = useApp();
  const isOwner = active!.role === "owner";
  const navigate = useNavigate();
  const [products, setProducts] = useState<P[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ items: CartItem[]; total: number; note: string; at: string } | null>(null);

  useEffect(() => {
    const table = isOwner ? "products_owner_view" : "products_worker_view";
    supabase.from(table).select("id,name,unit,sale_price,current_stock").eq("business_id", active!.business_id).order("name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setProducts((data as P[]) ?? []);
      });
  }, [active, isOwner]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(p => p.name.toLowerCase().includes(s));
  }, [q, products]);

  const total = useMemo(() => cart.reduce((s, c) => s + c.unit_sale_price * c.quantity, 0), [cart]);

  function addToCart(p: P) {
    setCart(prev => {
      const found = prev.find(c => c.product_id === p.id);
      if (found) return prev.map(c => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product_id: p.id, name: p.name, unit: p.unit, unit_sale_price: p.sale_price, quantity: 1, stock: p.current_stock }];
    });
  }
  function setQty(pid: string, next: number) {
    if (next <= 0) { setCart(cart.filter(c => c.product_id !== pid)); return; }
    setCart(cart.map(c => c.product_id === pid ? { ...c, quantity: next } : c));
  }

  async function complete() {
    if (cart.length === 0) return;
    for (const c of cart) {
      if (c.quantity > c.stock) { toast.error(`Not enough ${c.name} in stock (${c.stock})`); return; }
    }
    setSubmitting(true);
    try {
      const items = cart.map(c => ({ product_id: c.product_id, quantity: c.quantity, unit_sale_price: c.unit_sale_price }));
      const { error } = await supabase.rpc("create_sale_order" as any, {
        _business_id: active!.business_id,
        _items: items as any,
        _note: note.trim() || null,
      });
      if (error) throw error;
      setReceipt({ items: cart, total, note: note.trim(), at: new Date().toLocaleString() });
      setCart([]);
      setNote("");
      // refresh stock counts
      const table = isOwner ? "products_owner_view" : "products_worker_view";
      const { data } = await supabase.from(table).select("id,name,unit,sale_price,current_stock").eq("business_id", active!.business_id).order("name");
      setProducts((data as P[]) ?? []);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  }

  if (receipt) {
    return (
      <div>
        <div className="rounded-2xl border-2 border-success bg-success/5 p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="h-8 w-8" /></div>
          <h1 className="text-2xl font-bold mt-3">Sale complete</h1>
          <div className="text-sm text-muted-foreground mt-1">{receipt.at}</div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Receipt</div>
          <ul className="divide-y divide-border">
            {receipt.items.map(i => (
              <li key={i.product_id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-xs text-muted-foreground">{i.quantity} {i.unit} × {formatMoney(i.unit_sale_price)}</div>
                </div>
                <div className="font-bold tabular-nums">{formatMoney(i.unit_sale_price * i.quantity)}</div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-border">
            <div className="font-bold">Total</div>
            <div className="text-2xl font-bold tabular-nums">{formatMoney(receipt.total)}</div>
          </div>
          {receipt.note && <div className="mt-2 text-sm text-muted-foreground">Note: {receipt.note}</div>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setReceipt(null)} className="tap-target rounded-xl border-2 border-border bg-card py-3 font-semibold">New sale</button>
          <button onClick={() => navigate({ to: "/app" })} className="tap-target rounded-xl bg-primary py-3 font-semibold text-primary-foreground">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-40">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">New sale</h1>
        {cart.length > 0 && <button onClick={() => setCart([])} className="text-sm text-destructive">Clear</button>}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product…"
          className="w-full rounded-lg border border-input bg-card pl-10 pr-3 py-3 tap-target" />
      </div>

      <ul className="space-y-2 mb-4">
        {filtered.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No products.</li>
        ) : filtered.map(p => {
          const inCart = cart.find(c => c.product_id === p.id);
          const disabled = p.current_stock <= 0 && !inCart;
          return (
            <li key={p.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              <button onClick={() => addToCart(p)} disabled={disabled} className="min-w-0 flex-1 text-left disabled:opacity-40">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{formatMoney(p.sale_price)} · {p.current_stock} {p.unit} left</div>
              </button>
              {inCart ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(p.id, inCart.quantity - 1)} className="tap-target rounded-lg border border-input bg-card px-3"><Minus className="h-4 w-4" /></button>
                  <div className="w-8 text-center font-bold tabular-nums">{inCart.quantity}</div>
                  <button onClick={() => setQty(p.id, inCart.quantity + 1)} className="tap-target rounded-lg border border-input bg-card px-3"><Plus className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => addToCart(p)} disabled={disabled} className="tap-target rounded-lg bg-primary text-primary-foreground px-3 py-2 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
              )}
            </li>
          );
        })}
      </ul>

      {cart.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-10 border-t border-border bg-card">
          <div className="mx-auto max-w-3xl p-3">
            <div className="max-h-40 overflow-y-auto mb-2">
              {cart.map(c => (
                <div key={c.product_id} className="flex items-center justify-between text-sm py-1">
                  <div className="min-w-0 flex-1 truncate">{c.quantity}× {c.name}</div>
                  <div className="tabular-nums font-semibold mr-2">{formatMoney(c.unit_sale_price * c.quantity)}</div>
                  <button onClick={() => setQty(c.product_id, 0)} className="text-muted-foreground p-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-2" />
            <button onClick={complete} disabled={submitting}
              className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground tap-target flex items-center justify-center gap-2 disabled:opacity-50">
              <ShoppingCart className="h-5 w-5" />
              {submitting ? "…" : `Complete · ${formatMoney(total)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// suppress unused import warning in production build
void ArrowLeft;
