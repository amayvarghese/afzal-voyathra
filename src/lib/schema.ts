import { z } from "zod";
import { FIELD_TYPES, type Field, type FieldType, type Section } from "./types";
import { keyify, shortId } from "./utils";

const str = (max: number) => z.string().trim().max(max);

/** Lenient shape accepted from the editor or from the AI parser. */
export const fieldInput = z.object({
  id: z.string().max(40).optional(),
  key: z.string().max(64).optional(),
  type: z.string(),
  label: str(2000).default(""),
  description: str(4000).optional().nullable(),
  placeholder: str(300).optional().nullable(),
  required: z.boolean().optional().nullable(),
  options: z.array(z.union([z.string(), z.number()])).max(200).optional().nullable(),
  rows: z.array(z.union([z.string(), z.number()])).max(100).optional().nullable(),
  allowOther: z.boolean().optional().nullable(),
  min: z.number().optional().nullable(),
  max: z.number().optional().nullable(),
  minLabel: str(100).optional().nullable(),
  maxLabel: str(100).optional().nullable(),
});

export const sectionInput = z.object({
  id: z.string().max(40).optional(),
  title: str(500).default(""),
  description: str(4000).optional().nullable(),
  fields: z.array(fieldInput).max(500).default([]),
});

export const formContentInput = z.object({
  title: str(300).default("Untitled questionnaire"),
  description: str(5000).default(""),
  sections: z.array(sectionInput).max(100).default([]),
});

export type FormContentInput = z.infer<typeof formContentInput>;

const TYPE_ALIASES: Record<string, FieldType> = {
  text: "short_text",
  short: "short_text",
  shorttext: "short_text",
  paragraph: "long_text",
  textarea: "long_text",
  longtext: "long_text",
  radio: "single_choice",
  choice: "single_choice",
  singlechoice: "single_choice",
  multiplechoice: "single_choice",
  checkbox: "multi_choice",
  checkboxes: "multi_choice",
  multichoice: "multi_choice",
  multiselect: "multi_choice",
  select: "dropdown",
  boolean: "yes_no",
  yesno: "yes_no",
  stars: "rating",
  likert: "scale",
  linearscale: "scale",
  grid: "matrix",
  table: "matrix",
  upload: "file",
  attachment: "file",
  info: "statement",
  instructions: "statement",
  heading: "statement",
  tel: "phone",
  telephone: "phone",
  datetime: "date",
};

function normalizeType(t: string): FieldType {
  const raw = t.trim().toLowerCase();
  if ((FIELD_TYPES as readonly string[]).includes(raw)) return raw as FieldType;
  return TYPE_ALIASES[raw.replace(/[^a-z]/g, "")] ?? "short_text";
}

function cleanList(list: (string | number)[] | null | undefined): string[] {
  if (!list) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const s = String(item).replace(/^[\s☐☑☒□■▢○●◯•\-–—*]+/, "").trim().slice(0, 500);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

const opt = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined || v === "" ? undefined : v);

/**
 * Turns loosely-typed form content into a clean, fully-specified structure:
 * every section/field gets an id, every field a unique DB-safe key, and
 * type-specific defaults are filled in. Existing keys are preserved (by field
 * id) so editing a form never re-maps stored responses.
 */
export function normalizeContent(input: FormContentInput, previous?: Section[]) {
  const prevKeys = new Map<string, string>();
  previous?.forEach((s) => s.fields.forEach((f) => prevKeys.set(f.id, f.key)));

  const usedKeys = new Set<string>();
  const uniqueKey = (base: string) => {
    let k = base.startsWith("_") ? `f${base}` : base;
    k = k.replace(/[.$]/g, "_");
    let i = 2;
    const root = k;
    while (usedKeys.has(k)) k = `${root}_${i++}`;
    usedKeys.add(k);
    return k;
  };

  const sections: Section[] = input.sections.map((s, si) => {
    const fields: Field[] = s.fields.map((f) => {
      const type = normalizeType(f.type);
      const id = f.id && /^[\w-]+$/.test(f.id) ? f.id : shortId();
      const label = f.label || (type === "statement" ? "" : "Untitled question");
      const requestedKey = f.key?.trim() ? keyify(f.key) : prevKeys.get(id) ?? keyify(label || type);
      const field: Field = {
        id,
        key: type === "statement" ? `_statement_${id}` : uniqueKey(requestedKey),
        type,
        label,
        required: type === "statement" ? false : !!f.required,
      };
      const description = opt(f.description);
      if (description) field.description = description;
      const placeholder = opt(f.placeholder);
      if (placeholder && ["short_text", "long_text", "email", "phone", "number"].includes(type)) field.placeholder = placeholder;

      if (type === "single_choice" || type === "multi_choice" || type === "dropdown") {
        field.options = cleanList(f.options);
        if (field.options.length === 0) field.options = ["Option 1", "Option 2"];
        if (f.allowOther && type !== "dropdown") field.allowOther = true;
        if (type === "multi_choice") {
          if (typeof f.min === "number") field.min = Math.max(0, Math.round(f.min));
          if (typeof f.max === "number") field.max = Math.max(1, Math.round(f.max));
        }
      }
      if (type === "matrix") {
        field.rows = cleanList(f.rows);
        field.options = cleanList(f.options);
        if (field.rows.length === 0) field.rows = ["Row 1", "Row 2"];
        if (field.options.length === 0) field.options = ["Poor", "Fair", "Good", "Excellent"];
      }
      if (type === "rating") {
        field.max = Math.min(10, Math.max(3, Math.round(f.max ?? 5)));
      }
      if (type === "scale") {
        const min = Math.min(1, Math.max(0, Math.round(f.min ?? 1)));
        field.min = min;
        field.max = Math.min(10, Math.max(min + 2, Math.round(f.max ?? 5)));
        const minLabel = opt(f.minLabel);
        const maxLabel = opt(f.maxLabel);
        if (minLabel) field.minLabel = minLabel;
        if (maxLabel) field.maxLabel = maxLabel;
      }
      if (type === "number") {
        if (typeof f.min === "number") field.min = f.min;
        if (typeof f.max === "number") field.max = f.max;
      }
      return field;
    });
    const section: Section = {
      id: s.id && /^[\w-]+$/.test(s.id) ? s.id : shortId(),
      title: s.title || (input.sections.length > 1 ? `Section ${si + 1}` : ""),
      fields,
    };
    const description = opt(s.description);
    if (description) section.description = description;
    return section;
  });

  if (sections.length === 0) sections.push({ id: shortId(), title: "", fields: [] });

  return {
    title: input.title || "Untitled questionnaire",
    description: input.description,
    sections,
  };
}

export function allFields(sections: Section[]): Field[] {
  return sections.flatMap((s) => s.fields);
}

export function answerableFields(sections: Section[]): Field[] {
  return allFields(sections).filter((f) => f.type !== "statement");
}
