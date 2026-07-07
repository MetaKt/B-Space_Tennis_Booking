// Saves an image to the phone's Photos/Gallery app where possible.
//
// The HTML `download` attribute only writes into the Files app (iOS) or Downloads
// folder (Android/desktop) — there is no web API that writes directly into Photos.
// The only way to reach Photos from a web page is the native Share Sheet via the
// Web Share API (`navigator.share` with a file), which offers "Save Image"/"Save to
// Photos" as one of its targets. Support is feature-detected, not device-sniffed:
// most phone browsers (iOS Safari 15+, Android Chrome) support sharing files, while
// desktop browsers mostly don't — so desktop naturally falls back to a normal
// file download, which is the expected behavior there anyway.
export async function shareOrDownloadImage(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (error) {
    // AbortError means the user dismissed the share sheet — not a failure, do nothing.
    if (error?.name === 'AbortError') return;
    // Any other failure (fetch error, share unsupported at runtime, etc.) falls
    // through to the plain download below.
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
