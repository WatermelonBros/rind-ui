// The Tags Input's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in tags-input.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tags-input"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const state = {
  "data-disabled": "While disabled.",
  "data-readonly": "While read-only.",
  "data-invalid": "While invalid.",
}

export const tagsInputMeta = {
  scope: "tags-input",
  name: "Tags Input",
  stateless: false,
  parts: [
    {
      name: "TagsInput.Root",
      part: "root",
      element: "(none)",
      description: "Holds the state; renders no element.",
    },
    {
      name: "TagsInput.Label",
      part: "label",
      element: "label",
      description: "Names the input (`for`).",
    },
    {
      name: "TagsInput.Control",
      part: "control",
      element: "div",
      description:
        "Wraps chips, input and buttons; a press on its own box focuses the input; renders the summary and the form inputs.",
    },
    {
      name: "TagsInput.Chips",
      part: "chips",
      element: "div",
      description: '`role="toolbar"`: one Chip per tag, before the Input.',
    },
    {
      name: "TagsInput.Chip",
      part: "chip",
      element: "span",
      description: "A tag; roving focus; Enter or a double press edits it; `disabled` locks it.",
    },
    {
      name: "TagsInput.ChipText",
      part: "chip-text",
      element: "span",
      description: "The tag's text.",
    },
    {
      name: "TagsInput.ChipInput",
      part: "chip-input",
      element: "input",
      description: 'Rendered only while its tag is edited; named "Edit {tag}".',
    },
    {
      name: "TagsInput.ChipRemove",
      part: "chip-remove",
      element: "button",
      description: 'Removes its tag; named "Remove {tag}"; not in the Tab order.',
    },
    {
      name: "TagsInput.Input",
      part: "input",
      element: "input",
      description:
        "A native text input, described by the tags summary; with suggestions its role is `combobox`.",
    },
    {
      name: "TagsInput.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description: "Removes every removable tag and the draft; not in the Tab order.",
    },
    {
      name: "TagsInput.Positioner",
      part: "positioner",
      element: "div",
      description: "Suggestions: places the popup against the Control (top layer when supported).",
    },
    {
      name: "TagsInput.Popup",
      part: "popup",
      element: "div",
      description: "Suggestions: the popup surface; a press on it keeps focus in the input.",
    },
    {
      name: "TagsInput.List",
      part: "list",
      element: "div",
      description: 'Suggestions: `role="listbox"`, named by the Label (the listbox parts).',
    },
    {
      name: "TagsInput.Item",
      part: "item",
      element: "div",
      description: 'A suggestion, `role="option"`; choosing it creates a tag from its key.',
    },
    {
      name: "TagsInput.ItemText",
      part: "item-text",
      element: "span",
      description: "The suggestion's text.",
    },
    {
      name: "TagsInput.Group",
      part: "section",
      element: "div",
      description: 'A group of suggestions (`role="group"`) with its label (GroupLabel).',
    },
    {
      name: "TagsInput.Separator",
      part: "separator",
      element: "div",
      description: 'Between groups; `role="none"`.',
    },
    {
      name: "TagsInput.Empty",
      part: "empty",
      element: "div",
      description: "Shown while the open popup has no suggestions; outside the listbox.",
    },
  ],
  props: {
    value: { type: "string[]", description: "Controlled tags." },
    defaultValue: { type: "string[]", default: "[]", description: "Uncontrolled tags." },
    onValueChange: {
      type: "(value, { reason }) => void",
      description:
        "Reasons `enter`, `delimiter`, `paste`, `blur`, `edit`, `chip-remove`, `backspace`, `clear`, `reset`, `add`, `item-press`.",
    },
    inputValue: { type: "string", description: "Controlled draft." },
    defaultInputValue: { type: "string", description: "Uncontrolled draft." },
    onInputValueChange: { type: "(text, { reason }) => void", description: "Every draft change." },
    delimiter: {
      type: "string | RegExp | (string | RegExp)[]",
      default: '","',
      description: "Splits typed text at the end of the draft; strings match literally.",
    },
    pasteDelimiter: {
      type: "string | RegExp | (string | RegExp)[]",
      description: "Default: the delimiters plus newline, tab and `;`.",
    },
    addOnPaste: {
      type: "boolean",
      default: "true",
      description:
        "A paste holding a delimiter becomes tags in one change; other pastes stay text.",
    },
    normalize: {
      type: "(text) => string",
      description: "Default: trim. Applied before every check.",
    },
    allowDuplicates: { type: "boolean", default: "false", description: "Equal tags coexist." },
    compare: {
      type: "(a, b) => boolean",
      description: "Duplicate check (default: exact equality).",
    },
    max: { type: "number", description: "More is refused with reason `max`." },
    validate: {
      type: "(text, value) => true | string",
      description: "A string refuses the candidate with that reason.",
    },
    onRefuse: { type: "({ reason, text }) => void", description: "A refused candidate." },
    blurBehavior: {
      type: '"keep" | "add" | "clear"',
      default: '"keep"',
      description: "What happens to the draft when focus leaves.",
    },
    editable: { type: "boolean", default: "true", description: "Tags can be edited in place." },
    removeOnBackspace: {
      type: "boolean",
      default: "true",
      description: "Backspace in the empty input arms, then removes, the last tag.",
    },
    name: { type: "string", description: "Submits one entry per tag." },
    inputName: { type: "string", description: "Submits the draft too." },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Nothing can be created, edited or removed.",
    },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "Tags are readable and navigable, not changeable.",
    },
    invalid: { type: "boolean", default: "false", description: "`aria-invalid` on the input." },
    required: {
      type: "boolean",
      default: "false",
      description: "Invalid while there are no tags.",
    },
    items: {
      type: "{ key, label, disabled?, section? }[]",
      description:
        "Suggestions: the input becomes a combobox; choosing one creates a tag from its key, shown with its label.",
    },
    collection: {
      type: "Collection",
      description: "Suggestions built by the consumer (virtualized or async lists).",
    },
    filter: {
      type: "((node, query) => boolean) | null",
      description: "The suggestion matcher; `null` lists them unfiltered (server filtering).",
    },
    itemsQuery: {
      type: "string",
      description: "The draft the given suggestions answer (async): another draft's are stale.",
    },
    loading: {
      type: '"idle" | "loading" | "loading-more" | "error"',
      description: "Async status.",
    },
    closeOnSelect: {
      type: "boolean",
      default: "false",
      description: "Choosing a suggestion closes the popup.",
    },
    allowCustom: {
      type: "boolean",
      default: "true",
      description: "With suggestions, typed text may become a tag; false refuses it (`invalid`).",
    },
    autoHighlight: {
      type: "boolean",
      default: "false",
      description: "Typing highlights the first suggestion.",
    },
    positioning: { type: "PositioningProps", description: "The popup's placement." },
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "The popup stays in the DOM while closed.",
    },
    messages: {
      type: "Partial<TagsInputMessages>",
      description: "Every string reaching assistive technology.",
    },
  },
  dataAttributes: {
    control: {
      ...base("control"),
      ...state,
      "data-state": '"idle", "typing", "suggesting" or "editing".',
      "data-focus": "Focus is in the component.",
      "data-empty-value": "No tags.",
      "data-at-max": "As many tags as `max`.",
    },
    input: {
      ...base("input"),
      ...state,
      "data-refused": "The reason of the last refusal, until the draft changes.",
      "data-empty": "The draft is empty.",
      "data-state": 'Suggestions: "open" while the listbox is shown, else "closed".',
    },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      "data-side": "The placed side.",
      "data-align": "The placed alignment.",
      "data-empty": "No suggestions are listed.",
      "data-loading": "Loading.",
    },
    popup: {
      ...base("popup"),
      "data-state": '"open" or "closed".',
      "data-empty": "No suggestions are listed.",
      "data-loading": "Loading.",
    },
    item: {
      ...base("item"),
      "data-highlighted": "The active descendant (keyboard, typing or pointer).",
      "data-focus-visible": "Highlighted from the keyboard.",
      "data-disabled": "Cannot be chosen.",
    },
    chip: {
      ...base("chip"),
      "data-highlighted": "Focused or armed by Backspace.",
      "data-armed": "The next Backspace removes it.",
      "data-editing": "Its ChipInput is open.",
      "data-disabled": "Locked.",
    },
    "chip-input": { ...base("chip-input"), "data-refused": "The edit was refused." },
    "clear-trigger": { ...base("clear-trigger"), "data-visible": "There is something to clear." },
  },
  keyboard: [
    [
      "Enter",
      "Creates a tag from the draft (no form submission); an empty draft submits the form.",
    ],
    ["Delimiter (default ,)", "At the end of the draft: the text before it becomes a tag."],
    ["Backspace (empty input)", "Arms the last tag, then removes it."],
    [
      "ArrowLeft at the start",
      "Moves to the last tag; ArrowLeft / ArrowRight between tags, past the last back to the input.",
    ],
    [
      "Backspace / Delete on a tag",
      "Removes it; focus moves to the next tag, else the previous, else the input.",
    ],
    ["Enter on a tag", "Edits it: Enter commits, Escape cancels, an empty commit removes."],
    ["A printable key on a tag", "Goes to the input."],
    [
      "ArrowDown / ArrowUp",
      "Suggestions: opens them, highlighting the first / last; then moves the highlight.",
    ],
    [
      "Enter on a highlighted suggestion",
      "Creates a tag from it; the draft clears, the popup stays open (`closeOnSelect`).",
    ],
    ["Escape", "Suggestions: closes the open popup; otherwise left to an enclosing layer."],
  ],
  states: {
    idle: "Focus is outside the component.",
    typing: "Focus is in the input or on a tag.",
    suggesting: "Typing with the suggestions popup open.",
    editing: "A tag's ChipInput is open.",
  },
  contract: {
    actions: {
      focusIn: ["keyboard"],
      type: ["keyboard"],
      compose: ["keyboard"],
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
      open: ["keyboard"],
      addTag: ["keyboard"],
      paste: ["keyboard"],
      backspace: ["keyboard"],
      editTag: ["pointer", "keyboard", "virtual"],
      removeTag: ["pointer", "keyboard", "virtual"],
      removeChip: ["pointer", "keyboard", "virtual"],
      clear: ["pointer", "keyboard", "virtual"],
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
      "hasFocus",
      "tags",
      "chips",
      "isAtMax",
      "refusal",
      "isEditing",
      "isActive",
    ],
    traits: ["form-associated", "field-associated", "composite-roving"],
  },
} as const satisfies ComponentMeta
