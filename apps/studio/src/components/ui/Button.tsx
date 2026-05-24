import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary-hover shadow-xs",
  secondary:
    "bg-panel text-text border border-border hover:bg-surface shadow-xs",
  ghost: "bg-transparent text-text hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90 shadow-xs",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-md gap-1.5",
  md: "h-9 px-3.5 text-[13px] rounded-md gap-1.5",
  lg: "h-10 px-4 text-sm rounded-md gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium select-none",
        "transition-all duration-150 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:shadow-focus",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
      ) : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
