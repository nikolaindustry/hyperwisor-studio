import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/auth";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = React.useState("");
  const [secretKey, setSecretKey] = React.useState("");
  const [anthropicKey, setAnthropicKey] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
        anthropicKey: anthropicKey.trim() || undefined,
      });
      navigate("/products", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Couldn't verify those keys.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="font-semibold leading-tight">Hyperwisor Studio</div>
            <div className="text-xs text-muted">AI app designer for your IoT products</div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted text-sm mt-1 mb-6">
          Paste your Hyperwisor manufacturer keys to get started.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="API key">
            <input
              className="input"
              type="text"
              placeholder="mk_…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Secret key">
            <input
              className="input"
              type="password"
              placeholder="msk_…"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              autoComplete="off"
              required
            />
          </Field>

          <div className="mt-2 pt-4 border-t border-border">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted mb-2">
              AI generation · optional now
            </div>
            <Field label="Anthropic API key">
              <input
                className="input"
                type="password"
                placeholder="sk-ant-… (add now or when you generate)"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <p className="text-[11px] text-muted mt-1.5 leading-snug">
              Bring your own key — you pay Anthropic directly, the studio
              never holds it. Get one at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-primary"
              >
                console.anthropic.com
              </a>
              .
            </p>
          </div>

          {error ? (
            <p className="text-xs text-danger leading-snug">{error}</p>
          ) : null}

          <button type="submit" className="btn-primary mt-2" disabled={loading}>
            {loading ? (
              <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
            ) : null}
            Continue
          </button>
        </form>

        <p className="text-[11px] text-muted mt-6 leading-relaxed">
          Keys are stored locally and never persisted server-side. Get them
          from your Hyperwisor manufacturer dashboard.
        </p>
      </div>

      <style>{`
        .input {
          width: 100%;
          height: 42px;
          border-radius: 8px;
          border: 1px solid #27272a;
          background: #131316;
          color: #fafafa;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.18); }
        .btn-primary {
          height: 44px;
          border-radius: 8px;
          background: #3B82F6;
          color: white;
          font-weight: 500;
          font-size: 14px;
          border: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-primary:hover { opacity: .92; }
        .btn-primary:disabled { opacity: .5; cursor: default; }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      {children}
    </label>
  );
}
