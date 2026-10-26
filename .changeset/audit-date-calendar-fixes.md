---
"@rind-ui/core": patch
"@rind-ui/react": patch
"@rind-ui/solid": patch
"@rind-ui/svelte": patch
"@rind-ui/vue": patch
"@rind-ui/angular": patch
---

Date field and calendar fixes from the cross-library audit:

- Range fields: an end that commits a new value with the same problem (still before `minValue`) stays invalid. Before, the pair turned valid and emitted.
- Range fields: Clear, form reset, a pick and a parent's value drop each end's partial segments, even when that end's value was already null.
- Pickers: the bound calendar follows the field's own `locale`, direction and calendar system, not the app's.
- IME: compositions add up. A Korean 오 then 후 is PM, and full-width １ then ２ is 12.
- Calendar: server markup marks no day as today (the server's day or zone may not be the viewer's). Today is marked after hydration.
- `minValue` after `maxValue`: a development warning names both props, and a controlled calendar no longer loops between them.
- Calendar: a new object for the same date in `focusedValue`, `minValue` or `maxValue` is no change, so a re-render does not clamp again.
- A 12-hour locale that formats no day period (fr-CM) gets an AM/PM segment.
- A minute or second edit in the repeated hour of a fall-back day keeps that occurrence.
- Solid, Svelte and Angular: a refused IME composition no longer leaves its text in the segment.
- `placeholderValue` follows the prop after mount.
