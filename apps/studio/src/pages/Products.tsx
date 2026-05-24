import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Cpu, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/auth";
import { api, type Product } from "@/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function Products() {
  const { creds } = useAuth();
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't load products");
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
    <>
      <PageHeader
        title="Products"
        subtitle={
          products
            ? `${products.length} product${products.length === 1 ? "" : "s"}`
            : "Loading…"
        }
        actions={
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={14} /> Reload
          </Button>
        }
      />

      <div className="flex-1 px-5 py-6 max-w-5xl">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, category, or model"
            className="pl-9"
          />
        </div>

        <div className="mt-5">
          {products === null && !error ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[64px] rounded-lg bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {products && filtered.length === 0 && !error ? (
            <div className="text-center text-sm text-muted py-16 border border-dashed border-border rounded-lg">
              No matching products.
            </div>
          ) : null}

          <ul className="rounded-lg border border-border bg-panel shadow-xs divide-y divide-border overflow-hidden">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/generate/${p.id}`}
                  state={{ product: p }}
                  className={cn(
                    "group block px-4 py-3 flex items-center gap-3.5",
                    "hover:bg-surface transition-colors",
                  )}
                >
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-accent flex items-center justify-center shrink-0">
                    <Cpu size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[13.5px] text-text truncate">
                      {p.product_name}
                    </div>
                    <div className="text-[11.5px] text-muted truncate mt-0.5">
                      {p.product_category ?? "—"}
                      {p.model_number ? ` · ${p.model_number}` : ""}
                      <span className="text-muted/60"> · {p.id}</span>
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-muted/60 shrink-0 group-hover:text-text transition-colors"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
