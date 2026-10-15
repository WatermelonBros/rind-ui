## Why

Typing a date is the accessible, fast alternative to a calendar, and the Date Picker, Date
Range Field and Time Field all reuse the same segmented input. It is also the date component
with the longest bug list (45 entries in the research note): days refused before the month is
typed (react-spectrum#3256), leading zeros that vanish or block typing (react-spectrum#6004,
#8637, #9952), impossible dates silently changed on blur (react-spectrum#9624), forms keeping a
stale value after clearing (react-spectrum#9801), Firefox stealing focus into segments
(react-spectrum#10259), Android and Safari corrupting `contenteditable` segments
(bits-ui#1668, #1988), no copy and paste (react-spectrum#5285), DST shifting a stepped date-time
(react-spectrum#10776). Most of them come from `contenteditable` segments and eager value
emission; this change specifies segments as native inputs with commit points.

Research: [date-field](../../../docs/research/date-field.md) ·
[calendar](../../../docs/research/calendar.md) (`date-values`) ·
[number-input](../../../docs/research/number-input.md) · [text-field](../../../docs/research/text-field.md) ·
[field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §2, §6, §9 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4, causes G, I, J, L ·
[native-platform](../../../docs/research/native-platform.md) §8, §14

Depends on: `add-calendar` (`date-values`), `add-foundations`, `add-a11y-foundations`
(`keyboard-interactions` with the vertical value-key option requested below, IME guard,
`interaction-modality`, `announcer`, `i18n-messages`, `element-ids`, `a11y-quirks`,
`platform-and-preferences`), `add-field` (`field`, `field-control`, `field-validation`),
`add-text-field` (Root-as-Field), `add-checkbox` (`hidden-form-input`), `add-number-input`
(`number-parsing` for locale digits, the `ios-vo-spinbutton-input` quirk), `add-theme-system`.

## What Changes

- **Segmented date input** (`date-segments`, shared with Time Field and the later range fields
  and picker): segments from the locale's format (order, literals, eras, day period, time zone
  name), one native `<input>` per editable segment with `role="spinbutton"`, partial values
  independent of the committed value, typing with auto-advance in the locale's digits, page
  steps, Home/End, Backspace, separator keys, paste and copy, commit points, validity
  (incomplete, impossible, unavailable, out of range), RTL order, SSR rules.
- A public **Date Field** component: `Root` (a Field when not inside one), `Label`,
  `Description`, `ErrorMessage`, `Input` (group), `Segment`, and an automatic hidden native
  input (`date`, `datetime-local` or `text` by value type) carrying the ISO value, `min`/`max`,
  `required` and `step`.
- Value `DateValue | null` (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`),
  `granularity` (`day` | `hour` | `minute` | `second`), `hourCycle`, `hideTimeZone`,
  `shouldForceLeadingZeros`, `placeholderValue`, `minValue`/`maxValue`, `isDateUnavailable`,
  `disabled`, `readOnly`, `required`, `invalid`, `name`, `form`, `autoComplete`.
- `field-control` implementation, contract and driver (`getDateField`), model-based tests,
  theme stylesheet (family `field`), stories, docs page.

## Capabilities

### New Capabilities

- `date-segments`: the segmented date/time input model and its keyboard, typing, commit and
  validity rules, shared by Date Field, Time Field, Date Range Field, Time Range Field and the
  Date Picker input.
- `date-field`: the Date Field component — anatomy, value, ARIA, Field and form integration,
  messages, data attributes, contract, theme.

### Modified Capabilities

- `keyboard-interactions` (archived): `value: "vertical"` mode for segments, RTL rule (Right-To-Left Mirroring modified, Vertical Value Mode added).
- `a11y-quirks` (archived): `ios-vo-spinbutton-input` also covers date/time segments (MODIFIED).

Other extensions needed in other changes are listed in design.md under "Requests to other
changes".

## Non-goals

- A calendar popup (Date Picker), ranges (Date Range Field), a single-tab-stop mode
  (react-spectrum#9743 — open question), millisecond granularity (react-spectrum#6415),
  carrying from one segment into the next when stepping (react-spectrum#6590), two-digit year
  pivots (react-spectrum#9362 comments), natural-language parsing (0001 "rejected").
- Free-form masked single-input mode.
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/date-segments/` (segment model, typing, paste parsing — pure),
  `components/date-field/` (machine, connect, contract, messages).
- `packages/react/src/date-field/`, `@rind-ui/testing` (`getDateField`),
  `@rind-ui/theme/date-field.css`, stories, docs.
- Uses `@internationalized/date` (0002) and `@internationalized/number` (0009); no new
  dependency. Reado: not used.
</content>
</invoke>
