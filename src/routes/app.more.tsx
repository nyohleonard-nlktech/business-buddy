import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/hooks/use-app";
import { supabase } from "@/integrations/supabase/client";
import { PackagePlus, ScrollText, ClipboardList, Settings as SettingsIcon, SlidersHorizontal, Inbox, MessageSquareText } from "lucide-react";

export const Route = createFileRoute("/app/more")({
  component: MorePage,
});

function MorePage() {
  const { active, user } = useApp();
  const isOwner = active!.role === "owner";
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isOwner) return;
    supabase.from("admin_messages" as never)
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", user.id)
      .is("read_at", null)
      .then(({ count }) => setUnread(count ?? 0));
  }, [isOwner, user.id]);

  const items = [
    ...(isOwner ? [{ to: "/app/inbox", Icon: Inbox, label: `Messages${unread ? ` (${unread})` : ""}`, desc: "Notifications from the platform team" }] : []),
    ...(isOwner ? [{ to: "/app/restock", Icon: PackagePlus, label: "New restock", desc: "Receive stock from a supplier" }] : []),
    { to: "/app/record", Icon: SlidersHorizontal, label: "Adjust stock", desc: "Fix a count (spoilage, correction)" },
    { to: "/app/sales-log", Icon: ScrollText, label: "Sales log", desc: "Every past sale" },
    ...(isOwner ? [{ to: "/app/restocks-log", Icon: ClipboardList, label: "Restock log", desc: "Every past restock" }] : []),
    { to: "/app/feedback", Icon: MessageSquareText, label: "Feedback", desc: "Share ideas or report a problem" },
    ...(isOwner ? [{ to: "/app/settings", Icon: SettingsIcon, label: "Settings", desc: "Team, invite code" }] : []),
  ];
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">More</h1>
      <ul className="space-y-2">
        {items.map(it => (
          <li key={it.to}>
            <Link to={it.to} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 tap-target">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary relative">
                <it.Icon className="h-5 w-5" />
                {it.to === "/app/inbox" && unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">{unread}</span>
                )}
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
