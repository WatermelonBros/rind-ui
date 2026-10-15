## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-collections`, `add-checkbox` (`hidden-form-input`, `control-label`) and `add-button` are applied
- [ ] 0.2 Raise design "Requests to other changes" 1–3 with their owners; until accepted, implement the current Apple-only rule behind the same quirk ids
- [ ] 0.3 Add the `env.abort()` capability (AbortController factory) to `domEnvironment()` and the test environment

## 1. Shared pattern (`core/components/combobox/pattern`)

- [ ] 1.1 `patternActions` / `patternGuards` / `patternEffects`: open rules (input, arrow, Alt+Arrow, trigger, input press, focus with cause guard), typing highlight with `ACTIVEDESCENDANT.FLUSH` lag, caret keys clearing the highlight, composition tracking, frozen results while exiting, query/filter derivation (`""` query when opened by trigger/arrow and not dirty), stale `itemsQuery`, empty exposure, abort per query
- [ ] 1.2 Inline completion (`autoComplete: "both" | "inline"`): forward typing only, caret at end, normalisation-length refusal, pointer never completes, Escape removes
- [ ] 1.3 Announcements: keyed count (all platforms), no results, loading, keyboard-highlight / section-entry / selection behind quirk ids
- [ ] 1.4 `patternConnect`: input, listbox, option, popup, positioner, empty props; `aria-*` per spec; handled-key `preventDefault`
- [ ] 1.5 `node` tests for every pattern scenario with fake clock, scheduler, announcer and platforms (Safari, Chrome macOS, Windows)

## 2. Machine (`combobox.machine.ts`)

- [ ] 2.1 Event union, context, controllables `value` / `inputValue` / `open`, props with defaults (`multiple`, `selectionMode`, `allowCustomValue`, `closeOnSelect`, `clearInputOnSelect`, `selectOnTab`, `openOn*`, `autoHighlight`, `keepHighlight`, `autoComplete`, `filter`, `itemsQuery`, `loop`, `readOnly`, `disabled`)
- [ ] 2.2 `commitText` with the ordered rules; text follows external changes only when not dirty; `$reverted` re-sync of refused text
- [ ] 2.3 Multiple mode: toggle, chip navigation and removal, Backspace arm/remove, focus repair after removal
- [ ] 2.4 Form reset and autofill events
- [ ] 2.5 `node` tests for every transition, refusal and `cancel()`

## 3. Connect and messages

- [ ] 3.1 `combobox.connect.ts`: Root, Label, Control, Trigger, ClearTrigger, Chips/Chip/ChipRemove, Item/ItemIndicator `data-state`, `data-variant` / `data-size` pass-through
- [ ] 3.2 `combobox.messages.ts` (pattern messages + the `input-chips` messages, see A.4)
- [ ] 3.3 Unit tests for every attribute in both specs

## 4. React parts (`packages/react/src/combobox`)

- [ ] 4.1 All parts with `render`; data and static item sources; Empty registration; hidden inputs via `hidden-form-input`
- [ ] 4.2 Presence on Popup, lazy mount, `keepMounted`; in-place rendering by default, works inside `Portal`
- [ ] 4.3 React tests: Strict Mode, SSR + hydrate, controlled text refused, combobox inside a modal dialog, two comboboxes side by side

## 5. Contract and driver

- [ ] 5.1 `comboboxPatternContract` and `comboboxContract` per design §7 (traits, announcements, `{ skip }`, prop steps)
- [ ] 5.2 `getCombobox` in `@rind-ui/testing` incl. `type`, `compose`, `announcements`; driver tests in browser mode, jsdom and through Playwright against Storybook

## 6. Tests

- [ ] 6.1 One browser test per spec scenario; issue-citing scenarios reproduce the issue first (see the Bug history table in docs/research/combobox.md)
- [ ] 6.2 `testMachine` over the props classes of design §7, all modalities incl. `virtual`, RTL run, Apple/WebKit, Apple/Blink and Windows platforms, IME replays, axe per state
- [ ] 6.3 Async story with an out-of-order fake server; virtualized story (10,000 options) with TanStack Virtual recipe
- [ ] 6.4 Virtual screen reader log for open, arrow, choose, empty results

