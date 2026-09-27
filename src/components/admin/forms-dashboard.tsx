"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  FileText,
  FileUp,
  Inbox,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  AlertCircle,
  PenLine,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { FormDoc } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

type ImportItem = { name: string; status: "queued" | "parsing" | "done" | "error"; message?: string; formId?: string };

export function copyShareLink(slug: string, toast: ReturnType<typeof useToast>) {
  const url = `${window.location.origin}/f/${slug}`;
  navigator.clipboard.writeText(url).then(
    () => toast("Link copied to clipboard"),
    () => toast(url, "success"),
  );
}

export function FormsDashboard({ initialForms, importEnabled }: { initialForms: FormDoc[]; importEnabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [forms, setForms] = useState(initialForms);
  const [newOpen, setNewOpen] = useState(false);
  const [imports, setImports] = useState<ImportItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<FormDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = imports.some((i) => i.status === "parsing" || i.status === "queued");

  async function runImports(files: File[]) {
    const docx = files.filter((f) => /\.docx$/i.test(f.name));
    if (docx.length !== files.length) toast("Only .docx files can be imported — other files were skipped.", "error");
    if (!docx.length) return;
    const start = imports.length;
    setImports((prev) => [...prev, ...docx.map((f) => ({ name: f.name, status: "queued" as const }))]);

    // Sequential keeps us well inside Groq rate limits.
    for (let i = 0; i < docx.length; i++) {
      const idx = start + i;
      const update = (patch: Partial<ImportItem>) =>
        setImports((prev) => prev.map((it, j) => (j === idx ? { ...it, ...patch } : it)));
      update({ status: "parsing" });
      const fd = new FormData();
      fd.append("file", docx[i]);
      try {
        const res = await fetch("/api/admin/forms/import", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? `Failed (${res.status})`);
        const form = j.form as FormDoc;
        setForms((prev) => [form, ...prev]);
        const count = form.sections.reduce((n, s) => n + s.fields.filter((f) => f.type !== "statement").length, 0);
        update({ status: "done", formId: form._id, message: `${count} questions · ${form.sections.length} section${form.sections.length === 1 ? "" : "s"}` });
      } catch (e) {
        update({ status: "error", message: e instanceof Error ? e.message : "Import failed" });
      }
    }
    router.refresh();
  }

  async function createBlank() {
    setCreating(true);
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled questionnaire", description: "", sections: [] }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/admin/forms/${j.form._id}`);
    else {
      toast(j.error ?? "Could not create the questionnaire", "error");
      setCreating(false);
    }
  }

  async function duplicate(form: FormDoc) {
    const res = await fetch(`/api/admin/forms/${form._id}/duplicate`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setForms((prev) => [j.form, ...prev]);
      toast("Duplicated — the copy starts closed to responses");
    } else toast(j.error ?? "Duplicate failed", "error");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/forms/${toDelete._id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setForms((prev) => prev.filter((f) => f._id !== toDelete._id));
      toast("Questionnaire deleted");
      setToDelete(null);
    } else toast("Delete failed", "error");
  }

  const totalResponses = forms.reduce((n, f) => n + f.responseCount, 0);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Dashboard</p>
          <h1 className="mt-1 font-serif text-[40px] leading-none tracking-tight text-fg sm:text-5xl">Questionnaires</h1>
          <p className="mt-3 text-[15px] text-fg-muted">
            <span className="tabular">{forms.length}</span> {forms.length === 1 ? "form" : "forms"} ·{" "}
            <span className="tabular">{totalResponses}</span> {totalResponses === 1 ? "response" : "responses"} collected
          </p>
        </div>
        <Button size="lg" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" aria-hidden /> New questionnaire
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="animate-in flex flex-col items-center px-6 py-16 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <FileText className="size-6" aria-hidden />
          </div>
          <h2 className="mt-5 font-serif text-3xl text-fg">Start with a Word document</h2>
          <p className="mt-2 max-w-md text-[15px] text-fg-muted">
            Drop in a .docx questionnaire and it will be turned into a polished, shareable web form — ready to edit.
          </p>
          <Button className="mt-6" onClick={() => setNewOpen(true)}>
            <FileUp className="size-4" aria-hidden /> Import questionnaire
          </Button>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form, i) => (
            <FormCard
              key={form._id}
              form={form}
              index={i}
              onCopy={() => copyShareLink(form.slug, toast)}
              onDuplicate={() => duplicate(form)}
              onDelete={() => setToDelete(form)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={newOpen}
        onClose={() => {
          if (!busy) {
            setNewOpen(false);
            setImports([]);
          }
        }}
        title="New questionnaire"
        description="Import one or more Word documents, or build a form from scratch."
        size="lg"
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (importEnabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (importEnabled) runImports([...e.dataTransfer.files]);
            }}
            className={cn(
              "relative rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200",
              dragging ? "border-ring bg-primary-soft" : "border-border-strong bg-surface-2/60",
              !importEnabled && "opacity-60",
            )}
          >
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-surface text-primary shadow-sm">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <p className="mt-4 text-[15px] font-medium text-fg">Drop .docx files here</p>
            <p className="mt-1 text-sm text-fg-muted">
              {importEnabled ? "AI reads each document and builds the questions, choices and sections." : "Add GROQ_API_KEY to enable AI import."}
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={(e) => {
                runImports([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
              disabled={!importEnabled}
            />
            <Button variant="secondary" className="mt-5" onClick={() => fileInput.current?.click()} disabled={!importEnabled}>
              <FileUp className="size-4" aria-hidden /> Choose files
            </Button>
          </div>

          {imports.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border" aria-live="polite">
              {imports.map((it, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  {it.status === "done" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                  ) : it.status === "error" ? (
                    <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden />
                  ) : it.status === "parsing" ? (
                    <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : (
                    <FileText className="size-5 shrink-0 text-fg-subtle" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg" title={it.name}>
                      {it.name}
                    </p>
                    <p className={cn("text-[13px]", it.status === "error" ? "text-danger" : "text-fg-muted")}>
                      {it.status === "queued" && "Waiting…"}
                      {it.status === "parsing" && "Reading document and building questions…"}
                      {(it.status === "done" || it.status === "error") && it.message}
                    </p>
                  </div>
                  {it.formId && (
                    <Link href={`/admin/forms/${it.formId}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
                      Review
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-fg-subtle">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={createBlank}
            disabled={creating}
            className="flex w-full items-center gap-4 rounded-xl border border-border bg-surface px-4 py-4 text-left transition-colors duration-200 hover:border-border-strong hover:bg-surface-2 disabled:opacity-60"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-muted">
              {creating ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <PenLine className="size-5" aria-hidden />}
            </span>
            <span>
              <span className="block text-[15px] font-medium text-fg">Start from blank</span>
              <span className="block text-[13px] text-fg-muted">Build the questions yourself in the editor.</span>
            </span>
          </button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete questionnaire?"
        description={
          <>
            <strong className="font-medium text-fg">{toDelete?.title}</strong> and all{" "}
            <span className="tabular">{toDelete?.responseCount ?? 0}</span> of its responses will be permanently deleted from the database. The share link will stop working.
          </>
        }
        confirmLabel="Delete forever"
      />
    </>
  );
}

function FormCard({
  form,
  index,
  onCopy,
  onDuplicate,
  onDelete,
}: {
  form: FormDoc;
  index: number;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const questions = form.sections.reduce((n, s) => n + s.fields.filter((f) => f.type !== "statement").length, 0);

  return (
    <li className="animate-in" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Card className="group relative flex h-full flex-col p-5 transition-[box-shadow,border-color] duration-200 hover:border-border-strong hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <Badge tone={form.settings.isOpen ? "success" : "neutral"}>
            <span className={cn("size-1.5 rounded-full", form.settings.isOpen ? "bg-success" : "bg-fg-subtle")} aria-hidden />
            {form.settings.isOpen ? "Accepting responses" : "Closed"}
          </Badge>
          <div className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setMenu(false);
              }}
              aria-label={`More actions for ${form.title}`}
              aria-expanded={menu}
              className="-m-2 grid size-10 place-items-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg"
            >
              <MoreHorizontal className="size-5" />
            </button>
            {menu && (
              <div
                role="menu"
                className="animate-pop absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
                onMouseDown={(e) => e.preventDefault()}
              >
                <MenuItem icon={Link2} onClick={() => (setMenu(false), onCopy())}>
                  Copy share link
                </MenuItem>
                <MenuItem icon={Copy} onClick={() => (setMenu(false), onDuplicate())}>
                  Duplicate
                </MenuItem>
                <div className="my-1 h-px bg-border" />
                <MenuItem icon={Trash2} danger onClick={() => (setMenu(false), onDelete())}>
                  Delete
                </MenuItem>
              </div>
            )}
          </div>
        </div>

        <Link href={`/admin/forms/${form._id}`} className="mt-4 block flex-1 rounded-lg after:absolute after:inset-0 after:rounded-2xl">
          <h2 className="line-clamp-2 font-serif text-[26px] leading-[1.15] text-fg">{form.title}</h2>
          {form.description && <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{form.description}</p>}
        </Link>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-xs text-fg-subtle">Responses</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold text-fg">{form.responseCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Questions</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold text-fg">{questions}</dd>
          </div>
        </dl>
        <div className="relative z-10 mt-4 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Inbox className="size-3.5" aria-hidden /> {relativeTime(form.lastResponseAt)}
          </span>
          <div className="flex gap-1">
            <Link
              href={`/admin/forms/${form._id}/responses`}
              className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              Responses
            </Link>
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${form.title} public form in a new tab`}
              className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArrowUpRight className="size-4" />
            </a>
            <button
              onClick={onDelete}
              aria-label={`Delete ${form.title}`}
              title="Delete questionnaire"
              className="grid size-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </Card>
    </li>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-surface-2",
        danger ? "text-danger" : "text-fg",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  );
}
