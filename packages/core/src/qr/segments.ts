// Segments (design §1, §2): the whole value as one data segment in the most compact mode,
// an ECI (UTF-8) segment before a byte segment of non-ASCII text, bit packing and the
// character-count widths of each version range.

export type QrMode = "numeric" | "alphanumeric" | "byte"

export type QrSegmentInfo =
  | { readonly mode: QrMode; readonly chars: number }
  | { readonly mode: "eci"; readonly assignment: number }

/** A segment ready to pack: its info plus the data bits (count field excluded). */
export interface Segment {
  readonly info: QrSegmentInfo
  readonly bits: readonly number[]
}

const MODE_BITS: Readonly<Record<QrSegmentInfo["mode"], number>> = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
  eci: 0b0111,
}

// Count-field widths for versions 1–9, 10–26, 27–40.
const COUNT_BITS: Readonly<Record<QrMode, readonly [number, number, number]>> = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
}

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

/** UTF-8 with `TextEncoder` semantics: a lone surrogate becomes U+FFFD, nothing throws. */
export function utf8(text: string): Uint8Array {
  const out: number[] = []
  for (const ch of text) {
    let cp = ch.codePointAt(0) ?? 0xfffd
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63))
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63))
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      )
  }
  return Uint8Array.from(out)
}

function push(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
}

function numeric(text: string): Segment {
  const bits: number[] = []
  for (let i = 0; i < text.length; i += 3) {
    const group = text.slice(i, i + 3)
    push(bits, Number.parseInt(group, 10), group.length * 3 + 1)
  }
  return { info: { mode: "numeric", chars: text.length }, bits }
}

function alphanumeric(text: string): Segment {
  const bits: number[] = []
  for (let i = 0; i < text.length; i += 2) {
    const a = ALPHANUMERIC.indexOf(text.charAt(i))
    if (i + 1 < text.length) push(bits, a * 45 + ALPHANUMERIC.indexOf(text.charAt(i + 1)), 11)
    else push(bits, a, 6)
  }
  return { info: { mode: "alphanumeric", chars: text.length }, bits }
}

function bytes(data: Uint8Array): Segment {
  const bits: number[] = []
  for (const b of data) push(bits, b, 8)
  return { info: { mode: "byte", chars: data.length }, bits }
}

/** ECI assignment 26 (UTF-8): one byte, `0xxxxxxx`. */
const eciUtf8: Segment = {
  info: { mode: "eci", assignment: 26 },
  bits: [0, 0, 0, 1, 1, 0, 1, 0],
}

/** The segments of a value: one data segment, preceded by an ECI segment when needed. */
export function makeSegments(input: string | Uint8Array, eci: "auto" | "none"): Segment[] {
  if (typeof input !== "string") return input.length === 0 ? [] : [bytes(input)]
  if (input === "") return []
  if (/^[0-9]*$/.test(input)) return [numeric(input)]
  if ([...input].every((c) => ALPHANUMERIC.includes(c))) return [alphanumeric(input)]
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the ASCII range is the point
  const ascii = /^[\u0000-\u007f]*$/.test(input)
  const segment = bytes(utf8(input))
  return !ascii && eci === "auto" ? [eciUtf8, segment] : [segment]
}

/** Count-field width of a mode at a version (0 for ECI, which has none). */
export function countBits(mode: QrSegmentInfo["mode"], version: number): number {
  if (mode === "eci") return 0
  return COUNT_BITS[mode][version <= 9 ? 0 : version <= 26 ? 1 : 2]
}

/** Total bits of the segments at a version, or `undefined` if a count overflows its field. */
export function totalBits(segments: readonly Segment[], version: number): number | undefined {
  let total = 0
  for (const s of segments) {
    const width = countBits(s.info.mode, version)
    if (s.info.mode !== "eci" && s.info.chars >= 2 ** width) return undefined
    total += 4 + width + s.bits.length
  }
  return total
}

/** The bit stream of the segments (mode, count, data each), without terminator or padding. */
export function packSegments(segments: readonly Segment[], version: number): number[] {
  const bits: number[] = []
  for (const s of segments) {
    push(bits, MODE_BITS[s.info.mode], 4)
    if (s.info.mode !== "eci") push(bits, s.info.chars, countBits(s.info.mode, version))
    for (const b of s.bits) bits.push(b)
  }
  return bits
}
