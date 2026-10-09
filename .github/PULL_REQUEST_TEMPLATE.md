## What this changes

<!-- One or two sentences. Link the issue it closes, if there is one. -->

Closes #

## Why

<!-- The reason, if the diff does not make it obvious. -->

## How it was tested

**Automated**

- [ ] `npm test` passes locally

**By hand** — this project's riskiest code cannot be unit tested, so please say
what you actually loaded and clicked.

- Album type tested: <!-- public Page album / profile album / group album / tagged photos / event / n/a -->
- Approximate photo count:
- Chrome version:
- Operating system:

<!-- What you did and what happened. "Scanned a 40-photo profile album, found
     all 40, resolved 38, two fell back to thumbnails" is the right level of detail. -->

**Not tested**

<!-- Be explicit. Untested is acceptable; silently untested is not. -->

## Checklist

- [ ] No new runtime dependencies, and no `node_modules`
- [ ] Any new Facebook DOM knowledge lives in `content/facebook-adapter.js`
- [ ] Page-supplied URLs still pass through `isFacebookImage()` before reaching
      `chrome.downloads.download()`
- [ ] Page-supplied text still passes through `albumFolder()` / `photoFilename()`
      before becoming a file path
- [ ] Job state is only mutated through `updateJob()`
- [ ] Tests added or updated for changed pure logic
- [ ] `CHANGELOG.md` updated under `## Unreleased`
- [ ] If permissions or data handling changed: the tables in `README.md` and
      `docs/PRIVACY.md` were updated to match
- [ ] If `manifest.json` version changed: `package.json` was raised to match

## Notes for the reviewer

<!-- Anything you are unsure about, or deliberately left for later. -->
