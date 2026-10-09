# Security Policy

## Supported versions

This project is at `0.1.0` and has a single maintainer. Only the latest commit
on `main` is supported. There are no backported fixes to earlier tags.

## Reporting a vulnerability

**Please do not open a public issue.**

Use GitHub's private vulnerability reporting:
[Report a vulnerability](https://github.com/mesmerize08/fb_album_downloader_chrome/security/advisories/new).
That page is enabled on this repository and goes only to the maintainer.

Useful to include:

- What the issue is, and what an attacker gains from it.
- Steps to reproduce, or a proof of concept.
- The commit or release you tested.
- Your Chrome version and operating system.

This is a spare-time project, so please expect an acknowledgement within about a
week rather than within hours. If you have had no reply after two weeks, feel
free to open a public issue saying only that you are waiting on a security
response — no details.

You will be credited in the changelog unless you would rather not be.

## Scope

**In scope**

- Code execution in the extension's privileged contexts: the service worker, the
  side panel, or the content script.
- A page-supplied value escaping validation — in particular a URL reaching
  `chrome.downloads.download()` without passing `isFacebookImage()`, or a path
  traversal through `albumFolder()` or `photoFilename()`.
- Any path by which the extension sends user data off the machine. It is
  designed to have none.
- Permission escalation beyond what `manifest.json` declares.
- An attacker-controlled Facebook page that can drive the extension into acting
  on behalf of the user without the user starting a scan.

**Out of scope**

- Facebook's own behaviour, rate limiting, markup changes, or Terms of Service.
  Report those to Meta.
- The extension being able to download photos your own logged-in session can
  already see. That is the feature.
- Image URLs expiring, or albums failing to parse after a Facebook redesign.
  Those are bugs — use the public issue tracker.
- Anything that requires an already-compromised browser profile or physical
  access to an unlocked machine.
- Chrome's own download or storage behaviour.

## Design notes relevant to security

Context for anyone reviewing the code:

- **No remote code.** Everything executes from the extension package. There is
  no `eval`, no injected `<script>`, and no CDN.
- **No network destinations other than Facebook.** The extension has no server,
  no analytics, and no telemetry. The only requests are the Facebook pages the
  user opens and the `fbcdn.net` image downloads Chrome performs.
- **No dependencies.** No `node_modules`, so there is no supply chain to
  compromise. The whole extension is readable in an afternoon.
- **Two validation gates.** `isFacebookImage()` restricts download URLs to
  `https` on `facebook.com` or `fbcdn.net`. `albumFolder()` and
  `photoFilename()` strip path separators, control characters, and trailing
  dots, handle Windows reserved device names, and cap length — because album
  titles are attacker-controllable text that becomes a file path.
- **No credentials are handled.** The extension relies on the browser's existing
  session cookies and never sees or stores a password.

If you find a gap in any of those claims, that is exactly the kind of report
this policy is for.
