"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Database,
  GripVertical,
  Plus,
  Trash2,
  X,
  LayoutList,
  Check,
} from "lucide-react";
import { Badge, Button, Input, Kbd, Select, Switch, inputClass } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { FIELD_ICONS } from "@/components/field-icons";
import { FIELD_TYPES, FIELD_TYPE_LABELS, type Field, type FieldType, type FormDoc, type Section } from "@/lib/types";
import { cn, keyify, shortId } from "@/lib/utils";

type Content = { title: string; description: string; sections: Section[] };

const PICKER_GROUPS: { label: string; types: FieldType[] }[] = [
  { label: "Text", types: ["short_text", "long_text", "email", "phone", "number"] },
  { label: "Choice", types: ["single_choice", "multi_choice", "dropdown", "yes_no"] },
  { label: "Rating", types: ["rating", "scale", "matrix"] },
  { label: "Other", types: ["date", "time", "file", "statement"] },
];

function newField(type: FieldType): Field {
  return withTypeDefaults({ id: shortId(), key: "", type, label: "", required: false }, type);
}

function withTypeDefaults(field: Field, type: FieldType): Field {
  const f: Field = { ...field, type };
  if (["single_choice", "multi_choice", "dropdown"].includes(type) && !f.options?.length) f.options = ["Option 1", "Option 2"];
  if (type === "matrix") {
    if (!f.rows?.length) f.rows = ["Row 1", "Row 2"];
    if (!f.options?.length || ["Option 1"].includes(f.options[0])) f.options = ["Poor", "Fair", "Good", "Excellent"];
  }
  if (type === "rating") f.max = f.max && f.max <= 10 ? f.max : 5;
  if (type === "scale") {
    f.min = f.min === 0 ? 0 : 1;
    f.max = f.max && f.max <= 10 ? f.max : 5;
  }
  if (type === "statement") f.required = false;
  return f;
}

