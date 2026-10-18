// File intake (prompt-input design §3): files from a paste or a drag, the file input that
// carries attached files into FormData, and the undo-preserving draft write. The accept
// grammar and the limits are pure: components/shared/file-validation.ts.

interface TransferLike {
  readonly files?: ArrayLike<File> | null | undefined
  readonly items?: ArrayLike<{ readonly kind: string; getAsFile(): File | null }> | null
  readonly types?: ArrayLike<string> | null | undefined
  getData?(type: string): string
}

// Spreadsheet cells come with a picture of themselves (vercel/ai-elements#509); WebKit exposes
// some images only in `files`, others only in `items` (lobehub/lobehub#4098).
/**
 * The files of a paste, or `null` when it is a text paste: a clipboard that also carries
 * non-empty `text/plain` pastes the text. Both `files` and `items` are read.
 */
export function filesFromClipboard(data: TransferLike | null | undefined): readonly File[] | null {
  if (!data) return null
  if ((data.getData?.("text/plain") ?? "") !== "") return null
  const files = Array.from(data.files ?? [])
  if (files.length === 0) {
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind !== "file") continue
      const f = item.getAsFile()
      if (f) files.push(f)
    }
  }
  return files.length > 0 ? files : null
}

/** A drag that carries files (text and links are not ours). */
export const dragHasFiles = (data: TransferLike | null | undefined): boolean =>
  Array.from(data?.types ?? []).includes("Files")

/** The files of a drop. */
export const filesFromDrop = (data: TransferLike | null | undefined): readonly File[] =>
  Array.from(data?.files ?? [])

/** The drag left `root` (moving between its children fires dragleave too). */
export const dragLeftRoot = (root: Element, related: EventTarget | null): boolean =>
  !(related instanceof Node && root.contains(related))

/**
 * Puts `files` into a file input, so `new FormData(form)` carries them. Needs the
 * `DataTransfer` constructor; without it the input keeps its own selection (the callbacks
 * still get the files).
 */
export function syncFileInput(input: HTMLInputElement, files: readonly File[]): void {
  const win = input.ownerDocument.defaultView as (Window & typeof globalThis) | null
  if (typeof win?.DataTransfer !== "function") return
  const dt = new win.DataTransfer()
  for (const f of files) dt.items.add(f)
  try {
    input.files = dt.files
  } catch {
    // An engine that refuses the assignment: FormData simply has no files.
  }
}

/**
 * Replaces a text control's whole value as an edit the user can undo: with the control
 * focused, an `insertText` (or `delete`) editing command over the selected text; otherwise
 * the native value setter. Either way one `input` event follows. Returns false when it
 * could not write (no command support and no setter).
 */
export function replaceText(el: HTMLTextAreaElement | HTMLInputElement, text: string): boolean {
  if (el.value === text) return true
  const doc = el.ownerDocument
  if (doc.activeElement === el && doc.queryCommandSupported?.("insertText") === true) {
    el.select()
    // execCommand is deprecated but is the only edit that joins the undo stack.
    const done =
      text === "" ? doc.execCommand("delete", false) : doc.execCommand("insertText", false, text)
    if (done && el.value === text) return true
  }
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set
  if (!setter) return false
  setter.call(el, text)
  el.dispatchEvent(new Event("input", { bubbles: true }))
  return true
}
