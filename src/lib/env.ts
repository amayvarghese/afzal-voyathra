import "server-only";

export const env = {
  mongoUri: () => process.env.MONGODB_URI ?? "",
  mongoDb: () => process.env.MONGODB_DB || "voyathra",
  adminEmail: () => (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  adminPassword: () => process.env.ADMIN_PASSWORD ?? "",
  authSecret: () => process.env.AUTH_SECRET ?? "",
  groqKey: () => process.env.GROQ_API_KEY ?? "",
  groqModel: () => process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  groqFallbackModel: () => process.env.GROQ_FALLBACK_MODEL || "llama-3.3-70b-versatile",
  gmailUser: () => process.env.GMAIL_USER ?? "",
  gmailAppPassword: () => (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, ""),
  mailFromName: () => process.env.MAIL_FROM_NAME || process.env.NEXT_PUBLIC_BRAND_NAME || "Voyathra Travel & Tourism",
  /** Default recipients for new-response notifications (comma separated). */
  notifyEmails: () =>
    (process.env.NOTIFY_EMAILS || process.env.GMAIL_USER || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  blobToken: () => process.env.BLOB_READ_WRITE_TOKEN ?? "",
};

export function setupStatus() {
  return [
    { key: "MONGODB_URI", label: "MongoDB database", ok: !!env.mongoUri() },
    {
      key: "ADMIN_EMAIL / ADMIN_PASSWORD / AUTH_SECRET",
      label: "Admin login",
      ok: !!env.adminEmail() && !!env.adminPassword() && env.authSecret().length >= 32,
    },
    { key: "GROQ_API_KEY", label: "AI document import (Groq)", ok: !!env.groqKey() },
    {
      key: "GMAIL_USER / GMAIL_APP_PASSWORD",
      label: "Email notifications (Gmail)",
      ok: !!env.gmailUser() && !!env.gmailAppPassword(),
    },
    { key: "BLOB_READ_WRITE_TOKEN", label: "File uploads (Vercel Blob)", ok: !!env.blobToken() },
  ];
}
