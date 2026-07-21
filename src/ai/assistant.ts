// Local, rule-based assistant that answers questions from the trip's live
// numbers — works fully offline. To upgrade to a real LLM later, send the
// group data plus the question to your backend and let the backend call the
// model. Never ship a model API key inside the app bundle.

import { categoryById } from '@/data/categories';
import { Group, User } from '@/types';
import { firstName, formatIDR } from '@/utils/format';
import { groupStats } from '@/utils/stats';

export const SUGGESTIONS = [
  'Sisa budget berapa?',
  'Bagi rata per orang',
  'Kategori paling boros?',
  'Masih on track gak?',
  'Ide makanan sesuai budget?',
];

function hasAny(q: string, words: string[]): boolean {
  return words.some((w) => q.includes(w));
}

export function greetingMessage(group: Group, user: User | null): string {
  const stats = groupStats(group);
  const name = firstName(user?.name ?? 'kamu');
  if (stats.count === 0) {
    return `Hai ${name}! Aku pantau ${group.name} — budget ${formatIDR(group.budget)} buat ${group.days} hari, belum ada yang kecatat. Catat dulu pengeluarannya, terus tanya aku sisa budget, siapa yang udah bayar, atau masih on track gak.`;
  }
  return `Hai ${name}! ${group.name} sejauh ini: udah keluar ${formatIDR(stats.spent)} dari budget ${formatIDR(group.budget)}. Tanya aja sisa budget, bagi rata per orang, atau apakah masih on track.`;
}

