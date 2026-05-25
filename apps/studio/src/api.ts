/** Client for the Studio API + Hyperwisor edge functions. */

// Hyperwisor edge functions live on their Supabase project — we call them
// directly from the browser (not via the studio API proxy) since they're
// stateless single round-trips.
const HW_SUPABASE_URL =
  (import.meta.env.VITE_HW_SUPABASE_URL as string | undefined) ||
  "https://cgsuxlbravclbbpnvfky.supabase.co";
const HW_ANON_KEY =
  (import.meta.env.VITE_HW_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnc3V4bGJyYXZjbGJicG52Zmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzA0NDcsImV4cCI6MjA2MjgwNjQ0N30.6jieDtUB7JGXDI7viYwj3IxL7wUkaboburMyyO_M6pk";

export type Creds = {
  apiKey: string;
  secretKey: string;
  /** BYOK — only required when calling /generate. */
  anthropicKey?: string;
};

export type QuickGenerateResult = {
  ok: boolean;
  productId: string;
  productName: string;
  capabilities: unknown;
  screen: {
    suggestedPath: string;
    componentName: string;
    content: string;
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  error?: string;
};

export type Product = {
  id: string;
  product_name: string;
  product_category?: string;
  product_description?: string;
  model_number?: string;
  firmware_version?: string;
};

const API = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export const api = {
  async verify(creds: Creds): Promise<{ manufacturer_id: string }> {
    return post("/auth/verify", {
      apiKey: creds.apiKey,
      secretKey: creds.secretKey,
    });
  },
  async products(creds: Creds): Promise<{ products: Product[] }> {
    return post("/products", {
      apiKey: creds.apiKey,
      secretKey: creds.secretKey,
    });
  },
  /**
   * Streams generation events from the agent. Returns an unsubscribe.
   * The server keeps the HTTP connection open as Server-Sent Events.
   */
  generate(
    body: {
      apiKey: string;
      secretKey: string;
      anthropicKey: string;
      productId: string;
      productName?: string;
    },
    onEvent: (ev: any) => void,
  ): () => void {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(API + "/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          onEvent({
            type: "studio.error",
            message: text || `HTTP ${res.status}`,
          });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          // SSE frames are separated by blank lines
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              onEvent(JSON.parse(line.slice(5).trim()));
            } catch { /* ignore */ }
          }
        }
      } catch (e: any) {
        if (controller.signal.aborted) return;
        onEvent({ type: "studio.error", message: e?.message || "stream failed" });
      }
    })();
    return () => controller.abort();
  },
  zipUrl(projectId: string) {
    return `${API}/projects/${projectId}/zip`;
  },

  /**
   * Quick generation via Hyperwisor's studio-generate-screen edge function.
   * Single round-trip, Lovable AI gateway, no Anthropic key required.
   */
  async quickGenerate(args: {
    apiKey: string;
    secretKey: string;
    productId: string;
    prompt?: string;
    model?: string;
  }): Promise<QuickGenerateResult> {
    const url = `${HW_SUPABASE_URL}/functions/v1/studio-generate-screen`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HW_ANON_KEY}`,
        "x-api-key": args.apiKey,
        "x-secret-key": args.secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: args.productId,
        prompt: args.prompt,
        model: args.model,
      }),
    });
    const text = await res.text();
    let json: QuickGenerateResult;
    try { json = text ? JSON.parse(text) : ({ ok: false, error: "empty response" } as QuickGenerateResult); }
    catch { json = { ok: false, error: text.slice(0, 300) } as QuickGenerateResult; }
    if (!res.ok || !json.ok) {
      throw new Error(json.error || `Quick generate HTTP ${res.status}`);
    }
    return json;
  },
};
