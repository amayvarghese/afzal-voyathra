import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/admin/sign-out-button";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/admin" aria-label="All questionnaires" className="rounded-lg">
            <Logo />
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        {children}
      </main>
    </div>
  );
}
