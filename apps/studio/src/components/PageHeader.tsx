import * as React from "react";

/** Page-level header bar with title + optional subtitle + right-side actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-panel sticky top-0 z-10">
      <div className="h-full px-5 flex items-center gap-3">
        {back ? <div className="-ml-1">{back}</div> : null}
        <div className="flex-1 min-w-0">
          <h1 className="text-[14px] font-semibold leading-tight truncate text-text">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-[11.5px] text-muted truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}
