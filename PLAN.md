# Trivio Roadmap: UI Polish → Personal Budget → Receipt OCR → Supabase Migration

## Context

Trivio is currently a fully local, single-device Expo app (SDK 57, expo-router, RN 0.86, TypeScript strict). All "backend" state — users, groups, expenses — lives in one `AppContext` (`src/context/AppContext.tsx`) backed by AsyncStorage, and the file's own top-of-file comment already documents the intent to swap its internals for a real backend later without changing screens. The plan moves the app forward on four fronts, in this order: general UI polish, a new Personal Budget feature (distinct from the existing per-trip group budgets), OCR-based receipt scanning to speed up expense entry, and finally a migration from the local AsyncStorage mock backend to Supabase (Postgres + Auth). Each phase is scoped to build cleanly on the previous one — the Personal Budget feature reuses Phase 1's UI patterns, OCR plugs into both the existing and new expense-entry forms, and the Supabase schema is designed to cover both the original group/expense model and the new personal-budget tables from Phase 2.

This plan was built from a full exploration of the current codebase (state layer, types, routes, components, AI/LLM plumbing, and confirmation that no camera/OCR/Supabase code exists yet — all three are greenfield additions on a small, consistently-factored ~2,900 LOC app).

This is a large, multi-week body of work. Execution proceeds phase by phase — get Phase 1 working and verified before starting Phase 2, and so on — rather than attempting all four simultaneously.

---

## Phase 1 — UI polish (scoped, not a redesign)

Grounded in real gaps found in the code, not invented ones:

1. **Accessibility basics** — zero `accessibilityLabel`/`accessibilityRole` exist anywhere in `src/` today. Add them to icon-only controls: `group/[id].tsx`'s back/share round buttons and FAB, `ExpenseRow.tsx`'s delete action, `assistant.tsx`'s send button. Bump the 40×40 `roundBtn` touch targets to 44×44 (standard minimum).
2. **Typography consolidation** — several screens (`group/[id].tsx`, `add-expense.tsx`, `GroupCard.tsx`, `profile.tsx`) use inline `fontSize` literals instead of the `type` scale in `src/theme/theme.ts`. Add 1–2 missing scale entries (e.g. a large "stat" style for big money figures) and replace the literals with token references.
3. **Dark mode — explicitly scoped, not full-app.** Every screen's styles are built once at module load via `StyleSheet.create` against a static `colors` import, so a full runtime theme switch means converting every screen (~20 files) to compute styles inside the component. Scope Phase 1 to: a new `src/theme/ThemeContext.tsx` (light/dark color maps with the same key shape as today's `colors`, preference stored in AsyncStorage, `useThemeColors()` hook), a toggle in `profile.tsx`, and conversion of only the highest-traffic surfaces (`_layout.tsx` boot screen, tab bar, Trips list, Group detail). Leave the rest light-only for now — this keeps the phase contained while establishing the pattern for later screens.
4. **Tab bar polish** — add an active-tab indicator, pairs naturally with the new Budget tab arriving in Phase 2.
5. **Reduced-motion respect** — short-circuit `FadeSlideIn.tsx` and `ProgressBar.tsx` animations to duration 0 when `AccessibilityInfo.isReduceMotionEnabled()` is true.

**Key files:** `src/theme/theme.ts`, `src/theme/ThemeContext.tsx` (new), `src/components/PressableScale.tsx`, `src/components/FadeSlideIn.tsx`, `src/components/ProgressBar.tsx`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/group/[id].tsx`, `src/app/(tabs)/profile.tsx`.

**New dependencies:** none.

**Verification:** run in Expo Go/simulator; toggle dark mode from Profile and confirm the converted screens repaint correctly while others stay light without crashing; check screen-reader announcements (VoiceOver/TalkBack) on the FAB, back/share buttons, and delete action.

---

## Phase 2 — Personal Budget feature

**Model `PersonalBudget` as a lightweight, memberless sibling of `Group`** — same start/end date range, `amount`, `expenses[]`, and open/closed lifecycle, minus `members`/`code`/`coverUrl`/`createdBy`. This maximizes reuse of existing date/lifecycle/stats utilities instead of inventing new recurrence machinery:

```ts
export type PersonalExpense = {
  id: string; title: string; amount: number;
  categoryId: CategoryId; note?: string; createdAt: number;
};

