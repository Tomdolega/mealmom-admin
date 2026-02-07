import Image from "next/image";
import { cn } from "@/lib/cn";

type RecipeThumbnailProps = {
  imageUrl?: string | null;
  title: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses: Record<NonNullable<RecipeThumbnailProps["size"]>, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

export function RecipeThumbnail({ imageUrl, title, size = "md", className }: RecipeThumbnailProps) {
  if (!imageUrl) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-slate-500",
          sizeClasses[size],
          className,
        )}
        aria-hidden="true"
      >
        IMG
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex overflow-hidden rounded-md border border-slate-200 bg-slate-100", sizeClasses[size], className)}
      aria-hidden="true"
    >
      <Image
        src={imageUrl}
        alt={title}
        width={size === "md" ? 40 : 32}
        height={size === "md" ? 40 : 32}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  );
}
