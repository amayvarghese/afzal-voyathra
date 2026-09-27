import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { ResponsesView } from "@/components/admin/responses-view";

export const dynamic = "force-dynamic";

export default async function ResponsesPage({ params }: PageProps<"/admin/forms/[id]/responses">) {
  const form = await getForm((await params).id);
  if (!form) notFound();
  return (
    <Suspense>
      <ResponsesView form={form} />
    </Suspense>
  );
}
