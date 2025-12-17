import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "success";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-zinc-900 text-zinc-50",
  secondary: "bg-zinc-100 text-zinc-800",
  outline: "border border-zinc-200 text-zinc-800",
  success: "bg-emerald-100 text-emerald-800",
};

const Badge = ({ className, variant = "default", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
      variantClasses[variant],
      className
    )}
    {...props}
  />
);

export { Badge };
