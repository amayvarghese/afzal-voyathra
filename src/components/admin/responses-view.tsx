"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileText, Inbox, MailCheck, MailX, Search, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Skeleton, buttonClass } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatAnswer, isFileList } from "@/lib/format";
import type { Field, FormDoc, ResponseRow } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface Page {
  total: number;
  page: number;
  pageSize: number;
  rows: ResponseRow[];
}

export function ResponsesView({ form }: { form: FormDoc }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const fields = useMemo(() => form.sections.flatMap((s) => s.fields).filter((f) => f.type !== "statement"), [form]);
  const previewFields = fields.filter((f) => f.type !== "file" && f.type !== "matrix").slice(0, 3);

  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.get("r"));
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/forms/${form._id}/responses?page=${page}&q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: Page) => {
        if (cancelled) return;
        setError(null);
        setData(json);
      })
      .catch(() => !cancelled && setError("Couldn't load responses."));
    return () => {
      cancelled = true;
    };
  }, [form._id, page, query, reloadKey]);

  const open = data?.rows.find((r) => r._id === openId) ?? null;

  async function remove() {
    if (!toDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/forms/${form._id}/responses/${toDelete}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast("Response deleted");
      setToDelete(null);
      setOpenId(null);
      load();
      router.refresh();
    } else toast("Delete failed", "error");
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search answers"
            aria-label="Search responses"
            className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 text-[15px] text-fg shadow-sm focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/15"
          />
        </div>
        <a href={`/api/admin/forms/${form._id}/export`} download className={buttonClass("secondary", "md", "shrink-0")}>
          <Download className="size-4" aria-hidden /> Export CSV
        </a>
      </div>

      <Card className="mt-5 overflow-hidden">
        {error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
              Try again
            </Button>
          </div>
        ) : !data ? (
          <div className="space-y-3 p-5" aria-label="Loading responses">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-xl bg-surface-2 text-fg-muted">
              <Inbox className="size-5" aria-hidden />
            </div>
            <h2 className="mt-4 font-serif text-2xl text-fg">{query ? "No matches" : "No responses yet"}</h2>
            <p className="mt-1 max-w-sm text-sm text-fg-muted">
              {query ? "Try a different search term." : "Share the questionnaire link — every submission will appear here and in your inbox."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-fg-subtle">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Submitted
                  </th>
                  {previewFields.map((f) => (
                    <th key={f.id} scope="col" className="max-w-[220px] truncate px-4 py-3 font-medium" title={f.label}>
                      {f.label}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Email status</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => setOpenId(r._id)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <button onClick={() => setOpenId(r._id)} className="tabular text-left font-medium text-fg hover:underline">
                        {formatDate(r.submittedAt)}
                      </button>
                    </td>
                    {previewFields.map((f) => (
                      <td key={f.id} className="max-w-[220px] truncate px-4 py-3.5 text-fg-muted">
                        {formatAnswer(f, r.answers[f.key]) || <span className="text-fg-subtle">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right">
                      <EmailStatus email={r.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-fg-muted">
          <span className="tabular">
            {(data.page - 1) * data.pageSize + 1}–{Math.min(data.total, data.page * data.pageSize)} of {data.total}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {open && (
        <ResponseDrawer
          form={form}
          fields={fields}
          response={open}
          onClose={() => setOpenId(null)}
          onDelete={() => setToDelete(open._id)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete this response?"
        description="It will be permanently removed from the database."
      />
    </div>
  );
}

function EmailStatus({ email }: { email?: ResponseRow["email"] }) {
  if (!email) return null;
  if (email.error)
    return (
      <span title={email.error} className="inline-flex text-danger">
        <MailX className="size-4" aria-label="Email failed" />
      </span>
    );
  return (
    <span title={email.confirmed ? "Notified you + sent customer a copy" : "Notification sent"} className="inline-flex text-success">
      <MailCheck className="size-4" aria-label="Email sent" />
    </span>
  );
}

function ResponseDrawer({
  form,
  fields,
  response,
  onClose,
  onDelete,
}: {
  form: FormDoc;
  fields: Field[];
  response: ResponseRow;
  onClose: () => void;
  onDelete: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const known = new Set(fields.map((f) => f.key));
  const legacy = Object.keys(response.answers).filter((k) => !known.has(k));

  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Response details"
        className="animate-slide-in absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-surface shadow-lg outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-accent">Response</p>
            <h2 className="tabular mt-1 font-serif text-2xl text-fg">{formatDate(response.submittedAt)}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>Form v{response.formVersion}</Badge>
              {response.email?.notified && <Badge tone="success">Emailed to you</Badge>}
              {response.email?.confirmed && <Badge tone="success">Copy sent to customer</Badge>}
              {response.email?.error && <Badge tone="danger">Email failed</Badge>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-lg p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {form.sections.map((s) => {
            const sf = s.fields.filter((f) => f.type !== "statement");
            if (!sf.length) return null;
            return (
              <section key={s.id} className="py-3">
                {s.title && <h3 className="pb-1 pt-3 font-serif text-xl text-fg">{s.title}</h3>}
                <dl className="divide-y divide-border">
                  {sf.map((f) => (
                    <Answer key={f.id} label={f.label} field={f} value={response.answers[f.key]} />
                  ))}
                </dl>
              </section>
            );
          })}
          {legacy.length > 0 && (
            <section className="py-3">
              <h3 className="pb-1 pt-3 font-serif text-xl text-fg-muted">Removed questions</h3>
              <dl className="divide-y divide-border">
                {legacy.map((k) => (
                  <Answer key={k} label={k} value={response.answers[k]} />
                ))}
              </dl>
            </section>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-border px-6 py-4">
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden /> Delete
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function Answer({ label, field, value }: { label: string; field?: Field; value: ResponseRow["answers"][string] | undefined }) {
  let body: React.ReactNode;
  if (isFileList(value)) {
    body = (
      <ul className="space-y-1.5">
        {value.map((f) => (
          <li key={f.url}>
            <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
              <FileText className="size-4" aria-hidden /> {f.name}
            </a>
          </li>
        ))}
      </ul>
    );
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    body = (
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(value).map(([row, col]) => (
            <tr key={row}>
              <td className="py-0.5 pr-4 text-fg-muted">{row}</td>
              <td className="py-0.5 font-medium text-fg">{col}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    const text = formatAnswer(field, value);
    body = text ? <span className="whitespace-pre-wrap">{text}</span> : <span className="text-fg-subtle">No answer</span>;
  }
  return (
    <div className="py-3.5">
      <dt className="text-[13px] text-fg-muted">{label}</dt>
      <dd className={cn("mt-1 text-[15px] leading-relaxed text-fg")}>{body}</dd>
    </div>
  );
}
