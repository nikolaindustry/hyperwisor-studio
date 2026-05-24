import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't verify those keys.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2 mb-7">
          <div className="w-9 h-9 rounded-md bg-primary/15 text-accent flex items-center justify-center">
            <Sparkles size={17} />
          </div>
          <div>
            <div className="text-[14px] font-semibold leading-tight">Hyperwisor Studio</div>
            <div className="text-[11.5px] text-muted">AI app designer for your IoT products</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel shadow-md p-6">
          <h1 className="text-[20px] font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted text-[13px] mt-1 mb-5">
            Paste your Hyperwisor manufacturer keys.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label>API key</Label>
              <Input
                type="text"
                placeholder="mk_…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Secret key</Label>
              <Input
                type="password"
                placeholder="msk_…"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="pt-4 mt-1 border-t border-border">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted mb-2">
                AI generation · optional now
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Anthropic API key</Label>
                <Input
                  type="password"
                  placeholder="sk-ant-…"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
                Bring your own key — you pay Anthropic directly. The studio
                never holds it. Get one at{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  console.anthropic.com
                </a>
                .
              </p>
            </div>

            {error ? (
              <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" loading={loading} className="mt-2">
              Continue
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-muted text-center mt-4">
          Keys are stored locally in your browser, never persisted on our server.
        </p>
      </div>
    </div>
  );
}
