# AFI Fitness Tracker

Offline workout log for one person at Planet Fitness. The supported daily path is the iPhone Home Screen icon. Logging in a browser tab is for testing only: automated checks and a desk preview. Phase 1 only: five workout templates, set logging, the machine catalog, Project 22 suggestions, and a history that does not change after you finish.

Copyright (c) 2026 mcgovernafi-blip, owner of this source. All rights reserved.

The GitHub account that owns this repository does not publish a personal name, so the copyright line names that account. No license is granted. There is no `LICENSE` file.

## What you can do

- Start any of the five workouts on any day. The weekday label is only a suggestion.
- Log each set’s weight, reps, and a check. Rotary Torso starts as reps per side. Any exercise can be switched to per side.
- Add or remove sets. A set is removed immediately until you type or check it. After that, the app asks first.
- Add, remove, reorder, or substitute machines. Save that to the template, or keep it for today.
- Finish a workout. The saved log is read-only. Later template edits do not change it.
- Copy the log as text, download history as CSV, or save a full JSON backup and restore it.
- Keep working with the network off after the app has been opened once online.

Project 22 only recommends the next weight and reps. It never rewrites a finished set, and missed days do not reset anything.

## Architecture

```
iPhone Home Screen web app
  UI (Preact, large touch targets, light/dark)
  Domain (pure TypeScript)
    session edits · template versions · Project 22 · export
  Repository
    DexieRepository → IndexedDB
    SyncAdapter interface, not implemented
  Service worker
    precached app shell, no runtime network, no analytics
```

The UI writes through a small queue so two taps cannot overwrite each other. A finished or discarded session cannot be saved again. Template versions are insert-only. Exercise names on a finished workout are snapshots, so renaming a machine does not rewrite history.

`SyncAdapter` in `src/data/sync.ts` is the seam for a later sync client. Phase 1 does not implement it and does not call the network at runtime. The only requests are the static app files from the host you opened.

Sessions are stored as one document each (exercises and sets nested inside). That matches the rule that a finished workout is a single immutable record. Catalog rows, template versions, progression, settings, and the warm-up default list are separate IndexedDB tables.

## Data model

Schema version 1.

- **Exercise** — catalog row. `perSide`, `incrementLb` (default 5 lb, editable), `archived` instead of delete.
- **WorkoutTemplate** — one of the five names, a suggested weekday, and `currentVersion`.
- **TemplateVersion** — immutable list of exercises, target sets, reps, and weight. Editing a template writes the next version.
- **WorkoutSession** — `in_progress`, `completed`, or `discarded`. Holds the template version id it started from, a name snapshot, warm-up checks, recovery rows, notes, energy (1–5), joint discomfort (0–3), and mood before/after.
- **Session exercise and sets** — snapshots. `origin` is `template`, `added`, or `substituted`. A set stores weight, reps or left/right reps, done, an optional note, and `touched` (true after you edit or check it).
- **ProgressionState** — per exercise, not per weekday. `stage` is 10, 11, or 12. `pendingSuggestion` is the next recommendation. `overrides` is an append-only log when you lift a different weight, rep count, or set count.
- **Settings** — weekly visit goal (default 3), units `lb` only, theme, last backup time, persistent-storage flag, and a random device id.

Starting a workout copies the current template version into the session and prefills two sets from Project 22, or from the template when that exercise has no history yet. The five templates ship with no exercises. The request did not name which machines or starting weights belong in each day, so none were invented.

### Project 22

Evaluated when you finish, from the sets you actually checked off. It does not look at the calendar.

Working sets are the first two completed sets at the remembered weight. For per-side exercises the rep count is the lower of left and right. Extra sets are stored and ignored by the rule.

- Fewer than two working sets, or either set short of the current stage: hold.
- Stage 10 met: suggest 2×11 at the same weight.
- Stage 11 met: suggest 2×12 at the same weight.
- Stage 12 met with Form OK on: suggest 2×10 at the current weight plus that machine’s increment.
- Stage 12 met with Form OK off: hold. The weight does not go up.

The next workout prefills that suggestion. You can type over it. The finished log keeps the numbers you entered. If you complete two sets at a different weight, that weight is remembered and the rule continues from the reps you did. Nothing decreases by itself.

### Recovery and warm-up

Warm-up defaults are Easy cardio, Joint mobility, and Light warm-up set. Change them in Settings. A workout keeps the copy it started with.

Recovery activities are HydroMassage, Massage Chair, Pool Walking, Swimming, Mobility Exercises, Stretching, and Nightly Reset Yoga. HydroMassage starts planned on every workout. Massage Chair starts planned on B days (Back & Biceps B, Chest & Triceps B). All of them are optional.

Energy, joints, mood, and recovery are saved on the session. Charts and dashboard panels for progression and recovery are not in this phase.

## Catalog

Seeded names, in the request’s order:

Seated Row, Lat Pulldown, Chest Press, Incline Chest Press, Pec Fly, Rear Delt Fly, Shoulder Press, Lateral Raise, Biceps Curl, Triceps Extension, Cable Triceps Pushdown, Assisted Dip, Seated Leg Press, Leg Extension, Seated Leg Curl, Hip Abduction, Hip Adduction, Rotary Torso, Abdominal Crunch, Back Extension, Cable Pallof Press.

Seated Row, Cable Triceps Pushdown, and Cable Pallof Press are labeled cable. The others are labeled stack. The label is only a label. Every machine starts at a 5 lb increment. Only Rotary Torso starts as per side. You can change the increment, the per-side flag, the name, and archive a machine. Archived machines stay in history and drop out of the picker.

## Build

Node.js 22 or newer.

```bash
npm ci
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. `npm run dev` is the same app with a live reload and without the production service worker. Use `preview` when you want to try offline.

There is no hosted preview in this repo. GitHub Pages is not enabled, and this project does not create another account or a deploy workflow. To try it before Pages exists, run the commands above on a computer and open the local URL. A phone on the same network can use `npm run dev -- --host`, but that still depends on the dev server and is not the installed app.

### Base path

The default build uses `/`, which is what local preview needs. GitHub Pages for this repo would serve the site under `/afi-fitness-tracker/`.

```bash
npm run build:pages
```

That sets `VITE_BASE=/afi-fitness-tracker/`. The router strips that prefix, and the build also copies `index.html` to `404.html` so a refresh on a path such as `/history` still loads the app. `public/.nojekyll` is included so Pages does not drop files. CI checks this build. It does not publish it.

When you later turn Pages on yourself: Settings → Pages → Deploy from a branch, and publish the `dist/` output of `npm run build:pages`. Do not use a workflow that publishes on every pull request. Data still never leaves the phone; the public site is only the empty app.

## Install on an iPhone

1. Deploy the Pages build, or use a local preview only for a desk check.
2. Open the HTTPS URL in **Safari**. Add to Home Screen has to be done from Safari so the icon gets its own storage.
3. Share → **Add to Home Screen** → Add.
4. Open the icon once while online. After that it runs offline.
5. Settings, or Export & backup, should show the storage line. Take a full JSON backup into Files or iCloud Drive.
6. Updates: open the icon once online. The service worker swaps in the new shell. IndexedDB is migrated in place. This phase only has schema version 1, and a backup from a newer app is refused rather than guessed.

The Home Screen icon is the supported way to log workouts day to day. It is the install that keeps its own storage. A browser tab, including a Safari tab, is for testing only (CI and a local preview). The tab shows an Add to Home Screen banner. Keep backups.

## Tests

See [docs/TESTING.md](docs/TESTING.md). The iPhone pass is [docs/IPHONE-UAT.md](docs/IPHONE-UAT.md). Backup and eviction are [docs/DATA-SAFETY.md](docs/DATA-SAFETY.md).

## Decisions and differences

- **D-1** Installable offline PWA (TypeScript, Preact, Vite, Dexie, Workbox, Vitest, Playwright WebKit at an iPhone viewport). The original request also accepted a native app or React Native. This is the $0 path with no 7-day re-sign and no Apple Developer account.
- **D-4 / D-5** This public repo. Pages hosting is documented and not turned on here.
- **D-6** 5 lb default increment, editable per machine. Per-side can be set on any exercise. Only Rotary Torso starts that way. The plan’s sketch also marked Cable Pallof Press as per-side; the request only names Rotary Torso, so Pallof Press starts as a normal rep count.
- **D-7** Pounds only.
- **D-8** Form OK defaults to on, per exercise, in the exercise menu.
- **D-9** Templates ship empty: the five names only. The request says each workout initially contains five machine exercises and does not list them or the weights. Inventing five machines per day would have been a guess, so you add them on the first visit.
- **D-10** Short editable warm-up list, generic on purpose.
- **D-11** Each session records energy, joints, mood, and the recovery checklist. Progress charts, comparison charts, and recovery panels are Phase 2. The request’s own phase list puts progression analysis and recovery tracking in Phase 2.
- **D-12** Ten acceptance criteria, AC-1 through AC-10.
- **D-13** You own the source. `package.json` is `private` and has no `license` field.
- **D-14** Data stays on the device. No analytics, no sync, no third-party requests.

The Home Screen icon is the supported daily path. Logging in a browser tab is for testing only. The plan said a tab should refuse logging. CI and a local preview run in a tab, so the app still accepts entries there and shows the Add to Home Screen banner. Gym sessions belong on the icon.

Phase 2 and Phase 3 are not started.

## Known limits

- Deleting the Home Screen icon, or clearing the site’s data, deletes the log. Back up.
- Web storage is not the same as a native app’s iCloud backup.
- No haptics. iOS web apps do not get them.
- One person, one browser profile, pounds only.
- Desktop WebKit at an iPhone size is the automated check. A real iPhone pass is still required before calling Phase 1 accepted.