export type PersonalBudget = {
  id: string; userId: string; name: string; amount: number; currency: 'IDR';
  startDate: number; endDate: number; days: number;
  categoryId?: CategoryId | null;   // optional: scope to one category, else overall
  createdAt: number;
  expenses: PersonalExpense[];
  closedAt: number | null; closedReason: 'manual' | 'ended' | null;
};
```

- Reuses `CategoryId` directly. Date range picked via the existing `CalendarRangePicker` (same component `create-group.tsx` already uses); add `startOfMonth`/`endOfMonth`/`startOfWeek`/`endOfWeek` helpers to `src/utils/dates.ts` for "this week"/"this month" presets.
- No auto-rollover in v1 — ended budgets sink to the bottom of the list exactly like closed trips do today; starting a new period means creating a new budget. Flag true recurrence as a v2 idea.
- Widen `src/utils/trip.ts`'s lifecycle functions (`tripPhase`, `isTripClosed`, `canReopen`, `closedLabel`, `tripDayInfo`, `migrateGroup`, `sweepAutoClose`) from `(group: Group)` to a structural `Pick<Group, 'startDate'|'endDate'|'days'|'closedAt'|'closedReason'|'createdAt'>` so `PersonalBudget` satisfies the same type and both entities share one lifecycle implementation.
- Add `personalBudgetStats(budget)` next to `groupStats` in `src/utils/stats.ts`, factoring the shared `byCategory` computation into a helper both call (group stats include per-person math that doesn't apply here, so this stays a separate function, not a shared one). Generalize `groupExpensesByDay`'s signature to work over any `{id, createdAt}[]` so it works unchanged for `PersonalExpense[]`.

**AppContext additions** (same `register`/`createGroup`-style naming and `Result<T>` convention):
- Extend persisted `Db` to `{ users, groups, personalBudgets: PersonalBudget[] }`.
- `myBudgets: PersonalBudget[]` — derived like `myGroups`, filtered by `userId`, ended ones sorted last.
- `createPersonalBudget(input)`, `addPersonalExpense(budgetId, expense)`, `deletePersonalExpense(budgetId, expenseId)`, `getPersonalBudget(budgetId)`.
- No manual close/reopen in v1 (parity isn't needed — a personal budget has no other members to coordinate with; it just locks once its date range ends, same as an auto-ended trip).

**Routes/tab:**
- New 4th tab `src/app/(tabs)/budget.tsx` (Trips → Budget → Assistant → Profile), wallet icon, mirrors `(tabs)/index.tsx`'s list layout.
- `src/app/create-personal-budget.tsx` — mirrors `create-group.tsx` (name/amount `Input`s, `CalendarRangePicker`, optional single-select `CategoryPill` to scope the budget).
- `src/app/budget/[id].tsx` — mirrors `group/[id].tsx` minus cover/members/invite-code/close dialog.
- `src/app/add-personal-expense.tsx` — mirrors `add-expense.tsx` minus the "paid by" picker.

**Component reuse:** `ProgressBar`, `CategoryPill`, `EmptyState`, `CalendarRangePicker`, `Button`, `Input`, `FadeSlideIn`, `PressableScale`, `ScreenHeader` reused as-is. New `src/components/BudgetCard.tsx` (same visual language as `GroupCard`, no cover/avatars). Generalize `ExpenseRow.tsx`'s props from `(expense, group, currentUserId, onDelete)` to `(expense, payerLabel: string | null, onDelete)` — hides the "Paid by X" prefix when `payerLabel` is `null` — so `budget/[id].tsx` reuses it instead of duplicating swipe-to-delete.

**Key files:** `src/types.ts`, `src/context/AppContext.tsx`, `src/utils/trip.ts`, `src/utils/stats.ts`, `src/utils/dates.ts`, `src/app/(tabs)/budget.tsx` (new), `src/app/budget/[id].tsx` (new), `src/app/create-personal-budget.tsx` (new), `src/app/add-personal-expense.tsx` (new), `src/components/BudgetCard.tsx` (new), `src/components/ExpenseRow.tsx`.

**New dependencies:** none.

**Verification:** create a "this month" budget, add expenses across categories, confirm `ProgressBar` amber/red thresholds match trip behavior, confirm locking once `endDate` passes, reload and confirm persistence in `trivio:db:v1`, and regression-check Trips/Group/Assistant screens are unaffected by the `trip.ts` type-widening.

---

## Phase 3 — OCR receipt scanning

**Capture via `expo-image-picker` only** (not a live camera view) — the need is "take/pick one photo → send to a vision model," which `launchCameraAsync`/`launchImageLibraryAsync` cover directly, including permissions and `base64` output, with no custom camera UI to build.

**Parse pipeline — extend the existing OpenRouter plumbing in `src/ai/llm.ts` rather than building a separate service:**
- Extract the shared fetch/timeout/error logic currently inlined in `askAssistant` into `src/ai/openrouterClient.ts` (`callOpenRouter(messages, opts)`), and refactor `askAssistant` to use it.
- Add `src/ai/receiptOcr.ts` exporting `parseReceipt(base64Image): Promise<ReceiptParseResult | null>` — returns `null` on any failure, never throws, mirroring `askAssistant`'s offline-fallback resilience. Uses the same `google/gemini-3-flash-preview` model (already vision-capable via OpenRouter, no new provider/key), sending an `image_url` content part plus a system prompt enumerating the app's 6 valid `CategoryId` values and requesting strict JSON:
  ```ts
  type ReceiptParseResult = {
    title: string; amount: number; categoryId: CategoryId;
    note?: string; confidence: 'high' | 'medium' | 'low';
  };
  ```
  Parse defensively (strip code fences before `JSON.parse`; clamp `categoryId` against `CATEGORIES`, fallback `'other'`).

**Error/fallback UX:** a `null` result shows a small dismissible banner ("Couldn't read this receipt — enter the details manually") and leaves the form at today's baseline empty state — no regression risk. On partial success, pre-fill parsed fields but never auto-submit; the user still taps "Save expense," and every field stays editable.

**Integration:** add a "Scan receipt" affordance to `add-expense.tsx` and Phase 2's `add-personal-expense.tsx`. Factor the picker-launch + loading/error state into a shared `src/components/ReceiptScanButton.tsx` so both forms share it — on success it fills the screen's existing local `title`/`amount`/`categoryId`/`note` state, on failure it shows the fallback banner.

**Config:** add `expo-image-picker` to `app.json`'s `plugins` with `cameraPermission`/`photosPermission` strings.

**Key files:** `src/ai/openrouterClient.ts` (new), `src/ai/llm.ts`, `src/ai/receiptOcr.ts` (new), `src/components/ReceiptScanButton.tsx` (new), `src/app/add-expense.tsx`, `src/app/add-personal-expense.tsx`, `app.json`.

**New dependencies:** `expo-image-picker`.

**Verification:** on a physical device (camera doesn't work in most simulators), scan a real receipt from both expense forms, confirm pre-filled values are sensible and editable; then unset `EXPO_PUBLIC_OPENROUTER_API_KEY` or go offline and confirm clean degradation to the manual-entry banner.

---

## Phase 4 — Supabase migration

**Schema** (covers both the original trip/expense model and Phase 2's personal budgets):

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id uuid → auth.users`, `name`, `email`, `created_at` | Replaces `User`; plaintext `password` is dropped — Supabase Auth owns credentials. |
| `groups` | `id`, `name`, `destination`, `start_date`, `end_date`, `budget`, `currency`, `code unique`, `cover_url`, `created_by`, `closed_at`, `closed_reason`, `created_at` | `days` is dropped as a stored column — computed client-side via the existing `daysBetweenInclusive`. |
| `group_members` | `group_id → groups (cascade)`, `user_id → profiles`, unique pair | Normalizes `Group.members[]`; names come from joining `profiles`. |
| `expenses` | `group_id → groups (cascade)`, `title`, `amount`, `category_id`, `paid_by → profiles`, `note`, `created_at` | Normalizes `Group.expenses[]`. |
| `personal_budgets` | `user_id → profiles (cascade)`, `name`, `amount`, `category_id`, `start_date`, `end_date`, `closed_at`, `closed_reason`, `created_at` | From Phase 2. |
| `personal_expenses` | `budget_id → personal_budgets (cascade)`, `title`, `amount`, `category_id`, `note`, `created_at` | From Phase 2. |

