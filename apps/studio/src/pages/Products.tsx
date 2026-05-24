import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Cpu, LogOut, RefreshCw, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/auth";
import { api, type Product } from "@/api";

export function Products() {
  const { creds, manufacturerId, signOut } = useAuth();
  const [products, setProducts] = React.useState<Product[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");

  const load = React.useCallback(async () => {
    if (!creds) return;
    setError(null);
    setProducts(null);
    try {
      const r = await api.products(creds);
      setProducts(r.products);
    } catch (e: any) {
      setError(e?.message || "Couldn't load products");
    }
  }, [creds]);

  React.useEffect(() => { void load(); }, [load]);

  const filtered = (products || []).filter((p) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      p.product_name?.toLowerCase().includes(q) ||
      p.product_category?.toLowerCase().includes(q) ||
      p.model_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-bg/85 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto h-14 px-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Sparkles size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">Hyperwisor Studio</div>
            <div className="text-[11px] text-muted truncate">
              {manufacturerId ? `Manufacturer ${manufacturerId.slice(0, 8)}…` : ""}
            </div>
          </div>
          <button onClick={load} className="icon-btn" title="Reload"><RefreshCw size={16} /></button>
          <button onClick={signOut} className="icon-btn" title="Sign out"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Your products</h1>
        <p className="text-muted text-sm mt-1">
          Pick a product to have the AI agent build its app screen.
        </p>

        <div className="mt-5 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, category, or model"
            className="w-full h-11 rounded-lg border border-border bg-panel pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {products === null && !error
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[72px] rounded-lg bg-surface animate-pulse" />
              ))
            : null}

          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/generate/${p.id}`}
              state={{ product: p }}
              className="rounded-lg border border-border bg-panel hover:bg-surface transition-colors p-4 flex items-center gap-3.5 group"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Cpu size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[15px] truncate">{p.product_name}</div>
                <div className="text-xs text-muted truncate">
                  {p.product_category ?? "—"}
                  {p.model_number ? ` · ${p.model_number}` : ""}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted/60 group-hover:text-muted shrink-0" />
            </Link>
          ))}

          {products && filtered.length === 0 && !error ? (
            <div className="text-center text-sm text-muted py-12">No matching products.</div>
          ) : null}
        </div>
      </main>

      <style>{`
        .icon-btn { width: 36px; height: 36px; border-radius: 8px; display:inline-flex; align-items:center; justify-content:center; color:#A1A1AA; background: transparent; border:0; cursor:pointer; }
        .icon-btn:hover { background:#1F1F23; color:#FAFAFA; }
      `}</style>
    </div>
  );
}
