# Memory Palace

Memory Palace is an honest, task-specific cognitive trainer covering memory, attention, and reasoning. Every assessment (VVIQ, digit span, Corsi block-tapping, N-back, PVT, reasoning tasks) reports performance on that specific task only — reaction time, span length, accuracy, sequence recall. **Never claim, imply, or name anything in terms of general intelligence, IQ, or health/medical outcomes.** This constraint governs UI copy, notification text, and analytics event/property naming (e.g. `nback_accuracy_improved`, not `iq_boost`, `memory_score`, or `cognitive_health`). If a proposed string implies a gain that generalizes beyond the task just performed, rewrite it.

## Tech stack

- Expo (React Native + React Native Web), TypeScript (strict)
- expo-sqlite + Drizzle ORM for local persistence
- Zustand for client state
- TanStack Query for async/data-fetching state
- Vitest for unit tests

## Folder map

```
/src
  /assessment    One subfolder per assessment (vviq, digitspan, corsi, nback, pvt, reasoning).
                 Screens/flows that present a task and collect raw responses.
  /modules       One subfolder per cognitive domain (memory, attention, reasoning).
                 Groups related assessments into user-facing training programs.
  /engine        Pure TypeScript: scoring, adaptive staircases, session scheduling,
                 psychometrics. See rule below.
  /db            Drizzle schema and migrations.
  /ui            Shared presentational components.
  /state         Zustand stores.
```

## Commands

| Task       | Command             |
| ---------- | ------------------- |
| Dev server | `npm start`         |
| Test       | `npm test`          |
| Typecheck  | `npm run typecheck` |
| Lint       | `npm run lint`      |
| Build      | `npx expo export`   |

`expo export` produces a static/web bundle. Native app-store builds will use EAS Build once `eas.json` and `eas-cli` are added — not yet part of this repo.

## `/src/engine` rule

`/src/engine` must stay framework-free: no React, React Native, or Expo imports. It is plain TypeScript in, plain TypeScript/JSON out. Every module in `/src/engine` must have unit test coverage under Vitest (`src/engine/**/*.test.ts`) — this is what keeps the scientifically-sensitive code (scoring, sequence generation, timing math) fast to test and safe to refactor without mocking the UI layer.
