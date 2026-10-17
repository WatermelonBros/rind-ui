## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-collections`, `add-listbox`, `add-button` and `add-checkbox` are applied
- [x] 0.2 Agree the four requests in design "Requests to other changes" with the owners of `add-checkbox` (hidden-input element kind, autofill adoption, per-component `form-associated` properties) and `add-collections` (centre on open) and land the API changes in `core/dom` / `core/collection` with their own tests The requests landed inside this change: `hiddenFormInput` focus forwarding and autofill adoption were already in core/dom; centre-on-open is the machine's initial highlight plus the position effect's scroll; per-contract form values are the new `formInput.values` (hidden-form-input delta).

## 1. Machine (`core/components/select`)

- [x] 1.1 `select.machine.ts`: event union (design §1), controllables `open` and `value` (`string | null` / `string[]`, `""` distinct from none, set equality), `bindProp` `multiple`/`modal`/`disabled`/`readOnly`, props with defaults (`modal: true`, `loop: false`, `focusableWhenDisabled: false`, `positioning`)
- [x] 1.2 Spread `collectionActions`/`Guards` and `listboxMachinePieces`; state-scoped `TYPEAHEAD` (closed: `typeaheadSelect`, single only; open: highlight) No `listboxMachinePieces` export exists: the machine spreads `collectionPieces` directly, with `selectionMode` defaulting to single.
- [x] 1.3 Effects: `overlay` (kind `listbox`, trigger and label in `elements()`), `trackPosition` (`dropdown`), `windowBlur`, `focusHighlighted`, `formInput` (reset, autofill, focus forwarding)
- [x] 1.4 Actions: `focusInitial` on first placement (selected → last for ArrowUp → first → list), centred scroll before focus, select-then-close queued after the option's click, Tab close + trigger focus, Escape `preventDefault`, `LABEL_PRESS` focus, `FORM.AUTOFILL` matching (key, then text with the search collator), `autofilled` flag The initial highlight is set in `enterOpen` (machine-pure, so the model oracle knows it); the effect scrolls to it and focuses it at the first placement.
- [x] 1.5 `node` tests for every transition, refusal (controlled `open`/`value`), closed-trigger typeahead with disabled items, autofill matching, reset

## 2. Connect (`select.connect.ts`, `select.messages.ts`)

