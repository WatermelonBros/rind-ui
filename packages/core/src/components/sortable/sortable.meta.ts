// Sortable's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in sortable.connect.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"sortable"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
  "data-orientation": '"vertical" or "horizontal".',
})

export const sortableMeta = {
  scope: "sortable",
  name: "Sortable",
  stateless: false,
  parts: [
    {
      name: "Sortable.Root",
      part: "root",
      element: "ul",
      description:
        "Holds the items; takes the ordered `items` keys and `onReorder`. Wraps any list markup.",
    },
    {
      name: "Sortable.Item",
      part: "item",
      element: "li",
      description:
        "One item; takes `value`, `label`, `disabled`. Moves in the DOM as the order changes.",
    },
    {
      name: "Sortable.Handle",
      part: "handle",
      element: "button",
      description:
        '"Reorder Apple": Space picks up, arrows move, Space drops, Escape cancels, Alt+arrow moves one place; drag it with a pointer.',
    },
    {
      name: "Sortable.Indicator",
      part: "indicator",
      element: "div",
      description: "`aria-hidden` drop line during a pointer drag (`--rind-sortable-indicator`).",
    },
    {
      name: "Sortable.MoveButton",
      part: "move-button",
      element: "button",
      description: '`direction` "up" or "down": the single-pointer alternative to dragging.',
    },
  ],
  props: {
    items: { type: "string[]", description: "The keys in their current order (controlled)." },
    onReorder: {
      type: "(keys, details) => void",
      description:
        '`details`: `{ key, from, to, reason }`, reason "keyboard", "pointer", "quick" or "cancel".',
    },
    orientation: {
      type: '"vertical" | "horizontal"',
      default: '"vertical"',
      description: "Which arrows move the items, and the drag axis.",
    },
    handle: {
      type: "boolean",
      default: "true",
      description: "Pointer drags start from the Handle; `false`: from anywhere on the item.",
    },
    "Item.value": { type: "string", description: "The item's key (one of `items`)." },
    "Item.label": {
      type: "string",
      description: "The spoken label (default: the item's text).",
    },
    "Item.disabled": { type: "boolean", description: "Cannot be moved (others can pass it)." },
    "MoveButton.direction": { type: '"up" | "down"', description: "Which way it moves its item." },
    messages: {
      type: "Partial<SortableMessages>",
      description: "Overrides the handle name, instructions, move buttons and announcements.",
    },
    render: {
      type: "RenderProp",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-state": '"idle", "moving" or "dragging".' },
    item: {
      ...base("item"),
      "data-value": "The item's key.",
      "data-index": "Its index in the current order.",
      "data-active": "Picked up or dragged.",
      "data-dragging": "Dragged by a pointer.",
      "data-disabled": "Cannot be moved.",
    },
    handle: {
      ...base("handle"),
      "data-active": "Its item is picked up or dragged.",
      "data-disabled": "Its item cannot be moved.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    indicator: { ...base("indicator"), "data-hidden": "No pointer drag." },
    "move-button": {
      ...base("move-button"),
      "data-direction": '"up" or "down".',
      "data-disabled": "At the end, or the item cannot be moved.",
    },
  },
  keyboard: [
    ["Space, Enter", "On a handle: pick up; while picked up: drop."],
    ["Arrows", "While picked up: move one position (Up/Down, or Left/Right when horizontal)."],
    ["Home, End", "While picked up: move to the first / last position."],
    ["Escape", "While picked up: put it back where it was."],
    ["Alt + arrow", "On a handle: move one position without picking up."],
  ],
  states: {
    idle: "Nothing picked up.",
    moving: "Picked up by keyboard: arrows move it, reordering live.",
    dragging: "Dragged by a pointer: the order changes on drop.",
  },
  contract: {
    actions: {
      pickUp: ["pointer", "keyboard", "virtual"],
      move: ["pointer", "keyboard", "virtual"],
      drop: ["pointer", "keyboard", "virtual"],
      cancel: ["pointer", "keyboard", "virtual"],
      quickMove: ["pointer", "keyboard", "virtual"],
      drag: ["pointer", "virtual"],
    },
    queries: ["order", "active", "pressed"],
    traits: [],
  },
} as const satisfies ComponentMeta
