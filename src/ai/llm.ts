// OpenRouter-powered assistant. The rule-based engine in assistant.ts stays as
// the offline fallback whenever the request fails (no key, no network, rate
// limit on the free tier, timeout), so the chat always answers.
//
// NOTE: EXPO_PUBLIC_* vars are inlined into the client bundle, so this key
// ships with the app. Acceptable for a demo with a free-tier key; for
// production, proxy this call through your own backend and keep the key there.

import { answerQuestion } from '@/ai/assistant';
import { categoryById } from '@/data/categories';
import { ChatMessage, Group, User } from '@/types';
import { formatIDR } from '@/utils/format';
import { groupStats } from '@/utils/stats';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const TIMEOUT_MS = 45000; // free-tier models can be slow
const API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

export type AssistantReply = { text: string; offline: boolean };

const SYSTEM_PROMPT = `You are Trivio Assistant, the in-app helper of a group trip expense tracker used by travelers splitting costs.
Answer the traveler's question using ONLY the trip data below — never invent expenses, amounts, or members.
Style: warm, concise, practical. A couple of sentences, or short bullet lines for lists. No markdown headings or tables.
Money is Indonesian rupiah; format it like Rp 1.250.000 (dots as thousand separators).
"The person asking" in the member list is the user you're talking to — address them as "you".
If asked something unrelated to this trip or its spending, briefly say you only handle this trip's numbers.`;

function buildTripContext(group: Group, user: User | null): string {
  const stats = groupStats(group);
  const now = new Date();

  const memberLines = stats.byMember.map((b) => {
    const who = user && b.member.id === user.id ? `${b.member.name} (the person asking)` : b.member.name;
    const balance =
      Math.abs(b.diff) < 1000
        ? 'even with the group'
        : b.diff > 0
          ? `is owed ${formatIDR(b.diff)}`
          : `owes ${formatIDR(-b.diff)}`;
    return `- ${who}: paid ${formatIDR(b.paid)}, ${balance}`;
  });

  const expenseLines = group.expenses.slice(0, 30).map((e) => {
    const payer = group.members.find((m) => m.id === e.paidById);
    const when = new Date(e.createdAt).toISOString().slice(0, 16).replace('T', ' ');
    return `- [${when}] ${e.title} — ${formatIDR(e.amount)} (${categoryById(e.categoryId).label}, paid by ${payer?.name ?? 'unknown'}${e.note ? `, note: ${e.note}` : ''})`;
  });

  return [
    `Current date/time: ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
    `Trip: ${group.name} — ${group.destination}, ${group.days} days planned.`,
    `Group budget: ${formatIDR(group.budget)}. Spent: ${formatIDR(stats.spent)} (${Math.round(stats.pctUsed * 100)}% used). Remaining: ${formatIDR(stats.remaining)}.`,
    `Fair share of spending per person: ${formatIDR(stats.perPersonShare)}. Budget per person: ${formatIDR(stats.perPersonBudget)}.`,
    `Pace: daily target ${formatIDR(stats.dailyTarget)}, actual average ${formatIDR(stats.dailyAverage)} across ${stats.activeDays} spending day(s), projected trip total ${formatIDR(stats.projected)}.`,
    stats.byCategory.length > 0
      ? `Spending by category: ${stats.byCategory.map((c) => `${c.category.label} ${formatIDR(c.total)} (${Math.round(c.share * 100)}%)`).join('; ')}.`
      : 'No expenses logged yet.',
    `Members (${group.members.length}):`,
    ...memberLines,
    expenseLines.length > 0 ? `Expense log (newest first):` : '',
    ...expenseLines,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function askAssistant(
  question: string,
  group: Group,
  user: User | null,
  history: ChatMessage[]
): Promise<AssistantReply> {
  const offline = (): AssistantReply => ({
    text: answerQuestion(question, group, user),
    offline: true,
  });

  if (!API_KEY) return offline();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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
        model: MODEL,
        temperature: 0.4,
        // Nemotron is a reasoning model: thinking tokens count against
        // max_tokens, so keep the budget generous and the effort low.
        max_tokens: 2000,
        reasoning: { effort: 'low' },
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\n=== TRIP DATA ===\n${buildTripContext(group, user)}` },
          ...history.slice(-8).map((m) => ({ role: m.role, content: m.text })),
          { role: 'user', content: question },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty completion');
    return { text, offline: false };
  } catch (err) {
    console.warn('Trivio Assistant: falling back to offline answer —', err);
    return offline();
  } finally {
    clearTimeout(timer);
  }
}
