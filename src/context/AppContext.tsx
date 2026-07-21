import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  deleteExpense as qDeleteExpense,
  deletePersonalExpense as qDeletePersonalExpense,
  ensureProfile,
  fetchMyBudgets,
  fetchMyGroups,
  insertBudget,
  insertExpense as qInsertExpense,
  insertGroup,
  insertPersonalExpense as qInsertPersonalExpense,
  joinGroupByCode,
  setGroupClosed,
  updateExpense as qUpdateExpense,
} from '@/data/supabase/queries';
import { supabase } from '@/lib/supabase';
import { CategoryId, Expense, Group, PersonalBudget, PersonalExpense, User } from '@/types';
import { daysBetweenInclusive } from '@/utils/dates';
import { generateInviteCode, uid } from '@/utils/format';
import { imageForDestination } from '@/utils/images';
import { canReopen, isTripClosed, tripPhase } from '@/utils/trip';

// Backend: Supabase (Postgres + Auth). This provider keeps the exact same
// exported hook surface the local AsyncStorage mock had — screens are unchanged
// except that the mutators are now async (they always were "fire and forget"
// from the UI's perspective; the ones returning a Result are awaited).
//
// Reads use a local cache (`groups`/`budgets`) hydrated on login and kept fresh
// by realtime subscriptions, so the synchronous selectors (getGroup, myGroups)
// keep working. Writes update the cache optimistically, then persist; on a
// failed write we refetch to roll the cache back to server truth. "Ended" is
// purely date-derived (see utils/trip), so there's no client auto-close timer
// anymore — the server enforces the locked-ledger rule via RLS.

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type NewExpense = {
  title: string;
  amount: number;
  categoryId: CategoryId;
  paidById: string;
  note?: string;
};

type NewPersonalBudget = {
  name: string;
  amount: number;
  startDate: number;
  endDate: number;
  categoryId?: CategoryId | null;
};

type NewPersonalExpense = {
  title: string;
  amount: number;
  categoryId: CategoryId;
  note?: string;
};

type AppContextValue = {
  hydrated: boolean;
  user: User | null;
  myGroups: Group[];
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<Result<User>>;
  login: (input: { email: string; password: string }) => Promise<Result<User>>;
  logout: () => Promise<void>;
  createGroup: (input: {
    name: string;
    destination: string;
    startDate: number;
    endDate: number;
    budget: number;
  }) => Promise<Result<Group>>;
  joinGroup: (code: string) => Promise<Result<Group>>;
  addExpense: (groupId: string, expense: NewExpense) => Promise<void>;
  // Edit/delete are restricted to the trip creator (see impl) and locked once
  // the trip is closed.
  updateExpense: (groupId: string, expenseId: string, expense: NewExpense) => Promise<void>;
  deleteExpense: (groupId: string, expenseId: string) => Promise<void>;
  canManageExpenses: (group: Group) => boolean;
  closeTrip: (groupId: string) => Promise<void>;
  reopenTrip: (groupId: string) => Promise<void>;
  getGroup: (groupId: string) => Group | null;
  myBudgets: PersonalBudget[];
  createPersonalBudget: (input: NewPersonalBudget) => Promise<Result<PersonalBudget>>;
  addPersonalExpense: (budgetId: string, expense: NewPersonalExpense) => Promise<void>;
  deletePersonalExpense: (budgetId: string, expenseId: string) => Promise<void>;
  getPersonalBudget: (budgetId: string) => PersonalBudget | null;
};

const AppContext = createContext<AppContextValue | null>(null);

// The current user's profile is derived straight from the auth session (id,
// email, metadata name) so it needs no extra `profiles` read and no race with
// the new-user trigger. The `profiles` table is only for looking up *other*
// members' names.
function userFromSession(su: Session['user']): User {
  const metaName = (su.user_metadata?.name as string | undefined)?.trim();
  return {
    id: su.id,
    name: metaName || (su.email ? su.email.split('@')[0] : 'You'),
    email: su.email ?? '',
    createdAt: su.created_at ? new Date(su.created_at).getTime() : Date.now(),
  };
}

