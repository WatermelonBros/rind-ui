# Date Field — research

Status: done · Wave: 3 (Date Field in React Aria, Reka UI, Bits UI; Date Input in Ark/Zag)

Read [calendar.md](calendar.md) first for the shared date infrastructure (`date-values`:
value types, calendar systems, time zones, the clock, formatting, constraints). This note
decides **segmented date input**, specified once as the `date-segments` capability and reused
by Time Field ([time-field.md](time-field.md)), and later by the Date Picker's input, Date
Range Field and Time Range Field. Date Field is a form control: [field.md](field.md) and
[text-field.md](text-field.md) (Root acts as a Field; `field-control`), `hidden-form-input`
from add-checkbox, and [number-input.md](number-input.md) (spinbutton semantics, the iOS
spinbutton quirk, locale digit parsing with `@internationalized/number`, now allowed by
decision 0009).

Cross-cutting: [accessibility.md](accessibility.md) §2 (groups labelled by the Label,
segments named from `messages`), §6 (logical keys, IME guard), §9;
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) §1.4 "Date fields",
causes G (value spoken late), I (`aria-roledescription` drops "required" on iOS), J (iOS VO
cannot focus spinbuttons, VO macOS stepper commands dead), L (old NVDA misread);
[native-platform.md](native-platform.md) §8 (no visible `type=date`; hidden native input for
forms, validity and autofill), §14.

## Pattern

- No APG date-field pattern. Closest: APG [Date Picker Spin Button example](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/examples/datepicker-spinbuttons/)
  (a `group` labelled "Choose a Date" containing three `spinbutton`s: day, month, year, each
  with `aria-valuenow/min/max`, `aria-valuetext` for the month name; Up/Down step, PageUp/
  PageDown by larger steps, Home/End to min/max; typing digits). And the native `<input
  type="date">`: one control with editable sub-fields, Left/Right between them, Tab moving
  through them in Chrome and Firefox, typing auto-advancing, Backspace clearing a sub-field,
  locale order and placeholders ("mm/dd/yyyy", "jj/mm/aaaa").
- Roles: `group` (named by the Label) → one `spinbutton` per editable segment, named by the
  segment type and the field label; literals (`/`, `.`, `:`) hidden from AT.
- WCAG: 1.3.1, 1.3.5 (`autocomplete` purposes for birthdays — `bday-*` on the hidden input),
  2.1.1, 2.5.3 (segment names contain the visible label), 3.3.1/3.3.3 (an impossible or
  out-of-range date is identified and explained), 4.1.2.

## How the others built it

### React Aria (`react-stately/src/datepicker/{useDateFieldState,IncompleteDate,placeholders,utils}.ts`, `react-aria/src/datepicker/{useDateField,useDateSegment,useDatePickerGroup,useDisplayNames}.ts`, `spinbutton/useSpinButton.ts`, RAC `DateField.tsx`)

- Parts (RAC): `DateField` (root), `Label`, `DateInput` (the `group`), `DateSegment` (one per
  segment from `state.segments`), `Text slot=description|errorMessage`, `FieldError`; a
  hidden `<input>` for forms.
- Segments come from `DateFormatter(locale, options).formatToParts(date)`: types `era`,
  `year`, `month`, `day`, `hour`, `minute`, `second`, `dayPeriod`, `timeZoneName`,
  `literal` (`relatedYear` → year, `yearName`/`unknown` → literal). Options from
  `granularity` (`day` default for dates, `minute` when the value has a time), `hourCycle`
  (12|24), `shouldForceLeadingZeros`, `hideTimeZone`, `maxGranularity` (`hour` for Time
  Field). Era shown only for gregorian BC or calendars with several eras.
