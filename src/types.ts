export type CategoryId = 'food' | 'transport' | 'stay' | 'activity' | 'shopping' | 'other';

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
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
  days: number;
  budget: number;
  currency: 'IDR';
  code: string;
  coverUrl: string;
  createdAt: number;
  createdBy: string;
  members: Member[];
  expenses: Expense[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  // True when the reply came from the local rule engine because the LLM
  // request failed (offline, rate-limited free tier, timeout).
  offline?: boolean;
};
