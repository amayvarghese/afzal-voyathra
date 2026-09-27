"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function SetupChecklist({
  items,
  dbError,
}: {
  items: { key: string; label: string; ok: boolean }[];
  dbError: string | null;
}) {
  const toast = useToast();
  const missing = items.filter((i) => !i.ok).length;
  const [open, setOpen] = useState(missing > 0 || !!dbError);
  const [sending, setSending] = useState(false);
  const mailOk = items.find((i) => i.key.startsWith("GMAIL"))?.ok;

  if (missing === 0 && !dbError && !open) {
    return (
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="text-xs text-fg-subtle hover:text-fg-muted">
          All services connected
        </button>
      </div>
    );
  }

  async function testEmail() {
    setSending(true);
    const res = await fetch("/api/admin/test-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    toast(res.ok ? `Test email sent to ${j.to}` : j.error ?? "Send failed", res.ok ? "success" : "error");
  }

  return (
    <section className="animate-in rounded-2xl border border-border bg-surface shadow-sm" aria-labelledby="setup-title">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <h2 id="setup-title" className="text-sm font-semibold text-fg">
            {missing ? `Setup · ${items.length - missing} of ${items.length} connected` : "Setup · all connected"}
          </h2>
          <p className="text-[13px] text-fg-muted">
            {missing ? "Add the missing environment variables to .env.local (locally) or Vercel → Settings → Environment Variables." : "Everything is ready."}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform duration-200", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4">
          {dbError && (
            <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
              Database: {dbError}
            </p>
          )}
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {items.map((i) => (
              <li key={i.key} className="flex items-start gap-2.5 text-sm">
                {i.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Connected" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-label="Missing" />
                )}
                <span>
                  <span className="text-fg">{i.label}</span>
                  <code className="ml-2 text-xs text-fg-subtle">{i.key}</code>
                </span>
              </li>
            ))}
          </ul>
          {mailOk && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={testEmail} loading={sending}>
              <Mail className="size-4" aria-hidden /> Send test email
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
