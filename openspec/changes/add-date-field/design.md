## Context

[date-field.md](../../../docs/research/date-field.md) has the comparison, the segmented vs
masked evidence and the bug history. This change builds on, and does not re-specify:

| Change | What Date Field uses |
|---|---|
| `add-calendar` | `date-values` (types, calendar systems, the clock, formatting, constraints, ISO) |
| `add-foundations` | runtime, controllables, `$sync`/`$reverted`, `ChangeDetails`, effects, contracts, drivers, `testMachine` |
| `add-a11y-foundations` | `keyboard-interactions` (value keys, IME guard; see Requests), `interaction-modality` (`data-focus-visible`, `focusSafely`), `announcer` (through the Field), `i18n-messages`, `element-ids`, `a11y-quirks`, `platform-and-preferences`, `hidden-content` (value description node) |
| `add-field` | `field`, `field-control` binding (`mergeFieldProps`), `field-validation` (display, announcements, touched) |
| `add-text-field` | Root-as-Field (the shared `use-field-host` helper add-number-input requested) |
| `add-checkbox` | `hidden-form-input` (declared input type, property mirroring, user-change events, reset, adoption, focus redirect, validity element) |
| `add-number-input` | `number-parsing` (`isPartial`, locale digits incl. full width), the `ios-vo-spinbutton-input` quirk entry |
| `add-theme-system` | family `field` (request in add-calendar), stylesheet convention |

## Goals / Non-Goals

**Goals:**
- One pure segment model (`date-segments`) testable in Node for every locale, calendar and
  cycle, reused unchanged by Time Field and the later range fields and picker input.
- A machine whose value changes only at commit points.

