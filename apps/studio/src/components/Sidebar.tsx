import { NavLink } from "react-router-dom";
import { LayoutGrid, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/auth";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/products", label: "Products", icon: LayoutGrid },
];

export function Sidebar() {
  const { manufacturerId, signOut } = useAuth();
  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 border-r border-border bg-surface flex flex-col">
      {/* Brand */}
      <div className="h-14 border-b border-border px-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-primary/15 text-accent flex items-center justify-center">
          <Sparkles size={15} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-none">Hyperwisor</div>
          <div className="text-[10.5px] text-muted mt-0.5">Studio</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] transition-colors",
                isActive
                  ? "bg-panel text-text shadow-xs border border-border"
                  : "text-muted hover:bg-surface-2 hover:text-text",
              )
            }
          >
            <Icon size={15} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Account footer */}
      <div className="border-t border-border p-2">
        <div className="px-2 py-2 rounded-md">
          <div className="text-[10.5px] uppercase tracking-wide text-muted">Manufacturer</div>
          <div className="text-[12px] font-mono text-text mt-0.5 truncate">
            {manufacturerId ? manufacturerId.slice(0, 8) + "…" : "—"}
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-1 w-full flex items-center gap-2 px-2.5 h-8 rounded-md text-[13px] text-muted hover:text-danger hover:bg-surface-2"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
