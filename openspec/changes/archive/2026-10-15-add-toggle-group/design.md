## Context

See proposal.md for why. Toggle Group sits on `add-foundations` (runtime, controllables,
contracts, drivers, `testMachine`), `add-a11y-foundations` (press, modality, keys, focus
attributes, ids), `add-collections` (static registration, navigation, composite,
selection model) and `add-toggle` (the item). Research and bug history:
[toggle-group.md](../../../docs/research/toggle-group.md).

## Goals / Non-Goals

**Goals:**
- Reuse Toggle's connect for items with `pressed` owned by the group: no second toggle
  implementation, no per-item services.
- One semantics in both modes, decided with the evidence in the research note.

**Non-Goals:**
- Forms, indicator (proposal). Toolbar integration is hosted mode (Connect).

## Decisions

### Semantics: `aria-pressed` in both modes

Radio roles would promise radio keys (arrows check) and "cannot uncheck"; Toggle Group
keeps toolbar keys and allows deselect, so the roles would lie (radix#4119). APG accepts
move-only radios only inside a toolbar, where the toolbar is the composite. The "one of N"
cue radio roles give is real (radix#3188, base-ui#3525); rind-ui provides it with
Segmented Control, which is a radio group with radio keys. Alternative considered: radio
roles only when `selectionMode: "single"` and `disallowEmptySelection` — rejected: the
keyboard still contradicts the role, and the role would flip with a prop, which breaks
drivers and docs.

### Machine

```
            FOCUS (item)                 BLUR (focus left the group)
   idle ───────────────────► focused ───────────────────────────► idle

focused:  NAVIGATE                → navigate (highlight + focus only)
          FOCUS (another item)    → highlightFocused
root:     PRESS (item)            → highlight, toggleKey
          COLLECTION.CHANGE       → repairCollection
          $sync:value / $reverted
effects: focusHighlighted (focused only)
```

- `value: string[]` controllable mapped to the collections `SelectionValue`;
  `selectionMode` from props; `selectionBehavior: "toggle"`; `disallowEmptySelection` from
  props. `toggleKey` is the collections `select` with `toggle` behaviour, so single mode
  replaces and both modes deselect unless empty is disallowed.
- No guard reads modality for selection: only `PRESS` changes the value, so focus can never
  commit. `NAVIGATE` has no selection action at all.
- Disabled items send no `PRESS` (press factory via the toggle's button-like element);
  navigation skips them through `navigable`.

### Connect

- `root`: `role="group"`, `data-*`, keydown → `toLogicalKey(desc, { dir, orientation:
  vertical ? "both" : "horizontal" })` → `NAVIGATE` (`NEXT`, `PREV`, `FIRST`, `LAST`);
  ignores modified, composing and descendant-target keys; collections container props only
  for the no-navigable-item fallback; never `aria-orientation`.
- `item`: `toggleConnect` (from `add-toggle`) called with `pressed = isSelected(key)` and a
  press handler that sends the group's `PRESS { key }`, merged with the collections roving
  props (`tabIndex`, `data-highlighted`, `data-key`) and `data-orientation`. Toggle's
  `aria-pressed` stays accessibility-critical.
- Hosted mode (add-toolbar's `CompositeHost`, spec "Hosted By A Toolbar"): when a host
  is present, items also register with the host and take `host.itemProps(key)` instead
  of the collections roving props; the root renders no keydown navigation and no
  fallback `tabIndex`; host `disabled` / `focusableWhenDisabled` apply. `role="group"`,
  `aria-pressed` and the value are unchanged; the machine never receives `NAVIGATE`.
- Development warning for an unnamed root.
- Press on pointer focuses the pressed item through `focusSafely` (Safari does not focus
  buttons on click; radix#703).

### Shared modules

`core/collection` (`selection.ts` toggle behaviour, `navigation.ts`, `machine.ts`,
`composite.ts` with the SSR fallback), `core/dom` (`item-registry.ts`, `press.ts`,
`modality.ts`, `keyboard.ts`, `focus-safely.ts`), `core/a11y` (`keys.ts`), `core/ids.ts`,
and `add-toggle`'s connect.

### Contract

```ts
export const toggleGroupContract = contract("toggle-group", {
  anatomy: ["root", "item"],
  locate: (name: string) => ({ role: "group", name }),
  actions: {
    toggle: {
      pointer: (env, name: string) => env.part("item", { role: "button", name }).click(),
      touch: (env, name: string) => env.part("item", { role: "button", name }).tap(),
      keyboard: async (env, name: string) => { await arrowTo(env, name); await env.press("Space") },
      done: flippedFromBefore, // compares aria-pressed with the value read before the action
    },
  },
  queries: { items, pressed, focusedItem, isDisabled },
  traits: ["composite-roving", "directional"],
  invariants: [explicitAriaPressedEqualsSelection],
})
```

Event mapping: `$sync:value` → prop step `{ props: (target) => ({ value: target }) }`;
`COLLECTION.CHANGE` → a prop step adding or removing an item. `bindProp` is not used.

The foundations' `selectable` trait checks `aria-selected`/`aria-checked` only, so the
`aria-pressed` check is a per-component invariant (always on, not removable by
consumers).

### Parts (React)

`ToggleGroup.Root` (`useMachine`), `ToggleGroup.Item` (registers via
`use-collection-items`, renders Toggle's root props). Thin.

### Theme

Component tokens `--rind-toggle-group-*` (tier 3 of decision 0007, proposed), each defaulting to a semantic token; the stylesheet reads only those. `packages/theme/src/toggle-group.css`: imports the toggle pressed cue, joins adjacent
borders, 24 px minimum target, focus ring from `base.css`.

## Risks / Trade-offs

- [Single mode loses the "1 of N" cue that radio roles gave Radix users] → documented in
  the docs page and migration notes ("from Radix: single-choice toggle groups that must
  convey exclusivity → Segmented Control"), as base-ui#3525 asked.
- [`string[]` in single mode is less ergonomic than `string | null`] → one shape, no
  discriminated props, no `""`-as-none bugs (radix#2254).
- [Vertical groups react to Left/Right] → consistent with Tabs; documented.

## Migration Plan

None: new component.

## Open Questions

None that change the specs. Toolbar integration is settled with `add-toolbar`.
