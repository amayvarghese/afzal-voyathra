import { requireAdmin } from "@/lib/auth";
import { allResponses, getForm } from "@/lib/forms";
import { formatAnswer } from "@/lib/format";
import { answerableFields } from "@/lib/schema";
import { slugify } from "@/lib/utils";

function csvCell(v: string) {
  // Neutralise spreadsheet formula injection and quote everything.
  // (plain numbers / phone numbers like "+1 415 555" are left alone).
  const risky = /^[=@\t\r]/.test(v) || (/^[+-]/.test(v) && !/^[+-][\d\s().-]+$/.test(v));
  const safe = risky ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/forms/[id]/export">) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const form = await getForm((await ctx.params).id);
  if (!form) return Response.json({ error: "Not found" }, { status: 404 });

  const rows = await allResponses(form);
  const fields = answerableFields(form.sections);
  const known = new Set(fields.map((f) => f.key));
  // Answers to questions that were later removed are still exported.
  const legacyKeys = [...new Set(rows.flatMap((r) => Object.keys(r.answers)))].filter((k) => !known.has(k));

  const header = ["Submitted at", "Response ID", ...fields.map((f) => f.label), ...legacyKeys.map((k) => `${k} (removed)`)];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.submittedAt).toISOString(),
        r._id,
        ...fields.map((f) => formatAnswer(f, r.answers[f.key])),
        ...legacyKeys.map((k) => formatAnswer(undefined, r.answers[k])),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const filename = `${slugify(form.title)}-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
