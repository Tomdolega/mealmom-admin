"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
};

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      className={cn(
        "relative rounded-md px-2.5 py-2 text-sm font-medium transition",
        isActive ? "bg-white/70 text-slate-900 shadow-sm" : "text-slate-500 hover:bg-white/50 hover:text-slate-800",
      )}
      href={href}
    >
      {children}
      <span
        className={cn(
          "absolute inset-x-2 -bottom-[1px] h-[2px] rounded-full transition-opacity",
          isActive ? "bg-sky-500/80 opacity-100" : "bg-transparent opacity-0",
        )}
      />
    </Link>
  );
}
