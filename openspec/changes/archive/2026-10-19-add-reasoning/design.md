## Context

See [reasoning.md](../../../docs/research/reasoning.md): AI Elements, assistant-ui and
prompt-kit, and their bug histories.

## Decisions

### 1. Props

`thinking: boolean` (the runtime's streaming flag for the reasoning part), `open` /
`defaultOpen` (default false) / `onOpenChange`, `duration?: number` (seconds, the
runtime's), `autoCloseDelay` (ms, default 1000), `announce` (default true), `messages`.

### 2. Machine

Context:
- `userToggled`: the user has toggled, so nothing toggles automatically again;
- `startedAt`: the clock time of a live start;
- `measured`: the measured seconds;
- `live`: a start was seen after mount.

Controllable value: `open`. States: `thinking`, `done`, from the `thinking` prop
(`THINKING.SYNCED` via onProps).

- Mount takes the state from the prop, with no auto-toggle and no announcement.
- `done → thinking` (live): `live = true`, `startedAt = clock.now()`. Open with reason
  `auto` unless the user has toggled. Announce `messages.thinking`.
- `thinking → done` (live): `measured = ceil((now − startedAt) / 1000)`. Announce
  `messages.thought(duration)`, where duration is the `duration` prop, else `measured`.
  Enter `closing`, a timed sub-state of `done`. After `autoCloseDelay` it closes with
  reason `auto`, unless the user has toggled or focus is inside the content
  (`env.focusInside()`).
- `TOGGLE` (trigger): sets `userToggled`, flips `open` (reason `trigger`), and cancels a
  pending auto-close.

### 3. Connect

Parts `root`, `trigger`, `content`. Every part carries `data-scope`, `data-part`,
`data-instance`, `data-state` (`open` / `closed`) and `data-thinking` while thinking.
- Trigger: `type="button"`, `aria-expanded`, `aria-controls` only while the content is
  rendered.
- Content: `id`, `hidden` while closed, `aria-busy="true"` while thinking.
- The trigger's default text comes from the messages: `thinking` ("Thinking…"),
  `thought(seconds)` ("Thought for 12 seconds", "Thought for a few seconds" when unknown).

### 4. Contract

Located by the trigger's role (`button`) and its name. Actions: `toggle` (pointer,
keyboard). Queries: `isOpen`, `isThinking`, `triggerText`. The lifecycle runs as prop
steps (`$props:thinking`) on a virtual clock (the auto-close delay).

### 5. Theme

`reasoning.css`, family `decoration`: a quiet trigger row with a chevron that turns with
`data-state`. A shimmer on the trigger text while thinking, off under reduced motion.
Muted content with an inline-start rule.
