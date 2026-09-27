import { requireAdmin } from "@/lib/auth";
import { getForm, listResponses } from "@/lib/forms";

export async function GET(req: Request, ctx: RouteContext<"/api/admin/forms/[id]/responses">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const form = await getForm((await ctx.params).id);
  if (!form) return Response.json({ error: "Not found" }, { status: 404 });
  const sp = new URL(req.url).searchParams;
  const result = await listResponses(form, {
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 25,
    q: sp.get("q") ?? undefined,
  });
  return Response.json(result);
}
