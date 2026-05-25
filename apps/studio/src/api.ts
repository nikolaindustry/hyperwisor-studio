/** Client for the Studio API. */

export type Creds = {
  apiKey: string;
  secretKey: string;
  /** BYOK — required to call /generate. */
  anthropicKey?: string;
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
};
