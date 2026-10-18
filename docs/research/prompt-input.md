# Prompt Input — research

Status: done · Wave: AI (the first AI-UI primitive; builds on Text Field's autosize, the
IME guard, the announcer and `input-chips`)

The box where a user writes a prompt: a multi-line text draft, files attached by picker,
paste or drop, and one button that sends or, while a reply is on its way, stops it. No model
inside: the consumer sends the request and reports its status; the component owns the keys,
the draft, the attachments, the submit/stop lifecycle and what assistive technology hears.

Cross-cutting: [accessibility.md](accessibility.md) §6 (IME is a machine guard; Safari's
late Enter), §7.4–7.5 (Announcer; status changes are short separate announcements, the
reply itself belongs to Streaming Message), rules 18, 21, 23–25;
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) §1.2 D (live
regions), J (mobile ATs send no keys); [native-platform.md](native-platform.md) §11
(`field-sizing: content`, use with fallback) and §12 (EditContext: avoid; build on
`<textarea>`). Siblings: [text-field.md](text-field.md) (autosize module, count, IME rules),
[tags-input.md](tags-input.md) / `input-chips` (removable items next to a text input).

## Pattern

- WAI-ARIA APG pattern: none. It is a form: a named multi-line `textbox` (native
  `<textarea>`), a submit `button`, optional file `button`s and a group of removable
  attachments. With Mentions / Slash Commands attached later the textarea becomes a
  `combobox` (APG Combobox, `aria-autocomplete="list"`).
- Roles and attributes: `<form>` root (a landmark only if the consumer names it);
  `<textarea>` named by a visible label or `aria-label` (placeholder is not a name, 3.3.2);
  `enterkeyhint` matching what Enter does; Submit is one `<button>` whose name says what it
  will do now ("Send message" / "Stop response"); attachments are chips (toolbar, roving,
  "Remove *name*" buttons, `input-chips`).
- Keyboard (common denominator of AI Elements, assistant-ui, LobeChat, ChatGPT, Claude):

| Key | Where | Action |
|---|---|---|
| Enter | textarea, not composing, desktop | submit if submittable; never while busy |
| Shift+Enter | textarea | newline (native) |
| Mod+Enter | textarea | submit (in every mode except "none"; the IME-friendly shortcut) |
| Enter | textarea, touch-primary device | newline; send with the button |
| Enter / Space | Submit | send, or stop while busy |
| ArrowUp | textarea, empty draft, caret at start | recall the previous prompt (opt-in history) |
| ArrowDown | textarea, recalled entry, caret at end | newer entry, then back to the saved draft |
| Backspace | textarea, empty, caret at start | arm, then remove, the last attachment (`input-chips`) |
| ArrowLeft | textarea, caret at start | focus the last attachment (`input-chips`) |
| Any acting key | while composing | nothing (`keyboard-interactions` IME guard) |

## How the others built it

### Vercel AI Elements (`PromptInput`)

