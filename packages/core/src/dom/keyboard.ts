// Native KeyboardEvent → KeyDescription (with `composing`), hotkey matching and the shared
// typeahead timing. The logical mapping itself is pure: a11y/keys.ts.

import type { KeyDescription } from "../a11y/keys"
import type { PlatformFlags, PlatformInfo, Scheduler, TimerHandle } from "../env/capabilities"
import { quirkActive } from "./quirks"

interface NativeKey {
  readonly key: string
  readonly code: string
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly repeat: boolean
  readonly isComposing?: boolean
  readonly keyCode?: number
  readonly target: EventTarget | null
  readonly timeStamp: number
}

/** Safari fires the committing Enter right after compositionend, with isComposing false. */
const COMMIT_WINDOW_MS = 100
const lastCompositionEnd = new WeakMap<Document, { target: EventTarget | null; time: number }>()
const tracked = new WeakSet<Document>()

/** Tracks compositionend per document (installed once; needed for the Safari quirk). */
export function trackComposition(doc: Document): void {
  if (tracked.has(doc)) return
  tracked.add(doc)
  doc.addEventListener(
    "compositionend",
    (e) => lastCompositionEnd.set(doc, { target: e.target, time: e.timeStamp }),
    true,
  )
}

/** Describes a native key event; `composing` covers isComposing, keyCode 229 and Safari. */
export function describeKey(e: NativeKey, env: PlatformInfo): KeyDescription {
  let composing = e.isComposing === true || e.keyCode === 229
  const doc = (e.target as Node | null)?.ownerDocument
  // Callers that cannot install it ahead of time get it from their first key on.
  if (doc && quirkActive("safari-ime-commit-enter", env)) trackComposition(doc)
  if (!composing && e.key === "Enter" && doc && quirkActive("safari-ime-commit-enter", env)) {
    const end = lastCompositionEnd.get(doc)
    if (end && end.target === e.target && e.timeStamp - end.time <= COMMIT_WINDOW_MS) {
      composing = true
      // Only the first Enter after the composition is its commit.
      lastCompositionEnd.delete(doc)
    }
  }
  return {
    key: e.key,
    code: e.code,
    shift: e.shiftKey,
    alt: e.altKey,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    repeat: e.repeat,
    composing,
  }
}

// --- Hotkeys ---

export interface Hotkey {
  readonly key: string
  readonly shift: boolean
  readonly alt: boolean
  readonly ctrl: boolean
  readonly meta: boolean
  /** Meta on Apple platforms, Control elsewhere. */
  readonly mod: boolean
}

/** Parses "mod+Shift+K", "Control+Alt+T", "/" … (modifier names are case-insensitive). */
export function parseHotkey(spec: string): Hotkey {
  const parts = spec.split("+")
  const key = parts.pop() ?? ""
  const mods = new Set(parts.map((p) => p.toLowerCase()))
  return {
    key,
    shift: mods.has("shift"),
    alt: mods.has("alt") || mods.has("option"),
    ctrl: mods.has("control") || mods.has("ctrl"),
    meta: mods.has("meta") || mods.has("cmd"),
    mod: mods.has("mod"),
  }
}

const codeFor = (key: string) =>
  /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : undefined

/**
 * Matches on `key` for printable characters, falling back to `code` when Alt (Option)
 * changed the character (macOS Control+Alt+T reports key "†", code "KeyT").
 */
export function matchHotkey(h: Hotkey, k: KeyDescription, platform: PlatformFlags): boolean {
  if (k.composing) return false
  // platform-convention: "mod" is ⌘ on Apple, Control elsewhere
  const ctrl = h.ctrl || (h.mod && !platform.apple)
  // platform-convention: "mod" is ⌘ on Apple, Control elsewhere
  const meta = h.meta || (h.mod && platform.apple)
  if (k.ctrl !== ctrl || k.meta !== meta || k.alt !== h.alt) return false
  // Shift is implied by the character for printable keys ("?" needs Shift).
  if (h.key.length > 1 && k.shift !== h.shift) return false
  if (h.key.length === 1 && h.shift && !k.shift) return false
  if (k.key.toLowerCase() === h.key.toLowerCase()) return true
  return k.alt && codeFor(h.key) === k.code
}

/**
 * Registers a hotkey on `scope`: a component's root (active only while focus is inside
 * it — the keydown bubbles from the focused element) or the window for a global shortcut.
 */
export function registerHotkey(
  scope: EventTarget,
  spec: string,
  handler: (e: KeyboardEvent) => void,
  env: PlatformInfo,
): () => void {
  const hotkey = parseHotkey(spec)
  // Installed now: the compositionend before the first committing Enter must be seen.
  const doc = "document" in scope ? (scope as Window).document : (scope as Node).ownerDocument
  if (doc && quirkActive("safari-ime-commit-enter", env)) trackComposition(doc)
  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent
    if (matchHotkey(hotkey, describeKey(ke, env), env.platform)) handler(ke)
  }
  scope.addEventListener("keydown", onKeyDown)
  return () => scope.removeEventListener("keydown", onKeyDown)
}

// --- Typeahead timing (the matcher belongs to the collections change) ---

/** 350 ms is too short for screen-reader and motor-impaired users; React Aria and Radix use 1000. */
export const DEFAULT_TYPEAHEAD_TIMEOUT = 1000

/** A key that types into the search: one printable character, not composing, no Ctrl/Meta/Alt. */
export const isTypeaheadKey = (k: KeyDescription) =>
  !k.composing && !k.ctrl && !k.meta && !k.alt && [...k.key].length === 1

/** The typeahead search string; resets after `timeout` ms without a printable key. */
export function typeaheadBuffer(scheduler: Scheduler, timeout = DEFAULT_TYPEAHEAD_TIMEOUT) {
  let search = ""
  let timer: TimerHandle | null = null
  return {
    /** Adds a key (ignored unless it is a typeahead key); returns the search string. */
    push(k: KeyDescription): string {
      if (!isTypeaheadKey(k)) return search
      if (timer !== null) scheduler.clearTimeout(timer)
      search += k.key
      timer = scheduler.setTimeout(() => {
        search = ""
        timer = null
      }, timeout)
      return search
    },
    get search() {
      return search
    },
  }
}
