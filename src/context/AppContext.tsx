import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { CategoryId, Group, User } from '@/types';
import { generateInviteCode, uid } from '@/utils/format';
import { imageForDestination } from '@/utils/images';

// Local mock backend: the whole "database" lives in AsyncStorage on this
// device, so invite codes work across accounts on the same phone. To go to
// production, keep this API surface and swap the internals for real HTTP
// calls (Supabase/Firebase/your own server) — screens won't need to change.

const DB_KEY = 'trivio:db:v1';
const SESSION_KEY = 'trivio:session:v1';

type Db = { users: User[]; groups: Group[] };
const EMPTY_DB: Db = { users: [], groups: [] };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type NewExpense = {
  title: string;
  amount: number;
  categoryId: CategoryId;
  paidById: string;
  note?: string;
};

type AppContextValue = {
  hydrated: boolean;
  user: User | null;
  myGroups: Group[];
  register: (input: { name: string; email: string; password: string }) => Result<User>;
  login: (input: { email: string; password: string }) => Result<User>;
  logout: () => void;
  createGroup: (input: {
    name: string;
    destination: string;
    days: number;
    budget: number;
  }) => Result<Group>;
  joinGroup: (code: string) => Result<Group>;
  addExpense: (groupId: string, expense: NewExpense) => void;
  deleteExpense: (groupId: string, expenseId: string) => void;
  getGroup: (groupId: string) => Group | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(EMPTY_DB);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawDb, rawSession] = await Promise.all([
          AsyncStorage.getItem(DB_KEY),
          AsyncStorage.getItem(SESSION_KEY),
        ]);
        if (rawDb) setDb({ ...EMPTY_DB, ...JSON.parse(rawDb) });
        if (rawSession) setSessionId(JSON.parse(rawSession));
      } catch {
        // Corrupted storage: boot with a fresh database instead of crashing.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(DB_KEY, JSON.stringify(db)).catch(() => {});
  }, [db, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (sessionId) AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionId)).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  }, [sessionId, hydrated]);

  const user = useMemo(
    () => db.users.find((u) => u.id === sessionId) ?? null,
    [db.users, sessionId]
  );

  const myGroups = useMemo(
    () =>
      user
        ? db.groups
            .filter((g) => g.members.some((m) => m.id === user.id))
            .sort((a, b) => b.createdAt - a.createdAt)
        : [],
    [db.groups, user]
  );

  const register = useCallback<AppContextValue['register']>(
    ({ name, email, password }) => {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      if (cleanName.length < 2) return { ok: false, error: 'Enter your full name.' };
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail))
        return { ok: false, error: 'Enter a valid email address.' };
      if (password.length < 6)
        return { ok: false, error: 'Password needs at least 6 characters.' };
      if (db.users.some((u) => u.email === cleanEmail))
        return { ok: false, error: 'An account with this email already exists. Try logging in.' };
      const newUser: User = {
        id: uid('usr'),
        name: cleanName,
        email: cleanEmail,
        password,
        createdAt: Date.now(),
      };
      setDb((prev) => ({ ...prev, users: [...prev.users, newUser] }));
      setSessionId(newUser.id);
      return { ok: true, value: newUser };
    },
    [db.users]
  );

  const login = useCallback<AppContextValue['login']>(
    ({ email, password }) => {
      const cleanEmail = email.trim().toLowerCase();
      const found = db.users.find((u) => u.email === cleanEmail);
      if (!found || found.password !== password)
        return { ok: false, error: "Email or password doesn't match. Try again." };
      setSessionId(found.id);
      return { ok: true, value: found };
    },
    [db.users]
  );

  const logout = useCallback(() => setSessionId(null), []);

  const createGroup = useCallback<AppContextValue['createGroup']>(
    ({ name, destination, days, budget }) => {
      if (!user) return { ok: false, error: 'You need to be logged in.' };
      const group: Group = {
        id: uid('grp'),
        name: name.trim(),
        destination: destination.trim(),
        days,
        budget,
        currency: 'IDR',
        code: generateInviteCode(db.groups.map((g) => g.code)),
        coverUrl: imageForDestination(destination),
        createdAt: Date.now(),
        createdBy: user.id,
        members: [{ id: user.id, name: user.name }],
        expenses: [],
      };
      setDb((prev) => ({ ...prev, groups: [group, ...prev.groups] }));
      return { ok: true, value: group };
    },
    [db.groups, user]
  );

  const joinGroup = useCallback<AppContextValue['joinGroup']>(
    (codeInput) => {
      if (!user) return { ok: false, error: 'You need to be logged in.' };
      const code = codeInput.trim().toUpperCase();
      const group = db.groups.find((g) => g.code === code);
      if (!group)
        return {
          ok: false,
          error: 'No trip found with that code. Double-check it with your organizer.',
        };
      if (group.members.some((m) => m.id === user.id))
        return { ok: false, error: "You're already a member of this trip." };
      const updated: Group = {
        ...group,
        members: [...group.members, { id: user.id, name: user.name }],
      };
      setDb((prev) => ({
        ...prev,
        groups: prev.groups.map((g) => (g.id === group.id ? updated : g)),
      }));
      return { ok: true, value: updated };
    },
    [db.groups, user]
  );

  const addExpense = useCallback<AppContextValue['addExpense']>((groupId, input) => {
    const expense = {
      id: uid('exp'),
      title: input.title.trim(),
      amount: input.amount,
      categoryId: input.categoryId,
      paidById: input.paidById,
      note: input.note?.trim() || undefined,
      createdAt: Date.now(),
    };
    setDb((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, expenses: [expense, ...g.expenses] } : g
      ),
    }));
  }, []);

  const deleteExpense = useCallback<AppContextValue['deleteExpense']>((groupId, expenseId) => {
    setDb((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) } : g
      ),
    }));
  }, []);

  const getGroup = useCallback<AppContextValue['getGroup']>(
    (groupId) => db.groups.find((g) => g.id === groupId) ?? null,
    [db.groups]
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
    deleteExpense,
    getGroup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
