# Prompt Input

The box where a user writes a prompt for an assistant: a draft that grows with its text, files attached by picker, paste or drop, and one button that sends the prompt or, while the reply is on its way, stops it. There is no model inside: you send the request in `onSubmit` and report its progress with `status`; the component owns the keys, the draft, the attachments, the send/stop lifecycle and what screen readers hear.

## When to use

- **Use it for** the composer of a chat or an assistant: a prompt that is sent as a whole, with optional files, and a reply the user may want to stop.
- **Over a `<form>` with a `<textarea>`**: Enter that never sends half of a Japanese, Chinese or Korean conversion; Enter that cannot send a second message while a reply streams; one Send/Stop button that keeps focus when it changes; files from paste and drop with `accept` and size limits, each refusal reported; a failed send that gives the prompt back; and announcements for stop, failure and files.
- **Don't use it for** a plain multi-line field in a form (use a [Text Field](text-field.md) with a `Textarea`), or for a list of short values typed one by one (use a [Tags Input](tags-input.md)).

```tsx
import { PromptInput } from "@rind-ui/react"

const { messages, sendMessage, status, stop } = useYourChat()

<PromptInput.Root
  status={status === "submitted" ? "submitting" : status === "ready" ? "idle" : status}
  onSubmit={({ text, attachments }) => sendMessage({ text, files: attachments })}
  onStop={stop}
>
  <PromptInput.Label>Message</PromptInput.Label>
  <PromptInput.Attachments />
  <PromptInput.Textarea placeholder="Ask anything" />
  <PromptInput.AttachTrigger />
  <PromptInput.Submit />
</PromptInput.Root>
```

The Textarea needs an accessible name: render a `PromptInput.Label` (visually hidden if you like), or pass `aria-label` to `PromptInput.Textarea`. A placeholder is not a name; development builds warn.

## API

<!-- api:prompt-input -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `PromptInput.Root` | `root` | `<form>` | The form: owns the state, is the drop target, renders the hidden file inputs; a press on its padding focuses the Textarea. |
| `(none)` | `field` | `<div>` | The Field inside the form (`display: contents` in the theme); joins an enclosing Field instead when there is one. |
| `PromptInput.Label` | `label` | `<label>` | The Field's Label: names the Textarea (`for`). |
| `PromptInput.Description` | `description` | `<p>` | The Field's Description (`aria-describedby`). |
| `PromptInput.ErrorMessage` | `error-message` | `<p>` | The Field's errors, while invalid. |
| `PromptInput.Textarea` | `textarea` | `<textarea>` | The draft: autosizes (`field-sizing: content`, measured fallback); Enter submits; pastes files. |
| `PromptInput.Submit` | `submit` | `<button>` | One button: "Send message" (`type="submit"`) while idle, "Stop response" while busy; never unmounts. |
| `PromptInput.AttachTrigger` | `attach-trigger` | `<button>` | Opens the native file chooser. |
| `PromptInput.Attachments` | `chips` | `<div>` | `role="toolbar"`: one Attachment per file; renders the attachments summary. |
| `PromptInput.Attachment` | `chip` | `<span>` | One attachment; roving focus; Backspace or Delete removes it. |
| `PromptInput.AttachmentName` | `chip-text` | `<span>` | The attachment's name. |
| `PromptInput.AttachmentRemove` | `chip-remove` | `<button>` | Removes its attachment; named "Remove {name}"; not in the Tab order. |
| `PromptInput.CharacterCount` | `character-count` | `<span>` | `used/max` with a soft `max` (and a `count` function for tokens); over it nothing is sent. |

### Props

