import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#1d2b4a] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <Logo inverted className="[--primary:#1d2b4a] [--primary-fg:#fff]" />
        </div>
        <div className="relative max-w-md">
          <p className="font-serif text-[44px] leading-[1.08] tracking-tight">
            Every great journey starts with <em className="text-[#e4c48d]">the right questions</em>.
          </p>
          <p className="mt-5 text-[15px] leading-relaxed opacity-75">
            Turn your Word questionnaires into elegant forms for travellers. Every response lands in your inbox and your database.
          </p>
        </div>
        <p className="relative text-xs opacity-50">Voyathra Travel &amp; Tourism · Secure admin area</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="animate-in w-full max-w-sm">
          <Logo className="mb-10 lg:hidden" />
          <h1 className="font-serif text-4xl tracking-tight text-fg">Welcome back</h1>
          <p className="mt-2 text-[15px] text-fg-muted">Sign in to manage your questionnaires.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
