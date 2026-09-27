import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getForm } from "@/lib/forms";
import { FormTabs } from "@/components/admin/form-tabs";
import { ShareButton } from "@/components/admin/share-button";
import { DeleteFormButton } from "@/components/admin/delete-form-button";
import { Badge } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function FormLayout({ children, params }: LayoutProps<"/admin/forms/[id]">) {
  const { id } = await params;
  const form = await getForm(id);
  if (!form) notFound();

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1 rounded-md text-sm text-fg-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden /> All questionnaires
      </Link>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-fg sm:text-[44px]">{form.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <Badge tone={form.settings.isOpen ? "success" : "neutral"}>{form.settings.isOpen ? "Open" : "Closed"}</Badge>
            <span className="tabular">{form.responseCount} responses</span>
            <span aria-hidden>·</span>
            <span className="tabular">v{form.version}</span>
            {form.source?.fileName && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">Imported from {form.source.fileName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <DeleteFormButton id={form._id} title={form.title} responseCount={form.responseCount} />
          <ShareButton slug={form.slug} isOpen={form.settings.isOpen} />
        </div>
      </div>
      <FormTabs id={form._id} responseCount={form.responseCount} />
      <div className="pt-8">{children}</div>
    </div>
  );
}
