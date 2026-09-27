import { checkCredentials, createSession } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!env.adminEmail() || !env.adminPassword() || env.authSecret().length < 32) {
    return Response.json(
      { error: "Admin login isn't configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET (32+ chars)." },
      { status: 500 },
    );
  }
  if (!email || !password || !checkCredentials(email, password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return Response.json({ error: "That email and password combination isn't right." }, { status: 401 });
  }
  await createSession(env.adminEmail());
  return Response.json({ ok: true });
}
