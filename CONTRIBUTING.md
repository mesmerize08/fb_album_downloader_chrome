# Contributing

Thanks for looking. This is a small, deliberately simple project, and the
conventions below are what keep it that way.

## Getting set up

```bash
git clone https://github.com/mesmerize08/fb_album_downloader_chrome.git
cd fb_album_downloader_chrome
npm test
```

There is nothing to install. Node 18 or newer, and Chrome 116 or newer for
manual testing. Load the folder through `chrome://extensions` → **Developer
mode** → **Load unpacked**.

After editing, press reload on the extension card. Content script changes also
need a reload of the Facebook tab, because the old script is still running
there.

## The most useful contribution

**Album layouts the adapter does not handle yet.** The extension was built
against one album format. Profile albums, group albums, tagged-photo sets, and
non-English locales are all untested. If you have access to one of those and it
fails, that is the highest-value bug report in the tracker — and often a
one-selector fix.

## Four rules

**1. No dependencies.** Not for the extension, not for the tests. Everything
runs on Node's built-in test runner and the browser's own APIs. A dependency in
a downloader that touches someone's photos is a supply-chain risk, and keeping
`node_modules` out of the picture means a user can read the whole extension
before loading it. `tools/make_icons.py` needs Pillow, but it is a build-time
convenience, never shipped, and its output is committed.

**2. Facebook DOM knowledge stays in `content/facebook-adapter.js`.** That file
is the only place allowed to know what Facebook's markup looks like — selectors,
class-name guesses, DOM shape assumptions, the `N Items` string. Everything else
talks to it through `getAlbumMetadata`, `findVisibleAlbumPhotos`,
`getScrollContainer`, `findPhotoViewer`, `findPrimaryViewerImage`, and
`getImageCandidates`. Facebook will break this project; the boundary is what
keeps the repair to one file.

If you need a new piece of page information, add a function to the adapter
rather than reaching into the DOM from the scanner or the resolver.

**3. Validate every URL before using it.** `isFacebookImage()` in
`shared/utils.js` gates image URLs, and `albumFolder()` / `photoFilename()` gate
anything that becomes a file path. A page-supplied string must never reach
`chrome.downloads.download()` or a filename without passing through them. Album
titles come from a hostile-by-default source and have to survive Windows
reserved names, path separators, and trailing dots.

**4. Keep the job-state discipline.** Every write to a job goes through
`updateJob()` in `background.js`, which serialises mutations per tab through a
promise chain. Reading a job, mutating the object, and writing it back directly
will lose updates — `chrome.downloads.onChanged` fires at genuinely awkward
moments. Likewise, the download pump reserves a photo's slot (`status:
'starting'`) *before* calling Chrome, because the completion event can arrive
before the `download()` promise resolves.

## Style

Match what is already there. Concretely: vanilla JavaScript, no transpiler, no
framework, no bundler. `'use strict'` and the IIFE module pattern used across
`shared/` and `content/`. Two-space indent, single quotes, semicolons. Comments
only where the code cannot explain itself — usually the *why* behind a Facebook
quirk or a race-condition guard, as in the existing ones.

User-facing strings are full sentences with ordinary punctuation. Error messages
say what happened and what to do, not what failed internally.

## Tests

Add a test when you change pure logic — anything in `shared/utils.js`, the
download queue, the discovery loop's dedupe and termination behaviour, or
candidate ranking. `npm test` must pass before you open a pull request; CI runs
the same command on Node 18, 20, and 22.

Do not add tests that mock Facebook's DOM. They pass forever and tell you
nothing, because the markup they assert against is the thing that changes.
Adapter changes are verified by hand against a real album, and the pull request
should say which album type you tested on.

## Pull requests

- One change per pull request.
- Say which album type you tested against, and your Chrome version.
- Note anything you could not test — untested is fine, silently untested is not.
- Update `CHANGELOG.md` under `## Unreleased`.
- If you changed what data is touched or which permissions are needed, update
  the permission table in `README.md` and `docs/PRIVACY.md` to match. Those are
  published claims, and they have to stay true.

Commit messages: a short imperative subject line, and a body explaining why if
the reason is not obvious from the diff.

## Reporting bugs

Use the issue templates. For an album that is not detected, include the URL
*shape* with numeric IDs replaced by `<id>`, your Chrome version, your Facebook
interface language, and the output from **Debug logging** if you can get it
(settings → **Debug logging**, then check the console on both the Facebook page
and the service worker in `chrome://extensions` → **service worker**).

Please redact anything identifying. Album titles, owner names, and photo IDs are
other people's information, and issues are public.

## Scope

Things that fit: adapter fixes, reliability, accessibility, clearer errors,
performance of the scan loop, better handling of partial failures.

Things that do not: video downloading, bypassing anything Facebook does not
already show your session, automation beyond a user-initiated scan of a single
open album, and any form of analytics or remote code.

## Security

Do not open a public issue for a security problem. See [SECURITY.md](SECURITY.md).

## Licence

Contributions are accepted under the [MIT License](LICENSE).
