# Time Field — research

Status: done · Wave: 3 (Time Field in React Aria, Reka UI, Bits UI, Kobalte; Ark/Zag through Date Input with a time granularity)

Read [date-field.md](date-field.md) first: Time Field is the `date-segments` model with the
largest segment fixed to the hour, exactly as React Aria builds it (`useTimeFieldState` =
`useDateFieldState` with `maxGranularity: "hour"`). Everything about segments (native `<input>`
per segment, typing, commit points, Backspace, paste, RTL, the iOS quirk, the hidden input,
Field integration) is decided there. This note covers what time adds: the value type, hour
cycles and the day period, time zones and DST, and the time-specific bugs. Shared date
infrastructure: [calendar.md](calendar.md) (`date-values`).

## Pattern

- No APG pattern; a `group` of `spinbutton`s like the date field. Native counterpart: `<input
  type="time">` (hour, minute, optional second, AM/PM in 12-hour locales; `step` in seconds;
  `min`/`max`).
- WCAG as Date Field. 1.3.5: no standard `autocomplete` token for a time.

## How the others built it

### React Aria (`react-stately/src/datepicker/useTimeFieldState.ts`, `useDateFieldState.ts`, `IncompleteDate.ts`; RAC `TimeField`)

- Value `Time` (or `CalendarDateTime`/`ZonedDateTime` when the value has a date, which is kept
  and only the time edited); internally a `CalendarDateTime` on today (`convertValue`) so the
  date-field machinery applies; `minValue`/`maxValue` converted on the value's day.
  `granularity` `hour | minute | second` (default `minute`; `millisecond` removed, RA#6415),
  `hourCycle` 12 | 24, `hideTimeZone`, `shouldForceLeadingZeros`, `placeholderValue` (default
  `new Time()` = midnight).
- Hour cycle from `DateFormatter(locale, { hour12 }).resolvedOptions().hourCycle`
  (`h11`/`h12`/`h23`/`h24`); `IncompleteDate` stores the hour in the display cycle plus a
  separate `dayPeriod` (0/1) and converts back (`fromHourCycle`). Typing the hour keeps the
  existing day period (fixed after RA#6793). 12-hour Home = 12, End = 11.
- Day period typing: first character `startsWith` the localised AM/PM (base sensitivity);
  composition text handled for Android/Pinyin; Korean 오전/오후 share their first syllable
  (RA#5832, RA#6196).
- Zoned values: hour cycling through `ZonedDateTime.cycle("hour")` so the repeated hour of a
  DST fall-back is reachable (#9561); `timeZoneName` segment read-only.
- Hidden input value `state.timeValue.toString()` ("14:30:00").
- Problems: RA#6793 (clearing the hour flipped PM → AM), RA#5832/RA#6196 (Korean day period
  cannot be typed), RA#7169 (hydration mismatch: Safari/Firefox format the space before AM/PM
  as U+202F, Chrome as U+0020), RA#5599 (`autoCapitalize` server/client mismatch), RA#9366
  (a partially filled field cannot be reset), RA#9801 (hidden input keeps the last valid time
  after clearing), RA#4410 (minute step, like `<input type=time step>`, unsupported),
  RA#6590 (no carry from seconds to minutes), RA#7997 (time-limit validation message not
  localised for ko-KR).

### Ark UI / Zag (`date-input` with `granularity: "hour" | "minute" | "second"`)

- No dedicated time field. Problems: ZG#3117 (time-only date input unusable in controlled
  mode: `era` forced into the segment list, stale display values, day-level equality), ZG#3187
  (time-only hour shifted by the viewer's UTC offset on commit: the time went through a
  `Date` in the local zone).

### Reka UI (`TimeField/*`, `shared/date/*`)

- `TimeFieldRoot` + `TimeFieldInput part=…`; `modelValue: Time | CalendarDateTime |
  ZonedDateTime`, `hourCycle`, `granularity`, `step` / `stepSnapping` (RK#1834, RK#2033),
  `hideTimeZone`, `minValue`/`maxValue`.
- Problems: RK#1154 ("00" hour not typable), RK#1791 (null value displayed as 12:00 AM),
  RK#2262 (12-hour: typing "1" switched PM to AM), RK#2463/RK#2466 (`hourCycle=24` refused
  13–23: the locale's cycle won over the prop; then 24-hour digits interpreted as PM 12-hour),
  RK#2567 (premature auto-advance after a segment previously 0), RK#2580 (pressing 0 in a
  12-hour hour never advances), RK#2952 (day period flips when the display zone differs from
  the locale's default zone), RK#2956 (day period resolved to AM when the locale's PM string is
  not "PM"/"pm"/"p.m.", e.g. es-ES "p. m."), RK#2356 (empty brackets around a hidden time
  zone in zh-TW/ja-JP), RK#980 (lowercase "a"/"p" changed the display but not the value),
  RK#1993 (Enter decremented the minute).

