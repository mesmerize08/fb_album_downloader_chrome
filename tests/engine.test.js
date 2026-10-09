const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const utils = require('../shared/utils.js');

function load(file, environment) {
  const context = vm.createContext({ ...environment, FBAD: { ...utils } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  return context;
}

test('progressive scan deduplicates cards loaded after scrolling and restores position', async () => {
  let onMutation;
  const context = load('content/album-scanner.js', {
    scrollY: 0, innerHeight: 100, location: { href: 'https://www.facebook.com/media/set/?set=a.1' },
    document: { documentElement: { scrollHeight: 350 } },
    MutationObserver: class { constructor(callback) { onMutation = callback; } observe() {} disconnect() {} },
    scrollBy(_x, delta) { context.scrollY += delta; onMutation(); },
    scrollTo(_x, y) { context.scrollY = y; },
    setTimeout(callback) { callback(); }
  });
  const adapter = {
    getAlbumMetadata: () => ({ isAlbum: true, statedCount: 3 }),
    findVisibleAlbumPhotos: () => context.scrollY === 0
      ? [{ photoId: '1' }, { photoId: '1' }]
      : context.scrollY < 1000 ? [{ photoId: '1' }, { photoId: '2' }] : [{ photoId: '2' }, { photoId: '3' }]
  };
  const result = await context.FBAD.discover(adapter, { aborted: false }, () => {});
  assert.deepEqual([...result.photos.map(p => p.photoId)], ['1', '2', '3']);
  assert.deepEqual([...result.photos.map(p => p.index)], [1, 2, 3]);
  assert.equal(context.scrollY, 0);
});

test('viewer resolver picks largest eligible image candidate', () => {
  const context = load('content/photo-resolver.js', {});
  const selected = context.FBAD.extractViewer({
    findPhotoViewer: () => ({}),
    findPrimaryViewerImage: () => ({}),
    getImageCandidates: () => [
      { url: 'https://x.fbcdn.net/low.jpg', width: 417, height: 300 },
      { url: 'https://evil.test/a.jpg', width: 5000, height: 4000 },
      { url: 'https://x.fbcdn.net/high.jpg', width: 2048, height: 1366 }
    ]
  });
  assert.equal(selected.url, 'https://x.fbcdn.net/high.jpg');
});
