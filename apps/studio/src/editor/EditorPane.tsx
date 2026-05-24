/**
 * The Code tab inside the Generate page.
 *
 * Waits for the shared WebContainer to be ready, walks its file system,
 * and lets the user browse + edit files. Edits are debounced (300ms)
 * and written back to the WebContainer FS — Vite HMR picks them up and
 * refreshes the live preview in the sibling Preview tab.
 */

import * as React from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { getContainer } from "@/preview/container";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { readFile, walkFs, writeFile, type Node } from "./walkFs";

const POLL_INTERVAL_MS = 600;
const SENTINEL_FILE = "/package.json"; // proxy for "mount completed"

type Status = "waiting" | "loading" | "ready" | "error";

export function EditorPane({ projectId }: { projectId: string | null }) {
  const [status, setStatus] = React.useState<Status>("waiting");
  const [tree, setTree] = React.useState<Node[]>([]);
  const [activePath, setActivePath] = React.useState<string | null>(null);
  const [activeContent, setActiveContent] = React.useState<string>("");
  const [savedMark, setSavedMark] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const wcRef = React.useRef<Awaited<ReturnType<typeof getContainer>> | null>(null);
  const writeTimerRef = React.useRef<number | null>(null);

  // ─── Wait for sandbox + walk FS ──────────────────────────────────────
  const refresh = React.useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      const wc = wcRef.current ?? (await getContainer());
      wcRef.current = wc;
      const nodes = await walkFs(wc, "/");
      setTree(nodes);
      // Auto-pick a sensible first file if nothing is selected
      setActivePath((cur) => cur ?? firstFile(nodes));
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const wc = await getContainer();
      wcRef.current = wc;
      // Poll for the sentinel until the boilerplate is mounted.
      while (!cancelled) {
        try {
          await wc.fs.readFile(SENTINEL_FILE);
          break;
        } catch {
          await sleep(POLL_INTERVAL_MS);
        }
      }
      if (cancelled) return;
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Re-walk when a generation completes
  React.useEffect(() => {
    if (!projectId) return;
    // Small delay so the new mount can settle before we walk
    const t = window.setTimeout(() => { void refresh(); }, 400);
    return () => window.clearTimeout(t);
  }, [projectId, refresh]);

  // ─── Read selected file ──────────────────────────────────────────────
  React.useEffect(() => {
    if (!activePath || !wcRef.current) return;
    (async () => {
      try {
        const txt = await readFile(wcRef.current!, activePath);
        setActiveContent(txt);
      } catch (e) {
        setActiveContent(`// Couldn't read ${activePath}\n// ${e instanceof Error ? e.message : e}`);
      }
    })();
  }, [activePath]);

  // ─── Write on edit, debounced ────────────────────────────────────────
  function onEdit(next: string) {
    setActiveContent(next);
    if (!activePath || !wcRef.current) return;
    setSavedMark("saving");
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(async () => {
      try {
        await writeFile(wcRef.current!, activePath, next);
        setSavedMark("saved");
        window.setTimeout(() => setSavedMark("idle"), 1200);
      } catch (e) {
        setSavedMark("idle");
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 300);
  }

  // ─── Render ──────────────────────────────────────────────────────────
  if (status === "waiting" || status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3 text-sm">
          <Loader2 size={22} className="animate-spin text-accent" />
          <div className="text-[13px] font-medium text-text">
            {status === "waiting" ? "Waiting for the sandbox…" : "Loading files…"}
          </div>
          <div className="text-[12px] text-muted">
            The Code tab opens once the boilerplate has finished mounting.
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex-1 p-4 bg-surface">
        <div className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <div className="font-medium">Code editor failed</div>
          <div className="text-danger/80 text-[12px] mt-1 break-all">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr] bg-bg">
      {/* File tree */}
      <aside className="border-r border-border bg-surface overflow-y-auto">
        <div className="h-9 border-b border-border bg-panel flex items-center px-3 gap-2 text-[11.5px] text-muted">
          <FileText size={12} />
          <span className="font-medium">Files</span>
          <button
            onClick={() => void refresh()}
            title="Refresh"
            className="ml-auto h-6 w-6 rounded text-muted hover:bg-surface-2 hover:text-text flex items-center justify-center"
          >
            <RefreshCw size={11} />
          </button>
        </div>
        <FileTree nodes={tree} activePath={activePath} onSelect={setActivePath} />
      </aside>

      {/* Editor */}
      <section className="flex flex-col min-h-0">
        <div className="h-9 border-b border-border bg-panel flex items-center px-3 gap-2 text-[11.5px] text-muted">
          <span className="font-mono text-text truncate">
            {activePath ?? "—"}
          </span>
          <span className="ml-auto tabular-nums">
            {savedMark === "saving" && <span className="text-info">Saving…</span>}
            {savedMark === "saved" && <span className="text-success">Saved · live preview updated</span>}
            {savedMark === "idle" && (
              <span className="text-muted/60">Edits sync to preview</span>
            )}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          {activePath ? (
            <CodeEditor path={activePath} value={activeContent} onChange={onEdit} />
          ) : (
            <div className="h-full flex items-center justify-center text-[13px] text-muted">
              Select a file
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function firstFile(nodes: Node[]): string | null {
  // Prefer the most recent generated screen
  const screens = findDir(nodes, "screens")?.[0];
  if (screens) return screens;
  // Otherwise the registry — that's the second most informative file
  const reg = findFile(nodes, "productScreenRegistry.ts");
  if (reg) return reg;
  // Otherwise something
  return firstAnyFile(nodes);
}
function findDir(nodes: Node[], name: string): string[] | null {
  for (const n of nodes) {
    if (n.type === "dir" && n.name === name) {
      return childFilePaths(n.children);
    }
    if (n.type === "dir") {
      const r = findDir(n.children, name);
      if (r) return r;
    }
  }
  return null;
}
function findFile(nodes: Node[], name: string): string | null {
  for (const n of nodes) {
    if (n.type === "file" && n.name === name) return n.path;
    if (n.type === "dir") {
      const r = findFile(n.children, name);
      if (r) return r;
    }
  }
  return null;
}
function firstAnyFile(nodes: Node[]): string | null {
  for (const n of nodes) {
    if (n.type === "file") return n.path;
    if (n.type === "dir") {
      const r = firstAnyFile(n.children);
      if (r) return r;
    }
  }
  return null;
}
function childFilePaths(nodes: Node[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === "file") out.push(n.path);
    else out.push(...childFilePaths(n.children));
  }
  return out;
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
