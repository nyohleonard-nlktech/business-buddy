import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { ShoppingCart, PackagePlus, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/app/record")({
  component: RecordPage,
});

type P = { id: string; name: string; unit: string; sale_price: number; current_stock: number };

function RecordPage() {
  const { active, user } = useApp();
  const isOwner = active!.role === "owner";
  const [type, setType] = useState<"sale" | "restock">("sale");
  const [products, setProducts] = useState<P[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const table = isOwner ? "products_owner_view" : "products_worker_view";
    supabase.from(table).select("id,name,unit,sale_price,current_stock").eq("business_id", active!.business_id).order("name")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setProducts((data as P[]) ?? []);
      });
  }, [active, isOwner]);

  const selected = products.find(p => p.id === productId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { toast.error("Select a product"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("stock_transactions").insert({
        business_id: active!.business_id,
        product_id: productId,
        type,
        quantity: qty,
        recorded_by: user.id,
        note: note.trim() || null,
      });
      if (error) throw error;
      toast.success(type === "sale" ? "Sale recorded" : "Restock recorded");
      // refresh stock display
      const table = isOwner ? "products_owner_view" : "products_worker_view";
      const { data } = await supabase.from(table).select("id,name,unit,sale_price,current_stock").eq("business_id", active!.business_id).order("name");
      setProducts((data as P[]) ?? []);
      setQty(1);
      setNote("");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Record</h1>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <TypeBtn active={type === "sale"} onClick={() => setType("sale")} Icon={ShoppingCart} label="Sale" tone="primary" />
        <TypeBtn active={type === "restock"} onClick={() => setType("restock")} Icon={PackagePlus} label="Restock" tone="success" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} required
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target text-base">
            <option value="">— Choose —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} · {p.current_stock} {p.unit}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Quantity</label>
          <div className="mt-1 flex items-stretch gap-2">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="tap-target rounded-lg border border-input bg-card px-4"><Minus className="h-5 w-5" /></button>
            <input type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 rounded-lg border border-input bg-card px-3 py-3 text-center text-2xl font-bold tabular-nums tap-target" />
            <button type="button" onClick={() => setQty(qty + 1)} className="tap-target rounded-lg border border-input bg-card px-4"><Plus className="h-5 w-5" /></button>
          </div>
          {selected && type === "sale" && (
            <div className="mt-2 text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{(selected.sale_price * qty).toFixed(2)}</span>
              {qty > selected.current_stock && <span className="ml-2 text-destructive">Not enough stock ({selected.current_stock})</span>}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium">Note <span className="text-muted-foreground">(optional)</span></label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "sale" ? "Buyer name…" : "Supplier…"}
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-3 tap-target" />
        </div>

        <button disabled={loading || !productId} className={`w-full rounded-xl py-4 text-lg font-bold tap-target disabled:opacity-50 ${type === "sale" ? "bg-primary text-primary-foreground" : "bg-success text-success-foreground"}`}>
          {loading ? "…" : type === "sale" ? "Record sale" : "Record restock"}
        </button>
      </form>
    </div>
  );
}

function TypeBtn({ active, onClick, Icon, label, tone }: { active: boolean; onClick: () => void; Icon: any; label: string; tone: "primary" | "success" }) {
  const activeCls = tone === "primary" ? "bg-primary text-primary-foreground border-primary" : "bg-success text-success-foreground border-success";
  return (
    <button type="button" onClick={onClick}
      className={`tap-target rounded-xl border-2 py-4 font-semibold flex items-center justify-center gap-2 ${active ? activeCls : "border-border bg-card text-foreground"}`}>
      <Icon className="h-5 w-5" /> {label}
    </button>
  );
}
