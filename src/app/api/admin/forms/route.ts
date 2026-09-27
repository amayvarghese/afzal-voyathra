import { requireAdmin } from "@/lib/auth";
import { createForm, listForms } from "@/lib/forms";
import { formContentInput } from "@/lib/schema";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return Response.json({ forms: await listForms() });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = formContentInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid form content" }, { status: 400 });
  const content = parsed.data.sections.length
    ? parsed.data
    : {
        ...parsed.data,
        sections: [
          {
            title: "",
            fields: [
              { type: "short_text", label: "Full name", required: true },
              { type: "email", label: "Email address", required: true },
            ],
          },
        ],
      };
  const form = await createForm(content);
  return Response.json({ form }, { status: 201 });
}
