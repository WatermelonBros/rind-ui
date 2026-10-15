## Context

See proposal.md for why. Binding sources are the Decisions in
[accordion.md](../../../docs/research/accordion.md), and everything `add-collapsible`
specifies for Collapsible: the machine, connect, `content-size`, presence and
until-found bindings. This change consumes those modules. It also uses the
logical keys and RTL mirroring of `add-a11y-foundations`, and the runtime and
contracts of `add-foundations`.

## Goals / Non-Goals

**Goals:**
- An accordion item is a Collapsible: the same machine, connect and part
  bindings. The accordion adds only the group value, the header, the lock, the
  region rule and optional navigation.
- No pointer or key handling outside triggers.

**Non-Goals:**
- Changing Collapsible. If a hook is missing (for example, connect needing the
  trigger's lock), it is added here as accordion connect output, layered on
  Collapsible's props.

## Decisions

### 1. Reuse Collapsible: one service per item, controlled by the root

```
Accordion root service (accordion.machine)
   └─ value: string[] (controllable), items: registered keys in DOM order
Item (React)  ── runs collapsible.machine with
                   props.open = value.includes(item)       (controlled)
                   props.onOpenChange = (open, d) → root.send(ITEM.TOGGLE | ITEM.OPEN | ITEM.CLOSE)
                   props.disabled = item.disabled || root.disabled
```

- The collapsible's user events (`TOGGLE` from the trigger press, and
  `OPEN { reason: "find-in-page" }` from `beforematch`) become controlled
  proposals. The adapter forwards them to the root, which decides. The item
  then learns the result through `$sync` (accepted) or `$reverted` (refused;
  until-found re-applies `hidden`).
- Because the collapsible runs controlled, its own `notDisabled` guard is
  re-checked by the root (`itemEnabled`). The lock is a root guard
  (`canCollapse`), so a locked trigger never toggles.
- These are sibling services wired by the adapter, which `add-foundations`
  allows. The accordion graph and each collapsible graph stay separate.
- *Alternatives considered:*
  - One accordion machine rendering triggers and contents itself: that is
    Bits, with duplicated content logic.
  - A collection with selection semantics: that is Kobalte and old Spectrum,
    and brings typeahead, pointer interception, RA#2801 and KB#440.

### 2. Accordion machine

```ts
type AccordionEvent =
  | { type: "ITEM.REGISTER"; item: ItemKey; disabled: boolean }
  | { type: "ITEM.UNREGISTER"; item: ItemKey }
  | { type: "ITEM.TOGGLE"; item: ItemKey; modality: Modality }
  | { type: "ITEM.OPEN"; item: ItemKey; reason: "api" | "find-in-page" }
  | { type: "ITEM.CLOSE"; item: ItemKey; reason: "api" }
  | { type: "FOCUS.NEXT" | "FOCUS.PREV" | "FOCUS.FIRST" | "FOCUS.LAST"; from: ItemKey }

states: {
  idle: {
    on: {
      "ITEM.REGISTER": { actions: ["register"] }, "ITEM.UNREGISTER": { actions: ["unregister"] },
      "ITEM.TOGGLE": [
        { guard: { and: ["itemEnabled", "isOpen", "canCollapse"] }, actions: ["closeItem"] },
        { guard: { and: ["itemEnabled", { not: "isOpen" }] }, actions: ["openItem"] },
      ],
      "ITEM.OPEN": { guard: { not: "isOpen" }, actions: ["openItem"] },   // single mode: replaces
      "ITEM.CLOSE": { guard: { and: ["isOpen", "canCollapse"] }, actions: ["closeItem"] },
      "FOCUS.NEXT": { guard: "navigationEnabled", actions: ["focusNext"] }, // …PREV/FIRST/LAST
    },
  },
}
values: { value: controllable("value", { fallback: [], equal: sameKeys }) }
```

- `ItemKey` is a branded non-empty string.
- `openItem` writes `[item]` in single mode and `[...value, item]` in multiple
  mode. `closeItem` filters. The guards read `props.multiple`,
  `props.collapsible` and `props.keyboardNavigation`, which gives the runner
  its configurations.