- Partial values: `IncompleteDate` holds each segment (or null) separately from the value.
  `setValue` emits `onChange` **eagerly when complete and valid**; an incomplete or invalid
  (Feb 30) display stays local and is constrained and emitted on blur (`confirmPlaceholder`,
  since #9510). Display digits are re-rendered through a `NumberFormatter` so Feb 30 can be
  shown while typing.
- Segment element: `div[contenteditable][role=spinbutton]` (`useSpinButton`):
  `aria-valuenow` (always, "aXe seems to require it"), `aria-valuetext` (month "10 –
  October", hour formatted), `aria-valuemin/max`, `aria-label` = localised segment name
  (`Intl.DisplayNames` type `dateTimeField`) + ", " + field label, plus `aria-labelledby` the
  label ("VoiceOver on iOS does not announce groups"), `aria-describedby` **only on the first
  segment unless invalid**, `inputMode=numeric`, `enterKeyHint=next`, `caret-color:
  transparent`, **each segment `tabIndex=0`** (Tab goes through segments). **iOS: role
  switched to `textbox` and value attributes removed** ("spinbuttons cannot be focused with
  VoiceOver on iOS"); `timeZoneName` is always a read-only `textbox`.
- Typing (`onInput` from `beforeinput`): digits accumulate in `enteredKeys`; `parser.
  isValidPartialNumber` (locale digits); a value over max restarts from the last key; focus
  auto-advances when another digit cannot fit (`Number(v + "0") > max` or length ≥ length of
  max). `dayPeriod`: first letter matched against the localised AM/PM with a base-sensitivity
  `startsWith`; `era`: first letter of the era names after stripping a common prefix.
  Backspace/Delete: removes the last digit, clears the segment at zero length; on an empty
  placeholder it moves to the previous segment (RA#5261).
- Composition: `insertCompositionText` cannot be cancelled; the text is restored on `input`;
  AM/PM letters arriving as composition (Android, Pinyin) are handled; the document
  selection is **collapsed on every `selectionchange`** inside a segment ("Android Chrome …
  composition events … crash the page") — the source of RA#10259 / RA#10387 in Firefox.
- Arrows: Up/Down cycle within the segment (wrap, no carry — RA#6590), PageUp/PageDown by
  `PAGE_STEP` (year 5, month 2, day 7, hour 2, minute 15, second 15), Home/End to min/max
  (12-hour `hour` Home = 12, End = 11). Left/Right move between segments — in RTL by
  **visual position** (`findNextSegment` over `getBoundingClientRect().left`). Alt+ArrowDown
  opens a picker.
- RTL: time segments wrapped in LRI/PDI isolates (U+2066/U+2069) so `hour:minute` is not
  reversed; numeric segments `direction: ltr; unicode-bidi: embed`; group `unicode-bidi:
  isolate` (RA#4711).
- Hidden input: `type="hidden"` with `value.toString()`; with `validationBehavior="native"`
  a hidden `type="text"` so `required` blocks submission. Validation: min/max/unavailable
  through `getValidationResult` → `rangeUnderflow`/`rangeOverflow`/`badInput` with
  **messages in the browser's language** "to match other browser-provided validation
  messages".
- Label click focuses the first segment; a press on the group focuses the last filled
  segment before the press point.
- Problems: RA#3256/RA#9586 (day 31 refused before a month is typed), RA#5965 (29 Feb
  becomes 28 while the year is typed), RA#6004/RA#8637/RA#9952/RA#8366 (leading/trailing
  zeros: shown or not, then a regression, then "the 0 disappears visually but stays"), RA#5223
  (second digit after clearing), RA#3739 (full-width characters break segments), RA#5285
  (no copy/paste, open), RA#5364 (usability list: separators do not advance, no select-all
  clear, no in-segment caret), RA#6169 (Grammarly overlays every segment), RA#8591 (VO
  "stepper" commands dead), RA#10259/RA#10387 (Firefox: focus pulled back into a segment),
  RA#10683 (keystroke completing a field lost when focus leaves in the same event), RA#10776
  (DST: stepping a month shifts the hour of a `ZonedDateTime`), RA#9624 (an impossible date
  silently constrained on blur), RA#9801 (hidden input keeps the last valid value after
  clearing), RA#9958 (required inconsistent per cleared segment), RA#9675 (segments
  reference a label id that does not exist after SSR/streaming), RA#9743 (Tab fatigue: three
  to four stops per field, open, `keyboardNavigationBehavior` accepted), RA#4848
  (`isDateUnavailable` ignored), RA#3328 (error not spoken when it appears), RA#10081 (NVDA
  2020.4 + Firefox reads wrong values; current NVDA fine).

### Ark UI / Zag (`zag/packages/machines/date-input/src/*`)

- A port of React Aria's design: `IncompleteDate`, `processSegments`, `contentEditable`
  spinbuttons with `tabIndex=0`, `inputMode`, composition handling; `selectionMode`
  `single | range` (two groups in one machine); props `locale` (default `en-US`), `timeZone`
  (default `UTC`), `granularity`, `hourCycle`, `shouldForceLeadingZeros`, `hideTimeZone`,
  `placeholderValue`, `min`/`max`, `translations`; a live region announces segment changes.
  No iOS role switch.
