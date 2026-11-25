// MyLife — service worker: app shell offline + cache de bibliotecas/fontes.
// NUNCA cacheia: Supabase (dados do usuário), modelos de IA (o WebLLM tem cache próprio).
const CACHE = "mylife-v2";
const SHELL = ["/", "/index.html", "/manifest.json", "/ai/engine.js", "/ai/llm.js",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];
const CDN_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];
const SUPABASE_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    try { await c.add(new Request(SUPABASE_LIB, { mode: "cors" })); } catch (_) {} // melhor esforço
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_HOSTS.includes(url.hostname)) return; // Supabase, Hugging Face, etc.: rede direta
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // stale-while-revalidate: responde do cache na hora e atualiza em segundo plano
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === "navigate") return (await cache.match("/index.html")) || Response.error();
    return Response.error();
  })());
});
