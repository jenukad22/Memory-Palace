# Pre-submission checklist — iOS, Android, Web

Status as of this pass. Items are grouped **blockers** (must resolve before you can
actually submit) and **verified** (done in this session, nothing further needed unless
noted). Nothing here was invented — where a decision or asset only you can provide is
missing, it's listed as missing, not guessed at.

---

## 1. Blockers — cannot submit without these

### 1.1 App icon, splash screen, adaptive icon (iOS + Android + web favicon)

**No `assets/` directory exists in this repo.** `app.json` deliberately has no
`icon`/`splash`/`android.adaptiveIcon`/`web.favicon` fields — referencing files that
don't exist would break the build, so they were left out rather than pointed at nothing.
Without them, `eas build` will silently fall back to Expo's generic default icon, which
is not acceptable for a real store listing.

Needed, at minimum:

| Asset                          | Spec                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `icon.png`                     | 1024×1024, no alpha channel, no rounded corners (iOS masks it)                                              |
| `adaptive-icon-foreground.png` | 1024×1024, transparent background, subject inside the safe ~66% center circle (Android masks the rest)      |
| `adaptive-icon-background.png` | 1024×1024 solid color, or reuse a flat color via `android.adaptiveIcon.backgroundColor` instead of an image |
| `splash-icon.png`              | Simple mark, shown briefly on cold start                                                                    |
| `favicon.png`                  | 48×48 (or an .ico), for the web export's `<head>`                                                           |

This is a design decision (what the icon looks like), not a build-config one — I didn't
generate placeholder artwork for it. The design language is already established
(`src/ui/tokens.ts`: gold `#E3A84E` accent on slate `#0B0E14`), so a mark consistent
with that is the natural direction whenever you're ready to produce it. Once files exist
under `assets/`, wire them into `app.json`:

```json
"icon": "./assets/icon.png",
"splash": { "image": "./assets/splash-icon.png", "backgroundColor": "#0B0E14" },
"android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon-foreground.png", "backgroundColor": "#0B0E14" } },
"web": { "favicon": "./assets/favicon.png" }
```

### 1.2 Privacy policy URL

Both Apple and Google require a hosted privacy policy URL for any app with account
sign-in (this app's optional Supabase auth qualifies, even though it's off in the
production build by default — see §3). You said you don't have one yet. I can't write
or host one for you; a policy needs to accurately describe what the specific build
being submitted actually does, which depends on whether sync is enabled for that
submission. Two honest options once you're ready:

- **If submitting with sync off** (the default — §3): the policy can truthfully say the
  app collects nothing off-device. Still required by both stores as a matter of
  process, even though the content is simple.
- **If submitting with sync on**: the policy needs to cover what Supabase auth + sync
  actually stores (email, training-run data) and point at Supabase's own subprocessor
  status.

### 1.3 Apple Developer Program + App Store Connect

Not something I can check from here. Confirm before running `eas submit -p ios`:

- Active Apple Developer Program membership (paid, $99/yr).
- An app record created in App Store Connect with the bundle ID
  `com.jenuka.memorypalace`, matching `app.json`.
- `eas submit` will prompt interactively for your Apple ID / app-specific password /
  ASC App ID the first time — `eas.json`'s `submit.production` is deliberately left
  empty rather than pre-filled with guessed values.

### 1.4 Google Play Console

- An active Play Console account ($25 one-time).
- A new app created in Play Console, package name `com.jenuka.memorypalace`.
- A **service account JSON key** for `eas submit -p android` (Play Console → Setup →
  API access → create service account, grant it release-manager permissions). Save it
  outside the repo, or as a file matching the `.gitignore` patterns added this session
  (`credentials.json`, `*-service-account.json`, `google-play-*.json`) — never commit it.
- Play Console's own Data Safety form and content rating questionnaire — filled in the
  console, not in code.

### 1.5 Store listing content (both stores)

Not code — flagging so it isn't discovered missing at the submit step: app name,
subtitle/short description, full description, screenshots at each required device
size, category, support URL, and (optional) marketing URL. Screenshots need a real
device/simulator pass through the actual UI — not something to fabricate.

---

## 2. Verified / done this session

### 2.1 `app.json`

- `ios.bundleIdentifier` / `android.package` set to `com.jenuka.memorypalace`.
- `ios.supportsTablet: true` — the app's layout is already bounded-max-width by
  construction (Corsi board, flicker board both cap their side rather than stretching),
  so tablet is a reasonable default rather than a leap of faith.
