## Why

Voice agents show their state (listening, thinking, speaking) with an animated orb or bars.
Every kit read (LiveKit, ElevenLabs, AI Elements Persona, Pipecat) ships the picture with no
role, no name and no status text, never handles reduced motion, and leaves stuck states to the
app (livekit/agents#8027). A headless Agent Presence is the state vocabulary, the status text,
the announcements, the staleness and the audio-level plumbing; the picture is the theme's or
the consumer's.

Research: [agent-presence](../../../docs/research/agent-presence.md)

Depends on: `add-a11y-foundations` (Announcer), the environment's Clock, Scheduler, Motion and
Page Visibility, `add-theme-system`.

## What Changes

- A public **Agent Presence** in `@rind-ui/core` and every framework package: parts `Root`,
  `Visual` (`aria-hidden`), `Status`, `Label`, `Detail`.
- `state` is a prop (`idle | connecting | listening | thinking | speaking | error`), any to
  any; selected transitions announced (the first `listening`, `thinking` after a delay, `error`
  assertively, never `speaking`); `staleAfter` marks a state that lasted too long.
- `getLevel(channel)` polled each frame while listening or speaking, smoothed, written as CSS
  custom properties outside rendering, stopped under reduced motion, `motion="off"` and a hidden
  page; a coarse `data-level` band.
- `getAgentPresence` driver, `agent-presence.css` (a dot and bars), site example, docs page.

## Capabilities

### New Capabilities

- `agent-presence`: anatomy, states, announcements, staleness, level, motion, data attributes,
  messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Capturing or analysing audio, the transport and session, the transcript, speech recognition
  and synthesis, the orb itself (fx), permissions, barge-in policy, frequency bands, sounds.

## Impact

- New: `packages/core/src/components/agent-presence/`, `packages/core/src/dom/level-loop.ts`,
  framework parts, driver, theme file, site example and skin, `docs/components/agent-presence.md`.
- Modified: `families.ts` (`agent-presence` in `decoration`).
