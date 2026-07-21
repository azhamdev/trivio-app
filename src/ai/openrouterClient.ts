// Shared OpenRouter transport. Both the chat assistant (llm.ts) and the receipt
// OCR parser (receiptOcr.ts) go through callOpenRouter, so the fetch/timeout/
// error/attribution-header logic lives in exactly one place.
//
// NOTE: EXPO_PUBLIC_* vars are inlined into the client bundle, so this key
// ships with the app. Acceptable for a demo with a free-tier key; for
// production, proxy this call through your own backend and keep the key there.

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

// Gemini 3 Flash is vision-capable via OpenRouter, so the same model backs both
// the text assistant and image-based receipt parsing — no extra provider/key.
export const OPENROUTER_MODEL = 'google/gemini-3-flash-preview';

// Callers can cheaply gate UI (or skip the request entirely) when no key exists.
export const hasOpenRouterKey = !!API_KEY;

// OpenAI-compatible content parts. A string content is the common text case;
// the array form carries multimodal parts (text + image) for receipt OCR.
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

export type CallOpenRouterOptions = {
  temperature?: number;
  maxTokens?: number;
  // Gemini 3 Flash is a reasoning model: thinking tokens count against
  // max_tokens, so keep the token budget generous and the effort low.
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
};

// Returns the assistant message text, or throws on any failure (no key, network
// error, non-2xx, timeout, empty completion). Callers own the fallback.
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  opts: CallOpenRouterOptions = {}
): Promise<string> {
  if (!API_KEY) throw new Error('No OpenRouter API key');

  const {
    temperature = 0.4,
    maxTokens = 2000,
    reasoningEffort = 'low',
    timeoutMs = 45000, // free-tier models can be slow
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        // Optional OpenRouter attribution headers
        'HTTP-Referer': 'https://trivio.example',
        'X-Title': 'Trivio',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature,
        max_tokens: maxTokens,
        reasoning: { effort: reasoningEffort },
        messages,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty completion');
    return text;
  } finally {
    clearTimeout(timer);
  }
}
