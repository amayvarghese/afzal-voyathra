import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getFormBySlug } from "@/lib/forms";
import { env } from "@/lib/env";

const ALLOWED = [
  "application/pdf",
  "image/*",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
];

export async function POST(req: Request) {
  if (!env.blobToken()) return Response.json({ error: "File uploads are not configured." }, { status: 503 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Only issue upload tokens for open forms that actually contain a file question.
        const { slug } = JSON.parse(clientPayload || "{}") as { slug?: string };
        const form = slug ? await getFormBySlug(slug) : null;
        const hasFileField = form?.sections.some((s) => s.fields.some((f) => f.type === "file"));
        if (!form || !form.settings.isOpen || !hasFileField) throw new Error("Uploads are not allowed for this form.");
        if (!pathname.startsWith(`uploads/${form.slug}/`)) throw new Error("Invalid upload path.");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
