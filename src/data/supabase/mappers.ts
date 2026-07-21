// snake_case Postgres rows ↔ camelCase app models. Everything above this layer
// (stats.ts, trip.ts, screens) only ever sees the app types, never a raw row.
//
// Dates/amounts are bigint columns; PostgREST returns them as JSON numbers, but
// we Number()-coerce defensively in case a driver hands one back as a string.

import {
  CategoryId,
  Expense,
  Group,
  Member,
  PersonalBudget,
  PersonalExpense,
  User,
} from '@/types';
import { daysBetweenInclusive } from '@/utils/dates';

// ---- Row shapes (as selected from PostgREST, including embedded relations) ----

export type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  created_at: number | string;
};

export type ExpenseRow = {
  id: string;
  group_id: string;
  title: string;
  amount: number | string;
  category_id: string;
  paid_by: string | null;
  note: string | null;
  created_at: number | string;
};

export type GroupMemberRow = {
  user_id: string;
  profiles: { id: string; name: string } | null;
};

export type GroupRow = {
  id: string;
  name: string;
  destination: string;
  start_date: number | string;
  end_date: number | string;
  budget: number | string;
  currency: string;
  code: string;
  cover_url: string | null;
  created_by: string;
  closed_at: number | string | null;
  closed_reason: 'manual' | 'ended' | null;
  created_at: number | string;
  group_members?: GroupMemberRow[];
  expenses?: ExpenseRow[];
};

export type PersonalExpenseRow = {
  id: string;
  budget_id: string;
  title: string;
  amount: number | string;
  category_id: string;
  note: string | null;
  created_at: number | string;
};

export type PersonalBudgetRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number | string;
  category_id: string | null;
  start_date: number | string;
  end_date: number | string;
  closed_at: number | string | null;
  closed_reason: 'manual' | 'ended' | null;
  created_at: number | string;
  personal_expenses?: PersonalExpenseRow[];
};

// ---- Column name constants for select() strings, kept next to the shapes ----

export const GROUP_SELECT =
  'id, name, destination, start_date, end_date, budget, currency, code, cover_url, ' +
  'created_by, closed_at, closed_reason, created_at, ' +
  'group_members ( user_id, profiles ( id, name ) ), ' +
  'expenses ( id, group_id, title, amount, category_id, paid_by, note, created_at )';

export const BUDGET_SELECT =
  'id, user_id, name, amount, category_id, start_date, end_date, closed_at, ' +
  'closed_reason, created_at, ' +
  'personal_expenses ( id, budget_id, title, amount, category_id, note, created_at )';

// ---- Row → model ----

export function mapProfile(r: ProfileRow): User {
  return { id: r.id, name: r.name, email: r.email ?? '', createdAt: Number(r.created_at) };
}

export function mapExpense(r: ExpenseRow): Expense {
  return {
    id: r.id,
    title: r.title,
    amount: Number(r.amount),
    categoryId: r.category_id as CategoryId,
    paidById: r.paid_by ?? '',
    note: r.note ?? undefined,
    createdAt: Number(r.created_at),
  };
}

export function mapGroup(r: GroupRow): Group {
  const startDate = Number(r.start_date);
  const endDate = Number(r.end_date);
  const members: Member[] = (r.group_members ?? [])
    .map((m) => (m.profiles ? { id: m.profiles.id, name: m.profiles.name } : null))
    .filter((m): m is Member => m != null);
  const expenses = (r.expenses ?? []).map(mapExpense).sort((a, b) => b.createdAt - a.createdAt);
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    startDate,
    endDate,
    days: daysBetweenInclusive(startDate, endDate),
    budget: Number(r.budget),
    currency: 'IDR',
    code: r.code,
    coverUrl: r.cover_url ?? '',
    createdAt: Number(r.created_at),
    createdBy: r.created_by,
    members,
    expenses,
    closedAt: r.closed_at == null ? null : Number(r.closed_at),
    closedReason: r.closed_reason,
  };
}

export function mapPersonalExpense(r: PersonalExpenseRow): PersonalExpense {
  return {
    id: r.id,
    title: r.title,
    amount: Number(r.amount),
    categoryId: r.category_id as CategoryId,
    note: r.note ?? undefined,
    createdAt: Number(r.created_at),
  };
}

export function mapPersonalBudget(r: PersonalBudgetRow): PersonalBudget {
  const startDate = Number(r.start_date);
  const endDate = Number(r.end_date);
  const expenses = (r.personal_expenses ?? [])
    .map(mapPersonalExpense)
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    amount: Number(r.amount),
    currency: 'IDR',
    startDate,
    endDate,
    days: daysBetweenInclusive(startDate, endDate),
    categoryId: (r.category_id as CategoryId | null) ?? null,
    createdAt: Number(r.created_at),
    expenses,
    closedAt: r.closed_at == null ? null : Number(r.closed_at),
    closedReason: r.closed_reason,
  };
}

// ---- model → row (for writes). Only the columns the client sets. ----

export function groupToRow(g: Group) {
  return {
    id: g.id,
    name: g.name,
    destination: g.destination,
    start_date: g.startDate,
    end_date: g.endDate,
    budget: g.budget,
    currency: g.currency,
    code: g.code,
    cover_url: g.coverUrl,
    created_by: g.createdBy,
    closed_at: g.closedAt,
    closed_reason: g.closedReason,
    created_at: g.createdAt,
  };
}

export function expenseToRow(groupId: string, e: Expense) {
  return {
    id: e.id,
    group_id: groupId,
    title: e.title,
    amount: e.amount,
    category_id: e.categoryId,
    paid_by: e.paidById || null,
    note: e.note ?? null,
    created_at: e.createdAt,
  };
}

export function budgetToRow(b: PersonalBudget) {
  return {
    id: b.id,
    user_id: b.userId,
    name: b.name,
    amount: b.amount,
    category_id: b.categoryId ?? null,
    start_date: b.startDate,
    end_date: b.endDate,
    closed_at: b.closedAt,
    closed_reason: b.closedReason,
    created_at: b.createdAt,
  };
}

export function personalExpenseToRow(budgetId: string, e: PersonalExpense) {
  return {
    id: e.id,
    budget_id: budgetId,
    title: e.title,
    amount: e.amount,
    category_id: e.categoryId,
    note: e.note ?? null,
    created_at: e.createdAt,
  };
}
