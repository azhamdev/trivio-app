# Trivio — Group Trip Expense Tracker

Split trip costs with your crew — no spreadsheets, no awkward IOUs. Built with
**React Native + Expo (SDK 57, expo-router, TypeScript)** in a minimalist
blue-and-white design.

## Features

- **Email/password auth** — register and log in; sessions persist across restarts.
- **Trip groups** — set a destination, estimated days, and a shared IDR budget.
- **6-letter invite codes** — share the code; friends join and log into the same pot.
- **Categorized expenses** — Food & Drinks, Transport, Accommodation, Activities,
  Shopping, Other — with per-category breakdown bars and who-paid tracking.
- **Trivio Assistant** — a chat that answers from the trip's live numbers:
  remaining budget, per-person split and who owes whom, daily pace projection,
  biggest categories, latest expenses.
- **Interactive by default** — springy press feedback, staggered entrance
  animations, animated budget bars (amber at 80%, red when blown), parallax trip
  header, typing indicator, pop-in success screens.

## Run it

```bash
npm install
npx expo start
```

- Press `w` for the browser, or scan the QR code with **Expo Go** on your phone.

## Project structure

```
src/
  app/                  # expo-router routes
    _layout.tsx         # providers + auth-guarded stack
    login.tsx, register.tsx
    (tabs)/             # Trips · Assistant · Profile
    create-group.tsx    # trip form → animated success + invite code
    join-group.tsx      # enter a 6-letter code
    group/[id].tsx      # parallax trip detail: budget, members, categories, expenses
    add-expense.tsx     # amount, category grid, paid-by, note
  ai/assistant.ts       # rule-based Q&A over trip stats
  components/           # reusable animated UI (Button, Input, ProgressBar, …)
  context/AppContext.tsx# state + AsyncStorage persistence (mock backend)
  data/categories.ts    # expense categories
  theme/theme.ts        # colors, radii, shadows, typography
  utils/                # currency/date formatting, invite codes, trip stats
```

## Demo-build notes

- **Storage is local.** The whole "database" (accounts, groups, expenses) lives in
  AsyncStorage, so invite codes work between accounts on the *same device*. To go
  multi-device, keep the `AppContext` API and swap its internals for a real
  backend (Supabase / Firebase / your own server) — screens won't change.
- **The assistant is offline.** `src/ai/assistant.ts` computes answers locally.
  To upgrade to a real LLM, send the group data + question to your backend and
  call the model there — never ship a model API key inside the app bundle.
- Passwords are stored in plain text on-device because this is a demo. Use real
  auth before shipping.