| Part | Prop | Type | Default | Description |
|---|---|---|---|---|
| `PromptInput.Root` | `value` | `string` | — | Controlled draft. |
| `PromptInput.Root` | `defaultValue` | `string` | `""` | Uncontrolled draft. |
| `PromptInput.Root` | `onValueChange` | `(value, { reason }) => void` | — | Reasons `input`, `submit` (cleared), `restore`, `history`, `api`, `reset`. |
| `PromptInput.Root` | `attachments` | `PromptAttachment[]` | — | Controlled attachments. |
| `PromptInput.Root` | `defaultAttachments` | `PromptAttachment[]` | `[]` | Uncontrolled attachments. |
| `PromptInput.Root` | `onAttachmentsChange` | `(attachments, { reason }) => void` | — | Reasons `add`, `remove`, `submit`, `restore`. |
| `PromptInput.Root` | `onSubmit` | `({ text, attachments }, { event, formData }) => void \| Promise` | — | Called once per send; the draft and attachments clear at once. A rejected promise restores them into an empty draft. |
| `PromptInput.Root` | `status` | `"idle" \| "submitting" \| "streaming" \| "error"` | — | The request's progress, as your chat state reports it. |
| `PromptInput.Root` | `onStop` | `() => void` | — | Submit pressed while busy. |
| `PromptInput.Root` | `onReject` | `({ file, reason }[]) => void` | — | Files refused by `accept`, `maxFiles` or `maxFileSize`. |
| `PromptInput.Root` | `submitKey` | `"enter" \| "mod+enter" \| "none"` | `"enter"` | What submits from the Textarea; on phones and tablets Enter is a newline. |
| `PromptInput.Root` | `history` | `string[]` | — | Past prompts, newest last: ArrowUp in an empty draft recalls them. |
| `PromptInput.Root` | `accept` | `string` | — | The `<input accept>` grammar, for every path. |
| `PromptInput.Root` | `multiple` | `boolean` | `true` | The chooser picks several. |
| `PromptInput.Root` | `maxFiles` | `number` | — | More attachments are refused. |
| `PromptInput.Root` | `maxFileSize` | `number` | — | Bytes; larger files are refused. |
| `PromptInput.Root` | `name` | `string` | `"message"` | The Textarea's form name. |
| `PromptInput.Root` | `filesName` | `string` | `"files"` | The files' form name. |
| `PromptInput.Root` | `disabled` | `boolean` | `false` | Every part is disabled. |
| `PromptInput.Root` | `readOnly` | `boolean` | `false` | No typing, no files; the draft can still be sent. |
| `PromptInput.Root` | `invalid` | `boolean` | `false` | The Field is invalid (also while over a CharacterCount's max). |
| `PromptInput.Root` | `errors` | `string[]` | — | The Field's error messages. |
| `PromptInput.Root` | `messages` | `Partial<PromptInputMessages>` | — | Every string reaching assistive technology. |
| `PromptInput.Root` | `children` | `ReactNode` | — | The parts. |
| `PromptInput.Root` | `render` | `RenderProp<undefined>` | — | Substitutes the `<form>` element. |
| `PromptInput.Root` | `fieldMessages` | `MessageOverrides<FieldMessages>` | — | Replaces the Field's own strings. |
| `PromptInput.Label` | `render` | `RenderProp<FieldState>` | — | Another element or a render function receiving the props and the Field's state. |
| `PromptInput.Description` | `render` | `RenderProp<FieldState>` | — | Another element or a render function receiving the props and the Field's state. |
| `PromptInput.ErrorMessage` | `render` | `RenderProp<FieldState>` | — | Another element or a render function receiving the props and the Field's state. |
| `PromptInput.ErrorMessage` | `match` | `string` | — | Rendered only when this validity key caused the error (one message per constraint). |
| `PromptInput.ErrorMessage` | `children` | `ReactNode \| ((messages: readonly string[]) => ReactNode)` | — | Replaces the default text; a function returning null/undefined falls back to it. |
| `PromptInput.Textarea` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.Textarea` | `autosize` | `boolean` | — | Grows with the content (`field-sizing: content`, a measured fallback). Default `true`. |
| `PromptInput.Submit` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.AttachTrigger` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.Attachments` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.Attachments` | `children` | `(attachment: PromptAttachment) => ReactNode` | — | Renders one attachment; default: its name and its remove button. |
| `PromptInput.Attachment` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.AttachmentName` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.AttachmentRemove` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.CharacterCount` | `render` | `RenderProp<undefined>` | — | Substitutes the rendered element. |
| `PromptInput.CharacterCount` | `max` | `number` | — | A soft limit: over it, nothing is sent and the input is invalid; never a truncation. |
| `PromptInput.CharacterCount` | `count` | `(value: string) => number` | `characters, a line break once` | Counts the draft (a tokenizer for a token limit). |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "prompt-input" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-state` | "idle", "composing", "submitting", "streaming" or "stopped". |
| `root` | `data-disabled` | While disabled. |
| `root` | `data-empty` | The draft is empty. |
| `root` | `data-composing` | An IME composition is in progress. |
| `root` | `data-over-limit` | Over the CharacterCount's max. |
| `root` | `data-dragging` | A file drag is over the Root. |
| `root` | `data-has-attachments` | At least one attachment. |
| `root` | `data-focus` | Focus is in the Textarea or on an attachment. |
| `textarea` | `data-scope` | "prompt-input" |
| `textarea` | `data-part` | "textarea" |
| `textarea` | `data-instance` | The instance id. |
| `textarea` | `data-state` | "idle", "composing", "submitting", "streaming" or "stopped". |
| `textarea` | `data-disabled` | While disabled. |
| `textarea` | `data-empty` | The draft is empty. |
| `textarea` | `data-composing` | An IME composition is in progress. |
| `submit` | `data-scope` | "prompt-input" |
| `submit` | `data-part` | "submit" |
| `submit` | `data-instance` | The instance id. |
| `submit` | `data-state` | "idle", "composing", "submitting", "streaming" or "stopped". |
| `submit` | `data-disabled` | Disabled, or pressing it does nothing now (with `aria-disabled`). |
| `submit` | `data-action` | "send" or "stop". |
| `chip` | `data-scope` | "prompt-input" |
| `chip` | `data-part` | "chip" |
| `chip` | `data-instance` | The instance id. |
| `chip` | `data-highlighted` | Focused or armed by Backspace. |
| `chip` | `data-armed` | The next Backspace removes it. |
| `chip` | `data-pending` | Still uploading. |
| `chip` | `data-disabled` | Locked. |
| `character-count` | `data-scope` | "prompt-input" |
| `character-count` | `data-part` | "character-count" |
| `character-count` | `data-instance` | The instance id. |
| `character-count` | `data-over-limit` | Over the limit. |

### Keyboard

| Key | Action |
|---|---|
| Enter | Sends (no newline). On phones and tablets: a newline. |
| Shift+Enter | A newline. |
| Mod+Enter | Sends, in every `submitKey` mode except `none`. |
| Enter during an IME composition | Commits the composition; never sends. |
| ArrowUp (empty draft, caret at the start) | Recalls the previous prompt (`history`). |
| ArrowDown (recalled, caret at the end) | The next prompt, then the saved draft. |
| Backspace (empty draft) | Arms the last attachment, then removes it. |
| ArrowLeft at the start | Moves to the last attachment. |
| Backspace / Delete on an attachment | Removes it. |
| Escape | Not handled: the enclosing layer gets it. |

### States

| State | Description |
|---|---|
| `idle` | Ready: Submit sends. |
| `composing` | An IME composition in an idle draft: no key sends. |
| `submitting` | Sent, waiting for the reply: Submit stops. |
| `streaming` | The reply is arriving: Submit stops. |
| `stopped` | Stopped, until your status reports idle. |

### Contract

| Action | Modalities |
|---|---|
| `focusIn` | keyboard |
| `tabOut` | keyboard |
| `type` | keyboard |
| `typeR` | keyboard |
| `fill` | keyboard |
| `compose` | keyboard |
| `submit` | pointer, keyboard, virtual |
| `settle` | pointer, keyboard, virtual |
| `stop` | pointer, keyboard, virtual |
| `attach` | pointer, keyboard, virtual |
| `paste` | keyboard |
| `recall` | keyboard |
| `backspace` | keyboard |
| `caret` | keyboard |
| `removeAttachment` | pointer, keyboard, virtual |
| `removeChip` | pointer, keyboard, virtual |

Queries: `value`, `state`, `attachments`, `chips`, `canSubmit`, `submitName`, `submitAction`, `characterCount`, `isOverLimit`, `isDisabled`, `isDragging`. Traits: `field-associated`.
<!-- /api -->

## The send/stop contract

- `onSubmit({ text, attachments }, { event, formData })` is called **once** per send, with the draft and the attachments as they were. Both clear at once, so what the user types while the request runs is the next prompt and is never cleared later.
- Return a promise to stay `submitting` until it settles. A rejected promise is a failed send: "Message not sent" is announced and the prompt comes back, unless the user has already started a new one. A synchronous throw fails the send the same way and is then rethrown to whatever submitted.
- Pass `status` when your chat state reports one: `"submitting"` and `"streaming"` turn Submit into Stop, `"idle"` ends the request, `"error"` fails it. Without a promise the input is ready again at once, and your `status` takes it from there, so it never waits for a request you decided not to send.
- While busy, Submit is Stop: pressing it calls `onStop()` once and announces "Response stopped". Enter never stops and never sends a second message; the draft stays editable. The second click of a double click on Send never stops the reply it just started.

## Keys

Enter sends and Shift+Enter adds a line. `submitKey="mod+enter"` makes Enter a newline and Ctrl+Enter (⌘+Enter on Apple platforms) the send key, which people who write with an input method often prefer; `"none"` leaves sending to the button. With a coarse primary pointer (phones and tablets, `(pointer: coarse)`) Enter is always a newline, and `enterkeyhint` tells the on-screen keyboard which it is.

Every key the input acts on ignores a key that belongs to an input method composition, including the Enter that Safari delivers right after the composition ends. A composition that never ends (a dead key) does not block typing.

A handler on the Textarea that calls `preventDefault()` takes the key: a popup of suggestions on the draft can own Enter, Tab and the arrows while it is open.

## Attachments

Files come from `AttachTrigger` (the native file chooser), a paste of files, or a drop on the Root. `accept` uses the `<input accept>` grammar (MIME types, `image/*`, `.xlsx`) on every path, with `maxFiles` and `maxFileSize`; every refused file goes to `onReject` with its reason and is announced. A paste that also carries text (spreadsheet cells come with a picture of themselves) pastes the text. Attachments are chips: arrow keys move between them, Backspace or Delete removes one, Backspace in an empty draft arms the last one and removes it on the second press, and each removal is announced. Mark an attachment `pending` while it uploads: the input is not submittable until it is done.

The attached files are also in the form's data under `filesName`, next to the text under `name`, so a form action receives both.

## The draft and undo

Without `value`, the Textarea owns its text. The input's own changes (the clear when you send, the prompt put back after a failure, a recalled prompt, `usePromptInput().setValue`) are made as edits, so Ctrl+Z (⌘+Z) brings back what was there. None of them happens while an input method composition is open.

## Field

The Root is a Field: `PromptInput.Label`, `Description` and `ErrorMessage` are its parts, and `invalid` / `errors` on the Root feed it (it is also invalid while over a CharacterCount's max). Inside an enclosing `Field.Root`, the Prompt Input joins it instead: that Field's Label names the Textarea.

## History

Pass `history` (past prompts, newest last): ArrowUp in an empty draft recalls the newest, further presses go back, ArrowDown comes forward and then restores the draft you had. Arrows in a draft you are writing keep moving the caret.

## Character and token limits

`PromptInput.CharacterCount max={…}` shows `used/max` and makes the limit soft: over it the input is invalid and nothing is sent. Pass `count` to count tokens with your tokenizer. The remaining count is announced near and over the limit, after a pause, never while composing.

## `usePromptInput`

Inside the Root, `usePromptInput()` returns the state and the actions a suggestion chip or a menu needs: `setValue`, `insertText`, `submit` (the same checks as Enter), `stop`, `focus`, `openFilePicker` and `addFiles`.

## Accessibility notes

- One Submit button for both actions: its name says what it does now ("Send message", "Stop response") and it never unmounts, so focus is never lost. While nothing can be sent it is `aria-disabled`, still focusable.
- The input announces only what it owns, politely: stop, files attached and removed; a failed send and refused files are assertive. It does not announce the reply: that is the message list's job.
- The Textarea stays enabled while a reply streams, and a status change never moves focus.
- Drag and drop always has the attach button as an alternative.

## Styling

The theme draws a raised card that wraps the attachments, the content-sized draft (up to `--rind-prompt-input-max-block-size`, then it scrolls) and a row with the attach button, the count and a round Submit key whose glyph follows `data-action` (`send` or `stop`). Put your own icons inside `Submit` and `AttachTrigger` to replace the theme's. `data-variant="soft"` on the Root tints the card; `data-size` scales it. Tokens: `--rind-prompt-input-*` (see the token reference).

## Testing

```ts
import { getPromptInput } from "@rind-ui/testing"

const prompt = getPromptInput(screen, { name: "Message" }, { modality: "keyboard" })
await prompt.type("Summarise this")
await prompt.attach([{ name: "report.pdf", type: "application/pdf", content: "…" }])
await prompt.submit()
expect(await prompt.value()).toBe("")
expect(await prompt.state()).toBe("submitting")
```

The driver locates the input by its Textarea's name (a `textbox`, or a `combobox` once a suggestions popup is attached). `submit()` presses Enter (keyboard) or Submit (pointer); `stop()` presses Submit while busy; `attach(files)` selects files as the file chooser does.

## Accessibility tree

The default composer (generated from the state example):

<!-- aria:prompt-input--basic -->
```yaml
- text: Message
- textbox "Message":
  - /placeholder: Ask anything
- button "Attach files"
- button "Send message" [disabled]
```
<!-- /aria -->

## Tested with

<!-- tested-with:prompt-input -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
