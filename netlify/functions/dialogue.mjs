/* Netlify Function — answers bound to passages of the book.
   Netlify's AI Gateway injects ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL.
   Nothing is stored or logged. */

const MODEL = process.env.DIALOG_MODEL || "claude-sonnet-4-6";
const FALLBACK = ["claude-sonnet-4-5", "claude-3-7-sonnet-latest"];

const BASE = `You answer questions about one open textbook: Cindy Gruwell and Robin Ewing, "Critical Thinking in Academic Research", second edition (Minnesota State Colleges and Universities, 2022, CC BY-SA 4.0). Its readers are undergraduates learning to find, judge and cite sources.

Binding rules:
1. Answer ONLY from the passages supplied. What is not in them, you do not assert. If the passages do not settle the question, say so and say what they do establish.
2. Name the chapter for every substantive claim, in the form given with each passage. Never invent a chapter or a page.
3. Quote sparingly and mark quotations as quotations. Otherwise put it in your own words — a reader who wanted the wording can open the chapter.
4. Teach in the book's own terms. Where it defines a term, use its definition rather than a better one you know; where its treatment is simplified, do not silently upgrade it.
5. This is a study aid, not a marker and not a substitute for reading. Do not evaluate the quality of the reader's own argument, do not write their assignment, and do not offer to. If asked, say what the book says about doing the work themselves and point to the chapter.
6. Where a question runs past the book — a particular database, a citation style in detail, the conventions of a specific discipline — say plainly that this book does not cover it, and stop. Do not fill the gap from memory.
7. Plain, direct English, two to four short paragraphs. No encouragement, no padding, no restating the question.`;

const MODES = {
  teaching: "\n\nRegister: explain as the book explains, in its own terms, for someone meeting the idea for the first time.",
  locate: "\n\nRegister: locate. The reader wants to know where in the book this is treated. Lead with the chapters and say briefly what each contributes.",
  critical: "\n\nRegister: mark the limits. Say what the passages establish and where they stop short, without supplying the missing part yourself.",
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only." }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "Malformed JSON." }, 400); }

  const frage = String(body.frage || "").slice(0, 4000).trim();
  const modus = MODES[body.modus] ? body.modus : "teaching";
  const passagen = Array.isArray(body.passagen) ? body.passagen.slice(0, 12) : [];
  const verlauf = Array.isArray(body.verlauf) ? body.verlauf.slice(-6) : [];

  if (frage.length < 5) return json({ error: "Send a formulated question." }, 400);
  if (!passagen.length) return json({ error: "No passages supplied." }, 400);

  const key = process.env.ANTHROPIC_API_KEY;
  const base = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
  if (!key) {
    return json({
      error: "No access to the Anthropic endpoint is configured. In Netlify, enable AI Gateway under " +
             "Project configuration → AI Gateway. Reading, search and the glossary work regardless."
    }, 503);
  }

  const context = passagen.map((p, i) =>
    `[${i + 1}] ${p.zitat}${p.werk ? ` — ${p.werk}` : ""}\n${String(p.text || "").slice(0, 1200)}`
  ).join("\n\n---\n\n");

  const messages = [];
  for (const m of verlauf.slice(0, -1)) {
    if (!m || !m.text) continue;
    messages.push({ role: m.rolle === "user" ? "user" : "assistant", content: String(m.text).slice(0, 1600) });
  }
  messages.push({ role: "user", content: `PASSAGES\n\n${context}\n\n---\n\nQUESTION\n${frage}` });

  const payload = { model: MODEL, max_tokens: 1200, temperature: 0.2,
                    system: BASE + MODES[modus], messages };

  let last = "";
  for (const model of [MODEL, ...FALLBACK]) {
    payload.model = model;
    try {
      const r = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const d = await r.json();
        const antwort = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
        return json({ antwort: antwort || "(empty answer)", modell: model, passagen: passagen.length });
      }
      last = `${r.status} ${(await r.text()).slice(0, 300)}`;
      if (r.status !== 404 && r.status !== 400) break;
    } catch (e) { last = String(e && e.message ? e.message : e); break; }
  }
  return json({ error: "The answering endpoint reports: " + last }, 502);
};

function json(o, status = 200) {
  return new Response(JSON.stringify(o), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const config = { path: "/.netlify/functions/dialogue" };
