// All Supabase reads/writes for Trivio's data (auth lives in AppContext). Every
// function returns app models via the mappers, or throws the PostgrestError so
// AppContext can catch it, reconcile the optimistic cache, and/or surface a
// message. Nothing here touches React.

import { supabase } from '@/lib/supabase';
import {
  BUDGET_SELECT,
  GROUP_SELECT,
  GroupRow,
  PersonalBudgetRow,
  budgetToRow,
  expenseToRow,
  groupToRow,
  mapGroup,
  mapPersonalBudget,
  personalExpenseToRow,
} from '@/data/supabase/mappers';
import { Expense, Group, PersonalBudget, PersonalExpense, User } from '@/types';
import { generateInviteCode } from '@/utils/format';

const isUniqueViolation = (error: { code?: string } | null) => error?.code === '23505';

// ---- Profile ----

// Guarantee the signed-in user has a profiles row before any group write, since
// groups.created_by / expenses.paid_by / group_members.user_id all FK to it.
// The DB trigger normally creates it at sign-up, but this makes the client
// self-healing for accounts created before the trigger existed (or if it
// failed). RLS lets a user insert their own profile (auth.uid() = id), and we
// treat "already exists" (23505) as success rather than overwriting it.
export async function ensureProfile(user: User): Promise<void> {
  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.createdAt,
  });
  if (error && !isUniqueViolation(error)) {
    console.warn('[Trivio] ensureProfile failed', error.message ?? error);
  }
}

export type JoinResult =
  | { ok: true; group: Group }
  | { ok: false; reason: 'NO_GROUP' | 'ALREADY_MEMBER' | 'UNKNOWN' };

// ---- Groups ----

export async function fetchMyGroups(): Promise<Group[]> {
  // RLS scopes this to groups the caller is a member of.
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as GroupRow[]).map(mapGroup);
}

export async function fetchGroupById(id: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGroup(data as unknown as GroupRow) : null;
}

// Inserts the group row plus the creator's membership row. Retries with a fresh
// invite code on the (astronomically rare) unique-code collision. Returns the
// code actually persisted so the caller can reflect it in the cache/UI.
export async function insertGroup(group: Group, userId: string): Promise<string> {
  let code = group.code;
  for (let attempt = 0; ; attempt++) {
    const { error } = await supabase.from('groups').insert(groupToRow({ ...group, code }));
    if (!error) break;
    if (isUniqueViolation(error) && attempt < 4) {
      code = generateInviteCode();
      continue;
    }
    throw error;
  }
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId });
  if (memberError) throw memberError;
  return code;
}

export async function joinGroupByCode(code: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code });
  if (error) {
    const message = error.message ?? '';
    if (message.includes('NO_GROUP')) return { ok: false, reason: 'NO_GROUP' };
    if (message.includes('ALREADY_MEMBER')) return { ok: false, reason: 'ALREADY_MEMBER' };
    return { ok: false, reason: 'UNKNOWN' };
  }
  // The RPC returns the bare group row; refetch to hydrate members/expenses.
  const full = await fetchGroupById((data as { id: string }).id);
  if (!full) return { ok: false, reason: 'UNKNOWN' };
  return { ok: true, group: full };
}

export async function insertExpense(groupId: string, expense: Expense): Promise<void> {
  const { error } = await supabase.from('expenses').insert(expenseToRow(groupId, expense));
  if (error) throw error;
}

export async function updateExpense(expenseId: string, expense: Expense): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({
      title: expense.title,
      amount: expense.amount,
      category_id: expense.categoryId,
      paid_by: expense.paidById || null,
      note: expense.note ?? null,
    })
    .eq('id', expenseId);
  if (error) throw error;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

export async function setGroupClosed(
  groupId: string,
  closedAt: number | null,
  closedReason: 'manual' | 'ended' | null
): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ closed_at: closedAt, closed_reason: closedReason })
    .eq('id', groupId);
  if (error) throw error;
}

// ---- Personal budgets ----

export async function fetchMyBudgets(): Promise<PersonalBudget[]> {
  const { data, error } = await supabase
    .from('personal_budgets')
    .select(BUDGET_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as PersonalBudgetRow[]).map(mapPersonalBudget);
}

export async function insertBudget(budget: PersonalBudget): Promise<void> {
  const { error } = await supabase.from('personal_budgets').insert(budgetToRow(budget));
  if (error) throw error;
}

export async function insertPersonalExpense(
  budgetId: string,
  expense: PersonalExpense
): Promise<void> {
  const { error } = await supabase
    .from('personal_expenses')
    .insert(personalExpenseToRow(budgetId, expense));
  if (error) throw error;
}

export async function deletePersonalExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from('personal_expenses').delete().eq('id', expenseId);
  if (error) throw error;
}
