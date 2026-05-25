import * as React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Code2,
  Cpu,
  Download,
  KeyRound,
  Monitor,
  Play,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import { useAuth } from "@/auth";
import { api, type Product } from "@/api";
import { Preview } from "@/preview/Preview";
import { EditorPane } from "@/editor/EditorPane";
import { applyGeneratedScreen } from "@/editor/applyGeneratedScreen";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

type Mode = "quick" | "pro";
const MODE_KEY = "hyperwisor-studio.mode";

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
  const { creds, setAnthropicKey } = useAuth();
  const location = useLocation();
  const product = (location.state as { product?: Product } | null)?.product;
  const hasAnthropicKey = Boolean(creds?.anthropicKey);

  const [mode, setModeState] = React.useState<Mode>(() => {
    const stored = localStorage.getItem(MODE_KEY);
    return stored === "pro" || stored === "quick" ? (stored as Mode) : "quick";
  });
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  };

  const [events, setEvents] = React.useState<Event[]>([]);
  const [running, setRunning] = React.useState(false);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<{
    turns?: number;
    cost?: number;
    duration_ms?: number;
    tokens?: number;
  } | null>(null);
  const logRef = React.useRef<HTMLDivElement>(null);
  const eventCounterRef = React.useRef(0);

  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  function push(p: Omit<Event, "id">) {
    eventCounterRef.current += 1;
    setEvents((prev) => [...prev, { id: eventCounterRef.current, ...p }]);
  }

  function reset() {
    setEvents([]);
    eventCounterRef.current = 0;
    setProjectId(null);
    setError(null);
    setStats(null);
  }

  // ─── Quick: Hyperwisor edge function ─────────────────────────────────
  async function startQuick() {
    if (!id || !creds || running) return;
    reset();
    setRunning(true);
    push({ type: "log", message: "Quick mode · Hyperwisor AI (Lovable gateway)" });
    push({ type: "log", message: `Calling studio-generate-screen for "${product?.product_name ?? id}"…` });

    try {
      const res = await api.quickGenerate({
        apiKey: creds.apiKey,
        secretKey: creds.secretKey,
        productId: id,
      });

      const tokens = res.usage?.total_tokens;
      push({
        type: "log",
        message: `Model returned ${res.screen.content.length} chars${
          tokens ? ` (${tokens} tokens)` : ""
        }`,
      });
      setStats({
        tokens,
        // Lovable usage doesn't surface a USD cost; show $0 for the user
        cost: 0,
      });

      push({ type: "log", message: `Applying ${res.screen.suggestedPath}…` });
      await applyGeneratedScreen(id, res.screen, (m) =>
        push({ type: "log", message: m }),
      );

      push({ type: "success", message: "Done — switch to Preview to see it" });
      setRunning(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      push({ type: "error", message: msg });
      setRunning(false);
    }
  }

  // ─── Pro: Studio API → Claude Agent SDK (BYOK) ───────────────────────
  function startPro() {
    if (!id || !creds || running || !hasAnthropicKey) return;
    reset();
    setRunning(true);
    push({ type: "log", message: "Pro mode · Claude Agent SDK (BYOK)" });

    api.generate(
      {
        apiKey: creds.apiKey,
        secretKey: creds.secretKey,
        anthropicKey: creds.anthropicKey!,
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
            setStats({ turns: ev.turns, cost: ev.cost_usd, duration_ms: ev.duration_ms });
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
            push({ type: "error", message: ev.message || ev.subtype || "Error" });
            break;
        }
      },
    );
  }

  function start() {
    if (mode === "quick") void startQuick();
    else startPro();
  }

  const generateDisabled =
    running || !id || (mode === "pro" && !hasAnthropicKey);
  const generateTooltip =
    mode === "pro" && !hasAnthropicKey ? "Add your Anthropic API key first" : undefined;

  return (
    <>
      <PageHeader
        back={
          <Button variant="ghost" size="sm" onClick={() => navigate("/products")}>
            <ChevronLeft size={15} />
            Products
          </Button>
        }
        title={
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-primary/15 text-accent flex items-center justify-center">
              <Cpu size={13} />
            </span>
            <span>{product?.product_name ?? "Product"}</span>
          </div>
        }
        subtitle={
          <>
            {product?.product_category ?? "—"}
            {product?.model_number ? ` · ${product.model_number}` : ""}
            <span className="text-muted/60"> · {id}</span>
          </>
        }
        actions={
          <>
            {/* Mode toggle */}
            <ModeToggle
              mode={mode}
              onChange={setMode}
              hasAnthropicKey={hasAnthropicKey}
            />

            {/* Download (Pro mode only — Quick writes straight to WebContainer) */}
            {projectId && !running && !error ? (
              <a
                href={api.zipUrl(projectId)}
                download
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] font-medium border border-border bg-panel hover:bg-surface shadow-xs"
              >
                <Download size={14} /> Download
              </a>
            ) : null}

            <Button
              onClick={start}
              disabled={generateDisabled}
              title={generateTooltip}
              size="md"
            >
              {running ? null : <Play size={13} />}
              {running ? "Generating…" : "Generate"}
            </Button>
          </>
        }
      />

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(360px,_440px)_1fr]">
        {/* LEFT — Agent log */}
        <section className="border-r border-border flex flex-col min-h-0">
          <div className="h-9 border-b border-border bg-panel px-3 flex items-center gap-2 text-[11.5px] text-muted">
            <Terminal size={12} />
            <span className="font-medium">Agent</span>
            <span className="text-muted/60">·</span>
            <span className="text-text font-medium">
              {mode === "quick" ? "Quick" : "Pro"}
            </span>
            {stats ? (
              <span className="ml-auto tabular-nums">
                {stats.turns ? `${stats.turns} turns · ` : ""}
                {stats.duration_ms ? `${(stats.duration_ms / 1000).toFixed(1)}s · ` : ""}
                {stats.tokens ? `${stats.tokens} tok · ` : ""}
                {typeof stats.cost === "number" ? `$${stats.cost.toFixed(3)}` : ""}
              </span>
            ) : null}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 bg-surface">
            {mode === "pro" && !hasAnthropicKey && events.length === 0 ? (
              <AnthropicKeyPrompt onSave={setAnthropicKey} />
            ) : null}

            <div ref={logRef} className="space-y-2">
              {events.length === 0 ? (
                <p className="text-[12.5px] text-muted px-1 py-2">
                  {mode === "quick"
                    ? "Quick mode — Hyperwisor's AI writes a single TSX file in ~6s and patches it into the live preview. Free, no Anthropic key required."
                    : !hasAnthropicKey
                      ? "Add your Anthropic API key above to enable Pro mode."
                      : "Pro mode — Claude Agent SDK reads files, iterates, runs tsc. ~3 min, polished output."}
                </p>
              ) : null}
              {events.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
              {error ? (
                <div className="text-danger flex items-start gap-1.5 pt-2 text-[12.5px]">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* RIGHT — Preview / Code tabs */}
        <RightPane projectId={projectId} creds={creds} />
      </div>
    </>
  );
}

