"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button, FormRow, Input } from "@/components/ui/primitives";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    if (res.ok) {
      router.replace(next && next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Sign in failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <FormRow label="Email">
        {(p) => <Input {...p} name="email" type="email" autoComplete="username" required autoFocus />}
      </FormRow>
      <FormRow label="Password">
        {(p) => (
          <div className="relative">
            <Input {...p} name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-11" />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-fg-subtle hover:text-fg"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        )}
      </FormRow>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Sign in
      </Button>
    </form>
  );
}
