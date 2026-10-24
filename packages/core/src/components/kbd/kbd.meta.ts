// Kbd's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in kbd.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"kbd"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const kbdMeta = {
  scope: "kbd",
  name: "Kbd",
  stateless: true,
  parts: [
    {
      name: "Kbd.Root",
      part: "root",
      element: "kbd",
      description:
        '`dir="ltr"`; renders `keys` for the platform (a `kbd` per key, `data-part="key"`, and separators, `data-part="separator"`), or its children as written.',
    },
  ],
  props: {
    keys: {
      type: "string | string[]",
      description:
        '"mod+shift+p" (a chord), "g i" (a sequence), or one chord\'s key names; `mod` is ⌘ on Apple, Ctrl elsewhere.',
    },
    platform: {
      type: '"apple" | "other"',
      description: 'Overrides the environment\'s platform (the server renders "other").',
    },
    messages: {
      type: "Partial<KbdMessages>",
      description:
        'Spoken key names (`keyName`) and the words between keys (`chord`, "plus") and chords (`sequence`, "then").',
    },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-platform": '"apple" or "other".' },
    key: { ...base("key"), "data-key": 'The canonical key name ("meta", "ctrl", "k").' },
    separator: { ...base("separator"), "data-kind": '"chord" or "sequence".' },
  },
  keyboard: [],
  contract: { actions: {}, queries: ["keys", "platform"], traits: [] },
} as const satisfies ComponentMeta
