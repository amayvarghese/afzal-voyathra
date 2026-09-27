import type { AnswerValue, Field, UploadedFile } from "./types";

export function isFileList(v: unknown): v is UploadedFile[] {
  return Array.isArray(v) && v.every((x) => x && typeof x === "object" && "url" in x);
}

/** Human-readable answer text, used by emails, CSV export and the dashboard. */
export function formatAnswer(field: Pick<Field, "type" | "max"> | undefined, value: AnswerValue | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (isFileList(value)) return value.map((f) => `${f.name} (${f.url})`).join("\n");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([row, col]) => `${row}: ${col}`)
      .join("\n");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field?.type === "rating") return `${value} / ${field.max ?? 5}`;
  return String(value);
}
