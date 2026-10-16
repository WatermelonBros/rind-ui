## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-floating-positioning`, `add-collections`, `add-listbox`, `add-button` and `add-checkbox` are applied
- [ ] 0.2 Agree the four requests in design "Requests to other changes" with the owners of `add-checkbox` (hidden-input element kind, autofill adoption, per-component `form-associated` properties) and `add-collections` (centre on open) and land the API changes in `core/dom` / `core/collection` with their own tests

## 1. Machine (`core/components/select`)

- [ ] 1.1 `select.machine.ts`: event union (design §1), controllables `open` and `value` (`string | null` / `string[]`, `""` distinct from none, set equality), `bindProp` `multiple`/`modal`/`disabled`/`readOnly`, props with defaults (`modal: true`, `loop: false`, `focusableWhenDisabled: false`, `positioning`)
- [ ] 1.2 Spread `collectionActions`/`Guards` and `listboxMachinePieces`; state-scoped `TYPEAHEAD` (closed: `typeaheadSelect`, single only; open: highlight)
- [ ] 1.3 Effects: `overlay` (kind `listbox`, trigger and label in `elements()`), `trackPosition` (`dropdown`), `windowBlur`, `focusHighlighted`, `formInput` (reset, autofill, focus forwarding)
- [ ] 1.4 Actions: `focusInitial` on first placement (selected → last for ArrowUp → first → list), centred scroll before focus, select-then-close queued after the option's click, Tab close + trigger focus, Escape `preventDefault`, `LABEL_PRESS` focus, `FORM.AUTOFILL` matching (key, then text with the search collator), `autofilled` flag
- [ ] 1.5 `node` tests for every transition, refusal (controlled `open`/`value`), closed-trigger typeahead with disabled items, autofill matching, reset

## 2. Connect (`select.connect.ts`, `select.messages.ts`)

- [ ] 2.1 Trigger (`button-like-element` + `role="combobox"`, `aria-expanded`, `aria-controls` only while mounted, `aria-labelledby` → label, `aria-required`/`aria-invalid`/`aria-describedby`), label (`span`, press → `LABEL_PRESS`), value text (keyed node, list format, placeholder), indicator, positioner/content, hidden inputs
- [ ] 2.2 Listbox parts under `scope: "select"` plus pointer highlight (shared pointer guard) and Escape/Tab on the list; list naming rule (label → copied `aria-label` → consumer `aria-labelledby`, never the trigger id)
- [ ] 2.3 Unit tests for every attribute in the spec

## 3. React parts (`packages/react/src/select`)

- [ ] 3.1 `Root` (service, `LayerProvider`, hidden inputs rendered last), `Label`, `Trigger`, `ValueText` (function child), `Indicator`, `Description`, `Positioner`, `Content`, and `List`/`Item`/`ItemText`/`ItemDescription`/`ItemIndicator`/`Section`/`SectionLabel`/`Separator`/`Empty`/`LoadMore` from `createListboxParts`; `render` on each
- [ ] 3.2 Presence; lazy mount, unmount after exit, `keepMounted`
- [ ] 3.3 Dev warnings: unnamed trigger, unnamed list
- [ ] 3.4 React tests: Strict Mode, SSR + hydrate (value text and hidden input value in the server HTML), select inside a consumer `<label>`, inside a dialog and a popover, `render` with a custom trigger

## 4. Contract and driver

- [ ] 4.1 `select.contract.ts` per design §7 (traits, actions with keyboard twins, state-dependent `TYPEAHEAD` mapping, `{ skip }` events, `$sync:open`/`$sync:value` prop steps)
- [ ] 4.2 `getSelect` in `@rind-ui/testing`; driver tests in `browser`, `jsdom` and **happy-dom**, and through Playwright against the site examples harness

## 5. Tests

- [ ] 5.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (every issue cited in specs/select/spec.md)
- [ ] 5.2 Touch tests (Chromium and WebKit touch emulation, Firefox Android manual): scroll over the trigger, tap-through, list scroll with a finger
- [ ] 5.3 Form tests: submission (single, multiple, `""`), reset, required with 0/1/N values, autofill through a dispatched native `input`, change-event parity, no scroll overflow, one element per role/text/label query
- [ ] 5.4 `testMachine`: props classes single, multiple, `modal: false`, required in a form; collection argument classes; all modalities incl. `virtual` and `touch`; RTL; axe per state
- [ ] 5.5 Virtual screen reader reading-order test (trigger name, value, expanded state, list name, options, selection state)

## 6. Theme (`packages/theme/src/select.css`)

- [ ] 6.1 Tier-3 tokens `--rind-select-*` (design §8) defaulting to semantic tokens, item tokens defaulting to `--rind-listbox-item-*`; trigger states (`data-state`, `data-placeholder`, `data-invalid`, `data-disabled`, `data-focus-visible`), content `min-width: var(--rind-anchor-width)` and max height, `@starting-style` entry and `[data-state=closed]` exit with duration tokens; target size ≥ 24px
- [ ] 6.2 Forced colors: trigger border, highlight as outline, selected via indicator + system colours; Playwright forced-colors captures

## 7. Site examples

- [ ] 7.1 Site examples (apps/site/examples/select.tsx, state examples for every contract state): Default, placeholder, icons and descriptions, sections, disabled items, multiple, required + invalid in a form (submit/reset), autofill (`autocomplete="country-name"`), long list (centred selection), async items, virtualized, in a dialog, non-modal, RTL, Reado's atom; state examples open / open with a value
- [ ] 7.2 Driver example (docs testing example); all examples pass axe on the themed component

## 8. Docs and closing

- [ ] 8.1 Docs page (generated API facts + guide: naming, value text, multiple, forms and autofill, why there is no hidden `<select>`, testing with `getSelect`/`testMachine` incl. happy-dom, "native select on mobile" recipe, Ark/Reado migration)
- [ ] 8.2 Manual tier-1 pass: VO + Safari (macOS/iOS: value change after closed typeahead, touch open/close), NVDA + Firefox, JAWS + Chrome, TalkBack; record in "Tested with"
- [ ] 8.3 Migrate Reado's `atoms/Select.tsx` and replace the `pick()` workarounds in its tests with `getSelect` (separate Reado change, tracked here)
- [ ] 8.4 Set Select to `wip`/`done` in `docs/components.md` as it progresses; archive the change when approved
- [ ] 8.5 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme

## Amendments (from add-separator)

- [ ] A.1 `Select.Separator` uses the listbox separator part (add-separator `separatorProps({ context: "listbox", scope: "select" })`): `role="none"`; axe `aria-required-children` test on an open popup with a separator (mui/base-ui#5398)

## Amendments (from add-label)

- [ ] A.2 Trigger declares the press option `labelActivation: "focus"`: a label-forwarded click (Field Label, consumer `<label for>`, wrapping `<label>`) focuses the trigger and never opens the popup; tests for "Label click focuses the trigger and does not open it" (headlessui#3787) and the wrapping-label mobile case (radix#3679), and the updated wrapping-label scenario

## Amendments (from add-field)

- [ ] A.3 `field-control` binding in `Select.Root`: register the trigger once (hidden constraint input as validity element), Field ARIA on the trigger only (no wiring on the list/typeahead), OR-merged flags with Field and Fieldset, change reports and close = commit, focus target = trigger (base-ui#2113), `field-associated` trait, Field prop × control matrix test
