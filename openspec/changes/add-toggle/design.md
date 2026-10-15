## Context

See proposal.md for why. Toggle sits on three unarchived changes: `add-foundations`
(runtime with `controllable()`, contracts, drivers, `testMachine`),
`add-a11y-foundations` (press factory emitting `PRESS*` with `modality`, focus
attributes, `virtual-parity` and `focus-does-not-commit` invariants, the test-only
`press-fixture`) and `add-button` (`button-like-element`). Research and the
library comparison: [toggle.md](../../../docs/research/toggle.md).

## Goals / Non-Goals

**Goals:**
- The smallest public component that exercises the whole stack: a real two-state
  graph, controllable value, press-driven activation, generated driver.
- Toggle Group can reuse Toggle unchanged by passing `pressed`/`onPressedChange`.

**Non-Goals:**
- Any group, roving-focus or collection code; form participation; `mixed`; `pending`.

## Decisions

### Machine

```ts
type ToggleEvent =
  | ({ type: "PRESS" } & PressEventFields)   // from core/a11y events; carries modality
  | { type: "FOCUS"; modality: Modality }
  | { type: "BLUR" }

export const toggleMachine = setup({
  types: type<{ props: ToggleProps; events: ToggleEvent; env: ModalitySource; context: { focused: boolean } }>(),
  actions: {
    setFocused: ({ set }) => set("focused", true),
    clearFocused: ({ set }) => set("focused", false),
  },
}).machine({
  id: "toggle",
  context: () => ({ focused: false }),
  values: { pressed: controllable("pressed", { fallback: false, states: { off: false, on: true } }) },
  initial: "off",
  on: { FOCUS: { actions: ["setFocused"] }, BLUR: { actions: ["clearFocused"] } },
  states: {
    off: { on: { PRESS: "on" } },
    on: { on: { PRESS: "off" } },
  },
})
```

- Two real states instead of Zag's single `idle` + context flag: the graph has the
  two edges model tests must cover, and `values.pressed.states` gives controlled
  mode, `$sync` and `$reverted` from the runtime with no `CONTROLLED.*` events.
- `onPressedChange` details: `reason: "PRESS"`, `event` (with `modality`),
  `cancel()` — all from the runtime's `ChangeDetails`.
- Disabled is not a guard: the press factory sends no events while disabled
  (`button-like-element` + press-interactions), so the graph has no disabled edges.
  Alternative (a `disabled` guard on `PRESS`) rejected: two sources of truth.
- No shared modules beyond `core/dom/press.ts`, `core/dom/modality.ts` and the
  `button-like-element` helpers; no `core/collection`, no overlay modules.

### Connect

- `root`: the `button-like-element` props (element, `type`, disabled handling, press
  handlers, focus attributes) + `aria-pressed: String(pressed)` +
  `data-state: pressed ? "on" : "off"`; `aria-pressed` is marked
  accessibility-critical so a consumer override warns (react-adapter rule).
- `indicator`: `aria-hidden: "true"`, `data-state`, `data-disabled`; the React part
  chooses `children` or `fallback` from the snapshot (Ark's API).
- Development name check: after a transition, connect's dev-only effect computes the
  root's accessible name with the `core/dom` accname subset and warns if it differs
  from the previous one. Stripped in production.

### `data-pressed` stays press-in-progress

Base UI and Kobalte use `data-pressed` for the on state, React Aria for
press-in-progress. `add-a11y-foundations` already defines it as press-in-progress on
every pressable part, so Toggle uses `data-state="on|off"` (Radix, Zag, Reka, Bits).
Docs list the mapping for Base UI migrants.

### Contract

```ts
export const toggleContract = contract("toggle", {
  anatomy: ["root", "indicator"],
  locate: (name: string) => ({ role: "button", name }),
  actions: {
    setPressed: {
      pointer: async (env, pressed: boolean) => { if (await isOn(env) !== pressed) await env.part("root").click() },
      touch: async (env, pressed: boolean) => { if (await isOn(env) !== pressed) await env.part("root").tap() },
      keyboard: async (env, pressed: boolean) => { if (await isOn(env) !== pressed) await env.part("root").press("Space") },
      done: async (q, pressed) => (await q.isPressed()) === pressed,
    },
    activateWithEnter: {
      keyboard: async (env, pressed: boolean) => { if (await isOn(env) !== pressed) await env.part("root").press("Enter") },
      done: async (q, pressed) => (await q.isPressed()) === pressed,
    },
  },
  queries: {
    isPressed: async (env) => (await env.part("root").attr("aria-pressed")) === "true",
    isDisabled: async (env) => (await env.part("root").attr("disabled")) !== null
      || (await env.part("root").attr("aria-disabled")) === "true",
  },
  states: { off: { isPressed: false }, on: { isPressed: true } },
  events: { PRESS: { action: "setPressed", args: (ctx) => [!ctx.values.pressed] } },
  traits: [],
})
```

- Queries read `aria-pressed`, never `data-state`, so composition collisions
  (radix#602) cannot fool the driver.
- The stable-name rule needs no new invariant: the generic "exactly one element
  matches the anchor" check re-locates by exact name after each step.
- `activateWithEnter` is keyboard-only (allowed: the keyboard-twin rule binds pointer
  actions); `testMachine` covers it through a per-contract extra path in the tests.

### Parts (React)

`Toggle.Root` (`useMachine`, `render`), `Toggle.Indicator` (`fallback` prop). Thin:
props from connect through `normalizeProps`/`mergeProps`.

### Theme

`packages/theme/src/toggle.css`: on state = inner outline + background token; forced
colors map on state to `Highlight`/`HighlightText`, disabled to `GrayText`; 24 px
minimum size; focus ring from `base.css`.

## Risks / Trade-offs

- [The dev name check costs an accname computation per toggle in development] → dev
  only, one element.
- [Consumers wanting "Mute"/"Unmute" labels] → documented with the Indicator recipe and
  the APG rationale; the warning tells them why.
- [Composition still collides on `data-state`/`data-scope` for styling] → driver and
  ARIA are safe; the styling collision is a framework-wide open question.

## Migration Plan

None: new component. Reado has no Toggle today.

## Open Questions

- How `render` composition of two components' parts on one element should merge
  `data-state`/`data-scope` (radix#602) — decided with the first overlay trigger
  (Tooltip); does not change Toggle's specs.
