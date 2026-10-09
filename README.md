# Facebook Album Downloader

A Chrome extension that saves the full-resolution photos from a Facebook album
you can already view, in bulk, without a server, an account, or a build step.

[![Tests](https://github.com/mesmerize08/fb_album_downloader_chrome/actions/workflows/tests.yml/badge.svg)](https://github.com/mesmerize08/fb_album_downloader_chrome/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-154f9a.svg)](manifest.json)

Facebook's album pages serve small grid thumbnails and offer no way to export an
album. Saving each photo by hand means opening the viewer, right-clicking, and
picking a filename, once per photo. This extension automates that loop: it
scrolls the album to find every photo, opens each photo's viewer in a temporary
background tab to read the largest image Facebook exposes there, and hands the
resulting URLs to Chrome's download manager with ordered filenames.

On the album this was built against, grid thumbnails were 417 px wide while the
viewer images were 2048 x 1366 — the difference between a contact sheet and
something you can actually print.

---

## Contents

- [Status](#status)
- [Install](#install)
- [Use it](#use-it)
- [What it does and does not do](#what-it-does-and-does-not-do)
- [Privacy](#privacy)
- [How it works](#how-it-works)
- [Project layout](#project-layout)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Legal](#legal)

---

## Status

Working and in real use, but young. Version 0.1.0. It installs unpacked from
this repository; there are no plans to publish it to the Chrome Web Store.

The Facebook adapter was built from the rendered DOM of a 79-photo public Page
album. The album displayed `79 Items`, progressive scrolling exposed 79 distinct
photo links, and the first viewer image loaded at 2048 x 1366 against a 417 px
grid thumbnail. End-to-end scanning, viewer resolution, and downloading have
been confirmed by the album owner in Chrome.

Other album formats — personal profile albums, tagged-photo sets, group albums,
and non-English Facebook locales — have **not** been tested yet. Facebook
changes its DOM often. If an album type fails for you,
[open an issue](https://github.com/mesmerize08/fb_album_downloader_chrome/issues/new?template=album-not-detected.yml);
the page-reading logic is isolated in one file so that fixes stay small.

## Install

No build step. The repository is the extension.

1. Get the code: either
   `git clone https://github.com/mesmerize08/fb_album_downloader_chrome.git`,
   or **Code → Download ZIP** and unzip it somewhere permanent. Chrome loads the
   extension from this folder every time it starts, so do not leave it in a
   temporary directory.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Pin the extension to the toolbar so the icon is easy to reach.

Requires Chrome 116 or newer, for the Side Panel API. Chromium-based browsers
with side panel support, such as Edge 116+, generally work but are not tested.

To update later, pull the latest changes and press the reload button on the
extension's card in `chrome://extensions`.

## Use it

1. Sign in to Facebook in Chrome as you normally would.
2. Open the album you want to save. The URL should look like
   `facebook.com/media/set/?set=a.<id>&type=3` or `.../albums/<id>`.
3. Click the extension icon. The side panel opens and shows the album name under
   **Current album**.
4. Click **Scan Album**. The album scrolls itself to discover every photo, then
   the extension opens and closes one temporary inactive tab per photo to read
   the full viewer image. Leave the album tab open until this finishes.
5. Wait for **Ready to download**, then click **Download All**.

Files land in `Downloads/Facebook Albums/<album name>/` with zero-padded
numbered filenames (`001.jpg`, `002.jpg`, ...) that preserve the album's order.

The [user guide](docs/USER_GUIDE.md) covers the settings, the **Stop** /
**Retry failed** / **Clear results** controls, and what to do when a photo does
not resolve.

## What it does and does not do

**It does**

- Find every photo in an album by scrolling it, deduplicating by Facebook photo
  ID.
- Read the largest image each photo's viewer exposes, preferring `srcset`
  candidates ranked by true pixel width rather than DOM order.
- Show per-photo status and resolved pixel dimensions before you commit to
  downloading.
- Download 1-5 photos at a time, with retry for failures and a working stop
  button.
- Survive the Manifest V3 service worker being suspended mid-job, via
  `chrome.alarms`.

**It does not**

- Download videos. Album items that are videos are skipped.
- Access anything your logged-in Facebook session cannot already see. There is
  no scraping of private content, no credential handling, and no API key.
- Guarantee the original upload resolution. It saves the largest image *Facebook
  serves to the viewer*, which is itself a re-encode of the original.
- Work on arbitrary Facebook surfaces. It targets album pages specifically.

## Privacy

There is no server. No analytics, no telemetry, no account system, and no
network destination other than Facebook itself.

| What | Where it lives | How long |
| --- | --- | --- |
| Scan results (photo list, URLs, dimensions, status) | `chrome.storage.session` | Until Chrome's session ends, or **Clear results** |
| Settings (thumbnail fallback, concurrency, debug logging) | `chrome.storage.local` | Until you uninstall or clear extension storage |
| Downloaded images | Your `Downloads` folder | Until you delete them |

Every permission in [`manifest.json`](manifest.json) and why it is there:

| Permission | Why |
| --- | --- |
| `downloads` | Save the images through Chrome's download manager. |
| `storage` | Hold the current scan in session storage and your settings in local storage. |
| `sidePanel` | Show the controls and progress beside the album. |
| `alarms` | Resume resolution and download work after Chrome suspends the service worker. |
| `facebook.com` host access | Read the open album page and photo viewers to find photos. |
| `fbcdn.net` host access | Fetch the image files from Facebook's CDN. |

See [docs/PRIVACY.md](docs/PRIVACY.md) for the full statement, including how to
verify these claims against the source yourself.

## How it works

Three phases, coordinated by the background service worker, with one job record
per Facebook tab held in session storage.

```
sidepanel/           background.js               content/ (in the Facebook tab)

 Scan Album  ───────────────────────────────▶  album-scanner.js
                                                 scrolls the album, collects
                                                 photo links via the adapter
             ◀──── DISCOVERY_PROGRESS ───────    (streamed while scrolling)
             ◀──── DISCOVERY_COMPLETE ───────

 (renders)    resolveAlbum()
                for each photo:
                  open inactive tab ─────────▶  photo-resolver.js
                  at the photo permalink         picks the largest viewer
             ◀──── EXTRACT_VIEWER reply ─────    image candidate
                  close the tab

 Download All ─▶ pumpDownloads()
                  chrome.downloads.download(), N in flight
             ◀──── downloads.onChanged ──────  Chrome
```

**Discovery** ([`content/album-scanner.js`](content/album-scanner.js)) scrolls
the album container, using a `MutationObserver` to avoid re-scanning an
unchanged DOM. It stops when it reaches Facebook's own stated item count, or
after four consecutive quiet scans at the bottom of the list, and restores your
original scroll position afterwards.

**Resolution** ([`background.js`](background.js)) opens each photo's permalink
in an inactive tab, polls the content script until the viewer image for the
expected photo ID appears, and takes the highest-resolution candidate. It
retries each photo up to three times and aborts the whole run after three
consecutive failures, rather than hammering Facebook. If the viewer never
resolves, the photo falls back to its grid thumbnail — or is marked failed, if
you turn that setting off.

**Downloading** ([`background.js`](background.js)) keeps up to `concurrency`
downloads in flight, reserving each slot *before* calling Chrome so a fast
`onChanged` event cannot double-start a photo. Every job mutation goes through a
per-tab promise chain (`updateJob`) so concurrent handlers cannot clobber each
other's writes to session storage.

**All Facebook-specific DOM knowledge lives in one file**,
[`content/facebook-adapter.js`](content/facebook-adapter.js). When Facebook
changes its markup, that is the file to fix; nothing else needs to know how
Facebook renders an album.

## Project layout

```
manifest.json                  Manifest V3 declaration
background.js                  Service worker: job state, resolution, download queue
shared/
  utils.js                     URL parsing, filename safety, srcset ranking (pure, tested)
  messages.js                  Frozen message-type constants
content/
  facebook-adapter.js          All Facebook DOM selectors — the fragile part, isolated
  album-scanner.js             Scroll-and-collect discovery loop
  photo-resolver.js            Picks the best image candidate from a viewer
  content.js                   Message router inside the Facebook tab
sidepanel/                     The UI (HTML, CSS, vanilla JS — no framework)
icons/                         Generated PNG icon set
tools/make_icons.py            Regenerates icons/ from the camera glyph
tests/                         Node built-in test runner, no dependencies
docs/                          User guide and privacy statement
```

## Development

```bash
git clone https://github.com/mesmerize08/fb_album_downloader_chrome.git
cd fb_album_downloader_chrome
npm test
```

`npm test` runs the suite with Node's built-in test runner (`node --test`).
There are **no npm dependencies** — no `node_modules`, no lockfile, no install
step. Node 18 or newer is required.

The tests cover the pure logic worth protecting: filename safety, `srcset` width
ranking, photo-ID normalisation across permalink shapes, album-URL detection,
the download queue's concurrency and slot reservation, deduplication during
progressive scanning, and viewer candidate selection. The DOM-dependent code is
deliberately thin and verified by hand against real albums, because mocking
Facebook's markup would only test the mock.

To work on the extension: edit, then press reload on the extension card in
`chrome://extensions`. Content script changes also need a reload of the Facebook
tab. Turn on **Debug logging** in the side panel's settings for `[FBAD]` traces
in the service worker and page consoles.

To regenerate icons after changing the glyph: `pip install Pillow`, then
`python tools/make_icons.py`.

[CONTRIBUTING.md](CONTRIBUTING.md) describes the conventions this codebase
follows.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Panel says **No album open** | Open an individual album page, reload the tab, reopen the panel. Check the URL contains `set=a.<id>` or `/albums/<id>`. |
| Fewer photos found than Facebook's stated count | Some items are videos, or the album had not finished loading. Scan again. The stated count includes non-photo items. |
| A photo shows **Thumbnail fallback** | The viewer image could not be read. Use **Retry failed**, or turn off thumbnail fallback to mark those as failed instead. |
| "Facebook's photo viewer stopped responding" | Three photos failed in a row and the run stopped deliberately. Wait a few minutes, then **Retry failed**. |
| Downloads fail | Facebook image URLs expire. Re-scan the album, then download again. |
| Nothing is there after a Chrome restart | Session storage is cleared with the browser session. Scan again. |

If an album type is not detected at all, that is an adapter issue — please
[file it](https://github.com/mesmerize08/fb_album_downloader_chrome/issues/new?template=album-not-detected.yml)
with the album URL shape (IDs redacted) and your Chrome version.

## Contributing

Issues and pull requests are welcome, particularly fixes for album layouts the
adapter does not yet handle. Read [CONTRIBUTING.md](CONTRIBUTING.md) first — it
explains the adapter boundary, the test expectations, and the no-dependencies
rule. Security reports go through [SECURITY.md](SECURITY.md), not the public
issue tracker.

## Legal

MIT licensed — see [LICENSE](LICENSE).

This is an independent project. It is **not affiliated with, endorsed by, or
sponsored by Meta Platforms, Inc. or Facebook.** "Facebook" is a trademark of
Meta Platforms, Inc., used here only to describe what the extension works with.

The extension accesses only what your own logged-in session can already see.
That is not the same as permission to redistribute what you download. Photos are
the copyright of whoever took them, and albums you can view may still be private
in every way that matters to the people in them. Download and share only where
you have the right to. You are responsible for your own use, including
compliance with Facebook's Terms of Service.

Provided as-is, with no warranty.
