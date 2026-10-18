## Purpose

Defines the Prompt Input: a native form where a user writes a prompt in an autosizing
textarea, attaches files, and sends it — or stops the reply — with IME-safe keys, a
submit/stop lifecycle driven by the consumer's callbacks (no model inside), and
announcements for what it changes.

## ADDED Requirements

### Requirement: Anatomy

A Prompt Input SHALL consist of a Root (`<form>`) that renders one visually hidden
`<input type="file">`, an optional Label, an optional Description, exactly one Textarea
(`<textarea>`), exactly one Submit (`<button>`), and the optional parts AttachTrigger
(`<button>`), Attachments, Attachment and AttachmentRemove (the `input-chips` Chips, Chip
and ChipRemove with scope `prompt-input`) and CharacterCount (`<span>`). The Root SHALL act
as a Field for its Label, Description and the Textarea (`use-field-host`, scope
`prompt-input`), or join an enclosing Field. Each part SHALL render one element and accept
`render` to substitute it. Rendering no Textarea, two Textareas, or no Submit SHALL be a
development error.

#### Scenario: Minimal prompt input

- **WHEN** a consumer renders Root, Label "Message", Textarea and Submit
- **THEN** there is a `form` holding a `textbox` named "Message" and a `button` named "Send
  message"

#### Scenario: No nested buttons (ibelick/prompt-kit#109)

- **WHEN** a consumer wraps Submit in a tooltip trigger through `render`
- **THEN** the DOM contains one `button` for Submit and no `button` inside a `button`

### Requirement: Native Form

The Root SHALL be a native `<form>`. Submitting SHALL go through native form submission
(`requestSubmit(submitter)` for keys), so `submit` listeners, constraint validation and
`FormData` behave as for any form. The Textarea SHALL carry the consumer's `name` (default
`"message"`), and the hidden file input SHALL hold the attachments that have a `File`
(assigned through a `DataTransfer`), with the consumer's `filesName` (default `"files"`), so
`new FormData(form)` contains the text and the files. When the consumer gives `onSubmit`,
the Root SHALL prevent the native navigation; when it gives a form `action` instead (React
form actions), the native submission SHALL proceed.

#### Scenario: FormData carries text and files

- **WHEN** a user types "Summarise this", attaches "report.pdf" and presses Enter in a
  Prompt Input whose consumer reads `new FormData(event.currentTarget)` in a `submit`
  listener
- **THEN** the data holds `message` = "Summarise this" and one `files` entry named
  "report.pdf"

### Requirement: Textarea And Autosize

The Textarea SHALL be a native `<textarea>` (role `textbox`, multi-line) and SHALL follow
`autosize-textarea`: `field-sizing: content` where supported, the measured fallback
elsewhere, between `rows` (default 1) and the consumer's `max-block-size`, scrolling above
it. It SHALL forward every native attribute. Its `enterkeyhint` SHALL be `"send"` when a
plain Enter submits and `"enter"` otherwise, unless the consumer sets it.

#### Scenario: Grows, then scrolls (assistant-ui/assistant-ui#4686)

- **WHEN** a user types 30 lines into a Textarea with `max-block-size: 10lh`
- **THEN** it grows to ten lines, then scrolls, with no inline `height` written where
  `field-sizing` is supported

#### Scenario: Enter key hint on a phone

- **WHEN** the Prompt Input renders on a touch-primary device with the default `submitKey`
- **THEN** the Textarea carries `enterkeyhint="enter"`; on a desktop it carries
  `enterkeyhint="send"`

### Requirement: Draft Value

The draft SHALL be a controllable `value` (`value` / `defaultValue` /
`onValueChange(value, details)`), where `details.reason` is `INPUT`, `SUBMIT` (cleared on
send), `RESTORE` (put back after a failed send), `HISTORY` (recalled) or `RESET`, and
`details.isComposing` tells whether a composition is in progress. `onValueChange` SHALL be
called for every `input` event, composing or not. Uncontrolled, the DOM SHALL own the value;
the component SHALL write it only to clear, restore or recall, never while composing, and
through an editing command (`setRangeText` or `insertText`) so the user can undo it where
the platform keeps an undo stack.

