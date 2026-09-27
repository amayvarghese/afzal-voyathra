import { after } from "next/server";
import { getFormBySlug, insertResponse, setResponseEmailStatus } from "@/lib/forms";
import { mailEnabled, sendConfirmation, sendNotification } from "@/lib/mail";
import { validateSubmission } from "@/lib/validate";

export const maxDuration = 30;

export async function POST(req: Request, ctx: RouteContext<"/api/public/[slug]/submit">) {
  const form = await getFormBySlug((await ctx.params).slug);
  if (!form) return Response.json({ error: "This questionnaire no longer exists." }, { status: 404 });
  if (!form.settings.isOpen) return Response.json({ error: "This questionnaire is no longer accepting responses." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { answers?: Record<string, unknown>; website?: string } | null;
  if (!body?.answers || typeof body.answers !== "object") return Response.json({ error: "Invalid submission." }, { status: 400 });
  // Honeypot: real people never fill the hidden "website" field.
  if (body.website) return Response.json({ ok: true });

  const { answers, errors, ok } = validateSubmission(form, body.answers);
  if (!ok) return Response.json({ error: "Some answers need attention.", errors }, { status: 422 });

  const responseId = await insertResponse(form, answers);

  if (mailEnabled()) {
    const origin = process.env.APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const confirmField = form.settings.confirmationEnabled
      ? form.sections.flatMap((s) => s.fields).find((f) => f.id === form.settings.confirmationFieldId)
      : undefined;
    const respondentEmail = confirmField ? (answers[confirmField.key] as string | undefined) : undefined;
    const anyEmail = form.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.type === "email")
      .map((f) => answers[f.key] as string | undefined)
      .find(Boolean);

    // Send emails after responding so the customer isn't kept waiting.
    after(async () => {
      const [notified, confirmed] = await Promise.allSettled([
        sendNotification({ form, answers, responseId, origin, replyTo: respondentEmail ?? anyEmail }),
        respondentEmail ? sendConfirmation({ form, answers, to: respondentEmail }) : Promise.resolve(false),
      ]);
      const error = [notified, confirmed]
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => String(r.reason?.message ?? r.reason))
        .join("; ");
      if (error) console.error("[mail]", error);
      await setResponseEmailStatus(form, responseId, {
        notified: notified.status === "fulfilled" && notified.value === true,
        confirmed: !!respondentEmail && confirmed.status === "fulfilled",
        ...(error ? { error } : {}),
      }).catch(() => undefined);
    });
  }

  return Response.json({ ok: true, id: responseId }, { status: 201 });
}
