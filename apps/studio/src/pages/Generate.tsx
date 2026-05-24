import * as React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Cpu,
  Download,
  Play,
  Terminal,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/auth";
import { api, type Product } from "@/api";
import { Preview } from "@/preview/Preview";

type Event = {
  id: number;
  type: string;
  text?: string;
  tool?: string;
  args?: string;
  message?: string;
};

export function Generate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { creds } = useAuth();
  const location = useLocation();
  const product = (location.state as any)?.product as Product | undefined;

  const [events, setEvents] = React.useState<Event[]>([]);
  const [running, setRunning] = React.useState(false);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{
    turns?: number;
    cost?: number;
    duration_ms?: number;
  } | null>(null);
  const logRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  function start() {
    if (!id || !creds || running) return;
    setEvents([]);
    setProjectId(null);
    setError(null);
    setStats(null);
    setRunning(true);

    let n = 0;
    const cancel = api.generate(
      {
        ...creds,
        productId: id,
        productName: product?.product_name,
      },
      (ev) => {
        switch (ev.type) {
          case "studio.start":
            setProjectId(ev.projectId);
            push({ type: "log", message: `Project ${String(ev.projectId).slice(0, 8)}… created` });
            break;
          case "studio.log":
            push({ type: "log", message: ev.message });
            break;
          case "agent.start":
            push({ type: "log", message: `Agent generating "${ev.productName}"` });
            break;
          case "agent.thought":
            push({ type: "thought", text: ev.text });
            break;
          case "agent.tool":
            push({ type: "tool", tool: ev.name, args: ev.args });
            break;
          case "agent.done":
            setStats({
              turns: ev.turns,
              cost: ev.cost_usd,
              duration_ms: ev.duration_ms,
            });
            push({
              type: "log",
              message: `Agent done · ${ev.turns} turns · $${(ev.cost_usd || 0).toFixed(3)}`,
            });
            break;
          case "studio.done":
            setRunning(false);
            push({ type: "success", message: "Generation complete" });
            break;
          case "agent.error":
          case "studio.error":
            setRunning(false);
            setError(ev.message || ev.subtype || "Generation failed");
            push({
              type: "error",
              message: ev.message || ev.subtype || "Error",
            });
            break;
        }
      },
    );

    function push(p: Omit<Event, "id">) {
      setEvents((prev) => [...prev, { id: ++n, ...p }]);
    }

    return cancel;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto h-14 px-4 flex items-center gap-2">
          <button
            onClick={() => navigate("/products")}
            className="icon-btn"
            title="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Cpu size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">
              {product?.product_name ?? "Product"}
            </div>
            <div className="text-[11px] text-muted truncate">
              {product?.product_category ?? "—"}
              {product?.model_number ? ` · ${product.model_number}` : ""}
              {` · ${id}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {projectId && !running && !error ? (
              <a
                href={api.zipUrl(projectId)}
                className="btn-secondary"
                download
              >
                <Download size={14} /> Download
              </a>
            ) : null}
            <button onClick={start} disabled={running || !id} className="btn-primary">
              {running ? (
                <span className="inline-block h-3.5 w-3.5 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
              ) : (
                <Play size={14} />
              )}
              {running ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-border max-w-6xl mx-auto w-full">
        {/* Left — log */}
        <section className="bg-bg p-4 lg:p-5 flex flex-col min-h-[60vh]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
            <Terminal size={14} /> Agent log
            {stats ? (
              <span className="ml-auto text-[11px] tabular-nums">
                {stats.turns} turns · {((stats.duration_ms ?? 0) / 1000).toFixed(1)}s · ${(
                  stats.cost ?? 0
                ).toFixed(3)}
              </span>
            ) : null}
          </div>

          <div
            ref={logRef}
            className="mt-3 flex-1 overflow-y-auto rounded-lg bg-panel border border-border p-3 text-sm space-y-2 font-mono text-[12.5px]"
          >
            {events.length === 0 ? (
              <div className="text-muted text-[13px] font-sans">
                {running
                  ? "Starting…"
                  : "Click Generate to start. The agent will inspect this product, then write a bespoke React screen and verify it compiles."}
              </div>
            ) : null}

            {events.map((ev) => (
              <EventRow key={ev.id} ev={ev} />
            ))}

            {error ? (
              <div className="text-danger flex items-start gap-1.5 pt-2 font-sans">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </section>

        {/* Right — preview */}
        <section className="bg-bg p-4 lg:p-5 flex flex-col min-h-[60vh]">
          <div className="text-[13px] font-medium text-muted">Live preview</div>
          <Preview projectId={projectId} ready={!running && !!projectId && !error} />
        </section>
      </main>

      <style>{`
        .icon-btn { width:36px; height:36px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:#A1A1AA; background: transparent; border:0; cursor:pointer; }
        .icon-btn:hover { background:#1F1F23; color:#FAFAFA; }
        .btn-primary { display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 12px; border-radius:8px; background:#3B82F6; color:white; font-weight:500; font-size:13px; border:0; cursor:pointer; }
        .btn-primary:hover { opacity:.92; }
        .btn-primary:disabled { opacity:.5; cursor:default; }
        .btn-secondary { display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 12px; border-radius:8px; background:#131316; border:1px solid #27272A; color:#FAFAFA; font-weight:500; font-size:13px; cursor:pointer; text-decoration:none; }
        .btn-secondary:hover { background:#1F1F23; }
      `}</style>
    </div>
  );
}

function EventRow({ ev }: { ev: Event }) {
  if (ev.type === "thought") {
    return (
      <div className="text-foreground font-sans text-[13px] leading-snug bg-surface/40 rounded-md p-2.5 animate-fade-in">
        {ev.text}
      </div>
    );
  }
  if (ev.type === "tool") {
    return (
      <div className="text-primary/90 animate-fade-in">
        <span className="text-muted">→</span> {ev.tool}
        {ev.args ? <span className="text-muted"> · {ev.args}</span> : null}
      </div>
    );
  }
  if (ev.type === "success") {
    return (
      <div className="text-success animate-fade-in font-sans">✓ {ev.message}</div>
    );
  }
  if (ev.type === "error") {
    return (
      <div className="text-danger animate-fade-in font-sans">✗ {ev.message}</div>
    );
  }
  // log
  return (
    <div className="text-muted animate-fade-in">{ev.message}</div>
  );
}
