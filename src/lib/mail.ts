import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { formatAnswer, isFileList } from "./format";
import type { AnswerValue, FormDoc } from "./types";
import { escapeHtml, formatDate } from "./utils";

let transporter: Transporter | null = null;

export function mailEnabled() {
  return !!env.gmailUser() && !!env.gmailAppPassword();
}

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: env.gmailUser(), pass: env.gmailAppPassword() },
  });
  return transporter;
}

const C = {
  bg: "#F7F5F1",
  card: "#FFFFFF",
  ink: "#1A1D24",
  muted: "#5E6470",
  border: "#E6E1D8",
  navy: "#1D2B4A",
  gold: "#8A5A12",
};

function answersTable(form: FormDoc, answers: Record<string, AnswerValue>) {
  return form.sections
    .map((section) => {
      const rows = section.fields
        .filter((f) => f.type !== "statement")
        .map((f) => {
          const v = answers[f.key];
          let html: string;
          if (isFileList(v)) {
            html = v.map((file) => `<a href="${escapeHtml(file.url)}" style="color:${C.navy}">${escapeHtml(file.name)}</a>`).join("<br>");
          } else {
            const text = formatAnswer(f, v);
            html = text ? escapeHtml(text).replace(/\n/g, "<br>") : `<span style="color:#9AA0AA">No answer</span>`;
          }
          return `<tr>
            <td style="padding:14px 0;border-top:1px solid ${C.border};vertical-align:top">
              <div style="font-size:12px;letter-spacing:.02em;color:${C.muted};margin-bottom:4px">${escapeHtml(f.label)}</div>
              <div style="font-size:15px;line-height:1.55;color:${C.ink}">${html}</div>
            </td></tr>`;
        })
        .join("");
      if (!rows) return "";
      const heading = section.title
        ? `<tr><td style="padding:22px 0 6px;font-family:Georgia,serif;font-size:18px;color:${C.ink}">${escapeHtml(section.title)}</td></tr>`
        : "";
      return heading + rows;
    })
    .join("");
}

function layout(opts: { preheader: string; eyebrow: string; title: string; intro: string; body: string; cta?: { href: string; label: string } }) {
  const brand = escapeHtml(env.mailFromName());
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${C.ink}">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 4px 18px;font-family:Georgia,serif;font-size:18px;color:${C.navy}">${brand}</td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:32px">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.gold};margin-bottom:10px">${escapeHtml(opts.eyebrow)}</div>
      <h1 style="margin:0 0 10px;font-family:Georgia,serif;font-weight:400;font-size:26px;line-height:1.25;color:${C.ink}">${escapeHtml(opts.title)}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${C.muted}">${opts.intro}</p>
      ${opts.cta ? `<p style="margin:0 0 20px"><a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;background:${C.navy};color:#fff;text-decoration:none;padding:11px 18px;border-radius:9px;font-size:14px;font-weight:600">${escapeHtml(opts.cta.label)}</a></p>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${opts.body}</table>
    </td></tr>
    <tr><td style="padding:18px 4px;font-size:12px;color:${C.muted}">Sent by ${brand}</td></tr>
  </table>
</td></tr></table></body></html>`;
}

function plainText(form: FormDoc, answers: Record<string, AnswerValue>) {
  return form.sections
    .flatMap((s) => [
      ...(s.title ? [`\n== ${s.title} ==`] : []),
      ...s.fields.filter((f) => f.type !== "statement").map((f) => `${f.label}\n${formatAnswer(f, answers[f.key]) || "—"}\n`),
    ])
    .join("\n");
}

export async function sendNotification(opts: {
  form: FormDoc;
  answers: Record<string, AnswerValue>;
  responseId: string;
  origin: string;
  replyTo?: string;
}) {
  const { form, answers, origin, replyTo } = opts;
  const to = form.settings.notifyEmails.length ? form.settings.notifyEmails : env.notifyEmails();
  if (!to.length) return false;
  const when = formatDate(new Date());
  await getTransporter().sendMail({
    from: { name: env.mailFromName(), address: env.gmailUser() },
    to,
    replyTo,
    subject: `New response · ${form.title}`,
    text: `New response to ${form.title} (${when})\n${plainText(form, answers)}\n\nView all responses: ${origin}/admin/forms/${form._id}/responses`,
    html: layout({
      preheader: `A new response to ${form.title} just arrived.`,
      eyebrow: "New response",
      title: form.title,
      intro: `Submitted ${escapeHtml(when)}${replyTo ? ` by <a href="mailto:${escapeHtml(replyTo)}" style="color:${C.navy}">${escapeHtml(replyTo)}</a>` : ""}.`,
      body: answersTable(form, answers),
      cta: { href: `${origin}/admin/forms/${form._id}/responses?r=${opts.responseId}`, label: "Open in dashboard" },
    }),
  });
  return true;
}

export async function sendConfirmation(opts: { form: FormDoc; answers: Record<string, AnswerValue>; to: string }) {
  const { form, answers, to } = opts;
  await getTransporter().sendMail({
    from: { name: env.mailFromName(), address: env.gmailUser() },
    to,
    replyTo: form.settings.notifyEmails[0] || env.gmailUser(),
    subject: `We've received your responses · ${form.title}`,
    text: `${form.settings.successMessage}\n\nA copy of your answers:\n${plainText(form, answers)}`,
    html: layout({
      preheader: "Thank you — here's a copy of your answers.",
      eyebrow: "Submission received",
      title: form.settings.successTitle || "Thank you",
      intro: escapeHtml(form.settings.successMessage) + "<br><br>For your records, here's a copy of what you submitted.",
      body: answersTable(form, answers),
    }),
  });
}

export async function sendTestEmail(to: string) {
  await getTransporter().sendMail({
    from: { name: env.mailFromName(), address: env.gmailUser() },
    to,
    subject: "Email is working ✓",
    text: "Your questionnaire app can send email.",
    html: layout({
      preheader: "Your questionnaire app can send email.",
      eyebrow: "Test",
      title: "Email is set up",
      intro: "New responses will be delivered to this address.",
      body: "",
    }),
  });
}
