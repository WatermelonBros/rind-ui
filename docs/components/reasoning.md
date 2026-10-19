# Reasoning

A model's chain of thought beside its answer: a disclosure that opens by itself while the model thinks ("Thinking…"), closes a second after it answers ("Thought for 12 seconds"), and keeps the trace for whoever wants to read it. The lifecycle only reacts to live thinking: a reloaded message never opens or closes by itself, the user's toggle wins for good, and the automatic close never hides focus.

## When to use

- **Use it for** reasoning, thinking or planning text a model produces before its answer.
- **Over a Collapsible with an effect**: no toggling on old messages (AI Elements #86), the user's choice is kept, focus inside keeps it open, the duration is measured or taken from your runtime without switching modes (#496), and the start and end are announced while the trace is not.
- **Don't use it for** the answer itself ([Streaming Message](streaming-message.md)) or for steps the user must act on (a tool approval).

```tsx
import { Reasoning } from "@rind-ui/react"

<Reasoning.Root thinking={part.state === "streaming"} duration={part.durationSeconds}>
  <Reasoning.Trigger />
  <Reasoning.Content>
    <Markdown>{part.text}</Markdown>
  </Reasoning.Content>
</Reasoning.Root>
```

If your runtime splits the reasoning into several consecutive parts, join them into one `Reasoning` (AI Elements #106, assistant-ui's `groupPartByType`).

## API

<!-- api:reasoning -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Reasoning.Root` | `root` | `<div>`; holds the disclosure and the lifecycle. |
| `Reasoning.Trigger` | `trigger` | `<button>` with `aria-expanded`, and `aria-controls` while open; default text "Thinking…" / "Thought for 12 seconds". |
| `Reasoning.Content` | `content` | `<div>`, rendered while open; `aria-busy` while thinking. |

Every part carries `data-state` (`open` / `closed`) and `data-thinking` while thinking.

## The lifecycle

| Change | What happens |
|---|---|
| `thinking` turns true, or it mounts thinking | Opens (reason `"auto"`), announces "Thinking…", starts measuring. |
| `thinking` turns false | Announces "Thought for N seconds"; closes `autoCloseDelay` (1000 ms) later. |
| The user toggles | Its choice wins: nothing toggles automatically again; a pending close is cancelled. |
| Focus is inside the content when the close is due | It stays open. |
| Mounted done (an old message) | Nothing toggles, nothing is announced. |

The duration is `duration` (seconds, from your runtime) when given, else measured on the Environment's clock between the live start and end; unknown for a message mounted done ("Thought for a few seconds").

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On the Trigger: shows or hides the trace. |

## Accessibility notes

- **The trace is not announced**; the start and the end are ("Thinking…", "Thought for 12 seconds"), politely. `announce={false}` turns them off.
- **The trigger says the state** in text, so reaching it tells where the model is.
- **No dangling reference**: `aria-controls` only while the content exists.
- **Reduced motion**: the theme's shimmer stops.

## Testing

```tsx
import { getReasoning, virtualClock } from "@rind-ui/testing"

const clock = virtualClock()
// <RindProvider environment={{ scheduler: clock.scheduler, clock: clock.clock }}>
const reasoning = getReasoning(screen)
// … thinking={true}, then thinking={false}
act(() => clock.advance(1000))
expect(await reasoning.isOpen()).toBe(false)
expect(await reasoning.triggerText()).toBe("Thought for 12 seconds")
```

Contract action: `toggle`. Queries: `isOpen`, `isThinking`, `triggerText`.

## Tested with

<!-- tested-with:reasoning -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
