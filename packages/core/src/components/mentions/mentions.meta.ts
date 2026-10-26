// Mentions' API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against
// the code in mentions.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"mentions"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-state": '"open" or "closed": the list.',
  "data-trigger": "The trigger of the open list.",
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
})

export const mentionsMeta = {
  scope: "mentions",
  name: "Mentions",
  stateless: false,
  parts: [
    {
      name: "Mentions.Root",
      part: "root",
      element: "div",
      description: "Holds the text, the mentions and the list.",
    },
    {
      name: "Mentions.Textarea",
      part: "textarea",
      element: "textarea",
      description: "The draft: a textbox, a combobox while the list is open.",
    },
    {
      name: "Mentions.Description",
      part: "description",
      element: "p",
      description: 'Names the triggers ("Type @ to …").',
    },
    {
      name: "Mentions.Highlighter",
      part: "highlighter",
      element: "div",
      description:
        "Behind the textarea, the same metrics: paints the mentions (hidden from assistive technology).",
    },
    {
      name: "Mentions.Mention",
      part: "mention",
      element: "mark",
      description: "A mention's label in the Highlighter.",
    },
    {
      name: "Mentions.Positioner",
      part: "positioner",
      element: "div",
      description: "Placed at the trigger.",
    },
    { name: "Mentions.Popup", part: "popup", element: "div", description: "The list's surface." },
    {
      name: "Mentions.List",
      part: "list",
      element: "div",
      description: "The listbox of suggestions.",
    },
    { name: "Mentions.Group", part: "group", element: "div", description: "A group of options." },
    {
      name: "Mentions.GroupLabel",
      part: "group-label",
      element: "div",
      description: "Names a group.",
    },
    { name: "Mentions.Item", part: "item", element: "div", description: "An option (`item`)." },
    {
      name: "Mentions.ItemText",
      part: "item-text",
      element: "span",
      description: "The option's text.",
    },
    {
      name: "Mentions.Empty",
      part: "empty",
      element: "div",
      description: "Shown when nothing matches.",
    },
    {
      name: "Mentions.Loading",
      part: "loading",
      element: "div",
      description: "Shown while results load.",
    },
  ],
  props: {
    value: { type: "string", description: "Controlled text." },
    defaultValue: { type: "string", default: '""', description: "Uncontrolled text." },
    onValueChange: { type: "(value, details) => void", description: "Every change of the text." },
    mentions: {
      type: "MentionRange[]",
      description: "Controlled mentions: `{ id, trigger, start, end }`.",
    },
    defaultMentions: {
      type: "MentionRange[]",
      default: "[]",
      description: "Uncontrolled mentions.",
    },
    onMentionsChange: {
      type: "(mentions, details) => void",
      description: "Mentions added, moved or removed.",
    },
    triggers: {
      type: "MentionTrigger[]",
      description:
        '`{ char, id?, behavior?: "insert" | "action", startOfInput?, allowSpaces?, appendSpace? }`.',
    },
    items: { type: "Collection", description: "The options for the current query." },
    onQueryChange: {
      type: "(query | null) => void",
      description: "The trigger and query at the caret; null when it closes.",
    },
    onSelect: {
      type: "({ trigger, key, text }) => void",
      description: 'An "action" trigger\'s choice.',
    },
    formatLabel: {
      type: "(item, trigger) => string",
      description: "The inserted label (default: the trigger char and the text).",
    },
    selectOnTab: {
      type: "boolean",
      default: "true",
      description: "Tab inserts the highlighted option.",
    },
    loading: { type: '"idle" | "loading" | "loading-more"', description: "Results are loading." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "No editing; the list never opens.",
    },
    disabled: { type: "boolean", default: "false", description: "Not editable or submitted." },
    messages: { type: "Partial<MentionsMessages>", description: "Overrides the strings." },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-composing": "An IME composition is in progress." },
    textarea: { ...base("textarea"), "data-composing": "An IME composition is in progress." },
    highlighter: base("highlighter"),
    mention: { ...base("mention"), "data-id": "The mention's id." },
  },
  keyboard: [
    ["ArrowDown, ArrowUp", "While the list is open: the next or previous option."],
    ["Enter, Tab", "Insert the highlighted option."],
    ["Escape", "Close the list; it stays closed while typing on in the same query."],
    ["Backspace", "At a mention's end: remove the whole mention."],
  ],
  states: { closed: "No trigger at the caret.", open: "The list of the trigger at the caret." },
  contract: {
    actions: {
      type: ["keyboard", "virtual"],
      choose: ["pointer", "keyboard", "touch", "virtual"],
      pressEscape: ["keyboard", "virtual"],
      backspace: ["keyboard", "virtual"],
    },
    queries: ["isOpen", "trigger", "options", "value", "mentions"],
    traits: [],
  },
} as const satisfies ComponentMeta
