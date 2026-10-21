# Step 3 Block Pacer — install as an app

This folder is a complete web app (PWA). Once it is hosted at a web address it installs to the home
screen of the iPad Pro and the Galaxy Z Fold 7, opens full-screen with its own icon, and works offline.

## 1. Host it (one time, about two minutes)

GitHub Pages is free and permanent:

1. Sign in at github.com → **New repository** → name it `step3-block-pacer`, keep it Public → Create.
2. On the empty repo page choose **uploading an existing file**, drag in everything in this folder
   (`index.html`, `manifest.webmanifest`, `sw.js`, `README.md` and the `icons` folder) → **Commit changes**.
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main / (root)** → Save.
4. After a minute the page shows your address: `https://<your-username>.github.io/step3-block-pacer/`

Any other static host works too (Netlify, Cloudflare Pages). Keep the files together in one folder.

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
- To update the app later, replace the files on GitHub and change `VERSION` in `sw.js`; installed copies refresh on their next open.