export function answerQuestion(rawQuestion: string, group: Group, user: User | null): string {
  const q = rawQuestion.toLowerCase();
  const stats = groupStats(group);
  const members = group.members;
  const noData = stats.count === 0;

  // Recent activity
  if (hasAny(q, ['recent', 'latest', 'history', 'last expense', 'log', 'terbaru', 'terakhir', 'riwayat', 'catatan'])) {
    if (noData) return `Belum ada yang kecatat buat ${group.name}. Tap + di halaman trip buat nambahin pengeluaran pertama.`;
    const latest = [...group.expenses].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
    const lines = latest.map((e) => {
      const payer = members.find((m) => m.id === e.paidById);
      return `• ${e.title} — ${formatIDR(e.amount)} (${categoryById(e.categoryId).label}, dibayar ${payer ? firstName(payer.name) : 'seseorang'})`;
    });
    return `Pengeluaran terbaru:\n${lines.join('\n')}`;
  }

  // Who paid what / settle up
  if (hasAny(q, ['owe', 'split', 'settle', 'balance', 'who paid', 'per person', 'each', 'utang', 'bagi', 'lunas', 'saldo', 'siapa bayar', 'per orang', 'masing'])) {
    if (noData)
      return 'Belum ada pengeluaran, jadi belum ada yang perlu dibagi. Begitu mulai ada yang bayar, aku bisa kasih tau siapa yang udah lebih dan siapa yang masih perlu nombokin.';
    const lines = stats.byMember.map((b) => {
      const who = b.member.name === user?.name ? 'Kamu' : firstName(b.member.name);
      if (Math.abs(b.diff) < 1000) return `• ${who} udah bayar ${formatIDR(b.paid)} — pas`;
      return b.diff > 0
        ? `• ${who} udah bayar ${formatIDR(b.paid)} — masih ada tagihan ${formatIDR(b.diff)}`
        : `• ${who} udah bayar ${formatIDR(b.paid)} — masih nombok ${formatIDR(-b.diff)}`;
    });
    return `Total pengeluaran ${formatIDR(stats.spent)}, kalau dibagi rata jadi ${formatIDR(stats.perPersonShare)} per orang buat ${members.length} ${members.length === 1 ? 'anggota' : 'anggota'}.\n${lines.join('\n')}`;
  }

  // Pace vs. daily target
  if (hasAny(q, ['pace', 'track', 'daily', 'per day', 'a day', 'forecast', 'projection', 'sesuai target', 'harian', 'sehari', 'proyeksi', 'perkiraan'])) {
    if (noData)
      return `Target harian kamu ${formatIDR(stats.dailyTarget)} (budget ${formatIDR(group.budget)} buat ${group.days} hari). Belum ada yang kecatat, jadi budgetnya masih utuh.`;
    const verdict =
      stats.projected <= group.budget
        ? `lanjutin aja gaya segini, kira-kira totalnya bakal sekitar ${formatIDR(stats.projected)} — masih aman di dalam budget.`
        : `dengan ritme sekarang, totalnya bisa sekitar ${formatIDR(stats.projected)}, kelebihan sekitar ${formatIDR(stats.projected - group.budget)}. Mending agak direm dikit.`;
    return `Target harian: ${formatIDR(stats.dailyTarget)}. Rata-rata kamu keluar ${formatIDR(stats.dailyAverage)} dalam ${stats.activeDays} hari pengeluaran — ${verdict}`;
  }

  // Category breakdown
  if (hasAny(q, ['category', 'categories', 'biggest', 'most', 'top', 'breakdown', 'where', 'kategori', 'terbesar', 'paling', 'boros', 'kemana'])) {
    if (noData) return 'Belum ada pengeluaran — begitu ada beberapa yang kecatat, aku bisa bagi berdasarkan kategori.';
    const top = stats.byCategory
      .slice(0, 3)
      .map((x) => `• ${x.category.label}: ${formatIDR(x.total)} (${Math.round(x.share * 100)}%)`);
    const biggest = stats.biggest!;
    return `Kemana aja uangnya:\n${top.join('\n')}\nPengeluaran terbesar: ${biggest.title}, ${formatIDR(biggest.amount)}.`;
  }

  // Food recommendations against the remaining budget
  if (hasAny(q, ['food', 'eat', 'restaurant', 'cuisine', 'meal', 'dinner', 'lunch', 'breakfast', 'snack', 'makan', 'makanan', 'restoran', 'kuliner', 'sarapan', 'jajan'])) {
    const perPerson = stats.remaining / Math.max(1, members.length);
    if (stats.remaining <= 0) {
      return `Kamu udah kelebihan budget ${formatIDR(-stats.remaining)}, jadi mending cari makanan lokal yang murah meriah di ${group.destination} — jajanan kaki lima atau warung dulu, restoran belakangan sampai angkanya balik aman.`;
    }
    return `Sisa budget kamu ${formatIDR(stats.remaining)} (${formatIDR(perPerson)} per orang). Aku belum bisa cariin tempat spesifik pas offline, tapi segitu udah cukup buat makan enak di ${group.destination} — pilih jajanan kaki lima atau warung lokal biar lebih hemat daripada restoran turis. Coba tanya lagi pas online buat rekomendasi tempat yang lebih spesifik.`;
  }

  // Remaining budget
  if (hasAny(q, ['left', 'remaining', 'remain', 'sisa', 'budget', 'anggaran'])) {
    if (stats.remaining >= 0) {
      return `${formatIDR(stats.remaining)} sisa dari budget ${formatIDR(group.budget)} kamu — udah kepake ${Math.round(stats.pctUsed * 100)}%. Sekitar ${formatIDR(stats.remaining / Math.max(1, members.length))} per orang.`;
    }
    return `Kamu kelebihan budget ${formatIDR(-stats.remaining)} (udah keluar ${formatIDR(stats.spent)} dari ${formatIDR(group.budget)}). Coba tanya breakdown kategori buat cari tau di mana bisa dihemat.`;
  }

  // Total spent
  if (hasAny(q, ['spent', 'spend', 'total', 'so far', 'keluar', 'habis', 'sejauh ini'])) {
    if (noData) return `Belum ada pengeluaran buat ${group.name}. Budget ${formatIDR(group.budget)} masih utuh.`;
    return `${formatIDR(stats.spent)} dari ${stats.count} ${stats.count === 1 ? 'pengeluaran' : 'pengeluaran'} — ${Math.round(stats.pctUsed * 100)}% dari budget ${formatIDR(group.budget)}.`;
  }

  // Greeting / help / fallback
  return `Aku jawab berdasarkan data live ${group.name}. Coba tanya:\n• "Sisa budget berapa?"\n• "Bagi rata per orang"\n• "Kategori paling boros?"\n• "Masih on track gak?"\n• "Ide makanan sesuai budget?"`;
}
