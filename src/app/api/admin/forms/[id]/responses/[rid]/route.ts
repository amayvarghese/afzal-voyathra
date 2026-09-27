import { requireAdmin } from "@/lib/auth";
import { deleteResponse, getForm } from "@/lib/forms";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/forms/[id]/responses/[rid]">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id, rid } = await ctx.params;
  const form = await getForm(id);
  if (!form) return Response.json({ error: "Not found" }, { status: 404 });
  const ok = await deleteResponse(form, rid);
  return ok ? Response.json({ ok }) : Response.json({ error: "Not found" }, { status: 404 });
}
