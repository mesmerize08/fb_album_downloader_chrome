(function (root) {
  'use strict';
  const U = root.FBAD;
  const albumSet = id => `a.${id}`;
  const text = element => element?.textContent?.trim() || '';

  function getAlbumMetadata() {
    const albumId = U.albumId(location.href);
    let title = '';
    let statedCount = null;
    if (albumId) {
      // Observed on the supplied album: an "N Items" span near the title.
      const item = [...document.querySelectorAll('span')].find(span => /^\d+\s+Items\b/i.test(text(span)) && span.children.length < 3);
      if (item) {
        statedCount = Number(text(item).match(/^(\d+)/)?.[1]) || null;
        const block = item.parentElement?.parentElement?.parentElement;
        title = text(block?.firstElementChild?.querySelector('span[dir="auto"]'));
      }
    }
    if (!title) title = document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*\|\s*Facebook\s*$/i, '').trim();
    const owner = [...document.querySelectorAll('h2')].map(text).find(value => value && value !== 'More tools') || '';
    const isAlbum = Boolean(albumId && (statedCount !== null || findVisibleAlbumPhotos(albumId).length));
    return { isAlbum, adapterReady: true, title, albumId, owner, statedCount,
      url: location.href, reason: isAlbum ? '' : 'Open a Facebook photo album before scanning.' };
  }

  function findVisibleAlbumPhotos(id = U.albumId(location.href)) {
    if (!id) return [];
    const photos = [];
    for (const anchor of document.querySelectorAll('a[href]')) {
      const image = anchor.querySelector('img');
      if (!image) continue;
      let url;
      try { url = new URL(anchor.href); } catch { continue; }
      if (url.searchParams.get('set') !== albumSet(id)) continue;
      const photoId = U.photoId(url.href);
      if (!photoId) continue;
      const thumbnailUrl = image.currentSrc || image.src || '';
      if (!U.isFacebookImage(thumbnailUrl)) continue;
      photos.push({ photoId, permalink: `https://www.facebook.com/photo/?fbid=${photoId}&set=${albumSet(id)}`,
        thumbnailUrl, gridWidth: image.naturalWidth || null, gridHeight: image.naturalHeight || null });
    }
    return photos;
  }

  function getScrollContainer() {
    const first = [...document.querySelectorAll('a[href]')].find(anchor => {
      try { return new URL(anchor.href).searchParams.get('set') === albumSet(U.albumId(location.href)) && anchor.querySelector('img'); }
      catch { return false; }
    });
    for (let node = first?.parentElement; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY;
      if (/auto|scroll/.test(overflow) && node.scrollHeight > node.clientHeight + 100) return node;
    }
    return document.scrollingElement || document.documentElement;
  }

  function findPhotoViewer() {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(node => node.querySelector('img'));
    if (dialog) return dialog;
    // Direct photo permalinks render the same viewer without a dialog role.
    if (U.photoId(location.href) && /^\/photo(?:\/|\.php)/.test(location.pathname)) return document;
    return null;
  }

  function findPrimaryViewerImage(viewer) {
    return [...viewer.querySelectorAll('img')].filter(image => {
      const box = image.getBoundingClientRect();
      return U.isFacebookImage(image.currentSrc || image.src) && box.width >= 200 && box.height >= 150;
    }).sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0] || null;
  }

  function getImageCandidates(image) {
    const result = [];
    const ratio = image.naturalWidth && image.naturalHeight ? image.naturalHeight / image.naturalWidth : 0;
    const addSrcset = (value, source) => {
      for (const candidate of U.parseSrcset(value)) result.push({ url: candidate.url,
        width: candidate.width || image.naturalWidth || null,
        height: candidate.width && ratio ? Math.round(candidate.width * ratio) : image.naturalHeight || null,
        source });
    };
    addSrcset(image.srcset, 'viewer-srcset');
    for (const source of image.closest('picture')?.querySelectorAll('source[srcset]') || []) addSrcset(source.srcset, 'viewer-source');
    if (image.currentSrc) result.push({ url: image.currentSrc, width: image.naturalWidth || null,
      height: image.naturalHeight || null, source: 'viewer-current-src' });
    if (image.src && image.src !== image.currentSrc) result.push({ url: image.src,
      width: image.naturalWidth || null, height: image.naturalHeight || null, source: 'viewer-src' });
    return result.filter(candidate => U.isFacebookImage(candidate.url));
  }

  root.FBAD = Object.assign(U, { adapter: { getAlbumMetadata, findVisibleAlbumPhotos,
    getScrollContainer, findPhotoViewer, findPrimaryViewerImage, getImageCandidates } });
})(globalThis);
