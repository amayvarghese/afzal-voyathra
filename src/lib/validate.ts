import type { AnswerValue, Field, FormDoc, UploadedFile } from "./types";
import { EMAIL_RE } from "./utils";
import { answerableFields } from "./schema";

export type FieldErrors = Record<string, string>;

const isEmpty = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

function isBlobUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Validates and coerces a single answer. Used by both the browser (for inline
 * errors) and the server (as the source of truth). Returns [value, error].
 */
export function checkField(field: Field, raw: unknown): [AnswerValue, string | null] {
  if (isEmpty(raw)) {
    if (field.type === "matrix" && field.required) return [null, "Please answer every row."];
    return [null, field.required ? "This question is required." : null];
  }
  switch (field.type) {
    case "short_text":
    case "long_text": {
      const s = String(raw).trim();
      const limit = field.type === "short_text" ? 1000 : 20000;
      if (s.length > limit) return [null, `Please keep this under ${limit} characters.`];
      return [s, null];
    }
    case "email": {
      const s = String(raw).trim().toLowerCase();
      return EMAIL_RE.test(s) && s.length <= 254 ? [s, null] : [null, "Enter a valid email address, like name@example.com."];
    }
    case "phone": {
      const s = String(raw).trim();
      const digits = s.replace(/\D/g, "");
      return /^[+()\d\s.-]{6,24}$/.test(s) && digits.length >= 6 ? [s, null] : [null, "Enter a valid phone number."];
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
      if (!Number.isFinite(n)) return [null, "Enter a number."];
      if (field.min !== undefined && n < field.min) return [null, `Must be at least ${field.min}.`];
      if (field.max !== undefined && n > field.max) return [null, `Must be at most ${field.max}.`];
      return [n, null];
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? [String(raw), null] : [null, "Enter a valid date."];
    case "time":
      return /^\d{2}:\d{2}$/.test(String(raw)) ? [String(raw), null] : [null, "Enter a valid time."];
    case "single_choice":
    case "dropdown": {
      const s = String(raw).trim();
      if (field.options?.includes(s)) return [s, null];
      if (field.allowOther && s.startsWith("Other: ") && s.length > 7) return [s.slice(0, 1000), null];
      return [null, "Choose one of the options."];
    }
    case "multi_choice": {
      if (!Array.isArray(raw)) return [null, "Choose at least one option."];
      const vals = raw.map((v) => String(v).trim()).filter(Boolean);
      const valid = vals.every((v) => field.options?.includes(v) || (field.allowOther && v.startsWith("Other: ") && v.length > 7));
      if (!valid) return [null, "One of the selected options is not valid."];
      if (field.min && vals.length < field.min) return [null, `Select at least ${field.min}.`];
      if (field.max && vals.length > field.max) return [null, `Select no more than ${field.max}.`];
      return [vals, null];
    }
    case "yes_no": {
      if (raw === true || raw === "Yes") return ["Yes", null];
      if (raw === false || raw === "No") return ["No", null];
      return [null, "Choose Yes or No."];
    }
    case "rating":
    case "scale": {
      const n = Number(raw);
      const min = field.type === "rating" ? 1 : field.min ?? 1;
      const max = field.max ?? 5;
      return Number.isInteger(n) && n >= min && n <= max ? [n, null] : [null, "Choose a value."];
    }
    case "matrix": {
      if (typeof raw !== "object" || Array.isArray(raw)) return [null, "Invalid answer."];
      const out: Record<string, string> = {};
      for (const row of field.rows ?? []) {
        const v = (raw as Record<string, unknown>)[row];
        if (v === undefined || v === "") continue;
        if (!field.options?.includes(String(v))) return [null, "Invalid selection."];
        out[row] = String(v);
      }
      if (field.required && Object.keys(out).length < (field.rows?.length ?? 0)) return [null, "Please answer every row."];
      return [Object.keys(out).length ? out : null, null];
    }
    case "file": {
      if (!Array.isArray(raw)) return [null, "Invalid upload."];
      const files: UploadedFile[] = [];
      for (const f of raw.slice(0, 10)) {
        if (!f || typeof f !== "object" || !isBlobUrl(String((f as UploadedFile).url))) return [null, "Invalid upload."];
        const { url, name, size, contentType } = f as UploadedFile;
        files.push({ url: String(url), name: String(name).slice(0, 255), size: Number(size) || 0, contentType: String(contentType).slice(0, 100) });
      }
      return [files, null];
    }
    default:
      return [null, null];
  }
}

export function validateSubmission(form: Pick<FormDoc, "sections">, data: Record<string, unknown>) {
  const errors: FieldErrors = {};
  const answers: Record<string, AnswerValue> = {};
  for (const field of answerableFields(form.sections)) {
    const [value, error] = checkField(field, data[field.key]);
    if (error) errors[field.key] = error;
    else if (value !== null) answers[field.key] = value;
  }
  return { answers, errors, ok: Object.keys(errors).length === 0 };
}
