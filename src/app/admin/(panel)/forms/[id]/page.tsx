import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { FormBuilder } from "@/components/admin/form-builder";

export const dynamic = "force-dynamic";

export default async function BuildPage({ params }: PageProps<"/admin/forms/[id]">) {
  const form = await getForm((await params).id);
  if (!form) notFound();
  return <FormBuilder key={form._id} form={form} />;
}
