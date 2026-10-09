# Privacy

What this extension touches, where it goes, and how long it stays. There is no
server involved at any point.

## What it accesses

When you choose to scan a Facebook album, the extension reads the album page and
the individual photo viewers available in your current Facebook browser session.
It processes the album title, photo links, image URLs, image dimensions, and the
scan and download status needed to find and save the photos.

It never sees or stores your Facebook password. It relies entirely on the
session you are already logged into, and it can reach nothing your own browser
could not already display.

## Where that data lives

| What | Where | How long |
| --- | --- | --- |
| The current scan: photo list, URLs, dimensions, per-photo status | `chrome.storage.session` | Until Chrome's session ends, or you press **Clear results** |
| Settings: thumbnail fallback, simultaneous downloads, debug logging | `chrome.storage.local` | Until you uninstall the extension or clear its storage |
| The downloaded images | `Downloads/Facebook Albums/<album name>/` on your computer | Until you delete them |

**Clear results** removes the current album's scan from session storage. Chrome
clears session storage by itself when the browser session ends. Uninstalling the
extension removes its settings. None of those delete image files you have
already downloaded.

## What it does not do

- No developer-operated server. There is nowhere for your data to be sent.
- No analytics, telemetry, crash reporting, or usage tracking.
- No account system, sign-in, or identifier of any kind.
- No advertising, and no sharing with third parties.
- No remotely hosted code. Everything that runs ships inside the extension.
- No third-party dependencies, so no other party's code runs either.

## Network activity

The only requests the extension causes are to Facebook: loading the photo viewer
pages it opens in temporary background tabs, and the image downloads Chrome
performs from Facebook's content delivery domains (`fbcdn.net`). Facebook and
Chrome handle those under their own policies.

## Debug logging

Turning on **Debug logging** in the settings writes `[FBAD]` diagnostic lines —
including photo IDs, URL paths, and image dimensions — to Chrome's developer
console. Those stay on your machine and are discarded when you close the
console. They exist so you can include useful detail in a bug report; redact
anything identifying before posting one, since issues are public.

## Verifying this yourself

This is the advantage of an unpacked extension: you can check every claim above
rather than taking it on trust. The whole thing is a few hundred lines of plain
JavaScript with no build step and no dependencies. Search the source for `fetch`
and `XMLHttpRequest` — there are none. The only outbound call is
`chrome.downloads.download()` in `background.js`, and the URL it receives must
pass `isFacebookImage()` first.

## Changes

If this changes, it changes here and in the permission table in the
[README](../README.md#privacy) at the same time.
