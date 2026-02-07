import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-sky-500/20 bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 text-white shadow-sm hover:brightness-105 focus-visible:ring-sky-300",
  secondary:
    "border border-slate-300/80 bg-white/85 text-slate-700 backdrop-blur hover:bg-white focus-visible:ring-slate-300",
  danger:
    "border border-red-500/20 bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm hover:brightness-105 focus-visible:ring-red-300",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100/80 focus-visible:ring-slate-300",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg font-medium transition-[background-color,filter,color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