export function FormBuilder({ form }: { form: FormDoc }) {
  const router = useRouter();
  const toast = useToast();
  const initial: Content = useMemo(
    () => ({ title: form.title, description: form.description, sections: form.sections }),
    [form],
  );
  const [content, setContent] = useState<Content>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const dirty = JSON.stringify(content) !== saved;

  const save = useCallback(async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/forms/${form._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return toast(j.error ?? "Save failed", "error");
    const next: Content = { title: j.form.title, description: j.form.description, sections: j.form.sections };
    setContent(next);
    setSaved(JSON.stringify(next));
    toast(`Saved · version ${j.form.version} is live`);
    router.refresh();
  }, [content, form._id, router, toast]);

  // ⌘S / Ctrl+S to save; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !saving) save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty, saving, save]);

  const updateSection = (sid: string, patch: Partial<Section>) =>
    setContent((c) => ({ ...c, sections: c.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }));

  const updateField = (fid: string, patch: Partial<Field>) =>
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })),
    }));

  const addField = (sid: string, type: FieldType, afterId?: string) => {
    const field = newField(type);
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sid) return s;
        const idx = afterId ? s.fields.findIndex((f) => f.id === afterId) + 1 : s.fields.length;
        const fields = [...s.fields];
        fields.splice(idx, 0, field);
        return { ...s, fields };
      }),
    }));
    setActive(field.id);
  };

  const removeField = (fid: string) => {
    setContent((c) => ({ ...c, sections: c.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== fid) })) }));
    setActive(null);
  };

  const duplicateField = (sid: string, field: Field) => {
    const copy = { ...structuredClone(field), id: shortId(), key: "" };
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sid) return s;
        const fields = [...s.fields];
        fields.splice(fields.findIndex((f) => f.id === field.id) + 1, 0, copy);
        return { ...s, fields };
      }),
    }));
    setActive(copy.id);
  };

  const moveFieldToSection = (fid: string, targetSid: string) =>
    setContent((c) => {
      const field = c.sections.flatMap((s) => s.fields).find((f) => f.id === fid);
      if (!field) return c;
      return {
        ...c,
        sections: c.sections.map((s) => {
          const fields = s.fields.filter((f) => f.id !== fid);
          return s.id === targetSid ? { ...s, fields: [...fields, field] } : { ...s, fields };
        }),
      };
    });

  const moveSection = (sid: string, dir: -1 | 1) =>
    setContent((c) => {
      const i = c.sections.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (j < 0 || j >= c.sections.length) return c;
      return { ...c, sections: arrayMove(c.sections, i, j) };
    });

  const addSection = () => {
    const s: Section = { id: shortId(), title: `Section ${content.sections.length + 1}`, fields: [] };
    setContent((c) => ({ ...c, sections: [...c.sections, s] }));
  };

  const removeSection = (sid: string) => {
    setContent((c) => {
      const remaining = c.sections.filter((s) => s.id !== sid);
      return { ...c, sections: remaining.length ? remaining : [{ id: shortId(), title: "", fields: [] }] };
    });
    setSectionToDelete(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (sid: string) => (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s) => {
        if (s.id !== sid) return s;
        const from = s.fields.findIndex((f) => f.id === a.id);
        const to = s.fields.findIndex((f) => f.id === over.id);
        return { ...s, fields: arrayMove(s.fields, from, to) };
      }),
    }));
  };

  let questionNo = 0;
  const hasResponses = form.responseCount > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Save bar */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-transparent bg-bg/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:border-border sm:bg-surface/90 sm:shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm" aria-live="polite">
            {dirty ? (
              <>
                <span className="size-2 rounded-full bg-accent" aria-hidden />
                <span className="text-fg">Unsaved changes</span>
              </>
            ) : (
              <>
                <Check className="size-4 text-success" aria-hidden />
                <span className="text-fg-muted">All changes saved</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-fg-subtle sm:inline">
              <Kbd>⌘</Kbd> <Kbd>S</Kbd>
            </span>
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setContent(JSON.parse(saved))}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
              Save & publish
            </Button>
          </div>
        </div>
      </div>

      {/* Form header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="h-1.5 bg-primary" aria-hidden />
        <div className="space-y-2 p-6 sm:p-8">
          <label htmlFor="form-title" className="sr-only">
            Questionnaire title
          </label>
          <AutoTextarea
            id="form-title"
            value={content.title}
            onChange={(v) => setContent((c) => ({ ...c, title: v.replace(/\n/g, " ") }))}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Questionnaire title"
            className="font-serif text-4xl leading-tight tracking-tight text-fg"
          />
          <label htmlFor="form-desc" className="sr-only">
            Introduction
          </label>
          <AutoTextarea
            id="form-desc"
            value={content.description}
            onChange={(v) => setContent((c) => ({ ...c, description: v }))}
            placeholder="Add an introduction or instructions for your customers (optional)"
            className="text-[15px] leading-relaxed text-fg-muted"
          />
        </div>
      </div>

      {hasResponses && (
        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-accent">
          This questionnaire already has responses. Edits apply to new submissions; existing answers stay in the database and remain in your CSV export.
        </p>
      )}

      {content.sections.map((section, si) => (
        <section key={section.id} className="mt-10" aria-label={section.title || `Section ${si + 1}`}>
          <div className="group mb-3 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {content.sections.length > 1 && (
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
                  Section {si + 1} of {content.sections.length}
                </p>
              )}
              <AutoTextarea
                value={section.title}
                onChange={(v) => updateSection(section.id, { title: v.replace(/\n/g, " ") })}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder={content.sections.length > 1 ? "Section title" : "Section title (optional)"}
                aria-label={`Section ${si + 1} title`}
                className="mt-1 font-serif text-[28px] leading-tight text-fg"
              />
              <AutoTextarea
                value={section.description ?? ""}
                onChange={(v) => updateSection(section.id, { description: v })}
                placeholder="Section description (optional)"
                aria-label={`Section ${si + 1} description`}
                className="text-sm text-fg-muted"
              />
            </div>
            {content.sections.length > 1 && (
              <div className="flex shrink-0 gap-0.5 pt-5">
                <IconBtn label="Move section up" onClick={() => moveSection(section.id, -1)} disabled={si === 0}>
                  <ArrowUp className="size-4" />
                </IconBtn>
                <IconBtn label="Move section down" onClick={() => moveSection(section.id, 1)} disabled={si === content.sections.length - 1}>
                  <ArrowDown className="size-4" />
                </IconBtn>
                <IconBtn label="Delete section" onClick={() => setSectionToDelete(section.id)} danger>
                  <Trash2 className="size-4" />
                </IconBtn>
              </div>
            )}
          </div>

          <DndContext id={`dnd-${section.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(section.id)}>
            <SortableContext items={section.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-3">
                {section.fields.map((field) => {
                  const number = field.type === "statement" ? null : ++questionNo;
                  return (
                    <FieldCard
                      key={field.id}
                      field={field}
                      number={number}
                      active={active === field.id}
                      sections={content.sections}
                      sectionId={section.id}
                      onActivate={() => setActive(field.id)}
                      onClose={() => setActive(null)}
                      onChange={(patch) => updateField(field.id, patch)}
                      onRemove={() => removeField(field.id)}
                      onDuplicate={() => duplicateField(section.id, field)}
                      onMove={(target) => moveFieldToSection(field.id, target)}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>

          {section.fields.length === 0 && (
            <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">
              No questions in this section yet.
            </p>
          )}

          <AddFieldMenu onPick={(t) => addField(section.id, t)} />
        </section>
      ))}

      <div className="mt-12 flex justify-center border-t border-border pt-8">
        <Button variant="secondary" onClick={addSection}>
          <LayoutList className="size-4" aria-hidden /> Add section
        </Button>
      </div>

      <ConfirmDialog
        open={!!sectionToDelete}
        onClose={() => setSectionToDelete(null)}
        onConfirm={() => sectionToDelete && removeSection(sectionToDelete)}
        title="Delete section?"
        description="The section and all of its questions will be removed when you save."
      />
    </div>
  );
}

// ── Field card ───────────────────────────────────────────────────────────────

function FieldCard({
  field,
  number,
  active,
  sections,
  sectionId,
  onActivate,
  onClose,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  field: Field;
  number: number | null;
  active: boolean;
  sections: Section[];
  sectionId: string;
  onActivate: () => void;
  onClose: () => void;
  onChange: (patch: Partial<Field>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (sectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const Icon = FIELD_ICONS[field.type];
  const labelRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (active && !field.label) labelRef.current?.focus();
  }, [active, field.label]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative rounded-2xl border bg-surface transition-[border-color,box-shadow] duration-200",
        active ? "border-ring/50 shadow-md ring-4 ring-ring/10" : "border-border shadow-sm hover:border-border-strong",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <div className="flex items-start gap-1 p-2 pr-3">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder: ${field.label || "untitled question"}`}
          className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        {!active ? (
          <button onClick={onActivate} className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg py-2.5 text-left">
            {number !== null && <span className="tabular mt-px w-6 shrink-0 text-sm text-fg-subtle">{number}.</span>}
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[15px] leading-snug", field.label ? "text-fg" : "italic text-fg-subtle", field.type === "statement" && "text-fg-muted")}>
                {field.label || "Untitled question"}
                {field.required && <span className="ml-1 text-danger" aria-label="required">*</span>}
              </span>
              {(field.options?.length ?? 0) > 0 && field.type !== "matrix" && (
                <span className="mt-1 block truncate text-[13px] text-fg-subtle">{field.options!.join(" · ")}</span>
              )}
            </span>
            <Badge className="mt-0.5 shrink-0">
              <Icon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{FIELD_TYPE_LABELS[field.type]}</span>
            </Badge>
          </button>
        ) : (
          <div className="min-w-0 flex-1 space-y-4 py-2">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="sr-only" htmlFor={`label-${field.id}`}>
                  {field.type === "statement" ? "Text" : "Question"}
                </label>
                <AutoTextarea
                  ref={labelRef}
                  id={`label-${field.id}`}
                  value={field.label}
                  onChange={(v) => onChange({ label: v })}
                  placeholder={field.type === "statement" ? "Instructions or information to show" : "Question"}
                  className={cn(inputClass, "min-h-11 py-2.5 text-[15px] font-medium")}
                />
              </div>
              <div className="sm:w-52">
                <label className="sr-only" htmlFor={`type-${field.id}`}>
                  Question type
                </label>
                <Select id={`type-${field.id}`} value={field.type} onChange={(e) => onChange(withTypeDefaults(field, e.target.value as FieldType))}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {field.type !== "statement" && (
              <Input
                value={field.description ?? ""}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Helper text (optional)"
                aria-label="Helper text"
                className="h-10 text-sm"
              />
            )}

            <TypeEditor field={field} onChange={onChange} />

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1">
                <IconBtn label="Duplicate question" onClick={onDuplicate}>
                  <Copy className="size-4" />
                </IconBtn>
                <IconBtn label="Delete question" onClick={onRemove} danger>
                  <Trash2 className="size-4" />
                </IconBtn>
                {sections.length > 1 && (
                  <Select
                    aria-label="Move to section"
                    value={sectionId}
                    onChange={(e) => onMove(e.target.value)}
                    className="ml-1 h-9 w-auto max-w-48 text-[13px]"
                  >
                    {sections.map((s, i) => (
                      <option key={s.id} value={s.id}>
                        {s.id === sectionId ? "Move to…" : `→ ${s.title || `Section ${i + 1}`}`}
                      </option>
                    ))}
                  </Select>
                )}
                {field.type !== "statement" && (
                  <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-fg-subtle" title="Column name in MongoDB">
                    <Database className="size-3.5" aria-hidden />
                    <code>{field.key || keyify(field.label || field.type)}</code>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {field.type !== "statement" && (
                  <label className="flex items-center gap-2 text-sm text-fg">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => onChange({ required: e.target.checked })}
                      className="size-4 rounded accent-[var(--primary)]"
                    />
                    Required
                  </label>
                )}
                <Button size="sm" variant="secondary" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function TypeEditor({ field, onChange }: { field: Field; onChange: (patch: Partial<Field>) => void }) {
  switch (field.type) {
    case "single_choice":
    case "multi_choice":
    case "dropdown":
      return (
        <div className="space-y-3">
          <ListEditor
            items={field.options ?? []}
            onChange={(options) => onChange({ options })}
            marker={field.type === "multi_choice" ? "square" : field.type === "dropdown" ? "number" : "circle"}
            addLabel="Add option"
          />
          {field.type !== "dropdown" && (
            <Switch checked={!!field.allowOther} onChange={(v) => onChange({ allowOther: v })} label='Include "Other" with a text box' />
          )}
        </div>
      );
    case "matrix":
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Rows</p>
            <ListEditor items={field.rows ?? []} onChange={(rows) => onChange({ rows })} marker="number" addLabel="Add row" />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">Columns</p>
            <ListEditor items={field.options ?? []} onChange={(options) => onChange({ options })} marker="circle" addLabel="Add column" />
          </div>
        </div>
      );
    case "scale":
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[13px] text-fg-muted">
            From
            <Select className="mt-1" value={field.min ?? 1} onChange={(e) => onChange({ min: Number(e.target.value) })}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </Select>
          </label>
          <label className="text-[13px] text-fg-muted">
            To
            <Select className="mt-1" value={field.max ?? 5} onChange={(e) => onChange({ max: Number(e.target.value) })}>
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <Input placeholder="Low label, e.g. Not likely" aria-label="Low end label" value={field.minLabel ?? ""} onChange={(e) => onChange({ minLabel: e.target.value })} className="h-10 text-sm" />
          <Input placeholder="High label, e.g. Very likely" aria-label="High end label" value={field.maxLabel ?? ""} onChange={(e) => onChange({ maxLabel: e.target.value })} className="h-10 text-sm" />
        </div>
      );
    case "rating":
      return (
        <label className="flex items-center gap-3 text-[13px] text-fg-muted">
          Number of stars
          <Select className="h-10 w-24" value={field.max ?? 5} onChange={(e) => onChange({ max: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
      );
    case "number":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Minimum (optional)" aria-label="Minimum" value={field.min ?? ""} onChange={(e) => onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-10 text-sm" />
          <Input type="number" placeholder="Maximum (optional)" aria-label="Maximum" value={field.max ?? ""} onChange={(e) => onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })} className="h-10 text-sm" />
        </div>
      );
    case "short_text":
    case "long_text":
    case "email":
    case "phone":
      return (
        <Input placeholder="Placeholder text (optional)" aria-label="Placeholder" value={field.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} className="h-10 text-sm" />
      );
    case "file":
      return <p className="text-[13px] text-fg-muted">Customers can attach up to 10 files (PDF, images, Office documents, max 15 MB each).</p>;
    default:
      return null;
  }
}

function ListEditor({
  items,
  onChange,
  marker,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  marker: "circle" | "square" | "number";
  addLabel: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIdx = useRef<number | null>(null);
  const setFocusIdx = (i: number) => {
    focusIdx.current = i;
  };

  // Focus a newly added/remaining row after the parent re-renders with new items.
  useEffect(() => {
    if (focusIdx.current !== null) {
      refs.current[focusIdx.current]?.focus();
      focusIdx.current = null;
    }
  });

  const add = (at = items.length) => {
    const next = [...items];
    next.splice(at, 0, "");
    onChange(next);
    setFocusIdx(at);
  };

  return (
    <div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="group flex items-center gap-2">
            <span className="grid w-6 shrink-0 place-items-center text-fg-subtle" aria-hidden>
              {marker === "circle" && <span className="size-4 rounded-full border-2 border-border-strong" />}
              {marker === "square" && <span className="size-4 rounded border-2 border-border-strong" />}
              {marker === "number" && <span className="tabular text-xs">{i + 1}</span>}
            </span>
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={item}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(i + 1);
                } else if (e.key === "Backspace" && item === "" && items.length > 1) {
                  e.preventDefault();
                  onChange(items.filter((_, j) => j !== i));
                  setFocusIdx(Math.max(0, i - 1));
                }
              }}
              aria-label={`Item ${i + 1}`}
              className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2.5 text-sm text-fg hover:border-border focus:border-ring focus:bg-surface focus:outline-none focus:ring-4 focus:ring-ring/10"
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${item || `item ${i + 1}`}`}
              disabled={items.length <= 1}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-fg-subtle opacity-60 hover:bg-surface-2 hover:text-danger group-hover:opacity-100 disabled:invisible"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <button onClick={() => add()} className="ml-8 mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary hover:bg-primary-soft">
        <Plus className="size-4" aria-hidden /> {addLabel}
      </button>
    </div>
  );
}

// ── Add-field menu ───────────────────────────────────────────────────────────

function AddFieldMenu({ onPick }: { onPick: (t: FieldType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong text-sm font-medium text-fg-muted transition-colors duration-200 hover:border-primary/40 hover:bg-surface hover:text-fg"
      >
        <Plus className="size-4" aria-hidden /> Add question
      </button>
      {open && (
        <div className="animate-pop absolute inset-x-0 top-14 z-30 rounded-2xl border border-border bg-surface p-3 shadow-lg sm:p-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {PICKER_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{g.label}</p>
                <ul className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
                  {g.types.map((t) => {
                    const Icon = FIELD_ICONS[t];
                    return (
                      <li key={t}>
                        <button
                          onClick={() => {
                            onPick(t);
                            setOpen(false);
                          }}
                          className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm text-fg hover:bg-surface-2"
                        >
                          <Icon className="size-4 text-fg-muted" aria-hidden />
                          {FIELD_TYPE_LABELS[t]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-lg text-fg-subtle transition-colors duration-150 hover:bg-surface-2 disabled:opacity-30",
        danger ? "hover:text-danger" : "hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

const AutoTextarea = function AutoTextarea({
  value,
  onChange,
  className,
  ref,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Re-measure once web fonts load and whenever the width changes.
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return (
    <textarea
      {...props}
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = el;
      }}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "block w-full resize-none overflow-hidden rounded-md border-b border-transparent bg-transparent outline-none transition-colors placeholder:text-fg-subtle hover:border-border focus:border-border-strong focus-visible:outline-none",
        className,
      )}
    />
  );
};

