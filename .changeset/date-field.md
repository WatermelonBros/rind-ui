---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Date Field: a date (or date and time) typed segment by segment in the locale's order and digits, one native `<input role="spinbutton">` per segment. The value (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`) changes only at commit points. Impossible or incomplete entries are kept and reported invalid, never rewritten. It supports paste and copy, calendar systems and eras, time zones with wall-clock steps, the iOS VoiceOver quirk, Field and form integration through a typed hidden native input, and an embedded mode with boundary and draft callbacks for hosts. The shared segment model is exported as `date-segments`. Also added: the `getDateField` driver, `dateFieldStepInvariants` and `date-field.css`. The keyboard layer gains `value: "vertical"`.
