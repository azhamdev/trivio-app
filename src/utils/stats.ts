import { CATEGORIES, Category } from '@/data/categories';
import { CategoryId, Expense, Group, Member, PersonalBudget, PersonalExpense } from '@/types';
import { formatDayLabel } from '@/utils/format';

export type CategoryTotal = { category: Category; total: number; share: number };
export type MemberBalance = { member: Member; paid: number; diff: number };

// Shared by groupStats and personalBudgetStats — per-person math (byMember)
// doesn't apply to a memberless personal budget, so that part stays separate.
function computeByCategory(
  expenses: { categoryId: CategoryId; amount: number }[],
  spent: number
): CategoryTotal[] {
  return CATEGORIES.map((category) => ({
    category,
    total: expenses.filter((e) => e.categoryId === category.id).reduce((s, e) => s + e.amount, 0),
    share: 0,
  }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((x) => ({ ...x, share: spent > 0 ? x.total / spent : 0 }));
}

export type GroupStatsResult = {
  spent: number;
  remaining: number;
  pctUsed: number;
  count: number;
  byCategory: CategoryTotal[];
  byMember: MemberBalance[];
  perPersonShare: number;
  perPersonBudget: number;
  activeDays: number;
  dailyTarget: number;
  dailyAverage: number;
  projected: number;
  biggest: Expense | null;
};

export function groupStats(group: Group): GroupStatsResult {
  const expenses = group.expenses ?? [];
  const memberCount = Math.max(1, group.members.length);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = group.budget - spent;
  const pctUsed = group.budget > 0 ? spent / group.budget : 0;

  const byCategory = computeByCategory(expenses, spent);

  const fairShare = spent / memberCount;
  const byMember: MemberBalance[] = group.members
    .map((member) => {
      const paid = expenses.filter((e) => e.paidById === member.id).reduce((s, e) => s + e.amount, 0);
      return { member, paid, diff: paid - fairShare };
    })
    .sort((a, b) => b.paid - a.paid);

  const activeDays = new Set(expenses.map((e) => new Date(e.createdAt).toDateString())).size;
  const dailyTarget = group.days > 0 ? group.budget / group.days : 0;
  const dailyAverage = activeDays > 0 ? spent / activeDays : 0;
  const projected = dailyAverage * (group.days || 0);
  const biggest = expenses.reduce<Expense | null>(
    (max, e) => (!max || e.amount > max.amount ? e : max),
    null
  );

  return {
    spent,
    remaining,
    pctUsed,
    count: expenses.length,
    byCategory,
    byMember,
    perPersonShare: fairShare,
    perPersonBudget: group.budget / memberCount,
    activeDays,
    dailyTarget,
    dailyAverage,
    projected,
    biggest,
  };
}

export type PersonalBudgetStatsResult = {
  spent: number;
  remaining: number;
  pctUsed: number;
  count: number;
  byCategory: CategoryTotal[];
  activeDays: number;
  dailyTarget: number;
  dailyAverage: number;
  projected: number;
  biggest: PersonalExpense | null;
};

export function personalBudgetStats(budget: PersonalBudget): PersonalBudgetStatsResult {
  const expenses = budget.expenses ?? [];
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget.amount - spent;
  const pctUsed = budget.amount > 0 ? spent / budget.amount : 0;

  const byCategory = computeByCategory(expenses, spent);

  const activeDays = new Set(expenses.map((e) => new Date(e.createdAt).toDateString())).size;
  const dailyTarget = budget.days > 0 ? budget.amount / budget.days : 0;
  const dailyAverage = activeDays > 0 ? spent / activeDays : 0;
  const projected = dailyAverage * (budget.days || 0);
  const biggest = expenses.reduce<PersonalExpense | null>(
    (max, e) => (!max || e.amount > max.amount ? e : max),
    null
  );

  return {
    spent,
    remaining,
    pctUsed,
    count: expenses.length,
    byCategory,
    activeDays,
    dailyTarget,
    dailyAverage,
    projected,
    biggest,
  };
}

export type DaySection<T> = { key: string; label: string; items: T[] };

// Generic over anything with an id/createdAt, so it works unchanged for both
// Expense[] and PersonalExpense[].
export function groupExpensesByDay<T extends { id: string; createdAt: number }>(
  expenses: T[] = []
): DaySection<T>[] {
  const sorted = [...expenses].sort((a, b) => b.createdAt - a.createdAt);
  const sections: DaySection<T>[] = [];
  for (const exp of sorted) {
    const key = new Date(exp.createdAt).toDateString();
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.items.push(exp);
    } else {
      sections.push({ key, label: formatDayLabel(exp.createdAt), items: [exp] });
    }
  }
  return sections;
}
