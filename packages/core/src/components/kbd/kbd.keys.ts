// Kbd's key model (add-kbd design §1): parse a shortcut, resolve each key for the platform
// (Apple glyphs, words elsewhere; `mod` is Command on Apple and Control elsewhere), and the
// `aria-keyshortcuts` value for the control the shortcut activates (React Spectrum #6478).

/** A shortcut: chords pressed one after the other; each chord's keys pressed together. */
export type KbdChords = readonly (readonly string[])[]

/** What `keys` accepts: "mod+shift+p", "g i" (a sequence), or one chord's key names. */
export type KbdKeys = string | readonly string[]

/** One key as shown and spoken on a platform. */
export interface ResolvedKey {
  /** Canonical name (`data-key`): "meta", "ctrl", "shift", "k", … */
  readonly id: string
  /** What is shown. */
  readonly glyph: string
  /** The spoken name, from `KbdMessages.keyName` ("Command"); the glyph when it reads well. */
  readonly label: string
}

const ALIASES: Readonly<Record<string, string>> = {
  cmd: "meta",
  command: "meta",
  win: "meta",
  super: "meta",
  control: "ctrl",
  option: "alt",
  opt: "alt",
  return: "enter",
  esc: "escape",
  del: "delete",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
}

/** Glyphs on Apple platforms; every other key reads as its text. */
const APPLE: Readonly<Record<string, string>> = {
  meta: "⌘",
  alt: "⌥",
  shift: "⇧",
  ctrl: "⌃",
  enter: "↩",
  escape: "⎋",
  tab: "⇥",
  backspace: "⌫",
  delete: "⌦",
  capslock: "⇪",
}

/** Text elsewhere. */
const OTHER: Readonly<Record<string, string>> = {
  meta: "Win",
  alt: "Alt",
  shift: "Shift",
  ctrl: "Ctrl",
  enter: "Enter",
  escape: "Esc",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Del",
  capslock: "Caps Lock",
}

/** Everywhere. */
const ARROWS: Readonly<Record<string, string>> = { up: "↑", down: "↓", left: "←", right: "→" }

const NAMED = new Set([
  ...Object.keys(OTHER),
  ...Object.keys(ARROWS),
  "space",
  "home",
  "end",
  "pageup",
  "pagedown",
  "fn",
])

/** A key name in canonical form; `mod` stays `mod` until the platform resolves it. */
function canonical(key: string): string {
  const lower = key.trim().toLowerCase()
  return ALIASES[lower] ?? lower
}

/** Parses a shortcut into chords. A string splits on spaces (sequence), then on "+" (chord). */
export function parseKeys(keys: KbdKeys): KbdChords {
  if (typeof keys !== "string") return [keys.map(canonical)]
  return keys
    .trim()
    .split(/\s+/)
    .filter((chord) => chord !== "")
    .map((chord) =>
      // "+" alone, or a trailing "+" ("ctrl++"), is the plus key.
      chord === "+"
        ? ["+"]
        : chord.endsWith("++")
          ? [...chord.slice(0, -2).split("+").map(canonical), "+"]
          : chord.split("+").map(canonical),
    )
}

const TEXT: Readonly<Record<string, string>> = {
  space: "Space",
  home: "Home",
  end: "End",
  pageup: "Page Up",
  pagedown: "Page Down",
  fn: "Fn",
}

/** One key for the platform; `name` gives spoken names for the keys that have one. */
export function resolveKey(
  key: string,
  apple: boolean,
  name: (id: string, apple: boolean) => string,
): ResolvedKey {
  const k = canonical(key)
  const id = k === "mod" ? (apple ? "meta" : "ctrl") : k
  const glyph =
    ARROWS[id] ??
    (apple ? APPLE[id] : undefined) ??
    OTHER[id] ??
    TEXT[id] ??
    (key.trim().length === 1 ? key.trim().toUpperCase() : key.trim())
  const spoken = NAMED.has(id) ? name(id, apple) : ""
  return { id, glyph, label: spoken || glyph }
}

const ARIA: Readonly<Record<string, string>> = {
  meta: "Meta",
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  space: "Space",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  capslock: "CapsLock",
}

/**
 * The `aria-keyshortcuts` value for a chord ("Meta+Shift+P", "Control+K"); `undefined` for a
 * sequence, which the attribute cannot express.
 */
export function keyShortcuts(keys: KbdKeys, apple: boolean): string | undefined {
  const chords = parseKeys(keys)
  const [chord] = chords
  if (chords.length !== 1 || !chord) return undefined
  return chord
    .map((key) => {
      const id = key === "mod" ? (apple ? "meta" : "ctrl") : key
      return ARIA[id] ?? (id.length === 1 ? id.toUpperCase() : id)
    })
    .join("+")
}