#### Scenario: Controlled draft

- **WHEN** a controlled Prompt Input holding "hi" is sent
- **THEN** `onValueChange` is called with `""` and reason `SUBMIT`

#### Scenario: Undo a recall

- **WHEN** a user recalls a previous prompt with ArrowUp in an uncontrolled Prompt Input and
  presses Mod+Z
- **THEN** the draft is empty again

### Requirement: IME Composition

The machine SHALL enter `composing` on `compositionstart` from `idle` and return to `idle`
on `compositionend`, on blur, and on an `input` event with `isComposing: false`, so a
composition that never ends (dead keys) cannot hold the state. In every state the Root and
Textarea SHALL carry `data-composing` while a composition is in progress. Every key that the
Prompt Input acts on (submit, history, attachment arming and removal, focus moves to the
attachments) SHALL apply the `keyboard-interactions` IME guard, which marks `isComposing`,
`keyCode 229` and Safari's committing Enter after `compositionend` as composing. Counting and
count announcements SHALL wait for the commit.

#### Scenario: Japanese conversion Enter (vercel/ai-elements#21)

- **WHEN** a user types "nihongo" with a Japanese IME and presses Enter to commit "日本語"
- **THEN** the Textarea holds "日本語" and `onSubmit` was not called; a second Enter calls
  `onSubmit` once

#### Scenario: Safari late Enter (assistant-ui/assistant-ui#8199, vercel/ai-elements#400)

- **WHEN** Safari fires `compositionend` and then a `keydown` Enter with `isComposing:
  false` that commits the conversion
- **THEN** `onSubmit` is not called

#### Scenario: Dead key does not freeze the input (assistant-ui/assistant-ui#3923)

- **WHEN** a `compositionstart` is never followed by `compositionend` and the user then
  types "a" without composing
- **THEN** `onValueChange` reports the new value, the state is `idle`, and Enter submits

### Requirement: Submit Keys

`submitKey` SHALL choose what submits from the Textarea: `"enter"` (Enter submits,
Shift+Enter inserts a newline), `"mod+enter"` (Mod+Enter submits, Enter inserts a newline)
or `"none"` (only Submit sends). The default SHALL be `"enter"`, except on a touch-primary
device (`Environment` platform: coarse primary pointer), where plain Enter SHALL insert a
newline and only Submit and Mod+Enter send. Mod+Enter SHALL submit in every mode except
`"none"`. A submitting Enter SHALL have its default prevented before the value is read, so
no newline is inserted at the caret. Auto-repeated keys SHALL NOT submit. A key event whose
default a handler before the Prompt Input already prevented (e.g. an open Mentions popup)
SHALL be ignored. Newlines SHALL be the textarea's native behaviour; the Prompt Input
SHALL never insert text on a key.

#### Scenario: Shift+Enter is a newline

- **WHEN** a user types "a", presses Shift+Enter and types "b"
- **THEN** the draft is "a\nb" and nothing was submitted

#### Scenario: Caret in the middle (lobehub/lobehub#9176)

- **WHEN** the draft is "hello world", the caret is after "hello" and the user presses Enter
- **THEN** `onSubmit` receives "hello world" and no newline was inserted

#### Scenario: Ctrl+Enter mode for IME users (vercel/ai-elements#400)

- **WHEN** `submitKey="mod+enter"` and the user presses Enter, then Ctrl+Enter on Windows
- **THEN** Enter inserted a newline and Ctrl+Enter submitted once

#### Scenario: Mobile Enter (assistant-ui/assistant-ui#4091, lobehub/lobehub#1575)

- **WHEN** a user on a touch-primary device presses the on-screen Enter
- **THEN** a newline is inserted and nothing is submitted

#### Scenario: Handled by a popup first

- **WHEN** a consumer `onKeyDown` on the Textarea calls `preventDefault()` on Enter
- **THEN** the Prompt Input does not submit

### Requirement: Submittable

