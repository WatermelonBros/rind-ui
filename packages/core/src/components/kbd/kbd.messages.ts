// Kbd's strings: the spoken names of keys shown as glyphs or abbreviations, and the word
// between the chords of a sequence.

export interface KbdMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** A key's spoken name ("Command"); "" keeps the shown text. */
  readonly keyName: (id: string, apple: boolean) => string
  /** Spoken between the keys of a chord ("Control plus K"). */
  readonly chord: string
  /** Between the chords of a sequence ("G then I"). */
  readonly sequence: string
}

const NAMES: Readonly<Record<string, string>> = {
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  capslock: "Caps Lock",
  up: "Up Arrow",
  down: "Down Arrow",
  left: "Left Arrow",
  right: "Right Arrow",
  space: "Space",
  home: "Home",
  end: "End",
  pageup: "Page Up",
  pagedown: "Page Down",
  fn: "Function",
}

export const kbdMessages: KbdMessages = {
  keyName: (id, apple) =>
    id === "meta"
      ? apple
        ? "Command"
        : "Windows"
      : id === "alt" && apple
        ? "Option"
        : (NAMES[id] ?? ""),
  chord: "plus",
  sequence: "then",
}
