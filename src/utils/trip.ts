// Trip lifecycle: where a trip sits in time (upcoming / ongoing / ended),
// whether it's closed, a human day-counter, and a migration that backfills the
// date/close fields onto trips saved before this feature existed.

import { Group } from '@/types';
import { addDays, daysBetweenInclusive, DAY_MS, startOfDay } from '@/utils/dates';

export type TripPhase = 'upcoming' | 'ongoing' | 'ended';

export function tripPhase(group: Group, now: number = Date.now()): TripPhase {
  const today = startOfDay(now);
  if (today < group.startDate) return 'upcoming';
  if (today > group.endDate) return 'ended';
  return 'ongoing';
}

// A trip is closed if a member closed it, or its dates have already passed —
// the latter holds even before the auto-close sweep stamps `closedAt`.
export function isTripClosed(group: Group, now: number = Date.now()): boolean {
  return group.closedAt != null || tripPhase(group, now) === 'ended';
}

// Manually-closed trips can be reopened; ones closed because the dates passed
// cannot (reopening wouldn't change that they're over).
export function canReopen(group: Group, now: number = Date.now()): boolean {
  return group.closedAt != null && tripPhase(group, now) !== 'ended';
}

export function closedLabel(group: Group, now: number = Date.now()): string {
  return group.closedReason === 'ended' || tripPhase(group, now) === 'ended' ? 'Ended' : 'Closed';
}

export type TripDayInfo = {
  phase: TripPhase;
  total: number;
  currentDay: number;
  remainingDays: number;
  label: string;
};

export function tripDayInfo(group: Group, now: number = Date.now()): TripDayInfo {
  const total = daysBetweenInclusive(group.startDate, group.endDate);
  const phase = tripPhase(group, now);
  const today = startOfDay(now);

  if (phase === 'upcoming') {
    const inDays = Math.round((group.startDate - today) / DAY_MS);
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
  const currentDay = daysBetweenInclusive(group.startDate, today);
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
export function migrateGroup(g: Group): Group {
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

// Stamp `closedAt` on any open trip whose end date has passed. Returns the same
// array reference when nothing changed so callers can skip needless writes.
export function sweepAutoClose(
  groups: Group[],
  now: number = Date.now()
): { groups: Group[]; changed: boolean } {
  let changed = false;
  const next = groups.map((g) => {
    if (g.closedAt == null && tripPhase(g, now) === 'ended') {
      changed = true;
      return { ...g, closedAt: now, closedReason: 'ended' as const };
    }
    return g;
  });
  return changed ? { groups: next, changed } : { groups, changed };
}
