## 0. Prerequisite

- [ ] 0.1 Confirm `add-checkbox` (machine, connect, `hidden-form-input`, `control-label`, React parts, contract) is merged

## 1. Machine

- [ ] 1.1 `checkbox-group.machine.ts`: events, controllable `value` with set equality, context (`cycle`, `memory`, registry), guards and actions per design §1
- [ ] 1.2 Computed `parentState`, `requiredActive`, `controlsIds`
- [ ] 1.3 Node tests: every Parent Cycle scenario (incl. disabled items, item toggle ending the cycle), controlled proposals and `$reverted`, `RESET` reason, one `onValueChange` per event

## 2. Connect

- [ ] 2.1 `checkbox-group.connect.ts`: Root/Label/Description/ErrorMessage props (role, `aria-labelledby` only while Label rendered, `aria-describedby`, fieldset/legend detection), `data-*` per design §4
- [ ] 2.2 Item and Parent prop derivation (controlled `checked`, `onCheckedChange`, disabled/readOnly OR, required while empty, name/form propagation, extra describedby ids, `aria-controls`, `data-value`, `data-parent`)
- [ ] 2.3 Checkbox: group context hook and the `resetsWithForm: false` option of the hidden-input reset handling

## 3. React parts

- [ ] 3.1 `CheckboxGroup.Root`, `Label`, `Description`, `ErrorMessage`, `Parent` in `@rind-ui/react`; item registration with rendered ids on mount/unmount
- [ ] 3.2 Dev errors: item without `value`, `Parent` without `allValues`, `allValues`/registered mismatch warning
- [ ] 3.3 SSR + hydration test with `defaultValue` (Bits UI #1249)

## 4. Contract and driver

- [ ] 4.1 `checkbox-group.contract.ts` (locate, `toggle`, `toggleParent`, queries, event map, trait `form-associated`) and per-contract invariants (design §6)
- [ ] 4.2 Generated `getCheckboxGroup` export from `@rind-ui/testing`
- [ ] 4.3 Driver tests in `browser` and `jsdom` projects in pointer, keyboard and virtual modalities; same test via the Playwright adapter

## 5. Model-based and behaviour tests

- [ ] 5.1 `testMachine(checkboxGroupContract, …)` with prop configurations: no Parent, Parent, disabled item(s), disabled group, read-only group, required group, controlled group
- [ ] 5.2 Browser tests: form submission data (disabled item omitted), form reset unchecks all at once (RA #7749/#10643), required group blocks submit and focuses the first enabled / failing item (Reka #1777, Base UI #5200, #4952), validity recomputed on change (RA #6173)
- [ ] 5.3 Ids and labels: unique item ids, each label toggles only its item (Ark #2895, Base UI #4121); fieldset/legend rendering has no `role`
- [ ] 5.4 Keyboard: Tab order through items, arrows inert (RA #5907)

## 6. Theme

- [ ] 6.1 `packages/theme/src/checkbox-group.css` (layout and spacing on `[data-scope="checkbox-group"]`, invalid/disabled via `data-*`), imported from `index.css`; forced-colors capture of the mixed Parent

## 7. Stories

- [ ] 7.1 Stories: default, with Parent (select all), disabled item, disabled group, read-only, required + ErrorMessage, controlled, inside a form with reset, fieldset/legend; state stories for Parent mixed/checked/unchecked; driver story
- [ ] 7.2 Every story passes axe; partial ARIA snapshots per state story

## 8. Docs

- [ ] 8.1 Docs page (generated API facts, anatomy, keyboard table, select-all cycle, required semantics, note on disabled items and form data, driver example) and `llms.txt` entry

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` all green

## Amendments (from add-field)

- [ ] A.1 `field-control` binding in the group Root: register once as one control (items never register), Field Label/Description/ErrorMessage on the group, own ErrorMessage defers to the Field's, OR-merged flags with Field and Fieldset, change reports, focus target = first invalid item else first enabled (base-ui#5200), `field-associated` trait, Field prop × control matrix test
