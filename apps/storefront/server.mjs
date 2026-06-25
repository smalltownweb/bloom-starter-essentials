// ─────────────────────────────────────────────────────────────────────────────
// Node self-host-adapter for TanStack Start-storefronten.
//
// TanStack Start 1.144 (Vite-baseret) producerer en Web-`fetch`-handler
// (dist/server/server.js, default-export `{ fetch }`) + statiske assets
// (dist/client/) — den har INGEN node-listener (bygget til Netlify/edge).
// For self-host på Coolify (node-container) broer vi fetch-handleren til en
// node-HTTP-server via @hono/node-server og serverer klient-assets statisk.
//
// Dette er storefront-analogen til backendens `ssl:false`: en self-host-tilpasning
// i fork-laget som ALLE TanStack-Start-arketyper sandsynligvis kræver.
// ─────────────────────────────────────────────────────────────────────────────
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import handler from "./dist/server/server.js";

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

const app = new Hono();

// 1) Statiske klient-assets (dist/client). serveStatic kalder next() ved 404,
//    så ukendte stier falder igennem til SSR-handleren nedenfor.
app.use("/*", serveStatic({ root: "./dist/client" }));

// 2) Alt andet → TanStack Start SSR fetch-handler (default-export.fetch).
app.all("/*", (c) => handler.fetch(c.req.raw));

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`[storefront] node-adapter listening on http://${hostname}:${info.port}`);
});
