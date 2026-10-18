// The Grid List's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in grid-list.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"grid-list"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const gridListMeta = {
  scope: "grid-list",
  name: "Grid List",
  stateless: false,
  parts: [
    {
      name: "GridList.Root",
      part: "root",
      element: "(none)",
      description: "Holds the state; renders no element.",
    },
    {
      name: "GridList.Label",
      part: "label",
      element: "span",
      description: "Names the list (`aria-labelledby`) while rendered.",
    },
    {
      name: "GridList.List",
      part: "list",
      element: "div",
      description: '`role="grid"` (`"group"` while empty); one Tab group over the rows.',
    },
    {
      name: "GridList.Item",
      part: "item",
      element: "div",
      description: '`role="row"` named by its ItemText; renders one `gridcell` (`item-cell`).',
    },
    {
      name: "GridList.ItemText",
      part: "item-text",
      element: "span",
      description: "The row's name.",
    },
    {
      name: "GridList.ItemDescription",
      part: "item-description",
      element: "span",
      description: "The row's description (`aria-describedby`).",
    },
    {
      name: "GridList.ItemCheckbox",
      part: "item-checkbox",
      element: "input",
      description: 'A native checkbox, "Select <row>", that always toggles its row.',
    },
    {
      name: "GridList.ItemControl",
      part: "item-control",
      element: "(render)",
      description:
        "A button, link or field in the row: reached by arrows or Tab, never selects the row.",
    },
    {
      name: "GridList.Empty",
      part: "empty",
      element: "div",
      description: "Inside the List while it has no rows.",
    },
    {
      name: "GridList.LoadMore",
      part: "load-more",
      element: "div",
      description: "A `row` sentinel that calls `onLoadMore` once per collection when it shows.",
    },
  ],
  props: {
    selectionMode: {
      type: '"none" | "single" | "multiple"',
      default: '"none"',
      description: "Selectable rows.",
    },
    selectionBehavior: {
      type: '"toggle" | "replace"',
      default: '"toggle"',
      description: "Replace: a press selects only that row.",
    },
    value: { type: "string | null | string[]", description: "Controlled selection." },
    defaultValue: { type: "string | null | string[]", description: "Uncontrolled selection." },
    onValueChange: {
      type: "(value, { reason, key }) => void",
      description: "Every selection change.",
    },
    onAction: {
      type: "(key, { modality, via }) => void",
      description: "Enter, a press or a double press, per the rules.",
    },
    childNavigation: {
      type: '"arrow" | "tab"',
      default: '"arrow"',
      description: "How focus reaches a row's controls: arrows, or Tab within the highlighted row.",
    },
    layout: {
      type: '"stack" | "grid"',
      default: '"stack"',
      description: "Grid: rows wrap as cards; Up/Down move to the card above or below.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No Tab stop, no keys or presses.",
    },
    disallowTypeAhead: {
      type: "boolean",
      default: "false",
      description: "Typing does not move the highlight.",
    },
    items: {
      type: "{ key, label, disabled?, href? }[]",
      description: "Data rows (else Item parts register).",
    },
    onLoadMore: {
      type: "() => void",
      description: "Called once per collection when LoadMore shows.",
    },
  },
  dataAttributes: {
    list: {
      ...base("list"),
      "data-layout": "stack | grid.",
      "data-selection-mode": "none | single | multiple.",
      "data-child-navigation": "arrow | tab.",
      "data-orientation": "vertical | horizontal (the composite's axis).",
      "data-focus": "Focus is in the list.",
      "data-focus-visible": "Keyboard focus is in the list.",
      "data-disabled": "Disabled.",
      "data-loading": "Loading.",
      "data-empty": "No rows.",
    },
    item: {
      ...base("item"),
      "data-key": "The row key.",
      "data-highlighted": "The highlighted row.",
      "data-selected": "Selected.",
      "data-disabled": "Disabled.",
      "data-focus-visible": "Keyboard focus on the row.",
      "data-focus-visible-within": "Keyboard focus on one of its controls.",
      "data-child-focused": "One of its controls has focus.",
      "data-hover": "The pointer is over it.",
      "data-pressed": "Pressed.",
      "data-current": "`current` is set.",
      "data-state": "selected | unselected (absent without selection).",
    },
    "item-checkbox": {
      ...base("item-checkbox"),
      "data-state": "checked | unchecked.",
      "data-disabled": "Disabled.",
    },
    "item-control": { ...base("item-control"), "data-disabled": "Its row is disabled." },
  },
  keyboard: [
    ["ArrowUp, ArrowDown", "Previous and next row (grid layout: the card above or below)."],
    [
      "ArrowRight, ArrowLeft",
      "Arrow mode: into and through the row's controls, back to the row (mirrored in RTL).",
    ],
    ["Home, End, PageUp, PageDown", "First, last, a page of rows."],
    ["Enter", "Follow the link, run the action, else select."],
    ["Space", "Toggle the selection (never the action)."],
    ["Shift+arrows, mod+A", "Extend the range, select all (multiple)."],
    ["Escape", "From a control: back to its row. Otherwise not handled."],
    ["Characters", "Typeahead over the rows' text."],
  ],
  states: {
    idle: "Focus is outside the list.",
    focused: "Focus is on a row or one of its controls.",
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
      act: ["pointer", "keyboard", "virtual"],
      check: ["pointer", "keyboard", "virtual"],
      focusControl: ["pointer", "keyboard", "virtual"],
      pressControl: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "items",
      "highlighted",
      "selected",
      "disabled",
      "focusedItem",
      "rows",
      "hasFocus",
      "isEmpty",
      "selectionMode",
      "controls",
    ],
    traits: ["composite-roving"],
  },
} as const satisfies ComponentMeta