// Open trips/budgets first (newest first), closed/ended ones sink to the bottom.
function byLifecycleThenRecency<T extends Parameters<typeof isTripClosed>[0] & { createdAt: number }>(
  a: T,
  b: T
): number {
  const closedDiff = Number(isTripClosed(a)) - Number(isTripClosed(b));
  return closedDiff !== 0 ? closedDiff : b.createdAt - a.createdAt;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [budgets, setBudgets] = useState<PersonalBudget[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Refs mirror the latest cache so mutators can read/guard current state
  // without listing groups/budgets in every useCallback dependency array.
  const groupsRef = useRef<Group[]>([]);
  const budgetsRef = useRef<PersonalBudget[]>([]);
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  useEffect(() => {
    budgetsRef.current = budgets;
  }, [budgets]);

  const refreshGroups = useCallback(async () => {
    try {
      setGroups(await fetchMyGroups());
    } catch {
      // Keep the last-known cache on a transient fetch failure.
    }
  }, []);

  const refreshBudgets = useCallback(async () => {
    try {
      setBudgets(await fetchMyBudgets());
    } catch {
      // Keep the last-known cache on a transient fetch failure.
    }
  }, []);

  // Apply an auth session: swap identity and (re)load data only when the user
  // actually changed, so hourly token refreshes don't trigger needless refetches.
  const bootstrap = useCallback(
    async (session: Session | null, markHydrated: boolean) => {
      const su = session?.user ?? null;
      const nextId = su?.id ?? null;
      if (nextId !== currentUserIdRef.current) {
        currentUserIdRef.current = nextId;
        if (!su) {
          setUser(null);
          setGroups([]);
          setBudgets([]);
        } else {
          const nextUser = userFromSession(su);
          setUser(nextUser);
          // Make sure the profile row exists before any group/expense write can
          // FK against it, then load the user's data.
          await ensureProfile(nextUser);
          await Promise.all([refreshGroups(), refreshBudgets()]);
        }
      }
      if (markHydrated) setHydrated(true);
    },
    [refreshGroups, refreshBudgets]
  );

  useEffect(() => {
    // supabase-js emits INITIAL_SESSION on subscribe (with the restored session
    // or null) — that's our boot signal. Data loading is deferred out of the
    // callback with setTimeout(0) because calling other supabase methods
    // synchronously inside onAuthStateChange can deadlock its internal lock.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        bootstrap(session, event === 'INITIAL_SESSION');
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [bootstrap]);

  // Realtime: co-members' (and this user's other devices') changes refetch the
  // affected collection. RLS governs which change events reach this client, so
  // we only hear about rows we're allowed to see. If realtime isn't enabled the
  // subscription is simply inert — fetch-on-mount + optimistic writes still work.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('trivio-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, refreshGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, refreshGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, refreshGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_budgets' }, refreshBudgets)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personal_expenses' }, refreshBudgets)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshGroups, refreshBudgets]);

  const myGroups = useMemo(() => [...groups].sort(byLifecycleThenRecency), [groups]);
  const myBudgets = useMemo(() => [...budgets].sort(byLifecycleThenRecency), [budgets]);

  const register = useCallback<AppContextValue['register']>(async ({ name, email, password }) => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 2) return { ok: false, error: 'Enter your full name.' };
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail))
      return { ok: false, error: 'Enter a valid email address.' };
    if (password.length < 6)
      return { ok: false, error: 'Password needs at least 6 characters.' };
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name: cleanName } },
    });
    if (error) {
      const friendly = /already registered|already exists|already been registered/i.test(error.message)
        ? 'An account with this email already exists. Try logging in.'
        : error.message;
      return { ok: false, error: friendly };
    }
    if (!data.session) {
      // Email confirmation is enabled on the project — no session yet. (Turn it
      // off under Auth → Providers → Email for the instant-login flow.)
      return { ok: false, error: 'Check your email to confirm your account, then log in.' };
    }
    // onAuthStateChange (SIGNED_IN) sets `user` and loads data; return the value
    // for callers that read it, though navigation is driven by the auth guard.
    return { ok: true, value: userFromSession(data.session.user) };
  }, []);

  const login = useCallback<AppContextValue['login']>(async ({ email, password }) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error || !data.session)
      return { ok: false, error: "Email or password doesn't match. Try again." };
    return { ok: true, value: userFromSession(data.session.user) };
  }, []);

  const logout = useCallback<AppContextValue['logout']>(async () => {
    await supabase.auth.signOut();
  }, []);

  const createGroup = useCallback<AppContextValue['createGroup']>(
    async ({ name, destination, startDate, endDate, budget }) => {
      if (!user) return { ok: false, error: 'You need to be logged in.' };
      const group: Group = {
        id: uid('grp'),
        name: name.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        days: daysBetweenInclusive(startDate, endDate),
        budget,
        currency: 'IDR',
        code: generateInviteCode(),
        coverUrl: imageForDestination(destination),
        createdAt: Date.now(),
        createdBy: user.id,
        members: [{ id: user.id, name: user.name }],
        expenses: [],
        closedAt: null,
        closedReason: null,
      };
      try {
        const code = await insertGroup(group, user.id);
        const saved = { ...group, code };
        setGroups((prev) => [saved, ...prev]);
        return { ok: true, value: saved };
      } catch (error) {
        console.warn('[Trivio] createGroup failed', (error as { message?: string })?.message ?? error);
        return {
          ok: false,
          error: 'Could not create the trip. Check your connection and try again.',
        };
      }
    },
    [user]
  );

  const joinGroup = useCallback<AppContextValue['joinGroup']>(
    async (codeInput) => {
      if (!user) return { ok: false, error: 'You need to be logged in.' };
      const result = await joinGroupByCode(codeInput.trim().toUpperCase());
      if (!result.ok) {
        const messages: Record<typeof result.reason, string> = {
          NO_GROUP: 'No trip found with that code. Double-check it with your organizer.',
          ALREADY_MEMBER: "You're already a member of this trip.",
          UNKNOWN: 'Could not join the trip. Check your connection and try again.',
        };
        return { ok: false, error: messages[result.reason] };
      }
      setGroups((prev) => [result.group, ...prev.filter((g) => g.id !== result.group.id)]);
      return { ok: true, value: result.group };
    },
    [user]
  );

  const addExpense = useCallback<AppContextValue['addExpense']>(
    async (groupId, input) => {
      const target = groupsRef.current.find((g) => g.id === groupId);
      // Ignore writes to a closed trip — its ledger is locked.
      if (!target || isTripClosed(target)) return;
      const expense: Expense = {
        id: uid('exp'),
        title: input.title.trim(),
        amount: input.amount,
        categoryId: input.categoryId,
        paidById: input.paidById,
        note: input.note?.trim() || undefined,
        createdAt: Date.now(),
      };
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, expenses: [expense, ...g.expenses] } : g))
      );
      try {
        await qInsertExpense(groupId, expense);
      } catch {
        await refreshGroups();
      }
    },
    [refreshGroups]
  );

  // Only the trip creator may edit or delete entries, and never on a closed
  // (locked) trip. RLS enforces the same rule server-side.
  const canManageExpenses = useCallback<AppContextValue['canManageExpenses']>(
    (group) => !!user && group.createdBy === user.id && !isTripClosed(group),
    [user]
  );

  const updateExpense = useCallback<AppContextValue['updateExpense']>(
    async (groupId, expenseId, input) => {
      const target = groupsRef.current.find((g) => g.id === groupId);
      if (!user || !target || target.createdBy !== user.id || isTripClosed(target)) return;
      const patch = {
        title: input.title.trim(),
        amount: input.amount,
        categoryId: input.categoryId,
        paidById: input.paidById,
        note: input.note?.trim() || undefined,
      };
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                expenses: g.expenses.map((e) => (e.id === expenseId ? { ...e, ...patch } : e)),
              }
            : g
        )
      );
      try {
        await qUpdateExpense(expenseId, { id: expenseId, createdAt: Date.now(), ...patch });
      } catch {
        await refreshGroups();
      }
    },
    [user, refreshGroups]
  );

  const deleteExpense = useCallback<AppContextValue['deleteExpense']>(
    async (groupId, expenseId) => {
      const target = groupsRef.current.find((g) => g.id === groupId);
      if (!user || !target || target.createdBy !== user.id || isTripClosed(target)) return;
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) } : g
        )
      );
      try {
        await qDeleteExpense(expenseId);
      } catch {
        await refreshGroups();
      }
    },
    [user, refreshGroups]
  );

  const closeTrip = useCallback<AppContextValue['closeTrip']>(
    async (groupId) => {
      const target = groupsRef.current.find((g) => g.id === groupId);
      if (!target || target.closedAt != null) return;
      const closedAt = Date.now();
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, closedAt, closedReason: 'manual' as const } : g
        )
      );
      try {
        await setGroupClosed(groupId, closedAt, 'manual');
      } catch {
        await refreshGroups();
      }
    },
    [refreshGroups]
  );

  const reopenTrip = useCallback<AppContextValue['reopenTrip']>(
    async (groupId) => {
      const target = groupsRef.current.find((g) => g.id === groupId);
      // A trip whose dates already passed stays closed; only manual closes undo.
      if (!target || !canReopen(target)) return;
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId && tripPhase(g) !== 'ended'
            ? { ...g, closedAt: null, closedReason: null }
            : g
        )
      );
      try {
        await setGroupClosed(groupId, null, null);
      } catch {
        await refreshGroups();
      }
    },
    [refreshGroups]
  );

  const getGroup = useCallback<AppContextValue['getGroup']>(
    (groupId) => groups.find((g) => g.id === groupId) ?? null,
    [groups]
  );

  const createPersonalBudget = useCallback<AppContextValue['createPersonalBudget']>(
    async ({ name, amount, startDate, endDate, categoryId }) => {
      if (!user) return { ok: false, error: 'You need to be logged in.' };
      const cleanName = name.trim();
      if (cleanName.length < 2) return { ok: false, error: 'Give the budget a name.' };
      if (!amount) return { ok: false, error: 'Set an amount so Trivio can track your pace.' };
      const budget: PersonalBudget = {
        id: uid('bud'),
        userId: user.id,
        name: cleanName,
        amount,
        currency: 'IDR',
        startDate,
        endDate,
        days: daysBetweenInclusive(startDate, endDate),
        categoryId: categoryId ?? null,
        createdAt: Date.now(),
        expenses: [],
        closedAt: null,
        closedReason: null,
      };
      try {
        await insertBudget(budget);
        setBudgets((prev) => [budget, ...prev]);
        return { ok: true, value: budget };
      } catch {
        return {
          ok: false,
          error: 'Could not create the budget. Check your connection and try again.',
        };
      }
    },
    [user]
  );

  const addPersonalExpense = useCallback<AppContextValue['addPersonalExpense']>(
    async (budgetId, input) => {
      const target = budgetsRef.current.find((b) => b.id === budgetId);
      if (!user || !target || target.userId !== user.id || isTripClosed(target)) return;
      const expense: PersonalExpense = {
        id: uid('pexp'),
        title: input.title.trim(),
        amount: input.amount,
        categoryId: input.categoryId,
        note: input.note?.trim() || undefined,
        createdAt: Date.now(),
      };
      setBudgets((prev) =>
        prev.map((b) => (b.id === budgetId ? { ...b, expenses: [expense, ...b.expenses] } : b))
      );
      try {
        await qInsertPersonalExpense(budgetId, expense);
      } catch {
        await refreshBudgets();
      }
    },
    [user, refreshBudgets]
  );

  const deletePersonalExpense = useCallback<AppContextValue['deletePersonalExpense']>(
    async (budgetId, expenseId) => {
      const target = budgetsRef.current.find((b) => b.id === budgetId);
      if (!user || !target || target.userId !== user.id || isTripClosed(target)) return;
      setBudgets((prev) =>
        prev.map((b) =>
          b.id === budgetId ? { ...b, expenses: b.expenses.filter((e) => e.id !== expenseId) } : b
        )
      );
      try {
        await qDeletePersonalExpense(expenseId);
      } catch {
        await refreshBudgets();
      }
    },
    [user, refreshBudgets]
  );

  const getPersonalBudget = useCallback<AppContextValue['getPersonalBudget']>(
    (budgetId) => budgets.find((b) => b.id === budgetId) ?? null,
    [budgets]
  );

  const value: AppContextValue = {
    hydrated,
    user,
    myGroups,
    register,
    login,
    logout,
    createGroup,
    joinGroup,
    addExpense,
    updateExpense,
    deleteExpense,
    canManageExpenses,
    closeTrip,
    reopenTrip,
    getGroup,
    myBudgets,
    createPersonalBudget,
    addPersonalExpense,
    deletePersonalExpense,
    getPersonalBudget,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
