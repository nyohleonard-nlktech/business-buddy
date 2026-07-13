import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { toast } from "sonner";
import { Inbox as InboxIcon } from "lucide-react";

export const Route = createFileRoute("/app/inbox")({
  component: InboxPage,
});

type Msg = {
  id: string;
  body: string;
  is_broadcast: boolean;
  read_at: string | null;
  created_at: string;
};

function InboxPage() {
  const { user } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("admin_messages" as never)
      .select("id,body,is_broadcast,read_at,created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setMessages((data as unknown as Msg[]) ?? []);
    setLoading(false);
    // Mark unread as read
    const unread = ((data as unknown as Msg[]) ?? []).filter(m => !m.read_at).map(m => m.id);
    if (unread.length) {
      await supabase.from("admin_messages" as never).update({ read_at: new Date().toISOString() } as never).in("id", unread);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user.id]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2"><InboxIcon className="h-5 w-5" /> Messages</h1>
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No messages yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {messages.map(m => (
            <li key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                {m.is_broadcast && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase font-semibold text-accent-foreground">Announcement</span>}
                <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm">{m.body}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
