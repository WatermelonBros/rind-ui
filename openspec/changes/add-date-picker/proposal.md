## Why

A Date Picker is the component most apps mean by "date input": a typed field plus a calendar. Composed
carelessly it shows the failures in the research note (45 entries): a calendar button nobody can Tab to
(react-spectrum#3118), picking a date inside a Dialog closing the dialog (ark#3107, ark#3268, radix#3480),
two value owners that disagree (reka-ui#736), a date held aside until a time is chosen so the field stays
empty (react-spectrum#6957), a popover that does not close when the same date is picked again
(react-spectrum#4750), a Clear button that cannot clear a half-typed field (react-spectrum#9296), a
`modal` prop that silently did nothing (ark#3106), an unnamed or silent dialog for assistive technology.
This change specifies the composition once as `picker-popover` — which the Date Range Picker reuses — and
the Date Picker on top of it.

Research: [date-picker](../../../docs/research/date-picker.md) · [date-field](../../../docs/research/date-field.md) ·
[calendar](../../../docs/research/calendar.md) · [popover](../../../docs/research/popover.md) ·
[field](../../../docs/research/field.md) · [form](../../../docs/research/form.md) ·
[accessibility](../../../docs/research/accessibility.md) §2, §4, §7 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4, causes A, C, D, E, J, L ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) · [native-platform](../../../docs/research/native-platform.md) §8

Depends on: `add-date-field` (embedded Date Field, with the requests in design.md), `add-calendar`
(`calendar`, `date-values`), `add-popover` (`popover`, `non-modal-tab-order`; request below),
`add-overlay-infrastructure` (layer stack, dismissal, containment, inert, presence — used unchanged),
`add-floating-positioning`, `add-field`, `add-text-field` (Root-as-Field), `add-checkbox`
(`hidden-form-input`), `add-button` (`button-like-element`), `add-theme-system`; archived
`add-foundations` and `add-a11y-foundations` (specs in `openspec/specs/`).

## What Changes

- **`picker-popover`** (shared): the shell of a field + trigger + popover calendar — one value owner, the
  controlled Popover, opening (trigger press, Alt+ArrowDown/Up, never on focus), non-modal default and a real
  `modal`, focus into the calendar and back to the trigger, close on select, one gesture one layer inside Dialogs,
  typing while open, names for trigger and dialog, a Clear trigger, Field and form participation, exit state kept.
- A public **Date Picker**: `Root`, `Label`, `Description`, `ErrorMessage`, `Control`, `Input`, `Segment`, `Trigger`,
  `ClearTrigger`, `Portal`, `Positioner`, `Content`, `Calendar` (a Calendar root bound to the picker; the Calendar's
  parts are used inside it), an automatic hidden input; Date Field's value props plus `open`/`defaultOpen`/`onOpenChange`,
  `closeOnSelect`, `modal`, `firstDayOfWeek`, positioning.
- Value types preserved (`date-values`): a pick keeps the value's time and zone; granularity ≥ hour emits
  `CalendarDateTime` at the placeholder time.
- Contract and driver (`getDatePicker`), picker invariants, model-based tests, theme stylesheet (family `field`, content as
  `panel`), stories, docs page.

## Capabilities

### New Capabilities

- `picker-popover`: the field + trigger + popover shell shared by Date Picker and Date Range Picker.
- `date-picker`: the Date Picker component — anatomy, value, calendar binding, contract, theme.

### Modified Capabilities

None. Extensions needed in other changes are listed in design.md under "Requests to other changes".

## Non-goals

- Opening when a segment gains focus (react-spectrum#7006), a time field or list inside the popover, presets, a
  multiple-date picker, month/year drop-downs in the header (Month/Year Picker change), text-format parsing
  (segments are the input), full-screen sheets (theme recipe with `modal`).
- Deselecting by pressing the selected date; a native `<input type=date>` fallback.
- Framework adapters other than React; fx.

## Impact

- `packages/core/src/components/picker-popover/` (coordinator machine, connect helpers, messages, contract fragment),
  `components/date-picker/` (props mapping, connect, contract), `packages/react/src/date-picker/`,
  `@rind-ui/testing` (`getDatePicker`), `@rind-ui/theme/date-picker.css`, stories, docs.
- Uses `@internationalized/date`; no new dependency. Reado: not used.
