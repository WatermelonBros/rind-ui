## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-field`, `add-form`, `add-text-field`, `add-button`, `add-combobox`, `add-tags-input` and `add-theme-system` are applied (all archived)

## 1. Machine (`core/ai/prompt-input`)

- [ ] 1.1 `prompt-input.machine.ts`: states `idle`/`composing`/`submitting`/`streaming`/`stopped`, the event union (design §1), controllables `value` and `attachments`, bound props (`status`, `disabled`, `submitKey`, `history`, `accept`, `maxFiles`, `maxFileSize`, limit), `input-chips` actions/guards/context spread in
- [ ] 1.2 Guards `submittable`, `keyNotComposing`, `notRepeat`, `clickCountOne`; actions `snapshot`, `callOnSubmit`, `clearDraft`, `clearAttachments`, `failSend` (restore into an empty draft only), `callOnStop`, announcements; the `onSubmit` promise service with submit tokens; `THREW` + rethrow; `$sync:status` mapping and the untracked-submit eventless exit
- [ ] 1.3 History recall (`historyIndex`, `savedDraft`), removal de-duplication by id, composition exit on blur / non-composing input
- [ ] 1.4 `node` tests for every spec scenario that needs no DOM (lifecycle per fixture, failure restore rules, double submit, stop once, stale tokens, recall order, recording announcer counts)

## 2. File intake (`core/dom/file-intake.ts`)

- [ ] 2.1 `matchesAccept`, `filesFromClipboard`, `filesFromDrag`, `isLeavingRoot`, `syncFileInput`, `resetFileInput`, validation with reasons (design §3)
- [ ] 2.2 Unit tests (accept grammar incl. `.xlsx` and wildcards, text-wins paste) and browser tests in Chromium, Firefox and WebKit (clipboard image paste, DataTransfer sync, drop over a child)

## 3. Connect and messages

- [ ] 3.1 `prompt-input.connect.ts`: Root/Textarea/Submit/AttachTrigger/CharacterCount props, keymap (design §2) with `defaultPrevented` first, `enterKeyHint`, describedby, `aria-invalid`, Submit `type`/name/`aria-disabled`, Root press-to-focus, chips through `inputChipsConnect({ scope: "prompt-input" })`, every `data-*` in the spec, the API object
- [ ] 3.2 `prompt-input.messages.ts` (spec "Messages"), sharing the `input-chips` and Text Field count keys
- [ ] 3.3 Unit tests for every attribute in the spec per state (idle, composing, submitting, streaming, stopped, disabled, over limit, dragging)

## 4. React parts (`packages/react/src/prompt-input`)

- [ ] 4.1 Root (form + hidden file input + `use-field-host`), Label, Description, Textarea (`autosize()`), Submit, AttachTrigger, Attachments, Attachment, AttachmentRemove, CharacterCount; `render` on each
- [ ] 4.2 Dev warnings: missing / duplicate Textarea, missing Submit, placeholder-only name, Attachment outside Attachments
- [ ] 4.3 React tests: Strict Mode, SSR + hydrate, controlled and uncontrolled draft and attachments, React form `action` passthrough, FormData with text and files

## 5. Contract and driver

- [ ] 5.1 `prompt-input.contract.ts` per design §6 (role set, `input-chips` fragment, actions, queries, announcements, prop steps, `{ skip }`), fixtures `resolving`, `rejecting`, `status-driven`
- [ ] 5.2 `getPromptInput` in `@rind-ui/testing`; driver tests in browser mode, jsdom and through Playwright against the site examples harness (`setInputFiles`, `filechooser`)

## 6. Tests

- [ ] 6.1 One browser test per spec scenario; issue-citing scenarios reproduce the issue first (vercel/ai-elements#21, #400, #439, #185, #126, #518, #509, #501, #511, #254, #104, #507; assistant-ui/assistant-ui#8199, #3923, #3577, #9164, #4505, #8223, #8208, #8242, #8360, #7268, #4091, #4686; lobehub/lobehub#9176, #9224, #4098, #1575; ibelick/prompt-kit#55, #109)
- [ ] 6.2 IME sequences in WebKit, Chromium and Firefox: Japanese commit Enter, Safari late Enter, keyCode 229, dead key without `compositionend`
- [ ] 6.3 `testMachine` over the props classes and fixtures of spec "Model-Based Coverage", pointer/keyboard/virtual, axe per state, the "IME Never Commits" replay
- [ ] 6.4 Virtual screen reader reading-order test: Textarea name and description (count, attachments summary), Submit name per state, toolbar of attachments, announcements for stop, failure, add, reject, remove

## 7. Theme (`packages/theme/src/prompt-input.css`)

- [ ] 7.1 Tier-3 `--rind-prompt-input-*` tokens (design §7) with semantic fallbacks, `@layer rind.components`, `:where()` selectors; `field-sizing: content`, min/max block size, no height transition; button family for Submit and AttachTrigger (`data-variant`, `data-size`); `data-tone="danger"`; `data-over-limit`, `data-dragging`, `data-action`; remove buttons visible without hover; ≥ 24px targets
- [ ] 7.2 Forced colors: outline focus ring, over-limit and drag states without colour; Playwright forced-colors captures

## 8. Site examples

- [ ] 8.1 Site examples (`apps/site/examples/prompt-input.tsx`, state examples for every contract state): basic chat box, with attachments (picker, paste, drop, accept/size limits), AI SDK `useChat` status mapping (fake transport, no network), promise-only, `mod+enter` mode, token limit with a fake tokenizer, history recall, disabled, RTL, long text
- [ ] 8.2 Driver example (docs testing example); every example renders with the theme stylesheet and passes axe (including colour contrast)

## 9. Docs and closing

- [ ] 9.1 Docs page (generated API facts + guide: the submit/stop contract and `status` mapping for the AI SDK and assistant-ui-style stores, why one Submit/Stop button, IME and `submitKey`, mobile Enter, attachments and FormData, long-paste-to-attachment recipe through `onPaste`, previews and object URLs as consumer code, testing with `getPromptInput`)
- [ ] 9.2 Manual tier-1 pass (VO + Safari macOS/iOS, VO + Chrome, NVDA + Firefox/Chrome, JAWS, TalkBack) and IME pass (macOS Japanese/Chinese/Korean, Windows MS-IME, Linux Fcitx5, Android Gboard); record in "Tested with"
- [ ] 9.3 Set Prompt Input to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 9.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments

- [ ] A.1 `input-chips` delta (MODIFIED "Chips Container And Names", `specs/input-chips/spec.md`): Chips beside a bare textarea in the host Root; test "Chips beside a textarea" in browser mode
</content>
</invoke>
