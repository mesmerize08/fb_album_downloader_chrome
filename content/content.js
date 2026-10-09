(function (root) {
  'use strict';
  const { M, adapter, discover, extractViewer } = root.FBAD;
  let controller;
  let progressChain = Promise.resolve();
  async function debug(label, value) {
    if ((await chrome.storage.local.get('debug')).debug) console.debug('[FBAD]', label, value);
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === M.GET_PAGE_CONTEXT) {
      const metadata = adapter.getAlbumMetadata();
      void debug('album', { url: metadata.url, albumId: metadata.albumId,
        title: metadata.title, statedCount: metadata.statedCount });
      sendResponse(metadata);
      return;
    }
    if (message.type === M.STOP_JOB) {
      controller?.abort();
      sendResponse({ ok: true });
      return;
    }
    if (message.type === M.EXTRACT_VIEWER) {
      const candidate = extractViewer(adapter);
      void debug('viewer candidate', candidate ? { path: new URL(candidate.url).pathname,
        width: candidate.width, height: candidate.height, source: candidate.source } : null);
      sendResponse({ photoId: root.FBAD.photoId(location.href), candidate });
      return;
    }
    if (message.type === M.START_DISCOVERY) {
      if (controller) { sendResponse({ ok: false, error: 'A scan is already running.' }); return; }
      controller = new AbortController();
      discover(adapter, controller.signal, progress => {
        progressChain = progressChain.then(() => chrome.runtime.sendMessage({ type: M.DISCOVERY_PROGRESS,
          tabId: message.tabId, ...progress })).catch(() => {});
      }).then(async result => {
        await progressChain;
        await debug('discovery', { ids: result.photos.map(p => p.photoId),
          terminationReason: result.terminationReason });
        await chrome.runtime.sendMessage({ type: M.DISCOVERY_COMPLETE, tabId: message.tabId,
          useFallback: message.useFallback, ...result });
      }).catch(error => {
        chrome.runtime.sendMessage({ type: M.ERROR, tabId: message.tabId, error: error.message }).catch(() => {});
      }).finally(() => { controller = null; });
      sendResponse({ ok: true });
    }
  });
})(globalThis);
