import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-white text-[#0B0B0B] shadow-[0_0_24px_rgba(255,255,255,0.08)] hover:bg-white/90",
        primary:
          "bg-[#0B0B0B] text-white shadow-[0_0_32px_rgba(124,58,237,0.15)] hover:bg-[#1A1A1A] border border-white/5",
        ghost: "hover:bg-white/5 text-foreground-muted",
        outline: "border border-border bg-transparent hover:bg-surface-elevated",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3 text-xs rounded-xl",
        lg: "h-12 px-6 text-base rounded-2xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";
