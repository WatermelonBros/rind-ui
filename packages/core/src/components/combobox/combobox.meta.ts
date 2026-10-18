// The Combobox's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in combobox.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"combobox"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const state = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "While invalid.",
}

export const comboboxMeta = {
  scope: "combobox",
  name: "Combobox",
  stateless: false,
  parts: [
    {
      name: "Combobox.Root",
      part: "root",
      element: "(none)",
      description: "Holds the state; renders no element.",
    },
    {
      name: "Combobox.Label",
      part: "label",
      element: "label",
      description: "Names the input and the listbox.",
    },
    {
      name: "Combobox.Control",
      part: "control",
      element: "div",
      description: "The anchor: wraps chips, input and buttons; renders the hidden form inputs.",
    },
    {
      name: "Combobox.Input",
      part: "input",
      element: "input",
      description:
        '`role="combobox"`; keeps focus while the options are browsed (`aria-activedescendant`).',
    },
    {
      name: "Combobox.Trigger",
      part: "trigger",
      element: "button",
      description: 'Toggles the popup; not in the Tab order; named "Show suggestions".',
    },
    {
      name: "Combobox.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description: 'Clears text and selection; not in the Tab order; named "Clear".',
    },
    {
      name: "Combobox.Chips",
      part: "chips",
      element: "div",
      description:
        'Multiple: `role="toolbar"` with one Chip per selected option, before the Input.',
    },
    {
      name: "Combobox.Chip",
      part: "chip",
      element: "span",
      description: "A selected option; roving focus.",
    },
    {
      name: "Combobox.ChipRemove",
      part: "chip-remove",
      element: "button",
      description: 'Deselects its option; named "Remove {text}"; not in the Tab order.',
    },
    {
      name: "Combobox.Positioner",
      part: "positioner",
      element: "div",
      description: "Places the popup next to the Control; in the top layer where supported.",
    },
    { name: "Combobox.Popup", part: "popup", element: "div", description: "The popup surface." },
    {
      name: "Combobox.List",
      part: "list",
      element: "div",
      description: '`role="listbox"`, named by the Label (or the `listboxLabel` message).',
    },
    {
      name: "Combobox.Item",
      part: "item",
      element: "div",
      description: '`role="option"` with explicit `aria-selected`.',
    },
    {
      name: "Combobox.ItemText",
      part: "item-text",
      element: "span",
      description: "The option's text.",
    },
    {
      name: "Combobox.ItemIndicator",
      part: "item-indicator",
      element: "span",
      description: "An `aria-hidden` check that follows `data-state`.",
    },
    {
      name: "Combobox.Group",
      part: "section",
      element: "div",
      description: '`role="group"` named by its label.',
    },
    {
      name: "Combobox.Separator",
      part: "separator",
      element: "div",
      description: 'Decorative (`role="none"`).',
    },
    {
      name: "Combobox.Empty",
      part: "empty",
      element: "div",
      description: "Shown, outside the listbox, while no option is listed.",
    },
    {
      name: "Combobox.LoadMore",
      part: "load-more",
      element: "div",
      description: "A sentinel at the end of the list: `onLoadMore` when it scrolls into view.",
    },
  ],
  props: {
    items: {
      type: "{ key, label, disabled?, section? }[]",
      description: "The options (data mode).",
    },
    collection: { type: "Collection", description: "A collection built by the consumer." },
    value: {
      type: "string | null | string[]",
      description: "Controlled selection (`string[]` with `multiple`).",
    },
    defaultValue: { type: "string | null | string[]", description: "Uncontrolled selection." },
    onValueChange: {
      type: "(value, { reason }) => void",
      description:
        "Reasons `item-press`, `enter`, `commit`, `clear`, `chip-remove`, `reset`, `autofill`.",
    },
    inputValue: { type: "string", description: "Controlled text." },
    defaultInputValue: {
      type: "string",
      description: "Uncontrolled text (default: the selection's).",
    },
    onInputValueChange: {
      type: "(text, { reason, signal }) => void",
      description: "`signal` aborts when a newer text is reported or the popup closes (async).",
    },
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Uncontrolled open state." },
    onOpenChange: { type: "(open, { reason }) => void", description: "Every open change." },
    multiple: {
      type: "boolean",
      default: "false",
      description: "Several options, shown as chips.",
    },
    allowCustomValue: {
      type: "boolean",
      default: "false",
      description: "Text matching no option is kept (the value becomes `null`).",
    },
    filter: {
      type: "((item, query) => boolean) | null",
      description:
        "The matcher (default: locale-aware contains); `null` lists the collection as given.",
    },
    itemsQuery: {
      type: "string",
      description: "The query the given collection answers (stale otherwise).",
    },
    autoHighlight: {
      type: "boolean",
      default: "false",
      description: "Highlight the first match while typing.",
    },
    autoComplete: {
      type: '"list" | "both"',
      default: '"list"',
      description: '`"both"` completes the text inline with the highlighted option.',
    },
    openOnFocus: {
      type: "boolean",
      default: "false",
      description: "Open when the input gains focus.",
    },
    openOnInputPress: {
      type: "boolean",
      default: "false",
      description: "Open on a press on the input.",
    },
    selectOnTab: {
      type: "boolean",
      default: "false",
      description: "Tab chooses the keyboard highlight.",
    },
    closeOnSelect: {
      type: "boolean",
      default: "true (false with `multiple`)",
      description: "Close after a choice.",
    },
    removeOnBackspace: {
      type: "boolean",
      default: "true",
      description: "Multiple: Backspace in the empty input arms, then removes, the last chip.",
    },
    loading: {
      type: '"idle" | "loading" | "loading-more"',
      description: "Async status (`aria-busy`).",
    },
    onLoadMore: { type: "() => void", description: "The LoadMore sentinel came into view." },
    name: { type: "string", description: "Submits the selected key(s), one entry each." },
    inputName: { type: "string", description: "Submits the visible text too." },
    disabled: { type: "boolean", default: "false", description: "Nothing opens or changes." },
    readOnly: { type: "boolean", default: "false", description: "Browsable; nothing changes." },
    invalid: { type: "boolean", default: "false", description: "`aria-invalid` on the input." },
    required: {
      type: "boolean",
      default: "false",
      description: "Validated natively (an empty selection is invalid).",
    },
    messages: {
      type: "Partial<ComboboxMessages>",
      description: "Every string reaching assistive technology.",
    },
  },
  dataAttributes: {
    control: {
      ...base("control"),
      ...state,
      "data-state": '"open" or "closed".',
      "data-focus": "Focus is in the component.",
      "data-empty-value": "Nothing is selected.",
    },
    input: {
      ...base("input"),
      ...state,
      "data-state": '"open" while the listbox is shown (as `aria-expanded`), else "closed".',
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    popup: {
      ...base("popup"),
      "data-state": '"open" or "closed".',
      "data-empty": "Open with no option listed.",
      "data-loading": "Loading.",
    },
    item: {
      ...base("item"),
      "data-highlighted": "The highlight (the active descendant).",
      "data-focus-visible": "Highlighted by the keyboard.",
      "data-state": '"checked" or "unchecked".',
      "data-disabled": "Disabled.",
    },
    chip: {
      ...base("chip"),
      "data-highlighted": "Focused or armed by Backspace.",
      "data-disabled": "Cannot be removed.",
    },
    "clear-trigger": { ...base("clear-trigger"), "data-visible": "There is something to clear." },
  },
  keyboard: [
    ["ArrowDown / ArrowUp", "Open on the selection (or first / last), then move the highlight."],
    ["Alt + ArrowDown", "Open without highlighting."],
    [
      "Enter",
      "Choose the highlight (form not submitted); with none, commit the text and let the form submit.",
    ],
    [
      "Escape",
      "Remove an inline completion, else close (commit), else revert; unhandled otherwise.",
    ],
    ["Tab", "Close and commit; chooses the highlight only with `selectOnTab`."],
    ["ArrowLeft / ArrowRight / Home / End", "Back to editing the text (the highlight clears)."],
    ["Backspace (empty input, multiple)", "Arm the last chip, then remove it."],
    [
      "ArrowLeft at the start (multiple)",
      "Move to the chips; ArrowLeft / ArrowRight between chips.",
    ],
  ],
  states: {
    closed: "The popup is closed; typed text is committed on blur and Enter.",
    open: "The popup is open (possibly showing only the Empty part).",
  },
  contract: {
    actions: {
      focusIn: ["keyboard"],
      type: ["keyboard"],
      compose: ["keyboard"],
      open: ["pointer", "keyboard", "virtual"],
      close: ["keyboard"],
      arrowDown: ["keyboard"],
      arrowUp: ["keyboard"],
      altArrowDown: ["keyboard"],
      caret: ["keyboard"],
      pressEnter: ["keyboard"],
      pressEscape: ["keyboard"],
      tabOut: ["keyboard"],
      blur: ["pointer", "virtual"],
      typeR: ["keyboard"],
      clearText: ["keyboard"],
      choose: ["pointer", "keyboard", "virtual"],
      removeChip: ["pointer", "keyboard", "virtual"],
      backspace: ["keyboard"],
      clear: ["pointer", "keyboard", "virtual"],
      run: ["pointer", "keyboard", "virtual"],
      back: ["keyboard"],
    },
    queries: [
      "side",
      "align",
      "isAnchorHidden",
      "isPlaced",
      "inputValue",
      "isOpen",
      "isEmpty",
      "isLoading",
      "items",
      "highlighted",
      "selected",
      "value",
      "hasFocus",
      "chips",
      "page",
    ],
    traits: [
      "composite-activedescendant",
      "layer",
      "presence",
      "anchored",
      "selectable",
      "form-associated",
      "field-associated",
    ],
  },
} as const satisfies ComponentMeta