The Prompt Input SHALL be submittable when it is not disabled, its state is `idle`, the
draft contains non-whitespace text or there is at least one attachment, no attachment is
`pending`, and the count is not over a CharacterCount `max`. One guard SHALL decide it, and
every submit path (a key, the Submit button, native form submission, the API) SHALL use it.
A submit that is not submittable SHALL do nothing.

#### Scenario: Enter while streaming (vercel/ai-elements#439)

- **WHEN** the state is `streaming` and the user types "next" and presses Enter
- **THEN** `onSubmit` is not called and the draft is still "next"

#### Scenario: Upload still pending (vercel/ai-elements#185)

- **WHEN** an attachment is marked `pending` and the user presses Enter on a non-empty
  draft
- **THEN** nothing is submitted, and Submit carries `aria-disabled="true"`

#### Scenario: Whitespace only

- **WHEN** the draft is "   " with no attachments and the user presses Enter
- **THEN** nothing is submitted

### Requirement: Lifecycle States

The machine SHALL have the states `idle`, `composing`, `submitting`, `streaming` and
`stopped`. A submit from `idle` SHALL enter `submitting`. The consumer reports the request
through the bound prop `status` (`"idle" | "submitting" | "streaming" | "error"`; the AI
SDK's `ready`/`submitted`/`streaming`/`error` map one to one) and through the promise
`onSubmit` may return:

- `status` `"streaming"` SHALL enter `streaming` from `submitting`;
- `status` `"idle"`, or the promise resolving, SHALL return to `idle` from `submitting`,
  `streaming` or `stopped`;
- `status` `"error"`, a rejected promise or a synchronous throw SHALL run the failure path
  (Requirement: Failed Send) and return to `idle`;
- when `onSubmit` returns no promise and `status` is not given or is still `"idle"` after
  `onSubmit` returns, the machine SHALL return to `idle` at once.

A status change SHALL never move focus. The initial state SHALL follow the initial `status`
(`idle` when absent).

#### Scenario: AI SDK status

- **WHEN** a user sends a prompt and the consumer's `status` goes `submitting`, `streaming`,
  `idle`
- **THEN** the Root's `data-state` goes `submitting`, `streaming`, `idle`

#### Scenario: Promise only

- **WHEN** `onSubmit` returns a promise and no `status` is given
- **THEN** the state is `submitting` until the promise resolves, then `idle`

#### Scenario: Initial status (assistant-ui/assistant-ui#4505)

- **WHEN** the Prompt Input mounts with no `status`
- **THEN** the state is `idle` and Submit is named "Send message"

#### Scenario: Focus stays put (assistant-ui/assistant-ui#8223)

- **WHEN** another text field on the page has focus and `status` becomes `streaming`, then
  `idle`
- **THEN** focus stays on that text field

### Requirement: Submit Contract

A submit SHALL call `onSubmit(message, details)` exactly once, where `message` is `{ text,
attachments }` — the draft and the attachment list as they were at submit time —, and
`details` holds the native `submit` event and the `FormData`. In the same transition the
Prompt Input SHALL clear the draft (reason `SUBMIT`) and the attachments (reason `SUBMIT`),
so text typed or files added while the request is pending belong to the next prompt and are
never cleared later. Text and attachments SHALL be one message, never two calls.

#### Scenario: One call for files without text (assistant-ui/assistant-ui#3577)

- **WHEN** a user attaches "a.png" with an empty draft and presses Submit
- **THEN** `onSubmit` is called once with text "" and one attachment

#### Scenario: Typing while pending is kept (vercel/ai-elements#518)

- **WHEN** a user sends "first", types "second" while the promise is pending, and the
  promise resolves
- **THEN** the draft is "second"

#### Scenario: Key repeat and double click do not double send

- **WHEN** a user holds Enter (auto-repeat) or double-clicks Submit in `idle`
- **THEN** `onSubmit` is called once

### Requirement: Failed Send

When a send fails while `submitting` (Requirement: Lifecycle States), the Prompt Input SHALL
announce `sendFailedAnnouncement` assertively and, if the draft is still empty and there
are no attachments, restore the submitted text (reason `RESTORE`) and attachments (reason
`RESTORE`); otherwise it SHALL keep the new draft. A failure while `streaming` SHALL only
announce. A synchronous throw from `onSubmit` SHALL be rethrown after the failure path.

#### Scenario: Attachments survive a failed send (vercel/ai-elements#126)

- **WHEN** a user sends "look" with "photo.jpg" and the promise rejects
- **THEN** the draft is "look", "photo.jpg" is attached again, and "Message not sent" was
  announced once, assertively

#### Scenario: New draft wins (assistant-ui/assistant-ui#8242)

- **WHEN** a send fails after the user has typed a new draft "other"
- **THEN** the draft is "other" and no attachment of the failed message is restored

### Requirement: Stop

In `submitting` and `streaming`, Submit SHALL act as Stop: activating it SHALL call
`onStop()` once, enter `stopped` and announce `stoppedAnnouncement` politely. `stopped`
SHALL return to `idle` as in Requirement: Lifecycle States, or at once when there is no
`status` and no pending promise. A press whose click count is greater than one (the second
click of a double click) SHALL NOT stop. No key in the Textarea SHALL stop (Escape belongs
to the enclosing layer).

#### Scenario: Stop a reply

- **WHEN** the state is `streaming` and the user presses Submit
- **THEN** `onStop` is called once, the state is `stopped`, and "Response stopped" is
  announced

#### Scenario: Double click on Send does not stop

- **WHEN** a user double-clicks Submit on a submittable draft and the consumer sets
  `status="submitting"` between the clicks
- **THEN** `onSubmit` was called once and `onStop` was not called

#### Scenario: Escape does not stop (assistant-ui/assistant-ui#8199)

- **WHEN** the state is `streaming` and the user presses Escape in the Textarea
- **THEN** `onStop` is not called

### Requirement: Submit Button

Submit SHALL be one native `<button>` that stays mounted in every state. In `idle` and
`composing` it SHALL have `type="submit"`, be named by `sendLabel` and carry
`data-action="send"`; in `submitting`, `streaming` and `stopped` it SHALL have
`type="button"`, be named by `stopLabel` and carry `data-action="stop"`. A consumer
`aria-label` replaces the messages. When the input is not submittable in `idle`, Submit SHALL
carry `aria-disabled="true"`, ignore activation and stay focusable; it SHALL be natively
`disabled` only when the Prompt Input is disabled. In `stopped` it SHALL carry
`aria-disabled="true"` and ignore activation, so `onStop` is never called twice. Pressing it
SHALL NOT move focus.

#### Scenario: Focus survives the swap (assistant-ui/assistant-ui#8208)

- **WHEN** a keyboard user presses Enter on Submit to stop a reply, and the state returns to
  `idle` with an empty draft
- **THEN** focus is still on Submit, which is named "Send message" and carries
  `aria-disabled="true"`

### Requirement: Attachments

Attachments SHALL be a controllable list (`attachments` / `defaultAttachments` /
`onAttachmentsChange(list, details)`, `details.reason` `ADD`, `REMOVE`, `SUBMIT`,
`RESTORE`) of `PromptAttachment` items `{ id, name, file?, type?, size?, pending?,
disabled? }`, generic over consumer fields. They SHALL be rendered with `input-chips`
(Attachments = Chips, `role="toolbar"`, labelled by `attachmentsLabel`; Attachment = Chip,
named by the attachment's `name`; AttachmentRemove = ChipRemove, named
`removeLabel(name)`), placed in the Root, with the `input-chips` keyboard between the
Textarea and the chips (ArrowLeft at the caret start, Backspace arm-then-remove on an empty
draft). An Attachment SHALL carry `data-pending` while `pending`. Attachments SHALL be
inert data: an Attachment has no activation of its own, so it is not announced as a button.

#### Scenario: Chips named by file (assistant-ui/assistant-ui#7268)

- **WHEN** "q1.pdf" and "q2.pdf" are attached
- **THEN** a `toolbar` named "Attachments" holds two focusable chips named "q1.pdf" and
  "q2.pdf", neither with role `button`, with buttons "Remove q1.pdf" and "Remove q2.pdf"

#### Scenario: Backspace arms first

- **WHEN** the draft is empty, "a.png" is attached and the user presses Backspace once
- **THEN** "a.png" is highlighted and still attached; a second Backspace removes it

### Requirement: Adding Files

Files SHALL be added through three paths, each producing one `onAttachmentsChange` call
(reason `ADD`) per gesture with every accepted file:

- **AttachTrigger**: a `button` named `attachLabel` that opens the native file chooser of the
  hidden file input (`accept` and `multiple` from the Root); after each pick the input's
  selection SHALL be reset so picking the same file again works.
- **Paste** into the Textarea: when the clipboard holds files (`clipboardData.files`, else
  `items` of kind `file`) and no non-empty `text/plain`, the files SHALL be added and the
  paste's default prevented; otherwise the paste SHALL be the native text paste. A consumer
  `onPaste` that prevents the default SHALL win.
- **Drop** on the Root: only drags whose `dataTransfer.types` include `"Files"` SHALL be
  accepted; `dragover` SHALL prevent the default so the drop does not navigate the tab;
  the Root SHALL carry `data-dragging` from the first `dragenter` until the drag leaves the
  Root (by `relatedTarget` containment) or drops.

Disabled, `maxFiles` reached, or no AttachTrigger and `acceptDrop={false}` SHALL refuse the
path. Drop SHALL never be the only way to attach: AttachTrigger is the non-drag alternative.

#### Scenario: Paste a screenshot (vercel/ai-elements#104, lobehub/lobehub#4098)

- **WHEN** a user pastes a clipboard image in Chromium, Firefox and WebKit
- **THEN** in each engine one attachment is added and no text is inserted

#### Scenario: Paste spreadsheet cells (vercel/ai-elements#509)

- **WHEN** the clipboard holds Excel cells as `text/plain`, `text/html` and a picture file
- **THEN** the text is pasted into the Textarea and no attachment is added

#### Scenario: Pick the same file twice (vercel/ai-elements#254)

- **WHEN** a user picks "a.txt", removes it, and picks "a.txt" again
- **THEN** "a.txt" is attached again

#### Scenario: Drop over a child

- **WHEN** a file drag enters the Root, moves over the Textarea, and is dropped there
- **THEN** `data-dragging` stays on the Root until the drop, and the file is attached once

### Requirement: File Validation

The Root SHALL accept `accept` (the same syntax as `<input accept>`: MIME types, `type/*`
wildcards and `.ext` extensions, case-insensitive), `maxFiles` and `maxFileSize`, and apply
them to every path. Each rejected file SHALL be reported to `onReject(rejections)` with a
reason `ACCEPT`, `MAX_FILES` or `MAX_SIZE`, and announced assertively
(`rejectedAnnouncement(name, reason)`, or `rejectedCountAnnouncement(n)` for several), also
when other files of the same gesture were accepted.

#### Scenario: Extension accept (vercel/ai-elements#501)

- **WHEN** `accept=".xlsx"` and the user picks "q3.xlsx"
- **THEN** "q3.xlsx" is attached

#### Scenario: Mixed selection (vercel/ai-elements#511)

- **WHEN** `maxFileSize` is 1 MB and the user drops "small.png" (10 KB) and "huge.mov" (2 GB)
- **THEN** "small.png" is attached, `onReject` receives "huge.mov" with `MAX_SIZE`, and "huge.mov
  is too large" is announced

### Requirement: Attachment Removal

An attachment SHALL be removed by AttachmentRemove, by Backspace or Delete on its chip, or by
Backspace on an empty draft (armed first), each through one `onAttachmentsChange` call
(reason `REMOVE`) by `id`; a second request for an id already removed SHALL do nothing. Focus
SHALL follow `input-chips` (next chip, else previous, else the Textarea) and the removal
SHALL be announced (`removedAnnouncement(name)`). A `disabled` attachment SHALL not be
removable by the user.

#### Scenario: Remove by button

- **WHEN** a user presses "Remove q1.pdf" with "q1.pdf" and "q2.pdf" attached
- **THEN** one `onAttachmentsChange` call removes "q1.pdf", focus is on "q2.pdf" and "q1.pdf
  removed" is announced

#### Scenario: Removed twice (assistant-ui/assistant-ui#8360)

- **WHEN** a pointer press and a key both request removal of "q1.pdf" before the consumer
  updates
- **THEN** `onAttachmentsChange` is called once for it

### Requirement: Disabled And Busy

`disabled` on the Root SHALL disable every part: the Textarea, Submit, AttachTrigger and the
file input SHALL be natively disabled, paste and drop SHALL add nothing, and chips SHALL not
be removable. Busy (`submitting`, `streaming`, `stopped`) SHALL NOT disable anything: the
Textarea stays enabled and editable, attachments can be added and removed for the next
prompt, and only submitting is blocked. `readOnly` on the Textarea SHALL be forwarded and
SHALL block paste and drop of files as well as typing.

#### Scenario: Disabled thread (assistant-ui/assistant-ui#9164, #1751)

- **WHEN** the Root is `disabled`
- **THEN** the Textarea, Submit and AttachTrigger are disabled and a drop adds no file

#### Scenario: Type the next prompt while a reply streams

- **WHEN** the state is `streaming` and the user types "next"
- **THEN** the Textarea holds "next" and is not disabled

### Requirement: Character And Token Limit

CharacterCount SHALL follow Text Field's "Character Count" requirement (soft `max`, count
function, threshold announcements, the count in the Textarea's description), with
`count(value)` defaulting to Text Field's `defaultCount` so a consumer can pass a token
counter. Over the `max`, the Prompt Input SHALL not be submittable, Root and CharacterCount
SHALL carry `data-over-limit`, and the Textarea SHALL carry `aria-invalid="true"`. A hard
limit SHALL be the native `maxLength`, forwarded.

#### Scenario: Token limit

- **WHEN** CharacterCount has `max={8}` and `count={tokenize}`, and the draft is 9 tokens
- **THEN** Enter does not submit, Submit carries `aria-disabled="true"`, and the remaining
  count was announced once after the user paused

### Requirement: History Recall

When the consumer gives `history` (past prompts, newest last), ArrowUp in the Textarea with
an empty draft and the caret at the start SHALL replace the draft with the newest entry
(reason `HISTORY`), and further ArrowUp presses, with the caret at the start, SHALL step to
older entries. ArrowDown with the caret at the end SHALL step to newer entries and, past the
newest, restore the draft the user had before recalling. Recall SHALL be ignored with any
modifier, while composing, when the key's default was prevented, when the Textarea has
`aria-expanded="true"` (a Mentions popup), and with a non-empty draft that is not a recalled
entry. Without `history` the arrows SHALL be native.

#### Scenario: Recall and return

- **WHEN** `history` is ["one", "two"], the draft is empty, and the user presses ArrowUp
  twice, then ArrowDown twice
- **THEN** the draft goes "two", "one", "two", ""

#### Scenario: Multi-line draft keeps the arrows (lobehub/lobehub#9224)

- **WHEN** the draft is "a\nb", the caret is on line 2 and the user presses ArrowUp
- **THEN** the caret moves to line 1 and the draft is unchanged

### Requirement: Focus

A press on the Root outside any interactive element or text selection SHALL focus the
Textarea. After a submit by key, focus SHALL stay in the Textarea; after a press on Submit,
on Submit. No status change SHALL move focus. `autoFocus` on the Textarea SHALL be forwarded;
the Prompt Input SHALL never focus itself otherwise.

#### Scenario: Click the padding (ibelick/prompt-kit#55)

- **WHEN** a user clicks the Root's padding below the Textarea
- **THEN** the Textarea has focus

### Requirement: Naming

The Textarea's accessible name SHALL come from the Label, an `aria-label` or an
`aria-labelledby`; the placeholder SHALL never be its only name (development warning). The
Description and the CharacterCount SHALL be in its `aria-describedby`. The Root SHALL have no
role or name of its own unless the consumer names it (then it is a `form` landmark).

#### Scenario: Placeholder only

- **WHEN** a Textarea has `placeholder="Ask anything"` and no label
- **THEN** a development warning names the missing label

### Requirement: Announcements

The Prompt Input SHALL announce through the injected Announcer only: `stoppedAnnouncement`
(polite), `sendFailedAnnouncement` (assertive), `attachedAnnouncement(name)` /
`attachedCountAnnouncement(n)` (polite, once per gesture), rejections (assertive),
`removedAnnouncement(name)` (polite) and the count (Text Field's rules). It SHALL NOT
announce a submit, the reply or its progress (Streaming Message and Message Thread own
them), SHALL NOT announce while composing, and SHALL render no `aria-live` region of its
own.

#### Scenario: One announcement per gesture

- **WHEN** a user drops three accepted files
- **THEN** "3 files attached" is announced once

#### Scenario: Nothing on send

- **WHEN** a user sends a prompt and the reply streams and completes
- **THEN** the Prompt Input made no announcement

### Requirement: Messages

Every string the Prompt Input sends to assistive technology SHALL come from typed messages
with English defaults: `sendLabel` ("Send message"), `stopLabel` ("Stop response"),
`attachLabel` ("Attach files"), `attachmentsLabel` ("Attachments"), `stoppedAnnouncement`
("Response stopped"), `sendFailedAnnouncement` ("Message not sent"),
`attachedAnnouncement(name)` ("{name} attached"), `attachedCountAnnouncement(n)` ("{n} files
attached", plural rules), `rejectedAnnouncement(name, reason)` ("{name} is too large", "{name}
is not an accepted file type", "{name} not attached: too many files"),
`rejectedCountAnnouncement(n)`, and the `input-chips` keys (`removeLabel`,
`removedAnnouncement`, `chipsLabel` defaulting to `attachmentsLabel`, `tagsSummary` with the
default "2 attachments: q1.pdf, q2.pdf" and no summary node when empty) and Text Field's
count keys, under the same names and defaults.

#### Scenario: Translated once

- **WHEN** an app passes `removeLabel: (t) => \`Rimuovi ${t}\`` to a Tags Input and a Prompt
  Input
- **THEN** both name their remove buttons "Rimuovi …"

### Requirement: Composition With Mentions And Suggestions

The Prompt Input SHALL expose the seams later components use, without depending on them:

- key handlers that run before its own (consumer `onKeyDown` on the Textarea) and whose
  `preventDefault()` makes it ignore the key (Requirement: Submit Keys, History Recall), so a
  Mentions / Slash Commands popup can own Enter, Tab, Escape and the arrows while open;
- a Textarea whose role may become `combobox` (with `aria-expanded`, `aria-controls`,
  `aria-activedescendant` set by the composing component) with every Prompt Input behaviour
  unchanged;
- an API from the machine (`setValue(text, reason)`, `insertText(text)` at the caret,
  `submit()`, `focus()`) that Suggestions calls to fill or send a prompt, going through the
  same guard and announcements as the user's actions.

#### Scenario: A popup owns Enter

- **WHEN** a consumer component on the Textarea handles Enter (prevents the default) to
  choose a highlighted mention
- **THEN** nothing is submitted, and the next Enter, not handled, submits

#### Scenario: Suggestion sends

- **WHEN** a consumer button calls `api.submit()` after `api.setValue("Explain this")` in
  `streaming`
- **THEN** nothing is submitted (not submittable) and the draft is "Explain this"

### Requirement: Prompt Input Data Attributes

Every part SHALL carry `data-scope="prompt-input"`, its `data-part` (`root`, `label`,
`description`, `textarea`, `submit`, `attach-trigger`, `chips`, `chip`, `chip-remove`,
`chips-summary`, `character-count`) and `data-instance`. Root and Textarea SHALL carry
`data-state` (`idle`, `composing`, `submitting`, `streaming`, `stopped`), `data-empty` while
the draft is empty, `data-composing`, `data-disabled`, `data-over-limit`, `data-focus` and
`data-focus-visible`; the Root SHALL carry `data-dragging` during a file drag and
`data-has-attachments` when there are attachments. Submit SHALL carry `data-state`,
`data-action` (`send` | `stop`) and `data-disabled` when not submittable in `idle`. Chips
SHALL carry the `input-chips` attributes and `data-pending`. `data-variant` and `data-size`
SHALL be passed through untouched.

#### Scenario: Styling the stop icon

- **WHEN** the state is `streaming`
- **THEN** Submit carries `data-state="streaming"` and `data-action="stop"`

### Requirement: Prompt Input Contract

The contract SHALL use scope `prompt-input`, locate the instance by the Textarea's roles
`textbox` and `combobox` and its exact accessible name, include the `input-chips` contract
fragment, and declare:

- actions: `type(text)`; `fill(text)`; `compose(text, committed)` (pointer: none,
  "composition is keyboard input"); `submit` (keyboard: Enter, or Mod+Enter in
  `"mod+enter"` mode; pointer: press Submit); `stop` (pointer: press Submit; keyboard: focus
  Submit and press Enter); `attach(files)` (pointer: AttachTrigger and the file chooser;
  keyboard: focus AttachTrigger, Enter, file chooser); `paste(files | text)`; `drop(files)`
  (keyboard twin: `attach`); `removeAttachment(name)` (the fragment's `removeChip`);
  `recall(direction)` (ArrowUp / ArrowDown; pointer: none, "a key");
- queries: `value`, `name`, `state`, `attachments` (names in order), `canSubmit`,
  `submitName`, `submitAction`, `characterCount`, `isOverLimit`, `isDisabled`,
  `isDragging`;
- states: `idle`, `composing`, `submitting`, `streaming`, `stopped`;
- events mapped to actions, with `$sync:status`, `$sync:value` and `$sync:attachments` prop
  steps (the fixture's consumer drives `status`), `FOCUS`/`BLUR` `skip` ("covered by every
  action");
- announcements: stop, failure, add, reject, remove;
- traits: `field-associated`.

The postcondition of `submit` SHALL be that the fixture's `onSubmit` was called once and the
draft is empty; of `stop`, that `onStop` was called once and `state` is `stopped` or `idle`.

#### Scenario: Same test in both environments

- **WHEN** `getPromptInput(screen, { name: "Message" }).fill("hi")` then `.submit()` runs in
  Testing Library and the same code with a Playwright `page`
- **THEN** both resolve with `value()` equal to `""` and one recorded `onSubmit("hi")`

#### Scenario: IME invariant catches a bad wrapper

- **WHEN** a consumer wrapper submits on every Enter keydown and `testMachine` runs
- **THEN** the "IME Never Commits" replay fails naming Enter and the submit transition

### Requirement: Model-Based Coverage

`testMachine` SHALL run the Prompt Input over the props classes default, `"mod+enter"`,
touch-primary, with attachments (`accept`, `maxFiles`, `maxFileSize`), with CharacterCount,
with `history`, and disabled, against fixtures whose `onSubmit` resolves, rejects, and drives
`status` through `submitting` and `streaming`, in pointer, keyboard and virtual modalities,
with axe per state.

#### Scenario: Lifecycle across fixtures

- **WHEN** the resolving, rejecting and status-driven fixtures run
- **THEN** each reaches every state its fixture allows, and no step leaves focus on `<body>`

### Requirement: Theme

`packages/theme/src/prompt-input.css` SHALL follow the stylesheet convention of
`add-theme-system` (`@layer rind.components`, `:where()` selectors, `--rind-prompt-input-*`
tokens read with a semantic fallback and never declared), set `field-sizing: content` on the
Textarea with `min-block-size` from `rows` and a `max-block-size` token, place Submit and
AttachTrigger in the button family (`data-variant`, `data-size`), style `data-tone="danger"`
and `data-over-limit`, show `data-dragging` with a non-colour cue (outline style), keep every
pressable at least 24×24 CSS px, keep AttachmentRemove visible without hover (on
`data-focus-visible` and on touch), draw focus as an outline, and animate no height.

#### Scenario: Remove button on touch (vercel/ai-elements#507)

- **WHEN** an attachment chip is shown on a device without hover, and when its remove button
  has keyboard focus
- **THEN** the remove button is visible in both cases

#### Scenario: Forced colors

- **WHEN** the Prompt Input is focused, over its limit and dragging under `forced-colors:
  active`
- **THEN** the focus ring, the over-limit state and the drag state are each visible without
  relying on colour
</content>
</invoke>
