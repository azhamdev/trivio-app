// Receipt OCR: send a photo of a receipt to the vision model and get back a
// draft expense to pre-fill the entry form. Mirrors askAssistant's resilience —
// parseReceipt NEVER throws; it returns null on any failure (no key, network
// error, timeout, unreadable image, malformed JSON) and the UI degrades to
// plain manual entry.

import { callOpenRouter, hasOpenRouterKey } from '@/ai/openrouterClient';
import { CATEGORIES } from '@/data/categories';
import { CategoryId } from '@/types';

export type ReceiptParseResult = {
  title: string;
  amount: number; // whole rupiah, integer
  categoryId: CategoryId;
  note?: string;
  confidence: 'high' | 'medium' | 'low';
};

const VALID_CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];
const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

const SYSTEM_PROMPT = `You extract a single expense from a photo of a receipt for an Indonesian expense-tracker app.
Read the receipt and return ONLY strict minified JSON — no prose, no markdown, no code fences — with exactly these fields:
{"title": string, "amount": number, "categoryId": string, "note": string, "confidence": "high"|"medium"|"low"}

Rules:
- title: a short human label for the purchase (e.g. the merchant/store name, or what was bought). Max ~6 words. Never leave it empty.
- amount: the GRAND TOTAL actually paid, as a plain integer with NO thousands separators, NO decimals, and NO currency symbol. Amounts are Indonesian rupiah (IDR); if the receipt is in another currency, still return the numeric total as printed.
- categoryId: choose the single best fit from EXACTLY these 6 ids: "food" (restaurants, cafes, groceries, drinks), "transport" (fuel, taxi, ride-hailing, parking, tolls, tickets to travel), "stay" (hotels, lodging), "activity" (tickets, tours, entertainment), "shopping" (retail goods, clothing, electronics), "other" (anything else). If unsure, use "other".
- note: optional extra detail (e.g. number of items, payment method). Use an empty string if there is nothing useful.
- confidence: your confidence that title, amount and category are correct given how legible the receipt is.
If the image is not a receipt or you cannot read a total, still return valid JSON with your best guess and confidence "low".`;

export async function parseReceipt(base64Image: string): Promise<ReceiptParseResult | null> {
  if (!hasOpenRouterKey || !base64Image) return null;

  try {
    const raw = await callOpenRouter(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the expense from this receipt.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      { temperature: 0, maxTokens: 1500 }
    );
    return coerceResult(raw);
  } catch (err) {
    console.warn('Trivio receipt OCR: could not parse receipt —', err);
    return null;
  }
}

// Defensive parsing — the model is instructed to return bare JSON, but we strip
// stray code fences / surrounding prose and validate every field before trusting
// it, clamping categoryId to a known id and rejecting a missing/zero amount.
function coerceResult(raw: string): ReceiptParseResult | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  const amount = Math.round(Number(obj.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const rawTitle = typeof obj.title === 'string' ? obj.title.trim() : '';
  const title = rawTitle ? rawTitle.slice(0, 80) : 'Receipt';

  const categoryId: CategoryId = VALID_CATEGORY_IDS.includes(obj.categoryId as CategoryId)
    ? (obj.categoryId as CategoryId)
    : 'other';

  const rawNote = typeof obj.note === 'string' ? obj.note.trim() : '';
  const note = rawNote ? rawNote.slice(0, 140) : undefined;

  const confidence = (CONFIDENCE_LEVELS as readonly string[]).includes(obj.confidence as string)
    ? (obj.confidence as ReceiptParseResult['confidence'])
    : 'low';

  return { title, amount, categoryId, note, confidence };
}

// Pull the JSON payload out of a response that may be wrapped in ```json fences
// or have leading/trailing chatter, falling back to the first {...} block.
function extractJson(s: string): string {
  const text = s.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const braced = text.match(/\{[\s\S]*\}/);
  return braced ? braced[0] : text;
}
