// Trip lifecycle: where a trip sits in time (upcoming / ongoing / ended),
// whether it's closed, a human day-counter, and a migration that backfills the
// date/close fields onto trips saved before this feature existed.
//
// Every function here is structurally typed over TripLike rather than Group,
// so PersonalBudget — which shares the same date-range/lifecycle shape —
// reuses this exact same implementation instead of a second copy.

import { Group } from '@/types';
import { addDays, daysBetweenInclusive, DAY_MS, startOfDay } from '@/utils/dates';

export type TripLike = Pick<
  Group,
  'startDate' | 'endDate' | 'days' | 'closedAt' | 'closedReason' | 'createdAt'
>;

export type TripPhase = 'upcoming' | 'ongoing' | 'ended';

export function tripPhase<T extends TripLike>(item: T, now: number = Date.now()): TripPhase {
  const today = startOfDay(now);
  if (today < item.startDate) return 'upcoming';
  if (today > item.endDate) return 'ended';
  return 'ongoing';
}

// A trip is closed if a member closed it, or its dates have already passed —
// the latter holds even before the auto-close sweep stamps `closedAt`.
export function isTripClosed<T extends TripLike>(item: T, now: number = Date.now()): boolean {
  return item.closedAt != null || tripPhase(item, now) === 'ended';
}

// Manually-closed trips can be reopened; ones closed because the dates passed
// cannot (reopening wouldn't change that they're over).
export function canReopen<T extends TripLike>(item: T, now: number = Date.now()): boolean {
  return item.closedAt != null && tripPhase(item, now) !== 'ended';
}

export function closedLabel<T extends TripLike>(item: T, now: number = Date.now()): string {
  return item.closedReason === 'ended' || tripPhase(item, now) === 'ended' ? 'Ended' : 'Closed';
}

export type TripDayInfo = {
  phase: TripPhase;
  total: number;
  currentDay: number;
  remainingDays: number;
  label: string;
};

export function tripDayInfo<T extends TripLike>(item: T, now: number = Date.now()): TripDayInfo {
  const total = daysBetweenInclusive(item.startDate, item.endDate);
  const phase = tripPhase(item, now);
  const today = startOfDay(now);

  if (phase === 'upcoming') {
    const inDays = Math.round((item.startDate - today) / DAY_MS);
    return {
      phase,
      total,
      currentDay: 0,
      remainingDays: total,
      label: inDays === 0 ? 'Starts today' : `Starts in ${inDays} day${inDays === 1 ? '' : 's'}`,
    };
  }
  if (phase === 'ended') {
    return { phase, total, currentDay: total, remainingDays: 0, label: 'Trip ended' };
  }
  const currentDay = daysBetweenInclusive(item.startDate, today);
  return {
    phase,
    total,
    currentDay,
    remainingDays: total - currentDay,
    label: `Day ${currentDay} of ${total}`,
  };
}

// Backfill dates/close fields on trips persisted before this feature. Old trips
// only had `days` + `createdAt`, so we anchor the range at the creation day.
// Only ever called on Group today (PersonalBudget has no legacy shape to
// backfill), but stays generic alongside its siblings above.
export function migrateGroup<T extends TripLike>(g: T): T {
  const days = Math.max(1, g.days || 1);
  const startDate = g.startDate ?? startOfDay(g.createdAt ?? Date.now());
  const endDate = g.endDate ?? addDays(startDate, days - 1);
  return {
    ...g,
    startDate,
    endDate,
    days: daysBetweenInclusive(startDate, endDate),
    closedAt: g.closedAt ?? null,
    closedReason: g.closedReason ?? null,
  };
}

// Stamp `closedAt` on any open trip/budget whose end date has passed. Returns
// the same array reference when nothing changed so callers can skip needless
// writes.
export function sweepAutoClose<T extends TripLike>(
  items: T[],
  now: number = Date.now()
): { items: T[]; changed: boolean } {
  let changed = false;
  const next = items.map((item) => {
    if (item.closedAt == null && tripPhase(item, now) === 'ended') {
      changed = true;
      return { ...item, closedAt: now, closedReason: 'ended' as const };
    }
    return item;
  });
  return changed ? { items: next, changed } : { items, changed };
}