- Problems: ZG#3070 (exceeding min/max resets the other segments to min's values while the
  year is typed), ZG#3116/ZG#3117 (stale display values and a day-level `isEqual` swallow
  `onValueChange`; time-only granularity unusable), ZG#3187 (time-only hour shifted by the
  viewer's UTC offset on commit), ZG#3154 (`sr-Latn-RS` placeholders in Cyrillic: language
  stripped before lookup), ZG#3108 (ArrowRight does not cross from start to end group).

### Reka UI (`DateField/{DateFieldRoot,DateFieldInput}.vue`, `shared/date/{useDateField,segment,parser,placeholders,useSegmentNavigation}.ts`)

- `DateFieldRoot` (`modelValue`, `placeholder`, `granularity`, `hourCycle`, `locale`,
  `hideTimeZone`, `minValue`/`maxValue`, `isDateUnavailable`, `step`, `stepSnapping`) +
  `DateFieldInput part="day|month|…"`; a hidden native input (`datetime-local` for date-times).
  Segments `contenteditable` `role=spinbutton`, `tabindex=0`, **English segment names
  hard-coded** (`aria-label: "day,"`).
- Problems: RK#1127 (focus order not updated when the locale changes), RK#1639 (deleting the
  year clears the whole field), RK#1758 (Backspace on an empty segment does not go back),
  RK#2002 (typing past the last segment overwrites it), RK#1993/RK#2005 (Enter decrements the
  focused segment), RK#2007 (read-only should stay focusable — it was; default focus styles
  missing on contenteditable), RK#2275 (out-of-range dates did not block submission),
  RK#2812 (RTL: auto-advance moves backwards), RK#3000 (hidden `datetime-local` without
  `step` → `stepMismatch` with seconds), RK#1897 (paste, open), RK#1426 (setting the value to
  `undefined` does not reset the segments).

### Bits UI (`date-field`, `internal/date-time/field/*`)

- Same lineage as Reka (Melt UI): `DateField.Root`/`Input`/`Segment`, `contenteditable`
  spinbuttons, an assertive announcer for segment changes ("inconsistent behavior across
  screen readers" without it).
- Problems: BITS#1899 (en-GB: typing 31/12 blind gives 01/12), BITS#1668 (Android Chrome/
  Edge: typed digits do not land in the expected format; Firefox fine), BITS#1988 (Safari:
  long and non-numeric text accepted in a segment), BITS#2038 (Backspace leaves padding zeros
  that are treated as typed), BITS#2174 (external clear ignored while a segment is focused),
  BITS#729 (2-digit year format request).

### Kobalte (`time-field/*`)

Time Field only (React Aria port): iOS `textbox` switch, label prepended to every segment
name, "Safari on iOS does not fire beforeinput for the backspace key because the cursor is at
the start". See time-field.md.

### Base UI, Radix, Headless UI, Ariakit

