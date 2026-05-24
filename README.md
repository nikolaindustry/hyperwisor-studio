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

- **Frontend** (`apps/studio`): Vite + React, runs on Vercel
- **API** (`apps/api`): Fastify, runs on Render or Fly
- **Generation**: Claude Agent SDK using `CLAUDE.md` from the starter as the playbook
- **Preview**: [@webcontainer/api](https://webcontainers.io) — the generated Vite project boots inside a sandboxed iframe in the user's browser. No preview infra to run.

## Run locally

You need two terminals.

### Terminal 1 — API

```bash
cd apps/api
# .env (in apps/api or exported in your shell)
export ANTHROPIC_API_KEY=sk-ant-...
export CORS_ORIGIN=http://localhost:5173
npm run dev
# → API on http://localhost:4000
```

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
   - `ANTHROPIC_API_KEY` (server-side, never exposed)
   - `CORS_ORIGIN=https://studio.hyperwisor.com`
   - `PORT=4000`
6. Plan: **Standard** (the free tier sleeps and breaks long agent runs)

**Fly.io** alternative — drop in a basic `fly.toml` and `fly deploy`. The API has no special filesystem needs; `/tmp-projects/` is created automatically.

## Important notes

- **Cross-origin isolation.** WebContainer requires the studio page to send `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`. Already configured in `vite.config.ts`; mirror that in your Vercel `vercel.json` for production.
- **AI cost.** Each generation runs ~17 turns of Claude Sonnet and costs ~$0.50. Bill into your Hyperwisor plan or rate-limit per manufacturer.
- **Scratch projects.** The API writes each generation under `tmp-projects/<uuid>/`. Set a periodic cleanup or add a TTL — they pile up.

## Roadmap

| Phase | Status |
|---|---|
| **3a · MVP** — generate + preview + download | ✅ shipped (this commit) |
| **3b · Persistence + iteration** — project store, "tweak this screen" chat | next |
| **3c · One-click deploy + native builds** — subdomain hosting, Capacitor cloud builds | after 3b |

## License

MIT.
