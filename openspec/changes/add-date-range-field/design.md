## Context

[date-range-field.md](../../../docs/research/date-range-field.md) has the comparison and the bug
history. This change builds on, and does not re-specify:

| Change | What the range field uses |
|---|---|
| `add-date-field` | `date-segments` (segments, typing, commit points, validity, paste, RTL, SSR) and the Date Field machine/parts/contract, run as two **embedded** instances (Requests) |
| `add-calendar` | `date-values` (types, calendar, clock, formatting, constraints, ISO) |
| `add-range-calendar` | the range value shape and `start ≤ end`; the pure `availableBounds`/`crossesUnavailable` helpers |
| `add-field` / `add-text-field` | `field-control` registration (one control), `field-validation` (control validity message), Root-as-Field helper |
| `add-checkbox` | `hidden-form-input` (typed input, property mirroring, reset, adoption, validity element) |
| `openspec/specs` (archived foundations) | machine runtime (`controllable`, `$sync`, effects), contracts, drivers, `testMachine`; `keyboard-interactions`, `interaction-modality`, `i18n-messages`, `element-ids`, `hidden-content`, `a11y-quirks` |
| `add-theme-system` | stylesheet convention, family `field` |

## Goals / Non-Goals

**Goals:** one coordinator, pure and testable in Node, that Time Range Field and the Date Range
Picker reuse unchanged; no end is ever edited by validation.

**Non-Goals:** popup, presets, partial public values, tab-stop modes (proposal).

## Decisions

### 1. Layout

```
packages/core/src/components/paired-fields/
├─ pair.ts                 pure: derive(start, end, opts) → { value | null, issues[] }, compareEnds, rangeIssues
│                          (order, unavailable inside via iteration ≤ 366 days else availableBounds)
├─ paired-fields.machine.ts   coordinator (below)
├─ paired-fields.connect.ts   group/names/description/hidden inputs/focus bridge (shared by every range field)
├─ paired-fields.contract.ts  contract fragment + pairInvariants
└─ paired-fields.messages.ts
packages/core/src/components/date-range-field/
├─ date-range-field.props.ts  props → two Date Field machine props (shared placeholder, min/max, granularity…)
└─ date-range-field.contract.ts
packages/react/src/date-range-field/  Root, Label, Description, ErrorMessage, Input, Start, End, Separator, Segment
packages/theme/src/date-range-field.css
```

### 2. Machine (the coordinator)

Two Date Field services (`start`, `end`), created by the Root in embedded mode, are driven by the
coordinator exactly as the Menubar drives its menus: each child's `value` is a controllable the
coordinator sets (`$sync:value`), and each child's `onValueChange` is an event to the coordinator.

```ts
type PairEvent =
  | { type: "END.CHANGE"; edge: "start" | "end"; value: DateValue | null; details: ChangeDetails }
  | { type: "END.BOUNDARY"; edge: Edge; direction: "next" | "previous"; reason: "advance" | "backspace" | "arrow" }
  | { type: "FOCUS.ENTER"; edge: Edge } | { type: "FOCUS.LEAVE" }       // focus within the pair (not between its parts)
  | { type: "CLEAR" } | { type: "RESET" } | { type: "INPUT.ADOPT"; edge: Edge; value: string }
  // props: $sync:value, $props:minValue|maxValue|isDateUnavailable|allowsNonContiguousRanges|granularity|…

states:
  idle    ── FOCUS.ENTER ──► active / setActiveEdge
  active  ── FOCUS.ENTER / setActiveEdge          (moving between ends)
          ── FOCUS.LEAVE ──► idle                 (the Field's "touched" fires here, not between ends)
  global  END.CHANGE / setEnd, recompute        · END.BOUNDARY / focusOtherEdge (after the commit task)
          CLEAR / clearBoth, focusStart         · RESET / restoreDefault
          $sync:value / setBoth (null clears both ends and every partial segment)
values: start, end: committed per end (DateValue | null);  value: derived, controllable externally
effects: focusEdge (after the child's commit is applied), controlValidity (writes the control's message
         on the start hidden input), hiddenInputs (two typed inputs)
```

- **Derivation**: `value = start && end && ordered && noUnavailableInside ? { start, end } : null`
  (equal ends are ordered). `onValueChange` is called when the derived value changes by `compare()` of each
  end, with `details.reason` of the originating child event and `edge`.
- **Issues** (not edits): `pair.ts` returns the list of problems with their part (`start`, `end`, `range`);
  `controlValidity` writes the first as the control validity message and sets `data-invalid-edge`.
