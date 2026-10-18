// File intake (prompt-input design §3): the `<input accept>` grammar, files from a paste or a
// drag, and the file input that carries attached files into FormData. Framework-free; File
// Upload reuses it.

/** Why a file was not attached. */
export type FileRejectionReason = "ACCEPT" | "MAX_FILES" | "MAX_SIZE"

export interface FileRejection {
  readonly file: File
  readonly reason: FileRejectionReason
}

/**
 * Whether `file` matches an `accept` list, with the native `<input accept>` grammar: MIME
 * types, `type/*` wildcards and `.ext` extensions, comma-separated, case-insensitive. An
 * empty or missing list accepts everything (vercel/ai-elements#501: extensions too).
 */
export function matchesAccept(
  file: { readonly name: string; readonly type: string },
  accept: string | undefined,
): boolean {
  const entries = (accept ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (entries.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return entries.some((entry) => {
    if (entry.startsWith(".")) return name.endsWith(entry)
    if (entry.endsWith("/*")) return type.startsWith(entry.slice(0, -1))
    return type === entry
  })
}

export interface FileLimits {
  readonly accept?: string | undefined
  readonly maxFiles?: number | undefined
  readonly maxFileSize?: number | undefined
  /** Files already attached (counted against `maxFiles`). */
  readonly current: number
}

/** Splits one gesture's files into accepted and rejected (every rejection reported). */
export function validateFiles(
  files: readonly File[],
  limits: FileLimits,
): { readonly accepted: readonly File[]; readonly rejected: readonly FileRejection[] } {
  const accepted: File[] = []
  const rejected: FileRejection[] = []
  for (const file of files) {
    if (!matchesAccept(file, limits.accept)) rejected.push({ file, reason: "ACCEPT" })
    else if (limits.maxFileSize !== undefined && file.size > limits.maxFileSize)
      rejected.push({ file, reason: "MAX_SIZE" })
    else if (limits.maxFiles !== undefined && limits.current + accepted.length >= limits.maxFiles)
      rejected.push({ file, reason: "MAX_FILES" })
    else accepted.push(file)
  }
  return { accepted, rejected }
}

interface TransferLike {
  readonly files?: ArrayLike<File> | null | undefined
  readonly items?: ArrayLike<{ readonly kind: string; getAsFile(): File | null }> | null
  readonly types?: ArrayLike<string> | null | undefined
  getData?(type: string): string
}

/**
 * The files of a paste, or `null` when it is a text paste: a clipboard that also carries
 * non-empty `text/plain` (spreadsheet cells come with a picture of themselves,
 * vercel/ai-elements#509) pastes the text. WebKit exposes some images only in `files`,
 * others only in `items` (lobehub#4098): both are read.
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
