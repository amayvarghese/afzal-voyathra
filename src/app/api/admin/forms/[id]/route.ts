import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { deleteForm, getForm, updateFormContent, updateFormSettings } from "@/lib/forms";
import { formContentInput } from "@/lib/schema";
import { EMAIL_RE } from "@/lib/utils";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/forms/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const form = await getForm((await ctx.params).id);
  return form ? Response.json({ form }) : Response.json({ error: "Not found" }, { status: 404 });
}

/** Save the questionnaire's questions (creates a new version). */
export async function PUT(req: Request, ctx: RouteContext<"/api/admin/forms/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = formContentInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid form content", issues: parsed.error.issues }, { status: 400 });
  const form = await updateFormContent((await ctx.params).id, parsed.data);
  return form ? Response.json({ form }) : Response.json({ error: "Not found" }, { status: 404 });
}

const settingsInput = z
  .object({
    slug: z.string().trim().min(1).max(60),
    isOpen: z.boolean(),
    notifyEmails: z.array(z.string().trim().toLowerCase().regex(EMAIL_RE, "Invalid email")).max(20),
    confirmationEnabled: z.boolean(),
    confirmationFieldId: z.string().max(40).nullable(),
    successTitle: z.string().trim().max(200),
    successMessage: z.string().trim().max(2000),
    submitLabel: z.string().trim().min(1).max(40),
    paginate: z.boolean(),
  })
  .partial();

/** Update settings (link, notifications, open/closed…). */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/forms/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = settingsInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
  const result = await updateFormSettings((await ctx.params).id, parsed.data);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json({ form: result });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/forms/[id]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const ok = await deleteForm((await ctx.params).id);
  return ok ? Response.json({ ok }) : Response.json({ error: "Not found" }, { status: 404 });
}
