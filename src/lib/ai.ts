import "server-only";

// One OpenAI-compatible chat call, so any provider works: Gemini, Groq, OpenRouter, Cerebras...
// Config: AI_BASE_URL + AI_API_KEY + AI_MODEL (+ optional AI_FALLBACK_MODEL), or just GEMINI_API_KEY.

interface AiConfig {
  baseUrl: string;
  key: string;
  models: string[];
}

export function aiConfig(): AiConfig | null {
  const e = process.env;
  const fallback = e.AI_FALLBACK_MODEL ? [e.AI_FALLBACK_MODEL] : [];
  if (e.AI_BASE_URL && e.AI_API_KEY && e.AI_MODEL) return { baseUrl: e.AI_BASE_URL.replace(/\/$/, ""), key: e.AI_API_KEY, models: [e.AI_MODEL, ...fallback] };
  if (e.GEMINI_API_KEY)
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      key: e.GEMINI_API_KEY,
      // Gemma is open and runs on the same key when Flash is rate-limited.
      models: [e.AI_MODEL || "gemini-flash-latest", ...(fallback.length ? fallback : ["gemma-4-31b-it"])],
    };
  return null;
}

export class AiError extends Error {}

/** Returns the reply text. Tries the fallback model when the first is rate-limited or down. */
export async function chat(system: string, user: string, maxTokens = 800): Promise<string> {
  const cfg = aiConfig();
  if (!cfg) throw new AiError("not_configured");
  let last = "";
  for (const model of cfg.models) {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch((e: unknown) => new AiError(String(e)));
    if (res instanceof AiError) {
      last = res.message;
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
      last = "empty";
      continue;
    }
    last = `${model}: ${res.status}`;
    if (res.status === 401 || res.status === 403) break; // bad key or billing: another model on the same key won't help
  }
  throw new AiError(last);
}
