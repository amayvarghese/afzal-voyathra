export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "date",
  "time",
  "single_choice",
  "multi_choice",
  "dropdown",
  "yes_no",
  "rating",
  "scale",
  "matrix",
  "file",
  "statement",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const CHOICE_TYPES: FieldType[] = ["single_choice", "multi_choice", "dropdown", "matrix"];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  time: "Time",
  single_choice: "Multiple choice",
  multi_choice: "Checkboxes",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  rating: "Rating",
  scale: "Linear scale",
  matrix: "Grid",
  file: "File upload",
  statement: "Text block",
};

export interface Field {
  id: string;
  /** Stable column name used in the MongoDB response collection. */
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  /** Choices for single/multi/dropdown, columns for matrix. */
  options?: string[];
  /** Rows for matrix. */
  rows?: string[];
  allowOther?: boolean;
  /** Scale bounds / rating max / number bounds. */
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  /** Follow-up logic: only show (and require) this question when the condition matches. */
  showIf?: Condition;
}

export type ConditionOp = "equals" | "not_equals" | "includes" | "answered";

export interface Condition {
  /** id of an earlier question */
  fieldId: string;
  op: ConditionOp;
  value?: string;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
}

export interface FormSettings {
  isOpen: boolean;
  notifyEmails: string[];
  confirmationEnabled: boolean;
  /** Field id of the email field whose value receives the confirmation copy. */
  confirmationFieldId: string | null;
  successTitle: string;
  successMessage: string;
  submitLabel: string;
  /** Show one section per step instead of a single long page. */
  paginate: boolean;
}

export interface FormDoc {
  _id: string;
  slug: string;
  title: string;
  description: string;
  sections: Section[];
  settings: FormSettings;
  collectionName: string;
  version: number;
  source?: { fileName: string; model: string; importedAt: string } | null;
  responseCount: number;
  lastResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the public form page receives — no admin-only settings. */
export interface PublicForm {
  slug: string;
  title: string;
  description: string;
  sections: Section[];
  version: number;
  isOpen: boolean;
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  paginate: boolean;
  uploadsEnabled: boolean;
}

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  contentType: string;
}

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string>
  | UploadedFile[]
  | null;

export interface ResponseRow {
  _id: string;
  submittedAt: string;
  formVersion: number;
  answers: Record<string, AnswerValue>;
  email?: { notified: boolean; confirmed: boolean; error?: string };
}

export const DEFAULT_SETTINGS: FormSettings = {
  isOpen: true,
  notifyEmails: [],
  confirmationEnabled: false,
  confirmationFieldId: null,
  successTitle: "Thank you",
  successMessage: "Your responses have been received. We'll be in touch shortly.",
  submitLabel: "Submit",
  paginate: true,
};
