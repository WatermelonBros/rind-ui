// Suggestions' API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in suggestions.test.ts. (`.pending` until the React parts land.)

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"suggestions"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"ready", "loading" or "disabled".',
})

export const suggestionsMeta = {
  scope: "suggestions",
  name: "Suggestions",
  stateless: false,
  parts: [
    {
      name: "Suggestions.Root",
      part: "root",
      element: "div",
      description: '`role="group"`, named ("Suggestions" by default).',
    },
    {
      name: "Suggestions.Item",
      part: "item",
      element: "button",
      description:
        "One suggestion: a press calls `onSelect`. Disabled but focusable while loading or disabled.",
    },
    { name: "Suggestions.Label", part: "label", element: "span", description: "The main text." },
    {
      name: "Suggestions.Description",
      part: "description",
      element: "span",
      description: "Secondary text, part of the Item's name.",
    },
  ],
  props: {
    onSelect: {
      type: "({ value, index, key }) => void",
      description: "A press: put the value in the prompt, or send it. The component does neither.",
    },
    loading: {
      type: "boolean",
      default: "false",
      description: "The items stay, disabled and focusable; the group is busy.",
    },
    disabled: { type: "boolean", default: "false", description: "No press does anything." },
    announce: {
      type: '"off" | "polite"',
      default: '"off"',
      description: 'Announce a new set ("3 suggestions"); never on mount.',
    },
    focusTarget: {
      type: "() => { focus(): void } | null",
      description: "Where the focus goes after a press that began inside (the prompt).",
    },
    messages: {
      type: "Partial<SuggestionsMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: { type: "string", description: "Default: the provider's locale." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-count": "The number of items." },
    item: {
      ...base("item"),
      "data-key": "The item's key.",
      "data-index": "Its position.",
      "data-disabled": "While it does nothing.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    label: base("label"),
    description: base("description"),
  },
  keyboard: [
    ["Tab", "From item to item (wrap in Toolbar for arrow keys)."],
    ["Enter, Space", "Selects the focused item."],
  ],
  states: {
    ready: "Items can be pressed.",
    loading: "The prompt is busy: items disabled and focusable, the group busy.",
    disabled: "Nothing can be pressed.",
  },
  contract: {
    actions: { pick: ["pointer", "keyboard", "touch", "virtual"] },
    queries: ["items", "count", "isLoading", "isDisabled"],
    traits: [],
  },
} as const satisfies ComponentMeta
