import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet/50 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-white text-[#0B0B0B] shadow-[0_0_24px_rgba(255,255,255,0.08)] hover:bg-white/90",
        primary:
          "bg-[#0B0B0B] text-white shadow-[0_0_32px_rgba(124,58,237,0.15)] hover:bg-[#1A1A1A] border border-white/5",
        ghost: "hover:bg-white/5 text-foreground-muted",
        outline: "border border-border bg-transparent hover:bg-surface-elevated",
        accent:
          "bg-accent-orange text-white hover:bg-accent-orange/90 border border-accent-orange/50",
        tintViolet:
          "border border-accent-violet/20 bg-accent-violet/[0.06] text-foreground hover:bg-accent-violet/[0.1] hover:border-accent-violet/30 [&_svg]:text-accent-violet",
        tintCyan:
          "border border-accent-cyan/20 bg-accent-cyan/[0.06] text-foreground hover:bg-accent-cyan/[0.1] hover:border-accent-cyan/30 [&_svg]:text-accent-cyan",
        tintOrange:
          "border border-accent-orange/25 bg-accent-orange/[0.07] text-foreground hover:bg-accent-orange/[0.12] hover:border-accent-orange/35 [&_svg]:text-accent-orange",
        cancel:
          "border border-red-500/30 bg-red-500/[0.06] text-red-600 hover:bg-red-500/10 hover:border-red-500/45 dark:text-red-400 dark:hover:bg-red-500/15",
        destructive:
          "bg-red-600/90 text-white hover:bg-red-600 border border-red-500/30",
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

export { buttonVariants };
