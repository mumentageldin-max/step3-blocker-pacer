# Step 3 Pacer — Block, Review, CCS and Stats

Four pages, one installable app:

- **Block** (`index.html`) — 37:30 countdown for a 20-question UWorld block, checkpoint targets, ahead/behind verdicts, flag-at-50 mode, the 2:00 fill-every-blank alert. The time on the current question is big and in minutes (m:ss): amber from 1:00, orange from 1:30, red from 1:52 (37:30 ÷ 20) with its own soft sound once per question; violet "flag & move" from 0:50 after a behind checkpoint. Each stage has a word, not only a color.
- **Review** (`review.html`) — Timer A (90:00 in three 30-minute chunks with stands between) and Timer B (5:00 + 3:00 per wrong question, 30 s per correct one), K/M/T/G tagging, parking lot, EO-only sweep at the hard stop, notebook line.
- **CCS** (`ccs.html`) — a case screen that needs no tapping: one big clock counting up from 0:00 ("of 12:30" / "of 25:00", like the real-time clock on ccscases.com; USMLE's own CCS walkthrough shows no running real-time clock — you are told the maximum time before the case and warned at about two minutes left), the phase as a large color band (read → first orders → reassess loop → close → final orders), phase chimes, the final-orders alert and the end of the case all on their own. Pause (practice only) and Exit case are large and far apart; Exit and Discard keep the double-tap safety. A setting restores the old countdown. The order checklist is an optional fold, closed by default. The case log keeps only what ccscases.com cannot know: case number, case length, the words you misspelled (they feed the spelling drill), an optional score copied from ccscases, an optional note. A pre-case card, protocol lines per phase, the feedback-review timer, the spelling-keys lookup (435 orders) and the drill (sets, keys / spelling mode, best score per set) are unchanged.
- **Case template** (`template.html`) — the 12:30 case tracker as a printable landscape page; opens from the CCS page.
- **Stats** (`stats.html`) — every finished block, review and CCS case (edit or delete from the Sessions list), pacing per checkpoint, letters per review, scores, review discipline, a weekly report to paste to Claude. CCS lines read "case · length · score if entered · misspelled words"; CCS scores and feedback live in the ccscases.com Report Card and the app no longer draws conclusions from checklist taps (old sessions keep their fields and stay readable).

Live at **https://mumentageldin-max.github.io/step3-blocker-pacer/** — served by GitHub Pages from the
`gh-pages` branch of this repository. To update the app, change the files, bump `VERSION` in `sw.js`,
and push the same commit to both `main` and `gh-pages`.

## Install

- **iPad Pro:** open the address in Safari → Share → **Add to Home Screen**. Do it from the Block, Review and CCS pages if you want three icons.
- **Galaxy Z Fold 7:** open it in Chrome or Samsung Internet → ⋮ menu → **Install app**. The Review page offers its own install too.
- **iMac / Mac mini:** Safari → File → **Add to Dock**; or Chrome → the install icon at the right of the address bar.

After the first open it works offline.

## When the pacer is hidden behind UWorld or ccscases

Browsers freeze a hidden tab's timers and sound, and iPadOS gives a web app no background execution at all, so the app works in layers:

1. **Catch-up on return** (every device): all timing is wall-clock based. When the page becomes visible again it recomputes everything, fires each missed chime once, and shows one line — "While you were away (4:12): Q7: 1:52 budget passed at 10:14 · 2:00 left — fill every blank at 10:35". A review chunk that ended while hidden stops Timer A at the chunk end, not when you return.
2. **Notifications** (Settings → Background & sound → *Notify me when the app is hidden*): while a run is active and the page is hidden, the upcoming checkpoints, phase changes, the 1:52 budget, alerts, chunk ends and timer ends are scheduled as notifications (page timers plus the service worker, best effort). Timer-end notifications stay until dismissed; tapping one opens the pacer.
3. **Keep running in the background (Android)** (same settings block, off by default): a near-silent looping audio track with Media Session metadata ("Step 3 Pacer · block running") keeps the tab unthrottled on Android, so the real chimes fire on time. It stops when the run ends. Not offered on iPad / iPhone.
4. **Float the timer** (where the browser supports picture-in-picture): a small clock with the stage color that stays on top of the other app.

Per device, honestly:

- **iPad:** a hidden web app cannot play sound. Open the pacer from the Home Screen icon and allow notifications; otherwise keep it in split screen beside UWorld / ccscases. The catch-up covers whatever was missed.
- **Galaxy Z Fold 7:** allow notifications and turn on *Keep running in the background*. Chimes then play on time; notifications are the backup.
- **iMac / Mac mini:** allow notifications (Safari or Chrome); the catch-up covers the rest.

Chime volume (normal · quiet · whisper) is in the same settings block and applies to every page; the 1:52 sound is the only sine-wave sound in the app, so it is easy to tell apart.

## Progress and sync

Blocks, reviews and CCS cases save themselves on the device they ran on. Stats → *Sync across devices* merges all devices through a private GitHub gist: create one token with only the **gist** permission (link on the page), paste it on each device, press Sync. Stats → *Data* also exports and imports a JSON backup.

**Live sync of a run in progress:** with the same token, a block, review or case that is running is carried to the other devices through a second file in the same gist (`step3-pacer-live.json`). Start a review on the iPad, open the Review page on the Fold, and it picks the review up where it is — clocks included, because elapsed time is computed from timestamps — with a line "Picked up the review you started on your iPad at 10:14". Each page shows "Live sync on · last push 10:15:03" or "Live sync off — add the token in Stats". One pull on load and whenever the page becomes visible, one every 60 s while a run is active, one push about 2 s after a change; a finished run clears its slot so the other devices stop reviving it. Every device has an id and an editable name (Stats → Sync across devices; the default comes from the device: iPad / Android / Mac).

## Notes

- Settings (block length, checkpoint targets, review timers, case clock direction, theme) are per device. Background & sound settings are per device too, but shared by all four pages.
- Installed copies pick up a new `VERSION` of `sw.js` on their next open.
