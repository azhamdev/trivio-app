// Local, rule-based assistant that answers questions from the trip's live
// numbers — works fully offline. To upgrade to a real LLM later, send the
// group data plus the question to your backend and let the backend call the
// model. Never ship a model API key inside the app bundle.

import { categoryById } from '@/data/categories';
import { Group, User } from '@/types';
import { firstName, formatIDR } from '@/utils/format';
import { groupStats } from '@/utils/stats';

export const SUGGESTIONS = [
  'How much is left?',
  'Split per person',
  'Biggest category?',
  'Are we on pace?',
];

function hasAny(q: string, words: string[]): boolean {
  return words.some((w) => q.includes(w));
}

export function greetingMessage(group: Group, user: User | null): string {
  const stats = groupStats(group);
  const name = firstName(user?.name ?? 'there');
  if (stats.count === 0) {
    return `Hi ${name}! I'm watching ${group.name} — ${formatIDR(group.budget)} budgeted over ${group.days} days, nothing spent yet. Log an expense, then ask me what's left, who's paid what, or whether you're on pace.`;
  }
  return `Hi ${name}! ${group.name} so far: ${formatIDR(stats.spent)} spent of ${formatIDR(group.budget)}. Ask me what's left, the split per person, or whether you're on pace.`;
}

export function answerQuestion(rawQuestion: string, group: Group, user: User | null): string {
  const q = rawQuestion.toLowerCase();
  const stats = groupStats(group);
  const members = group.members;
  const noData = stats.count === 0;

  // Recent activity
  if (hasAny(q, ['recent', 'latest', 'history', 'last expense', 'log'])) {
    if (noData) return `Nothing logged yet for ${group.name}. Tap + on the trip screen to add the first expense.`;
    const latest = [...group.expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    const lines = latest.map((e) => {
      const payer = members.find((m) => m.id === e.paidById);
      return `• ${e.title} — ${formatIDR(e.amount)} (${categoryById(e.categoryId).label}, paid by ${payer ? firstName(payer.name) : 'someone'})`;
    });
    return `Latest expenses:\n${lines.join('\n')}`;
  }

  // Who paid what / settle up
  if (hasAny(q, ['owe', 'split', 'settle', 'balance', 'who paid', 'per person', 'each'])) {
    if (noData)
      return 'No expenses yet, so there is nothing to split. Once people start paying, I can tell you who is ahead and who needs to top up.';
    const lines = stats.byMember.map((b) => {
      const who = b.member.name === user?.name ? 'You' : firstName(b.member.name);
      if (Math.abs(b.diff) < 1000) return `• ${who} paid ${formatIDR(b.paid)} — even`;
      return b.diff > 0
        ? `• ${who} paid ${formatIDR(b.paid)} — is owed ${formatIDR(b.diff)}`
        : `• ${who} paid ${formatIDR(b.paid)} — owes ${formatIDR(-b.diff)}`;
    });
    return `Total spent is ${formatIDR(stats.spent)}, which works out to ${formatIDR(stats.perPersonShare)} per person across ${members.length} ${members.length === 1 ? 'member' : 'members'}.\n${lines.join('\n')}`;
  }

  // Pace vs. daily target
  if (hasAny(q, ['pace', 'track', 'daily', 'per day', 'a day', 'forecast', 'projection'])) {
    if (noData)
      return `Your target is ${formatIDR(stats.dailyTarget)} per day (${formatIDR(group.budget)} over ${group.days} days). Nothing is logged yet, so the whole budget is still yours.`;
    const verdict =
      stats.projected <= group.budget
        ? `keep this up and you'll land around ${formatIDR(stats.projected)} — inside the budget.`
        : `at this rate you'd land around ${formatIDR(stats.projected)}, about ${formatIDR(stats.projected - group.budget)} over. Worth easing off a little.`;
    return `Daily target: ${formatIDR(stats.dailyTarget)}. You're averaging ${formatIDR(stats.dailyAverage)} across ${stats.activeDays} spending ${stats.activeDays === 1 ? 'day' : 'days'} — ${verdict}`;
  }

  // Category breakdown
  if (hasAny(q, ['category', 'categories', 'biggest', 'most', 'top', 'breakdown', 'where'])) {
    if (noData) return 'No expenses yet — once you log a few I can break spending down by category.';
    const top = stats.byCategory
      .slice(0, 3)
      .map((x) => `• ${x.category.label}: ${formatIDR(x.total)} (${Math.round(x.share * 100)}%)`);
    const biggest = stats.biggest!;
    return `Where the money went:\n${top.join('\n')}\nBiggest single expense: ${biggest.title}, ${formatIDR(biggest.amount)}.`;
  }

  // Remaining budget
  if (hasAny(q, ['left', 'remaining', 'remain', 'sisa', 'budget'])) {
    if (stats.remaining >= 0) {
      return `${formatIDR(stats.remaining)} left of your ${formatIDR(group.budget)} budget — ${Math.round(stats.pctUsed * 100)}% used. That's about ${formatIDR(stats.remaining / Math.max(1, members.length))} per person.`;
    }
    return `You're over budget by ${formatIDR(-stats.remaining)} (spent ${formatIDR(stats.spent)} of ${formatIDR(group.budget)}). Ask me for the category breakdown to find where to cut.`;
  }

  // Total spent
  if (hasAny(q, ['spent', 'spend', 'total', 'so far'])) {
    if (noData) return `Nothing spent yet on ${group.name}. The full ${formatIDR(group.budget)} budget is intact.`;
    return `${formatIDR(stats.spent)} across ${stats.count} ${stats.count === 1 ? 'expense' : 'expenses'} — ${Math.round(stats.pctUsed * 100)}% of the ${formatIDR(group.budget)} budget.`;
  }

  // Greeting / help / fallback
  return `I answer from ${group.name}'s live numbers. Try:\n• "How much is left?"\n• "Split per person"\n• "What's our biggest category?"\n• "Are we on pace?"`;
}
