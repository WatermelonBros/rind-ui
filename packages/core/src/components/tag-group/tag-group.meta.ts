// The Tag Group's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in tag-group.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tag-group"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const tagGroupMeta = {
  scope: "tag-group",
  name: "Tag Group",
  stateless: false,
  parts: [
    {
      name: "TagGroup.Root",
      part: "root",
      element: "div",
      description: "Holds the state; wraps the label, description and list.",
    },
    {
      name: "TagGroup.Label",
      part: "label",
      element: "span",
      description: "Names the list (`aria-labelledby`) while rendered.",
    },
    {
      name: "TagGroup.Description",
      part: "description",
      element: "span",
      description: "Describes the list (`aria-describedby`) while rendered.",
    },
    {
      name: "TagGroup.List",
      part: "list",
      element: "div",
      description:
        '`role="grid"` when interactive, `"group"` when interactive and empty, `"list"` when display-only; one Tab stop.',
    },
    {
      name: "TagGroup.Tag",
      part: "item",
      element: "div",
      description:
        '`role="row"` (`"listitem"` when display-only) named by its TagText; renders one `gridcell` (`item-cell`).',
    },
    {
      name: "TagGroup.TagText",
      part: "item-text",
      element: "span",
      description: "The tag's name; an `<a>` (Tab-skipped) when the Tag has `href`.",
    },
    {
      name: "TagGroup.TagRemove",
      part: "item-remove",
      element: "button",
      description: '"Remove <text>", `tabIndex=-1`: removal by press or virtual cursor.',
    },
    {
      name: "TagGroup.Empty",
      part: "empty",
      element: "div",
      description: "Inside the List while it has no tags.",
    },
  ],
  props: {
    onRemove: {
      type: "(keys: string[], { reason }) => void",
      description: "Tags are removable: drop the keys from your data (or keep them).",
    },
    selectionMode: {
      type: '"none" | "single" | "multiple"',
      default: '"none"',
      description: "Selectable tags (filter chips).",
    },
    value: {
      type: "string | null | string[]",
      description: "Controlled selection.",
    },
    defaultValue: {
      type: "string | null | string[]",
      description: "Uncontrolled selection.",
    },
    onValueChange: {
      type: "(value, { reason, key }) => void",
      description: "Every selection change.",
    },
    onAction: {
      type: "(key, { modality, via }) => void",
      description: "Enter, Space or a press on a tag.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No Tab stop, no keys or presses.",
    },
    loop: {
      type: "boolean",
      default: "true",
      description: "Arrow keys wrap around.",
    },
    items: {
      type: "{ key, label, disabled?, href? }[]",
      description: "Data tags (else Tag parts register).",
    },
    messages: {
      type: "Partial<TagGroupMessages>",
      description: "removeLabel, removeHint, removedAnnouncement, removedCountAnnouncement.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-empty": "No tags.",
      "data-disabled": "Disabled.",
    },
    list: {
      ...base("list"),
      "data-orientation": "both (interactive).",
      "data-selection-mode": "single | multiple (selectable only).",
      "data-focus-visible": "The list itself has keyboard focus (empty).",
      "data-disabled": "Disabled.",
      "data-empty": "No tags.",
    },
    item: {
      ...base("item"),
      "data-key": "The tag key.",
      "data-highlighted": "The highlighted (focused) tag.",
      "data-selected": "Selected.",
      "data-disabled": "Disabled.",
      "data-focus-visible": "Keyboard focus.",
      "data-hover": "Mouse or pen over an interactive tag.",
      "data-pressed": "Pressed.",
      "data-removable": "The group has `onRemove`.",
      "data-link": "The tag has `href`.",
    },
  },
  keyboard: [
    ["Arrow keys, Home, End", "Move between tags (Left/Right mirrored in RTL); they loop."],
    ["Delete, Backspace", "Remove the tag, or every selected tag when it is selected."],
    ["Enter, Space", "Follow the link, run the action, toggle the selection, else remove."],
    ["Characters", "Typeahead."],
    ["Escape", "Not handled: the enclosing layer gets it."],
  ],
  states: {
    idle: "Focus is outside the group.",
    focused: "Focus is in the group: keys navigate, activate and remove.",
  },
  contract: {
    actions: {
      highlight: ["pointer", "keyboard", "virtual"],
      choose: ["pointer", "keyboard", "touch", "virtual"],
      toggle: ["pointer", "keyboard", "virtual"],
      chooseRange: ["pointer", "keyboard", "virtual"],
      selectAll: ["keyboard"],
      typeahead: ["keyboard"],
      focusIn: ["keyboard"],
      tabOut: ["keyboard"],
      next: ["keyboard"],
      typeR: ["keyboard"],
      remove: ["pointer", "keyboard", "virtual"],
      removeSelected: ["keyboard"],
      act: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "items",
      "highlighted",
      "selected",
      "disabled",
      "focusedItem",
      "tags",
      "hasFocus",
      "isEmpty",
      "isRemovable",
    ],
    traits: ["composite-roving", "directional"],
  },
} as const satisfies ComponentMeta
