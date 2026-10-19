## Why

Every AI chat shows the model's thinking in a disclosure that opens while the model thinks
and closes when it answers. The kits keep getting the lifecycle wrong:
- old messages open and close by themselves (AI Elements #86);
- the duration flips the component between controlled and uncontrolled (#496);
- the user's own toggle is overridden;
- focus is dropped when the content closes under it;
- nothing is announced.

None of the nine headless libraries ships it.

Research: [reasoning](../../../docs/research/reasoning.md) ·
[streaming-message](../../../docs/research/streaming-message.md) ·
[collapsible](../../../docs/research/collapsible.md)

Depends on: `add-collapsible` (the disclosure semantics), `add-a11y-foundations`
(announcer), `add-theme-system`.

## What Changes

- A public **Reasoning** in `@rind-ui/core` (machine, connect, contract, messages, meta)
  and `@rind-ui/react` (parts `Root`, `Trigger`, `Content`).
- The disclosure opens by itself on a live start of thinking and closes `autoCloseDelay`
  after it ends. The user's toggle always wins, a close never hides focus, and a message
  that mounts finished never toggles.
- The duration comes from the runtime's `duration` prop or is measured with the
  Environment's Clock.
- "Thinking" and "Thought for N seconds" are announced and shown in the Trigger.
- The Environment gains an injectable `clock` (the virtual clock provides one).
- `getReasoning` driver, theme stylesheet, site examples, docs page.

## Impact

- New capability `reasoning`; `DomEnvironmentOptions.clock`.