- **No coupling of limits**: each child keeps its own draft and limits; `placeholderValue` is shared as
  the *starting point* only. When the start is committed and the end is empty and untouched, the end
  steps from the start (the natural next value), never before it.
- **Focus**: `END.BOUNDARY` is the child's report that there was no next/previous segment (Requests);
  the coordinator focuses the other end's first or last segment through `focusEdge`, after the commit
  task (react-spectrum#10683). `FOCUS.ENTER/LEAVE` come from `focusin`/`focusout` on the `Input` group with
  `relatedTarget` containment, so moving between ends is not leaving.

### 3. Connect

| Part | Attributes / handlers |
|---|---|
| Root | Field host (Root-as-Field), `dir`, `lang`, `data-*` |
| Input | `role="group"`, `aria-labelledby` Label, `aria-describedby` = Field ids + hidden value description node ("Selected range: …"), `aria-disabled`, `unicode-bidi: isolate`; press outside segments → focus rule across both ends |
| Start / End | plain `div`, no role; `data-edge`; provide the edge to segments |
| Separator | `span aria-hidden`, text from `messages.separator` ("–") |
| Segment | Date Field's segment props with `aria-labelledby="<segment-name> <end-name> <label>"`; the first start segment carries the Field description ids unless invalid |
| hidden inputs | two `hidden-form-input`s (start named `startName`, end named `endName`), same declared type per value type, `min`/`max`/`required`/`disabled`/`form`; the start input is the validity element |

### 4. Contract and model-based tests

Date Field's per-edge actions plus `fill({ start, end })`, `fillStart`, `fillEnd`, `clear`, `clearEnd`;
queries `range()`, `segments(edge)`, `validity()` with `part`. Configurations: `en-US`, `en-GB`, `ja-JP`,
`ar-EG` RTL, `th-TH`; minute granularity 12/24-hour; `isDateUnavailable` weekends with and without
`allowsNonContiguousRanges`; min/max; required; read-only; disabled by prop step; inside a Field; typing
orders (end first); `$sync:value` null/range while an end is mid-edit; iOS and Android quirk presets.

### 5. Theme

`date-range-field.css`, family `field`: the group is the visible control (`--rind-date-range-field-*`
tokens defaulting to the semantic tokens Date Field uses, not to `--rind-date-field-*`), separator in
the muted text role, segment focus ring, invalid ring on the invalid end, forced colors.

## Requests to other changes

- **add-date-field** (`date-field`, `date-segments`) — APPLIED (coordinator, 2026-10-15) — three additions, shared with Date Picker, Date Range
  Picker and Time Range Field:
  1. **Embedded mode**: a Date Field Root may run *embedded* in a host: it does not register with a Field,
     renders no Label/Description/ErrorMessage, no hidden input and no group role (`role="presentation"`
     for its `Input`), takes `labelledBy` ids (a list) and description ids from the host, and reports
     its validity to the host (`onValidityChange(flags, message)`) instead of its validity element.
  2. **Boundary events and layout scope**: when auto-advance, Backspace on an empty first segment or
     ArrowRight/ArrowLeft finds no adjacent segment, the machine emits a `BOUNDARY { direction, reason }`
     callback (default: nothing). `SegmentLayout.adjacent` takes an optional `scope` element so visual
     adjacency can span both ends.
  3. **Draft hint**: a watch `onDraftChange({ year, month, day })` (numbers or null, committed segments only)
     for hosts that follow the typed date (Date Picker).
- **add-checkbox** (`hidden-form-input`, "One Hidden Native Input Per Control") — APPLIED (coordinator, 2026-10-15) — a control whose value has
  two parts MAY render a second hidden input of the same declared type (named `endName`), mirrored like the
  first; the first remains the control's validity element and the second is never exposed to a Field.
- **add-range-calendar** (`range-calendar`) — APPLIED (coordinator, 2026-10-15) — export `availableBounds`/`crossesUnavailable` from the pure
  range module as public helpers (used here and by the picker).
- **add-theme-system** (`theme-variants`) — APPLIED (coordinator, 2026-10-15) — list Date Range Field and Time Range Field in family `field`.

## Risks / Trade-offs

- [Two embedded child services rather than one machine with two drafts] → reuse of `date-segments`
  behaviour without a copy; costs the three requests above, all small and additive.
- [Iterating every day for unavailable-inside validation] → capped at 366 checks, beyond which only the
  boundary dates from `availableBounds` are used (documented limit).
- [Both-or-neither differs from Reka/Bits] → drafts remain visible, `data-complete` and `isComplete()`
  tell partial from empty (react-spectrum#4142).

## Open Questions

- Single tab stop per end or per pair (react-spectrum#9743) — after Date Field decides.
