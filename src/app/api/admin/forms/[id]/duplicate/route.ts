import { requireAdmin } from "@/lib/auth";
import { duplicateForm } from "@/lib/forms";

export async function POST(_req: Request, ctx: RouteContext<"/api/admin/forms/[id]/duplicate">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const form = await duplicateForm((await ctx.params).id);
  return form ? Response.json({ form }, { status: 201 }) : Response.json({ error: "Not found" }, { status: 404 });
}
