# Hyperwisor Studio

The hosted AI designer that builds white-label IoT apps from your Hyperwisor products.

A manufacturer signs in with their Hyperwisor keys, picks a product, and watches the AI agent generate a complete, branded React app — composed from the [Hyperwisor app starter](https://github.com/nikolaindustry/hyperwisor-app-starter), wired to the real device, and previewed live in the browser. They download the source or deploy it.

> Phase 3 of the path that started with [`hyperwisor-app-starter`](https://github.com/nikolaindustry/hyperwisor-app-starter) (the boilerplate + `npm run generate` engine) and [`create-hyperwisor-app`](https://github.com/nikolaindustry/create-hyperwisor-app) (the standalone CLI). Studio wraps the same generation engine in a hosted web UI.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    studio.hyperwisor.com                     │
│  Products list · Chat/log · Live in-browser preview          │
└────────┬──────────────────────────────────────┬──────────────┘
         │ POST /api/generate (SSE)             │ WebContainer
         ▼                                      ▼
┌──────────────────────┐                ┌────────────────────┐
│  Fastify API server  │                │ In-browser Vite    │
│  • verify keys       │                │ — zero preview     │
│  • list products     │                │   infra to run     │
│  • run agent SDK     │                └────────────────────┘
│  • zip & download    │
└──────────────────────┘
   (Anthropic key      
    is server-side.    
    Manufacturer       
    never sees one.)   
```

- **Frontend** (`apps/studio`): Vite + React, runs on Render Static Site (or Vercel)
- **API** (`apps/api`): Fastify, runs on Render Web Service (or Fly) — long-running because agent runs take 2–4 min
- **Generation**: Claude Agent SDK using `CLAUDE.md` from the starter as the playbook
- **Preview**: [@webcontainer/api](https://webcontainers.io) — the generated Vite project boots inside a sandboxed iframe in the user's browser. No preview infra to run.

### BYOK — Bring Your Own Key

Studio is **bring-your-own-key** for Anthropic. Each manufacturer pastes
their own `sk-ant-…` on the login screen; it's stored in their browser
and sent only with `/api/generate` calls. The server never persists it
and never uses a shared key. This means:

- **No AI costs for you to bear.** The manufacturer pays Anthropic directly.
- **No rate-limit engineering needed.** Each manufacturer has their own Anthropic quota.
- **Full transparency.** They can audit their own Anthropic usage dashboard.

## Run locally

You need two terminals.

### Terminal 1 — API

```bash
cd apps/api
export CORS_ORIGIN=http://localhost:5173
npm run dev
# → API on http://localhost:4000
```

The API does NOT need an Anthropic key — the manufacturer brings theirs
when they sign in.

### Terminal 2 — Web

```bash
cd apps/studio
npm run dev
# → http://localhost:5173
```

Sign in with your Hyperwisor `mk_…` / `msk_…` keys. The API verifies them against the Hyperwisor backend; nothing is stored server-side.

## Deploy

### Frontend → Vercel

1. Import the repo
2. **Root Directory:** `apps/studio`
3. **Framework:** Vite
4. **Build command:** `npm run build`
5. **Output:** `dist`
6. **Environment:** `VITE_API_URL=https://your-api.example.com`

### API → Render or Fly

The API is a long-running Node process (agent runs take 2–4 minutes, longer than Vercel's serverless cap).

**Render** (simplest):
1. New **Web Service** → connect repo
2. **Root Directory:** `apps/api`
3. **Build:** `npm install`
4. **Start:** `npm start`
5. **Environment:**
   - `CORS_ORIGIN=https://studio.hyperwisor.com`
   - `PORT=4000`
   - *(No `ANTHROPIC_API_KEY` — the studio is BYOK.)*
6. Plan: **Starter** (the free tier sleeps and breaks long agent runs)

**Fly.io** alternative — drop in a basic `fly.toml` and `fly deploy`. The API has no special filesystem needs; `/tmp-projects/` is created automatically.

## Important notes

- **Cross-origin isolation.** WebContainer requires the studio page to send `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`. Already configured in `vite.config.ts`; mirror that in your Vercel `vercel.json` for production.
- **AI cost.** Each generation runs ~17 turns of Claude Sonnet and costs ~$0.50 — paid by the manufacturer against their own Anthropic key (BYOK). The studio server never holds a key.
- **Scratch projects.** The API writes each generation under `tmp-projects/<uuid>/`. Set a periodic cleanup or add a TTL — they pile up.

## Roadmap

| Phase | Status |
|---|---|
| **3a · MVP** — generate + preview + download | ✅ shipped (this commit) |
| **3b · Persistence + iteration** — project store, "tweak this screen" chat | next |
| **3c · One-click deploy + native builds** — subdomain hosting, Capacitor cloud builds | after 3b |

## License

MIT.