## 7. Theme (`packages/theme/src/combobox.css`)

- [ ] 7.1 Tier-3 `--rind-combobox-*` tokens (design §8) defaulting to semantic tokens; control, popup, items, chips, empty; `data-variant` (solid, soft, outline, ghost) and `data-size` (sm, md, lg); `@starting-style` entry, exit on `[data-state=closed]`, duration tokens
- [ ] 7.2 Forced colors (outline highlight, check glyph, chip borders) and 24×24 targets with `--rind-hit-area` on chip remove; Playwright forced-colors captures

## 8. Stories (`apps/storybook`)

- [ ] 8.1 Default, groups, disabled options, custom value, multiple with chips, inline completion, open on focus, async, empty state, virtualized, in a dialog, in a Portal, read-only, invalid, form; state stories open / empty / loading
- [ ] 8.2 Driver story (docs testing example); all stories render with the theme stylesheet and pass axe (including colour contrast)

## 9. Docs and manual checks

- [ ] 9.1 Docs page (generated API facts + guide: text/selection rules, custom values, filtering vs `filter: null`, async with `itemsQuery` and the abort signal, multiple with chips, forms, Portal trade-off, testing with `getCombobox`)
- [ ] 9.2 Manual tier-1 pass: VO + Safari macOS/iOS (arrows, section entry, swipe order, trigger double tap), VO + Chrome macOS (no double speech), NVDA + Firefox/Chrome (chips toolbar in focus mode), JAWS + Chrome, TalkBack (trigger, option double tap); Japanese/Korean IME on macOS and Android; record in "Tested with"
- [ ] 9.3 Set Combobox to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 9.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-separator)

- [ ] A.1 `Combobox.Separator` uses add-separator's `separatorProps({ context: "listbox", scope: "combobox" })`: `role="none"`, `data-orientation` kept; axe `aria-required-children` test on an open popup with a separator (mui/base-ui#5398, ariakit#3315)

## Amendments (from add-label)

- [ ] A.2 Input and Trigger declare the press option `labelActivation: "focus"`: a label-forwarded click focuses the Input and never opens the popup, also with `openOnInputPress`; tests for "Label click focuses the trigger and does not open it" (headlessui#3787) and the wrapping-label case (radix#3679)

## Amendments (from add-field)

- [ ] A.3 `field-control` binding in `Combobox.Root`: register the Input once, Field ARIA on the Input only (never a popup input, base-ui#4120), OR-merged flags with Field and Fieldset, change reports and close = commit, focus target = Input, `field-associated` trait, Field prop × control matrix test

## Amendments (from add-tag-group, add-tags-input, add-command)

- [ ] A.4 Shared `input-chips` capability (`core/components/input-chips/`, spec `input-chips`): move the chip connect helpers (`inputChipsConnect({ scope })`), actions/guards, `CHIP.NAVIGATE` / `CHIP.REMOVE` / `BACKSPACE_EMPTY` and the `removeChip` / `chips` contract fragment out of Combobox unchanged; add per-chip `disabled` (skipped by navigation and arming, `data-disabled`), disarm on any caret move or press in the input, `CHIP.TYPE` (printable key or paste on a chip → input), and the messages `chipsLabel`, `removeLabel(text)` ("Remove {text}"), `tagsSummary(texts)`, `removedAnnouncement(text)` ("{text} removed") with Tag Group's keys and defaults; Combobox uses it with scope `combobox`; tests for every `input-chips` scenario (mui/base-ui#3629, #5547; chakra-ui/zag#2328, #1911; unovue/reka-ui#2785)
- [ ] A.5 `combobox-pattern` "Usable Without A Popup": `patternEffects` without `overlay` / `trackPosition` (moved to the Combobox machine), `patternConnect` input `aria-expanded` from the host's `exposed`, export `optionsNeverSelected` from the pattern module; tests for "Popup-less host spreads the input props" and "Shared never-selected invariant"
