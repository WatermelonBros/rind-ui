## 0. Prerequisites

- [x] 0.1 Confirm `add-a11y-foundations`, `add-checkbox` (`hidden-form-input`, `control-label`), and `add-theme-system` are merged, and that the requests in design.md (`hidden-form-input` accessible native input, `range` theme family, iOS scroll-lock touch exemption) are applied or answered

## 1. Machine

- [x] 1.1 `slider.math.ts`: decimal-safe snap (exponent notation), clamp, neighbour bounds with gap, `largeStep` default, normalisation with dev warnings, collision policies `stop`/`push`/`swap`, `pickThumb` (nearest enabled, ties, stacks); Node tests incl. BU#4547, BITS#1518, RX#3852, ZG#2504, ZG#2488, RA#6408
- [x] 1.2 `slider.machine.ts`: states `idle`/`dragging`, events per design §2, controllable `value` with element-wise `equal`, commit actions, pending marker for controlled proposals, effects `trackDrag`, `formInput`, `disabledWatch`
- [x] 1.3 Node tests: keys in every orientation/direction, track press, thumb press without jump, stacked thumbs, cancel/Escape revert, commit counts (tap, fast drag, range narrowed, held key, controlled refuse), AT adjust accepted/rejected, reset without commit

## 2. Shared drag module

- [x] 2.1 `core/dom/pointer-drag.ts` per `pointer-drag`: fraction mapping (RTL, vertical, padding, grab offset, inset), capture + document listeners only while active, cancel on `pointercancel`/`lostpointercapture`/hidden document, buttons-0 move = release
- [x] 2.2 jsdom and browser tests: no capture available, zero-size surface, second pointer ignored, listeners removed (BU#3311), capture lost (BU#1910)

## 3. Connect

- [x] 3.1 `slider.connect.ts`: parts and attributes per design §4, positions for `center`/`contain`, `touch-action`/`user-select`, thumb input labelling (`aria-labelledby` label + self, `aria-label` thumb name), `data-*` per spec, Label press focus with pointer modality
- [x] 3.2 `slider.messages.ts`: `thumbLabel`, `valueText`; value text through `format.number`, `formatRange`, `Intl.ListFormat`

## 4. React parts

- [x] 4.1 `Slider.Root`, `Label`, `ValueText`, `Control`, `Track`, `Indicator`, `Thumb` (with its input), `MarkerGroup`, `Marker`, `Description`; `render` on every part; value shape conversion at the boundary
- [x] 4.2 React tests: SSR + hydration for single and range (RX#615), `contain` server markup without script, no controlled `value` prop reaching the input, form submission order (RX#2454), Enter submits (RX#2541)

## 5. Test adapters

- [x] 5.1 `Part.box()`, `Part.pointer(phase, { at, pointerType })`, `Part.fill(value)` in the DOM and Playwright adapters per `test-drivers`; tests in both

## 6. Contract and driver

- [x] 6.0 `valued` extension in `@rind-ui/testing` per `model-based-testing` "Valued Trait Expectations" (lists, `null`, contract value text, locale grouping); broken fixtures prove it fails for a stale thumb and for `aria-valuenow` on a `null` entry

- [x] 6.1 `slider.contract.ts`: anatomy, locate, actions, queries, observations, traits `valued`/`directional`/`form-associated`, "needs layout" failure
- [x] 6.2 `sliderInvariants` per spec; broken-wrapper fixtures prove each fails (extra `span[role=slider]`, blur/refocus on key, unsorted values, NaN style, double commit)
- [x] 6.3 `getSlider` exported; the same driver test passes in `browser`, `jsdom` and Playwright

## 7. Model-based tests

- [x] 7.1 `testMachine(sliderContract, …)` over all transitions with the configurations of design §6, pointer and touch in browser mode, keyboard and virtual in both, `dir="rtl"` runs
- [x] 7.2 Scenario tests outside the model: Escape inside a Dialog (layer stays open), `pointercancel` then tap elsewhere (BU#5637), release outside an iframe (BU#1910), vertical page scroll on touch emulation (RX#570: `touch-action` asserted; real-touch check in the manual protocol, backlog), iOS long press (BU#1295), slider in a modal with scroll lock (RA#9493, WebKit project), hidden-then-shown slider (BU#4303), no focus/blur during key steps (BU#5296)

## 8. Theme

- [x] 8.1 `packages/theme/src/slider.css` per design §7: `@layer rind.components`, `:where()` selectors, `--rind-slider-*` tokens read with fallbacks and never declared, `range` family variants and sizes, `data-tone="danger"`, hit area ≥ 24×24, forced-colors rules, vertical and RTL, no transitions while dragging; imported from `index.css`
- [x] 8.2 Playwright captures: forced colors (ARK#3421), RTL, vertical, `contain`, reduced motion

## 9. Stories

- [x] 9.1 Site examples (apps/site/examples/slider.tsx; Storybook is retired), themed: single, range, three thumbs, gap + each collision policy, vertical, RTL, `contain`, markers, currency value text, disabled thumb, read-only, in a form with reset, controlled, driver example; state example `idle` (`dragging` cannot be held by a static page: docs/review-backlog.md); axe clean in the model tests

## 10. Docs

- [x] 10.1 Docs page (generated API facts): anatomy, props, `data-*`, keyboard table, commit semantics, collision policies, alignment and `--rind-slider-thumb-size`, form behaviour, driver example, known AT quirks (VO interaction-mode lag), `llms.txt` entry

## 11. Proof

- [x] 11.1 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green

## Amendments (from add-field)

- [x] A.1 `field-control` binding in `Slider.Root`: register once as one control (thumbs never register; first thumb input as validity element), Field ARIA on the thumb inputs, `required` as `data-required` only, OR-merged flags with Field and Fieldset, change and commit reports, focus target = first thumb input, `field-associated` trait, Field prop × control matrix test

## Amendments (from add-field, add-form)

- [x] A.2 Reset target decision (shared `hidden-form-input` "Form Reset"): a form reset restores the current `defaultValue` prop; the thumb inputs' `value` attribute follows it; a `defaultValue` change never moves the thumbs; test: `defaultValue` 30 → 50, user moves to 70, reset → 50

## Amendments (from add-number-input)

- [x] A.3 Move `snap`, `roundToStepPrecision`, `clamp` and decimal counting (incl. exponent notation) from `slider.math.ts` to `core/shared/step-math.ts` with no behaviour change; `slider.math.ts#settle` imports them; their Node tests (BU#4547, RX#3852) move with them and the Slider tests stay green unchanged
