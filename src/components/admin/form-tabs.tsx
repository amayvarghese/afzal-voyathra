"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function FormTabs({ id, responseCount }: { id: string; responseCount: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/admin/forms/${id}`, label: "Questions" },
    { href: `/admin/forms/${id}/responses`, label: "Responses", count: responseCount },
    { href: `/admin/forms/${id}/settings`, label: "Settings" },
  ];
  return (
    <nav aria-label="Questionnaire sections" className="mt-6 border-b border-border">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 border-b-2 text-sm font-medium transition-colors duration-200",
                  active ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className="tabular rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">{t.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
