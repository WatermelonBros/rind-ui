## 0. Prerequisites

- [ ] 0.1 Confirm `add-combobox` is applied (`combobox-pattern` module and chip helpers); if the `input-chips` extraction (add-combobox A.4) is not yet implemented, import the chip helpers from `components/combobox/pattern/` under the requested names
- [ ] 0.2 Confirm `hidden-form-input` list carriers and validity proxy (add-checkbox A.1, A.2) and the `paste(text)` environment input (design "Requests" 2) are available

## 1. Machine (`packages/core/src/components/tags-input/tags-input.machine.ts`)

- [ ] 1.1 States `idle | typing | editing | suggesting`, events, context and guards per design §1; `notComposing` on every creating/splitting/arming/removing/navigating/committing transition
- [ ] 1.2 `createTags(texts, reason)` (normalise, empty, max, duplicate, validate, one proposal, refusal, announcements) used by Enter, delimiter, paste, blur `add`, suggestion choose and `ADD`
- [ ] 1.3 `splitDelimited` (literal strings, RegExp, lists; zero-length matches ignored; caret-at-end rule; re-run after `COMPOSITION.END`) with `node` unit tests incl. `"|"`, `"+"`, `"."`
- [ ] 1.4 Tag keys per design §2; removal/edit/focus by key; per-tag `disabled`
- [ ] 1.5 Editing: `TAG.EDIT`, `EDIT.*`, commit/cancel/empty-removes, refusal keeps the ChipInput
- [ ] 1.6 Suggestions: spread `combobox-pattern` actions/guards/effects behind `hasCollection`; choose → `createTags`; hide chosen keys unless `allowDuplicates`; `allowCustom`
- [ ] 1.7 `node` tests for every scenario that does not need a DOM (IME, refusal, paste splitting, max, duplicates, keys)

## 2. Connect and messages

- [ ] 2.1 `tags-input.connect.ts`: Input (textbox, or pattern combobox attributes), Control press, chips via `input-chips` helpers with `data-scope="tags-input"`, ChipInput, ClearTrigger, `handled`-based `preventDefault` for Enter and paste, summary node, every `data-*` in the spec, `data-variant` / `data-size` pass-through
- [ ] 2.2 `tags-input.messages.ts` (typed English defaults, `Intl.PluralRules` counts)
- [ ] 2.3 Form wiring through `hidden-form-input` (carriers per tag, validity proxy, reset → `FORM.RESET`, invalid-focus) and `field-control` registration
- [ ] 2.4 Unit tests for every attribute and relation in the spec

## 3. React parts (`packages/react/src/tags-input`)

- [ ] 3.1 Root, Label, Control, Chips, Chip, ChipText, ChipRemove, ChipInput, Input, ClearTrigger, and the suggestion parts; `render` on each
- [ ] 3.2 Synchronous ChipInput focus inside the press/keydown (design §1, `flushSync` in the part)
- [ ] 3.3 React tests: Strict Mode, SSR + hydrate (carriers in the server HTML), native form submit/reset, inside a Field, inside a modal dialog

## 4. Contract and driver

- [ ] 4.1 `tags-input.contract.ts` per design §6 (traits, announcements, `{ skip }` reasons, prop steps, keyboard-only `addTag` with declared reason)
- [ ] 4.2 `getTagsInput` in `@rind-ui/testing`; driver tests in browser mode, jsdom and through Playwright against Storybook

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; issue-citing scenarios reproduce the issue first (Bug history in docs/research/tags-input.md)
- [ ] 5.2 Mobile delimiter test (`keyCode 229` keydown + `input` event) and IME replays (Japanese conversion, Pinyin preedit with spaces, Korean syllables, Safari commit Enter)
- [ ] 5.3 `testMachine` over the props classes of design §6, all modalities incl. `virtual`, RTL run, Apple/WebKit and Windows platforms, axe per state

## 6. Theme (`packages/theme/src/tags-input.css`)

- [ ] 6.1 `@layer rind.components`, `:where()` selectors, tier-3 `--rind-tags-input-*` tokens read with fallbacks (to `--rind-combobox-*`, then semantic) and never declared; `data-variant` (solid, soft, outline, ghost) × `data-size` (sm, md, lg) on Control and Chip; `data-tone="danger"` for `data-invalid` / `data-refused`
- [ ] 6.2 Input `field-sizing: content` with min inline size and flex fallback; chip border and highlight outline; forced-colors rules; 24×24 targets via `--rind-hit-area`; Playwright forced-colors captures

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Default, email recipients (validate + paste), max, duplicates allowed, editable, blur add/clear, read-only, disabled, in a Field with required, with suggestions (static and async), in a dialog, RTL
- [ ] 7.2 Driver story (docs testing example); all stories render with the theme stylesheet and pass axe (including colour contrast)

## 8. Docs and manual checks

- [ ] 8.1 Docs page (generated API facts + guide: Tags Input vs Combobox multiple, delimiters and paste, IME, validation and refusal feedback, forms, testing with `getTagsInput`)
- [ ] 8.2 Manual tier-1 pass (VO + Safari macOS/iOS, NVDA + Chrome/Firefox, JAWS, TalkBack; Japanese, Chinese and Korean IMEs; Android Gboard and iOS keyboards incl. RK#1869); record in "Tested with"
- [ ] 8.3 Set Tags Input to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 8.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from coordinator, 2026-10-14)

- [ ] A.1 `test-drivers` delta ("Paste Input", `specs/test-drivers/spec.md`): `paste(text)` in the DOM and Playwright adapters (`paste` ClipboardEvent with `DataTransfer` `text/plain`, then `beforeinput`/`input` `insertFromPaste` when not cancelled); `@rind-ui/testing/setup` installs `ClipboardEvent`/`DataTransfer` only where missing; tests for "Cancelled paste inserts nothing" and "Plain paste inserts the text" in jsdom, browser mode and Playwright
