importScripts('shared/utils.js', 'shared/messages.js');
const { M, albumFolder, photoFilename, isFacebookImage } = FBAD;
const key = tabId => `job:${tabId}`;
const locks = new Map();
const resolving = new Set();
const pumping = new Set();
const resolveAlarm = tabId => `resolve:${tabId}`;
const downloadAlarm = tabId => `download:${tabId}`;

async function getJob(tabId) {
  return (await chrome.storage.session.get(key(tabId)))[key(tabId)] || null;
}
function updateJob(tabId, change) {
  const previous = locks.get(tabId) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const old = await getJob(tabId) || { tabId, photos: [] };
    const patch = typeof change === 'function' ? change(old) : change;
    const next = { ...old, ...patch, updatedAt: Date.now() };
    await chrome.storage.session.set({ [key(tabId)]: next });
    return next;
  });
  locks.set(tabId, task);
  task.finally(() => { if (locks.get(tabId) === task) locks.delete(tabId); }).catch(() => {});
  return task;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function debug(label, value) {
  if ((await chrome.storage.local.get('debug')).debug) console.debug('[FBAD]', label, value);
}

async function waitForViewer(viewerTabId, expectedPhotoId) {
  for (let attempt = 0; attempt < 24; attempt++) {
    try {
      const result = await chrome.tabs.sendMessage(viewerTabId, { type: M.EXTRACT_VIEWER });
      if (result?.photoId === expectedPhotoId && result.candidate?.url && isFacebookImage(result.candidate.url)) {
        return result.candidate;
      }
    } catch { /* Content script may not have loaded yet. */ }
    await pause(500);
  }
  throw new Error('Facebook’s photo viewer did not load.');
}

async function resolveAlbum(tabId) {
  if (resolving.has(tabId)) return;
  resolving.add(tabId);
  let job = await getJob(tabId);
  if (!job?.photos?.length) {
    await updateJob(tabId, { phase: 'error', error: 'No photos were discovered in this album.' });
    resolving.delete(tabId);
    return;
  }
  await updateJob(tabId, { phase: 'resolving', error: '' });
  await chrome.alarms.create(resolveAlarm(tabId), { periodInMinutes: 0.5 });
  if (job.viewerTabId) await chrome.tabs.remove(job.viewerTabId).catch(() => {});
  await updateJob(tabId, { viewerTabId: null });
  let viewerTabId = null;
  let consecutiveFailures = 0;
  try {
    for (const photo of job.photos) {
      job = await getJob(tabId);
      if (job?.stopped) break;
      const albumTab = await chrome.tabs.get(tabId).catch(() => null);
      if (!albumTab || FBAD.albumId(albumTab.url || '') !== job.metadata?.albumId) {
        await updateJob(tabId, { stopped: true, error: 'The album tab changed or closed during resolution.' });
        break;
      }
      const current = job.photos.find(p => p.photoId === photo.photoId);
      if (current?.status === 'resolved' || current?.status === 'downloaded') continue;
      await updateJob(tabId, old => ({ photos: old.photos.map(p => p.photoId === photo.photoId ? { ...p, status: 'resolving' } : p) }));
      let candidate = null;
      for (let attempt = 0; attempt < 3 && !candidate; attempt++) {
        try {
          viewerTabId = (await chrome.tabs.create({ url: photo.permalink, active: false })).id;
          await updateJob(tabId, { viewerTabId });
          candidate = await waitForViewer(viewerTabId, photo.photoId);
        } catch (error) {
          await debug('viewer retry', { index: photo.index, attempt: attempt + 1, message: error.message });
          if (viewerTabId) await chrome.tabs.remove(viewerTabId).catch(() => {});
          viewerTabId = null;
          await updateJob(tabId, { viewerTabId: null });
          if (attempt < 2) await pause(500 * (attempt + 1));
        }
      }
      await updateJob(tabId, old => ({ photos: old.photos.map(p => {
        if (p.photoId !== photo.photoId) return p;
        if (candidate) return { ...p, imageUrl: candidate.url, width: candidate.width,
          height: candidate.height, quality: ['viewer-srcset', 'viewer-source'].includes(candidate.source)
            ? 'Highest exposed' : 'Viewer resolution',
          status: 'resolved', error: '' };
        return old.useFallback !== false && isFacebookImage(p.thumbnailUrl)
          ? { ...p, imageUrl: p.thumbnailUrl, width: p.gridWidth, height: p.gridHeight,
            quality: 'Thumbnail fallback', status: 'resolved', error: 'Viewer resolution unavailable.' }
          : { ...p, status: 'failed', quality: 'Failed', error: 'Photo could not be resolved.' };
      }) }));
      if (viewerTabId) await chrome.tabs.remove(viewerTabId).catch(() => {});
      viewerTabId = null;
      await updateJob(tabId, { viewerTabId: null });
      consecutiveFailures = candidate ? 0 : consecutiveFailures + 1;
      if (consecutiveFailures >= 3) {
        await updateJob(tabId, { stopped: true,
          error: 'Facebook’s photo viewer stopped responding. Wait and retry the failed photos later.' });
        break;
      }
    }
  } finally {
    if (viewerTabId) await chrome.tabs.remove(viewerTabId).catch(() => {});
    const latest = await getJob(tabId);
    await updateJob(tabId, { phase: latest?.stopped ? 'stopped' : 'ready', viewerTabId: null });
    await chrome.alarms.clear(resolveAlarm(tabId));
    resolving.delete(tabId);
  }
}

