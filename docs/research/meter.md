# Meter — research

Status: done · Wave: 2

A Meter shows a scalar measurement within a known range — disk usage, battery,
password strength, test coverage — as opposed to [Progress](progress.md), which shows
how far a task has advanced. Four libraries ship it: React Aria, Base UI, Bits UI and
Kobalte. It has no interaction and no indeterminate state. It shares Progress's
machine-less value model (`core/components/shared/range-value.ts`, described in
[progress.md — Shared with Meter](progress.md#shared-with-meter)); this note only adds
what is meter-specific.

Sources read 2026-10-14 (local clones; React Aria with `git show HEAD:` at `e04377c`).

## Pattern

- WAI-ARIA APG: [Meter](https://www.w3.org/WAI/ARIA/apg/patterns/meter/).
- Roles and attributes: `role="meter"` (ARIA 1.2); `aria-valuenow` (required),
  `aria-valuemin`, `aria-valuemax`; `aria-valuetext` when the number is not the human
  value; a name (required). No keyboard interaction, not focusable. APG: "do not use
  meter for progress"; a meter's value is never indeterminate.
- Native `<meter>` has `low`, `high` and `optimum`, which decide its colour through the
  HTML "optimum / suboptimal / even less good" regions. ARIA has **no equivalent**
  ([w3c/aria#1336](https://github.com/w3c/aria/issues/1336)); AT is not told the region.

## How the others built it

### React Aria / RAC

- Source: `packages/react-aria/src/meter/useMeter.ts`, `react-aria-components/src/Meter.tsx`.
- `useMeter` = `useProgressBar` + `role: "meter"`. Until PR#10654 the role was
  `"meter progressbar"`, a fallback for Chrome/Firefox without meter support (crbug
  944542, bmo 1460378); axe checks only the first token and reported
  `aria-allowed-attr` on every Meter (RS#6627, RS#10737), so the fallback was dropped
  ("fixed since 2021"). Default `formatOptions` percent; `valueLabel`; render props.
  No low/high/optimum; Spectrum's colour variants are chosen by the consumer (PR#6282).

### Base UI

- Source: `base-ui/packages/react/src/meter/{root,track,indicator,value,label}/*`.
- Same parts as its Progress: Root, Label, Track, Indicator, Value; `value` required and
  clamped; `format`, `locale`, `getAriaValueText`. Plain `role="meter"`. The NVDA filler
  span (BU#4184) is applied to Meter too. `aria-valuenow` was once a percent (BU#2263).
  Low/high/optimum requested and open (BU#1434; the maintainers suggest carrying the
  meaning in the valuetext).

### Kobalte

- Source: `kobalte/packages/core/src/meter/*`. Root, Label, ValueLabel, Track, Fill;
  `getValueLabel`; `--kb-meter-fill-width`; Progress is built on Meter (KB#316, PR#500).
  `min === max` gives NaN.

### Bits UI

- Source: `bits-ui/packages/bits-ui/src/lib/bits/meter/meter.svelte.ts`. One part,
  `role="meter"`, valuemin/max/now, no valuetext, no label part. Split out of Progress
  after Progress emitted `role="meter"` (BITS#1183).

## Accessibility

- **Role support.** `role="meter"` alone (no `"meter progressbar"` fallback: it fails
  axe and current Chrome, Firefox and Safari expose meter). VoiceOver reads the label
  correctly; NVDA announces the role (sometimes as "progress bar") and value but drops
  the label unless the element contains text, and JAWS drops it in the virtual cursor
  (BU#4184). So Meter gets the same visually hidden filler span as Progress, under the
  same quirk entry. TalkBack was not tested by any source: manual protocol item.
- **Name, value, text**: as Progress — `aria-labelledby` the Label; `aria-valuenow` the
  clamped value in the consumer's units; `aria-valuetext` from `Intl.NumberFormat`
  through `messages.valueText`; ValueText `aria-hidden`.
- **Regions.** When the consumer sets any of `low`, `high`, `optimum`, the meter computes
  the HTML region and exposes it as `data-zone="optimum | suboptimum | even-less-good"`
  for the theme, and passes it to `messages.valueText` so the region can be spoken
  ("80 % — high"). It is never the only cue: colour alone fails 1.4.1, so the theme
  also marks non-optimum zones with a pattern or border, and the docs tell consumers to
  put the meaning in the text.
- **Not live.** A changing meter (live CPU load) does not announce; consumers who need
  that use the Announcer with their own thresholds.
- **Forced colors**: fill `Highlight`, track border `CanvasText`; zones keep a non-colour
  cue.
- **Native-platform check.** `<meter>` maps to `meter` (html-aam) and has native regions,
  but is styled only through engine pseudo-elements and its regions are not exposed to
  AT; every library renders a `div`. We do too.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [RS#6627](https://github.com/adobe/react-spectrum/issues/6627) (closed, read) | axe `aria-allowed-attr` (critical) | `role="meter progressbar"`; axe reads the first token | Called a false positive | Role fallbacks trip linters |
| React Aria | [RS#10737](https://github.com/adobe/react-spectrum/issues/10737) (closed, read) | Every Meter fails axe in CI | Same; role merged last, not overridable | [PR#10654](https://github.com/adobe/react-spectrum/pull/10654) drops the fallback | Plain `role="meter"` |
| React Aria | [RS#10042](https://github.com/adobe/react-spectrum/issues/10042) (closed, read) | NaN when `min === max` | Division by zero | Guarded | Shared model guards it |
| Base UI | [BU#4184](https://github.com/mui/base-ui/issues/4184) (open, read) | Meter label not read by NVDA/JAWS | No text content (nvda#13904) | Filler span (NVDA only) | Same quirk entry as Progress |
| Base UI | [BU#2263](https://github.com/mui/base-ui/issues/2263) (closed, read) | `aria-valuenow` was a percent | Normalised too early | PR #2266/#2267 | valuenow in consumer units |
| Base UI | [PR#4904](https://github.com/mui/base-ui/pull/4904) (merged, read) | Text and fill disagree on custom ranges; out-of-range values shown | No clamp | Clamp and sync | One normalised value |
| Base UI | [PR#5409](https://github.com/mui/base-ui/pull/5409) (merged) | Formatted text showed the unclamped value | — | Format the clamped value | Same |
| Base UI | [BU#1434](https://github.com/mui/base-ui/issues/1434) (open, read) | No low/high/optimum | No ARIA equivalent (w3c/aria#1336) | Open; suggests valuetext | `data-zone` + zone in `messages.valueText` |
| Base UI | [BU#4616](https://github.com/mui/base-ui/issues/4616) (open, read) | SSR valuetext mismatch | Runtime default locale | — | Environment locale |
| Bits | [BITS#1183](https://github.com/huntabyte/bits-ui/issues/1183) (closed, read) | Progress and meter confused | Role mix-up | Meter split out | Two components, one model; meter never indeterminate |
| Kobalte | [KB#316](https://github.com/kobaltedev/kobalte/issues/316) / [PR#500](https://github.com/kobaltedev/kobalte/pull/500) (closed) | Meter added, Progress refactored onto it | — | — | Shared base, different role |
| React Aria | [PR#6282](https://github.com/adobe/react-spectrum/pull/6282) (merged) | "informative" variant | Spectrum variants are consumer-chosen | — | Zones only when the consumer gives thresholds |

## Known pitfalls

- Role fallbacks that break axe (RS#6627, RS#10737).
- Name loss in NVDA/JAWS (BU#4184).
- Percent in `aria-valuenow` (BU#2263); unclamped text (PR#5409); NaN for an empty range
  (RS#10042).
- Colour-only zones (1.4.1).
- Using Meter for task progress (BITS#1183); APG says no.

## Testing notes

- Pure function of props: Node tests for `meterZone` against the HTML algorithm's cases
  (optimum below `low`, between, above `high`; `low`/`high` clamped to the range and
  ordered as HTML does).
- Driver queries: `value()`, `valueText()`, `percent()`, `zone()`, `name()`. No actions.
- Model steps are prop steps (value across `low`/`high`) through `rerender`; invariants:
  `valued`, name present, `aria-valuenow` never absent, `data-zone` absent without
  thresholds.

## Decisions

- **Parts**: `Root` (`div role="meter"`), `Label`, `ValueText` (`aria-hidden`),
  `Track`, `Indicator` (inline size + `--rind-meter-percent`). No circular parts:
  ring meters reuse Progress's ring recipe in the theme only if a consumer asks (open
  question). Filler span internal to Root.
- **Props**: `value: number` (required), `min` 0, `max` 100, `low`, `high`, `optimum`,
  `formatOptions` (default percent), `locale`, `messages.valueText({ value, percent,
  formatted, zone })`.
- **Zones**: HTML's algorithm — `low` clamped to `[min, max]` (default `min`), `high`
  clamped to `[low, max]` (default `max`), `optimum` clamped to `[min, max]` (default
  midpoint); the region containing `optimum` is optimum, the adjacent one suboptimum,
  the far one even-less-good. `data-zone` only when one of the three props is set.
- **Machine**: a one-state service (`idle`, no events) so the contract, driver and
  `testMachine` (prop steps) apply; all logic is in `range-value.ts`.
- **`data-*`**: every part carries `data-zone` (when set) and `data-orientation`; Root
  carries `data-value`, `data-min`, `data-max`.
- **Contract**: locate by role `meter` + name; queries above; trait `valued`.
- **Different from the others**: optimum zones (no library has them); shared
  machine-less model with Progress; no role fallback; NVDA filler as a registered
  quirk.

## Open questions

- A circular meter (gauge): theme recipe on Meter's Track/Indicator, or ring parts
  shared with Progress? Defer until a consumer needs it (Reado's coverage bar is
  linear).
- Is NVDA's "progress bar" wording for `meter` still current? Manual protocol.
