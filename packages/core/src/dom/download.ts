// Saving a Blob as a file (add-qr-code design §6), shared with later image-producing
// components: an anchor with an object URL, clicked once, the URL revoked right after.

/** The document a download anchor is created in (an element's, or the global one). */
type Doc = Pick<Document, "createElement"> & { readonly body: HTMLElement | null }

/**
 * Removes path separators, `..` segments and control characters; an empty result becomes
 * `fallback`. The browser applies its own rules on top; this keeps a hostile name readable.
 */
export function sanitizeFileName(name: string, fallback: string): string {
  const cleaned = name
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are removed
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .split(/[/\\]+/)
    .filter((part) => part !== "" && part !== "." && part !== "..")
    .join("-")
    .replace(/^\.+/, "")
    .trim()
  return cleaned === "" ? fallback : cleaned
}

/**
 * Saves `blob` as `fileName` through a temporary anchor. The object URL is revoked in the
 * next task: the browser has started the download by then (revoking during the click
 * cancels it in some engines). Returns the URL, so callers and tests can check it.
 */
export function saveBlob(
  doc: Doc,
  blob: Blob,
  fileName: string,
  /** Runs the revocation in a later task (a machine passes its scheduler). */
  later: (callback: () => void) => void = (callback) => setTimeout(callback, 0),
): string {
  const url = URL.createObjectURL(blob)
  const a = doc.createElement("a")
  a.href = url
  a.download = fileName
  a.rel = "noopener"
  a.style.display = "none"
  doc.body?.append(a)
  try {
    a.click()
  } finally {
    a.remove()
    later(() => URL.revokeObjectURL(url))
  }
  return url
}
