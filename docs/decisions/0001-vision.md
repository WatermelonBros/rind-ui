# 0001 — Vision

Status: accepted · 2026-10-14

## What rind-ui is

A **headless** component library: behaviour, accessibility and state, with no
styles of its own. Styling goes through `data-*` attributes and is entirely the
consumer's — rind-ui ships an optional theme only so the components can be seen.

It is written from scratch. We read Ark UI, Radix, React Aria, Base UI and the
rest closely (they are open source, and we study each one before building the
same component — see [research/](../research/)), but we depend on none of them.

## Goals

1. **Superset of every headless library.** Every component in
   [components.md](../components.md) — ~90 of them — so no one has to leave rind-ui
   for a missing piece. Reached in waves, not as a precondition for the first
   release.
2. **Testable by design.** Every component ships an official test driver that works
   in Testing Library *and* Playwright, plus model-based tests generated from its
   state machine. This is the reason to pick rind-ui over the alternatives. See
   [0003-testing.md](0003-testing.md).
3. **AI-UI primitives.** Prompt input, message thread, streaming message, tool
   approval and friends — headless like the rest, because their hard parts (IME,
   stick-to-bottom scroll, live-region flooding) are behaviour, not visuals.
4. **Known to LLMs.** Most code using rind-ui will be written by an agent. The
   library must be easy for one to learn, use correctly and verify. See
   [0005-llm-knowledge.md](0005-llm-knowledge.md).
5. **Framework-agnostic core, React first.** See
   [0002-architecture.md](0002-architecture.md).

## Why it exists — the test

A feature belongs in rind-ui only if it **cannot be added from the outside** on top
of an existing headless library. Test drivers and contracts must live inside the
state machines; AI-UI primitives are missing components. Both pass. The ideas
below did not.

## Rejected (and why)

- **An `ai` prop inside components** (semantic search in Combobox, natural-language
  Date Field, smart paste). Ark already takes a filter function; the model is a
  helper anyone can write against any library. Not a library feature.
  What *does* survive: components must handle async, streamed and *suggested*
  values well (stale-request cancellation, stable highlight while results stream,
  "proposed, not confirmed" field state). That is state-machine work and belongs
  in the core.
- **A generative-UI manifest.** It describes an app's *styled* components to a
  model; that belongs to the app's design system, not to headless primitives.

## Relationship to Reado

[Reado](https://github.com/WatermelonBros/reado) is the flagship consumer. It uses
`@ark-ui/react` today; migrating it to rind-ui proves the library in a real,
complex app. Wave 1 is chosen so Reado can migrate early, and several AI-UI
primitives are extracted from Reado (`CompletingTextarea`, `Announcer`,
`TourCard`).
