import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { Plus, AlertTriangle, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  sale_price: number;
  cost_price?: number;
  low_stock_threshold: number;
  current_stock: number;
};

function ProductsPage() {
  const { active } = useApp();
  const isOwner = active!.role === "owner";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function load() {
    setLoading(true);
    const table = isOwner ? "products_owner_view" : "products_worker_view";
    const { data, error } = await supabase.from(table).select("*").eq("business_id", active!.business_id).order("name");
    if (error) toast.error(error.message);
    else setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [active!.business_id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Stock</h1>
        {isOwner && (
          <button onClick={() => setShowAdd(true)} className="tap-target rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground inline-flex items-center gap-1">
            <Plus className="h-4 w-4" /> Add
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No products yet.{isOwner && " Tap Add to create your first one."}
        </div>
      ) : (
        <ul className="space-y-2">
          {products.map(p => {
            const low = p.current_stock <= p.low_stock_threshold;
            return (
              <li key={p.id} className={`rounded-xl border ${low ? "border-warning/50 bg-warning/5" : "border-border bg-card"} p-3 flex items-center gap-3`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.category ?? "—"} · sale {formatMoney(p.sale_price)}
                    {isOwner && p.cost_price !== undefined && <> · cost {formatMoney(p.cost_price)}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold tabular-nums ${low ? "text-warning-foreground" : ""}`}>
                    {p.current_stock}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.unit}</div>
                </div>
                {low && <AlertTriangle className="h-5 w-5 text-warning" />}
                {isOwner && (
                  <button onClick={() => setEditing(p)} className="tap-target rounded-md p-2 text-muted-foreground" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && <ProductModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} businessId={active!.business_id} />}
      {editing && <ProductModal product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} businessId={active!.business_id} />}
    </div>
  );
}

function ProductModal({ product, businessId, onClose, onSaved }: { product?: Product; businessId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "",
    unit: product?.unit ?? "piece",
    cost_price: product?.cost_price?.toString() ?? "0",
    sale_price: product?.sale_price?.toString() ?? "0",
    low_stock_threshold: product?.low_stock_threshold?.toString() ?? "0",
  });
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        business_id: businessId,
        name: form.name.trim(),
        category: form.category.trim() || null,
        unit: form.unit.trim() || "piece",
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        low_stock_threshold: parseInt(form.low_stock_threshold) || 0,
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }

  async function del() {
    if (!product) return;
    if (!confirm("Delete this product? All its transactions stay in reports.")) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); onSaved(); }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{product ? "Edit product" : "New product"}</h2>
          <button type="button" onClick={onClose} className="tap-target p-1"><X className="h-5 w-5" /></button>
        </div>
        <Field label="Name"><input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Optional" className={inputCls} /></Field>
          <Field label="Unit"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bottle, kg…" className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost price"><input type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className={inputCls} /></Field>
          <Field label="Sale price"><input type="number" inputMode="decimal" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field label="Low stock alert at"><input type="number" inputMode="numeric" min="0" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className={inputCls} /></Field>
        <div className="flex gap-2 pt-2">
          {product && <button type="button" onClick={del} className="tap-target rounded-lg border border-destructive/30 text-destructive px-4 py-3 text-sm">Delete</button>}
          <button disabled={loading} className="flex-1 tap-target rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{loading ? "…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 tap-target focus:outline-none focus:ring-2 focus:ring-ring";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium">{label}{children}</label>;
}
export function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
