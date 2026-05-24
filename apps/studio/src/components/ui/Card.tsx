import * as React from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  flush?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, flush, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-panel shadow-xs",
        flush ? "" : "p-4",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