- Source: [packages/elements/src/prompt-input.tsx](https://github.com/vercel/ai-elements/blob/main/packages/elements/src/prompt-input.tsx)
  (1463 lines).
- API: `PromptInput` (a `<form>` + hidden `<input type=file>`; `accept`, `multiple`,
  `globalDrop`, `maxFiles`, `maxFileSize`, `onError({code})`, `onSubmit({text, files},
  event)`), `PromptInputTextarea` (`name="message"`, Tailwind `field-sizing-content max-h-48
  min-h-16`), `PromptInputSubmit` (`status: ChatStatus`, `onStop`), header/footer/tools,
  action menu, select, hover card, tabs; optional `PromptInputProvider` lifts text and
  attachments to a context.
- State: no machine. `isComposing` from composition events **or** `nativeEvent.isComposing`;
  Enter without Shift → `form.requestSubmit()` unless `button[type=submit]` is disabled.
  Submit button: `type="submit"` normally, `type="button"` + `onStop` while
  `submitted`/`streaming`; `aria-label` "Submit" / "Stop". Submit reads `FormData`, calls
  `form.reset()` **before** awaiting (to keep text typed during blob → data-URL
  conversion), then clears attachments on success, keeps them on a thrown error.
- Notable: native `<form>` + `requestSubmit` + `FormData`; `field-sizing: content`;
  `URL.createObjectURL` previews revoked on remove/clear/unmount; Backspace on an empty
  textarea removes the last attachment; paste collects `kind === "file"` items.
- Problems: no `keyCode 229`/Safari late Enter (#400, #21); the submit guard asks the DOM
  for a submit button, which is `null` while streaming, so **Enter sends during streaming**
  (#439, #185); paste attaches Excel's picture instead of the cells' text (#509); `accept`
  extensions never match the JS filter (#501); partial rejections are silent (#511); a
  successful async submit clears text typed while pending (#518); attachments cleared on a
  failed submit (#126); remove button invisible on focus/touch (#507); Backspace removal is
  immediate and unannounced.

### assistant-ui (`ComposerPrimitive`)

- Source: [packages/react/src/primitives/composer/](https://github.com/assistant-ui/assistant-ui/tree/main/packages/react/src/primitives/composer)
  — `ComposerInput.tsx` (500 lines, on `react-textarea-autosize`), `ComposerSend.ts`,
  `ComposerCancel.ts`, `ComposerAttachments.tsx`, `ComposerAttachmentDropzone.tsx`,
  `useComposerCancelWithFocus.ts`; [utils/isCompositionKey.ts](https://github.com/assistant-ui/assistant-ui/blob/main/packages/react/src/utils/isCompositionKey.ts).
- API: `Root` (form), `Input` (`submitMode: "enter" | "ctrlEnter" | "none"`,
  `unstable_insertNewlineOnTouchEnter`, `cancelOnEscape`, `addAttachmentOnPaste`, focus
  options), `Send`, `Cancel`, `AddAttachment`, `Attachments`, `AttachmentDropzone`, `If`
  (render by state), `Queue`, trigger popovers (mentions / slash).
- State: a runtime store (`thread.isRunning`, `composer.canSend`, capabilities). `Send` and
  `Cancel` are separate buttons; `Send` returns `null` (disabled) when it cannot send.
  Enter is ignored while running unless the runtime supports a queue;
  Cmd/Ctrl+Shift+Enter "steers" a queued message.
- Notable: `isCompositionKey = isComposing || keyCode === 229` with the Safari comment;
  plugins (mention, slash) get every key first; Escape asks plugins first, then cancels;
  the dropzone only reacts to `dataTransfer.types.includes("Files")` and prevents the
  default so a stray drop does not navigate the tab; `data-dragging`; touch-primary
  detection by media query.
- Problems: see Bug history — a stuck composition flag froze the input (#3923), Safari IME
  Enter sent and IME Escape cancelled the reply (#8199, #8319), Send stayed enabled on a
  disabled thread (#9164), an empty-text + attachment send went out twice (#3577),
  attachment removal during or after a failed send (#8242, #8350, #8360), focus dropped to
  `<body>` on cancel (#8208), a run start stole focus from another field (#8223),
  attachment tiles with button semantics that do nothing (#7268).

### prompt-kit (`PromptInput`)

- Source: [components/prompt-kit/prompt-input.tsx](https://github.com/ibelick/prompt-kit/blob/main/components/prompt-kit/prompt-input.tsx)
  (233 lines).
- API: `PromptInput` (`isLoading`, `value`, `onValueChange`, `maxHeight`, `onSubmit`,
  `disabled`), `PromptInputTextarea` (`disableAutosize`), `PromptInputActions`,
  `PromptInputAction` (tooltip).
- Autosize: `height = "auto"` then `min(scrollHeight, maxHeight)` in a layout effect on the
  real textarea (the classic scroll-jump technique).
- Problems: Enter && !Shift submits with **no IME guard**; `isLoading` does not block
  Enter; tooltip trigger wraps a button in a button (#109); clicking the padding does not
  focus the textarea (#55).

### shadcn chatbot kit (`MessageInput`)

- Source: [apps/www/registry/default/ui/message-input.tsx](https://github.com/Blazity/shadcn-chatbot-kit/blob/main/apps/www/registry/default/ui/message-input.tsx),
  [hooks/use-autosize-textarea.ts](https://github.com/Blazity/shadcn-chatbot-kit/blob/main/apps/www/registry/default/hooks/use-autosize-textarea.ts).
- Notable: Enter while generating shows an "interrupt" prompt and a second Enter stops;
  separate Send / Stop buttons (`aria-label` "Send message" / "Stop generating"), Send
  disabled while generating; pasting more than 500 characters becomes a `text/plain` file
  attachment; drop zone overlay.
- Problems: no IME guard; the interrupt path calls submit twice (#11); textarea named only
  by `aria-label`.

### LobeChat / LobeHub (`ChatInput`)

- Source: [src/features/ChatInput/hooks/useChatInputHistory.ts](https://github.com/lobehub/lobehub/blob/main/src/features/ChatInput/hooks/useChatInputHistory.ts);
  the input itself is now `@lobehub/editor` (Lexical, `contenteditable`).
- Notable: **history recall**: ArrowUp opens a popup of past prompts **only when the input
  is empty**, ignored with any modifier, when `defaultPrevented`, or while composing
  (`event.isComposing || isComposingRef`); ArrowDown past the newest closes it; any other
  key closes it and types; the recalled document is set with `keepHistory: true` (undo
  survives). Send key configurable (Enter / Ctrl+Enter, #748, #1183).
- Problems (mostly from the rich-text move): Chinese IME single characters lost on Enter
  with Fcitx5 (#7510), repeated characters while typing Chinese (#9281), Alt sends with a
  Chinese IME on Linux (#7810), Enter with the caret mid-text splits the message (#9176),
  ArrowUp/Down sticky in multi-line drafts (#9224), mobile cannot pick the send key
  (#1575), Safari cannot paste clipboard images (#4098, #7381) and pastes a file path
  instead (#571).

### OpenAI ChatGPT and Claude.ai (closed source; observed in the shipped web apps)

- Both use a ProseMirror `contenteditable` with a textarea fallback, not a plain textarea.
  One send button with a state-dependent name ("Send prompt" ↔ "Stop streaming" in
  ChatGPT; "Send message" ↔ "Stop response" in Claude); empty draft → Send disabled.
  Desktop: Enter sends, Shift+Enter newline; mobile web: Enter is a newline. The draft
  clears at send time; the text area stays editable during a reply, and Enter does not
  queue a second message. Claude turns a long paste into a "Pasted content" attachment.
- IME: long-standing user reports that Enter which confirms a Japanese conversion sends the
  message, and requests for a configurable send key
  ([OpenAI community](https://community.openai.com/t/chatgpt-atlas-configurable-enter-key-behavior-for-ime-users/1380064);
  userscripts and extensions exist only to fix it); the same class of bug in Cursor
  ([forum](https://forum.cursor.com/t/japanese-ime-input-causes-unintended-chat-submission-when-pressing-enter-key-in-browser-version-agent/132905)),
  waveterm ([#2385](https://github.com/wavetermdev/waveterm/issues/2385)).

### Textarea autosize: react-textarea-autosize and `field-sizing: content`

- Source: [react-textarea-autosize src/calculateNodeHeight.ts](https://github.com/Andarist/react-textarea-autosize/blob/main/src/calculateNodeHeight.ts),
  `src/index.tsx`. Measures in a **hidden clone** textarea appended to `body` (copies the
  sizing styles, sets the value twice for Firefox bmo 1795904, measures one row with "x"),
  so the real textarea never goes through `height: auto` (no scroll jump); resizes on
  layout effect, window resize, font load and form reset.
- Open problems: page scrolls up while typing in zoomed Safari
  ([#356](https://github.com/Andarist/react-textarea-autosize/issues/356)), caret row not
  scrolled into view past `maxRows` ([#142](https://github.com/Andarist/react-textarea-autosize/issues/142)),
  no update on width change without a re-render ([#389](https://github.com/Andarist/react-textarea-autosize/issues/389)),
  forced reflows on each keystroke ([#422](https://github.com/Andarist/react-textarea-autosize/issues/422)),
  scrollbars at non-100% zoom ([#423](https://github.com/Andarist/react-textarea-autosize/issues/423)),
  shrink after form reset ([#345](https://github.com/Andarist/react-textarea-autosize/issues/345)),
  placeholder sizing ([#245](https://github.com/Andarist/react-textarea-autosize/issues/245)).
- `field-sizing: content` (native-platform §11) has none of these: no JS, no reflow loop,
  the browser keeps the caret in view. Baseline 2026 (Chrome 123, Firefox 152, Safari 26.2).
  rind already ships the fallback (`autosize-textarea`, `core/dom/autosize.ts`) for older
  engines.

## Accessibility

- **Name**: the textarea needs a label (visible Label part or `aria-label`); dev warning
  without one. Placeholder is a hint only. The form is a landmark only when named, which
  the consumer chooses (one composer per page: name it; many in a thread: don't).
- **Submit/stop**: one button, so focus never lands on a button that unmounts (two swapping
  buttons drop focus to `<body>` — rule 11, aui#8208). Its name is the action it performs
  now; the state is also on `data-action`. Never natively `disabled` while it may hold
  focus (a disabled focused button loses focus): `aria-disabled="true"` and activation
  ignored (rule 22, `focusableWhenDisabled`). The second click of a double click
  (`detail > 1`) never turns a send into a stop.
- **Status announcements** (§7.5, WCAG 3 "submission status notified"): Prompt Input
  announces only what it owns, through the injected Announcer: "Response stopped" (polite),
  a failed send (assertive: an error), attachments added / removed / rejected (rejected is
  an error → assertive). It does **not** announce the reply or "Assistant is responding"
  (Streaming Message / Message Thread own those) and renders no `aria-live` of its own
  (rule 23).
- **Limits**: count and announcements reuse Text Field's rules (GOV.UK pattern: polite,
  keyed, near and over the limit, never while composing); the count is in the textarea's
  description. A token limit is the same with a consumer `count` function.
- **Attachments**: `input-chips` — `toolbar` keeps NVDA in focus mode; each chip named by
  the file name (two "image.png" chips get the position: "image.png, 2 of 2" via the
  consumer's label is their call — names must be distinct, aui#7268); "Remove *name*"
  buttons out of the Tab order; focus after removal to the next chip, else the previous,
  else the textarea; removal announced.
- **Drag and drop** (2.5.7, rule 21): the attach button with a native file chooser is the
  non-drag alternative; dropping is never the only way.
- **IME** (§6, rule 18): no submit, recall, removal or stop on a composing key; Safari's
  late Enter is marked composing by `core/dom/keyboard.ts`; a composition that never ends
  (dead keys, blur mid-composition) must not freeze anything (aui#3923): the composing
  state ends on `compositionend`, on blur, and on any `input` event with `isComposing:
  false`.
- **Mobile**: on-screen keyboards often send `keyCode 229` for every key (Android) and
  touch screen readers send no keys at all (§1.2 J): everything reachable by a button;
  Enter = newline on touch-primary devices, `enterkeyhint` says so.
- **Busy**: the textarea stays enabled and editable while a reply streams (a disabled
  textarea loses focus and its text cannot be read); no `aria-busy` on it.
- **Forced colors / motion**: border and focus ring visible; no animated height.

## Bug history

All issues read, open and closed.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| AI Elements | [#21](https://github.com/vercel/ai-elements/issues/21) | Japanese input impossible: every conversion Enter submits | no composition check | closed (isComposing state) | IME guard on the submit transition |
| AI Elements | [#400](https://github.com/vercel/ai-elements/issues/400) | Enter right after an IME commit still submits; Japanese users want Ctrl+Enter | only `isComposing` checked; Enter hard-coded | open | `keyboard-interactions` guard (229 + Safari); `submitKey` "mod+enter" |
| assistant-ui | [#8199](https://github.com/assistant-ui/assistant-ui/issues/8199) | Safari: IME Enter sends, IME Escape cancels the reply | late keydown after `compositionend` | closed (`isCompositionKey`) | same guard on stop and every key |
| assistant-ui | [#8319](https://github.com/assistant-ui/assistant-ui/issues/8319) | same in the Lexical, Vue and Svelte composers | guard per adapter | closed | guard in the machine, once |
| assistant-ui | [#3923](https://github.com/assistant-ui/assistant-ui/issues/3923) | input frozen after a dead key (German layout) | `compositionend` never fired; `onChange` gated on a stuck flag | closed | never gate value changes on composition; end composing on blur / non-composing input |
| assistant-ui | [#4506](https://github.com/assistant-ui/assistant-ui/issues/4506) / [#4510](https://github.com/assistant-ui/assistant-ui/issues/4510) | RN input interrupts / submits IME composition | value written back mid-composition | closed | no value writes while composing |
| LobeHub | [#7510](https://github.com/lobehub/lobehub/issues/7510), [#9281](https://github.com/lobehub/lobehub/issues/9281), [#7810](https://github.com/lobehub/lobehub/issues/7810) | Fcitx5 single characters lost on Enter; repeated characters; Alt sends | editor handling of IME commits | closed | Linux IMEs in the manual matrix; plain textarea |
| AI Elements | [#439](https://github.com/vercel/ai-elements/issues/439) | Enter sends a new message while streaming | guard queried `button[type=submit]`, which was `type=button` while streaming | open | the "can submit" guard is machine state, not DOM |
| AI Elements | [#185](https://github.com/vercel/ai-elements/issues/185) | Enter submits with Submit disabled | `requestSubmit` bypasses the button | closed | Enter and the button share one guard |
| shadcn chatbot kit | [#11](https://github.com/Blazity/shadcn-chatbot-kit/issues/11) | double Enter to interrupt also submits twice | two `requestSubmit` calls | open | busy states ignore SUBMIT; Enter never stops |
| assistant-ui | [#3577](https://github.com/assistant-ui/assistant-ui/issues/3577) | empty text + attachment sends two messages | text and files sent as separate appends | closed | one submit = one `onSubmit({ text, attachments })` |
| assistant-ui | [#9164](https://github.com/assistant-ui/assistant-ui/issues/9164) / [#1751](https://github.com/assistant-ui/assistant-ui/issues/1751) | Send and Add Attachment enabled on a disabled thread; no way to disable the composer | disabled not propagated | closed | one `disabled` on Root covers every part |
| assistant-ui | [#4505](https://github.com/assistant-ui/assistant-ui/issues/4505) | Stop shown instead of Send on first render | initial status wrong | closed | initial state from props, `idle` by default |
| AI Elements | [#126](https://github.com/vercel/ai-elements/issues/126) | attachments cleared although the submit failed | cleared unconditionally | closed | restore on failure |
| AI Elements | [#518](https://github.com/vercel/ai-elements/issues/518) | text typed while an async submit is pending is erased on success | clears the current draft after resolve | open | clear at submit time, restore on failure only into an empty draft |
| assistant-ui | [#8242](https://github.com/assistant-ui/assistant-ui/issues/8242), [#8350](https://github.com/assistant-ui/assistant-ui/issues/8350), [#8360](https://github.com/assistant-ui/assistant-ui/issues/8360) | removed file returns after a failed send; removing the only file sends an empty message; remove called twice | the sending message and the draft share attachment state | closed | the submitted message is a snapshot; attachments are removed once (by key) |
| AI Elements | [#509](https://github.com/vercel/ai-elements/issues/509) | pasting Excel cells attaches a picture | every `file` item attached, text dropped | open | clipboard with `text/plain` is a text paste |
| LobeHub | [#4098](https://github.com/lobehub/lobehub/issues/4098), [#7381](https://github.com/lobehub/lobehub/issues/7381), [#571](https://github.com/lobehub/lobehub/issues/571) | Safari: no image paste; a file path pasted instead | read `items` only / Safari exposes `files` | closed | read `clipboardData.files` and `items`; test in WebKit |
| AI Elements | [#104](https://github.com/vercel/ai-elements/issues/104) | no file paste | — | closed (added) | paste is part of the component |
| AI Elements | [#501](https://github.com/vercel/ai-elements/issues/501) | `accept=".xlsx"` rejects every file | JS filter knows MIME only | open | one matcher for MIME, wildcard and extension, same as `<input accept>` |
| AI Elements | [#511](https://github.com/vercel/ai-elements/issues/511) | rejected files from a mixed selection vanish silently | error only when all fail | open | report every rejected file, announce |
| AI Elements | [#241](https://github.com/vercel/ai-elements/issues/241), [#254](https://github.com/vercel/ai-elements/issues/254) | drop never attached to the form; second picker selection broke submit | listener on the wrong node; file input not reset | closed | drop target = Root; reset the file input after each pick |
| assistant-ui | [#3575](https://github.com/assistant-ui/assistant-ui/issues/3575), [#5221](https://github.com/assistant-ui/assistant-ui/issues/5221) | dropped files added one by one; unhandled rejections | sequential awaits; no catch | closed | add all files of one gesture in one event |
| AI Elements | [#507](https://github.com/vercel/ai-elements/issues/507) | remove button invisible on keyboard focus and touch | `opacity-0` + `group-hover` | open | theme shows it on `data-focus-visible` and without hover |
| assistant-ui | [#7268](https://github.com/assistant-ui/assistant-ui/issues/7268) | attachment tile is a `role=button` that does nothing; same-type files indistinguishable | always-button markup; label = type | closed | chips named by file name; no fake buttons |
| assistant-ui | [#8208](https://github.com/assistant-ui/assistant-ui/issues/8208) | Escape/Cancel drops focus to `<body>` | the focused composer unmounted | closed | one Submit/Stop button; focus never on a removed node |
| assistant-ui | [#8223](https://github.com/assistant-ui/assistant-ui/issues/8223) | a run starting elsewhere steals focus from another field | auto-focus on run start | closed | Prompt Input never moves focus on a status change |
| prompt-kit | [#55](https://github.com/ibelick/prompt-kit/issues/55) | clicking the box's padding does nothing | focus only on the textarea | closed | a press on the Root's non-interactive area focuses the textarea |
| prompt-kit | [#109](https://github.com/ibelick/prompt-kit/issues/109) | `<button>` inside `<button>` | tooltip trigger wraps the action | open | parts render one element; `render` substitutes it |
| assistant-ui | [#4091](https://github.com/assistant-ui/assistant-ui/issues/4091) | no clean way to make mobile Enter a newline | `submitMode="none"` also killed newline | closed (option) | touch-primary default: Enter = newline, native |
| LobeHub | [#1575](https://github.com/lobehub/lobehub/issues/1575), [#748](https://github.com/lobehub/lobehub/issues/748) | send key not choosable (mobile) | fixed Enter | closed | `submitKey` option |
| LobeHub | [#9176](https://github.com/lobehub/lobehub/issues/9176) | Enter with the caret mid-text sends a split message | newline inserted before the send read the value | closed | Enter's default prevented before reading the value |
| LobeHub | [#9224](https://github.com/lobehub/lobehub/issues/9224) | ArrowUp/Down stuck in multi-line drafts | keys captured for history | closed | history only on an empty draft, caret at start, no modifiers |
| react-textarea-autosize | [#356](https://github.com/Andarist/react-textarea-autosize/issues/356), [#142](https://github.com/Andarist/react-textarea-autosize/issues/142), [#389](https://github.com/Andarist/react-textarea-autosize/issues/389), [#422](https://github.com/Andarist/react-textarea-autosize/issues/422) | scroll jump in zoomed Safari; caret hidden past max rows; no resize on width change; forced reflows | JS measurement | open | `field-sizing` first; fallback already in `autosize-textarea` |
| assistant-ui | [#4686](https://github.com/assistant-ui/assistant-ui/issues/4686) | no scrollbar past the maximum height | overflow hidden | closed | above max it scrolls (`autosize-textarea`) |
| assistant-ui | [#9167](https://github.com/assistant-ui/assistant-ui/issues/9167) | docs example sends on IME Enter | example skipped the guard | closed | examples use the parts, never a hand-written keydown |

## Known pitfalls

- **Enter, three ways**: `isComposing`, `keyCode 229` (Android keyboards report it for
  every key, so on touch-primary devices Enter is a newline anyway) and Safari's late Enter
  after `compositionend`. One guard (`keyboard-interactions`), applied to submit, recall,
  removal and stop.
- **A stuck composing flag** must never block value changes (aui#3923; Text Field's rule:
  never gate `onValueChange`).
- **Guard by state, not DOM**: a "can submit" check that reads the button (#439/#185)
  breaks when the button changes; the machine decides and both Enter and the button ask it.
- **Clearing**: clear at submit (snapshot) so nothing typed later is lost; restore on
  failure only if the user has not started a new draft.
- **Paste**: clipboard images arrive as `files`/`items` with `kind: "file"`; spreadsheets
  and rich text carry both text and a picture — text wins.
- **Drop**: only react to `types.includes("Files")`; prevent the default on `dragover` so a
  drop does not navigate; `dragleave` fires when moving over children (track with
  `relatedTarget` containment, not a counter that drifts).
- **Programmatic value writes** (clear, restore, history recall) wipe the undo stack and
  confuse React's value tracker (text-field.md: RA#6504, zag#3204); in uncontrolled mode
  use `setRangeText` / `execCommand("insertText")` where undo matters; never while
  composing.
- **Object URLs** for previews leak unless revoked (AI Elements revokes on remove/unmount;
  aui#7268 allocated two per file): previews are the consumer's.

## Testing notes

- IME: drive `compositionstart` → `input(isComposing)` → Enter keydown (229) →
  `compositionend` → late Enter (Safari order) and assert no `onSubmit`; WebKit run in
  browser mode. Dead key: `compositionstart` without `compositionend`, then blur, then type —
  value updates.
- Lifecycle: model-based over `idle → submitting → streaming → stopped → idle` with a
  consumer fixture that resolves, rejects, or reports `status`; double click on Submit;
  key repeat on Enter.
- Paste / drop: synthesise `ClipboardEvent` / `DragEvent` with a `DataTransfer` holding
  `File`s (Chromium, Firefox, WebKit in Vitest browser mode); Playwright `setInputFiles` and
  `filechooser` for the attach button.
- Announcements: recording Announcer; exactly one per stop / failure / add / removal.
- Driver `getPromptInput(screen, { name })`: `type`, `fill`, `compose`, `submit`, `stop`,
  `attach(files)`, `paste(files | text)`, `drop(files)`, `removeAttachment(name)`,
  `recall`; queries `value`, `state`, `attachments`, `canSubmit`, `submitName`,
  `characterCount`.

## Decisions

- **One widget, parts not components**: Prompt Input is a widget (draft + attachments +
  one send/stop action); its pieces are parts. No separate "Send Button", "Stop Button",
  "Attachment List" or "Dropzone" components. Value over native: IME-safe Enter, the
  submit/stop lifecycle, attachment intake with validation, announcements — a bare
  `<form><textarea>` has none of these.
- **Parts**: `Root` (`<form>`, drop target, hidden `<input type=file>`), `Label`,
  `Description`, `Textarea`, `Submit` (one button: send ↔ stop), `AttachTrigger`
  (`<button>` opening the native file chooser), `Attachments` / `Attachment` /
  `AttachmentRemove` (`input-chips` with scope `prompt-input`), `CharacterCount`.
  Previews, menus, model pickers, tooltips are the consumer's markup.
- **Machine** (`core/ai/prompt-input`): states `idle`, `composing`, `submitting`,
  `streaming`, `stopped`; the request is the consumer's: `onSubmit(message)` may return a
  promise; `status` (`idle | submitting | streaming | error`, AI SDK's `ChatStatus` maps 1:1)
  is a bound prop; `onStop()`.
- **Native first**: `<textarea>`, `field-sizing: content` with the existing
  `autosize-textarea` fallback, native form submission (`requestSubmit`, `FormData`, the
  file input holding the attached `File`s through `DataTransfer`), native file chooser,
  `enterkeyhint`.
- **Reuse**: `keyboard-interactions` IME guard, `autosize-textarea`, `input-chips`,
  Text Field's `defaultCount` / `countAnnouncement`, `use-field-host` (Field label /
  description / error), announcer, messages.
- **Deliberately different**: one Submit/Stop button (AI Elements) over two (assistant-ui,
  chatbot kit) — focus; the guard is machine state (AI Elements #439); clear at submit and
  restore on failure (#126, #518); text paste wins over pictures (#509); no Escape-to-stop
  (aui#8199, and Escape belongs to the enclosing layer); history opt-in and only on an empty
  draft (LobeHub).

## Open questions

- Long-paste-to-attachment (Claude, chatbot kit): a docs recipe through `onPaste`, or a
  `pasteAsAttachment` threshold? Recipe for now.
- Queued / steered sends while streaming (assistant-ui queue): out of scope until Message
  Thread exists.
- Rich text (chips inside the text, `contenteditable`) for Mentions: native-platform §12
  keeps a textarea; revisit with Mentions.
</content>
</invoke>
