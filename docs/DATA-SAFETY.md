# Data safety and backup

The log lives in this web app’s storage on the phone. It is not sent to a server. There is no account and no analytics.

## What can delete it

- Deleting the Home Screen icon deletes that icon’s website data.
- Clearing Safari website data for this site deletes it, including data belonging to the icon.
- A nearly full phone can cause iOS to reclaim website data. Home Screen web apps are supposed to be kept, but that is not a promise you can treat as a backup.
- This storage is not the same as a native app’s slice of an iCloud device backup.

A Safari tab is a weaker place to keep the log. WebKit can drop script storage for sites that stay in a tab. Use the Home Screen icon for real sessions. The app asks for persistent storage on launch and shows Persistent or Not persistent under Export & backup.

## What is stored

Workouts, the machine catalog, template versions, Project 22 state, settings, and the warm-up list. Settings include a random device id so a future sync design has something to stamp records with. It is not your name, email, or Apple ID.

Finished workouts are immutable. Restore replaces the whole database with the file you pick. It does not merge.

## Back up

1. Export & backup → **Full backup (JSON)**.
2. Save the file to Files, and put it somewhere that iCloud Drive already backs up if you want it off the phone.
3. The screen shows the backup date. You do not need a new account. The share sheet uses the Apple ID already on the phone.

After you finish a workout, if the last full backup is missing or older than 7 days, a reminder appears. Dismiss it. It does not block the log. It comes back the next time you finish until you take a backup.

Copy as text is a second copy of one workout. It is not a full backup. CSV is the history of sets, also not a full restore file. Keep at least one JSON backup.

## Restore

1. Install the app again, or open the icon.
2. Export & backup → Restore from backup, and choose the JSON file.
3. Read the confirm line. Restore replaces everything currently on the device.
4. Open History and one session you remember. The weights and notes should match the file.

A file from a newer schema version is rejected. A file that is not this app’s backup is rejected. Your current log stays in place when a file is rejected.

## Drill

Do this once before you depend on the app.

1. Finish one short test workout with a weight you will recognize.
2. Take a full JSON backup.
3. Delete the Home Screen icon.
4. Safari → Add to Home Screen again, and open the icon.
5. History is empty. That is the deletion risk, confirmed.
6. Restore the JSON file.
7. The test workout is back, with the same weight and notes.

If step 7 fails, stop using the app for real sessions until you know why. The source of truth you can still hold is the JSON file from step 2.
