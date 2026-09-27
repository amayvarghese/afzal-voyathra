import "server-only";
import mammoth from "mammoth";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

function decode(s: string) {
  return s
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

const strip = (html: string) => decode(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/**
 * Converts a .docx file into compact Markdown-like text that preserves the
 * structure an LLM needs to recognise questions: headings, numbered/bulleted
 * lists, tables (often used for rating grids) and checkbox glyphs.
 */
export async function docxToText(buffer: Buffer): Promise<string> {
  const { value: html } = await mammoth.convertToHtml({ buffer });

  let out = html
    // Tables → pipe rows
    .replace(/<table[\s\S]*?<\/table>/gi, (table) => {
      const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) =>
        [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => strip(c[1]) || " ").join(" | "),
      );
      return `\n[TABLE]\n${rows.map((r) => `| ${r} |`).join("\n")}\n[/TABLE]\n`;
    })
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => `\n${"#".repeat(Number(l))} ${strip(t)}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${strip(t)}`)
    .replace(/<\/(p|ul|ol|div)>/gi, "\n")
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, t) => `**${strip(t)}**`);

  out = decode(out.replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l, i, arr) => l !== "" || (arr[i - 1] ?? "") !== "")
    .join("\n")
    .replace(/\*\*\s*\*\*/g, "")
    .trim();

  return out;
}
