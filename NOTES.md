# Notes

Expo (SDK 57) + Expo Router + TanStack Query, shipped as a static web build.
Live: https://san-in-cashmine-task.expo.app

## Decisions

**1. Amounts: BigInt minor units, end to end.**
Every amount from the API is parsed once, at the API boundary, into `bigint` minor units
(`"0.5"` ETH with 18 decimals → `500000000000000000n`). Comparisons, `amount − fee` and totals are
integer math; the canonical decimal string is rebuilt only for display and for the request body
(`src/lib/amount.ts`). User input follows the API format exactly (`.5`, `1.`, `05`, `1e-3` are
rejected, at most `decimals` places); a comma is accepted as the decimal separator because phones
offer it. A server value with more places than the asset allows is treated as an error, not rounded.
USD values (`amount × usdPrice`) are kept at 10⁻¹² and rounded to cents once, at display, so the
total is not a sum of rounded rows.
*Alternatives:* `Number` (loses precision: 18-decimal ETH balances in the test data, `0.1 + 0.2`);
a decimal library such as big.js (fine, but an extra dependency for what is only +, −, compare and one
multiplication).

**2. Balance right after a claim: server snapshot plus a local correction until the snapshot catches up.**
`POST /v1/claims` moves the amount from `available` to `claiming` at once, but `GET /v1/balances` is a
snapshot recomputed every 15 s. I compared three options (see the AI log):
- A. Show the snapshot only, plus a banner. Safe, but `available` looks unchanged for up to 15 s —
  exactly the "I claimed again" feedback, and a second claim succeeds if funds allow.
- B. Optimistic update in the cache. The next poll returns a pre-claim snapshot, so the balance drops,
  jumps back, drops again — the "stopped trusting the app" feedback. Rejected.
- C (chosen). Keep claims created in this browser and correct the snapshot only for claims it cannot
  know about yet: `asOf < claim.createdAt` (both server times, so device clock skew does not matter).
  Pending: available −amount, claiming +amount; completed: available −amount; failed: no correction.
  Once a snapshot with `asOf ≥ createdAt` arrives, the correction stops and the server numbers already
  match, so nothing jumps. The tracked claims are persisted in localStorage, so a reload does not undo
  the correction. A failed claim stays visible on Home for 2 minutes with "amount returned to available",
  so the one legitimate "jump back" is explained. Max and validation use the corrected `available`.
  (`src/features/claims/claim-adjustments.ts`, tested.)

**3. Unknown claim result (timeout, 5xx, dropped connection).**
The Idempotency-Key is generated once, when the user taps Confirm, and saved with the frozen request body
in localStorage before the first request. Every retry reuses that key and body, so it can never create a
second claim (`src/features/claims/submit-claim.ts`).
- 5xx / 504 / timeout / network error / 429 → "may have succeeded": retry up to 5 times with backoff,
  honouring `Retry-After`. The user sees "Submitting… attempt n of 5, this can never create a second claim".
- 4xx → the claim was definitely not created: the key is dropped and the error is shown next to the field.
- Still unknown after 5 attempts → "We could not confirm your claim, please do not start a new one" with a
  "Check again" button (same key). New claims are blocked and Home shows a banner until it is resolved.
  A reload resumes the same attempt instead of offering a fresh form.
*Alternatives:* show a generic error and let the user resubmit (new key → possible double claim), or assume
failure (wrong and dangerous). Blocking new claims while unresolved is the safe default for real money.

**Other decisions**
- *Total USD* = available + pending + claiming; "Available to claim" is shown separately. Pending can still be
  reversed by the exchange, which the card explains.
- *Freshness* shows the age of the server snapshot (`asOf`), not of our request. Polling is scheduled for
  `asOf + 15 s + 1 s` (bounded to 5–15 s), so data is at most ~16 s old without extra requests. A manual
  refresh that returns the same snapshot shows "Checked just now · no newer data yet".
- *Claim status* lives at `/claim-status?id=…`, not `/claims/[id]`: the static host returned 404 for the
  dynamic route on reload.
- *Activity*: the API's cursor repeats the last item of a page as the first item of the next one; pages are
  merged and de-duplicated by `id` so a reversal is not shown twice.
- *Token*: entered on first open, kept in localStorage, changed via the header link. Changing it clears all
  cached data and tracked claims; re-saving the same token does not drop an unresolved claim.
- Assumption: an amount not greater than the fee is rejected client-side (the user would receive nothing).

## Working with AI

I used Claude Code (Opus) with a `CLAUDE.md` holding the hard rules (no token in code, BigInt, one
Idempotency-Key per claim). Logs: `ai-logs/claude-code-session.md` (main build) and
`ai-logs/claude-code-session-2.md` (a side session for the "Checked" timer).

1. **A prompt that did not get me what I wanted.** My `CLAUDE.md` said "commit after each meaningful change",
   so the agent started committing on its own. I wanted to review every commit, so I stopped it
   ("тільки ж нічого не коміть сам"), had it move its commits back to staged, and from then on asked for
   commits explicitly. Later I had it split a commit of mine that mixed the whole claim flow with IDE files.
   *Log: search "нічого не коміть" and "Розбий 91949f3".*
2. **AI output that was wrong or risky, and how I found out.** The status page was built as `/claims/[id]`.
   It worked locally, but after the first deploy a smoke test with curl against the live URL showed that
   opening `/claims/<id>` directly returned 404: the static host has no dynamic routes. A claim being followed
   would be lost on refresh. Fixed by moving to `/claim-status?id=`. A second case: while testing Activity in
   the browser, a React duplicate-key warning showed the API repeats items across pages; the first version
   would have shown a reversal twice. *Log: search "404" and "same key".*
3. **Where I disagreed or rejected a suggestion.** For the balance-after-claim decision I rejected option B
   outright as incorrect, and when the AI described option C as "loses the correction for ≤15 s after a reload
   unless stored", I pushed back ("why can't we?") and had it persisted. I also rejected the AI's first
   "Checked Xs ago" line, which showed after every poll and made the two timers confusing, and changed it so it
   appears only when a manual refresh returns the same snapshot (done in session 2). *Log: search
   "чому ми це не можемо робити" in session 1, and "два таймера" in session 2.*

## Not done / known issues

- Tests cover pure logic only (amounts, totals, balance correction, polling schedule, activity merge).
  The submit/retry flow and screens have no automated tests; the unknown-outcome path was reasoned about and
  reviewed, not exercised against a forced 504.
- A 401 during retries is treated as "not created" and drops the key; if an earlier attempt did create the
  claim, it is still reflected by the next snapshot but not tracked or linked.
- The fee is taken from `claim-options` at review time; if the server charged a different fee, only the status
  page (which shows the server's numbers) would reveal it.
- Tracked claims and the pending intent are per browser and not synced between tabs (no `storage` event), so
  two tabs could each confirm a claim.
- "Updated Xs ago" compares the device clock with server time; a skewed clock shows a wrong age (clamped at 0).
- No skeleton loaders or offline detection; accessibility is basic (roles, labels).
- Next: integration tests for the claim flow with a mocked API (timeouts, 409, replay), cross-tab sync of the
  claim intent, and showing the server's fee in the review step if it differs.
