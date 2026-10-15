# Progress — research

Status: done · Wave: 2

Progress shows how far a task has advanced (determinate) or that it is running with no
known end (indeterminate), as a bar or a ring. Seven libraries ship it: Ark/Zag, Radix,
React Aria, Base UI, Reka, Bits and Kobalte (the Ariakit UI kit has one too, outside the
headless package). It has no interaction; its difficulties are naming, value text,
edge values and visuals. [Meter](meter.md) shares the same value model; see
"Shared with Meter" below.

Sources read 2026-10-14 (local clones; React Aria with `git show HEAD:` at `e04377c`).

## Pattern

- No APG pattern of its own (accessibility.md §1.5): ARIA role
  [`progressbar`](https://www.w3.org/TR/wai-aria-1.2/#progressbar).
- Roles and attributes: `role="progressbar"`; `aria-valuenow` within
  `aria-valuemin`/`aria-valuemax` (defaults 0 and 100); `aria-valuetext` for a human
  value; **indeterminate = no `aria-valuenow`** (ARIA 1.2); a name is required
  (accessibility.md §2) — `aria-labelledby` the visible label; `aria-busy` belongs on the
  region being loaded, not on the progressbar. `aria-orientation` is not supported on
  `progressbar`.
- Keyboard: none. Not focusable.
- Not a live region (accessibility.md §7.4: "Progress/Meter are not live").

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/progress/src/{progress.machine.ts, progress.connect.ts,
  progress.types.ts, progress.dom.ts}`; Ark `ark/packages/react/src/components/progress/*`.
- Parts: Root, Label, Track, Range, ValueText, View (shown per state), Circle,
  CircleTrack, CircleRange.
- Props: `value`/`defaultValue` (`number | null`, `null` = indeterminate; an omitted
  default becomes the midpoint), `min`/`max`, `orientation`, `formatOptions` (default
  percent), `locale`, `translations.value(...)` (default "loading..." for `null`).
- ARIA: `role="progressbar"` on **Track** (and on the Circle `svg`), `aria-label` =
  value text (the value becomes the *name*); the Label part is not referenced.
  ValueText is `aria-live="polite"` — the only live progress in any library.
- `data-state="indeterminate | loading | complete"`, `data-value`, `data-max`,
  `data-orientation`; `--percent` on Root.
- Circular: inline CSS on two SVG circles from user `--size`/`--thickness`
  (`--radius`, `--circumference`, `stroke-dashoffset`); indeterminate drops the
  dasharray; `opacity: 0` at value 0 hides the round-cap dot.
- Problems: validation throws at init but clamps to `0` instead of `min` later; no
  reduced-motion story; indeterminate circle shows a full static ring (ZG#1716).

### Radix / Reka UI

- Source: `radix/packages/react/progress/src/progress.tsx`;
  `reka-ui/packages/core/src/Progress/{ProgressRoot,ProgressIndicator}.vue`.
- Parts: Root, Indicator. `value` (default `null`), `max`, `getValueLabel(value, max)`
  (default rounded percent) → `aria-valuetext` (Reka: → `aria-label`, later
  `getValueText` → valuetext). `min` is fixed at 0.
- Invalid `max` (≤ 0, NaN) logs and falls back to 100; an out-of-range value logs and
  becomes `null` — silently indeterminate.
- `data-state`, `data-value`, `data-max`. No fill style: users compute
  `translateX(-(100 - value)%)`, which ignores `max` (RX#3112).

### Base UI

- Source: `base-ui/packages/react/src/progress/{root,track,indicator,value,label}/*`.
- Parts: Root, Label, Track, Indicator, Value. `value: number | null`, `min`/`max`,
  `format` + `locale`, `getAriaValueText(formatted, value)`; default valuetext for
  `null` is "indeterminate progress".
- One clamped value and one percentage feed `aria-valuenow`, the text and the fill
  (after PR#5095 and PR#4904 fixed them drifting apart).
- Status `progressing | complete | indeterminate` as `data-progressing`,
  `data-complete`, `data-indeterminate` on every part. Value part is `aria-hidden`.
- **NVDA workaround** (BU#4184, PR#4200): Root always appends a visually hidden
  `<span role="presentation">x</span>`; Label gets `role="presentation"`. NVDA ignores
  the name of a progressbar that has no text content (nvda#13904); JAWS still drops
  it (FreedomScientific standards-support #354, #650).
- No circular part, no reduced motion.

### React Aria / RAC

- Source: `packages/react-aria/src/progress/useProgressBar.ts`,
  `react-aria-components/src/ProgressBar.tsx`.
- `value` (default 0), `minValue`/`maxValue`, `isIndeterminate` (a separate boolean),
  `formatOptions` (default percent), `valueLabel`, `label`. The label is a `span`
  (a progressbar is not labelable by `<label>`) referenced by `aria-labelledby`; dev
  warning when no name. Indeterminate omits `aria-valuenow` and `aria-valuetext`. An
  empty range (`min === max`) gives 0 % (RS#10042). Render props `percentage`,
  `valueText`, `isIndeterminate`; no data attributes.

### Kobalte

- Source: `kobalte/packages/core/src/progress/*` — built on its Meter:
  `<Meter role="progressbar" indeterminate>`. Root, Label, ValueLabel, Track, Fill;
  `getValueLabel`; `data-progress="loading | complete"`, `data-indeterminate`;
  `--kb-progress-fill-width`. `min === max` yields NaN (unguarded).

### Bits UI

- Source: `bits-ui/packages/bits-ui/src/lib/bits/progress/progress.svelte.ts`. One part;
  `value | null`, `min`, `max`; no `aria-valuetext`, no label part;
  `data-state="indeterminate | loading | loaded"`. Progress once emitted `role="meter"`
  (BITS#1183), which split Meter out.

### Ariakit UI kit

- Source: `ariakit/packages/ariakit-ui/src/components/progress.ariakit.react.tsx`,
  `styles/progress.ts`. `value` in 0–1; circular via a **conic-gradient mask**; the only
  implementation with an explicit reduced-motion design (indeterminate segment rests in
  the middle, `motion-safe:` animations) and forced-colors `Highlight`.

## Accessibility

- **Name.** `aria-labelledby` → the Label part (a `span`, not `<label>`); `aria-label`
  only from the consumer. Never use the value text as the name (Zag, Reka:
  "NaN%" overriding the author's label, RK#1871). A missing name is a dev error
  (rule 1).
- **NVDA / JAWS drop the name** of a progressbar with no text content (BU#4184 → AT
  note §1.2 I). We copy Base UI's visually hidden filler `span` inside Root as a quirks
  registry entry (`nvda-progressbar-name`), rendered always (server too, so no
  hydration difference) and documented as not fixing JAWS.
- **Value.** `aria-valuenow` is the clamped value in the consumer's units, never a
  percent (BU#2263). `aria-valuetext` from `Intl.NumberFormat` (default percent of the
  range) through `messages.valueText`; only when `aria-valuenow` is set (RK#1871).
  Indeterminate omits both.
- **The ValueText part is `aria-hidden`.** It repeats the valuetext; in browse mode it
  would be read twice.
- **Not live.** Progress does not speak changes. A completion message is opt-in and
  goes through the Announcer (polite, keyed), once, when the value reaches `max` from
  below — never on mount and never per update (a live region per tick floods the user;
  Zag's `aria-live` ValueText does exactly that).
- **Forced colors.** The fill must not be a background only (RS#4069): theme uses
  `Highlight` for the fill and a `CanvasText` border on the track; the circular
  indicator uses `stroke` with system colours.
- **Reduced motion.** Indeterminate animation and the fill transition run only under
  `prefers-reduced-motion: no-preference` (duration tokens are already 0 under
  reduce); the reduced indeterminate state is a static segment (Ariakit's choice),
  still distinguishable from determinate by its pattern, not only colour. Fill
  transitions lag fast updates (RS#1104): short, and off while `data-state` is
  `indeterminate`.
- **Native-platform check.** `<progress>` maps to `progressbar` but is inconsistent
  across browsers and AT and unstylable without engine pseudo-elements (BU#4558, Scott
  O'Hara's guidance quoted there). We render a `div`.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [BU#4184](https://github.com/mui/base-ui/issues/4184) (open, read) | NVDA/JAWS say "progress bar 40%" without the label | NVDA ignores a progressbar name with no text content (nvda#13904, #16204); JAWS bugs FS#354/#650 | PR #4200: hidden filler span; JAWS unfixed | Filler span as a quirk entry; document JAWS |
| Base UI | [BU#4616](https://github.com/mui/base-ui/issues/4616) (open, read) | Hydration mismatch "30%" vs "30 %" | `Intl.NumberFormat(undefined)` differs between server and client | `suppressHydrationWarning` proposed | Format with the environment locale; scenario with a provider locale |
| Base UI | [PR#5095](https://github.com/mui/base-ui/pull/5095) (read) | min 20, max 40, value 30: fill 50 % but text "30%" | Text from raw value, fill from normalised | One clamped value + percent | Every output from one normalised value |
| Base UI | [BU#1203](https://github.com/mui/base-ui/issues/1203) (closed, read) | No transition up from 0 | `width` omitted for 0 (falsy check) | Always emit `0%` | 0 is a value |
| Base UI | [BU#2263](https://github.com/mui/base-ui/issues/2263) (closed, read) | `aria-valuenow` was a percent | Normalised too early | PR #2266 | valuenow in consumer units |
| Base UI | [BU#4558](https://github.com/mui/base-ui/issues/4558) (closed, read) | "Why not native `<progress>`?" | Inconsistent AT/browser behaviour | Kept the div | Same decision |
| Radix | [PR#2947](https://github.com/radix-ui/primitives/pull/2947) (merged, read) | Console errors for `value={undefined}` | `!== null` regression | Treat undefined as indeterminate | `null` and `undefined` alike |
| Radix | [RX#3112](https://github.com/radix-ui/primitives/issues/3112) (closed, read) | Docs fill ignores `max`, copied into shadcn/v0 | No fill style; users compute it | Closed as userland | Connect emits the percent (var + inline size) |
| Radix | [RX#3796](https://github.com/radix-ui/primitives/issues/3796) (closed, read) | Runtime SyntaxError from a bundled error template | Long template literal in a dev message | — | Keep dev warnings small, dev-only |
| Reka | [RK#910](https://github.com/unovue/reka-ui/issues/910) (closed, read) | value 0 → `data-state="indeterminate"` | Truthiness check | PR #911 | 0 ≠ null |
| Reka | [RK#1871](https://github.com/unovue/reka-ui/issues/1871) (closed, read) | Indeterminate bar named "NaN%", overriding `aria-label` | Value label bound to `aria-label` | PR #1890 | Value never in the name; valuetext only with valuenow |
| Zag | [ZG#1716](https://github.com/chakra-ui/zag/issues/1716) (closed, read) | Indeterminate circle: full static ring | Visuals left to userland | Shared CSS pointer | Theme ships the indeterminate ring |
| Zag | [ZG#2560](https://github.com/chakra-ui/zag/issues/2560) (closed, read) | `valueAsString` ignores `formatOptions.style` | Two formatting paths | PR #2562 | One formatter for visible and AT text |
| Zag | [ZG#2532](https://github.com/chakra-ui/zag/issues/2532) (closed) | `defaultValue: null` not indeterminate | `??` collapsed `null` | PR #2533 | Indeterminate is explicit `null`/`undefined` value |
| Zag | [ZG#1361](https://github.com/chakra-ui/zag/issues/1361) (closed) | Wrong ring diameter | Radius ignored stroke width | PR #1362 | `pathLength="100"` + inset stroke: no radius math in JS |
| Zag | [ZG#2535](https://github.com/chakra-ui/zag/issues/2535) (closed) | Vertical orientation broken | Prop not wired | PR #2536 | Model test per orientation |
| Zag | [ZG#2285](https://github.com/chakra-ui/zag/issues/2285) (closed) | Decimal values rejected | Rounding | PR #2286 | Never round the value |
| Ark | [ARK#2589](https://github.com/chakra-ui/ark/issues/2589) (closed, read) | Circular crashes in Solid | SVG prop normalisation | zag e4c54c1 | SVG parts tested per adapter |
| React Aria | [RS#10042](https://github.com/adobe/react-spectrum/issues/10042) (closed, read) | NaN % and NaN valuetext when `min === max` (0 of 0 tasks) | Division by zero | PR #10169 → 0 | Empty range = 0 %, dev warning |
| React Aria | [RS#9987](https://github.com/adobe/react-spectrum/issues/9987) (closed, read) | Missing-label warning on a decorative, `aria-hidden` bar | Unconditional warning | Won't fix | Skip the name check when the root is `aria-hidden` |
| React Aria | [RS#1104](https://github.com/adobe/react-spectrum/issues/1104) (closed, read) | Bar lags fast updates | Long width transition | Fixed in S2 | Short transition, theme-owned |
| React Aria | [RS#4069](https://github.com/adobe/react-spectrum/issues/4069), [RS#4105](https://github.com/adobe/react-spectrum/issues/4105) (closed) | Fill invisible in forced colors | Background stripped | `Highlight` | Forced-colors rule in the theme |
| MUI | [MUI#26900](https://github.com/mui/material-ui/issues/26900) (closed, read) | axe: progressbar has no name | Unlabelled examples | Docs fixed | Dev error for a missing name; stories labelled |
| MUI | [PR#48172](https://github.com/mui/material-ui/pull/48172) (merged, read) | No `min`/`max`; bad maths for `min ≥ max` | — | Dev checks; 0 % | Same |
| Bits | [BITS#1183](https://github.com/huntabyte/bits-ui/issues/1183) (closed, read) | Progress rendered `role="meter"` | Role mix-up | Meter split out | Separate components, shared model |
| Ariakit | [AK#6510](https://github.com/ariakit/ariakit/pull/6510) (merged, read) | Empty bar with a % value | `@property <number>` rejects `%`, falls back to 0 | Matcher removed | Unitless custom properties, no `@property` typing in core |
| Kobalte | `progress/progress-root.tsx` (source) | NaN for `min === max` | Unguarded division | — | Same guard |

## Known pitfalls

1. **0 versus null** (RK#910, BU#1203, PR#2947, ZG#2532): indeterminate only for
   `null`/`undefined`; 0 is determinate and renders `0%`.
2. **Value as the name** (Zag, Reka, RK#1871).
3. **NVDA/JAWS name loss** (BU#4184).
4. **Empty and inverted ranges** (RS#10042, PR#48172, Kobalte): `min ≥ max` → dev
   warning, percent 0, no NaN anywhere.
5. **Out-of-range values**: clamp with a dev warning (Base UI), never silently become
   indeterminate (Radix/Reka) or throw (Zag).
6. **Separate computations drift** (BU PR#5095, #4904, #2263).
7. **SSR locale** (BU#4616).
8. **Visuals in userland** (RX#3112, ZG#1716): ship percent variables and the
   indeterminate and circular recipes in the theme.

## Testing notes

- Machine-free logic: all attributes are a pure function of props, testable in Node.
- Driver queries: `value()` (`aria-valuenow` as number or `null`), `valueText()`,
  `percent()` (from the Indicator's `--rind-progress-percent`), `state()`
  (`data-state`), `isIndeterminate()`; action `none` (Progress has no user actions).
  Announcements are read from the recording announcer.
- Model steps are prop steps (`$props:value`) through `rerender`: loading → complete
  announces once; complete → complete does not; mount at `max` does not.
- Visual checks: forced colors and reduced motion captures of the indeterminate bar
  and ring (Playwright `emulateMedia`).

## Shared with Meter

Progress and Meter are the same value model with a different role: Kobalte builds
Progress on Meter; Base UI copies the same parts. Neither needs state of its own — every
attribute is a pure function of `{ value, min, max, formatOptions, locale }`. So both
use one **machine-less model**, `core/components/shared/range-value.ts`:

- `resolveRangeValue({ value, min, max })` → `{ value: number | null, min, max,
  fraction, percent }` — clamps, guards `min ≥ max` (fraction 0), keeps `null` as
  indeterminate (Meter never passes `null`), dev warnings for out-of-range or inverted
  ranges.
- `rangeValueText(resolved, { locale, formatOptions, messages })` → the
  `aria-valuetext` string, from the cached `format.number` of `add-a11y-foundations`
  (default `{ style: "percent" }` applied to the fraction).
- `rangeValueAttributes(resolved, text)` → `aria-valuenow/min/max/valuetext` and
  `--rind-<scope>-percent`.
- Meter adds `meterZone(resolved, { low, high, optimum })`.

Each connect (`progress.connect.ts`, `meter.connect.ts`) is then a thin mapping over
this module. A one-state service exists only because contracts, drivers and
`testMachine` are keyed by a machine; Progress's also hosts the opt-in completion
announcement (a prop-change event, the only behaviour either component has).

## Reado

`organisms/guided/SessionProgress.tsx` hand-rolls `role="progressbar"` with `aria-label` built from the counts and guards `total === 0` with `flexGrow: total || 1`: it migrates to `Progress` (`max={total}`, the empty range handled by the shared model). `organisms/CoveragePanel.tsx`'s bar has no role at all and measures coverage, not a task: it becomes a `Meter`.

## Decisions

- **Parts**: `Root` (`div`, `role="progressbar"`), `Label` (`span`; Root's
  `aria-labelledby`), `ValueText` (`span`, `aria-hidden`, default children = the value
  text), `Track`, `Indicator` (inline `inline-size`/`block-size` percent and
  `--rind-progress-percent`), and for the ring `Circle` (`svg`, `aria-hidden`),
  `CircleTrack` and `CircleIndicator` (`circle` with `pathLength="100"`,
  `stroke-dasharray="100"`, `stroke-dashoffset` = `100 − percent`). The filler span
  for NVDA is internal to Root.
- **Props**: `value: number | null` (default `null`), `min` 0, `max` 100,
  `orientation` (`data-orientation` only), `formatOptions`, `locale`, `messages`
  (`valueText({ value, percent, formatted })`, `complete`), `announceCompletion`
  (default `false`: when true, `messages.complete` — default "Complete" — is announced
  politely once when the value reaches `max` from below).
- **Machine**: one state `idle`; `onProps: { value: "VALUE.CHANGE" }`; on
  `VALUE.CHANGE` the guarded action `announceCompletion` runs when the previous value
  was below `max` (or `null`) and the new one equals `max`. Context: previous value.
- **`data-*`**: `data-state="indeterminate | loading | complete"` and
  `data-orientation` on every part; `data-value`, `data-max`, `data-min` on Root.
- **Contract**: anatomy, locate by role `progressbar` + name; no actions; queries
  `value`, `valueText`, `percent`, `state`, `name`; traits `valued`; announcements
  declared for the completion message.
- **Different from the others**: shared machine-less model with Meter; role on Root
  (not Track — Zag); valuetext never in the name; filler span as a registered quirk;
  completion announced through the Announcer (no library does), opt-in; ring via
  `pathLength` (no radius maths, no measured size); theme ships indeterminate and
  reduced-motion visuals.

## Open questions

- Is the filler span still needed for current NVDA (2026.x)? Re-test yearly through the
  quirk entry; remove when nvda#16204 is fixed.
- Should an indeterminate bar carry a default `aria-valuetext` ("Loading")? APG and
  React Aria say no; Base UI says "indeterminate progress". We emit none; revisit after
  manual AT testing.
