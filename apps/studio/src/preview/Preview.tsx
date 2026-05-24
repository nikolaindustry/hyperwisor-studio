/**
 * Live preview pane.
 *
 * Boots eagerly on mount with the boilerplate fetched straight from GitHub
 * (no Anthropic key required) so the manufacturer sees their real app
 * running immediately. When a generation completes, replaces the project
 * files with the agent's output and lets Vite HMR pick up the new screen.
 *
 * WebContainer requires the host page to be cross-origin isolated
 * (COOP/COEP) — configured in vite.config.ts.
 */

import * as React from "react";
import { ExternalLink, Loader2, AlertTriangle, Play } from "lucide-react";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { unzipSync } from "fflate";
import type { Creds } from "@/api";

// Served by our API as a CORS-friendly passthrough — GitHub's archive
// endpoint doesn't include Access-Control-Allow-Origin, so the browser
// can't fetch it directly.
const TEMPLATE_ZIP_URL = "/api/template/zip";

type Stage =
  | "idle"
  | "fetching"
  | "mounting"
  | "installing"
  | "booting"
  | "ready"
  | "updating"
  | "error";

// One container per page.
let bootPromise: Promise<WebContainer> | null = null;
function getContainer() {
  if (!bootPromise) bootPromise = WebContainer.boot();
  return bootPromise;
}

