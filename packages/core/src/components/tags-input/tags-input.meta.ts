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
      description: "A native text input (no combobox role); described by the tags summary.",
    },
    {
      name: "TagsInput.ClearTrigger",
      part: "clear-trigger",
      element: "button",
      description: "Removes every removable tag and the draft; not in the Tab order.",
    },
  ],
  props: {
    value: { type: "string[]", description: "Controlled tags." },
    defaultValue: { type: "string[]", default: "[]", description: "Uncontrolled tags." },
    onValueChange: {
      type: "(value, { reason }) => void",
      description:
        "Reasons `enter`, `delimiter`, `paste`, `blur`, `edit`, `chip-remove`, `backspace`, `clear`, `reset`, `add`.",
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
    messages: {
      type: "Partial<TagsInputMessages>",
      description: "Every string reaching assistive technology.",
    },
  },
  dataAttributes: {
    control: {
      ...base("control"),
      ...state,
      "data-state": '"idle", "typing" or "editing".',
      "data-focus": "Focus is in the component.",
      "data-empty-value": "No tags.",
      "data-at-max": "As many tags as `max`.",
    },
    input: {
      ...base("input"),
      ...state,
      "data-refused": "The reason of the last refusal, until the draft changes.",
      "data-empty": "The draft is empty.",
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
  ],
  states: {
    idle: "Focus is outside the component.",
    typing: "Focus is in the input or on a tag.",
    editing: "A tag's ChipInput is open.",
  },
  contract: {
    actions: {
      focusIn: ["keyboard"],
      type: ["keyboard"],
      typeR: ["keyboard"],
      addTag: ["keyboard"],
      paste: ["keyboard"],
      compose: ["keyboard"],
      pressEnter: ["keyboard"],
      backspace: ["keyboard"],
      caret: ["keyboard"],
      tabOut: ["keyboard"],
      editTag: ["pointer", "keyboard", "virtual"],
      removeTag: ["pointer", "keyboard", "virtual"],
      removeChip: ["pointer", "keyboard", "virtual"],
      clear: ["pointer", "keyboard", "virtual"],
    },
    queries: ["tags", "chips", "inputValue", "isAtMax", "refusal", "isEditing", "isActive"],
    traits: ["form-associated", "field-associated", "composite-roving"],
  },
} as const satisfies ComponentMeta
