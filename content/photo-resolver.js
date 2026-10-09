(function (root) {
  'use strict';
  function extractViewer(adapter) {
    const viewer = adapter.findPhotoViewer();
    const image = viewer && adapter.findPrimaryViewerImage(viewer);
    if (!image) return null;
    const candidates = adapter.getImageCandidates(image).filter(x => root.FBAD.isFacebookImage(x.url));
    candidates.sort((a, b) => (b.width || 0) * (b.height || 1) - (a.width || 0) * (a.height || 1));
    return candidates[0] || null;
  }
  root.FBAD = Object.assign(root.FBAD || {}, { extractViewer });
})(globalThis);
