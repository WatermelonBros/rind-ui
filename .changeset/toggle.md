---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Toggle: a two-state button (`aria-pressed`) with controllable `pressed`, `disabled` and
`focusableWhenDisabled`, activated by Enter and Space. `Toggle.Indicator` swaps its content
with the state (`fallback` while off) for icon-only toggles whose accessible name must not
change. In development a name that follows the state is warned about. `data-state` is
`on`/`off`; `data-pressed` is a press in progress. `getToggle`, `toggleContract`, and
`toggle.css` (on state is an outline plus a background, never colour alone).
