# iPhone UAT

Do this on the phone, from the Home Screen icon, after one online open. The Home Screen icon is the supported daily path. Logging in a browser tab is for testing only and is not this sign-off. Phase 1 is accepted only when you sign this off. Use a workout you are willing to throw away, or back up first.

Airplane-mode and swipe-away are at the bottom. They are part of the pass.

## AC-1 — Select any of my five workouts

1. Open the app. Confirm all five names are on the home screen: Back & Biceps A, Chest & Triceps A, Back & Biceps B, Chest & Triceps B, Legs & Stretching.
2. On a weekday, the top card suggests that day’s label. On Saturday or Sunday it tells you to pick any workout.
3. Open a workout that is not today’s label. The title matches the one you tapped.
4. Go back and open each of the other four. Each opens. None of them is blocked because it is the wrong day.

## AC-2 — Complete individual sets

1. Add Seated Row.
2. Check only set 2.
3. Leave set 1 unchecked.
4. Swipe the app away, or at least background it, then reopen.
5. Only set 2 is still checked.

## AC-3 — Enter actual weights and repetitions

1. On set 1 enter 90 lb and 12 reps. On set 2 enter 85 lb and 10 reps.
2. Add Rotary Torso. It shows L and R, not one rep box.
3. Enter L 12 and R 11.
4. Reopen the app. All four numbers are still there, and the two Seated Row sets are still different from each other.

## AC-4 — Add and remove sets

1. Tap Add set. A third set appears.
2. Tap Remove set immediately. It disappears with no question.
3. Type a weight into the last remaining set.
4. Tap Remove set. The app asks. Confirm. The set is gone. Cancel on a later try and the set stays.

## AC-5 — Add and substitute machine exercises

1. From the workout, Add exercise, search Pec Fly, add it for today only.
2. Open the ··· menu on Seated Row, Substitute, choose Lat Pulldown. The row reads “sub for Seated Row”.
3. Add a custom exercise named whatever you want. It appears in the workout and later in the catalog.
4. On the catalog, change that machine’s increment and turn per-side on. A new set uses the new increment and L/R. The workout you already finished, if any, does not change.
5. Reorder with Move up / Move down, and Remove from today. Today’s list changes. The template does not, until you tap “Save today’s exercises to template” or choose “Today + save to template”.

## AC-6 — Finish and save a workout

1. Tap Finish workout. Confirm.
2. The summary has the finish time and the numbers you typed.
3. There are no weight steppers. You cannot change the log.
4. Home shows the visit count increased by one, and the workout is under Recent.

## AC-7 — Close and reopen without losing data

1. Mid-set, type a weight and do not finish.
2. Swipe the app away from the app switcher.
3. Open the icon. Resume is on the home screen and the weight is still there.
4. Finish a workout, swipe away, reopen. The finished log is unchanged.

## AC-8 — Review a previous workout

1. History lists the finished workout with the day and a duration.
2. Open it. Exercises, weights, reps, substitutions, incomplete exercises, notes, energy, joints, mood, and recovery match what you entered.
3. Open an exercise’s history. Older sessions for that machine are listed. This is the Phase 1 comparison. Charts are not in this phase.

## AC-9 — Preserve historical results after modifying a workout template

1. Finish a workout that contains Seated Row at a weight you will recognize.
2. Catalog → that workout → remove Seated Row, add a different machine, Save as new version.
3. Open the finished workout again. Seated Row and the old weight are still there. The new machine is not in that log.
4. Start the workout again. The new template version is what you get, not a rewritten past.

## AC-10 — Export or copy a completed workout log

1. On the summary, Copy as text. Paste into Notes. The paste includes the workout name, date, sets, and notes.
2. Export & backup → Share workout history (CSV). The file opens and has one row per set.
3. Full backup (JSON) saves a file. Restore is covered in the data-safety drill.

## UX checks

| ID | Check |
|---|---|
| UX-1 iPhone | You can run the whole workout with the phone in one hand. Nothing important sits under the home indicator. |
| UX-2 themes | Settings → Dark, then Light, then System. The screen follows. |
| UX-3 targets | Set checks, steppers, and the finish button are easy to hit. No tiny icons you have to pinch for. |
| UX-4 typing | A normal set is a check, or a couple of stepper taps, not a form. |
| UX-5 auto-retain | You never tap a separate Save for a set. Leaving the field keeps the number. |
| UX-6 offline | Turn on airplane mode, log a set, finish or leave it, and the entry is still there. |
| UX-7 restore after close | Same as AC-7. |
| UX-8 exportable history | CSV from Export & backup. |
| UX-9 copy as text | Same as AC-10. |

## Airplane mode

1. Open the icon once while online so the shell is cached.
2. Turn on airplane mode.
3. Start a workout, add a machine, log two sets, finish.
4. Reopen from the icon, still in airplane mode. History shows the workout.

## Swipe-close mid-workout

1. Start a workout and type a weight that is not a round default.
2. Swipe the app away.
3. Open the icon. Resume. The weight is the one you typed.

## Data-safety drill

Follow [DATA-SAFETY.md](DATA-SAFETY.md): back up, delete the icon, add it again, restore, and confirm the history matches.

## Sign-off

Phase 1 is accepted only if every AC above worked on your phone. Phase 2 stays unstarted until then.

- Date:
- Phone and iOS version:
- Result:
- Notes:
