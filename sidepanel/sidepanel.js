(async function () {
  'use strict';
  const { M } = FBAD;
  const el = id => document.getElementById(id);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  let context = null;
  let job = null;
  let uiError = '';
  const send = message => chrome.runtime.sendMessage({ ...message, tabId });
  const toTab = message => chrome.tabs.sendMessage(tabId, { ...message, tabId });
  const phaseLabels = {
    discovering: 'Finding photos', discovered: 'Photos found', resolving: 'Checking images',
    ready: 'Ready to download', downloading: 'Downloading', complete: 'Finished',
    stopped: 'Stopped', error: 'Needs attention'
  };
  const phaseMessages = {
    discovering: 'Scrolling through the album to find every photo.',
    discovered: 'All visible photos found. Preparing the full images.',
    resolving: 'Checking full-size photos in temporary background tabs. Your album stays open.',
    ready: 'Your photos are ready. Download them when you like.',
    downloading: 'Saving photos to your Facebook Albums folder.',
    complete: 'Downloads finished. Review any failed items below.',
    stopped: 'The job has stopped. Results found so far are still here.',
    error: 'The job needs attention. Review the message below.'
  };
  function render() {
    const photos = job?.photos || [];
    const phase = job?.phase;
    const resolved = photos.filter(p => p.imageUrl).length;
    const downloaded = photos.filter(p => p.status === 'downloaded').length;
    const processed = photos.filter(p => ['resolved', 'failed', 'downloading', 'downloaded'].includes(p.status)).length;
    const title = job?.metadata?.title || context?.title;
    el('album').textContent = title || (context?.isAlbum ? 'Untitled album' : 'No album open');
    el('owner').textContent = job?.metadata?.owner || context?.owner || '';
    const label = el('phase-label');
    label.textContent = !context?.isAlbum ? 'No album' : phaseLabels[phase] || 'Ready to scan';
    label.dataset.tone = job?.error || phase === 'error' ? 'error' : job?.warning || phase === 'stopped' ? 'warning' : '';
    el('discovered').textContent = String(photos.length);
    el('resolved').textContent = `${resolved} / ${photos.length}`;
    el('downloaded').textContent = `${downloaded} / ${photos.length}`;
    const scanProgress = ['ready', 'downloading', 'complete'].includes(phase) ? 100
      : phase === 'resolving' || (['stopped', 'error'].includes(phase) && processed > 0)
        ? 50 + (photos.length ? processed / photos.length * 50 : 0)
      : Math.min(50, photos.length / (job?.metadata?.statedCount || Math.max(photos.length + 1, 1)) * 50);
    const downloadProgress = photos.length ? downloaded / photos.length * 100 : 0;
    el('scan-progress').value = scanProgress;
    el('scan-percent').textContent = `${Math.round(scanProgress)}%`;
    el('download-progress').value = downloadProgress;
    el('download-percent').textContent = `${Math.round(downloadProgress)}%`;
    const busy = ['discovering', 'resolving', 'downloading'].includes(phase);
    const canDownload = photos.some(p => p.imageUrl && p.status !== 'downloaded');
    el('download').disabled = !canDownload || !['ready', 'stopped', 'complete'].includes(phase);
    el('stop').disabled = !busy;
    el('retry').disabled = !photos.some(p => p.status === 'failed') || busy;
    el('clear').disabled = busy || !job;
    el('scan').disabled = !context?.isAlbum || !context?.adapterReady || busy;
    el('scan').classList.toggle('primary', !['ready', 'stopped', 'complete'].includes(phase) || !canDownload);
    el('download').classList.toggle('primary', ['ready', 'stopped', 'complete'].includes(phase) && canDownload);
    let stage = 0;
    if (['resolving'].includes(phase)) stage = 1;
    if (['ready', 'downloading'].includes(phase)) stage = 2;
    if (phase === 'complete') stage = 3;
    if (phase === 'stopped' || phase === 'error') stage = downloaded ? 2 : resolved ? 1 : 0;
    for (const [index, id] of ['step-discover', 'step-resolve', 'step-download'].entries()) {
      el(id).classList.toggle('done', stage > index);
      el(id).classList.toggle('active', stage === index);
    }
    const message = el('message');
    message.textContent = uiError || job?.error || job?.warning || (context?.isAlbum
      ? phaseMessages[phase] || 'Scan the album to find its photos.'
      : context?.reason || 'Open a Facebook photo album before scanning.');
    message.dataset.tone = uiError || job?.error ? 'error' : job?.warning ? 'warning' : '';
    el('results-count').textContent = String(photos.length);
    const results = el('results');
    results.replaceChildren(...photos.map(p => {
      const row = document.createElement('div'); row.className = 'row';
      const dimensions = p.width && p.height ? `${p.width} × ${p.height}` : 'Unknown size';
      const friendlyStatus = { discovered: 'Found', resolving: 'Checking', resolved: 'Ready',
        starting: 'Starting', downloading: 'Saving', downloaded: 'Saved', failed: 'Failed' };
      for (const value of [String(p.index).padStart(3, '0'), friendlyStatus[p.status] || p.status,
        `${dimensions} · ${p.quality || 'Unresolved'}`]) {
        const cell = document.createElement('span'); cell.textContent = value; row.append(cell);
      }
      return row;
    }));
  }
  async function refresh() { job = (await send({ type: M.GET_JOB })).job; render(); }
  async function act(operation) {
    uiError = '';
    try {
      const response = await operation();
      if (response?.ok === false) uiError = response.error || 'The action could not be completed.';
    } catch (error) {
      uiError = error.message || 'The action could not be completed.';
    }
    await refresh();
  }
  const settings = await chrome.storage.local.get(['debug', 'fallback', 'concurrency']);
  el('debug').checked = Boolean(settings.debug);
  el('fallback').checked = settings.fallback !== false;
  el('concurrency').value = String(Math.max(1, Math.min(5, Number(settings.concurrency) || 3)));
  el('debug').onchange = () => chrome.storage.local.set({ debug: el('debug').checked });
  el('fallback').onchange = () => chrome.storage.local.set({ fallback: el('fallback').checked });
  el('concurrency').onchange = () => {
    const value = Math.max(1, Math.min(5, Number(el('concurrency').value) || 3));
    el('concurrency').value = String(value);
    chrome.storage.local.set({ concurrency: value });
  };
  try {
    if (!tabId || !/^https:\/\/(?:[^/]+\.)?facebook\.com\//.test(tab.url || '')) {
      context = { isAlbum: false, reason: 'Open a Facebook photo album before scanning.' };
    } else {
      for (let attempt = 0; attempt < 12; attempt++) {
        try { context = await toTab({ type: M.GET_PAGE_CONTEXT }); }
        catch { context = null; }
        if (context?.isAlbum) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!context) context = { isAlbum: false, reason: 'Reload the Facebook album, then reopen this panel.' };
    }
  } catch { context = { isAlbum: false, reason: 'Reload the Facebook album, then reopen this panel.' }; }
  await refresh();
  el('scan').onclick = () => act(async () => {
    await send({ type: M.CLEAR_JOB });
    return toTab({ type: M.START_DISCOVERY, useFallback: el('fallback').checked });
  });
  el('download').onclick = () => act(() => send({ type: M.START_DOWNLOAD, concurrency: el('concurrency').value }));
  el('stop').onclick = () => act(async () => {
    const response = await send({ type: M.STOP_JOB });
    await toTab({ type: M.STOP_JOB }).catch(() => {});
    return response;
  });
  el('retry').onclick = () => act(() => {
    const unresolved = (job?.photos || []).some(p => p.status === 'failed' && !p.imageUrl);
    return send({ type: unresolved ? M.START_RESOLUTION : M.START_DOWNLOAD,
      concurrency: el('concurrency').value });
  });
  el('clear').onclick = () => act(() => send({ type: M.CLEAR_JOB }));
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes[`job:${tabId}`]) refresh(); });
})();
