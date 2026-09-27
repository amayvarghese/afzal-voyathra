import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="animate-in max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-fg-muted">
          <SearchX className="size-6" aria-hidden />
        </div>
        <h1 className="mt-6 font-serif text-4xl tracking-tight text-fg">Page not found</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-fg-muted">
          The link may be incorrect, or the questionnaire may have been removed.
        </p>
      </div>
    </main>
  );
}
