import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Printer, Share2, X } from "lucide-react";
import { toast } from "sonner";

export type ReceiptItem = {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

export type ReceiptData = {
  businessName: string;
  orderId: string;
  date: string; // ISO
  cashierName: string;
  items: ReceiptItem[];
  total: number;
  note?: string;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n || 0);
}

function textSummary(r: ReceiptData): string {
  const lines: string[] = [];
  lines.push(`*${r.businessName}* — Receipt`);
  lines.push(new Date(r.date).toLocaleString());
  lines.push("");
  for (const it of r.items) {
    lines.push(`• ${it.quantity} ${it.unit} × ${it.name} — ${formatMoney(it.unit_price * it.quantity)}`);
  }
  lines.push("");
  lines.push(`Total: ${formatMoney(r.total)}`);
  lines.push(`Served by: ${r.cashierName}`);
  lines.push(`Ref: ${r.orderId.slice(0, 8).toUpperCase()}`);
  return lines.join("\n");
}

export function ReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  // Toggle a body class so the print stylesheet knows we want just this receipt.
  useEffect(() => {
    document.body.classList.add("printing-receipt");
    return () => document.body.classList.remove("printing-receipt");
  }, []);

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    const summary = textSummary(data);
    try {
      // Try to build an image for a nicer share
      let file: File | null = null;
      if (receiptRef.current) {
        try {
          const canvas = await html2canvas(receiptRef.current, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
          });
          const blob: Blob | null = await new Promise(res => canvas.toBlob(res, "image/png"));
          if (blob) file = new File([blob], `receipt-${data.orderId.slice(0, 8)}.png`, { type: "image/png" });
        } catch {
          /* image build failed, fall back to text share */
        }
      }
      const nav = navigator as Navigator & {
        share?: (d: ShareData) => Promise<void>;
        canShare?: (d: ShareData) => boolean;
      };
      if (nav.share) {
        const payload: ShareData = { title: `${data.businessName} — Receipt`, text: summary };
        if (file && nav.canShare && nav.canShare({ files: [file] })) {
          (payload as ShareData & { files?: File[] }).files = [file];
        }
        try {
          await nav.share(payload);
          return;
        } catch (err: unknown) {
          // AbortError = user cancelled: silent
          if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") return;
        }
      }
      // Fallback: download image if we have it, else copy text
      if (file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
        try { await navigator.clipboard.writeText(summary); } catch { /* ignore */ }
        toast.success("Receipt image downloaded, text copied");
      } else {
        await navigator.clipboard.writeText(summary);
        toast.success("Receipt copied to clipboard");
      }
    } catch (err: unknown) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "Share failed";
      toast.error(message);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 receipt-overlay">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-100 no-print">
          <div className="font-semibold text-slate-800">Receipt</div>
          <button onClick={onClose} className="p-2 rounded-md text-slate-600 hover:bg-slate-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          <div ref={receiptRef} className="receipt-paper mx-auto bg-white text-black p-5" style={{ fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace", width: "300px" }}>
            <div className="text-center">
              <div className="font-bold uppercase tracking-wide text-lg">{data.businessName}</div>
              <div className="text-[11px] mt-1">{new Date(data.date).toLocaleString()}</div>
              <div className="text-[10px] mt-0.5 opacity-70">Ref: {data.orderId.slice(0, 8).toUpperCase()}</div>
            </div>
            <div className="border-t border-dashed border-black my-3" />
            <div className="space-y-1 text-[12px]">
              {data.items.map((it, i) => {
                const sub = it.quantity * it.unit_price;
                return (
                  <div key={i}>
                    <div className="flex justify-between">
                      <span className="truncate mr-2">{it.name}</span>
                      <span className="tabular-nums">{formatMoney(sub)}</span>
                    </div>
                    <div className="text-[10px] opacity-70">
                      {it.quantity} {it.unit} × {formatMoney(it.unit_price)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-dashed border-black my-3" />
            <div className="flex justify-between text-sm font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatMoney(data.total)}</span>
            </div>
            <div className="border-t border-dashed border-black my-3" />
            <div className="text-[11px]">Served by: {data.cashierName || "—"}</div>
            {data.note && <div className="text-[11px] mt-1">Note: {data.note}</div>}
            <div className="text-center text-[10px] mt-4 opacity-70">Thank you for your purchase!</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 no-print">
          <button onClick={handlePrint} className="rounded-lg bg-slate-800 text-white py-3 font-semibold flex items-center justify-center gap-2">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={handleShare} disabled={sharing} className="rounded-lg bg-primary text-primary-foreground py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            <Share2 className="h-4 w-4" /> {sharing ? "…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
