export function digitsOnly(text = ''): string {
  return String(text).replace(/[^0-9]/g, '');
}

function groupThousands(numeric: string | number): string {
  return String(numeric).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatIDR(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n < 0 ? '-' : ''}Rp ${groupThousands(Math.abs(n))}`;
}

// Short form for tight layouts: "Rp 2,5 jt", "Rp 750 rb".
export function formatIDRCompact(amount: number): string {
  const n = Math.abs(Math.round(Number(amount) || 0));
  const sign = Number(amount) < 0 ? '-' : '';
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (n >= 1e9) return `${sign}Rp ${fmt(n / 1e9)} M`;
  if (n >= 1e6) return `${sign}Rp ${fmt(n / 1e6)} jt`;
  if (n >= 1e3) return `${sign}Rp ${fmt(n / 1e3)} rb`;
  return `${sign}Rp ${n}`;
}

// Live thousand-grouping while the user types an amount.
export function formatAmountInput(text: string): string {
  const d = digitsOnly(text);
  return d ? groupThousands(d) : '';
}

// Ambiguous glyphs (0/O, 1/I/L) removed so codes survive being read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(existing: string[] = []): string {
  let code = '';
  do {
    code = Array.from(
      { length: 6 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join('');
  } while (existing.includes(code));
  return code;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function initials(name = ''): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((w) => (w[0] ?? '').toUpperCase()).join('') || '?';
}

export function firstName(name = ''): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function greetingByHour(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
