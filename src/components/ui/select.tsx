import { cn } from "@/lib/cn";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300/80 bg-white/90 px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
        className,
      )}
      {...props}
    />
  );
}
