/**
 * Live preview pane.
 *
 * Boots eagerly on mount with the boilerplate from /api/template/zip, then
 * swaps in the generated project when a generation completes. Wraps the
 * iframe in a viewport selector (mobile / tablet / desktop / fit).
 */

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { WebContainer, type FileSystemTree } from "@webcontainer/api";
import { unzipSync } from "fflate";
import type { Creds } from "@/api";
import { ViewportToolbar, VIEWPORTS, type ViewportId } from "./ViewportToolbar";

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

  const [viewport, setViewport] = React.useState<ViewportId>("mobile");
  const [customWidth, setCustomWidth] = React.useState<number>(
    VIEWPORTS.mobile.width ?? 390,
  );
  const [iframeKey, setIframeKey] = React.useState(0);

  const wcRef = React.useRef<WebContainer | null>(null);
  const installedRef = React.useRef(false);
  const lastProjectRef = React.useRef<string | null>(null);

  function pickViewport(id: ViewportId) {
    setViewport(id);
    if (VIEWPORTS[id].width) setCustomWidth(VIEWPORTS[id].width!);
  }

  // ─── Eager boot of the template ─────────────────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    const log = (m: string) => !cancelled && setStageMessage(m);

    (async () => {
      try {
        setErrorDetail(null);

        setStage("fetching");
        log("Downloading the boilerplate…");
        const res = await fetch(TEMPLATE_ZIP_URL);
        if (!res.ok) throw new Error(`Template fetch failed (${res.status})`);
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
      } catch (e: unknown) {
        if (cancelled) return;
        setStage("error");
        setErrorDetail(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
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
        setStage("ready");
        setStageMessage("");
      } catch (e: unknown) {
        if (cancelled) return;
        setStage("error");
        setErrorDetail(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, creds]);

  const status =
    stage === "ready"
      ? ("live" as const)
      : stage === "updating"
        ? ("updating" as const)
        : ("loading" as const);

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0 border-l border-border bg-surface">
      <ViewportToolbar
        viewport={viewport}
        onViewport={pickViewport}
        width={customWidth}
        onWidth={setCustomWidth}
        status={status}
        url={url}
        onRefresh={() => setIframeKey((k) => k + 1)}
      />

      <div className="flex-1 min-h-0 preview-canvas overflow-auto p-4 flex items-start justify-center">
        {stage === "error" ? (
          <ErrorPanel detail={errorDetail} />
        ) : url ? (
          <Frame
            url={url}
            iframeKey={iframeKey}
            viewport={viewport}
            customWidth={customWidth}
          />
        ) : (
          <LoadingPanel stage={stage} message={stageMessage} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────

function Frame({
  url,
  iframeKey,
  viewport,
  customWidth,
}: {
  url: string;
  iframeKey: number;
  viewport: ViewportId;
  customWidth: number;
}) {
  const fit = viewport === "fit";
  const v = VIEWPORTS[viewport];
  const style: React.CSSProperties = fit
    ? { width: "100%", height: "100%" }
    : {
        width: customWidth,
        height: v.height ?? 844,
        maxWidth: "100%",
      };
  return (
    <div
      style={style}
      className="bg-white rounded-xl shadow-lg overflow-hidden border border-border transition-all duration-200"
    >
      <iframe
        key={iframeKey}
        title="Preview"
        src={url}
        className="w-full h-full bg-white"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      />
    </div>
  );
}

function LoadingPanel({ stage, message }: { stage: Stage; message: string }) {
  return (
    <div className="m-auto rounded-lg border border-border bg-panel shadow-xs px-6 py-8 max-w-sm flex flex-col items-center gap-3 text-center">
      <Loader2 size={22} className="animate-spin text-accent" />
      <div className="text-[13px] font-medium">{labelForStage(stage)}</div>
      <div className="text-[12px] text-muted truncate w-full font-mono">
        {message}
      </div>
    </div>
  );
}

function ErrorPanel({ detail }: { detail: string | null }) {
  return (
    <div className="m-auto max-w-md rounded-lg border border-danger/30 bg-danger/5 p-4 flex items-start gap-2 text-sm text-danger">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">Preview failed</div>
        <div className="text-danger/80 mt-1 break-all text-[12px]">{detail}</div>
      </div>
    </div>
  );
}

function labelForStage(s: Stage): string {
  switch (s) {
    case "fetching":   return "Downloading boilerplate";
    case "mounting":   return "Mounting files";
    case "installing": return "Installing dependencies";
    case "booting":    return "Starting dev server";
    case "updating":   return "Applying generated changes";
    default:           return "Working";
  }
}

// ─── helpers ──────────────────────────────────────────────────────────

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

function injectEnvLocal(tree: FileSystemTree, creds: Creds | null) {
  const lines = [
    `VITE_HW_API_KEY=${creds?.apiKey || ""}`,
    `VITE_HW_SECRET_KEY=${creds?.secretKey || ""}`,
    "",
  ];
  tree[".env.local"] = { file: { contents: lines.join("\n") } };
}

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
