import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        variant === "default" &&
          "bg-accent/10 text-accent border border-accent/20",
        variant === "secondary" &&
          "bg-[var(--color-ink-800)] text-[var(--color-ice-200)] border border-[var(--color-ink-700)]",
        variant === "outline" &&
          "border border-border text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
