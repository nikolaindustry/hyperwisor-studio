import * as React from "react";
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet, Maximize2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ViewportId = "mobile" | "tablet" | "desktop" | "fit";

export const VIEWPORTS: Record<ViewportId, { label: string; width: number | null; height: number | null; icon: typeof Monitor }> = {
  mobile:  { label: "Mobile",  width: 390,  height: 844, icon: Smartphone },
  tablet:  { label: "Tablet",  width: 820,  height: 1180, icon: Tablet },
  desktop: { label: "Desktop", width: 1280, height: 800, icon: Monitor },
  fit:     { label: "Fit",     width: null, height: null, icon: Maximize2 },
};

export function ViewportToolbar({
  viewport,
  onViewport,
  width,
  onWidth,
  status,
  url,
  onRefresh,
}: {
  viewport: ViewportId;
  onViewport: (id: ViewportId) => void;
  width: number;
  onWidth: (n: number) => void;
  status: "live" | "updating" | "loading";
  url: string | null;
  onRefresh: () => void;
}) {
  const showCustom = viewport !== "fit";
  return (
    <div className="h-10 border-b border-border bg-panel flex items-center px-2 gap-1.5">
      {/* Status */}
      <div className="flex items-center gap-1.5 px-2 text-[11px] text-muted">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            status === "live" && "bg-success",
            status === "updating" && "bg-info animate-pulse",
            status === "loading" && "bg-muted/60",
          )}
        />
        <span className="capitalize">{status}</span>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Viewport presets */}
      <div className="flex items-center bg-surface rounded-md p-0.5">
        {(Object.keys(VIEWPORTS) as ViewportId[]).map((id) => {
          const v = VIEWPORTS[id];
          const Icon = v.icon;
          const active = viewport === id;
          return (
            <button
              key={id}
              onClick={() => onViewport(id)}
              title={v.label + (v.width ? ` · ${v.width}px` : "")}
              className={cn(
                "h-7 w-7 rounded-[5px] flex items-center justify-center transition-colors",
                active ? "bg-panel text-text shadow-xs" : "text-muted hover:text-text",
              )}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>

      {/* Custom width input — hidden in Fit mode */}
      {showCustom ? (
        <div className="flex items-center gap-1 text-[11.5px] text-muted ml-1">
          <input
            type="number"
            min={280}
            max={1920}
            step={10}
            value={width}
            onChange={(e) => onWidth(Number(e.target.value) || width)}
            className="w-16 h-7 rounded-md border border-border bg-panel px-2 text-[12px] text-text tabular-nums text-right focus:outline-none focus:border-primary focus:shadow-focus"
          />
          <span>px</span>
        </div>
      ) : (
        <span className="text-[11.5px] text-muted ml-1 tabular-nums">full width</span>
      )}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-1">
        {url ? (
          <span className="text-[11px] text-muted truncate max-w-[200px] mr-1 font-mono">
            {url.replace(/^https?:\/\//, "")}
          </span>
        ) : null}
        <button
          onClick={onRefresh}
          title="Refresh"
          className="h-7 w-7 rounded-md text-muted hover:bg-surface hover:text-text flex items-center justify-center"
        >
          <RefreshCw size={13} />
        </button>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
            className="h-7 w-7 rounded-md text-muted hover:bg-surface hover:text-text flex items-center justify-center"
          >
            <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