- Confirmed `npx expo config --json` resolves cleanly with these fields.

### 2.2 `eas.json`

- `development` / `preview` / `production` build profiles present.
- `EXPO_PUBLIC_ENABLE_DEV_TOOLS=1` set on the `preview` profile only, read by
  [`src/devTools.ts`](../src/devTools.ts)'s `isDevToolsEnabled(__DEV__)` — true when
  either that's set or the RN bundler's own `__DEV__` is true. `__DEV__` alone is false
  in _every_ EAS build (dev, preview, and production all disable the dev client), so
  without this the `/dev` route and its DB self-test button — the only way to exercise
  the real `expo-sqlite` native driver before a store build — would be unreachable in
  the installable preview APK. `production` deliberately does not set it: the self-test
  writes real rows and has no place in what ships to a store.
- `appVersionSource: "remote"` + `production.autoIncrement: true` — EAS manages
  iOS build numbers / Android version codes remotely; nothing to set by hand, and
  nothing in `app.json` conflicts with it.
- `submit.production` left empty deliberately (§1.3, §1.4) — `eas submit` prompts for
  real credentials rather than the file carrying guessed placeholder values.
- Confirmed via `eas whoami` you're authenticated (`jenuka22` / `jenukad@gmail.com`)
  and the project (`0d60f7d7-9b40-42b3-9786-a3f3985c6410`) is already linked.

### 2.3 `.gitignore`

Added patterns for store-submission credentials that don't yet exist but will:
`credentials.json`, `*-service-account.json`, `google-play-*.json` — alongside the
existing `*.jks`/`*.p8`/`*.p12`/`*.key`/`*.mobileprovision` signing-file patterns.

### 2.4 CI/CD — `.github/workflows/`

- **`eas-build.yml`** — `workflow_dispatch` only (manual, pick profile + platform from
  the Actions tab). Deliberately _not_ triggered on push: EAS builds consume paid build
  minutes and a `production` build is a real step toward store review, not something
  that should fire automatically. Runs the same typecheck/lint/test gate as CI first,
  then `eas build --no-wait` (doesn't block the Actions job for the full cloud build
  duration — check status at expo.dev or `eas build:list`).
- **`web-deploy.yml`** — continuous on push to `main` (matches what you approved when
  picking Cloudflare Pages — "push to main → auto-deploy"). Runs the gate, `expo export
-p web`, then `wrangler pages deploy dist`.
- **Both need GitHub Actions secrets added** (repo Settings → Secrets and variables →
  Actions) before they'll run successfully:
  - `EXPO_TOKEN` — from expo.dev account settings → Access Tokens.
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard.
  - The Cloudflare Pages project itself (`memory-palace`, per the workflow's
    `--project-name`) needs creating once, either via the Cloudflare dashboard or by
    letting the first `wrangler pages deploy` create it.

### 2.5 Verified build output

- `npx expo export -p web` (web-only, matches the CI workflow) produces a valid
  `dist/` — confirmed by inspecting its contents.
- Full local gate after every config change: typecheck, lint, **671 tests**, all green.

---

## 3. Decision on record: sync ships off for this submission

Per your choice, `eas.json`'s `production` profile carries no `EXPO_PUBLIC_SUPABASE_*`
env vars, and `eas env:list --environment production` was checked directly — **no
dashboard-configured env vars exist that could override this silently.** With both
vars absent, `isSyncConfigured()` returns `false` at runtime
([src/sync/config.ts](../src/sync/config.ts)) and the entire sync feature — settings
entry, auth screens, network code — does not exist in the running app. This was the
explicit design goal of making sync additive (see the Phase 8 design doc) and it holds
for this build with zero further action.

**One gotcha worth remembering**: this guarantee is about the profile used, not the
command. `eas build --profile production --local` would read your _local_ `.env` file
(if populated) the same way `npm run web` does, since local builds go through Metro's
own env-loading rather than EAS's cloud env injection. The binary you actually submit
should come from a **cloud** `eas build --profile production` run (or a local build with
an empty/absent `.env`), or this guarantee doesn't hold for that specific binary.

