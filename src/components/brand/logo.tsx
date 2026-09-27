import { cn } from "@/lib/utils";

export const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Voyathra Travel & Tourism";

/** "Voyathra Travel & Tourism" → ["Voyathra", "Travel & Tourism"] */
export function splitBrand(name = BRAND): [string, string] {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first, rest.join(" ")];
}

export function Logo({
  className,
  withName = true,
  inverted = false,
  size = "md",
}: {
  className?: string;
  withName?: boolean;
  inverted?: boolean;
  size?: "sm" | "md";
}) {
  const [name, tagline] = splitBrand();
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[9px] shadow-sm",
          size === "sm" ? "size-7" : "size-8",
          inverted ? "bg-primary-fg text-primary" : "bg-primary text-primary-fg",
        )}
        aria-hidden
      >
        {/* Compass mark */}
        <svg viewBox="0 0 24 24" className={size === "sm" ? "size-4" : "size-[18px]"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="m14.8 9.2-1.6 4-4 1.6 1.6-4 4-1.6Z" fill="currentColor" stroke="none" />
          <path d="M12 3.5v1.6M12 18.9v1.6M3.5 12h1.6M18.9 12h1.6" strokeLinecap="round" />
        </svg>
      </span>
      {withName && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className={cn("font-serif tracking-tight", size === "sm" ? "text-lg" : "text-[22px]", inverted ? "text-primary-fg" : "text-fg")}>
            {name}
          </span>
          {tagline && (
            <span
              className={cn(
                "mt-1 truncate text-[9.5px] font-medium uppercase tracking-[0.2em]",
                inverted ? "text-primary-fg/70" : "text-fg-muted",
              )}
            >
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
