// Pagination's post-mount development check (add-pagination 2.4): two pagination landmarks
// in one document with the same name are indistinguishable in a landmark list.

declare const process: { env: { NODE_ENV?: string } }

/** Development: another pagination landmark in the document has the same name. */
export function warnDuplicateLandmark(root: Element): void {
  if (process.env.NODE_ENV === "production") return
  const name = landmarkName(root)
  const doc = root.ownerDocument
  for (const other of doc.querySelectorAll('[data-scope="pagination"][data-part="root"]')) {
    if (other !== root && landmarkName(other) === name) {
      console.warn(
        `[rind-ui] pagination: two pagination landmarks are named "${name}": give each an aria-label (e.g. "Results pages, top" and "…, bottom")`,
      )
      return
    }
  }
}

/** The landmark's name from its attributes (not a full accname computation). */
function landmarkName(el: Element): string {
  const ids = el.getAttribute("aria-labelledby")
  if (ids) {
    return ids
      .split(/\s+/)
      .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
      .join(" ")
  }
  return el.getAttribute("aria-label") ?? ""
}
