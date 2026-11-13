# Testing

Phase 1 is covered by unit tests, Playwright WebKit end-to-end tests at an iPhone 13 viewport, and a manual iPhone script in [IPHONE-UAT.md](IPHONE-UAT.md).

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

`npm test` is Vitest. It uses `fake-indexeddb` for repository tests and does not need a browser.

`npm run test:e2e` builds the production app, serves it at `http://127.0.0.1:4173`, and runs Playwright with WebKit, the iPhone 13 device profile (390×844, touch), and service workers allowed. Install the browser once with `npx playwright install --with-deps webkit`.

CI on pull requests runs lint, typecheck, unit tests, the default build, Playwright, and a second build with `VITE_BASE=/afi-fitness-tracker/` that checks the Pages subpath, the service worker, and `404.html`. CI does not deploy.

## Unit tests

| File | What it locks |
|---|---|
| `tests/unit/project22.test.ts` | Hold, 10→11, 11→12, 12→+increment, form off, per-side `min(left, right)`, extra sets, a different weight as an override, and identical results with no date input |
| `tests/unit/session.test.ts` | Two starting sets, remove-without-confirm until the set is touched, different actuals per set, finish locks the session, HydroMassage and Massage Chair planning |
| `tests/unit/history.test.ts` | A finished session’s JSON is unchanged after a new template version and a catalog rename. Old template versions and finished sessions cannot be overwritten |
| `tests/unit/progression-flow.test.ts` | 10→11→12→+5 lb across sessions dated years apart. Form off holds the weight. A lighter weight you actually lift is what gets saved, and the override is logged |
| `tests/unit/export.test.ts` | Golden text log and CSV, including per-side reps, substitutions, and spreadsheet-formula guarding |
| `tests/unit/migrate-week-routes.test.ts` | Schema migration, Monday-start week counts, weekday suggestions, backup age, `/afi-fitness-tracker/` routing, the 21 machine names, empty templates, and backup restore |

Missed days cannot reset progress because `evaluateProject22` has no date argument. The flow test finishes the same exercise on dates years apart and the stage still advances only from the sets.

## End-to-end tests

`e2e/phase1.spec.ts` runs against the built app.

| Test | Criteria |
|---|---|
| Select any of the five workouts | AC-1. Also checks the weekday suggestion and the `0 of 3 visits` count |
| One completed set survives reload | AC-2, AC-7 |
| Different weights, reps, and left/right reps | AC-3. Also checks the done button is at least 48×48 px |
| Add a set; confirm only after data | AC-4 |
| Substitute Lat Pulldown for Seated Row and add Sled Push | AC-5 |
| Finish, read-only history, copy | AC-6, AC-8, AC-10. The copy button’s clipboard write is captured and matched to the visible log |
| Template edit after finish | AC-9. History still shows Seated Row at 90×12 and does not show Pec Fly |
| Project 22 suggestion can be typed over | Section 5. After 2×10 the next target is 2×11, and logging 2×8 stores 2×8 |
| Theme, weekly goal, bad restore | UX-2 and the restore guard |
| Offline reload and a set logged with the network off | UX-6, AC-7 |

Every test also fails if the page requests a host other than `127.0.0.1:4173`.

WebKit will not allow the test to read the clipboard back. The test wraps `navigator.clipboard.writeText`, checks that the app called it with the log, and checks that the call resolved (`Copied`).

## What automation does not do

- Swipe the iPhone app away and reopen it. That is in the UAT script.
- Add to Home Screen, or confirm persistent storage on a real phone.
- Airplane mode on hardware. The Playwright test turns the network off inside WebKit, which is the stand-in.
- The data-safety drill of deleting the icon and restoring. Steps are in [DATA-SAFETY.md](DATA-SAFETY.md) and the UAT script.
