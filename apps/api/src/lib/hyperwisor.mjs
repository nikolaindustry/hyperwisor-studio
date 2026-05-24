/**
 * Thin wrapper around the Hyperwisor manufacturer API.
 * Same shape and base URL the starter uses — see src/lib/sdk.ts there.
 */
const DEFAULT_BASE =
  "https://cgsuxlbravclbbpnvfky.supabase.co/functions/v1";

function buildHeaders({ apiKey, secretKey }) {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "x-secret-key": secretKey,
  };
}

async function call(path, { apiKey, secretKey, baseUrl }) {
  const url = `${baseUrl || DEFAULT_BASE}/manufacturer-api${path}`;
  const res = await fetch(url, { headers: buildHeaders({ apiKey, secretKey }) });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const e = new Error(json?.error || json?.message || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return json;
}

/** Verify credentials by hitting /health. Returns { manufacturer_id }. */
export async function verifyKeys(creds) {
  const r = await call("/health", creds);
  if (!r?.manufacturer_id) throw new Error("Invalid credentials");
  return { manufacturer_id: r.manufacturer_id };
}

/** List manufacturer products, stripping the bulky product_image blob. */
export async function listProducts(creds) {
  const r = await call("/products", creds);
  const products = (r?.products || []).map(({ product_image, ...rest }) => rest);
  return products;
}
