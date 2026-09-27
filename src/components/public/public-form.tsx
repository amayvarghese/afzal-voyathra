"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { upload } from "@vercel/blob/client";
import { ArrowLeft, ArrowRight, Check, FileText, History, Loader2, Star, UploadCloud, X, AlertCircle } from "lucide-react";
import { Button, inputClass } from "@/components/ui/primitives";
import type { Field, PublicForm, UploadedFile } from "@/lib/types";
import { checkField } from "@/lib/validate";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

type Answers = Record<string, unknown>;
type Errors = Record<string, string>;

export function PublicFormView({ form, brand }: { form: PublicForm; brand: string }) {
  const draftKey = `fc-draft:${form.slug}:v${form.version}`;
  const steps = useMemo(
    () => (form.paginate && form.sections.length > 1 ? form.sections.map((s) => [s]) : [form.sections]),
    [form],
  );
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(0);
  const honeypot = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Persist a draft so customers never lose progress on long questionnaires.
  const hasDraft = useSyncExternalStore(
    noopSubscribe,
    () => readDraft(draftKey) !== null,
    () => false,
  );
  const [draftHandled, setDraftHandled] = useState(false);
  const showResume = hasDraft && !draftHandled && Object.keys(answers).length === 0;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      try {
        if (Object.keys(answers).length) localStorage.setItem(draftKey, JSON.stringify(answers));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [answers, draftKey, done]);

  const allFields = form.sections.flatMap((s) => s.fields).filter((f) => f.type !== "statement");
  const answeredCount = allFields.filter((f) => {
    const v = answers[f.key];
    return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && v && !Array.isArray(v) && Object.keys(v).length === 0);
  }).length;
  const progress = allFields.length ? answeredCount / allFields.length : 0;

  const setAnswer = (key: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    if (errors[key])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
  };

  function validate(fields: Field[]): Errors {
    const errs: Errors = {};
    for (const f of fields) {
      if (f.type === "statement") continue;
      const v = answers[f.key];
      if (typeof v === "string" && v === "Other: ") {
        errs[f.key] = "Please specify your answer.";
        continue;
      }
      if (Array.isArray(v) && v.includes("Other: ")) {
        errs[f.key] = "Please specify “Other”.";
        continue;
      }
      const [, err] = checkField(f, v);
      if (err) errs[f.key] = err;
    }
    return errs;
  }

  function focusFirstError(errs: Errors) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`q-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el?.querySelector("input,textarea,select,button") as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }

  function goTo(next: number) {
    setStep(next);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function onContinue() {
    const errs = validate(steps[step].flatMap((s) => s.fields));
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);
    goTo(step + 1);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < steps.length - 1) return onContinue();
    const errs = validate(allFields);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const firstStep = steps.findIndex((st) => st.some((s) => s.fields.some((f) => errs[f.key])));
      if (firstStep >= 0 && firstStep !== step) setStep(firstStep);
      return focusFirstError(errs);
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/public/${form.slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, website: honeypot.current?.value ?? "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 422 && j.errors) {
        setErrors(j.errors);
        const firstStep = steps.findIndex((st) => st.some((s) => s.fields.some((f) => j.errors[f.key])));
        if (firstStep >= 0) setStep(firstStep);
        focusFirstError(j.errors);
        setSubmitError("Some answers need attention.");
      } else if (!res.ok) {
        setSubmitError(j.error ?? "Something went wrong. Please try again.");
      } else {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setSubmitError("You appear to be offline. Check your connection and try again — your answers are saved.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Shell brand={brand}>
        <div className="animate-in rounded-3xl border border-border bg-surface px-6 py-16 text-center shadow-md sm:px-12">
          <div className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-8" strokeWidth={2.2} aria-hidden />
          </div>
          <h1 className="mt-6 font-serif text-4xl tracking-tight text-fg sm:text-5xl">{form.successTitle || "Thank you"}</h1>
          <p className="mx-auto mt-4 max-w-md whitespace-pre-line text-[16px] leading-relaxed text-fg-muted">{form.successMessage}</p>
        </div>
      </Shell>
    );
  }

  let qNumber = 0;
  const numbers = new Map<string, number>();
  form.sections.forEach((s) => s.fields.forEach((f) => f.type !== "statement" && numbers.set(f.id, ++qNumber)));
  const isLast = step === steps.length - 1;

  return (
    <Shell brand={brand} progress={progress}>
      <div ref={topRef} className="scroll-mt-24" />
      {step === 0 && (
        <header className="animate-in mb-10">
          <h1 className="font-serif text-[40px] leading-[1.08] tracking-tight text-fg sm:text-[52px]">{form.title}</h1>
          {form.description && <p className="mt-5 whitespace-pre-line text-[17px] leading-relaxed text-fg-muted">{form.description}</p>}
          <p className="mt-5 text-[13px] text-fg-subtle">
            <span className="text-danger">*</span> indicates a required question
          </p>
        </header>
      )}

      {showResume && (
        <div className="animate-in mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm text-fg">
            <History className="size-4 shrink-0 text-accent" aria-hidden />
            You have answers saved from an earlier visit.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try {
                  localStorage.removeItem(draftKey);
                } catch {}
                setDraftHandled(true);
              }}
            >
              Start fresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAnswers(readDraft(draftKey) ?? {});
                setDraftHandled(true);
              }}
            >
              Resume
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0" />

        {steps.length > 1 && (
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-accent">
            Step {step + 1} of {steps.length}
          </p>
        )}

        <div key={step} className="animate-in space-y-8">
          {steps[step].map((section) => (
            <section key={section.id} aria-labelledby={section.title ? `s-${section.id}` : undefined}>
              {(section.title || section.description) && (
                <div className="mb-5">
                  {section.title && (
                    <h2 id={`s-${section.id}`} className="font-serif text-[30px] leading-tight text-fg">
                      {section.title}
                    </h2>
                  )}
                  {section.description && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-fg-muted">{section.description}</p>}
                </div>
              )}
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <Question
                    key={field.id}
                    field={field}
                    number={numbers.get(field.id)}
                    value={answers[field.key]}
                    error={errors[field.key]}
                    onChange={(v) => setAnswer(field.key, v)}
                    slug={form.slug}
                    uploadsEnabled={form.uploadsEnabled}
                    onUploading={(d) => setUploading((n) => n + d)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {submitError && (
          <p role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {submitError}
          </p>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" size="lg" onClick={() => goTo(step - 1)}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
          ) : (
            <span />
          )}
          {isLast ? (
            <Button type="submit" size="lg" loading={submitting} disabled={uploading > 0} className="min-w-40">
              {uploading > 0 ? "Uploading…" : form.submitLabel || "Submit"}
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={onContinue} className="min-w-40">
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-fg-subtle">Your progress is saved on this device until you submit.</p>
      </form>
    </Shell>
  );
}

const noopSubscribe = () => () => {};

function readDraft(key: string): Answers | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Answers) : null;
  } catch {
    return null;
  }
}

function Shell({ brand, progress, children }: { brand: string; progress?: number; children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_70%)] opacity-70"
      />
      <div className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo size="sm" className="min-w-0" />
          <span className="sr-only">{brand}</span>
          {progress !== undefined && <span className="tabular shrink-0 text-xs text-fg-muted">{Math.round(progress * 100)}% complete</span>}
        </div>
        {progress !== undefined && (
          <div
            className="h-0.5 bg-surface-3"
            role="progressbar"
            aria-label="Progress"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full origin-left bg-primary transition-transform duration-500 ease-out-soft" style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
      </div>
      <main className="relative mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">{children}</main>
    </div>
  );
}

// ── Questions ────────────────────────────────────────────────────────────────

function Question({
  field,
  number,
  value,
  error,
  onChange,
  slug,
  uploadsEnabled,
  onUploading,
}: {
  field: Field;
  number?: number;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  slug: string;
  uploadsEnabled: boolean;
  onUploading: (delta: number) => void;
}) {
  const id = `q-${field.key}`;
  const labelId = `${id}-label`;
  const descId = field.description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  if (field.type === "statement") {
    return <div className="whitespace-pre-line rounded-2xl border-l-2 border-accent bg-accent-soft/50 px-5 py-4 text-[15px] leading-relaxed text-fg">{field.label}</div>;
  }

  const groupTypes = ["single_choice", "multi_choice", "yes_no", "rating", "scale", "matrix", "file"];
  const isGroup = groupTypes.includes(field.type);
  const common = { id: `${id}-input`, "aria-labelledby": labelId, "aria-describedby": describedBy, "aria-invalid": !!error || undefined, "aria-required": field.required || undefined };

  return (
    <div
      id={id}
      role={isGroup ? "group" : undefined}
      aria-labelledby={isGroup ? labelId : undefined}
      className={cn(
        "scroll-mt-28 rounded-2xl border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] duration-200 sm:p-6",
        error ? "border-danger/50" : "border-border focus-within:border-border-strong focus-within:shadow-md",
      )}
    >
      <div className="mb-4 flex gap-3">
        {number !== undefined && <span className="tabular mt-0.5 shrink-0 text-sm font-medium text-accent">{String(number).padStart(2, "0")}</span>}
        <div className="min-w-0">
          {isGroup ? (
            <p id={labelId} className="text-[17px] font-medium leading-snug text-fg">
              {field.label}
              {field.required && <span className="ml-1 text-danger" aria-hidden>*</span>}
            </p>
          ) : (
            <label id={labelId} htmlFor={common.id} className="block text-[17px] font-medium leading-snug text-fg">
              {field.label}
              {field.required && <span className="ml-1 text-danger" aria-hidden>*</span>}
            </label>
          )}
          {field.description && (
            <p id={descId} className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fg-muted">
              {field.description}
            </p>
          )}
        </div>
      </div>

      <FieldInput field={field} value={value} onChange={onChange} common={common} slug={slug} uploadsEnabled={uploadsEnabled} onUploading={onUploading} />

      {error && (
        <p id={errId} role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

type Common = { id: string; "aria-labelledby": string; "aria-describedby"?: string; "aria-invalid"?: boolean; "aria-required"?: boolean };

function FieldInput({
  field,
  value,
  onChange,
  common,
  slug,
  uploadsEnabled,
  onUploading,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  common: Common;
  slug: string;
  uploadsEnabled: boolean;
  onUploading: (delta: number) => void;
}) {
  const str = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const text = (type: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input {...common} {...extra} type={type} value={str} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-12 text-[16px]")} />
  );

  switch (field.type) {
    case "short_text":
      return text("text", { maxLength: 1000 });
    case "email":
      return text("email", { autoComplete: "email", inputMode: "email" });
    case "phone":
      return text("tel", { autoComplete: "tel", inputMode: "tel" });
    case "number":
      return text("number", { inputMode: "decimal", min: field.min, max: field.max, step: "any" });
    case "date":
      return text("date");
    case "time":
      return text("time");
    case "long_text":
      return (
        <textarea
          {...common}
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={20000}
          className={cn(inputClass, "min-h-32 py-3 text-[16px] leading-relaxed")}
        />
      );
    case "dropdown":
      return (
        <select {...common} value={str} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-12 text-[16px]")}>
          <option value="">Select…</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "single_choice":
      return <SingleChoice field={field} value={str} onChange={onChange} />;
    case "multi_choice":
      return <MultiChoice field={field} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />;
    case "yes_no":
      return (
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby={common["aria-labelledby"]}>
          {["Yes", "No"].map((o) => (
            <OptionTile key={o} type="radio" name={field.key} checked={str === o} onChange={() => onChange(o)} label={o} centered />
          ))}
        </div>
      );
    case "rating":
      return <Rating field={field} value={Number(value) || 0} onChange={onChange} />;
    case "scale":
      return <Scale field={field} value={value === undefined || value === "" ? null : Number(value)} onChange={onChange} />;
    case "matrix":
      return <Matrix field={field} value={(value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, string>} onChange={onChange} />;
    case "file":
      return uploadsEnabled ? (
        <FileUpload field={field} slug={slug} value={Array.isArray(value) ? (value as UploadedFile[]) : []} onChange={onChange} onUploading={onUploading} />
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">File uploads are not available right now.</p>
      );
    default:
      return null;
  }
}

function OptionTile({
  type,
  name,
  checked,
  onChange,
  label,
  centered,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  centered?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "group flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-[border-color,background-color] duration-150",
        checked ? "border-primary bg-primary-soft text-fg" : "border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2/60",
        centered && "justify-center",
        "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
      )}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {!centered && (
        <span
          aria-hidden
          className={cn(
            "grid size-5 shrink-0 place-items-center border-2 transition-colors duration-150",
            type === "radio" ? "rounded-full" : "rounded-md",
            checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface",
          )}
        >
          {checked && (type === "radio" ? <span className="size-2 rounded-full bg-primary-fg" /> : <Check className="size-3.5" strokeWidth={3} />)}
        </span>
      )}
      <span className={cn("min-w-0 flex-1 leading-snug", centered && "text-center font-medium")}>{label}</span>
      {children}
    </label>
  );
}

const OTHER = "Other: ";

function SingleChoice({ field, value, onChange }: { field: Field; value: string; onChange: (v: unknown) => void }) {
  const isOther = value.startsWith(OTHER);
  return (
    <div className="grid gap-2.5" role="radiogroup">
      {field.options?.map((o) => (
        <OptionTile key={o} type="radio" name={field.key} checked={value === o} onChange={() => onChange(o)} label={o} />
      ))}
      {field.allowOther && (
        <>
          <OptionTile type="radio" name={field.key} checked={isOther} onChange={() => !isOther && onChange(OTHER)} label="Other" />
          {isOther && (
            <input
              autoFocus
              value={value.slice(OTHER.length)}
              onChange={(e) => onChange(OTHER + e.target.value)}
              placeholder="Please specify"
              aria-label="Other, please specify"
              className={cn(inputClass, "h-12 text-[16px]")}
            />
          )}
        </>
      )}
    </div>
  );
}

function MultiChoice({ field, value, onChange }: { field: Field; value: string[]; onChange: (v: unknown) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const other = value.find((v) => v.startsWith(OTHER));
  return (
    <div className="grid gap-2.5">
      {(field.min || field.max) && (
        <p className="-mt-1 mb-1 text-[13px] text-fg-muted">
          {field.min && field.max ? `Select ${field.min}–${field.max}` : field.min ? `Select at least ${field.min}` : `Select up to ${field.max}`}
        </p>
      )}
      {field.options?.map((o) => (
        <OptionTile key={o} type="checkbox" name={`${field.key}-${o}`} checked={value.includes(o)} onChange={() => toggle(o)} label={o} />
      ))}
      {field.allowOther && (
        <>
          <OptionTile
            type="checkbox"
            name={`${field.key}-other`}
            checked={other !== undefined}
            onChange={() => onChange(other !== undefined ? value.filter((v) => v !== other) : [...value, OTHER])}
            label="Other"
          />
          {other !== undefined && (
            <input
              autoFocus
              value={other.slice(OTHER.length)}
              onChange={(e) => onChange(value.map((v) => (v === other ? OTHER + e.target.value : v)))}
              placeholder="Please specify"
              aria-label="Other, please specify"
              className={cn(inputClass, "h-12 text-[16px]")}
            />
          )}
        </>
      )}
    </div>
  );
}

function Rating({ field, value, onChange }: { field: Field; value: number; onChange: (v: unknown) => void }) {
  const [hover, setHover] = useState(0);
  const max = field.max ?? 5;
  const shown = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <label
          key={n}
          onMouseEnter={() => setHover(n)}
          className="grid size-12 cursor-pointer place-items-center rounded-xl transition-transform duration-150 hover:scale-110 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
        >
          <input type="radio" name={field.key} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" aria-label={`${n} of ${max}`} />
          <Star className={cn("size-8 transition-colors duration-150", n <= shown ? "fill-accent text-accent" : "text-border-strong")} strokeWidth={1.5} aria-hidden />
        </label>
      ))}
      {value > 0 && (
        <span className="tabular ml-2 text-sm text-fg-muted">
          {value} / {max}
        </span>
      )}
    </div>
  );
}

function Scale({ field, value, onChange }: { field: Field; value: number | null; onChange: (v: unknown) => void }) {
  const min = field.min ?? 1;
  const max = field.max ?? 5;
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${nums.length}, minmax(0, 1fr))` }} role="radiogroup">
        {nums.map((n) => (
          <label
            key={n}
            className={cn(
              "tabular grid h-12 cursor-pointer place-items-center rounded-xl border text-[15px] font-medium transition-[border-color,background-color,color] duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              value === n ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2",
            )}
          >
            <input type="radio" name={field.key} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      {(field.minLabel || field.maxLabel) && (
        <div className="mt-2 flex justify-between gap-4 text-[13px] text-fg-muted">
          <span>{field.minLabel}</span>
          <span className="text-right">{field.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function Matrix({ field, value, onChange }: { field: Field; value: Record<string, string>; onChange: (v: unknown) => void }) {
  const set = (row: string, col: string) => onChange({ ...value, [row]: col });
  const cols = field.options ?? [];
  return (
    <>
      {/* Desktop grid */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-2/5" />
              {cols.map((c) => (
                <th key={c} scope="col" className="px-1 pb-3 text-center text-[13px] font-medium leading-tight text-fg-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows?.map((row) => (
              <tr key={row} className="border-t border-border">
                <th scope="row" className="py-3 pr-4 text-left text-[15px] font-normal text-fg">
                  {row}
                </th>
                {cols.map((c) => (
                  <td key={c} className="text-center">
                    <label className="inline-grid size-11 cursor-pointer place-items-center rounded-full hover:bg-surface-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                      <input type="radio" name={`${field.key}-${row}`} checked={value[row] === c} onChange={() => set(row, c)} className="sr-only" aria-label={`${row}: ${c}`} />
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-5 place-items-center rounded-full border-2 transition-colors duration-150",
                          value[row] === c ? "border-primary bg-primary" : "border-border-strong",
                        )}
                      >
                        {value[row] === c && <span className="size-2 rounded-full bg-primary-fg" />}
                      </span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile: stacked */}
      <div className="space-y-5 sm:hidden">
        {field.rows?.map((row) => (
          <fieldset key={row}>
            <legend className="mb-2 text-[15px] text-fg">{row}</legend>
            <div className="flex flex-wrap gap-2">
              {cols.map((c) => (
                <label
                  key={c}
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    value[row] === c ? "border-primary bg-primary text-primary-fg" : "border-border text-fg",
                  )}
                >
                  <input type="radio" name={`${field.key}-${row}-m`} checked={value[row] === c} onChange={() => set(row, c)} className="sr-only" />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </>
  );
}

function FileUpload({
  field,
  slug,
  value,
  onChange,
  onUploading,
}: {
  field: Field;
  slug: string;
  value: UploadedFile[];
  onChange: (v: unknown) => void;
  onUploading: (delta: number) => void;
}) {
  const [pending, setPending] = useState<{ name: string; pct: number; error?: string }[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;

  async function handle(files: File[]) {
    const room = 10 - latest.current.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      if (file.size > 15 * 1024 * 1024) {
        setPending((p) => [...p, { name: file.name, pct: 0, error: "Larger than 15 MB" }]);
        continue;
      }
      setPending((p) => [...p, { name: file.name, pct: 0 }]);
      onUploading(1);
      try {
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
        const blob = await upload(`uploads/${slug}/${field.key}/${safe}`, file, {
          access: "public",
          handleUploadUrl: "/api/public/upload",
          clientPayload: JSON.stringify({ slug }),
          onUploadProgress: ({ percentage }) => setPending((p) => p.map((x) => (x.name === file.name ? { ...x, pct: percentage } : x))),
        });
        onChange([...latest.current, { url: blob.url, name: file.name, size: file.size, contentType: file.type || blob.contentType }]);
        setPending((p) => p.filter((x) => x.name !== file.name));
      } catch (e) {
        setPending((p) => p.map((x) => (x.name === file.name ? { ...x, error: e instanceof Error ? e.message : "Upload failed" } : x)));
      } finally {
        onUploading(-1);
      }
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-200",
          drag ? "border-ring bg-primary-soft" : "border-border-strong bg-surface-2/50",
        )}
      >
        <UploadCloud className="size-7 text-fg-subtle" aria-hidden />
        <p className="mt-2 text-sm text-fg">
          Drag files here or{" "}
          <button type="button" onClick={() => input.current?.click()} className="font-medium text-primary underline underline-offset-2">
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-fg-muted">PDF, images or Office documents · up to 15 MB each</p>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            handle([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      {(value.length > 0 || pending.length > 0) && (
        <ul className="mt-3 space-y-2">
          {value.map((f) => (
            <li key={f.url} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-fg-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-fg">{f.name}</span>
              <span className="tabular shrink-0 text-xs text-fg-subtle">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.url !== f.url))}
                aria-label={`Remove ${f.name}`}
                className="grid size-8 place-items-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.name} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
              {p.error ? <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden /> : <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-fg">{p.name}</span>
              {p.error ? (
                <>
                  <span className="shrink-0 text-xs text-danger">{p.error}</span>
                  <button
                    type="button"
                    onClick={() => setPending((x) => x.filter((y) => y.name !== p.name))}
                    aria-label="Dismiss"
                    className="grid size-8 place-items-center rounded-lg text-fg-subtle hover:bg-surface-2"
                  >
                    <X className="size-4" />
                  </button>
                </>
              ) : (
                <span className="tabular shrink-0 text-xs text-fg-muted">{Math.round(p.pct)}%</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
