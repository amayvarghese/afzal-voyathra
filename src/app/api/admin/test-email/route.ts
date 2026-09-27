import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { mailEnabled, sendTestEmail } from "@/lib/mail";
import { EMAIL_RE } from "@/lib/utils";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!mailEnabled()) return Response.json({ error: "Gmail isn't configured yet (GMAIL_USER / GMAIL_APP_PASSWORD)." }, { status: 400 });
  const { to } = (await req.json().catch(() => ({}))) as { to?: string };
  const target = to && EMAIL_RE.test(to) ? to : env.notifyEmails()[0];
  if (!target) return Response.json({ error: "No recipient." }, { status: 400 });
  try {
    await sendTestEmail(target);
    return Response.json({ ok: true, to: target });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Send failed" }, { status: 500 });
  }
}
