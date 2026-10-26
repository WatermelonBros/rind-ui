# Agent Presence

What a voice or realtime agent is doing right now: connecting, listening, thinking, speaking, or in error. A visual (an orb, bars, a waveform: yours) that moves with the audio level, and a status in words that assistive technology hears. The level never goes through your framework's state: it is written straight to CSS variables on each frame, so a 60 fps meter does not re-render the page.

## When to use

- **Use it for** the "agent is listening" indicator of a voice assistant, a realtime call, a dictation button's surroundings.
- **Over a home-made animated orb**: the state is spoken once when it changes (not on every frame), "thinking" appears only after a delay (no flicker on fast answers), a state stuck for too long is marked stale, reduced motion stops the level animation, and the visual is hidden from assistive technology.
- **Don't use it for** a text chat's typing dots ([Streaming Message](streaming-message.md) handles the pending state) or a progress bar ([Progress](progress.md)).

```tsx
import { AgentPresence } from "@rind-ui/react"

<AgentPresence.Root
  state={session.state}
  reason={session.error}
  getLevel={(channel) => (channel === "input" ? mic.level() : speaker.level())}
>
  <AgentPresence.Visual />
  <AgentPresence.Label>Assistant</AgentPresence.Label>
  <AgentPresence.Status />
  <AgentPresence.Detail />
</AgentPresence.Root>
```

`state` is yours: map it from your realtime client. `getLevel` returns 0 to 1 for the channel the state uses (`input` while listening, `output` while speaking); it is called once per animation frame and only in those states.

## API

<!-- api:agent-presence -->

## Styling the level

The Root carries `--rind-agent-presence-level` (0 to 1, smoothed) and `data-level` (a coarse band 0 to 3, for style rules that cannot interpolate). Scale or glow the Visual from the variable:

```css
[data-scope="agent-presence"][data-part="visual"] {
  scale: calc(1 + var(--rind-agent-presence-level, 0) * 0.35);
}
```

With `prefers-reduced-motion` or `motion="off"` the loop never runs and `data-motion` says why.

## Accessibility notes

- **Spoken once per change**: the Status is announced politely when the state changes ("Listening", "Thinking"); speaking is not announced (the agent's voice is the signal); an error is assertive.
- **Thinking after a delay** (`thinkingDelay`, 500 ms): a fast answer never flashes "Thinking".
- **The visual is decorative** (`aria-hidden`); the Status carries the meaning. Without a composed Status, the Root renders a visually hidden one.
- **Stale**: `staleAfter` marks a state that lasted too long (`data-stale`, `onStale`), so the UI can offer a retry.

## Testing

```tsx
import { getAgentPresence } from "@rind-ui/testing"

const agent = getAgentPresence(screen)
expect(await agent.state()).toBe("listening")
expect(await agent.statusText()).toBe("Listening")
```

Queries: `state`, `statusText`, `isStale`, `level`.

## Tested with

<!-- tested-with:agent-presence -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
