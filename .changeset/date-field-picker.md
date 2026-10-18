---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Date Field picker parts, single and range. `DateField.Control`, `Trigger`, `ClearTrigger`, `Portal`, `Positioner`, `Content` and `Calendar` turn the field into a date picker, or a date range picker with `selectionMode="range"`.

- **Value and closing.** The field owns the one value, and the calendar is a view of it. A pick keeps the value's type, time and zone; it closes the popover (reason `"select"`) and returns focus to the trigger.
- **Opening and typing.** Alt+ArrowDown opens the picker from a segment. Typing while open moves the calendar.
- **Range rules.** The range picker forces `commitOnBlur="reset"` and forwards min/max, unavailable dates and contiguity to the calendar.
- **Calendar.** New props `invalid` and `onDateSelect`.
- **Popover.** New close reason `"select"`.
- **Driver.** New actions `openPicker`, `pickDate`, `closePicker` and `clearPicker`.
- **Theme.** Picker rules in `date-field.css`.
