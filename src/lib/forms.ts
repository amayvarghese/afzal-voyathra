import "server-only";
import { ObjectId, type WithId, type Document } from "mongodb";
import { getDb } from "./db";
import { normalizeContent, type FormContentInput } from "./schema";
import { DEFAULT_SETTINGS, type FormDoc, type FormSettings, type PublicForm, type ResponseRow } from "./types";
import { shortId, slugify } from "./utils";
import { env } from "./env";

type FormRecord = Omit<FormDoc, "_id" | "createdAt" | "updatedAt" | "lastResponseAt"> & {
  createdAt: Date;
  updatedAt: Date;
  lastResponseAt: Date | null;
};

async function forms() {
  return (await getDb()).collection<FormRecord>("forms");
}

function serialize(doc: WithId<FormRecord>): FormDoc {
  return {
    ...doc,
    _id: doc._id.toString(),
    settings: { ...DEFAULT_SETTINGS, ...doc.settings },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    lastResponseAt: doc.lastResponseAt ? doc.lastResponseAt.toISOString() : null,
  };
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}

async function uniqueSlug(base: string, excludeId?: ObjectId): Promise<string> {
  const col = await forms();
  const root = slugify(base, 48);
  let slug = root;
  for (let i = 0; i < 20; i++) {
    const clash = await col.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }, { projection: { _id: 1 } });
    if (!clash) return slug;
    slug = `${root}-${shortId().slice(0, 4)}`;
  }
  return `${root}-${shortId()}`;
}

/** Each questionnaire gets its own MongoDB collection for responses. */
function collectionNameFor(slug: string) {
  return `responses_${slug.replace(/-/g, "_").slice(0, 40)}_${shortId().slice(0, 5)}`;
}

export async function listForms(): Promise<FormDoc[]> {
  const col = await forms();
  const docs = await col.find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map(serialize);
}

export async function getForm(id: string): Promise<FormDoc | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await (await forms()).findOne({ _id });
  return doc ? serialize(doc) : null;
}

export async function getFormBySlug(slug: string): Promise<FormDoc | null> {
  const doc = await (await forms()).findOne({ slug });
  return doc ? serialize(doc) : null;
}

export function toPublicForm(form: FormDoc): PublicForm {
  return {
    slug: form.slug,
    title: form.title,
    description: form.description,
    sections: form.sections,
    version: form.version,
    isOpen: form.settings.isOpen,
    submitLabel: form.settings.submitLabel,
    successTitle: form.settings.successTitle,
    successMessage: form.settings.successMessage,
    paginate: form.settings.paginate,
    uploadsEnabled: !!env.blobToken(),
  };
}

export async function createForm(
  content: FormContentInput,
  source?: FormDoc["source"],
): Promise<FormDoc> {
  const db = await getDb();
  const normalized = normalizeContent(content);
  const slug = await uniqueSlug(normalized.title);
  const collectionName = collectionNameFor(slug);

  // Create the response "table" up front, with an index for newest-first listing.
  await db.createCollection(collectionName).catch((e) => {
    if (e?.codeName !== "NamespaceExists") throw e;
  });
  await db.collection(collectionName).createIndex({ "_meta.submittedAt": -1 });

  const now = new Date();
  const record: FormRecord = {
    ...normalized,
    slug,
    settings: { ...DEFAULT_SETTINGS, notifyEmails: env.notifyEmails() },
    collectionName,
    version: 1,
    source: source ?? null,
    responseCount: 0,
    lastResponseAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await db.collection<FormRecord>("forms").insertOne(record);
  return serialize({ ...record, _id: insertedId });
}

export async function updateFormContent(id: string, content: FormContentInput): Promise<FormDoc | null> {
  const existing = await getForm(id);
  if (!existing) return null;
  const normalized = normalizeContent(content, existing.sections);
  const settings = { ...existing.settings };
  // Keep the confirmation target valid if that field was removed.
  if (settings.confirmationFieldId && !normalized.sections.some((s) => s.fields.some((f) => f.id === settings.confirmationFieldId && f.type === "email"))) {
    settings.confirmationFieldId = null;
    settings.confirmationEnabled = false;
  }
  const col = await forms();
  const res = await col.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { ...normalized, settings, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: "after" },
  );
  return res ? serialize(res) : null;
}

