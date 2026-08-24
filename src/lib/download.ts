/**
 * Download helpers that route file downloads through Lazycat's file-chooser
 * inject when it is present in the page.
 *
 * The Lazycat inject only intercepts download anchors whose `href` is a
 * `blob:` URL carrying a `download` attribute. Cumora attachments are served
 * from a plain URL, so a direct `<a href={url} download>` bypasses Lazycat's
 * "save to Lazycat storage" dialog. When the inject is active we therefore
 * fetch the bytes into a Blob, build a `blob:` URL, and trigger a programmatic
 * anchor click so Lazycat can offer "save local / save to Lazycat".
 *
 * Outside Lazycat we keep the file's native URL so a signed CDN URL streams
 * straight to the browser without an extra client-side round-trip.
 */

/** True when the Lazycat file-chooser inject is active in this page. */
export function hasLazycatFileChooser(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as unknown as Record<string, unknown>).__lzcOpenSaveChooserHooks)
}

/** Download a file URL as `filename`, honoring the Lazycat file interceptor. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  // Already a blob URL — nothing to convert, just trigger the download.
  if (url.startsWith('blob:') || !hasLazycatFileChooser()) {
    triggerAnchor(url, filename)
    return
  }

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerAnchor(objectUrl, filename)
    // Keep the blob URL alive long enough for the Lazycat inject to read it
    // when the user picks "Save to Lazycat" (the inject revokes it there); the
    // native path consumes it during the download. Release on a timer as a
    // safety net so the backing memory doesn't leak forever.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
  } catch {
    // Cross-origin / network failure — fall back to opening the URL directly.
    triggerAnchor(url, filename)
  }
}

function triggerAnchor(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
