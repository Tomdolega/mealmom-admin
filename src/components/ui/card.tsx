import { cn } from "@/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <section className={cn("rounded-xl border border-slate-200/80 bg-white/95 p-5", className)}>
      {children}
    </section>
  );
}
