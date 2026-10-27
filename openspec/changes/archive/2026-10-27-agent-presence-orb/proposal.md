## Why

The theme's Agent Presence Visual (three bars, a dash, dots, a cross) reads as a meter, not as
an agent. The user asked for what voice assistants ship: a glass orb with coloured light
moving inside it, reacting to the voice.

## What Changes

- `@rind-ui/theme` draws the empty Visual as a dark glass orb with a ribbon of coloured light
  across it (a white core between two colours over a wide glow), under a lit rim.
- Each state has its own shape and motion, not only a colour: idle a thin dim line,
  connecting a dot that stretches and shrinks, listening a short cool ribbon that rises with
  the input level, thinking a ribbon turning on itself, speaking a wide warm ribbon that
  swells and glows with the output level, error a flat still line. Under reduced motion each
  state keeps its shape, still.
- New optional token `--rind-agent-presence-color` (default: the accent); the other colours
  are derived from it with relative colour syntax.
- The site skin draws the same orb at 120px.

## Capabilities

### Modified Capabilities

- `agent-presence`: the Agent Presence Theme requirement describes the orb instead of bars.

## Impact

`packages/theme/src/agent-presence.css`, `apps/site/skins/agent-presence.css`. CSS only: no
machine, connect, part or contract change.
