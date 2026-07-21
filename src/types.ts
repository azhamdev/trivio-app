export type CategoryId = 'food' | 'transport' | 'stay' | 'activity' | 'shopping' | 'other';

// Auth credentials live in Supabase Auth, not here — this is just the profile.
export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
};

export type Member = {
  id: string;
  name: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  categoryId: CategoryId;
  paidById: string;
  note?: string;
  createdAt: number;
};

export type Group = {
  id: string;
  name: string;
  destination: string;
  // Local start-of-day timestamps. `days` is derived from the range
  // (inclusive) and kept denormalized for cheap display.
  startDate: number;
  endDate: number;
  days: number;
  budget: number;
  currency: 'IDR';
  code: string;
  coverUrl: string;
  createdAt: number;
  createdBy: string;
  members: Member[];
  expenses: Expense[];
  // Lifecycle: null while the trip is open. Set when the trip is closed —
  // either manually by a member or automatically once its end date passes.
  closedAt: number | null;
  closedReason: 'manual' | 'ended' | null;
};

export type PersonalExpense = {
  id: string;
  title: string;
  amount: number;
  categoryId: CategoryId;
  note?: string;
  createdAt: number;
};

// A lightweight, memberless sibling of Group: same date range/lifecycle
// shape (see utils/trip.ts's TripLike), no members/code/coverUrl/createdBy.
export type PersonalBudget = {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: 'IDR';
  startDate: number;
  endDate: number;
  days: number;
  // Optional: scope the budget to one category, else it tracks everything.
  categoryId?: CategoryId | null;
  createdAt: number;
  expenses: PersonalExpense[];
  closedAt: number | null;
  closedReason: 'manual' | 'ended' | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  // True when the reply came from the local rule engine because the LLM
  // request failed (offline, rate-limited free tier, timeout).
  offline?: boolean;
};
