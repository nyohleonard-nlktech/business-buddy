import { useApp } from "@/hooks/use-app";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";

export function SyncStatusPill() {
  const { active } = useApp();
  const { pending, online, syncing, syncNow } = useOfflineSync(active?.business_id ?? null);
  const count = pending.length;

  let Icon = CheckCircle2;
  let label = "Synced";
  let cls = "bg-success/15 text-success border-success/30";
  if (!online) {
    Icon = CloudOff;
    label = count > 0 ? `Offline · ${count} pending` : "Offline";
    cls = "bg-destructive/15 text-destructive border-destructive/30";
  } else if (syncing) {
    Icon = RefreshCw;
    label = "Syncing…";
    cls = "bg-primary/15 text-primary border-primary/30";
  } else if (count > 0) {
    Icon = Cloud;
    label = `${count} pending`;
    cls = "bg-warning/20 text-warning-foreground border-warning/40";
  }

  return (
    <button
      onClick={() => { if (online && count > 0 && !syncing) void syncNow(); }}
      disabled={!online || count === 0 || syncing}
      title={online ? (count > 0 ? "Tap to sync now" : "All synced") : "You are offline"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls} disabled:opacity-90`}
    >
      <Icon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
