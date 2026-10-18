---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Calendar range mode (`selectionMode="range"`): an anchor then an end (`{ start, end }`, one `onValueChange` per commit), a hover/keyboard preview, Escape and leaving with `commitOnBlur`, `minRangeLength` / `maxRangeLength`, contiguous ranges around unavailable dates (`allowsNonContiguousRanges`), an anchor-aware `isDateUnavailable(date, { anchor })`, a controllable `anchor`, prompts and polite announcements, and exported range helpers. The driver adds `selectRange`, `startRange`, `cancel` and `range()` / `anchor()` / `preview()` / `isAnchored()`; `calendar.css` draws the range as a band with a dashed preview. `watchLeave` / `eventIsInside` are exported from the DOM utilities.
