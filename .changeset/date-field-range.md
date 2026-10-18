---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Date Field range mode (`selectionMode="range"`): two ends (embedded fields) in one group named by the Label. The value is `{ start, end }`, emitted once per change and never for a partial range. The ends never edit each other: an inverted range is kept as typed and invalid, a range across an unavailable day is invalid unless `allowsNonContiguousRanges`. Focus moves between the ends, segments are named by the end and the Label, there are two hidden inputs (`startName` / `endName`, autofill adopted), and select-all-and-Backspace clears both ends. New parts `DateField.Start`, `DateField.End`, `DateField.Separator`; `getDateField(…, { selectionMode: "range" })`; range rules in `date-field.css`.