export async function updateFormSettings(
  id: string,
  patch: Partial<FormSettings> & { slug?: string },
): Promise<FormDoc | { error: string } | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const existing = await getForm(id);
  if (!existing) return null;
  const { slug: requestedSlug, ...settingsPatch } = patch;
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (requestedSlug !== undefined) {
    const s = slugify(requestedSlug, 60);
    if (s !== existing.slug) {
      const clash = await (await forms()).findOne({ slug: s, _id: { $ne: _id } });
      if (clash) return { error: "That link is already used by another questionnaire." };
      $set.slug = s;
    }
  }
  for (const [k, v] of Object.entries(settingsPatch)) $set[`settings.${k}`] = v;
  const res = await (await forms()).findOneAndUpdate({ _id }, { $set }, { returnDocument: "after" });
  return res ? serialize(res) : null;
}

export async function duplicateForm(id: string): Promise<FormDoc | null> {
  const form = await getForm(id);
  if (!form) return null;
  const copy = await createForm(
    { title: `${form.title} (copy)`, description: form.description, sections: form.sections },
    form.source,
  );
  await updateFormSettings(copy._id, { ...form.settings, isOpen: false });
  return getForm(copy._id);
}

export async function deleteForm(id: string): Promise<boolean> {
  const form = await getForm(id);
  if (!form) return false;
  const db = await getDb();
  await db.collection(form.collectionName).drop().catch(() => undefined);
  await db.collection("forms").deleteOne({ _id: new ObjectId(id) });
  return true;
}

// ── Responses ──────────────────────────────────────────────────────────────

export interface ResponseMeta {
  formId: string;
  formVersion: number;
  submittedAt: Date;
  email?: ResponseRow["email"];
}

function serializeResponse(doc: WithId<Document>): ResponseRow {
  const { _id, _meta, ...answers } = doc;
  const meta = _meta as ResponseMeta;
  return {
    _id: _id.toString(),
    submittedAt: meta.submittedAt.toISOString(),
    formVersion: meta.formVersion,
    email: meta.email,
    answers: answers as ResponseRow["answers"],
  };
}

export async function insertResponse(form: FormDoc, answers: Record<string, unknown>) {
  const db = await getDb();
  const now = new Date();
  const doc = {
    ...answers,
    _meta: { formId: form._id, formVersion: form.version, submittedAt: now } satisfies ResponseMeta,
  };
  const { insertedId } = await db.collection(form.collectionName).insertOne(doc);
  await db
    .collection("forms")
    .updateOne({ _id: new ObjectId(form._id) }, { $inc: { responseCount: 1 }, $set: { lastResponseAt: now } });
  return insertedId.toString();
}

export async function setResponseEmailStatus(form: FormDoc, responseId: string, email: NonNullable<ResponseRow["email"]>) {
  const db = await getDb();
  await db.collection(form.collectionName).updateOne({ _id: new ObjectId(responseId) }, { $set: { "_meta.email": email } });
}

export async function listResponses(form: FormDoc, opts: { page?: number; pageSize?: number; q?: string } = {}) {
  const db = await getDb();
  const col = db.collection(form.collectionName);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));
  const page = Math.max(1, opts.page ?? 1);
  let filter: Document = {};
  const q = opts.q?.trim();
  if (q) {
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const keys = form.sections.flatMap((s) => s.fields).filter((f) => f.type !== "statement" && f.type !== "file").map((f) => f.key);
    filter = { $or: keys.map((k) => ({ [k]: rx })) };
    if (keys.length === 0) filter = { _id: null };
  }
  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col
      .find(filter)
      .sort({ "_meta.submittedAt": -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);
  return { total, page, pageSize, rows: docs.map(serializeResponse) };
}

export async function allResponses(form: FormDoc): Promise<ResponseRow[]> {
  const db = await getDb();
  const docs = await db.collection(form.collectionName).find({}).sort({ "_meta.submittedAt": -1 }).toArray();
  return docs.map(serializeResponse);
}

export async function deleteResponse(form: FormDoc, responseId: string) {
  const _id = toObjectId(responseId);
  if (!_id) return false;
  const db = await getDb();
  const { deletedCount } = await db.collection(form.collectionName).deleteOne({ _id });
  if (deletedCount) {
    await db.collection("forms").updateOne({ _id: new ObjectId(form._id) }, { $inc: { responseCount: -1 } });
  }
  return deletedCount > 0;
}
