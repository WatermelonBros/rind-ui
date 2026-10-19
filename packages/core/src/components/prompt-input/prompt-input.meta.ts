// The Prompt Input's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in prompt-input.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"prompt-input"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})
const lifecycle = {
  "data-state": '"idle", "composing", "submitting", "streaming" or "stopped".',
  "data-disabled": "While disabled.",
}

export const promptInputMeta = {
  scope: "prompt-input",
  name: "Prompt Input",
  stateless: false,
  parts: [
    {
      name: "PromptInput.Root",
      part: "root",
      element: "form",
      description:
        "The form: owns the state, is the drop target, renders the hidden file inputs; a press on its padding focuses the Textarea.",
    },
    {
      name: "(none)",
      part: "field",
      element: "div",
      description:
        "The Field inside the form (`display: contents` in the theme); joins an enclosing Field instead when there is one.",
    },
    {
      name: "PromptInput.Label",
      part: "label",
      element: "label",
      description: "The Field's Label: names the Textarea (`for`).",
    },
    {
      name: "PromptInput.Description",
      part: "description",
      element: "p",
      description: "The Field's Description (`aria-describedby`).",
    },
    {
      name: "PromptInput.ErrorMessage",
      part: "error-message",
      element: "p",
      description: "The Field's errors, while invalid.",
    },
    {
      name: "PromptInput.Textarea",
      part: "textarea",
      element: "textarea",
      description:
        "The draft: autosizes (`field-sizing: content`, measured fallback); Enter submits; pastes files.",
    },
    {
      name: "PromptInput.Submit",
      part: "submit",
      element: "button",
      description:
        'One button: "Send message" (`type="submit"`) while idle, "Stop response" while busy; never unmounts.',
    },
    {
      name: "PromptInput.AttachTrigger",
      part: "attach-trigger",
      element: "button",
      description: "Opens the native file chooser.",
    },
    {
      name: "PromptInput.Attachments",
      part: "chips",
      element: "div",
      description: '`role="toolbar"`: one Attachment per file; renders the attachments summary.',
    },
    {
      name: "PromptInput.Attachment",
      part: "chip",
      element: "span",
      description: "One attachment; roving focus; Backspace or Delete removes it.",
    },
    {
      name: "PromptInput.AttachmentName",
      part: "chip-text",
      element: "span",
      description: "The attachment's name.",
    },
    {
      name: "PromptInput.AttachmentRemove",
      part: "chip-remove",
      element: "button",
      description: 'Removes its attachment; named "Remove {name}"; not in the Tab order.',
    },
    {
      name: "PromptInput.CharacterCount",
      part: "character-count",
      element: "span",
      description:
        "`used/max` with a soft `max` (and a `count` function for tokens); over it nothing is sent.",
    },
  ],
  props: {
    value: { type: "string", description: "Controlled draft." },
    defaultValue: { type: "string", default: '""', description: "Uncontrolled draft." },
    onValueChange: {
      type: "(value, { reason }) => void",
      description: "Reasons `input`, `submit` (cleared), `restore`, `history`, `api`, `reset`.",
    },
    attachments: { type: "PromptAttachment[]", description: "Controlled attachments." },
    defaultAttachments: {
      type: "PromptAttachment[]",
      default: "[]",
      description: "Uncontrolled attachments.",
    },
    onAttachmentsChange: {
      type: "(attachments, { reason }) => void",
      description: "Reasons `add`, `remove`, `submit`, `restore`.",
    },
    onSubmit: {
      type: "({ text, attachments }, { event, formData }) => void | Promise",
      description:
        "Called once per send; the draft and attachments clear at once. A rejected promise restores them into an empty draft.",
    },
    status: {
      type: '"idle" | "submitting" | "streaming" | "error"',
      description: "The request's progress, as your chat state reports it.",
    },
    onStop: { type: "() => void", description: "Submit pressed while busy." },
    onReject: {
      type: "({ file, reason }[]) => void",
      description: "Files refused by `accept`, `maxFiles` or `maxFileSize`.",
    },
    submitKey: {
      type: '"enter" | "mod+enter" | "none"',
      default: '"enter"',
      description: "What submits from the Textarea; on phones and tablets Enter is a newline.",
    },
    history: {
      type: "string[]",
      description: "Past prompts, newest last: ArrowUp in an empty draft recalls them.",
    },
    accept: { type: "string", description: "The `<input accept>` grammar, for every path." },
    multiple: { type: "boolean", default: "true", description: "The chooser picks several." },
    maxFiles: { type: "number", description: "More attachments are refused." },
    maxFileSize: { type: "number", description: "Bytes; larger files are refused." },
    name: { type: "string", default: '"message"', description: "The Textarea's form name." },
    filesName: { type: "string", default: '"files"', description: "The files' form name." },
    disabled: { type: "boolean", default: "false", description: "Every part is disabled." },
    readOnly: {
      type: "boolean",
      default: "false",
      description: "No typing, no files; the draft can still be sent.",
    },
    invalid: {
      type: "boolean",
      default: "false",
      description: "The Field is invalid (also while over a CharacterCount's max).",
    },
    errors: { type: "string[]", description: "The Field's error messages." },
    messages: {
      type: "Partial<PromptInputMessages>",
      description: "Every string reaching assistive technology.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      ...lifecycle,
      "data-empty": "The draft is empty.",
      "data-composing": "An IME composition is in progress.",
      "data-over-limit": "Over the CharacterCount's max.",
      "data-dragging": "A file drag is over the Root.",
      "data-has-attachments": "At least one attachment.",
      "data-focus": "Focus is in the Textarea or on an attachment.",
    },
    textarea: {
      ...base("textarea"),
      ...lifecycle,
      "data-empty": "The draft is empty.",
      "data-composing": "An IME composition is in progress.",
    },
    submit: {
      ...base("submit"),
      ...lifecycle,
      "data-action": '"send" or "stop".',
      "data-disabled": "Disabled, or pressing it does nothing now (with `aria-disabled`).",
    },
    chip: {
      ...base("chip"),
      "data-highlighted": "Focused or armed by Backspace.",
      "data-armed": "The next Backspace removes it.",
      "data-pending": "Still uploading.",
      "data-disabled": "Locked.",
    },
    "character-count": { ...base("character-count"), "data-over-limit": "Over the limit." },
  },
  keyboard: [
    ["Enter", "Sends (no newline). On phones and tablets: a newline."],
    ["Shift+Enter", "A newline."],
    ["Mod+Enter", "Sends, in every `submitKey` mode except `none`."],
    ["Enter during an IME composition", "Commits the composition; never sends."],
    ["ArrowUp (empty draft, caret at the start)", "Recalls the previous prompt (`history`)."],
    ["ArrowDown (recalled, caret at the end)", "The next prompt, then the saved draft."],
    ["Backspace (empty draft)", "Arms the last attachment, then removes it."],
    ["ArrowLeft at the start", "Moves to the last attachment."],
    ["Backspace / Delete on an attachment", "Removes it."],
    ["Escape", "Not handled: the enclosing layer gets it."],
  ],
  states: {
    idle: "Ready: Submit sends.",
    composing: "An IME composition in an idle draft: no key sends.",
    submitting: "Sent, waiting for the reply: Submit stops.",
    streaming: "The reply is arriving: Submit stops.",
    stopped: "Stopped, until your status reports idle.",
  },
  contract: {
    actions: {
      focusIn: ["keyboard"],
      tabOut: ["keyboard"],
      type: ["keyboard"],
      typeR: ["keyboard"],
      fill: ["keyboard"],
      compose: ["keyboard"],
      submit: ["pointer", "keyboard", "virtual"],
      settle: ["pointer", "keyboard", "virtual"],
      stop: ["pointer", "keyboard", "virtual"],
      attach: ["pointer", "keyboard", "virtual"],
      paste: ["keyboard"],
      recall: ["keyboard"],
      backspace: ["keyboard"],
      caret: ["keyboard"],
      removeAttachment: ["pointer", "keyboard", "virtual"],
      removeChip: ["pointer", "keyboard", "virtual"],
    },
    queries: [
      "value",
      "state",
      "attachments",
      "chips",
      "canSubmit",
      "submitName",
      "submitAction",
      "characterCount",
      "isOverLimit",
      "isDisabled",
      "isDragging",
    ],
    traits: ["field-associated"],
  },
} as const satisfies ComponentMeta
