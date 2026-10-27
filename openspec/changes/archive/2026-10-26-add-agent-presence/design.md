## Context

Research: [docs/research/agent-presence.md](../../../docs/research/agent-presence.md)
("Decisions"). v1 keeps the contract's actions to the props (no environment drivers beyond
time).

## Decisions

### 1. Machine

States mirror the `state` prop (`STATE` from `onProps`; any to any). Context: `previous`,
`since` (Clock), `stale`, `connected` (a `listening` was reached since the last `idle`).
Effects: `thinkingTimer` in `thinking` (after `thinkingDelay`, default 1500 ms, `THINKING.ELAPSED`
announces `messages.thinking`), `staleTimer` in any state with a `staleAfter[state]`
(`STALE` sets `stale`, calls `onStale(state)`). `onStateChange(state, { from })` on each change.

### 2. Announcements

Through the Announcer, keyed per instance, when `announce` is not `"off"`: the first `listening`
after `connecting` (`messages.listening`, polite); `thinking` only after the delay (polite);
`idle` after a session (`messages.ended`, polite); `error` (`messages.error(reason)`,
assertive). `speaking` and the level are never announced. `announceStates` narrows the set.

### 3. Status

`Status` renders `messages.status(state)` ("Listening", "Thinking"…); it is plain text, not a
live region. Without a composed visible Status, the Root renders one visually hidden.

### 4. Level

`dom/level-loop.ts`: `startLevelLoop(root, { getLevel, channel, scheduler, smoothing })` runs a
`requestAnimationFrame` loop reading `getLevel(channel)` (clamped 0–1), smoothing it
(`attack` 0.5, `release` 0.15) and writing `--rind-agent-presence-level` (and
`--rind-agent-presence-input-level` / `-output-level`) with `style.setProperty`, plus
`data-level` (`0`–`3`) at most every 250 ms. The adapter starts it while the state is
`listening` (input) or `speaking` (output), motion is allowed, `motion` is not `"off"` and the
page is visible; otherwise the properties are 0 and `data-level="0"`.

### 5. Attributes

Every part: `data-scope="agent-presence"`, `data-part`, `data-instance`, `data-state`,
`data-previous-state`, `data-muted`, `data-stale`, `data-motion` (`full | reduced | off`).
Detail: `data-reason`.

### 6. Contract

Locate by the scope (no role). Queries `state`, `statusText`, `isStale`, `level` (the band).
