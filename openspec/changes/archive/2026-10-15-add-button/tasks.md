## 0. Prerequisite

- [x] 0.1 Confirm `add-foundations` (runtime, react adapter, contracts, testing) and `add-a11y-foundations` (press, modality, announcer, messages) are merged

## 1. Shared button-like element

- [x] 1.1 `core/dom` element info (tag, role, `href`, labelable) read from the attached ref; node tests
- [x] 1.2 `core/dom/fieldset-disabled.ts` (nearest fieldset `disabled` observer); jsdom tests incl. runtime toggle
- [x] 1.3 `components/shared/button-like.ts` `buttonLikeProps` (native/link/generic, `type` rules, disabled, `focusableWhenDisabled`, disabled link, dev warning for interactive descendants); exhaustive node table tests
- [x] 1.4 Browser-mode substitution matrix (button, `a[href]`, disabled `a`, `div`) × (enabled, disabled, focusableWhenDisabled) × (pointer, Enter, Space, touch, bare click): one activation or none as specified; Tab order
- [x] 1.5 Regression tests citing radix#3468, headlessui#619, base-ui#4021, ariakit#722, ariakit#845, base-ui#1312, base-ui#1843, react-spectrum#10658

## 2. Button machine and connect

- [x] 2.1 `button.machine.ts` (`idle`/`pending`, `onProps` pending edge, PRESS guards, focus and fieldset context, `announcePending`); node tests for every transition and guard
- [x] 2.2 `button.messages.ts` (`pending: "Loading"`), typed overrides
- [x] 2.3 `button.connect.ts` (root props via `buttonLikeProps`, pending attributes, `type` swap while pending, `data-*`); node tests
- [x] 2.4 Pending announcement only when focused, polite, keyed; recording-announcer tests

## 3. React part

- [x] 3.1 `@rind-ui/react` `Button` part (useMachine, press/hover factories, mergeProps, render, forwards every prop incl. `autoFocus`, form attributes)
- [x] 3.2 SSR + hydration tests (enabled, disabled, pending, element render as `<a>` and `<div>`)

## 4. Contract and driver

- [x] 4.1 `button.contract.ts` (anatomy, locate by role button/link, actions `press` / `pressWithSpace`, queries, states, events, traits)
- [x] 4.2 `getButton` driver export; driver tests in `browser` and `jsdom` projects and through the Playwright adapter

## 5. Model-based tests

- [x] 5.1 `testMachine(buttonContract, …)` in every modality with `props` variants (disabled, focusableWhenDisabled, pending, type submit/reset); all generic and a11y invariants green
- [x] 5.2 Broken variants fail readably: double `onPress` on bare click (virtual parity), ring after mouse click (focus-visible), focusableWhenDisabled still activating

## 6. Theme, stories, docs
- [x] 6.1 `packages/theme/src/button.css` (tokens only, `data-*` selectors, ≥ 24×24, forced colors) imported from `index.css`; forced-colors capture
- [x] 6.2 Stories: default, icon-only, disabled, focusable when disabled, pending, as link, as div, inside a form (submit/reset), state stories for `idle`/`pending`, driver story; axe clean; ARIA snapshots
- [x] 6.3 Docs page generated from source (parts, props, `data-*`, states, contract, keyboard table, `button-like-element` rules, pending recipe incl. `useFormStatus`), `llms.txt` entry

## 7. Proof

- [x] 7.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` all green

## Amendments (from add-fieldset, add-field)

- [x] A.1 `fieldset-disabled.ts` follows every ancestor fieldset (one document-level observer, `disabled` attribute filter) and applies the first-legend exception per fieldset; effective disabled ORs the rind-ui Fieldset/Field context read through the binding; tests for nested fieldsets, first vs second legend, legend of a nested fieldset inside a disabled one, and a portalled part under a disabled Fieldset

## Amendments (from add-link)

- [x] A.2 Anchor branch of `buttonLikeProps`: a part rendered as `<a href>` delegates activation, disabled and router behaviour to add-link's `linkProps` (`link-navigation`) instead of button activation rules; test for the "Anchor-rendered Button routes like a Link" scenario (react-spectrum#10603)
