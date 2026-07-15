// Guarded service-worker registration. See PWA skill rules:
// - Never register in dev, Lovable preview, iframe, or when ?sw=off is present.
// - Unregister any existing /sw.js registration in refused contexts.
export async function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const inIframe = window.self !== window.top;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const swOff = url.searchParams.get("sw") === "off";

  const refuse = !import.meta.env.PROD || inIframe || isPreviewHost || swOff;

  if (refuse) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        const src = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
        if (src.endsWith("/sw.js")) await r.unregister();
      }
    } catch { /* ignore */ }
    return;
  }

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch { /* ignore */ }
}