None ship one (BU#3332 "Add Date Input / Field", open).

## Segmented spinbuttons vs one masked input

| | Segmented (one control per part) | Single masked `<input>` |
|---|---|---|
| Libraries | all five that ship it (RA, Zag, Reka, Bits, Kobalte), native `type=date` | none of the nine (MUI X v6, many form kits) |
| AT semantics | each part has a name ("month") and a value with min/max (APG spinbutton example) | one string; the user hears "10/14/2026" or a half-filled mask ("1_/__/____"), no part structure |
| Keyboard | Up/Down per part, typing auto-advances, Backspace per part | caret editing, arrows move the caret; stepping needs custom keys |
| Locale order / non-latin digits / eras | from `formatToParts`, per segment | mask per locale; eras and day periods are text inside a mask |
| iOS VoiceOver | spinbuttons not focusable → role `textbox` quirk (RA, KB) | fine |
| VO macOS | "stepper" commands do nothing (RA#8591; native `type=date` the same per the maintainer) | n/a |
| TalkBack / Android | contenteditable composition corrupts segments (RA's selection-collapse workaround, BITS#1668) | fine |
| Paste / copy / select-all | missing everywhere (RA#5285, RK#1897, RA#5364) unless added | native |
| Tab stops | one per part (RA#9743 "Tab fatigue") | one |
| Browser extensions | Grammarly overlays every contenteditable (RA#6169) | single-line inputs are rarely targeted; `data-gramm="false"` opts out |

**Decision: segmented**, because the parts' names and bounds are what a screen-reader user
needs to fill in an unfamiliar locale's order, it is the APG example's and the native
control's model, and every library converged on it. But the bug history above is mostly the
cost of **`contenteditable`**, not of segmentation: Firefox focus theft through the document
selection (RA#10259, RA#10387), the Android composition crash and its workaround, full-width
characters (RA#3739), Safari accepting long and non-numeric text (BITS#1988), Grammarly
(RA#6169), no default focus style (RK#2007), and the leading-zero saga (RA#6004 → RA#8637 →
RA#9952) where the displayed text is re-formatted from a number on every key. So each
editable segment is a **native `<input type="text">`** with `role="spinbutton"` — the shape
Number Input already uses (an `<input role=spinbutton>` with the `ios-vo-spinbutton-input`
quirk): `beforeinput` can be cancelled, IME composition works normally, `inputMode="numeric"`,
`enterKeyHint`, `autocomplete="off"`, `size` sized to the segment's longest value, the typed
text is the input's own value (so "0" and "03" show exactly what was typed), `paste` and
`copy` events are ordinary. Literals are `aria-hidden` spans between the inputs.

## Accessibility

- **Group**: the `Input` part (`div role="group"`) is named by the Label (`aria-labelledby`)
  and described by the Field's Description/ErrorMessage plus a hidden value description
  ("Selected date: Wednesday, October 14, 2026") so a group-reading SR hears the whole value.
- **Segment names**: `Intl.DisplayNames(locale, { type: "dateTimeField" })` ("month",
  "Monat", "月") with `messages` overrides (Baseline: Chrome 87, Firefox 86, Safari 14.1),
  composed as `aria-labelledby="<segment-name> <label>"` so iOS VO, which does not announce
  groups, still hears the field label (RA, KB); the visible label text stays in the name
  (2.5.3). `relatedYear` and other unknown part types are mapped before calling DisplayNames
  (RA#8017).
- **Values**: `aria-valuenow` (absent on an empty segment, as ARIA 1.2 allows; RA's comment
  that "aXe seems to require it" refers to dequelabs/axe-core#3505, closed: axe moved to ARIA
  1.2 and no longer requires it for `spinbutton`), `aria-valuemin`/`aria-valuemax`,
  `aria-valuetext`: month "10 – October" style through `messages.valueText`, hour in its
  cycle ("3 PM"), "Empty" when empty. Updated in the keydown task (cause G).
- **Description only on the first segment**, unless invalid (RA): otherwise the description
  is re-read on every segment.
- **iOS**: `ios-vo-spinbutton-input` (requested by add-number-input) drops the role and
  value attributes on iOS; the name still carries segment + label; a textbox whose value is
  the visible digits.
- **Errors**: `aria-invalid` on every segment while the Field displays invalid; an appearing
  error is spoken by the Field's announcement (field-validation), which answers RA#3328 (VO
  and NVDA/JAWS + Chrome do not announce an `aria-invalid` change).
- **`aria-roledescription`**: never (iOS drops "required", AT note cause I; ZG#3420).
- **Keyboard**: Tab and Shift+Tab move through editable segments (native parity, and the
  only way an AT user without arrow keys reaches the next segment); Left/Right move by visual
  position; Up/Down/PageUp/PageDown/Home/End step; digits and day-period letters type;
  Backspace/Delete clear; Enter never changes the value and submits the form (RK#1993).
- **RTL**: numeric segments `dir="ltr"`, time runs inside isolates, segment DOM order =
  `formatToParts` order; auto-advance follows that logical order (RK#2812), arrows follow the
  visual order (RA).
- **Forced colours**: segment focus as outline; placeholder text `GrayText`; invalid border.
- **Target size**: each segment input ≥ 24 px tall; the group is the visual control.

## Bug history

Searched (2026-10-14) adobe/react-spectrum (DateField, DateField segment / VoiceOver / iOS /
Android / backspace / placeholder / form / validation / RTL / paste, date segment typing,
DatePicker granularity / timezone / NVDA, calendar systems), chakra-ui/zag and chakra-ui/ark
(date input, date picker), unovue/reka-ui and huntabyte/bits-ui (DateField, Date Field,
segment, date picker), kobaltedev/kobalte, mui/base-ui and the others — about 420 hits, 110
read in full. Time-specific bugs (day period, hour cycles) are in time-field.md.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#3256](https://github.com/adobe/react-spectrum/issues/3256) | "31" becomes "01" before a month is typed | day max from the placeholder month (30) | closed (#9510) | while incomplete, limits are the calendar's maxima (31, 13 months for hebrew); constrain only complete dates |
| RA | [#9586](https://github.com/adobe/react-spectrum/issues/9586) | dd/mm locales cannot type 30/31 first | same | closed (dupe) | scenario in en-GB |
| RA | [#5965](https://github.com/adobe/react-spectrum/issues/5965) | 29 Feb becomes 28 while typing the year | date constrained after each key | closed (#9510) | no constraint while typing; the complete date is checked at commit |
| BITS | [#1899](https://github.com/huntabyte/bits-ui/issues/1899) | en-GB: typing 31/12 blind gives 01/12 | same class | open | same scenario |
| RA | [#9624](https://github.com/adobe/react-spectrum/issues/9624) | 31 Feb silently becomes 28 Feb on blur | constrain on blur | open | an impossible date is never silently changed: value `null`, field invalid (`badInput`), text kept |
| RA | [#6004](https://github.com/adobe/react-spectrum/issues/6004) | typing a leading "0" gives no feedback | display re-formatted from the number | closed (#9510) | the segment shows the typed text while focused |
| RA | [#8637](https://github.com/adobe/react-spectrum/issues/8637) | "01-12-1990" cannot be typed after a leading-zero change | "0" ignored, so no auto-advance on "01" | closed (reverted) | typed text drives auto-advance: "01" in day advances |
| RA | [#9952](https://github.com/adobe/react-spectrum/issues/9952) | leading 0 in the year vanishes but blocks typing ("02026" → "6") | hidden typed buffer ≠ shown text | closed | buffer = the input's value; length capped to the year's digit count |
| RA | [#8366](https://github.com/adobe/react-spectrum/issues/8366) | re-entering a year with zeros stops at 1–3 digits | buffer/auto-advance mismatch | open | retyping a filled segment starts a new buffer on the first key |
| BITS | [#2038](https://github.com/huntabyte/bits-ui/issues/2038) | Backspace leaves padding zeros counted as typed | padded display reused as buffer | open | Backspace edits the typed text only |
| RA | [#5223](https://github.com/adobe/react-spectrum/issues/5223) | after clearing minutes, "23" shows "3" | stale "0" kept in the buffer | closed | clearing resets the buffer |
| RA | [#3739](https://github.com/adobe/react-spectrum/issues/3739) | full-width characters break the field | contenteditable composition text not rejected | open | native input + `number-parsing` (full-width digits accepted, letters rejected in `beforeinput`) |
| BITS | [#1988](https://github.com/huntabyte/bits-ui/issues/1988) | Safari: long and non-numeric text in a segment | contenteditable insertions not all intercepted | closed | `beforeinput` rejection + length cap on a native input |
| BITS | [#1668](https://github.com/huntabyte/bits-ui/issues/1668) | Android Chrome/Edge: input lands in the wrong format | contenteditable + Android IME | open | native inputs; Android preset in model tests |
| RA | [#10259](https://github.com/adobe/react-spectrum/issues/10259) | Firefox: typing elsewhere pulls focus into a segment | document `selectionchange` collapse onto a contenteditable | closed | no document selection handling at all (native inputs) |
| RA | [#10387](https://github.com/adobe/react-spectrum/issues/10387) | Firefox: focus bounces back to the last edited segment | selection left inside a contenteditable | closed (dupe) | same |
| RA | [#6169](https://github.com/adobe/react-spectrum/issues/6169) | Grammarly overlays every segment | extension targets contenteditable | open | inputs with `autocomplete="off"`, `spellCheck=false`, `data-gramm="false"` documented |
| RA | [#5285](https://github.com/adobe/react-spectrum/issues/5285) | no copy/paste of a date | segments are separate editors | open | paste an ISO or the field's own format into any segment fills the field; copy copies the formatted value |
| RK | [#1897](https://github.com/unovue/reka-ui/issues/1897) | same request (ISO or locale string) | same | open | same |
| RA | [#5364](https://github.com/adobe/react-spectrum/issues/5364) | separators do not advance; Ctrl+A + Backspace does not clear | missing keys | open | typing the locale's separator advances; select-all + Backspace clears every segment |
| RA | [#9743](https://github.com/adobe/react-spectrum/issues/9743) | 3–4 Tab stops per field | one stop per segment | open (option accepted) | default per-segment (native parity); single-stop option is an open question |
| RA | [#8591](https://github.com/adobe/react-spectrum/issues/8591) | VO macOS "stepper" commands do nothing | VO sends no keys to custom steppers (native date input too) | open | documented AT limitation; arrows work |
| RA | [#10081](https://github.com/adobe/react-spectrum/issues/10081) | NVDA + Firefox read wrong segment values | NVDA 2020.4 bug | closed (AT) | support matrix pins current NVDA (AT note cause L) |
| RA | [#4711](https://github.com/adobe/react-spectrum/issues/4711) | segment order wrong in ar/he | flex layout broke bidi; placeholders | closed | inline layout, `dir=ltr` numerics, isolates; theme never uses `display:flex` reordering |
| RK | [#2812](https://github.com/unovue/reka-ui/issues/2812) | RTL: auto-advance moves backwards | "next" computed visually | closed | auto-advance = logical next; arrows = visual |
| RK | [#1127](https://github.com/unovue/reka-ui/issues/1127) | focus order stale after a locale change | segments computed once | closed | segments recomputed from (locale, options) on change; focus kept on the same segment type |
| RA | [#10776](https://github.com/adobe/react-spectrum/issues/10776) | stepping the month across DST shifts a `ZonedDateTime`'s hour | stale offset reapplied | open | stepping keeps the wall-clock time; offset recomputed (scenario in Europe/Lisbon) |
| ZG | [#3187](https://github.com/chakra-ui/zag/issues/3187) | time-only hour shifted by the viewer's UTC offset | conversion through a `Date` in the local zone | closed | segment values never pass through a JS `Date`; only formatting does, in the value's zone |
| ZG | [#3070](https://github.com/chakra-ui/zag/issues/3070) | exceeding min/max resets other segments | constrain on each key | closed | min/max are validity, never a rewrite of what the user typed |
| ZG | [#3117](https://github.com/chakra-ui/zag/issues/3117) | time-only field drops every `onValueChange` | stale display read, day-level equality, era in the segment list | closed | equality by full value (`compare() === 0`), segments from the granularity |
| ZG | [#3154](https://github.com/chakra-ui/zag/issues/3154) | sr-Latn placeholders in Cyrillic | language stripped before lookup | closed | placeholders and names looked up with the full locale (DisplayNames does) |
| ZG | [#3420](https://github.com/chakra-ui/zag/issues/3420) | placeholder letters stay English | outside translations | closed | placeholders through `messages` |
| RA | [#10683](https://github.com/adobe/react-spectrum/issues/10683) | completing keystroke lost when auto-advance leaves the field | blur handler reads render-time state in the same event | open | auto-advance focus moves after the commit is applied (effect), one machine step per key |
| RA | [#9801](https://github.com/adobe/react-spectrum/issues/9801) | hidden input keeps the last valid value after clearing | display override not reflected in the form value | open | hidden input = `''` whenever the committed value is null |
| RA | [#9958](https://github.com/adobe/react-spectrum/issues/9958) | required: clearing the month vs the day validates differently | partial dates handled by segment | open | any partially filled field is invalid (`badInput`), whatever the segment |
| RA | [#9366](https://github.com/adobe/react-spectrum/issues/9366) | partially filled field cannot be reset | value null, partial display has no API | open | `RESET` and a controlled `null` clear the segments too (`$sync`) |
| BITS | [#2174](https://github.com/huntabyte/bits-ui/issues/2174) | external clear ignored while a segment is focused | focused segment keeps its draft | open | `$sync` always wins over drafts, focus stays |
| RK | [#1426](https://github.com/unovue/reka-ui/issues/1426) | setting `undefined` does not reset segments | same | closed | same scenario |
| RA | [#9675](https://github.com/adobe/react-spectrum/issues/9675) | segments reference a label id that does not exist (streaming SSR) | ids passed through a WeakMap side channel | open | ids from `element-ids` (derived from the root id); invariant: every IDREF resolves |
| RA | [#4848](https://github.com/adobe/react-spectrum/issues/4848) | `isDateUnavailable` ignored by the field | not wired to validation | closed | unavailable → invalid with `messages.unavailable` |
| RA | [#3328](https://github.com/adobe/react-spectrum/issues/3328) | errors not spoken when they appear | `aria-invalid` changes are silent in most SRs | open | Field's polite error announcement |
| RK | [#2275](https://github.com/unovue/reka-ui/issues/2275) | out-of-range date does not block submit | no native constraint | closed | native `min`/`max` on the hidden `date`/`time`/`datetime-local` input; control validity otherwise |
| RK | [#3000](https://github.com/unovue/reka-ui/issues/3000) | hidden `datetime-local` without `step` → `stepMismatch` with seconds | default step 60 s | closed | `step` from the granularity (1 for seconds) |
| RK | [#1639](https://github.com/unovue/reka-ui/issues/1639) | deleting the year clears the whole input | clear propagated | closed | Backspace clears one segment only |
| RK | [#1758](https://github.com/unovue/reka-ui/issues/1758) | Backspace on an empty segment stays there | no back navigation | open | Backspace on an empty segment moves to the previous one |
| RK | [#2002](https://github.com/unovue/reka-ui/issues/2002) | typing past the last segment overwrites it | buffer restarts | open (also RA) | in the last segment a full buffer ignores further digits until a new key cycle (focus or Backspace) |
| RK | [#1993](https://github.com/unovue/reka-ui/issues/1993) | Enter decrements the minute | Enter mapped through a step handler | closed | Enter is never a value key; implicit submission |
| RK | [#2007](https://github.com/unovue/reka-ui/issues/2007) | read-only segments looked unfocusable | contenteditable, no default focus style | closed | read-only segments focusable, `readonly` attribute, `aria-readonly` |
| RA | [#9786](https://github.com/adobe/react-spectrum/issues/9786) | hydration mismatch from `Date.now()` keys | module-scope time | closed | no module-scope time |

## Known pitfalls

- **Typed text vs formatted value**: show what the user typed while the segment is focused;
  reformat on segment commit. Every leading-zero bug comes from re-formatting on each key.
- **Never constrain while typing** (RA#3256, RA#5965, BITS#1899, ZG#3070); never silently
  constrain on blur (RA#9624).
- **Partial values are a state**, visible to forms (`''`), validation (`badInput`), reset and
  controlled clearing (RA#9801, RA#9958, RA#9366, BITS#2174).
- **contenteditable** is the source of the Firefox/Android/Safari/extension bugs — avoided.
- **Time zones**: segment arithmetic in `@internationalized/date`, never through a local
  `Date` (ZG#3187, RA#10776).
- **Locale change** recomputes segments (RK#1127); script subtags matter (ZG#3154).
- **RTL**: logical vs visual order (RA#4711, RK#2812).

## Testing notes

- Node: the segment model (`date-segments`) — segment lists per locale (en-US, en-GB,
  de-DE, ja-JP, ar-EG arab digits, fa-IR persian calendar, he-IL, th-TH buddhist, ja-JP-u-ca-
  japanese era), typing sequences ("1","0" → advance; "0","3"; "3","1" in dd/mm; "2","9"
  then a non-leap year), Backspace, page steps, Home/End, era and day period letters,
  commits and validity (incomplete, impossible, unavailable, min/max), paste parsing.
- Browser: IME composition (Japanese full-width digits, Korean day period — time-field.md),
  `beforeinput` rejection, Tab/Shift+Tab through segments, RTL arrows by position, Firefox
  (no focus theft), hidden input value and validity, form reset.
- Contract needs: fill by typing digits into the first segment (auto-advance), set one
  segment, step a segment, read the ISO value from the hidden input and per-segment values
  from `aria-valuenow`/input value.
- AT matrix: VO iOS (textbox quirk), TalkBack typing, NVDA + Firefox (current version), VO
  macOS (stepper commands are a documented limitation).

## Decisions

- **`date-segments` capability** (specified in `add-date-field`, reused by Time Field and the
  later fields): segment list from `formatToParts` per (locale, calendar, granularity,
  hourCycle, time zone display); the partial-value model (each segment value or null,
  independent of the committed value); typing rules (digits in the locale's numbering
  system through `@internationalized/number`, auto-advance, page steps, Home/End, Backspace,
  era and day-period letters with a base-sensitivity collator, composition), commit points,
  validity (incomplete, impossible, min/max, unavailable), paste/copy, RTL order.
- **Commit points** (like Number Input): a segment edit becomes part of the value when the
  segment is committed — auto-advance, leaving the segment (Tab, arrow, click), Enter, a step
  key (Up/Down/PageUp/PageDown/Home/End apply immediately), paste. While typing inside a
  segment the value does not change (typing "2026" does not emit years 2, 20, 202). When all
  segments are committed and form a real date, the value changes; otherwise the value is
  `null` (impossible or incomplete), and the field is invalid with `badInput` unless every
  segment is empty.
- **Parts**: `Root` (a Field when not inside one: Text Field's Root-as-Field), `Label`,
  `Description`, `ErrorMessage`, `Input` (div `role=group`), `Segment` (`<input>` for an
  editable segment, `<span aria-hidden>` for a literal; the read-only `timeZoneName` is a
  read-only input), `hidden-input` (automatic). Segments are rendered by the consumer from
  `segments` (render prop / slot) or automatically.
- **Machine**: states `idle`, `editing` (a segment has focus; context `activeSegment`,
  `buffer`), `composing` (IME). Events `SEGMENT.FOCUS {type}`, `SEGMENT.BLUR`, `INPUT
  {type, text, inputType}`, `COMPOSITION.START/END`, logical keys
  (`INCREASE`/`DECREASE`/`PAGE_*`/`FIRST`/`LAST`, `NEXT`/`PREV` segment), `BACKSPACE`,
  `PASTE {text}`, `COPY`, `CLEAR_ALL`, `RESET`, `INPUT.ADOPT {value}` (autofill of the
  hidden input), `$sync:value`, prop steps (`locale`, `granularity`, `hourCycle`).
- **Value**: controllable `value` (`DateValue | null`), `defaultValue`, `onValueChange`
  (commit points only), `placeholderValue` (the date used to fill segments stepped from
  empty: today constrained to min/max, at midnight for time segments).
- **Hidden native input** (`hidden-form-input`, declared type by value type):
  `CalendarDate` → `type="date"`, `CalendarDateTime` → `type="datetime-local"` with `step`
  from the granularity (`60` minute, `1` second, `3600` hour; RK#3000), `ZonedDateTime` →
  `type="text"` with the ISO string with offset and zone; native `min`/`max`/`required`
  where the type supports them (RK#2275); value `''` while the committed value is null
  (RA#9801). Incomplete, impossible, unavailable dates — and min/max for zoned values — are
  the control's own validity errors (request to add-checkbox and add-field).
- **`data-*`**: Root/Input: Field state attributes, `data-focus`, `data-focus-visible`,
  `data-placeholder-shown` (all segments empty), `data-complete`, `data-composing`;
  Segment: `data-type` (`year`, `month`, …, `literal`), `data-placeholder` (empty),
  `data-editable`, `data-focus`, `data-focus-visible`, `data-invalid`, `data-readonly`,
  `data-disabled`.
- **Contract**: actions `fill(date)` (types the digits of every segment in order from the
  first; pointer twin: click the first segment then type; virtual: focus then type),
  `typeSegment(type, text)`, `step(type, "increase" | "decrease", { large? })`,
  `toEdge(type, "min" | "max")`, `clearSegment(type)`, `clear()`, `paste(text)`,
  `resetForm()`; queries `value()` (ISO from the hidden input), `segments()` (type, text,
  value, placeholder), `focusedSegment()`, `isInvalid()`, `validity()`, `isComplete()`;
  traits `field-associated`, `form-associated` (`value` property of the hidden input),
  segment invariants.
- **Deliberately different**: native `<input>` segments instead of `contenteditable`; commit
  points instead of eager emission; no silent constraint on blur; impossible/incomplete =
  `null` + `badInput`; paste and copy; segment names from `Intl.DisplayNames`; native typed
  hidden inputs for validity.

## Open questions

- **Single tab stop option** (RA#9743): `tabBehavior: "segments" | "field"` once a user asks;
  segment Tab stops stay the default (native parity, touch AT reach).
- **Width of an `<input>` segment**: `size` attribute (all engines) vs `field-sizing:
  content` (Chromium, Safari 26; theme progressive enhancement) — theme detail, no spec
  change.
- **Device checks** before `done`: VO iOS typing into a textbox segment (quirk active),
  TalkBack typing with Gboard (digits, AM/PM letters), Samsung keyboard `inputMode=numeric`.
</content>
</invoke>
