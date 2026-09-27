"use client";

import { forwardRef, useId } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface text-fg border border-border hover:border-border-strong hover:bg-surface-2 shadow-sm",
  outline: "border border-border-strong text-fg hover:bg-surface-2",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90 shadow-sm",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-[10px]",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-[10px] justify-center",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,opacity,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ── Inputs ──────────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-[10px] border border-border bg-surface px-3.5 text-[15px] text-fg shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-border-strong focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/15 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        inputClass,
        "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238a8f99%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

/** Labelled wrapper with helper and error text wired up for screen readers. */
export function FormRow({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        )}
      </label>
      {children({ id, "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined, "aria-invalid": !!error || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Switch ──────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-50")}>
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="block text-sm font-medium text-fg">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-[13px] text-fg-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out-soft",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

// ── Misc ────────────────────────────────────────────────────────────────────

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "success" | "accent" | "danger" | "primary";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-fg-muted",
    success: "bg-success-soft text-success",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-soft text-danger",
    primary: "bg-primary-soft text-primary",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-surface shadow-sm", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] font-medium text-fg-muted">
      {children}
    </kbd>
  );
}
