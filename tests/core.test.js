const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../shared/utils.js');

test('album filenames are safe and retain deterministic order', () => {
  assert.equal(U.albumFolder('A/B: C?'), 'A_B_ C_');
  assert.equal(U.photoFilename(1, 150, 'https://x.fbcdn.net/a.jpg?x=1'), '001.jpg');
  assert.equal(U.photoFilename(1000, 1000, 'https://x.fbcdn.net/a.webp'), '1000.webp');
});

test('long album titles never truncate into a trailing dot or space', () => {
  // Windows rejects a directory name ending in '.' or ' ', and the 100-character
  // cut is itself capable of creating one.
  for (const tail of ['.', ' ']) {
    const folder = U.albumFolder('A'.repeat(99) + tail + 'B'.repeat(50));
    assert.ok(folder.length <= 100, `expected at most 100 characters, got ${folder.length}`);
    assert.doesNotMatch(folder, /[. ]$/, `folder ended with ${JSON.stringify(folder.slice(-1))}`);
  }
  assert.equal(U.albumFolder('   '), 'Untitled album');
  assert.equal(U.albumFolder('..'), 'Untitled album');
  assert.equal(U.albumFolder('CON'), '_CON');
});

test('srcset ranking uses numeric width, not candidate order', () => {
  const found = U.parseSrcset('https://x.fbcdn.net/a.jpg 2048w, https://x.fbcdn.net/b.jpg 960w');
  assert.equal(found[0].width, 2048);
  assert.equal(found[0].url, 'https://x.fbcdn.net/a.jpg');
});

test('photo ids are stable across equivalent Facebook permalinks', () => {
  assert.equal(U.photoId('https://www.facebook.com/photo.php?fbid=123&set=a.8'), '123');
  assert.equal(U.photoId('https://www.facebook.com/alice/photos/a.8/123/'), '123');
});

test('rejects off-site image and unsafe file paths', () => {
  assert.equal(U.isFacebookImage('https://evil.example/a.jpg'), false);
  assert.equal(U.albumFolder(' .. '), 'Untitled album');
  assert.equal(U.albumFolder('CON'), '_CON');
});

test('album URL detection accepts different owner paths without accepting a photo permalink', () => {
  assert.equal(U.albumId('https://www.facebook.com/media/set/?set=a.123'), '123');
  assert.equal(U.albumId('https://www.facebook.com/groups/7/media/albums/123/'), '123');
  assert.equal(U.albumId('https://www.facebook.com/photo.php?fbid=4'), '');
});
