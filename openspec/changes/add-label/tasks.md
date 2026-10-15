## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (press, modality, focusSafely, element-ids) and `add-checkbox` (`control-label`, label-forwarded click rule) are merged

## 1. Shared `label-interaction` (`core/components/shared/label-interaction.ts`)

- [ ] 1.1 Double-click selection guard (`detail > 1`, interactive-descendant test, `defaultPrevented`, consumer first); jsdom tests for radix#2656, bits-ui#1323, base-ui#586
- [ ] 1.2 Focus forwarding for non-labelable targets through `focusSafely` (pointer modality); test with a `div` target and a `span` label (base-ui#587)
- [ ] 1.3 `checkAfterCommit`: target resolution through the root node (shadow root), development warnings (headlessui#3876), `for` dropped for a non-labelable target after commit
- [ ] 1.4 `labelActivation: "focus"` press option in `core/dom/press.ts` (label-forwarded click → focus, no `PRESS`); tests with a consumer `<label for>` and a wrapping `<label>`

## 2. Machine

- [ ] 2.1 None: the Label is stateless (design §2). Record it in the generated docs metadata so the docs page shows "no states"

## 3. Connect (`components/label/label.connect.ts`)

- [ ] 3.1 Root props: scope attributes, `id` from `element-ids`, `htmlFor` passed through, the `label-interaction` handlers; no role and no ARIA
- [ ] 3.2 Unit tests: no `role` attribute ever (radix#638), consumer `id` and `htmlFor` kept, `render` substitution switches to focus forwarding

## 4. React part (`packages/react/src/label/`)

- [ ] 4.1 `Label.Root` (also exported as `Label`) with `render`, the post-commit check, StrictMode-safe
- [ ] 4.2 SSR test: `for` present in server HTML; a click before hydration focuses the input (kobalte#652, radix#1577)

## 5. Contract and driver

- [ ] 5.1 `label.contract.ts`: anatomy, locate by text, actions `click` / `doubleClick` (keyboard: none, with reason), queries `text` / `controlName` / `isControlFocused` / `selectedText`
- [ ] 5.2 `clickLabel` adapter input in the DOM and Playwright adapters, forwarding `detail` and modifiers (ariakit#7176)
- [ ] 5.3 `getLabel` driver; the same driver test in `browser`, `jsdom` and Playwright against Storybook

## 6. Tests

- [ ] 6.1 Browser tests: link inside a label (headlessui#3658), descendant `preventDefault` (radix#609), wrapping association (radix#1232), hover propagation (radix#1233)
- [ ] 6.2 Model-based tests: not applicable (no machine); the generic accessibility invariants run on every story instead

## 7. Theme

- [ ] 7.1 `packages/theme/src/label.css`: `@layer rind.components`, `:where()` selectors, `--rind-label-*` tokens read with fallbacks (never declared), no variant family, `data-size` text scaling, disabled cursor; a `data-tone="danger"` capture; imported from `index.css`

## 8. Stories

- [ ] 8.1 Stories: `for` an input, wrapping an input, wrapping a checkbox with a link inside, a label for a rind Select (focuses, does not open), a non-labelable target (dev warning shown in the story), substituted as `span`; every story passes axe

## 9. Docs

- [ ] 9.1 Generated docs page: anatomy, props, `data-*`, "no states", the interaction rules, the "label focuses, never opens" note, required-indicator guidance (`aria-hidden` on `*`), contract and driver example; `llms.txt` entry
- [ ] 9.2 A docs section for the shared `label-interaction` rules, linked from Checkbox, Switch and Field

## 10. Proof

- [ ] 10.1 Manual check with NVDA + Chrome and VO + Safari: name from the Label, label click focuses without reading twice
- [ ] 10.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
