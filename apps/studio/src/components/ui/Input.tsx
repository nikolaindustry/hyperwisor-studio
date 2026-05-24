import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-9 rounded-md border border-border bg-panel px-3 text-[13px] text-text",
        "placeholder:text-muted/80 transition-shadow",
        "focus:outline-none focus:border-primary focus:shadow-focus",
        "disabled:opacity-50 disabled:bg-surface",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Label = ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label {...props} className={cn("text-[12.5px] font-medium text-text", props.className)}>
    {children}
  </label>
);