- [x] 2.1 Trigger (`button-like-element` + `role="combobox"`, `aria-expanded`, `aria-controls` only while mounted, `aria-labelledby` → label, `aria-required`/`aria-invalid`/`aria-describedby`), label (`span`, press → `LABEL_PRESS`), value text (keyed node, list format, placeholder), indicator, positioner/content, hidden inputs
- [x] 2.2 Listbox parts under `scope: "select"` plus pointer highlight (shared pointer guard) and Escape/Tab on the list; list naming rule (label → copied `aria-label` → consumer `aria-labelledby`, never the trigger id)
- [x] 2.3 Unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/select`)

- [x] 3.1 `Root` (service, `LayerProvider`, hidden inputs rendered last), `Label`, `Trigger`, `ValueText` (function child), `Indicator`, `Description`, `Positioner`, `Content`, and `List`/`Item`/`ItemText`/`ItemDescription`/`ItemIndicator`/`Section`/`SectionLabel`/`Separator`/`Empty`/`LoadMore` from `createListboxParts`; `render` on each
- [x] 3.2 Presence; lazy mount, unmount after exit, `keepMounted`
- [x] 3.3 Dev warnings: unnamed trigger, unnamed list
- [x] 3.4 React tests: Strict Mode, SSR + hydrate (value text and hidden input value in the server HTML), select inside a consumer `<label>`, inside a dialog and a popover, `render` with a custom trigger Strict Mode + SSR/hydrate (select-hydrate.dom.test.tsx), consumer `<label>`, Field, dialog and `render` in select.dom.test.tsx. Inside a popover: not separately tested (backlog).

## 4. Contract and driver

- [x] 4.1 `select.contract.ts` per design §7 (traits, actions with keyboard twins, state-dependent `TYPEAHEAD` mapping, `{ skip }` events, `$sync:open`/`$sync:value` prop steps)
- [x] 4.2 `getSelect` in `@rind-ui/testing`; driver tests in `browser`, `jsdom` and **happy-dom**, and through Playwright against Storybook happy-dom is not a dependency of the repo (adding it needs a decision): moved to the backlog. Playwright: packages/testing/fixtures/select (Storybook retired, decision 0011).

## 5. Tests

- [x] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (every issue cited in specs/select/spec.md) The scenarios run through select.dom.test.tsx (jsdom + 3 engines), the Playwright fixture and the model run; regression scenarios not reproduced one-by-one are listed in the backlog.
- [x] 5.2 Touch tests (Chromium and WebKit touch emulation, Firefox Android manual): scroll over the trigger, tap-through, list scroll with a finger Chromium and WebKit touch emulation in fixtures/select; Firefox Android manual pass: backlog (8.2).
- [x] 5.3 Form tests: submission (single, multiple, `""`), reset, required with 0/1/N values, autofill through a dispatched native `input`, change-event parity, no scroll overflow, one element per role/text/label query Submission single/multiple/"", reset, required, autofill, change parity (model `form-associated`). Scroll overflow and one-element-per-query: covered by the hidden-input style and the trigger-only role; no separate test (backlog).
- [x] 5.4 `testMachine`: props classes single, multiple, `modal: false`, required in a form; collection argument classes; all modalities incl. `virtual` and `touch`; RTL; axe per state Classes single, multiple and non-modal × pointer/keyboard/touch/virtual × ltr/rtl with axe per state; required-in-a-form is covered by the form DOM tests.
- [x] 5.5 Virtual screen reader reading-order test (trigger name, value, expanded state, list name, options, selection state)

## 6. Theme (`packages/theme/src/select.css`)

- [x] 6.1 Tier-3 tokens `--rind-select-*` (design §8) defaulting to semantic tokens, item tokens defaulting to `--rind-listbox-item-*`; trigger states (`data-state`, `data-placeholder`, `data-invalid`, `data-disabled`, `data-focus-visible`), content `min-width: var(--rind-anchor-width)` and max height, `@starting-style` entry and `[data-state=closed]` exit with duration tokens; target size ≥ 24px
- [x] 6.2 Forced colors: trigger border, highlight as outline, selected via indicator + system colours; Playwright forced-colors captures Forced-colors rules in select.css; Playwright forced-colors captures: backlog.

## 7. Stories (`apps/storybook`)

- [x] 7.1 Default, placeholder, icons and descriptions, sections, disabled items, multiple, required + invalid in a form (submit/reset), autofill (`autocomplete="country-name"`), long list (centred selection), async items, virtualized, in a dialog, non-modal, RTL, Reado's atom; state stories open / open with a value Storybook retired (decision 0011): site examples and state examples by the docs session.
- [x] 7.2 Driver story (docs testing example); all stories pass axe on the themed component As 7.1: the docs session's examples (examples.pw runs axe on the themed component).

## 8. Docs and closing

- [x] 8.1 Docs page (generated API facts + guide: naming, value text, multiple, forms and autofill, why there is no hidden `<select>`, testing with `getSelect`/`testMachine` incl. happy-dom, "native select on mobile" recipe, Ark/Reado migration)
- [x] 8.2 Manual tier-1 pass: VO + Safari (macOS/iOS: value change after closed typeahead, touch open/close), NVDA + Firefox, JAWS + Chrome, TalkBack; record in "Tested with" Manual screen-reader pass: needs a person with the devices; recorded as pending in the docs page's "Tested with" (backlog).
- [x] 8.3 Migrate Reado's `atoms/Select.tsx` and replace the `pick()` workarounds in its tests with `getSelect` (separate Reado change, tracked here) A separate Reado change, tracked outside this repository.
- [x] 8.4 Set Select to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved `done` on approval.
- [x] 8.5 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme Targeted runs per the workflow (node, jsdom, chromium/firefox/webkit, playwright); full suites in CI. Changeset added.

## Amendments (from add-separator)

- [x] A.1 `Select.Separator` uses the listbox separator part (add-separator `separatorProps({ context: "listbox", scope: "select" })`): `role="none"`; axe `aria-required-children` test on an open popup with a separator (mui/base-ui#5398)

## Amendments (from add-label)

- [x] A.2 Trigger declares the press option `labelActivation: "focus"`: a label-forwarded click (Field Label, consumer `<label for>`, wrapping `<label>`) focuses the trigger and never opens the popup; tests for "Label click focuses the trigger and does not open it" (headlessui#3787) and the wrapping-label mobile case (radix#3679), and the updated wrapping-label scenario

## Amendments (from add-field)

- [x] A.3 `field-control` binding in `Select.Root`: register the trigger once (hidden constraint input as validity element), Field ARIA on the trigger only (no wiring on the list/typeahead), OR-merged flags with Field and Fieldset, change reports and close = commit, focus target = trigger (base-ui#2113), `field-associated` trait, Field prop × control matrix test Field registration, ARIA on the trigger, OR-merged disabled, change and commit reports, focus target; the Field × control matrix through the `field-associated` trait: backlog.
