import { cn } from "@/lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/60 bg-white/65 p-5 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.28)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}
