# Step 3 Block Pacer — install as an app

This folder is a complete web app (PWA). Once it is hosted at a web address it installs to the home
screen of the iPad Pro and the Galaxy Z Fold 7, opens full-screen with its own icon, and works offline.

## 1. Where it lives

Live at **https://mumentageldin-max.github.io/step3-blocker-pacer/** — served by GitHub Pages from the
`gh-pages` branch of this repository. To update the app, change the files, bump `VERSION` in `sw.js`,
and push the same commit to both `main` and `gh-pages`.

## 2. Install on the iPad Pro

Open the address in **Safari** → Share button → **Add to Home Screen** → Add.
The icon opens the pacer full-screen. For a block, open UWorld and the pacer side by side
(drag the pacer in from the Dock as a Split View or Slide Over) so the chimes keep firing.

## 3. Install on the Galaxy Z Fold 7

Open the address in **Chrome** or **Samsung Internet** → menu (⋮) → **Install app** / **Add to Home screen** → Install.
On the inner screen use split screen with UWorld (recents → app icon → Open in split screen view).
On the cover screen it runs as a normal phone-width app.

## Notes

- Sound and vibration cues need the app to be visible on screen. A hidden app is paused by the phone,
  which is why split screen is the intended setup.
- Settings (block length, checkpoint targets, theme) are saved on each device.
- Installed copies pick up a new `VERSION` of `sw.js` on their next open.
