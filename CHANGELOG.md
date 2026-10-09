# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The version here matches the `version` field in `manifest.json` and
`package.json`; all three are raised together, and CI fails if they disagree.

## [Unreleased]

Nothing yet.

## [0.1.0] - 2026-10-09

First public release. Working and tested end to end on a 79-photo public Page
album, but only on that one album format.

### Added

- Side panel UI with three-phase progress (discover, resolve, download), live
  counts, per-photo results, and a settings disclosure.
- Album discovery that scrolls the album container and collects photo links,
  deduplicating by Facebook photo ID, stopping at the stated item count or after
  four quiet scans, and restoring the original scroll position.
- Full-resolution resolution: opens each photo's permalink in a temporary
  inactive tab and selects the largest image the viewer exposes, ranking
  `srcset` candidates by true pixel width. Retries three times per photo and
  aborts the run after three consecutive failures.
- Optional thumbnail fallback when the viewer image cannot be resolved, on by
  default.
- Download queue with configurable concurrency (1-5), ordered zero-padded
  filenames, and output to `Downloads/Facebook Albums/<album name>/`.
- **Stop**, **Retry failed**, and **Clear results** controls.
- Service-worker resilience: job state in `chrome.storage.session`, keyed per
  tab, with `chrome.alarms` resuming resolution and download work after Chrome
  suspends the worker.
- Serialised job mutations through a per-tab promise chain, and download slot
  reservation before calling Chrome, so that a fast `downloads.onChanged` event
  cannot cause a lost update or a double start.
- URL and filename validation: `isFacebookImage()` restricts downloads to
  `https` on `facebook.com` and `fbcdn.net`; `albumFolder()` and
  `photoFilename()` sanitise album titles into safe paths, including Windows
  reserved device names and trailing dots or spaces left by truncation.
- Debug logging setting, emitting `[FBAD]` traces to the page and service worker
  consoles.
- Generated 16/32/48/128 px icon set, with `tools/make_icons.py` to reproduce it.
- Nine-test suite on Node's built-in runner, with no dependencies.
- Documentation: README, user guide, contributing guide, security policy, and
  privacy statement.

### Known limitations

- Only the public Page album format is verified. Profile albums, group albums,
  tagged-photo sets, and non-English locales are untested.
- Videos are not downloaded.
- Saves the largest image Facebook serves to its viewer, which is not the
  original upload.

[Unreleased]: https://github.com/mesmerize08/fb_album_downloader_chrome/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mesmerize08/fb_album_downloader_chrome/releases/tag/v0.1.0
