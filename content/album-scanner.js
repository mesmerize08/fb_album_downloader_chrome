(function (root) {
  'use strict';
  async function discover(adapter, signal, onProgress) {
    const metadata = adapter.getAlbumMetadata();
    if (!metadata.isAlbum) throw new Error(metadata.reason || 'Open a Facebook photo album before scanning.');
    const found = new Map();
    const scrollContainer = adapter.getScrollContainer?.() || document.scrollingElement || document.documentElement;
    const originalY = scrollContainer.scrollTop ?? scrollY;
    const originalUrl = location.href;
    let quiet = 0;
    let dirty = true;
    let terminationReason = 'iteration limit';
    const observer = new MutationObserver(() => { dirty = true; });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    try {
      for (let step = 0; step < 1000; step++) {
        if (signal.aborted) throw new Error('Scan stopped.');
        if (location.href !== originalUrl) throw new Error('The page changed during scanning.');
        const before = found.size;
        if (dirty || step === 0) {
          for (const photo of adapter.findVisibleAlbumPhotos()) {
            const key = photo.photoId || photo.permalink;
            if (key && !found.has(key)) found.set(key, { index: found.size + 1, ...photo, status: 'discovered' });
          }
          dirty = false;
        }
        onProgress({ metadata, photos: [...found.values()], phase: 'discovering' });
        if (metadata.statedCount && found.size >= metadata.statedCount) {
          terminationReason = 'stated count reached';
          break;
        }
        const top = scrollContainer.scrollTop ?? scrollY;
        const height = scrollContainer.clientHeight || innerHeight;
        const atEnd = top + height >= scrollContainer.scrollHeight - 8;
        quiet = atEnd && found.size === before ? quiet + 1 : 0;
        if (quiet >= 4) {
          terminationReason = 'end of album after repeated quiet scans';
          break;
        }
        const distance = Math.max(500, height * 0.8);
        if (scrollContainer === document.scrollingElement || scrollContainer === document.documentElement) scrollBy(0, distance);
        else scrollContainer.scrollTop += distance;
        await new Promise(resolve => setTimeout(resolve, 650));
      }
      return { metadata, photos: [...found.values()], terminationReason };
    } finally {
      observer.disconnect();
      if (location.href === originalUrl) {
        if (scrollContainer === document.scrollingElement || scrollContainer === document.documentElement) scrollTo(0, originalY);
        else scrollContainer.scrollTop = originalY;
      }
    }
  }
  root.FBAD = Object.assign(root.FBAD || {}, { discover });
})(globalThis);