If you want sync included in a _future_ submission: populate `EXPO_PUBLIC_SUPABASE_URL`
/ `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS environment variables for the `production`
environment (`eas env:create`) or in `eas.json`'s `production.env`, run
[docs/supabase-schema.sql](supabase-schema.sql) against a real project first, verify a
live sync round-trip actually works (it never has been — see the Phase 8 plan doc's
follow-ups), and update the privacy policy accordingly (§1.2).

---

## 4. Claim-string audit — "no IQ / health / far-transfer claims"

### Method

Every file containing user-facing text was read directly and judged against the rule —
not just grepped for banned words. That covered:

- All 5 centralized copy modules (`assessment/vviq/strategyCopy.ts`,
  `modules/memory/copy.ts`, `modules/attention/copy.ts`, `modules/reasoning/copy.ts`,
  `modules/reasoning/baseRateCopy.ts`) — these are where the honesty-conscious
  explanatory strings live (Brier score explanation, timing disclosures, self-rating
  disclaimers, etc.).
- All 24 screen files across memory, attention, reasoning, the baseline battery, the
  dashboard, daily review, and sync settings — every heading, instruction, button
  label, and result string.
- The two content banks with free-form authored prose that could plausibly carry a
  stray claim (`disconfirmationBank.ts`'s 18 fallacious-reasoning examples,
  `calibrationBank.ts`'s 38 trivia items) — read in full, checked specifically for
  anything self-referential (e.g., a claim that mentions memory training or this app),
  found none.
- A final full-tree regex sweep (`app/`, `src/`, `.ts`/`.tsx`/`.json`, excluding test
  files) for a wider net than the repo's existing automated scanner covers: `improve
your`, `boost`, `sharpen`, `enhance your`, `unlock`, `supercharge`, `proven`,
  `scientifically`, `clinical`, `backed by`, `research/studies show`, `guarantee`,
  `optimi[sz]e your`, `brain train`, `memory loss`, `dementia`, `alzheimer`, `adhd`,
  `cognitive decline/health`, `mental fitness`, `iq`, `intelligence quotient`, `get/make
you smarter`, `health benefit`, `medical`, `diagnos`, `prevent`, `cure`, `treat`,
  `therapy/therapeutic`. Every hit was a false positive (substring matches like "iq"
  inside "Liquid", or code comments/identifiers like `vviq`, `medicalTest` — an internal
  scenario key never shown to users, its actual rendered copy says "the condition").

### Result: no violations found

This is not a surprise finding — the codebase already has a **repo-wide automated
guard** for this
([src/assessment/copy-honesty.test.ts](../src/assessment/copy-honesty.test.ts)), which
scans `src/assessment`, `src/modules`, `src/review`, `src/dashboard`, and `app` for a
banned-term list (`iq`, `intelligen(t|ce)`, `brain/cognitive/memory/mental age`,
`diagnos`, `aphantas`, `clinical`, `general ability`, `smarter`) on every test run —
it's part of the 671 passing tests. What this pass adds on top is everything that
regex _can't_ catch: implied claims, superlatives, and framing that doesn't use a
banned word but still oversells (e.g. "this will make your memory better" contains none
of the banned terms but is exactly the claim the rule exists to stop). None of that
turned up either.

**What every module actually does instead** — the pattern is consistent everywhere:
each result screen states a footnote naming exactly what was measured and explicitly
disclaiming the general reading (e.g. PVT: "it is not a sleep, health, or
attention-condition reading"; disconfirmation: "not a measure of how good your
reasoning was"; calibration: "not a reading of your judgment in general"). Nothing
found needs changing before submission on this axis.

---

## 5. Build & submit runbook

Once §1's blockers are cleared:

```bash
# One-time, per store, after credentials exist (§1.3 / §1.4):
eas build --platform ios --profile production
eas build --platform android --profile production
# EAS prompts interactively for missing credentials the first time.

eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Or via GitHub Actions once secrets are set (§2.4): Actions tab → "EAS Build" →
Run workflow → pick `production` + platform.

**Before submitting either binary for review**, install it on a real device via EAS's
internal distribution (`preview` profile) and actually run the baseline battery, one
task from each module, and daily review end-to-end — the gate (typecheck/lint/671
tests/`expo export`) proves the code is correct, not that the on-device experience
works. No UI verification has been done for several of the newer screens (attention,
reasoning) beyond what's noted in their own plan docs.

Web: push to `main` once the Cloudflare secrets exist (§2.4), or trigger
`web-deploy.yml` manually.

---

## 6. Final gate, this session

```
typecheck   PASS
lint        PASS
test        PASS  (671 tests)
expo export PASS  (web + iOS + Android bundles; web-only export also verified separately)
```