- Focus actions call `env.focus` with `focusSafely` on the registered trigger
  ids in DOM order, skipping disabled triggers unless they are focusable.
- Find-in-page reveal of a closed item is `ITEM.OPEN`. In single mode it
  closes the open one; opening is never refused by the lock.
- The single-mode multi-key warning and the trimming to the first key happen
  in a `computed` (`openKeys`), so connect and items read one source.
- Graph: a single state with internal edges; the coverage comes from props
  configurations × argument classes (see the contract in specs). This is
  recorded as a known shallowness. The per-contract invariants check the value
  semantics after every step.

### 3. Connect (adds to Collapsible's per-item props)

- `Header`:
  - `h{headingLevel}`, defaulting to the surrounding `Heading.Level` context level
    when inside one, else `h3` (from add-heading);
  - attributes from add-heading's `headingProps`: `role="heading"` plus `aria-level`
    when the rendered tag is not a heading.
    The tag comes from the ref through `core/dom`, as accessibility.md §1.4
    describes for substituted elements.
- `Trigger`:
  - `aria-disabled="true"` and `data-disabled` when the item is locked;
  - for disabled items, the collapsible's own disabled props;
  - with `keyboardNavigation`, a key handler that maps through `toLogicalKey`
    using `{ dir, orientation }`, acts only when `event.currentTarget` is the
    target, and calls `preventDefault` only for the keys it consumed.
- `Content`:
  - `role="region"` and `aria-labelledby` (the trigger id, which follows a
    consumer `id`) only while open and only when the region rule holds:
    `!multiple || items.length <= 6`, or `contentRole`;
  - otherwise neither;
  - children wrapped in a `Heading.Level` one deeper than the header (from
    add-heading).
- `data-orientation` on every part.
- The CSS variable prefix is `rind-accordion`.
- The dev warning for a header with element children other than the trigger
  runs after mount.

### 4. Parts (React)

- `Root` provides the root service and context.
- `Item` registers on mount and unregisters on unmount, with its key and
  disabled flag. It creates the collapsible service with the controlled props
  above.
- `Header`, `Trigger`, `Content` and `Indicator` merge Collapsible's connect
  output with the accordion's additions.
- `closedContent` and `contentRole` are root props. `closedContent` can be
  overridden per item.

### 5. Theme (`packages/theme/src/accordion.css`)

- It reuses the collapsible rules, keyed on `data-scope="accordion"` and the
  `--rind-accordion-*` variables.
- Item separators use borders, so they survive forced colors.
- Locked triggers get no dimming: dimming is keyed on
  `[data-part="item"][data-disabled]`.
- The indicator rotates.

### 6. Tests

- `testMachine`:
  - configurations: `multiple` × `collapsible` × `keyboardNavigation`;
  - modalities: pointer, keyboard, virtual;
  - `directional`, so RTL runs too;
  - argument classes for item events.
- Browser-mode regressions:
  - simultaneous switch transitions (base-ui#3099);
  - input focus on the first click (kobalte#440);
  - arrows, Home and Space in panel inputs (reka-ui#1504, base-ui#2320);
  - navigation after unmount (ark#3732);
  - SSR `defaultValue` (kobalte#226).

## Risks / Trade-offs

- [The accordion's model graph is one state, so a path walk alone does not
  exercise value semantics] → props configurations, argument classes and
  per-contract invariants, plus each item's Collapsible model test.
- [The region rule depends on the registered item count, which can change as
  items mount] → the rule is recomputed per snapshot. It changes a role only
  on open items, which AT handles like any attribute change.
- [`collapsible: true` differs from Ark/Radix defaults (`false`)] → it is a
  documented default. The Reado migration sets it explicitly where needed.
- [Users of the removed APG arrow keys expect them] → `keyboardNavigation`
  restores them, scoped to triggers.

## Migration Plan

None: there is no public API yet. Reado's Ark accordions map to
`multiple`/`collapsible` as written, plus `keyboardNavigation` where Ark's arrow
keys were relied on.

## Open Questions

- Should the six-item threshold of the region rule count all items, or only
  enabled ones? The spec counts all items, which is the conservative reading of
  APG. Changing it alters one guard.
