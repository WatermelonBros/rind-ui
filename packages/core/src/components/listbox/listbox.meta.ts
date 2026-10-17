// The Listbox's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in listbox.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"listbox" (or the reusing component\'s scope)',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const listboxMeta = {
  scope: "listbox",
  name: "Listbox",
  stateless: false,
  parts: [
    {
      name: "Listbox.Root",
      part: "root",
      element: "(none)",
      description: "Holds the state; renders no element.",
    },
    {
      name: "Listbox.Label",
      part: "label",
      element: "span",
      description: "Names the list (`aria-labelledby`) while rendered.",
    },
    {
      name: "Listbox.List",
      part: "list",
      element: "div",
      description: '`role="listbox"`; one Tab stop (roving).',
    },
    {
      name: "Listbox.Item",
      part: "item",
      element: "div",
      description: '`role="option"` with explicit `aria-selected`; named by its content.',
    },
    {
      name: "Listbox.ItemText",
      part: "item-text",
      element: "span",
      description: "The option's name and default text value.",
    },
    {
      name: "Listbox.ItemDescription",
      part: "item-description",
      element: "span",
      description: "`aria-hidden`, referenced by the option's `aria-describedby`.",
    },
    {
      name: "Listbox.ItemIndicator",
      part: "item-indicator",
      element: "span",
      description: "`aria-hidden`; rendered while selected unless `keepMounted`.",
    },
    {
      name: "Listbox.Section",
      part: "section",
      element: "div",
      description: '`role="group"` named by its label.',
    },
    {
      name: "Listbox.Separator",
      part: "separator",
      element: "div",
      description: 'Decorative (`role="none"`): a listbox only holds options and groups.',
    },
    {
      name: "Listbox.Empty",
      part: "empty",
      element: "div",
      description: "After the list while it has no items; describes it.",
    },
    {
      name: "Listbox.LoadMore",
      part: "load-more",
      element: "div",
      description: "The `aria-hidden` scroll sentinel that calls `onLoadMore`.",
    },
  ],
  props: {
    selectionMode: {
      type: '"single" | "multiple" | "none"',
      default: '"single"',
      description: "None: an action list.",
    },
    selectionBehavior: {
      type: '"toggle" | "replace"',
      default: '"toggle"',
      description: "Replace: selection follows focus.",
    },
    value: {
      type: 'string | null | string[] | "all"',
      description: 'Controlled selection (`"all"` from select all).',
    },
    defaultValue: {
      type: 'string | null | string[] | "all"',
      description: "Uncontrolled selection.",
    },
    onValueChange: {
      type: "(value, { reason, key }) => void",
      description: "Every selection change.",
    },
    onAction: {
      type: "(key, { modality, via }) => void",
      description: "None mode: Enter or press; replace: Enter or double press.",
    },
    orientation: {
      type: '"vertical" | "horizontal"',
      default: '"vertical"',
      description: "Horizontal: Left/Right (mirrored in RTL).",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No Tab stop, no keys or presses.",
    },
    items: {
      type: "{ key, label, disabled?, section? }[]",
      description: "Data items (else item parts register).",
    },
    loading: {
      type: '"idle" | "loading" | "loading-more" | "error"',
      description: "Async status (`aria-busy`).",
    },
    onLoadMore: {
      type: "() => void",
      description: "Called once per collection when the sentinel shows or the end is reached.",
    },
  },
  dataAttributes: {
    list: {
      ...base("list"),
      "data-orientation": "vertical | horizontal.",
      "data-selection-mode": "single | multiple | none.",
      "data-focus": "Focus is in the list.",
      "data-focus-visible": "Keyboard focus is in the list.",
      "data-disabled": "Disabled.",
      "data-loading": "Loading.",
      "data-empty": "No items.",
    },
    item: {
      ...base("item"),
      "data-key": "The item key.",
      "data-highlighted": "The highlighted (focused) item.",
      "data-selected": "Selected.",
      "data-disabled": "Disabled.",
      "data-focus-visible": "Keyboard focus.",
      "data-state": "selected | unselected (absent in none mode).",
    },
    "item-indicator": { ...base("item-indicator"), "data-state": "selected | unselected." },
  },
  keyboard: [
    [
      "Arrow keys, Home, End, PageUp, PageDown",
      "Move the highlight; replace: also select (mod: move only).",
    ],
    [
      "Space, Enter",
      "Select (toggle in multiple); none mode: act; replace with onAction: Enter acts.",
    ],
    ["Shift+Arrow, Shift+Space", "Extend the range from the anchor (multiple)."],
    ["mod+A", "Select all (multiple)."],
    ["Characters", "Typeahead."],
    ["Escape", "Not handled: the enclosing layer gets it."],
  ],
  states: {
    idle: "Focus is outside the list.",
    focused: "Focus is in the list: keys navigate and select.",
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
      typeB: ["keyboard"],
      chooseHighlighted: ["keyboard"],
      act: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "items",
      "highlighted",
      "selected",
      "disabled",
      "focusedItem",
      "hasFocus",
      "isEmpty",
      "selectionMode",
    ],
    traits: ["composite-roving", "selectable", "set-metadata", "directional"],
  },
} as const satisfies ComponentMeta
