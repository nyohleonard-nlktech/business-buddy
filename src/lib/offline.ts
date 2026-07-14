// Local-first offline queue for sales & restocks.
// Records land in IndexedDB immediately, then sync to Supabase when online.
import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";

export type SaleItem = { product_id: string; quantity: number; unit_sale_price: number };
export type RestockItem = { product_id: string; quantity: number; unit_cost: number; update_cost_price: boolean };

export type PendingBase = {
  localId: string;
  businessId: string;
  userId: string;
  createdAt: string;
  note: string | null;
  retries: number;
  lastError?: string;
};
export type PendingSale = PendingBase & { kind: "sale"; items: SaleItem[]; total: number };
export type PendingRestock = PendingBase & { kind: "restock"; items: RestockItem[] };
export type Pending = PendingSale | PendingRestock;

const DB_NAME = "stockdesk-offline";
const DB_VERSION = 1;
const STORE = "pending";

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: "localId" });
          s.createIndex("byBusiness", "businessId");
          s.createIndex("byCreated", "createdAt");
        }
      },
    });
  }
  return dbp;
}

export function newLocalId() {
  const rnd = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
  return `local-${rnd}`;
}

export async function enqueue(p: Pending) {
  const d = await db();
  await d.put(STORE, p);
  notify();
}

export async function listPending(businessId?: string): Promise<Pending[]> {
  const d = await db();
  const all = (await d.getAll(STORE)) as Pending[];
  const filtered = businessId ? all.filter(x => x.businessId === businessId) : all;
  filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return filtered;
}

export async function removePending(localId: string) {
  const d = await db();
  await d.delete(STORE, localId);
  notify();
}

export async function updatePending(p: Pending) {
  const d = await db();
  await d.put(STORE, p);
  notify();
}

// Compute optimistic stock deltas for pending, un-synced ops.
export async function computeDeltas(businessId: string): Promise<Map<string, number>> {
  const pending = await listPending(businessId);
  const m = new Map<string, number>();
  for (const p of pending) {
    if (p.kind === "sale") {
      for (const it of p.items) m.set(it.product_id, (m.get(it.product_id) ?? 0) - it.quantity);
    } else {
      for (const it of p.items) m.set(it.product_id, (m.get(it.product_id) ?? 0) + it.quantity);
    }
  }
  return m;
}

// Pub/sub so components refresh when queue changes.
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); }
function notify() { for (const l of Array.from(listeners)) { try { l(); } catch { /* ignore */ } } }

// Push one item to the server. Returns true on success.
async function push(p: Pending): Promise<boolean> {
  try {
    if (p.kind === "sale") {
      const { error } = await supabase.rpc("create_sale_order" as any, {
        _business_id: p.businessId,
        _items: p.items as any,
        _note: p.note,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.rpc("create_restock" as any, {
        _business_id: p.businessId,
        _items: p.items as any,
        _note: p.note,
      });
      if (error) throw error;
    }
    await removePending(p.localId);
    return true;
  } catch (e: any) {
    p.retries = (p.retries ?? 0) + 1;
    p.lastError = e?.message ?? String(e);
    await updatePending(p);
    return false;
  }
}

let syncing = false;
export async function syncNow(businessId?: string): Promise<{ pushed: number; failed: number }> {
  if (syncing) return { pushed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { pushed: 0, failed: 0 };
  syncing = true;
  notify();
  let pushed = 0, failed = 0;
  try {
    const items = await listPending(businessId);
    for (const it of items) {
      const ok = await push(it);
      if (ok) pushed++; else { failed++; break; } // stop on first failure to preserve order
    }
  } finally {
    syncing = false;
    notify();
  }
  return { pushed, failed };
}

export function isSyncing() { return syncing; }
