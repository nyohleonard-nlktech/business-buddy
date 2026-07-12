import { createFileRoute, Link } from "@tanstack/react-router";
import { useApp } from "@/hooks/use-app";
import { PackagePlus, ScrollText, ClipboardList, Settings as SettingsIcon, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/app/more")({
  component: MorePage,
});

function MorePage() {
  const { active } = useApp();
  const isOwner = active!.role === "owner";
  const items = [
    ...(isOwner ? [{ to: "/app/restock", Icon: PackagePlus, label: "New restock", desc: "Receive stock from a supplier" }] : []),
    { to: "/app/record", Icon: SlidersHorizontal, label: "Adjust stock", desc: "Fix a count (spoilage, correction)" },
    { to: "/app/sales-log", Icon: ScrollText, label: "Sales log", desc: "Every past sale" },
    ...(isOwner ? [{ to: "/app/restocks-log", Icon: ClipboardList, label: "Restock log", desc: "Every past restock" }] : []),
    ...(isOwner ? [{ to: "/app/settings", Icon: SettingsIcon, label: "Settings", desc: "Team, invite code" }] : []),
  ];
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">More</h1>
      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.to}>
            <Link to={it.to} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 tap-target">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <it.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{it.label}</div>
                <div className="text-xs text-muted-foreground">{it.desc}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
