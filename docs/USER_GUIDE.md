# Facebook Album Downloader: user guide

## What it does

This extension saves photos from a Facebook album you can already view. It finds photos in the album, checks the full photo viewer for the best image Facebook exposes, and downloads the images to a folder on your computer. It does not download videos.

## Before you begin

1. Install the extension. It is distributed as source rather than through the Chrome Web Store, so install it unpacked: download the repository, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`. The [README](../README.md#install) has the full steps. Pin it to the toolbar afterwards.
2. Sign in to Facebook normally in Chrome.
3. Open the specific photo album you want to save.

## Scan and download

1. Click the extension icon to open its side panel. Check that the album name appears under **Current album**.
2. Open **Settings** if you want to change them. **Use a thumbnail when the viewer image is unavailable** is on by default. **Simultaneous downloads** defaults to 3 and accepts 1–5.
3. Click **Scan Album**. The album scrolls to discover photos, then the extension opens and closes a temporary inactive tab for each photo while it checks the full viewer. Keep the album tab open until the scan finishes.
4. Wait for **Ready to download**. The panel shows how many photos were found and how many images are ready. Expand **Photo results** to see each result's status and available image size.
5. Click **Download All**. Chrome saves the files under `Downloads/Facebook Albums/<album name>/` with numbered file names. Check the **Saved** count when the job finishes.

## Controls

- **Stop** halts a scan or download job in progress. If a download is already running, Chrome may cancel it.
- **Retry failed** tries unresolved photos again, or retries failed downloads after images have been found.
- **Clear results** removes the current album's scan results from extension session storage. It does not delete files already downloaded.
- **Debug logging** is an advanced setting for troubleshooting in Chrome's developer tools.

## If something is missing

- **The panel says “No album open.”** Open an individual Facebook photo album, refresh the page, and reopen the panel.
- **Fewer photos were found than Facebook's item count.** Let the album finish loading and scan again. The stated count can include items that are not photos, and Facebook may change how it loads albums.
- **An image uses a thumbnail.** The full viewer image could not be resolved. You can leave thumbnail fallback on to save it, or turn it off and scan again to mark unresolved photos as failed.
- **Downloads fail.** Check Chrome's Downloads page and your connection, then use **Retry failed**. Facebook image links can expire or become unavailable.

The extension uses your existing Facebook access. Respect the album owner's privacy and only save or share photos when you have permission.