### Bits UI (`time-field`, `time-range-field`)

- Melt lineage like Reka. Problems: BITS#914 (24-hour mode only accepted 01–24: `h24`
  instead of `h23`), BITS#941/BITS#1659 (24-hour input refused or clamped to 1–12, locale
  `nl-NL`), BITS#1662 (auto-advance after the first digit of "11"), BITS#2145 (editing the hour
  then the minutes flipped PM to AM: the typed 12-hour string reused as a 24-hour value),
  BITS#1985 (Time Range Field always returns AM when the hour is typed), BITS#2055 (value not
  clearable before every segment is filled).

### Kobalte (`time-field/{time-field-root,time-field-segment,time-field-input,time-field-hidden-input,time-field-value-description}.tsx`)

- A Solid port of React Aria's Time Field: iOS `textbox` switch ("spin buttons cannot be
  focused with VoiceOver on iOS"), field label prepended to each segment name ("VoiceOver on
  iOS does not announce groups"), a value-description part, a hidden input; the comment
  "Safari on iOS does not fire beforeinput for the backspace key because the cursor is at the
  start" (a contenteditable consequence our native inputs do not have).

### Base UI, Radix, Headless UI, Ariakit

None ship one (RA-style requests: AK#374, BU#3332).

## Accessibility

- As Date Field (group + segment spinbuttons, iOS quirk, names from `Intl.DisplayNames`).
- **Hour value text** in its cycle with the day period: "3 PM" for the hour segment
  (`DateFormatter({ hour: "numeric" })`), minutes as two digits; the day-period segment's
  `aria-valuetext` is the localised AM/PM string, with `aria-valuenow` 0/1.
- **Day period typing** must work with an IME: the committed composition text is matched
  (Korean 오전/오후 need the second syllable; RA#5832) and the Latin letters "a"/"p" always
  work in any locale as a fallback; Up/Down toggles. On touch keyboards without arrows the
  segment is still settable by typing.
- **Hydration**: formatted literals differ by engine (U+202F vs U+0020 before AM/PM,
  RA#7169) — literal spans are corrected on the client without a hydration warning (see
  Decisions).
- Forced colours, target size, RTL (time is always displayed left-to-right inside an
  isolate, RA#4711) as Date Field.

## Bug history

Searched with the Date Field queries plus "TimeField", "TimeField hourCycle", "dayPeriod",
"time field", "Time Field" in all ten trackers — 150 hits, 40 read in full.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#6793](https://github.com/adobe/react-spectrum/issues/6793) | clearing the hour flips PM to AM | day period derived from the cleared hour | closed | the day period is its own segment value; hour edits never change it |
| BITS | [#2145](https://github.com/huntabyte/bits-ui/issues/2145) | editing hour then minutes turns 21:30 into 09:30 | typed 12-hour string reused as a 24-hour value | closed | segment values are stored in the display cycle with the day period; conversion to 0–23 only at commit |
| RK | [#2262](https://github.com/unovue/reka-ui/issues/2262) | 12-hour: typing "1" sets AM | hour update ignored the current period | closed | same scenario ("1","1" at 11 PM stays PM) |
| BITS | [#1985](https://github.com/huntabyte/bits-ui/issues/1985) | Time Range Field always returns AM | same class | closed | same |
| RK | [#2952](https://github.com/unovue/reka-ui/issues/2952) | day period flips when the display zone differs | period computed in another zone | closed | the period comes from the value's own hour, never through a local `Date` |
| RK | [#2956](https://github.com/unovue/reka-ui/issues/2956) | es-ES "p. m." value shows AM | period detected by string compare with "PM" | closed | period from `formatToParts` of known instants (00:00 and 12:00), compared by type |
| RA | [#5832](https://github.com/adobe/react-spectrum/issues/5832) | Korean AM/PM cannot be typed | first character shared; focus advanced after two keys | closed (stale) | match the committed composition text; advance only on an unambiguous match |
| RA | [#6196](https://github.com/adobe/react-spectrum/issues/6196) | CJK input in the day period does nothing | `startsWith` on composition | closed (dupe) | same; Latin a/p fallback |
| RK | [#980](https://github.com/unovue/reka-ui/issues/980) | "a"/"p" changes the display, not the value | separate code path for letters | closed | letters go through the same commit as digits; case-insensitive |
| BITS | [#914](https://github.com/huntabyte/bits-ui/issues/914) | 24-hour shows 01–24 | `h24` cycle | closed | 24-hour means `h23` (0–23); `h24`/`h11` never used |
| BITS | [#1659](https://github.com/huntabyte/bits-ui/issues/1659) | nl-NL 24-hour clamps to 1–12 | locale cycle ignored | closed | the cycle comes from the locale unless `hourCycle` is set |
| RK | [#2463](https://github.com/unovue/reka-ui/issues/2463) | `hourCycle=24` refuses 13–23 | locale detection won over the prop | closed | the prop wins over the locale |
| RK | [#2466](https://github.com/unovue/reka-ui/issues/2466) | 24-hour "15" stored as 17 | PM offset applied in 24-hour mode | closed | no day period in 24-hour mode |
| BITS | [#941](https://github.com/huntabyte/bits-ui/issues/941) | 24-hour input "22" → "02" | max 12 applied | closed | max from the cycle (23) |
| RK | [#1154](https://github.com/unovue/reka-ui/issues/1154) | "00" hour cannot be typed | zero treated as empty | closed | 0 is a value in `h23`; in 12-hour "0" waits for a second digit ("01"–"09", "0" alone on commit = 12) |
| RK | [#2580](https://github.com/unovue/reka-ui/issues/2580) | 12-hour: repeated "0" never advances | zero not counted | closed | scenario |
| RK | [#2567](https://github.com/unovue/reka-ui/issues/2567) | advances after one digit when the segment was 0 | old value reused as the buffer | closed | a new focus starts an empty buffer |
| BITS | [#1662](https://github.com/huntabyte/bits-ui/issues/1662) | "11" advances after the first "1" | 12-hour max misread | closed | "1" waits in 12-hour (10–12 possible), "2" advances |
| RK | [#1791](https://github.com/unovue/reka-ui/issues/1791) | null value shown as 12:00 AM | placeholder rendered as a value | closed | null → placeholders, `data-placeholder` |
| BITS | [#2055](https://github.com/huntabyte/bits-ui/issues/2055) | cannot clear a partially filled field | value undefined until complete | open | controlled `null` / `RESET` clears drafts (date-segments) |
| RA | [#9366](https://github.com/adobe/react-spectrum/issues/9366) | partially filled field cannot be reset | same | open | same |
| RA | [#9801](https://github.com/adobe/react-spectrum/issues/9801) | hidden input keeps the last valid time | drafts not reflected | open | hidden input `''` while null |
| ZG | [#3117](https://github.com/chakra-ui/zag/issues/3117) | time-only field drops every change | era in the segments, day-level equality | closed | time segments only; equality by `compare` |
| ZG | [#3187](https://github.com/chakra-ui/zag/issues/3187) | typed hour shifted by the viewer's UTC offset | value converted through a local `Date` | closed | `Time` values never pass through `Date` |
| RA | [#7169](https://github.com/adobe/react-spectrum/issues/7169) | hydration mismatch in Safari/Firefox | engines differ: U+202F vs U+0020 | open | literal spans may differ server/client and are re-rendered without a hydration warning |
| RA | [#5599](https://github.com/adobe/react-spectrum/issues/5599) | `autoCapitalize` server/client mismatch | attribute computed per platform | closed | segment attributes are platform-independent at first render; platform quirks applied after mount |
| RK | [#2356](https://github.com/unovue/reka-ui/issues/2356) | empty brackets around a hidden zone (zh-TW) | literal parts around `timeZoneName` kept | closed | with `hideTimeZone`, drop the zone and its adjacent literals |
| RA | [#4410](https://github.com/adobe/react-spectrum/issues/4410) | no minute step | not implemented | closed (no) | non-goal; `step` is an open question |
| RK | [#1834](https://github.com/unovue/reka-ui/issues/1834) | minute/second step | added later (`step`, `stepSnapping`) | closed | same open question |
| RA | [#6590](https://github.com/adobe/react-spectrum/issues/6590) | Up at :59 does not carry into the minute | segments wrap | closed (no) | wrap within the segment (native parity) |
| RA | [#6415](https://github.com/adobe/react-spectrum/issues/6415) | millisecond granularity | removed | closed | non-goal |
| RA | [#7997](https://github.com/adobe/react-spectrum/issues/7997) | ko-KR time-limit message not localised | message table missing | closed | validity messages from the browser (native `type=time` min/max) or `messages` |
| RK | [#1993](https://github.com/unovue/reka-ui/issues/1993) | Enter decrements the minute | Enter mapped to a step | closed | Enter is never a value key |

## Known pitfalls

- **Hour cycles**: four cycles exist; use `h12` and `h23` only; the prop wins over the locale
  (BITS#914, RK#2463, BITS#1659).
- **The day period is a segment**, never re-derived from a partially typed hour (RA#6793,
  BITS#2145, RK#2262, BITS#1985).
- **Localised day-period strings** vary ("p. m.", "午後", "오후") — compare by part type, not
  text (RK#2956), and accept IME text (RA#5832).
- **Zones**: no `Date` round trips (ZG#3187, RK#2952); DST repeated/skipped hours handled by
  `ZonedDateTime` arithmetic.
- **SSR**: engine-specific literal spaces (RA#7169).

## Testing notes

- Node: hour typing tables per cycle (`en-US` 12-hour, `de-DE` 23-hour, `ja-JP` 12-hour with
  午前/午後 before the hour, `ko-KR`, `es-ES` "p. m.", `ar-EG` with arab digits), day-period
  letters and composition, Home/End per cycle, DST in `America/New_York` (2026-11-01 01:30
  twice) and `Europe/Lisbon` (spring-forward gap), `hideTimeZone` in zh-TW.
- Browser: Korean IME composition into the day period; hydration test with a 12-hour locale
  in WebKit and Firefox (RA#7169).
- Contract: Date Field's, with `fill(time)` and `setDayPeriod("am" | "pm")`.

## Decisions

- **One machine**: Time Field uses the Date Field machine and `date-segments` with
  `maxGranularity: "hour"`; it is its own component (`scope: "time-field"`, its own parts,
  contract, driver and theme stylesheet) so the docs, the anatomy and the driver read
  naturally, but it adds no machine states.
- **Value**: `Time` by default; a `CalendarDateTime`/`ZonedDateTime` value keeps its date and
  zone and only its time is edited (RA). `minValue`/`maxValue` as `Time` (compared on the
  value's day for date-times). `granularity: "hour" | "minute" | "second"` (default
  `"minute"`). `placeholderValue` default 00:00.
- **Hour cycle**: `hourCycle?: 12 | 24` → `h12` | `h23`; default from the locale. 12-hour
  adds the `dayPeriod` segment where the locale's pattern puts it (before the hour in ja/ko/
  zh). Hour typing: in `h23` "0"–"2" wait for a second digit, "3"–"9" advance; in `h12` "0"
  and "1" wait, "2"–"9" advance; the day period never changes from an hour edit.
- **Zones**: `ZonedDateTime` values show a read-only `timeZoneName` segment unless
  `hideTimeZone` (which also removes its adjacent literals, RK#2356); stepping the hour
  through a DST transition uses zoned arithmetic, so each wall-clock hour of a fall-back day is
  reachable and the skipped hour of a spring-forward day is skipped.
- **Hidden input**: `type="time"` with `step` (`3600`/`60`/`1`) and native `min`/`max` for a
  `Time` value; date-time values use Date Field's mapping.
- **SSR**: literal text (separators, the space before AM/PM) may differ between the server's
  and the browser's ICU (RA#7169); literal spans are rendered on the server and re-rendered by
  the client without a hydration warning (`suppressHydrationWarning` on literal spans only, the
  approach Number Input takes for its formatted text). *Applies to Date Field too; specified in
  `date-segments`.*
- **`data-*`, contract, theme**: Date Field's, with scope `time-field`; contract adds
  `setDayPeriod`.
- **Deliberately different**: `h23` for 24-hour (Bits used `h24`); hour edits never touch the
  day period; Latin a/p fallback in every locale; no `Date` conversions.

## Open questions

- **`step`** (RA#4410, RK#1834): minute/second steps for arrows and snapping on commit —
  common request; add when the first consumer asks (a `date-segments` addition; the hidden
  input's `step` already exists).
- **Duration input** (RA#9366 comments): a different component (Intl.DurationFormat), not a
  Time Field mode.
</content>
</invoke>