**Non-Goals:**
- A single-tab-stop mode, steps, milliseconds (proposal Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/components/date-segments/
├─ segments.ts        segmentList(value | placeholder, { locale, calendar, granularity, maxGranularity,
│                     hourCycle, timeZone, hideTimeZone, forceLeadingZeros }) → Segment[] (pure, cached formatter)
├─ draft.ts           Draft = per-type { value: number | null; text: string }, fromValue, toValue (real date or null),
│                     limits(type, draft, calendar), cycle(type, amount), toHourCycle/fromHourCycle
├─ typing.ts          planDigit(draft, type, char, buffer) → { draft, buffer, advance }, dayPeriodMatch, eraMatch
├─ paste.ts           parsePaste(text, valueType, segments, locale) → value | null
├─ validity.ts        validity(draft, value, { min, max, isDateUnavailable, required }) → ValidityFlags + message key
└─ names.ts           segmentName(type, locale) via Intl.DisplayNames, valueText
packages/core/src/components/date-field/
├─ date-field.machine.ts
├─ date-field.connect.ts
├─ date-field.contract.ts   contract + dateSegmentInvariants (exported for Time Field)
└─ date-field.messages.ts
packages/react/src/date-field/   Root, Label, Description, ErrorMessage, Input, Segment
packages/theme/src/date-field.css
```

### 2. Native inputs, not `contenteditable`

Each editable segment renders `<input type="text" role="spinbutton">` (Number Input's shape).
What it buys, each against a bug in the research table: `beforeinput` rejection on a real
input (bits-ui#1988, react-spectrum#3739), no document-selection handling (react-spectrum#10259,
#10387), normal IME composition (bits-ui#1668 and React Aria's selection-collapse workaround),
the typed text is the input's own value so leading zeros show (react-spectrum#6004/#8637/#9952),
ordinary `paste`/`copy` events (react-spectrum#5285), default focus and read-only behaviour
(reka-ui#2007), fewer extension overlays (react-spectrum#6169). The cost: the caret is hidden
with `caret-color: transparent` and the whole text is selected on focus (as the native date
input highlights its sub-field); width comes from `size` (all engines) and the theme may add
`field-sizing: content`.

*Alternative*: React Aria's `contenteditable` spans — the reference implementation, but most of
its open bugs are `contenteditable` bugs. *Alternative*: one masked input — loses part names and
bounds for AT (research note table).

### 3. Machine

```ts
type DateFieldEvent =
  | { type: "SEGMENT.FOCUS"; segment: SegmentType; modality: Modality }
  | { type: "SEGMENT.BLUR"; related: "segment" | "outside" }
  | { type: "INPUT"; segment: SegmentType; data: string; inputType: string }   // beforeinput, after the plan accepted it
  | { type: "COMPOSITION.START" } | { type: "COMPOSITION.END"; segment: SegmentType; text: string }
  | (LogicalKeyEvent & { segment: SegmentType })                               // INCREASE DECREASE PAGE_* FIRST LAST NEXT PREV
  | { type: "BACKSPACE"; segment: SegmentType } | { type: "SEPARATOR"; segment: SegmentType }
  | { type: "CLEAR_ALL" }                                                       // select all + Backspace/Delete
  | { type: "PASTE"; text: string } | { type: "COPY"; segment: SegmentType }
  | { type: "GROUP.PRESS"; x: number } | { type: "LABEL.PRESS" }
  | { type: "RESET" } | { type: "INPUT.ADOPT"; value: string }

states:
  idle       ── SEGMENT.FOCUS ──► editing / setActive, resetBuffer
             ── LABEL.PRESS | GROUP.PRESS / focusTarget
  editing    ── INPUT [editable, notComposing] / applyDigit → (advance ? commit, focusNext : -)
             ── SEPARATOR [buffer non-empty] / commit, focusNext
             ── INCREASE|DECREASE|PAGE_*|FIRST|LAST [editable, notComposing] / step, commit
             ── NEXT|PREV / focusAdjacentVisual                              (layout capability)
             ── BACKSPACE [editable] / removeDigit | focusPrevious
             ── CLEAR_ALL [editable] / clearAll, commit
             ── PASTE [editable] / applyPaste, commit
             ── COPY / copyText
             ── SEGMENT.FOCUS / commit(previous), setActive, resetBuffer     (Tab / click to another segment)
             ── SEGMENT.BLUR [outside] ──► idle / commit
             ── COMPOSITION.START ──► composing
  composing  ── COMPOSITION.END / applyComposition (digits or day period) ──► editing
  global     RESET / restoreDefault · INPUT.ADOPT / adopt · $sync:value / replaceDraft
             $props:locale|calendar|granularity|hourCycle / recomputeSegments (keep draft, keep active type)
values:      value: controllable("value", { fallback: null, equal: sameInstantOrDay })
             disabled, readOnly: bindProp (from the props merged with the Field)
effects:     focusSegment (moves DOM focus after the step's commit: react-spectrum#10683),
             selectOnFocus, controlValidity (writes the control's validity to the validity element)
```

- **Why these states.** `editing` owns the buffer and the active segment; `composing` disables
  filtering and keys. The draft (per-segment values and texts) is context; it is replaced on
  `$sync:value`, so a controlled `null` clears a partial entry (bits-ui#2174).
- **`commit`** = `toValue(draft)` → real date (in the value's type/calendar/zone via
  `date-values`) or `null`; `onValueChange` only when it differs (`sameInstantOrDay`: `compare()
  === 0` for the type, zag#3117); then `controlValidity`. Typing inside a segment never commits.
- **`focusAdjacentVisual`** uses a small layout capability (`SegmentLayout.adjacent(type,
  direction)`) implemented in `core/dom` from `getBoundingClientRect().left` of the segment
  inputs (React Aria's `findNextSegment`); in jsdom (zero rects) it falls back to format order.
- **Hour cycle and day period** live in the draft as separate fields (`hour` in the display
  cycle, `dayPeriod` 0/1), converted only in `toValue` — never re-derived from a partial hour
  (time-field.md bugs).

- **Embedded mode, boundary and draft hint** (requested by add-date-range-field/add-date-picker). `embedded` is a
  Root prop: the Root skips Field registration and the hidden input (`hidden-form-input` is not rendered), the `input` part
  gets `role="presentation"`, `labelledBy`/`describedBy` replace the Field ids, and `controlValidity` calls
  `onValidityChange(flags, message)` instead of writing to a validity element. `BOUNDARY` is an emitted callback
  (`onBoundary`) when `focusNext`, `focusPrevious` or `focusAdjacentVisual` finds no target; `SegmentLayout.adjacent`
  gains an optional `scope` element (rects of all segments inside it; jsdom still falls back to format order within the
  Root). `onDraftChange({ year, month, day })` is a watch on committed draft segments, fired once per change.

### 4. Connect

| Part | Attributes / handlers |
|---|---|
| Root | Field host attributes (Root-as-Field), `dir`, `lang`, `data-*` |
| Input | `role="group"`, `aria-labelledby` = label, `aria-describedby` = Field ids + value description node, `aria-disabled`; `style: unicode-bidi: isolate`; press → `GROUP.PRESS` (pointer only, not on a segment) |
| Segment (editable) | `<input>` per spec, `id` from `element-ids` (`date-field-<root>-segment-<type>`), `aria-labelledby="<name-node> <label>"`, value attributes, `aria-describedby` on the first only unless invalid, `aria-invalid`, `readOnly`, `disabled`, `value={draft text or ""}`, `placeholder`, `size`, `dir="ltr"` for numerics; `beforeinput` → `planDigit` → `preventDefault` when rejected, else `INPUT`; keydown → `toLogicalKeyEvent(e, { value: "vertical", dir })` (Requests) plus Backspace/Delete, separators, ⌘/Ctrl+A tracking; composition events; `paste`/`copy` (`preventDefault`, machine handles); `focus`/`blur` with `relatedTarget` classification |
| Segment (literal) | `span`, `aria-hidden="true"`, `suppressHydrationWarning` in React (literal text only) |
| Segment name nodes | one visually hidden `span` per editable type (`hidden-content`), text = segment name |
| hidden input | `hidden-form-input`, declared type per spec, `min`/`max`/`step`, value ISO or "", adoption → `INPUT.ADOPT` |

### 5. The control's own validity

`date-segments` errors (incomplete, impossible, unavailable, and range errors that the native
input cannot express, e.g. for `ZonedDateTime` values) must reach native validity so that
`form.checkValidity()`, `:invalid` and the Field agree (field-validation: "native validity is the
source of truth"). Range errors for `date`/`datetime-local` come from native `min`/`max`. The
others need `setCustomValidity` on the validity element, owned by the control — see Requests:
`hidden-form-input` today forbids a re-sync from calling `setCustomValidity` and only lets the
Field clear what it set.

### 6. Contract and model-based tests

- `fill(date)` types each segment's digits as the segment list orders them for the locale, so the
  same call works in `en-US`, `en-GB`, `ja-JP` and `ar-EG` (arab digits typed as Latin, which
  `number-parsing` accepts).
- Configurations: `en-US` day; `en-GB` day (react-spectrum#3256 paths); `de-DE` minute 24-hour;
  `en-US` minute 12-hour; `ZonedDateTime` `Europe/Lisbon` with the DST month step; `ja-JP-u-ca-
  japanese` era; `th-TH` buddhist; `ar-EG` RTL; `required`; `minValue`/`maxValue`;
  `isDateUnavailable`; read-only; disabled by prop step; inside a Field (`change` mode); iOS
  platform preset (quirk active) and Android preset.
- Composition steps (`a11y-test-tooling` `compose`) for full-width digits and the Korean day
  period.

### 7. Theme

`date-field.css`, family `field`: `--rind-date-field-height` (from `--rind-size-control`),
`--rind-date-field-border`, `--rind-date-field-bg`, `--rind-date-field-soft-bg`,
`--rind-date-field-segment-radius`, focused segment background `--rind-date-field-segment-focus-bg`
plus the focus ring, placeholders `--rind-date-field-placeholder-text`, segments `border: 0;
background: transparent; caret-color: transparent; text-align: end` for numerics,
`font-variant-numeric: tabular-nums`, progressive `field-sizing: content`, `data-tone="danger"`,
forced-colors rules.

## Requests to other changes

- **add-a11y-foundations** (`keyboard-interactions`) — RECORDED in docs/review-pending.md items 12–13: a vertical-only value mode
  (`value: "vertical"`): ArrowUp/ArrowDown → `INCREASE`/`DECREASE`, PageUp/PageDown and
  Home/End as today, while ArrowLeft/ArrowRight map to `PREV`/`NEXT` (not value keys). Date
  segments step vertically and move horizontally; `value: true` makes horizontal arrows steps.
- **add-checkbox** (`hidden-form-input`, "Validity Element For Field") — APPLIED (coordinator, 2026-10-14): let the component own a
  **control validity message** on its validity element (incomplete/impossible/unavailable
  dates), set and cleared by the component through one helper that composes with the Field's
  custom validity (the Field's message, when set, is shown; when the Field clears its own, the
  control's remains). Today a re-sync may never call `setCustomValidity`.
- **add-field** (`field-validation`, "Sources And Order") — APPLIED (coordinator, 2026-10-14): treat the control validity message as
  part of source 3 (native constraint validity), with its message, so it is ordered before
  `validate` and displayed per the validation mode.
- **add-number-input** / **add-a11y-foundations** (`a11y-quirks`) — RECORDED in docs/review-pending.md items 12–13: the `ios-vo-spinbutton-input`
  entry requested by add-number-input also covers date segments (same element: an `<input
  role="spinbutton">`); its reproducing test gains a date-segment case.
- **add-theme-system** — APPLIED (coordinator, 2026-10-14): Date Field in family `field` (listed in add-calendar's request).

## Risks / Trade-offs

- [Native inputs differ from every library's segments] → justified bug by bug in §2; the same
  roles and keyboard as React Aria; device checks (VO iOS, TalkBack, Samsung keyboard) before
  `done`.
- [Commit points delay `onValueChange` until a segment is left] → no bogus intermediate years;
  matches Number Input; a consumer wanting every keystroke reads the segments through the
  render function.
- [Impossible dates become `null` + invalid instead of being constrained] → explicit, fixable by
  the user (react-spectrum#9624); the segments keep their text.
- [Control validity needs two requests] → small helper; without it the field still blocks
  submission through Field `validate`, but `checkValidity()` would disagree.

## Migration Plan

None (new component; Reado does not use dates).

## Open Questions

- Device checks: VO iOS typing into a segment with the quirk active; TalkBack with Gboard and
  Samsung Keyboard (`inputMode="numeric"` and the day-period `text` mode).
</content>
</invoke>
