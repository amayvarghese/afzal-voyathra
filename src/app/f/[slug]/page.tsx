import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { getFormBySlug, toPublicForm } from "@/lib/forms";
import { PublicFormView } from "@/components/public/public-form";
import { BRAND } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/f/[slug]">): Promise<Metadata> {
  const form = await getFormBySlug((await params).slug).catch(() => null);
  if (!form) return { title: "Questionnaire" };
  return {
    title: form.title,
    description: form.description.slice(0, 160) || `Please complete ${form.title}.`,
    robots: { index: false, follow: false },
    openGraph: { title: form.title, description: form.description.slice(0, 160) },
  };
}

export default async function PublicFormPage({ params }: PageProps<"/f/[slug]">) {
  const form = await getFormBySlug((await params).slug);
  if (!form) notFound();

  if (!form.settings.isOpen) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="animate-in max-w-md text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-fg-muted">
            <Lock className="size-6" aria-hidden />
          </div>
          <h1 className="mt-6 font-serif text-4xl tracking-tight text-fg">{form.title}</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-fg-muted">
            This questionnaire is no longer accepting responses. If you think this is a mistake, please contact whoever sent you the link.
          </p>
        </div>
      </main>
    );
  }

  return <PublicFormView form={toPublicForm(form)} brand={BRAND} />;
}
