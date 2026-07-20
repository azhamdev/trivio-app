import { Ionicons } from '@expo/vector-icons';

import { CategoryId } from '@/types';

export type Category = {
  id: CategoryId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  tint: string;
};

export const CATEGORIES: Category[] = [
  { id: 'food', label: 'Food & Drinks', icon: 'restaurant-outline', color: '#F59E0B', tint: '#FEF3E2' },
  { id: 'transport', label: 'Transport', icon: 'bus-outline', color: '#0194F3', tint: '#E8F4FE' },
  { id: 'stay', label: 'Accommodation', icon: 'bed-outline', color: '#8B5CF6', tint: '#F1EBFE' },
  { id: 'activity', label: 'Activities', icon: 'ticket-outline', color: '#10B981', tint: '#E7F8F1' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle-outline', color: '#EC4899', tint: '#FDEAF3' },
  { id: 'other', label: 'Other', icon: 'apps-outline', color: '#64748B', tint: '#EEF2F6' },
];

export function categoryById(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
