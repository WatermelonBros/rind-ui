## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations` and `add-theme-system` are applied
- [ ] 0.2 Raise the requests in design.md "Requests to other changes" with the owners of `add-listbox`, `add-select`, `add-combobox`, `add-autocomplete`, `add-menu` and `add-theme-system`

## 1. Machine

- [ ] 1.1 None: Separator is stateless (design §1). Record it in the docs generator's component metadata (`stateless: true`) so the docs page omits the states table and the `testMachine` section

## 2. Connect (`core/components/separator/separator.connect.ts`)

- [ ] 2.1 `separatorProps(input, log)`: role by tag and context, `aria-orientation` only vertical, decorative → `none`, explicit orientation wins over `defaultOrientation`, invalid / undefined orientation handling, `data-*` per the spec
- [ ] 2.2 Development warnings through the injected logger: invalid orientation, `tabIndex >= 0` / `aria-value*` (→ Splitter), name on a `none` separator (props dropped)
- [ ] 2.3 `node` unit tests: every combination of orientation × decorative × tag (`div`, `hr`, custom) × context (`content`, `menu`, `toolbar`, `listbox`) × explicit / default orientation (ariakit#721, #6302, mui/base-ui#4647, #5398, huntabyte/bits-ui#2090, radix-ui/primitives#216)

## 3. Parts (`packages/react/src/separator`)

- [ ] 3.1 `Separator.Root` with `render`; no children for void elements; exports and types
- [ ] 3.2 React tests: SSR + hydrate as `div` and as `hr` with zero warnings (chakra-ui/ark#3555); consumer `data-variant`/`data-size`/`data-tone` pass-through

## 4. Contract and driver

- [ ] 4.1 `separator.contract.ts` (design §4): locate by name or within a container, queries `orientation`, `isDecorative`, `isExposed`, no actions, no traits
- [ ] 4.2 `getSeparator` exported from `@rind-ui/testing`; driver tests in `browser` and `jsdom` and through the Playwright adapter, including the multiple-match failure

## 5. Tests

- [ ] 5.1 No model-based test (no machine). Browser tests: axe on a separator in content, a toolbar, a menu and a listbox-like popup (`aria-required-children` passes in the last); Chromium accessibility tree shows no node for decorative and listbox separators
- [ ] 5.2 Virtual screen reader reading-order test: "separator" spoken between two paragraphs, nothing for the decorative one

## 6. Theme (`packages/theme/src/separator.css`)

- [ ] 6.1 Tier-3 tokens `--rind-separator-color`, `-thickness`, `-spacing` read with semantic fallbacks (never declared), `@layer rind.components`, `:where()` selectors; border-drawn, vertical stretch in flex rows (radix-ui/primitives#1926); family `decoration` (request 3); imported from `index.css`
- [ ] 6.2 Forced-colors and `data-tone="danger"` Playwright captures (the separator stays visible; tone has no effect by design)

## 7. Stories (`apps/storybook`)

- [ ] 7.1 Horizontal, vertical in a flex row, decorative, rendered as `hr`, labelled, in a toolbar, in a menu, in a listbox popup, the "text divider" recipe; ARIA snapshots per story; all pass axe

## 8. Docs

- [ ] 8.1 Generated docs page (stateless component: anatomy, props, `data-*`, role rules by context, the Splitter boundary, text-divider recipe, driver example) and `llms.txt` entry
- [ ] 8.2 Set Separator to `wip` / `done` in `docs/components.md` as it progresses; archive when approved

## 9. Proof

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for core, react, testing, theme
