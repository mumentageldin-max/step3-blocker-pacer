# Step 3 Pacer — Block, Review, CCS and Stats

Four pages, one installable app:

- **Block** (`index.html`) — 37:30 countdown for a 20-question UWorld block, checkpoint targets, ahead/behind verdicts, flag-at-50 mode, the 2:00 fill-every-blank alert.
- **Review** (`review.html`) — Timer A (90:00 in three 30-minute chunks with stands between) and Timer B (5:00 + 3:00 per wrong question, 30 s per correct one), K/M/T/G tagging, parking lot, EO-only sweep at the hard stop, notebook line.
- **CCS** (`ccs.html`) — real-time pacer for CCS cases at 12:30 or 25:00 (1.25×): read → first orders → reassess loop → close → final orders (REACT), a pre-case card with a 5-second anchor breath and exam-clock checkpoints, protocol lines under the clock that change with the phase and with Unstable/Stable (HAVOC, 3-3-3 + HUE, ADMIT CORT, SAVE), an eight-item order checklist with time stamps, the 2:30 final-orders alert, a case log (score, the one missed order), and a spelling-keys lookup + 10-order drill (the 3–4 letters you type in Primum before picking from the list).
- **Stats** (`stats.html`) — every finished block and review, pacing per checkpoint, letters per review, scores, review discipline, CCS scores, what you skip in a case, "what to fix next" from the Daily Card rules, and a weekly report to paste to Claude.

Live at **https://mumentageldin-max.github.io/step3-blocker-pacer/** — served by GitHub Pages from the
`gh-pages` branch of this repository. To update the app, change the files, bump `VERSION` in `sw.js`,
and push the same commit to both `main` and `gh-pages`.

## Install

- **iPad Pro:** open the address in Safari → Share → **Add to Home Screen**. Do it from the Block, Review and CCS pages if you want three icons.
- **Galaxy Z Fold 7:** open it in Chrome or Samsung Internet → ⋮ menu → **Install app**. The Review page offers its own install too.
- **iMac / Mac mini:** Safari → File → **Add to Dock**; or Chrome → the install icon at the right of the address bar.

After the first open it works offline. Keep the app visible beside UWorld (split screen) so the chimes can fire; a hidden app is paused by the device.

## Progress and sync

Blocks, reviews and CCS cases save themselves on the device they ran on. Stats → *Sync across devices* merges all devices through a private GitHub gist: create one token with only the **gist** permission (link on the page), paste it on each device, press Sync. Stats → *Data* also exports and imports a JSON backup.

## Notes

- Settings (block length, checkpoint targets, review timers, theme) are per device.
- Installed copies pick up a new `VERSION` of `sw.js` on their next open.