// ─── Mode toggle ──────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
  hasAnthropicKey,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  hasAnthropicKey: boolean;
}) {
  return (
    <div className="flex items-center bg-surface rounded-md p-0.5 border border-border">
      <ModeOption
        active={mode === "quick"}
        onClick={() => onChange("quick")}
        icon={<Zap size={11} />}
        label="Quick"
        hint="Free · ~6s"
      />
      <ModeOption
        active={mode === "pro"}
        onClick={() => onChange("pro")}
        icon={<Cpu size={11} />}
        label="Pro"
        hint={hasAnthropicKey ? "BYOK · ~3 min" : "Needs Anthropic key"}
        dimmed={!hasAnthropicKey}
      />
    </div>
  );
}

function ModeOption({
  active,
  onClick,
  icon,
  label,
  hint,
  dimmed,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  dimmed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={cn(
        "flex items-center gap-1.5 h-7 px-2.5 rounded text-[11.5px] font-medium transition-colors",
        active
          ? "bg-panel text-text shadow-xs"
          : "text-muted hover:text-text",
        dimmed && !active && "opacity-60",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Right pane: Preview / Code tabs ──────────────────────────────────

type RightTab = "preview" | "code";

function RightPane({
  projectId,
  creds,
}: {
  projectId: string | null;
  creds: ReturnType<typeof useAuth>["creds"];
}) {
  const [tab, setTab] = React.useState<RightTab>("preview");
  return (
    <section className="flex flex-col min-h-0 border-l border-border">
      <div className="h-9 shrink-0 border-b border-border bg-panel flex items-center px-2 gap-1">
        <TabButton
          active={tab === "preview"}
          onClick={() => setTab("preview")}
          icon={<Monitor size={12} />}
          label="Preview"
        />
        <TabButton
          active={tab === "code"}
          onClick={() => setTab("code")}
          icon={<Code2 size={12} />}
          label="Code"
        />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div className={cn("flex-1 min-h-0 flex flex-col", tab === "preview" ? "" : "hidden")}>
          <Preview projectId={projectId} creds={creds} />
        </div>
        <div className={cn("flex-1 min-h-0 flex flex-col", tab === "code" ? "" : "hidden")}>
          <EditorPane projectId={projectId} />
        </div>
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors",
        active
          ? "bg-surface-2 text-text"
          : "text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function AnthropicKeyPrompt({ onSave }: { onSave: (key: string) => void }) {
  const [key, setKey] = React.useState("");
  return (
    <Card className="border-primary/30 bg-primary/[0.06]">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-md bg-primary/15 text-accent flex items-center justify-center shrink-0">
          <KeyRound size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[13px]">Add your Anthropic API key</div>
          <div className="text-[11.5px] text-muted mt-0.5 leading-snug">
            Bring your own key — stored in your browser, sent only with the generate call.{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Get one
            </a>
            .
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          type="password"
          placeholder="sk-ant-…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <Button onClick={() => key.trim() && onSave(key.trim())} disabled={!key.trim()}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function EventRow({ ev }: { ev: Event }) {
  if (ev.type === "thought") {
    return (
      <div className="text-[12.5px] leading-snug bg-panel border border-border rounded-md px-3 py-2 text-text animate-fade-in">
        {ev.text}
      </div>
    );
  }
  if (ev.type === "tool") {
    return (
      <div className="font-mono text-[11.5px] text-accent px-1 animate-fade-in">
        <span className="text-muted">→</span> {ev.tool}
        {ev.args ? <span className="text-muted/80"> · {ev.args}</span> : null}
      </div>
    );
  }
  if (ev.type === "success") {
    return (
      <div className={cn("text-[12.5px] flex items-center gap-1.5 text-success px-1 animate-fade-in")}>
        ✓ {ev.message}
      </div>
    );
  }
  if (ev.type === "error") {
    return (
      <div className="text-[12.5px] text-danger px-1 animate-fade-in">
        ✗ {ev.message}
      </div>
    );
  }
  return (
    <div className="text-[11.5px] text-muted px-1 font-mono animate-fade-in">{ev.message}</div>
  );
}
