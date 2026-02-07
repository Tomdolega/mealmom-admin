import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[88px] w-full rounded-lg border border-slate-300/80 bg-white/90 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
        className,
      )}
      {...props}
    />
  );
}