export function Preview({
  projectId,
  creds,
}: {
  projectId: string | null;
  creds: Creds | null;
}) {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [stageMessage, setStageMessage] = React.useState<string>("");
  const [url, setUrl] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);

  const wcRef = React.useRef<WebContainer | null>(null);
  const installedRef = React.useRef(false);
  const lastProjectRef = React.useRef<string | null>(null);

  // ─── Eager boot of the template, once ───────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    const log = (m: string) => !cancelled && setStageMessage(m);

    (async () => {
      try {
        setErrorDetail(null);

        setStage("fetching");
        log("Downloading the boilerplate from GitHub…");
        const res = await fetch(TEMPLATE_ZIP_URL);
        if (!res.ok) throw new Error(`GitHub fetch failed (${res.status})`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        setStage("mounting");
        log("Unpacking…");
        const flat = stripTopFolder(unzipSync(buf));
        const tree = filesToTree(flat);
        injectEnvLocal(tree, creds);

        const wc = await getContainer();
        wcRef.current = wc;
        if (cancelled) return;
        await wc.mount(tree);

        setStage("installing");
        log("Installing dependencies (≈ 60s the first time)…");
        const install = await wc.spawn("npm", [
          "install",
          "--legacy-peer-deps",
        ]);
        install.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const last = String(chunk).split("\n").filter(Boolean).pop();
              if (last) log(last.slice(0, 200));
            },
          }),
        );
        const code = await install.exit;
        if (cancelled) return;
        if (code !== 0) throw new Error("npm install failed in the preview container");
        installedRef.current = true;

        setStage("booting");
        log("Starting dev server…");
        wc.on("server-ready", (_port, serverUrl) => {
          if (cancelled) return;
          setUrl(serverUrl);
          setStage("ready");
        });
        const dev = await wc.spawn("npm", ["run", "dev"]);
        dev.output.pipeTo(
          new WritableStream({
            write(chunk) {
              const last = String(chunk).split("\n").filter(Boolean).pop();
              if (last) log(last.slice(0, 200));
            },
          }),
        );
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErrorDetail(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount only — credentials are written into
    // .env.local, and the dev server picks them up at boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── When a generation completes, swap in the agent's files ─────────
  React.useEffect(() => {
    if (!projectId) return;
    if (!wcRef.current || !installedRef.current) return;
    if (lastProjectRef.current === projectId) return;
    lastProjectRef.current = projectId;

    let cancelled = false;
    (async () => {
      try {
        setStage("updating");
        setStageMessage("Loading generated project…");
        const res = await fetch(`/api/projects/${projectId}/zip`);
        if (!res.ok) throw new Error(`Project fetch failed (${res.status})`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        const flat = unzipSync(buf);
        const tree = filesToTree(flat);
        injectEnvLocal(tree, creds);
        await wcRef.current!.mount(tree);
        if (cancelled) return;
        // Vite HMR will pick up file changes and refresh the iframe.
        setStage("ready");
        setStageMessage("");
      } catch (e: any) {
        if (cancelled) return;
        setStage("error");
        setErrorDetail(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, creds]);

  // ─── Render ─────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="mt-3 flex-1 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="font-medium">Preview failed</div>
          <div className="text-danger/80 mt-1 break-all">{errorDetail}</div>
          {projectId ? (
            <div className="text-muted mt-3 text-[12px]">
              You can still download the generated project and run it locally.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (stage !== "ready" && stage !== "updating") {
    return (
      <div className="mt-3 flex-1 rounded-lg border border-border bg-panel flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm max-w-sm text-center px-6">
          {stage === "idle" ? (
            <>
              <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center text-muted">
                <Play size={20} />
              </div>
              <div className="text-muted">Waking up the preview…</div>
            </>
          ) : (
            <>
              <Loader2 size={22} className="animate-spin text-primary" />
              <div className="text-foreground font-medium">{labelForStage(stage)}</div>
              <div className="text-[12px] text-muted truncate w-full">
                {stageMessage}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ready / updating
  return (
    <div className="mt-3 flex-1 rounded-lg border border-border bg-panel overflow-hidden flex flex-col">
      <div className="h-9 border-b border-border bg-surface/50 flex items-center px-3 gap-2 text-[11px] text-muted">
        <span
          className={
            stage === "updating"
              ? "w-2 h-2 rounded-full bg-primary animate-pulse"
              : "w-2 h-2 rounded-full bg-success"
          }
        />
        {stage === "updating" ? "Updating…" : "Live"}
        <span className="ml-auto truncate">{url}</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-foreground"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
      <iframe
        title="Preview"
        src={url ?? "about:blank"}
        className="flex-1 w-full bg-white"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      />
    </div>
  );
}

function labelForStage(s: Stage): string {
  switch (s) {
    case "fetching":  return "Downloading boilerplate";
    case "mounting":  return "Mounting files";
    case "installing":return "Installing dependencies";
    case "booting":   return "Starting dev server";
    case "updating":  return "Applying generated changes";
    default:          return "Working";
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

/** GitHub archive zips have everything under "<repo>-<branch>/" — strip it. */
function stripTopFolder(flat: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const keys = Object.keys(flat);
  if (keys.length === 0) return flat;
  const first = keys[0].split("/")[0] + "/";
  if (!keys.every((k) => k.startsWith(first))) return flat;
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(flat)) {
    const stripped = k.slice(first.length);
    if (stripped) out[stripped] = v;
  }
  return out;
}

/** Inject .env.local with Hyperwisor creds so the booted app can sign in. */
function injectEnvLocal(tree: FileSystemTree, creds: Creds | null) {
  const lines = [
    `VITE_HW_API_KEY=${creds?.apiKey || ""}`,
    `VITE_HW_SECRET_KEY=${creds?.secretKey || ""}`,
    "",
  ];
  tree[".env.local"] = { file: { contents: lines.join("\n") } };
}

/** fflate flat map → WebContainer FileSystemTree. */
function filesToTree(flat: Record<string, Uint8Array>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [rawPath, bytes] of Object.entries(flat)) {
    const isDir = rawPath.endsWith("/");
    const parts = rawPath.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let cur: any = root;
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const last = i === parts.length - 1;
      if (last && !isDir) {
        cur[segment] = { file: { contents: bytes } };
      } else {
        if (!cur[segment]) cur[segment] = { directory: {} };
        if (!cur[segment].directory) cur[segment] = { directory: {} };
        cur = cur[segment].directory;
      }
    }
  }
  return root;
}
