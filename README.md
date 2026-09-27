# Voyathra Travel & Tourism — Questionnaire Studio

Turn Word questionnaires into elegant, shareable web forms for Voyathra customers.

Upload `.docx` questionnaires, let AI (Groq) turn them into polished web forms, edit them in a visual builder, and share a link with customers. Every submission is:

- stored in **MongoDB** — one collection per questionnaire (e.g. `responses_client_onboarding_ab12c`), one document per submission, one field per question;
- emailed to you via **Gmail** (and optionally a copy to the customer);
- viewable in the admin **Responses** dashboard, with **CSV export**.

Built with Next.js 16 (App Router), Tailwind CSS 4, MongoDB driver 7, Nodemailer, Vercel Blob.

---

## 1. Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000 → /admin
```

## 2. Credentials you need

| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → your cluster → **Connect → Drivers** → copy the `mongodb+srv://…` string. In **Network Access** allow `0.0.0.0/0` (Vercel uses dynamic IPs). |
| `MONGODB_DB` | Any database name, e.g. `voyathra`. Created automatically. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your admin login for `/admin`. |
| `AUTH_SECRET` | Random 32+ chars: `openssl rand -base64 48` |
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `GMAIL_USER` | The Gmail address that sends the emails. |
| `GMAIL_APP_PASSWORD` | Turn on 2-Step Verification, then create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). (Your normal Gmail password will **not** work.) |
| `NOTIFY_EMAILS` | Optional. Default recipients for new-response emails (comma-separated). Each form can override this in **Settings**. |
| `BLOB_READ_WRITE_TOKEN` | Only for *File upload* questions. Vercel → **Storage → Create → Blob** → connect to the project (sets it automatically). Run `vercel env pull .env.local` to use it locally. |
| `NEXT_PUBLIC_BRAND_NAME` | Name shown on forms and emails. |
| `APP_URL` | Optional. Public URL used in email links (e.g. `https://forms.yourcompany.com`). |

The admin dashboard shows a **Setup** checklist of what's connected, plus a **Send test email** button.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. [vercel.com/new](https://vercel.com/new) → import the repo (framework: Next.js, no build settings needed).
3. Add all environment variables from `.env.example` under **Settings → Environment Variables**.
4. (Optional) **Storage → Blob** → create and connect to enable file uploads.
5. Deploy. Share links look like `https://your-app.vercel.app/f/<questionnaire-name>`.

## How it works

- **Import**: `.docx` → [mammoth](https://github.com/mwilliamson/mammoth.js) extracts headings, lists, checkboxes and tables → Groq (`openai/gpt-oss-120b`, falling back to `llama-3.3-70b-versatile`) returns a structured form definition → validated and normalised → saved. Change models with `GROQ_MODEL` / `GROQ_FALLBACK_MODEL`.
- **Question types**: short answer, paragraph, email, phone, number, date, time, multiple choice (+ "Other"), checkboxes, dropdown, yes/no, star rating, linear scale, grid (matrix), file upload, text block.
- **Follow-up questions**: any question can be shown only when an earlier answer matches (e.g. *"Refused a visa before?" → Yes → "Please give details"*). Hidden follow-ups are never required and their answers are never stored — enforced in the browser and on the server. Follow-ups can chain. AI import detects "If yes…", "If other, specify…", "Skip to…" patterns automatically.
- **Required questions**: one-tap Required/Optional toggle on every question card, a Required switch in the editor, and "All required / All optional" per section.
- **Editing**: every save creates a new version. Each question keeps a stable database column (`key`), so renaming a question never breaks existing data; answers to deleted questions stay in the database and appear in the CSV as "(removed)".
- **Customers**: step-by-step sections with progress bar, inline validation, auto-saved drafts on their device, mobile-first, light/dark aware.
- **Security**: admin routes protected by a signed, http-only session cookie (checked in `src/proxy.ts` and again in every admin API route); all submissions are validated server-side against the form definition; honeypot spam protection; CSV formula-injection protection.

## Project structure

```
src/
  app/
    admin/            login, dashboard, builder, responses, settings
    f/[slug]/         public questionnaire page
    api/admin/…       CRUD, import, export (auth required)
    api/public/…      submit + file-upload token
  components/         UI (admin/, public/, ui/)
  lib/                db, forms repo, groq, docx, mail, validation, schema
  proxy.ts            auth gate for /admin and /api/admin
```
