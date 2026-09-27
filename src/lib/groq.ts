import "server-only";
import { env } from "./env";
import { formContentInput, type FormContentInput } from "./schema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You convert questionnaire documents into structured web-form definitions.

Return ONLY a JSON object with this exact shape:
{
  "title": string,                     // the questionnaire's title
  "description": string,               // intro / instructions shown at the top ("" if none)
  "sections": [
    {
      "title": string,                 // section heading ("" if the document has no sections)
      "description": string,           // optional section intro
      "fields": [
        {
          "ref": string,               // unique id for this question: "q1", "q2", "q3"… in document order
          "type": one of "short_text" | "long_text" | "email" | "phone" | "number" | "date" | "time" |
                  "single_choice" | "multi_choice" | "dropdown" | "yes_no" | "rating" | "scale" |
                  "matrix" | "file" | "statement",
          "label": string,             // the question text, cleaned (no numbering like "1." or "Q3)")
          "description": string,       // helper text / notes for the question, "" if none
          "required": boolean,
          "options": string[],         // choices (single_choice/multi_choice/dropdown) or column headers (matrix)
          "rows": string[],            // matrix rows only
          "allowOther": boolean,       // true when an "Other (please specify)" choice exists — do NOT also list "Other" in options
          "min": number, "max": number,           // scale bounds (e.g. 1–5 or 0–10) or rating max
          "minLabel": string, "maxLabel": string, // scale end labels, e.g. "Strongly disagree"
          "showIf": {                  // ONLY for follow-up questions; omit otherwise
            "ref": string,             // ref of the EARLIER question that triggers this one
            "op": "equals" | "not_equals" | "includes" | "answered",
            "value": string            // the exact triggering choice, e.g. "Yes" or "Other" (omit for "answered")
          }
        }
      ]
    }
  ]
}

Rules:
- Preserve EVERY question in the original order. Never invent questions. Keep the wording faithful; only fix obvious spacing/typos.
- Use headings / bold lines / "Section" / "Part" markers to create sections. If there are none, use one section with title "".
- Pick the most specific type:
  • name, company, job title, city → short_text
  • "describe", "explain", "comments", "details", or questions followed by several blank lines → long_text
  • email → email; phone/mobile/contact number → phone; age, quantity, budget, amount, counts → number
  • dates / DOB → date
  • lists of choices with ☐ / □ / bullet / "tick one" → single_choice (one answer) or multi_choice ("tick all that apply", "select all")
  • long lists of 8+ mutually exclusive choices (e.g. countries) → dropdown
  • plain Yes/No questions → yes_no
  • "rate 1-5", "on a scale of 1 to 10", Likert (Strongly disagree … Strongly agree) as a single question → scale with min/max/minLabel/maxLabel
  • star or "out of 5" ratings → rating with max
  • a TABLE whose rows are items and whose columns are rating choices → ONE matrix field (rows = row labels, options = column headers, excluding the first header cell)
  • requests to attach/upload/provide documents → file
  • pure instructions, notes or disclaimers that are not questions → statement (put the text in "label")
- FOLLOW-UP QUESTIONS: when a question only applies depending on an earlier answer, add "showIf" pointing at that earlier question's "ref". Typical cues:
  • "If yes, please give details / specify / explain", "If so, …", "If no, why not?"
  • "If you ticked Other, please specify" (when the earlier question has no built-in allowOther text box)
  • "If you answered B to question 4 …", "Only answer if …", "Skip to question 9 if …" (skip logic ⇒ the skipped questions get the opposite condition)
  • Indented or lettered sub-questions (4a, 4b) that elaborate on one specific answer of the parent
  Use "equals" for single-answer triggers (yes_no → "Yes"/"No"; single_choice/dropdown → one exact option), "includes" when the trigger is a multi_choice option, "not_equals" for "if not X", and "answered" when any answer to a text question should reveal it.
  The trigger must appear BEFORE the follow-up. The "value" must exactly match one of the trigger's options (or "Yes"/"No" for yes_no, or "Other" if allowOther).
  Follow-ups that ask for details/explanations ("please specify", "give details") should be "required": true — they are only enforced when shown.
  A question that asks "Yes/No … If yes, give details" in ONE line becomes TWO questions: a yes_no, then a long_text follow-up with showIf equals "Yes".
- A TABLE used as a fill-in layout (e.g. "Name: ___ | Date: ___") becomes separate simple fields, not a matrix.
- required = true only if the document marks it (e.g. "*", "required", "mandatory"); otherwise false. Contact details (name, email) are usually required.
- Omit signature lines, "office use only" blocks, page numbers, headers/footers.
- Output valid JSON only. No markdown, no commentary.`;

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string; code?: string };
}

async function callGroq(model: string, text: string, fileName: string): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.1,
    max_completion_tokens: 32768,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `File name: ${fileName}\n\n----- DOCUMENT START -----\n${text}\n----- DOCUMENT END -----` },
    ],
  };
  if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "medium";

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.groqKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110_000),
  });
  const json = (await res.json().catch(() => ({}))) as GroqResponse;
  if (!res.ok) {
    const err = new Error(json.error?.message || `Groq request failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response");
  return content;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("The AI response was not valid JSON");
  }
}

/** Uses Groq to turn document text into a form definition. */
export async function parseQuestionnaire(text: string, fileName: string): Promise<{ content: FormContentInput; model: string }> {
  if (!env.groqKey()) throw new Error("GROQ_API_KEY is not set, so documents can't be imported yet.");

  const clipped = text.length > 120_000 ? text.slice(0, 120_000) : text;
  const models = [env.groqModel(), env.groqFallbackModel()].filter((m, i, a) => m && a.indexOf(m) === i);

  let lastError: unknown;
  for (const model of models) {
    // Two attempts per model: the second covers the occasional malformed JSON.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callGroq(model, clipped, fileName);
        const content = formContentInput.parse(parseJson(raw));
        const questionCount = content.sections.reduce((n, s) => n + s.fields.length, 0);
        if (questionCount === 0) throw new Error("No questions were found in the document");
        return { content, model };
      } catch (e) {
        lastError = e;
        const status = (e as { status?: number }).status;
        if (status === 401) throw new Error("Groq rejected the API key (401). Check GROQ_API_KEY.");
        // Model unavailable / bad request / rate limit → move on to the fallback model.
        if (status && [400, 404, 413, 429].includes(status)) break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not parse the document");
}
