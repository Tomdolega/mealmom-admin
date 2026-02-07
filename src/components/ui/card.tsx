import { cn } from "@/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</section>;
}
