// Cover photos picked by destination keyword. Plain Unsplash CDN URLs with
// fixed 1200x800 crops — swap for your own CDN / user uploads in production.

type DestinationImage = { match: string[]; url: string };

const COVERS: DestinationImage[] = [
  {
    match: ['bali', 'beach', 'pantai', 'island', 'lombok', 'phuket', 'maldives', 'nusa'],
    url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=1200&h=800&fit=crop',
  },
  {
    match: ['mountain', 'bromo', 'rinjani', 'alps', 'hike', 'gunung', 'dieng'],
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&h=800&fit=crop',
  },
  {
    match: ['tokyo', 'japan', 'kyoto', 'osaka'],
    url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1200&h=800&fit=crop',
  },
  {
    match: ['paris', 'london', 'rome', 'europe', 'amsterdam'],
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200&h=800&fit=crop',
  },
  {
    match: ['jakarta', 'singapore', 'bangkok', 'seoul', 'kuala', 'city'],
    url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1200&h=800&fit=crop',
  },
];

const FALLBACK =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1200&h=800&fit=crop';

export function imageForDestination(destination = ''): string {
  const q = destination.toLowerCase();
  const hit = COVERS.find((c) => c.match.some((m) => q.includes(m)));
  return hit ? hit.url : FALLBACK;
}
