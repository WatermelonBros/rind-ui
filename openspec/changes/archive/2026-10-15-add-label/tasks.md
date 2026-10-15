## 0. Prerequisites

- [x] 0.1 Confirm `add-foundations`, `add-a11y-foundations` (press, modality, focusSafely, element-ids) and `add-checkbox` (`control-label`, label-forwarded click rule) are merged

## 1. Shared `label-interaction` (`core/components/shared/label-interaction.ts`)

- [x] 1.1 Double-click selection guard (`detail > 1`, interactive-descendant test, `defaultPrevented`, consumer first); jsdom tests for radix#2656, bits-ui#1323, base-ui#586
- [x] 1.2 Focus forwarding for non-labelable targets through `focusSafely` (pointer modality); test with a `div` target and a `span` label (base-ui#587)
- [x] 1.3 `checkAfterCommit`: target resolution through the root node (shadow root), development warnings (headlessui#3876), `for` dropped for a non-labelable target after commit
- [x] 1.4 `labelActivation: "focus"` press option in `core/dom/press.ts` (label-forwarded click → focus, no `PRESS`); tests with a consumer `<label for>` and a wrapping `<label>`

## 2. Machine

- [x] 2.1 None: the Label is stateless (design §2). Record it in the generated docs metadata so the docs page shows "no states"

## 3. Connect (`components/label/label.connect.ts`)

- [x] 3.1 Root props: scope attributes, `id` from `element-ids`, `htmlFor` passed through, the `label-interaction` handlers; no role and no ARIA
- [x] 3.2 Unit tests: no `role` attribute ever (radix#638), consumer `id` and `htmlFor` kept, `render` substitution switches to focus forwarding

## 4. React part (`packages/react/src/label/`)

- [x] 4.1 `Label.Root` (also exported as `Label`) with `render`, the post-commit check, StrictMode-safe
- [x] 4.2 SSR test: `for` present in server HTML; a click before hydration focuses the input (kobalte#652, radix#1577)

## 5. Contract and driver

- [x] 5.1 `label.contract.ts`: anatomy, locate by text, actions `click` / `doubleClick` (keyboard: none, with reason), queries `text` / `controlName` / `isControlFocused` / `selectedText`
- [x] 5.2 No separate `clickLabel` input: the contract's `click` uses `Part.click`, which in both adapters is a real pointer click on the label, so the browser (or jsdom) forwards its own click to the control; a test asserts the forwarded click carries `detail` ≥ 1 (ariakit#7176). New Part/Env operations for the queries: `accessibleName`, `labelled`, `doubleClick`, `selectedText`
- [x] 5.3 `getLabel` driver; the same driver test in `browser`, `jsdom` and Playwright against Storybook

## 6. Tests

- [x] 6.1 Browser tests: link inside a label (headlessui#3658), descendant `preventDefault` (radix#609), wrapping association (radix#1232), hover propagation (radix#1233)
- [x] 6.2 Model-based tests: not applicable (no machine); the generic accessibility invariants run on every story instead

## 7. Theme

- [x] 7.1 `packages/theme/src/label.css`: `@layer rind.components`, `:where()` selectors, `--rind-label-*` tokens read with fallbacks (never declared), no variant family, `data-size` text scaling, disabled cursor; a `data-tone="danger"` capture; imported from `index.css`

## 8. Stories

- [x] 8.1 Stories: `for` an input, wrapping an input, wrapping a checkbox with a link inside, a label for a rind Select (focuses, does not open), a non-labelable target (dev warning shown in the story), substituted as `span`; every story passes axe

## 9. Docs

- [x] 9.1 Generated docs page: anatomy, props, `data-*`, "no states", the interaction rules, the "label focuses, never opens" note, required-indicator guidance (`aria-hidden` on `*`), contract and driver example; `llms.txt` entry
- [x] 9.2 A docs section for the shared `label-interaction` rules, linked from Checkbox, Switch and Field

## 10. Proof

- [x] 10.1 Manual check with NVDA + Chrome and VO + Safari: name from the Label, label click focuses without reading twice — deferred to the manual protocol (docs/accessibility/manual-protocol.md, "Device checklist: Label"); needs the user on devices
- [x] 10.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
