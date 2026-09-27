"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { Button, Card, FormRow, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { FormDoc, FormSettings } from "@/lib/types";
import { EMAIL_RE, slugify } from "@/lib/utils";

export function SettingsForm({ form, mailEnabled }: { form: FormDoc; mailEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<FormSettings>(form.settings);
  const [slug, setSlug] = useState(form.slug);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const emailFields = form.sections.flatMap((sec) => sec.fields).filter((f) => f.type === "email");
  const dirty = JSON.stringify(s) !== JSON.stringify(form.settings) || slugify(slug) !== form.slug;
  const set = <K extends keyof FormSettings>(k: K, v: FormSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  function addEmail() {
    const e = emailDraft.trim().toLowerCase();
    if (!e) return;
    if (!EMAIL_RE.test(e)) return setEmailError("Enter a valid email address.");
    if (!s.notifyEmails.includes(e)) set("notifyEmails", [...s.notifyEmails, e]);
    setEmailDraft("");
    setEmailError(null);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/forms/${form._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, slug }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast(j.error ?? "Save failed", "error");
    toast("Settings saved");
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    const res = await fetch(`/api/admin/forms/${form._id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Questionnaire deleted");
      router.replace("/admin");
      router.refresh();
    } else {
      setDeleting(false);
      toast("Delete failed", "error");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsCard title="Availability" description="Control whether customers can submit this questionnaire.">
        <Switch
          checked={s.isOpen}
          onChange={(v) => set("isOpen", v)}
          label="Accepting responses"
          description={s.isOpen ? "The share link is live." : "Visitors see a polite “no longer accepting responses” message."}
        />
        <FormRow label="Share link" hint="Changing this breaks links you've already sent.">
          {(p) => (
            <div className="flex items-stretch overflow-hidden rounded-[10px] border border-border bg-surface shadow-sm focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
              <span className="hidden items-center border-r border-border bg-surface-2 px-3 text-sm text-fg-muted sm:flex">/f/</span>
              <input
                {...p}
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                onBlur={() => setSlug(slugify(slug))}
                className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm text-fg outline-none"
              />
            </div>
          )}
        </FormRow>
      </SettingsCard>

      <SettingsCard
        title="Email notifications"
        description={
          mailEnabled
            ? "Every new response is emailed to these addresses with all answers."
            : "Gmail isn't connected yet — add GMAIL_USER and GMAIL_APP_PASSWORD to start receiving emails."
        }
      >
        <div>
          <div className="flex gap-2">
            <FormRow label="Send responses to" error={emailError} className="flex-1">
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={emailDraft}
                  placeholder="you@example.com"
                  onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
              )}
            </FormRow>
            <Button variant="secondary" className="mt-7 shrink-0" onClick={addEmail}>
              Add
            </Button>
          </div>
          {s.notifyEmails.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {s.notifyEmails.map((e) => (
                <li key={e} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pl-3 pr-1 text-sm text-fg">
                  {e}
                  <button
                    onClick={() => set("notifyEmails", s.notifyEmails.filter((x) => x !== e))}
                    aria-label={`Remove ${e}`}
                    className="grid size-7 place-items-center rounded-full text-fg-subtle hover:bg-surface-3 hover:text-fg"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-fg-muted">No recipients — falls back to NOTIFY_EMAILS / GMAIL_USER.</p>
          )}
        </div>

        <div className="border-t border-border pt-5">
          <Switch
            checked={s.confirmationEnabled}
            onChange={(v) => {
              set("confirmationEnabled", v);
              if (v && !s.confirmationFieldId && emailFields[0]) set("confirmationFieldId", emailFields[0].id);
            }}
            disabled={emailFields.length === 0}
            label="Email customers a copy of their answers"
            description={
              emailFields.length === 0
                ? "Add an Email question to the questionnaire to enable this."
                : "A thank-you email with their responses is sent to the address they enter."
            }
          />
          {s.confirmationEnabled && emailFields.length > 1 && (
            <FormRow label="Use the address from" className="mt-4">
              {(p) => (
                <Select {...p} value={s.confirmationFieldId ?? ""} onChange={(e) => set("confirmationFieldId", e.target.value)}>
                  {emailFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormRow>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Customer experience" description="What respondents see while filling in and after submitting.">
        <Switch
          checked={s.paginate}
          onChange={(v) => set("paginate", v)}
          label="One section per page"
          description="Long questionnaires feel lighter as a step-by-step flow with a progress bar."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormRow label="Submit button label">
            {(p) => <Input {...p} value={s.submitLabel} maxLength={40} onChange={(e) => set("submitLabel", e.target.value)} />}
          </FormRow>
          <FormRow label="Thank-you heading">
            {(p) => <Input {...p} value={s.successTitle} maxLength={200} onChange={(e) => set("successTitle", e.target.value)} />}
          </FormRow>
        </div>
        <FormRow label="Thank-you message">
          {(p) => <Textarea {...p} value={s.successMessage} maxLength={2000} onChange={(e) => set("successMessage", e.target.value)} />}
        </FormRow>
      </SettingsCard>

      <SettingsCard title="Database" description="Where this questionnaire's responses are stored in MongoDB.">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">Collection</dt>
            <dd className="mt-1 break-all font-mono text-[13px] text-fg">{form.collectionName}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Documents</dt>
            <dd className="tabular mt-1 text-fg">{form.responseCount}</dd>
          </div>
        </dl>
      </SettingsCard>

      <Card className="border-danger/30 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Delete questionnaire</h2>
            <p className="mt-0.5 text-sm text-fg-muted">Removes the form, its link and all responses. This can&apos;t be undone.</p>
          </div>
          <Button variant="outline" className="shrink-0 border-danger/40 text-danger hover:bg-danger-soft" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
        </div>
      </Card>

      {dirty && (
        <div className="animate-pop sticky bottom-4 z-30 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-3 shadow-lg">
          <p className="text-sm text-fg">You have unsaved changes</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setS(form.settings);
                setSlug(form.slug);
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save settings
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleting}
        title="Delete questionnaire?"
        description={`“${form.title}” and all ${form.responseCount} responses will be permanently deleted.`}
        confirmLabel="Delete forever"
      />
    </div>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="font-serif text-2xl text-fg">{title}</h2>
      <p className="mt-1 text-sm text-fg-muted">{description}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </Card>
  );
}
