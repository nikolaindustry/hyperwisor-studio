/**
 * Live preview pane. After generation completes, fetches the project as a
 * zip, unpacks it in-browser, mounts it into a WebContainer, runs
 * `npm install --legacy-peer-deps && npm run dev`, and renders the dev
 * server in an iframe.
 *
 * WebContainer requires the host page to be cross-origin isolated
 * (COOP/COEP) — configured in vite.config.ts.
 */

import * as React from "react";
import { ExternalLink, Loader2, Play, AlertTriangle } from "lucide-react";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { unzipSync, strFromU8 } from "fflate";

type Stage =
  | "idle"
  | "fetching"
  | "mounting"
  | "installing"
  | "booting"
  | "ready"
  | "error";

// One container per page (the SDK enforces this).
let bootPromise: Promise<WebContainer> | null = null;
function getContainer() {
  if (!bootPromise) bootPromise = WebContainer.boot();
  return bootPromise;
}

export function Preview({
  projectId,
  ready,
}: {
  projectId: string | null;
  ready: boolean;
}) {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [stageMessage, setStageMessage] = React.useState<string>("");
  const [url, setUrl] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const lastProjectRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!ready || !projectId) return;
    if (lastProjectRef.current === projectId) return; // already booted this one
    lastProjectRef.current = projectId;

    let cancelled = false;
    const log = (m: string) => !cancelled && setStageMessage(m);

    (async () => {
      try {
        setUrl(null);
        setErrorDetail(null);

        setStage("fetching");
        log("Downloading project…");
        const res = await fetch(`/api/projects/${projectId}/zip`);
        if (!res.ok) throw new Error(`Couldn't fetch project (${res.status})`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        setStage("mounting");
        log("Unpacking…");
        const flat = unzipSync(buf);
        const tree = filesToTree(flat);

        const wc = await getContainer();
        if (cancelled) return;
        await wc.mount(tree);

        setStage("installing");
        log("Installing dependencies (this takes about a minute)…");
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

        setStage("booting");
        log("Booting dev server…");
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
  }, [projectId, ready]);

  // ─── Render ──────────────────────────────────────────────────────
  if (!projectId || (!ready && stage === "idle")) {
    return (
      <div className="mt-3 flex-1 rounded-lg border border-border bg-panel flex items-center justify-center text-sm text-muted">
        <div className="text-center max-w-xs">
          <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center text-muted mx-auto mb-3">
            <Play size={20} />
          </div>
          The live preview will appear here once generation completes.
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="mt-3 flex-1 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-medium">Preview failed</div>
          <div className="text-danger/80 mt-1 break-all">{errorDetail}</div>
          <div className="text-muted mt-3 text-[12px]">
            You can still download the generated project and run it locally.
          </div>
        </div>
      </div>
    );
  }

  if (stage !== "ready") {
    return (
      <div className="mt-3 flex-1 rounded-lg border border-border bg-panel flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-sm">
          <Loader2 size={22} className="animate-spin text-primary" />
          <div className="text-foreground font-medium">{labelForStage(stage)}</div>
          <div className="text-[12px] text-muted max-w-xs text-center truncate">
            {stageMessage}
          </div>
        </div>
      </div>
    );
  }

  // ready
  return (
    <div className="mt-3 flex-1 rounded-lg border border-border bg-panel overflow-hidden flex flex-col">
      <div className="h-9 border-b border-border bg-surface/50 flex items-center px-3 gap-2 text-[11px] text-muted">
        <span className="w-2 h-2 rounded-full bg-success" />
        Live
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
    case "fetching": return "Downloading project";
    case "mounting": return "Mounting files";
    case "installing": return "Installing dependencies";
    case "booting": return "Starting dev server";
    default: return "Working";
  }
}

// fflate gives a flat Record<path, Uint8Array>. WebContainer needs a nested
// FileSystemTree. Convert.
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
  // Silence "unused" warning on strFromU8 (kept available for future log decode).
  void strFromU8;
  return root;
}
