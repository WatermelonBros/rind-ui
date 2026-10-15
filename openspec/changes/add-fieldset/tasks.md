## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-button` (`fieldset-disabled.ts`) and `add-label` (`label-interaction`) are merged

## 1. Disabled scope (`core/dom/fieldset-context.ts`)

- [ ] 1.1 `FieldsetScope` and `isFieldsetDisabled` per design §2 (own ∪ parent, first-legend exemption); node tests for nesting and the exemption
- [ ] 1.2 Extend `fieldset-disabled.ts` (request to add-button): every disabled ancestor fieldset, first-legend exemption, one observer per document; jsdom tests comparing against native `:disabled` on the same markup

## 2. Machine

- [ ] 2.1 None: Fieldset is stateless (design, Goals). `disabled`/`invalid` changes are covered by prop steps in the contract

## 3. Connect (`components/fieldset/fieldset.connect.ts`)

- [ ] 3.1 Root props: native `disabled`, or `role="group"` + `aria-disabled` for a substituted root; `aria-labelledby` only for a non-native Legend; `aria-describedby` from registered parts, omitted when empty (ark#3707)
- [ ] 3.2 Legend (selection guard), Description, ErrorMessage (rendered while `invalid`) props; `data-*` per spec on every part
- [ ] 3.3 Unit tests: names (ark#3614, base-ui#3044), descriptions (base-ui#3260), no invalid cascade (ark#2928)

## 4. React parts (`packages/react/src/fieldset/`)

- [ ] 4.1 `Fieldset.Root` (provides the scope), `Legend` (provides the in-legend marker), `Description`, `ErrorMessage`; `render` on every part
- [ ] 4.2 SSR test: name and description relations in server HTML, no hydration warning

## 5. Contract and driver

- [ ] 5.1 `fieldset.contract.ts`: anatomy, locate by role `group` + name, no actions, prop steps `$props:disabled` / `$props:invalid`, queries per spec
- [ ] 5.2 `getFieldset` driver; same test in `browser`, `jsdom` and Playwright

## 6. Tests

- [ ] 6.1 Disabled propagation matrix in browser mode: native input, Button, Checkbox, Switch (headlessui#194), Radio Group with `div` items (headlessui#1802), Select with portalled content (radix#2417), nested fieldsets, control in the first legend, substituted root (dev warning); form data excludes disabled values
- [ ] 6.2 Model-based tests: not applicable (no machine); the prop steps run through the generic invariants on each story

## 7. Theme

- [ ] 7.1 `packages/theme/src/fieldset.css`: `@layer rind.components`, `:where()` selectors, `--rind-fieldset-*` tokens read with fallbacks (never declared), no variant family, legend normalisation, `min-inline-size: 0`, danger-role ErrorMessage, a `data-tone="danger"` capture, forced-colors capture; imported from `index.css`
- [ ] 7.2 Browser layout test at 320 CSS px with a long Legend

## 8. Stories

- [ ] 8.1 Stories: address group of Text Fields, radio set, disabled, nested disabled, legend with a "select all" checkbox, invalid with ErrorMessage, substituted legend; every story passes axe

## 9. Docs

- [ ] 9.1 Generated docs page: anatomy, props, `data-*`, "no states", name rules, disabled propagation (what a substituted root does not do), "Fieldset vs Field" guidance, driver example; `llms.txt` entry

## 10. Proof

- [ ] 10.1 Manual check NVDA + Chrome, JAWS + Chrome, VO + Safari: group name spoken on entering, description read, disabled controls announced as dimmed/unavailable
- [ ] 10.2 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green