async function pumpDownloads(tabId) {
  if (pumping.has(tabId)) return;
  pumping.add(tabId);
  try {
  let job = await getJob(tabId);
  if (!job || job.stopped || job.phase !== 'downloading') return;
  const active = job.photos.filter(p => ['starting', 'downloading'].includes(p.status)).length;
  const slots = Math.max(0, (job.concurrency || 3) - active);
  const pending = job.photos.filter(p => p.status === 'resolved' && isFacebookImage(p.imageUrl)).slice(0, slots);
  for (const photo of pending) {
    job = await getJob(tabId);
    if (job?.stopped) return;
    // Reserve the slot before calling Chrome. onChanged may fire immediately.
    await updateJob(tabId, old => ({ photos: old.photos.map(p => p.index === photo.index ? { ...p, status: 'starting' } : p) }));
    const filename = `Facebook Albums/${albumFolder(job.metadata?.title)}/${photoFilename(photo.index, job.photos.length, photo.imageUrl)}`;
    try {
      const downloadId = await chrome.downloads.download({ url: photo.imageUrl, filename,
        conflictAction: 'uniquify', saveAs: false });
      await updateJob(tabId, old => ({ photos: old.photos.map(p => p.index === photo.index
        ? { ...p, status: 'downloading', downloadId } : p) }));
    } catch (error) {
      await updateJob(tabId, old => ({ photos: old.photos.map(p => p.index === photo.index
        ? { ...p, status: 'failed', error: 'Chrome could not start this download.' } : p) }));
    }
  }
  job = await getJob(tabId);
  if (job.photos.every(p => ['downloaded', 'failed'].includes(p.status))) {
    await updateJob(tabId, { phase: 'complete' });
    await chrome.alarms.clear(downloadAlarm(tabId));
  }
  } finally { pumping.delete(tabId); }
}

chrome.downloads.onChanged.addListener(async delta => {
  if (!['complete', 'interrupted'].includes(delta.state?.current)) return;
  const entries = await chrome.storage.session.get(null);
  for (const [storageKey, job] of Object.entries(entries)) {
    if (!storageKey.startsWith('job:') || !job.photos?.some(p => p.downloadId === delta.id)) continue;
    await updateJob(job.tabId, old => ({ photos: old.photos.map(p => p.downloadId === delta.id
      ? { ...p, status: delta.state.current === 'complete' ? 'downloaded' : 'failed',
        error: delta.state.current === 'complete' ? '' : delta.error?.current || 'Download interrupted.' } : p) }));
    await pumpDownloads(job.tabId);
    break;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name.startsWith('resolve:')) {
    const tabId = Number(alarm.name.slice(8));
    const job = await getJob(tabId);
    if (job?.phase === 'resolving' && !job.stopped) await resolveAlbum(tabId);
    else await chrome.alarms.clear(alarm.name);
  }
  if (alarm.name.startsWith('download:')) {
    const tabId = Number(alarm.name.slice(9));
    const job = await getJob(tabId);
    if (job?.phase === 'downloading' && !job.stopped) await pumpDownloads(tabId);
    else await chrome.alarms.clear(alarm.name);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const tabId = message.tabId;
    switch (message.type) {
      case M.GET_JOB: return { job: await getJob(tabId) };
      case M.CLEAR_JOB:
        await chrome.storage.session.remove(key(tabId));
        return { ok: true };
      case M.DISCOVERY_PROGRESS:
        await updateJob(tabId, old => old.stopped ? {} : { metadata: message.metadata, photos: message.photos, phase: 'discovering' });
        return { ok: true };
      case M.DISCOVERY_COMPLETE:
        if ((await getJob(tabId))?.stopped) return { ok: true };
        await updateJob(tabId, { metadata: message.metadata, photos: message.photos,
          useFallback: message.useFallback, phase: 'discovered',
          warning: message.metadata?.statedCount && message.photos.length !== message.metadata.statedCount
            ? `Found ${message.photos.length} of ${message.metadata.statedCount} stated items. Some album items may not be photographs or may not have loaded.` : '' });
        void resolveAlbum(tabId).catch(error => updateJob(tabId, { phase: 'error', error: error.message }));
        return { ok: true };
      case M.START_RESOLUTION:
        if (!(await getJob(tabId))?.photos?.length) throw new Error('Scan the album first.');
        await updateJob(tabId, { stopped: false, phase: 'resolving' });
        void resolveAlbum(tabId).catch(error => updateJob(tabId, { phase: 'error', error: error.message }));
        return { ok: true };
      case M.ERROR:
        await updateJob(tabId, old => old.stopped ? { phase: 'stopped' } : { phase: 'error', error: message.error });
        return { ok: true };
      case M.STOP_JOB:
        await updateJob(tabId, { stopped: true, phase: 'stopped' });
        await chrome.alarms.clear(downloadAlarm(tabId));
        for (const photo of (await getJob(tabId)).photos.filter(p => p.status === 'downloading' && p.downloadId)) {
          await chrome.downloads.cancel(photo.downloadId).catch(() => {});
        }
        return { ok: true };
      case M.START_DOWNLOAD:
        await updateJob(tabId, old => {
          if (!old.photos.some(p => p.imageUrl)) throw new Error('No resolved photos are ready.');
          return { phase: 'downloading', stopped: false, concurrency: Math.max(1, Math.min(5, Number(message.concurrency) || 3)),
            photos: old.photos.map(p => p.status === 'failed' && p.imageUrl ? { ...p, status: 'resolved', downloadId: null } : p) };
        });
        await chrome.alarms.create(downloadAlarm(tabId), { periodInMinutes: 0.5 });
        await pumpDownloads(tabId);
        return { ok: true };
      default: return { ok: false, error: 'Unknown message.' };
    }
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
