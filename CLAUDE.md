# CashMine test task — notes for Claude Code

## Context
- 2-hour timed task. Expo SDK 57, RN, TypeScript, delivered as a WEB app opened on a phone (~390px).
- Read docs/BRIEF.md (task) and docs/API.md (API) before any work.
- Deploy: `npx expo export --platform web && eas deploy --prod`.

## Hard rules
- Token: user enters it in the UI on first open, stored in localStorage, with a way to change it.
  NEVER put a token in code, env files, the repo or the build.
- API base URL lives only in src/config/api.ts.
- Amounts are decimal strings -> BigInt minor units (10^decimals). Never Number/parseFloat for money.
- Claims: one Idempotency-Key per confirmed claim intent; retries reuse the same key and body.

## Conventions
- Expo Router, routes in src/app. Static rendering is on: no window/localStorage at module level.
- TanStack Query for data. Functional components and functions only, no classes. Strict TS, no any.
- Add deps with `npx expo install`, web-compatible only.
- Every screen: loading, error with retry, empty states.
- Alert.alert does nothing on web: use in-app UI. expo-secure-store does not work on web.

## Workflow
- Small steps, commit after each meaningful change (feat:, fix:, test:, docs:).
- Ask before big refactors or new libraries. Simple and correct over clever.
