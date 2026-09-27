import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { mailEnabled } from "@/lib/mail";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: PageProps<"/admin/forms/[id]/settings">) {
  const form = await getForm((await params).id);
  if (!form) notFound();
  return <SettingsForm key={form.updatedAt} form={form} mailEnabled={mailEnabled()} />;
}
