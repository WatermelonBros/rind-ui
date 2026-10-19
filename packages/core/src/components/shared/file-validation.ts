// File validation (prompt-input design §3): the `<input accept>` grammar and the limits,
// pure (no DOM), so a machine can run it. File Upload reuses it.

/** Why a file was not attached. */
export type FileRejectionReason = "ACCEPT" | "MAX_FILES" | "MAX_SIZE"

/** A refused file and why. */
export interface FileRejection {
  readonly file: File
  readonly reason: FileRejectionReason
}

// Extensions too, not only MIME types (vercel/ai-elements#501).
/**
 * Whether `file` matches an `accept` list, with the native `<input accept>` grammar: MIME
 * types, `type/*` wildcards and `.ext` extensions, comma-separated, case-insensitive. An
 * empty or missing list accepts everything.
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

/** The limits a gesture's files are checked against. */
export interface FileLimits {
  /** The `<input accept>` list. */
  readonly accept?: string | undefined
  /** The most files attached at once. */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes. */
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
