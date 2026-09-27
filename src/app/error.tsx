"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="animate-in max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle className="size-6" aria-hidden />
        </div>
        <h1 className="mt-6 font-serif text-4xl tracking-tight text-fg">Something went wrong</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-fg-muted">
          {error.message?.includes("MONGODB_URI") ? error.message : "We couldn't load this page. Please try again in a moment."}
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
