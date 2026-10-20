// Kbd parts (add-kbd design §2): a `<kbd dir="ltr">` holding one `<kbd>` per key. A glyph that
// does not read as its name is aria-hidden next to a visually hidden name, so a screen reader
// says "Command plus Shift plus P", never "place of interest sign" (the reason HeroUI wraps glyphs in
// abbr, whose title most readers skip).

import { type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { type KbdChords, type ResolvedKey, resolveKey } from "./kbd.keys"
import type { KbdMessages } from "./kbd.messages"

export type KbdPart = "root" | "key" | "separator"

export interface KbdConnectInput {
  readonly instance: string
  readonly chords: KbdChords
  readonly apple: boolean
  readonly messages: KbdMessages
}

/** One rendered item: a key, or the separator before the next key or chord. */
export type KbdItem =
  | { readonly type: "key"; readonly key: ResolvedKey }
  | { readonly type: "separator"; readonly kind: "chord" | "sequence" }

export function kbdConnect(input: KbdConnectInput) {
  const part = (name: KbdPart): PartProps => scopeAttrs("kbd", name, input.instance)
  const name = (id: string, apple: boolean) => input.messages.keyName(id, apple)
  const items: KbdItem[] = []
  input.chords.forEach((chord, c) => {
    if (c > 0) items.push({ type: "separator", kind: "sequence" })
    chord.forEach((key, k) => {
      if (k > 0) items.push({ type: "separator", kind: "chord" })
      // platform-convention: Apple writes shortcuts with glyphs (⌘⇧P), others with words (Ctrl+Shift+P)
      items.push({ type: "key", key: resolveKey(key, input.apple, name) })
    })
  })
  const spoken = input.chords
    .map((chord) =>
      chord
        // platform-convention: Apple writes shortcuts with glyphs (⌘⇧P), others with words (Ctrl+Shift+P)
        .map((key) => resolveKey(key, input.apple, name).label)
        .join(` ${input.messages.chord} `),
    )
    .join(` ${input.messages.sequence} `)
  return {
    items,
    /** The whole accessible text ("Command plus Shift plus P", "G then I"). */
    spoken,
    root: (): PartProps => ({
      ...part("root"),
      dir: "ltr",
      // platform-convention: Apple writes shortcuts with glyphs (⌘⇧P), others with words (Ctrl+Shift+P)
      "data-platform": input.apple ? "apple" : "other",
    }),
    // inline-block: the name computation puts a space around a non-inline element, never
    // around inline ones ("ControlplusK"); a hidden text's own spaces are trimmed.
    key: (key: ResolvedKey): PartProps => ({
      ...part("key"),
      "data-key": key.id,
      style: { display: "inline-block" },
    }),
    /** The glyph's own props: hidden when a spoken name stands in for it. */
    glyph: (key: ResolvedKey): PartProps =>
      key.label === key.glyph ? {} : { "aria-hidden": "true" },
    /** The visually hidden name, or null when the glyph reads as its name. */
    keyLabel: (key: ResolvedKey): string | null => (key.label === key.glyph ? null : key.label),
    hiddenProps: (): PartProps => ({ style: visuallyHiddenStyle }),
    separator: (kind: "chord" | "sequence"): PartProps => ({
      ...part("separator"),
      "data-kind": kind,
      style: { display: "inline-block" },
    }),
    /** What a separator shows (aria-hidden): nothing between Apple glyphs, else "+"; "then". */
    separatorText: (kind: "chord" | "sequence") =>
      // platform-convention: Apple writes shortcuts with glyphs (⌘⇧P), others with words (Ctrl+Shift+P)
      kind === "sequence" ? input.messages.sequence : input.apple ? "" : "+",
    /** What it says (visually hidden): "plus" between keys, "then" between chords. */
    separatorSpoken: (kind: "chord" | "sequence") =>
      kind === "sequence" ? input.messages.sequence : input.messages.chord,
  }
}
