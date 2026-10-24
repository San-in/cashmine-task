# CashMine payback (practical task)

**Live:** https://san-in-cashmine-task.expo.app — open it on a phone and enter your API token.

Decisions, AI usage and known issues are in [NOTES.md](NOTES.md). AI conversation logs are in [ai-logs/](ai-logs/).

## Run locally

```bash
npm install
npx expo start --web
```

Open http://localhost:8081 (designed for a ~390 px wide screen) and enter your token. It is stored only in
the browser's localStorage. The API base URL is in `src/config/api.ts`.

```bash
npm test            # unit tests (Vitest): amounts, totals, balance correction, polling, activity
npm run typecheck   # tsc --noEmit
```

Deploy: `npx expo export --platform web && eas deploy --prod`.

## What works

- **Token**: asked on first open, kept in localStorage, changeable from the header; a rejected token offers
  "Change token".
- **Balances (Home)**: available / pending / claiming per asset, total and available in USD, snapshot age
  ("Updated 12s ago"), refresh button and pull-to-refresh, polling aligned to the 15 s server snapshot.
  Loading, error with retry, refresh-failed banner (keeps last data), stale warning and empty states.
- **Claim**: pick an asset, type an amount or tap Max, see fee and the amount you receive, review, confirm.
  Validation follows the API rules (format, decimals, minimum, available). One Idempotency-Key per confirmed
  claim, reused on retries; unknown results (timeouts, 5xx) are retried safely and never turn into a second
  claim. A status page follows the claim until it completes or fails.
- **Balance after a claim**: corrected immediately and without jumps until the server snapshot includes the
  claim; recent claims are listed on Home.
- **Activity**: paginated history of accruals, reversals and claims ("Load more"), de-duplicated across pages.
- Money is handled as BigInt minor units throughout; no floats.
