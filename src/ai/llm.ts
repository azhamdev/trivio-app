// OpenRouter-powered assistant. The rule-based engine in assistant.ts stays as
// the offline fallback whenever the request fails (no key, no network, rate
// limit on the free tier, timeout), so the chat always answers.
//
// NOTE: EXPO_PUBLIC_* vars are inlined into the client bundle, so this key
// ships with the app. Acceptable for a demo with a free-tier key; for
// production, proxy this call through your own backend and keep the key there.

import { answerQuestion } from '@/ai/assistant';
import { callOpenRouter, hasOpenRouterKey } from '@/ai/openrouterClient';
import { categoryById } from '@/data/categories';
import { ChatMessage, Group, User } from '@/types';
import { formatDateRange } from '@/utils/dates';
import { formatIDR } from '@/utils/format';
import { groupStats } from '@/utils/stats';
import { isTripClosed, tripDayInfo } from '@/utils/trip';

export type AssistantReply = { text: string; offline: boolean };

const SYSTEM_PROMPT = `You are Trivio Assistant, the in-app helper of a group trip expense tracker used by travelers splitting costs.
Answer the traveler's question using ONLY the trip data below — never invent expenses, amounts, or members.
Always reply in casual, friendly Bahasa Indonesia (santai, like texting a friend — words like "kamu", "nih", "yuk", "banget" are welcome), regardless of what language the question was asked in.
Style: warm, concise, practical. A couple of sentences, or short bullet lines for lists. No markdown headings or tables.
Money is Indonesian rupiah; format it like Rp 1.250.000 (dots as thousand separators).
"The person asking" in the member list is the user you're talking to — address them as "kamu".
If asked for food or restaurant recommendations for the trip, ground the suggestion in the remaining budget and per-person share from the trip data (e.g. what price tier that supports), then use your general travel knowledge of the destination to suggest cuisine types, dish names, or venues — that general knowledge is fine here, just never invent trip expenses or numbers.
If asked something else unrelated to this trip, its spending, or its destination, briefly say (in Indonesian) that you only handle this trip's numbers.`;

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

  const day = tripDayInfo(group);
  const statusLine = isTripClosed(group)
    ? `Status: CLOSED (${group.closedReason === 'ended' ? 'trip dates have passed' : 'closed by a member'}) — no new expenses can be added.`
    : `Status: ${day.phase} — ${day.label}, ${day.remainingDays} day(s) of the trip remaining.`;

  return [
    `Current date/time: ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
    `Trip: ${group.name} — ${group.destination}, ${group.days} days (${formatDateRange(group.startDate, group.endDate)}).`,
    statusLine,
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

  // Quiet path for the keyless demo build — no request, no warning.
  if (!hasOpenRouterKey) return offline();

  try {
    const text = await callOpenRouter([
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n=== TRIP DATA ===\n${buildTripContext(group, user)}` },
      ...history.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: question },
    ]);
    return { text, offline: false };
  } catch (err) {
    console.warn('Trivio Assistant: falling back to offline answer —', err);
    return offline();
  }
}
