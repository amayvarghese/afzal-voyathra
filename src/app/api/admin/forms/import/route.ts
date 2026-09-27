import { requireAdmin } from "@/lib/auth";
import { docxToText } from "@/lib/docx";
import { parseQuestionnaire } from "@/lib/groq";
import { createForm } from "@/lib/forms";

export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const data = await req.formData().catch(() => null);
  const file = data?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file was uploaded." }, { status: 400 });
  if (!/\.docx$/i.test(file.name)) {
    return Response.json({ error: "Only Word .docx files are supported. Re-save older .doc files as .docx." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "That file is larger than 4 MB." }, { status: 413 });

  try {
    const text = await docxToText(Buffer.from(await file.arrayBuffer()));
    if (text.replace(/\s/g, "").length < 20) {
      return Response.json({ error: "No readable text found — is the document a scanned image?" }, { status: 422 });
    }
    const { content, model } = await parseQuestionnaire(text, file.name);
    const form = await createForm(content, { fileName: file.name, model, importedAt: new Date().toISOString() });
    return Response.json({ form }, { status: 201 });
  } catch (e) {
    console.error("[import]", e);
    return Response.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 500 });
  }
}