**RLS:** enabled on every table. `profiles` readable by any authenticated user (group co-members need each other's names), writable only by `auth.uid() = id`. `groups`/`expenses`/`group_members` gated by membership in `group_members`. `joinGroup`'s current client-side code lookup becomes a `SECURITY DEFINER` RPC `join_group_by_code(code)` so clients can't insert against arbitrary group IDs. `expenses` writes blocked via `WITH CHECK` when the parent group is closed — moving today's client-side `isTripClosed` guard into an actual security boundary. `personal_budgets`/`personal_expenses` use simple `auth.uid() = user_id` policies. The client-side 60s auto-close `setInterval` sweep is dropped (racy across devices) in favor of keeping "ended" purely date-derived and enforcing it at query time.

**AppContext migration:** keep the exact same exported hook surface (`register/login/logout/createGroup/joinGroup/addExpense/deleteExpense/closeTrip/reopenTrip/getGroup` plus Phase 2's budget methods) per the file's own documented intent — rewrite internals to call Supabase instead of AsyncStorage. The one unavoidable break: previously-synchronous mutators become `async`, requiring `await` at their ~9 call sites across `create-group.tsx`, `join-group.tsx`, `add-expense.tsx`, `group/[id].tsx`, `login.tsx`, `register.tsx`, and Phase 2's new screens — small and mechanical, but real. `register`/`login`/`logout` map to `supabase.auth.signUp`/`signInWithPassword`/`signOut`; session/`hydrated` handling replaces the bespoke AsyncStorage session key with `supabase.auth.onAuthStateChange` (configure the Supabase client's `storage` with the already-installed AsyncStorage, no new persistence dependency). `myGroups`/`myBudgets` become fetch-on-mount plus a realtime subscription that triggers refetch. Add a small snake_case↔camelCase mapper module so `stats.ts`/`trip.ts`/screens never see raw Postgres rows.

**Existing local data:** no migration tool — `User.password` can't be carried into Supabase Auth's hashing, and there's no production user base yet. Accept a fresh start; optionally detect the legacy AsyncStorage key once to show a "please re-create your account" notice.

**Key files:** `src/lib/supabase.ts` (new), `src/context/AppContext.tsx` (rewritten internals, same public API), `src/data/supabase/*.ts` (new query/mapper modules), `src/types.ts` (drop `password`), `supabase/migrations/0001_init.sql` (new), `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, same convention as the existing OpenRouter key).

**New dependencies:** `@supabase/supabase-js`.

**Verification:** apply the migration to a real Supabase project; register two test accounts, create a trip on one, join via invite code from the other, add expenses from both and confirm realtime sync; confirm a closed group rejects new-expense inserts server-side; round-trip a personal budget; re-check that Phase 1's dark mode/accessibility and Phase 3's OCR flow are unaffected, since neither depended on the storage backend.

---

## Execution notes

- Work phase by phase; don't start Phase *n+1* until Phase *n* is verified working.
- Each phase's "Key files" list is the concrete scope for that phase — no cross-phase file changes should happen early (e.g. don't touch Supabase-related files during Phase 1–3).
