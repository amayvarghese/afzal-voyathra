import type { Condition, ConditionOp, Field, FieldType, Section } from "./types";

/** Question types that can trigger follow-ups, and the operators each supports. */
export const CONTROLLER_OPS: Partial<Record<FieldType, ConditionOp[]>> = {
  yes_no: ["equals", "not_equals"],
  single_choice: ["equals", "not_equals"],
  dropdown: ["equals", "not_equals"],
  multi_choice: ["includes"],
  rating: ["equals", "not_equals"],
  scale: ["equals", "not_equals"],
  short_text: ["answered"],
  long_text: ["answered"],
  email: ["answered"],
  phone: ["answered"],
  number: ["answered"],
  date: ["answered"],
  time: ["answered"],
  file: ["answered"],
};

export const OP_LABELS: Record<ConditionOp, string> = {
  equals: "is",
  not_equals: "is not",
  includes: "includes",
  answered: "is answered",
};

/** The values a controller question can be compared against. */
export function conditionValues(field: Field): string[] {
  switch (field.type) {
    case "yes_no":
      return ["Yes", "No"];
    case "single_choice":
    case "multi_choice":
    case "dropdown":
      return [...(field.options ?? []), ...(field.allowOther ? ["Other"] : [])];
    case "rating":
      return Array.from({ length: field.max ?? 5 }, (_, i) => String(i + 1));
    case "scale": {
      const min = field.min ?? 1;
      return Array.from({ length: (field.max ?? 5) - min + 1 }, (_, i) => String(min + i));
    }
    default:
      return [];
  }
}

function isEmpty(v: unknown) {
  return (
    v === undefined ||
    v === null ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );
}

function matchesValue(answer: unknown, expected: string) {
  const a = String(answer);
  // "Other: …" answers match the "Other" choice.
  return a === expected || (expected === "Other" && a.startsWith("Other: "));
}

export function conditionMet(cond: Condition, answer: unknown): boolean {
  switch (cond.op) {
    case "answered":
      return !isEmpty(answer);
    case "includes":
      return Array.isArray(answer) && answer.some((a) => matchesValue(a, cond.value ?? ""));
    case "equals":
      return !isEmpty(answer) && matchesValue(answer, cond.value ?? "");
    case "not_equals":
      // Only reveal once the trigger question has actually been answered.
      return !isEmpty(answer) && !matchesValue(answer, cond.value ?? "");
  }
}

/**
 * Ids of questions currently visible, given the answers so far. A follow-up
 * is visible only if its trigger question is itself visible and its condition
 * matches, so chains of follow-ups collapse correctly.
 */
export function visibleFieldIds(sections: Section[], answers: Record<string, unknown>): Set<string> {
  const all = sections.flatMap((s) => s.fields);
  const byId = new Map(all.map((f) => [f.id, f]));
  const visible = new Set<string>();
  for (const f of all) {
    if (!f.showIf) {
      visible.add(f.id);
      continue;
    }
    const ctrl = byId.get(f.showIf.fieldId);
    if (ctrl && visible.has(ctrl.id) && conditionMet(f.showIf, answers[ctrl.key])) visible.add(f.id);
  }
  return visible;
}

/** Human description, e.g. "Q3 is Yes". */
export function describeCondition(cond: Condition, controller: Field | undefined, number?: number): string {
  const q = controller ? (number ? `Q${number}` : `“${controller.label}”`) : "a removed question";
  return cond.op === "answered" ? `${q} is answered` : `${q} ${OP_LABELS[cond.op]} ${cond.value ?? ""}`.trim();
}
