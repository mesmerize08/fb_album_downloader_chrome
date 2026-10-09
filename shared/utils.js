(function (root) {
  'use strict';
  function albumFolder(value) {
    // Truncate before stripping trailing dots and spaces: cutting at 100 can
    // itself expose one, and Windows rejects a directory name that ends in either.
    const clean = String(value || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim()
      .slice(0, 100).replace(/[. ]+$/g, '').trim();
    if (!clean || /^\.+$/.test(clean)) return 'Untitled album';
    return (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean) ? '_' : '') + clean;
  }
  function photoId(value) {
    try {
      const u = new URL(value, 'https://www.facebook.com');
      if (!/(^|\.)facebook\.com$/.test(u.hostname)) return '';
      const query = u.searchParams.get('fbid') || u.searchParams.get('photo_id');
      if (query && /^\d+$/.test(query)) return query;
      const parts = u.pathname.split('/').filter(Boolean);
      const at = parts.findIndex(x => x === 'photos');
      if (at >= 0) {
        const tail = parts.slice(at + 1).filter(x => /^\d+$/.test(x));
        return tail.at(-1) || '';
      }
      return '';
    } catch { return ''; }
  }
  function albumId(value) {
    try {
      const u = new URL(value);
      if (!/(^|\.)facebook\.com$/.test(u.hostname)) return '';
      const set = u.searchParams.get('set');
      if (set && /^a\.\d+$/.test(set) && !u.searchParams.has('fbid')) return set.slice(2);
      const match = u.pathname.match(/(?:^|\/)albums\/(\d+)(?:\/|$)/);
      return match?.[1] || '';
    } catch { return ''; }
  }
  function parseSrcset(srcset) {
    return String(srcset || '').split(/,\s*(?=https?:|\/)/).map(part => {
      const match = part.trim().match(/^(\S+)(?:\s+(\d+)w)?/);
      return match ? { url: match[1], width: Number(match[2]) || 0 } : null;
    }).filter(Boolean).sort((a, b) => b.width - a.width);
  }
  function isFacebookImage(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && (/(^|\.)fbcdn\.net$/.test(u.hostname) || /(^|\.)facebook\.com$/.test(u.hostname));
    } catch { return false; }
  }
  function photoFilename(index, count, url) {
    let ext = 'jpg';
    try {
      const candidate = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[1]?.toLowerCase();
      if (candidate) ext = candidate === 'jpeg' ? 'jpg' : candidate;
    } catch { /* default jpg */ }
    return String(index).padStart(Math.max(3, String(count).length), '0') + '.' + ext;
  }
  const api = { albumFolder, albumId, photoId, parseSrcset, isFacebookImage, photoFilename };
  root.FBAD = Object.assign(root.FBAD || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
