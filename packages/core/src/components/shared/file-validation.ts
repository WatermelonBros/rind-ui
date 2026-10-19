// File validation (prompt-input design §3, add-file-upload design §4): the `<input accept>`
// grammar and the limits, pure (no DOM), so a machine can run it. Prompt Input and File
// Upload share it; Prompt Input's reasons are a subset.

/** Why a file was not taken. */
export type FileRejectionReason =
  | "ACCEPT"
  | "MAX_FILES"
  | "MAX_SIZE"
  | "MIN_SIZE"
  | "DUPLICATE"
  | "DIRECTORY"
  | "CUSTOM"

/** What a file is to the validation: a `File`, or a record from another source (a path). */
export interface FileLike {
  readonly name: string
  readonly type: string
  readonly size: number
}

/** A refused file and why (`code` with `CUSTOM`). */
export interface FileRejection<F extends FileLike = File> {
  readonly file: F
  readonly reason: FileRejectionReason
  readonly code?: string | undefined
}

// ponytail: a fixed short list for files whose `type` is empty (zag#2571); consumers list
// extensions in `accept` for anything else.
const EXTENSION_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  zip: "application/zip",
}

/** The file's MIME type, else its extension's (lowercase; "" when unknown). */
function typeOf(file: { readonly name: string; readonly type: string }): string {
  if (file.type) return file.type.toLowerCase()
  const dot = file.name.lastIndexOf(".")
  return dot < 0 ? "" : (EXTENSION_TYPES[file.name.slice(dot + 1).toLowerCase()] ?? "")
}

/** The `accept` entries, parsed once per gesture (ZG#3330). */
export function parseAccept(accept: string | readonly string[] | undefined): readonly string[] {
  const list = typeof accept === "string" ? accept.split(",") : (accept ?? [])
  return list.map((s) => s.trim().toLowerCase()).filter(Boolean)
}

// Extensions too, not only MIME types (vercel/ai-elements#501).
/**
 * Whether `file` matches an `accept` list, with the native `<input accept>` grammar: MIME
 * types, `type/*` wildcards and `.ext` extensions, comma-separated or an array,
 * case-insensitive. An empty type falls back to the extension's. An empty list accepts all.
 */
export function matchesAccept(
  file: { readonly name: string; readonly type: string },
  accept: string | readonly string[] | undefined,
): boolean {
  return matchesEntries(file, parseAccept(accept))
}

function matchesEntries(
  file: { readonly name: string; readonly type: string },
  entries: readonly string[],
): boolean {
  if (entries.length === 0) return true
  const name = file.name.toLowerCase()
  const type = typeOf(file)
  return entries.some((entry) => {
    if (entry.startsWith(".")) return name.endsWith(entry)
    if (entry.endsWith("/*")) return type.startsWith(entry.slice(0, -1))
    return type === entry
  })
}

/** The limits a gesture's files are checked against. */
export interface FileLimits<F extends FileLike = File> {
  /** The `<input accept>` list. */
  readonly accept?: string | readonly string[] | undefined
  /** The most files held at once. */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes. */
  readonly maxFileSize?: number | undefined
  /** The smallest file, in bytes. */
  readonly minFileSize?: number | undefined
  /** Files already held (counted against `maxFiles`; duplicates checked against them). */
  readonly current: number | readonly F[]
  /** Check duplicates (name, size and type) against the held files and the gesture. */
  readonly rejectDuplicates?: boolean | undefined
  /** A custom check: a code rejects the file (`CUSTOM`). */
  readonly validate?:
    | ((file: F, context: { readonly files: readonly F[] }) => string | null)
    | undefined
  /** Folders refused before any other check (`DIRECTORY`). */
  readonly isDirectory?: ((file: F) => boolean) | undefined
  /**
   * With `maxFiles` 1 the first accepted file replaces the held one (File Upload); otherwise
   * accepted files beyond the room left are `MAX_FILES`.
   */
  readonly replaceSingle?: boolean | undefined
}

const key = (f: FileLike) => `${f.name}\u0000${f.size}\u0000${f.type}`

/**
 * Splits one gesture's files into accepted and rejected. Each file gets the first failing
 * check in a fixed order (directory, accept, min size, max size, duplicate, custom); the count
 * runs last, so only the surplus is refused.
 */
export function validateFiles<F extends FileLike = File>(
  files: readonly F[],
  limits: FileLimits<F>,
): { readonly accepted: readonly F[]; readonly rejected: readonly FileRejection<F>[] } {
  const entries = parseAccept(limits.accept)
  const held = typeof limits.current === "number" ? [] : limits.current
  const heldCount = typeof limits.current === "number" ? limits.current : limits.current.length
  const seen = new Set(limits.rejectDuplicates ? held.map(key) : [])
  const valid: F[] = []
  const rejected: FileRejection<F>[] = []
  for (const file of files) {
    if (limits.isDirectory?.(file)) rejected.push({ file, reason: "DIRECTORY" })
    else if (!matchesEntries(file, entries)) rejected.push({ file, reason: "ACCEPT" })
    else if (limits.minFileSize !== undefined && file.size < limits.minFileSize)
      rejected.push({ file, reason: "MIN_SIZE" })
    else if (limits.maxFileSize !== undefined && file.size > limits.maxFileSize)
      rejected.push({ file, reason: "MAX_SIZE" })
    else if (limits.rejectDuplicates && seen.has(key(file)))
      rejected.push({ file, reason: "DUPLICATE" })
    else {
      const code = limits.validate?.(file, { files: held })
      if (code !== null && code !== undefined) rejected.push({ file, reason: "CUSTOM", code })
      else {
        if (limits.rejectDuplicates) seen.add(key(file))
        valid.push(file)
      }
    }
  }
  const max = limits.maxFiles
  if (max === undefined) return { accepted: valid, rejected }
  const room = max === 1 && limits.replaceSingle ? 1 : Math.max(0, max - heldCount)
  for (const file of valid.slice(room)) rejected.push({ file, reason: "MAX_FILES" })
  return { accepted: valid.slice(0, room), rejected }
}
