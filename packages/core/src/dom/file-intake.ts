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

/** A drag that carries files (text and links are not ours): `types` or an item of kind file (rd#1409). */
export const dragHasFiles = (data: TransferLike | null | undefined): boolean =>
  Array.from(data?.types ?? []).includes("Files") ||
  Array.from(data?.items ?? []).some((i) => i.kind === "file")

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

// ── File Upload (add-file-upload design §3): drag presence, folders, the DOM drop source ──

/**
 * Tracks a file drag over `zone` by the set of entered elements, never `relatedTarget` (null
 * in WebKit on child boundaries: WebKit 66547). `enter` once when the first element is
 * entered, `leave` when the set empties, on a drop, or when the drag ends on the document.
 * `dragover` prevents the default (so a drop is delivered) with `dropEffect` copy, or none
 * while `refuse()` says so. Returns the disconnect.
 */
export function dragPresence(
  zone: Element,
  handlers: {
    readonly enter: () => void
    readonly leave: () => void
    readonly drop: (data: DataTransfer) => void
    readonly refuse?: () => boolean
  },
): () => void {
  const entered = new Set<EventTarget>()
  const doc = zone.ownerDocument
  let inside = false
  const end = () => {
    entered.clear()
    if (inside) {
      inside = false
      handlers.leave()
    }
  }
  const onEnter = (e: Event) => {
    const d = (e as DragEvent).dataTransfer
    if (!dragHasFiles(d)) return
    e.preventDefault()
    if (e.target) entered.add(e.target)
    if (!inside && !handlers.refuse?.()) {
      inside = true
      handlers.enter()
    }
  }
  const onOver = (e: Event) => {
    const d = (e as DragEvent).dataTransfer
    if (!dragHasFiles(d)) return
    e.preventDefault()
    if (d) d.dropEffect = handlers.refuse?.() ? "none" : "copy"
  }
  const onLeave = (e: Event) => {
    if (e.target) entered.delete(e.target)
    // Elements removed meanwhile never fire their own dragleave.
    for (const t of entered) if (t instanceof Node && !t.isConnected) entered.delete(t)
    if (entered.size === 0) end()
  }
  const onDrop = (e: Event) => {
    const d = (e as DragEvent).dataTransfer
    if (!dragHasFiles(d)) return
    e.preventDefault()
    end()
    if (d && !handlers.refuse?.()) handlers.drop(d)
  }
  zone.addEventListener("dragenter", onEnter)
  zone.addEventListener("dragover", onOver)
  zone.addEventListener("dragleave", onLeave)
  zone.addEventListener("drop", onDrop)
  doc.addEventListener("dragend", end, true)
  doc.addEventListener("drop", end, true)
  return () => {
    zone.removeEventListener("dragenter", onEnter)
    zone.removeEventListener("dragover", onOver)
    zone.removeEventListener("dragleave", onLeave)
    zone.removeEventListener("drop", onDrop)
    doc.removeEventListener("dragend", end, true)
    doc.removeEventListener("drop", end, true)
  }
}

/** A folder entry from `webkitGetAsEntry()` (the parts this module uses). */
interface EntryLike {
  readonly isFile: boolean
  readonly isDirectory: boolean
  readonly name: string
  readonly fullPath?: string
  file?(ok: (f: File) => void, fail: (e: unknown) => void): void
  createReader?(): { readEntries(ok: (e: EntryLike[]) => void, fail: (e: unknown) => void): void }
}

const paths = new WeakMap<object, string>()

/** A file's relative path in its dropped or chosen folder, else its name. */
export function filePath(file: { readonly name: string }): string {
  return (
    paths.get(file) ||
    (file as { readonly webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  )
}

/** A folder that was dropped: a placeholder the validation refuses as `DIRECTORY`. */
export interface DroppedFolder {
  readonly name: string
  readonly type: ""
  readonly size: 0
  readonly directory: true
}
export const isDroppedFolder = (f: unknown): f is DroppedFolder =>
  typeof f === "object" && f !== null && (f as DroppedFolder).directory === true

const readAll = (reader: NonNullable<ReturnType<NonNullable<EntryLike["createReader"]>>>) =>
  new Promise<EntryLike[]>((resolve, reject) => {
    const out: EntryLike[] = []
    // A reader returns batches until an empty one (zag#2252: Chrome caps a batch at 100).
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(out)
        else {
          out.push(...batch)
          next()
        }
      }, reject)
    next()
  })

/**
 * The files of a drop. Items are read synchronously (before any await: the data transfer is
 * emptied after the event). With `directory`, folders are traversed; without, each folder is a
 * `DroppedFolder`. An entry that cannot be read is in `refused`; the rest of the drop is kept.
 */
export async function filesFromDataTransfer(
  data: TransferLike & { readonly items?: ArrayLike<unknown> | null },
  options: { readonly directory?: boolean | undefined } = {},
): Promise<{ readonly files: (File | DroppedFolder)[]; readonly refused: File[] }> {
  const items = Array.from(
    (data.items ?? []) as ArrayLike<{
      readonly kind: string
      getAsFile(): File | null
      webkitGetAsEntry?(): EntryLike | null
    }>,
  )
  const entries = items
    .filter((i) => i.kind === "file")
    .map((i) => ({
      entry: i.webkitGetAsEntry?.() ?? null,
      file: i.getAsFile(),
    }))
  if (entries.length === 0) return { files: Array.from(data.files ?? []), refused: [] }
  const files: (File | DroppedFolder)[] = []
  const refused: File[] = []
  const walk = async (entry: EntryLike, prefix: string): Promise<void> => {
    if (entry.isFile && entry.file) {
      try {
        const f = await new Promise<File>((ok, fail) => entry.file?.(ok, fail))
        paths.set(f, `${prefix}${f.name}`)
        files.push(f)
      } catch {
        refused.push(new File([], entry.name))
      }
    } else if (entry.isDirectory && entry.createReader) {
      try {
        for (const child of await readAll(entry.createReader())) {
          await walk(child, `${prefix}${entry.name}/`)
        }
      } catch {
        refused.push(new File([], entry.name))
      }
    }
  }
  for (const { entry, file } of entries) {
    if (entry?.isDirectory) {
      if (options.directory) await walk(entry, "")
      else files.push({ name: entry.name, type: "", size: 0, directory: true })
    } else if (file) files.push(file)
  }
  return { files, refused }
}

/** What a drop source calls (File Upload's Dropzone implements it). */
export interface DropSink<F> {
  enter(): void
  leave(): void
  /** `refused`: entries that could not be read (rejected as CUSTOM "unreadable"). */
  drop(files: readonly F[], refused?: readonly F[]): void
}

/** Connects a drop zone to a sink; returns the disconnect. A Tauri source hit-tests `zone`. */
export type DropSource<F> = (zone: Element, sink: DropSink<F>) => () => void

/** The DOM's drag and drop, over `dragPresence` and `filesFromDataTransfer`. */
export function domDropSource(
  options: { readonly directory?: () => boolean; readonly refuse?: () => boolean } = {},
): DropSource<File | DroppedFolder> {
  return (zone, sink) =>
    dragPresence(zone, {
      enter: () => sink.enter(),
      leave: () => sink.leave(),
      ...(options.refuse ? { refuse: options.refuse } : {}),
      drop: (data) => {
        void filesFromDataTransfer(data, { directory: options.directory?.() ?? false }).then(
          ({ files, refused }) => {
            if (files.length > 0 || refused.length > 0) sink.drop(files, refused)
          },
        )
      },
    })
}
