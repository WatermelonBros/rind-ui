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
<!-- /api -->

## The send/stop contract

- `onSubmit({ text, attachments }, { event, formData })` is called **once** per send, with the draft and the attachments as they were. Both clear at once, so what the user types while the request runs is the next prompt and is never cleared later.
- Return a promise to stay `submitting` until it settles. A rejected promise (or a thrown error) is a failed send: "Message not sent" is announced and the prompt comes back, unless the user has already started a new one.
- Pass `status` when your chat state reports one: `"submitting"` and `"streaming"` turn Submit into Stop, `"idle"` ends the request, `"error"` fails it. Without `status` and without a promise, the input is ready again at once.
- While busy, Submit is Stop: pressing it calls `onStop()` once and announces "Response stopped". Enter never stops and never sends a second message; the draft stays editable. The second click of a double click on Send never stops the reply it just started.

## Keys

Enter sends and Shift+Enter adds a line. `submitKey="mod+enter"` makes Enter a newline and Ctrl+Enter (⌘+Enter on Apple platforms) the send key, which people who write with an input method often prefer; `"none"` leaves sending to the button. On phones and tablets Enter is always a newline, and `enterkeyhint` tells the on-screen keyboard which it is.

Every key the input acts on ignores a key that belongs to an input method composition, including the Enter that Safari delivers right after the composition ends. A composition that never ends (a dead key) does not block typing.

A handler on the Textarea that calls `preventDefault()` takes the key: a popup of suggestions on the draft can own Enter, Tab and the arrows while it is open.

## Attachments

Files come from `AttachTrigger` (the native file chooser), a paste of files, or a drop on the Root. `accept` uses the `<input accept>` grammar (MIME types, `image/*`, `.xlsx`) on every path, with `maxFiles` and `maxFileSize`; every refused file goes to `onReject` with its reason and is announced. A paste that also carries text (spreadsheet cells come with a picture of themselves) pastes the text. Attachments are chips: arrow keys move between them, Backspace or Delete removes one, Backspace in an empty draft arms the last one and removes it on the second press, and each removal is announced. Mark an attachment `pending` while it uploads: the input is not submittable until it is done.

The attached files are also in the form's data under `filesName`, next to the text under `name`, so a form action receives both.

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
<!-- /aria -->

## Tested with

<!-- tested-with:prompt-input -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
