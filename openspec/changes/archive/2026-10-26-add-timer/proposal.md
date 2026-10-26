## Why

A countdown or a stopwatch is written in app code with `setInterval` in every product (exam
timers, auctions, reservation holds, workouts), and its bugs are always the same: it drifts,
stops or slows in a background tab, overshoots its target, does not restart when its start
changes, and its controls disappear under the keyboard focus. Only Ark/Zag ships a Timer, and
its tracker records each of these (zag#2226, #2254, #2262, #2335, #2549, ark#3298). rind-ui
already injects the clock, scheduler, page visibility and announcer a correct timer needs.

Research: [timer](../../../docs/research/timer.md) ·
[accessibility](../../../docs/research/accessibility.md) §7 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
causes A, D, H

Depends on: `add-foundations`, `add-a11y-foundations` (Announcer), `add-button`
(`button-like-element`), `add-theme-system`.

## What Changes

- A public **Timer** in `@rind-ui/core` (machine, connect, contract, messages, meta) and in
  every framework package (React, Vue, Svelte, Solid, Angular): parts `Root`, `Area`,
  `Control`, `Item`, `ItemValue`, `ItemLabel`, `Separator`, `ActionTrigger`.
- States `idle`, `running`, `paused`, `completed`; countdown or stopwatch; time derived from
  the injected monotonic Clock, ticks on the injected Scheduler aligned to `interval`,
  completion re-checked when the page becomes visible.
- Actions `start`, `pause`, `resume`, `reset`, `restart`, `toggle`; inapplicable actions are
  disabled, never hidden.
- The Area is `role="timer"` named by the spoken duration (`Intl.DurationFormat`, messages
  fallback); completion announced politely.
- `getTimer` driver, model-based tests, `timer.css`, site example and skin, docs page.

## Capabilities

### New Capabilities

- `timer`: anatomy, states, timing, completion, actions, prop changes, display and spoken
  format, data attributes and CSS variables, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- A wall-clock target ("until 18:00"): the app computes `startMs`.
- Laps, sound, persistence across reloads.
- A controlled `value` prop: the time is the clock's; `reset` / `restart` / `startMs` move it.

## Impact

- New: `packages/core/src/components/timer/`, `packages/{react,vue,svelte,solid,angular}/src/timer/`,
  `getTimer` in `@rind-ui/testing`, `packages/theme/src/timer.css`, site example and skin,
  `docs/components/timer.md`.
- Modified: package indexes, `families.ts` (`timer` in `decoration`), `button.css` (its action triggers),
  `docs/components.md`.
- No new dependency.
