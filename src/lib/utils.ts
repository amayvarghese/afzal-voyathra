import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { customAlphabet } from "nanoid";

// Teach tailwind-merge about our custom design tokens so e.g. `text-fg` and `text-sm` don't collide.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["bg", "surface", "surface-2", "surface-3", "fg", "fg-muted", "fg-subtle", "border", "border-strong", "primary", "primary-hover", "primary-fg", "primary-soft", "accent", "accent-soft", "danger", "danger-soft", "success", "success-soft", "ring"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const shortId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 8);

export function slugify(input: string, max = 60): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "form"
  );
}

/** snake_case identifier safe to use as a MongoDB field name. */
export function keyify(input: string, max = 48): string {
  const k = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max)
    .replace(/_+$/g, "");
  if (!k) return "field";
  return /^[0-9]/.test(k) ? `q_${k}` : k;
}

export function formatDate(iso: string | Date, withTime = true): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "No responses yet";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso, false);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
