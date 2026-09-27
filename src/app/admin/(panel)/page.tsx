import type { Metadata } from "next";
import { listForms } from "@/lib/forms";
import { setupStatus } from "@/lib/env";
import { FormsDashboard } from "@/components/admin/forms-dashboard";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import type { FormDoc } from "@/lib/types";

export const metadata: Metadata = { title: "Questionnaires" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const status = setupStatus();
  let forms: FormDoc[] = [];
  let dbError: string | null = null;
  try {
    forms = await listForms();
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Could not connect to MongoDB";
  }

  return (
    <div className="space-y-8">
      <SetupChecklist items={status} dbError={dbError} />
      <FormsDashboard initialForms={forms} importEnabled={status.find((s) => s.key === "GROQ_API_KEY")!.ok} />
    </div>
  );
}
