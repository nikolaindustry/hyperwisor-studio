/**
 * Hyperwisor App Studio — API server.
 *
 * Endpoints:
 *   GET  /api/health              health probe
 *   POST /api/auth/verify         { apiKey, secretKey } → { manufacturer_id }
 *   POST /api/products            { apiKey, secretKey } → product list
 *   POST /api/generate (SSE)      { apiKey, secretKey, productId, productName }
 *                                 → streams the agent run; closes with
 *                                   `done` event carrying { projectId }
 *   GET  /api/projects/:id/zip    downloads the generated project as zip
 *   DELETE /api/projects/:id      cleanup
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { Readable } from "node:stream";
import { verifyKeys, listProducts } from "./lib/hyperwisor.mjs";
import {
  cloneTemplate,
  installDeps,
  newProjectId,
  removeProject,
  writeEnv,
  zipTo,
} from "./lib/project.mjs";
import { generateScreen } from "./lib/agent.mjs";

const TEMPLATE_ZIP_URL =
  "https://github.com/nikolaindustry/hyperwisor-app-starter/archive/refs/heads/main.zip";

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
// Studio is BYOK — manufacturers send their own Anthropic key with each
// /api/generate request. We never store it server-side.

const app = Fastify({ logger: { level: "info" } });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","),
  credentials: true,
});
await app.register(cookie);

// ─── Health ──────────────────────────────────────────────────────────
app.get("/api/health", async () => ({
  ok: true,
  service: "hyperwisor-studio-api",
  version: "0.1.0",
}));

// ─── Auth verify ─────────────────────────────────────────────────────
app.post("/api/auth/verify", async (req, reply) => {
  const { apiKey, secretKey } = req.body || {};
  if (!apiKey || !secretKey) {
    return reply.code(400).send({ error: "apiKey and secretKey required" });
  }
  try {
    const { manufacturer_id } = await verifyKeys({ apiKey, secretKey });
    return { ok: true, manufacturer_id };
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }
});

// ─── Products ────────────────────────────────────────────────────────
app.post("/api/products", async (req, reply) => {
  const { apiKey, secretKey } = req.body || {};
  if (!apiKey || !secretKey) {
    return reply.code(400).send({ error: "apiKey and secretKey required" });
  }
  try {
    const products = await listProducts({ apiKey, secretKey });
    return { ok: true, products };
  } catch (e) {
    return reply.code(e.status || 500).send({ error: e.message });
  }
});

// ─── Generate (SSE) ──────────────────────────────────────────────────
app.post("/api/generate", async (req, reply) => {
  const { apiKey, secretKey, anthropicKey, productId, productName } =
    req.body || {};
  if (!apiKey || !secretKey || !productId) {
    return reply
      .code(400)
      .send({ error: "apiKey, secretKey, productId required" });
  }
  if (!anthropicKey || !anthropicKey.startsWith("sk-")) {
    return reply.code(400).send({
      error:
        "anthropicKey required — paste your Anthropic API key on the login screen.",
    });
  }

  // SSE setup
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (ev) => {
    reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
  };

  const projectId = newProjectId();
  const ac = new AbortController();
  req.raw.on("close", () => ac.abort());

  try {
    send({ type: "studio.start", projectId });

    await cloneTemplate(projectId, {
      onLog: (msg) => send({ type: "studio.log", message: msg }),
    });
    writeEnv(projectId, { apiKey, secretKey, anthropicKey });
    send({ type: "studio.log", message: ".env.local written" });

    await installDeps(projectId, {
      onLog: (msg) => send({ type: "studio.log", message: msg }),
    });

    const result = await generateScreen({
      projectId,
      productId,
      productName: productName || productId,
      anthropicKey,
      onEvent: send,
      abortController: ac,
    });

    if (!result.ok) {
      send({ type: "studio.error", message: result.error });
    } else {
      send({ type: "studio.done", projectId });
    }
  } catch (e) {
    send({ type: "studio.error", message: e.message });
  } finally {
    reply.raw.end();
  }
});

// ─── Download ────────────────────────────────────────────────────────
app.get("/api/projects/:id/zip", async (req, reply) => {
  const { id } = req.params;
  reply
    .header("Content-Type", "application/zip")
    .header("Content-Disposition", `attachment; filename="hyperwisor-app-${id.slice(0, 8)}.zip"`);
  await zipTo(id, reply.raw);
  reply.raw.end();
});

// ─── Cleanup ─────────────────────────────────────────────────────────
app.delete("/api/projects/:id", async (req) => {
  removeProject(req.params.id);
  return { ok: true };
});

// ─── Template proxy ──────────────────────────────────────────────────
// Streams the hyperwisor-app-starter zip from GitHub through our origin
// so the browser can fetch it (GitHub's archive endpoint doesn't send
// Access-Control-Allow-Origin, so a direct browser fetch fails CORS).
app.get("/api/template/zip", async (_req, reply) => {
  try {
    const upstream = await fetch(TEMPLATE_ZIP_URL, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return reply
        .code(502)
        .send({ error: `GitHub fetch failed (${upstream.status})` });
    }
    reply
      .type("application/zip")
      .header("Cache-Control", "public, max-age=300"); // 5 min browser cache
    return Readable.fromWeb(upstream.body);
  } catch (e) {
    return reply.code(502).send({ error: e.message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────
try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`\n  ⚡ Studio API on http://${HOST}:${PORT}\n`);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
