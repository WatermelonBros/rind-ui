## Context

See proposal.md for why. Tabs is the first public static-parts collection component. It
sits on four unarchived changes: `add-foundations` (runtime, `controllable()`, `onProps`,
contracts, drivers, `testMachine`), `add-a11y-foundations` (press, modality and its
guards, focus attributes, `toLogicalKey`, element ids, `untilFound`, `focusSafely`,
reduced motion), `add-collections` (collection model, static registration,
`collection/machine.ts` pieces, `composite.ts`, selection model) and `add-button`
(`button-like-element`). Library comparison and bug history:
[tabs.md](../../../docs/research/tabs.md).

## Goals / Non-Goals

**Goals:**
- Prove `add-collections`' static-parts path end to end on a public component.
- Make every Tabs bug class in the research note impossible by construction or caught by
  a generic invariant (focus does not commit, one tab stop, explicit `aria-selected`,
  IDREFs resolve, hidden-but-mounted is hidden for AT).
- One indicator module that Segmented Control reuses unchanged.

**Non-Goals:**
- Links as tabs, closable/reorderable/overflow tabs, popup menus on tabs (proposal).
- Panel enter/exit animations beyond what presence already gives.

## Decisions

### Machine

```
            FOCUS (tab)                 BLUR (focus left the list)
   idle ───────────────────► focused ───────────────────────────► idle

focused:  NAVIGATE  [isKeyboard ∧ automatic] → actions navigate, selectHighlighted
          NAVIGATE                           → actions navigate
          FOCUS (another tab)                → actions highlightFocused (no selection)
root:     PRESS (tab)        [enabled]       → actions highlight, select
          REVEAL (beforematch on a panel)    → actions select (reason "find-in-page")
          COLLECTION.CHANGE                  → actions repairCollection, ensureSelection
          PANEL.TABBABLE                     → actions setPanelTabbable
          INDICATOR.MEASURE                  → actions setIndicator
          $sync:value / $reverted
entry(focused): highlightFocused · exit(focused): syncHighlightToSelection
effects: focusHighlighted (focused only, roving) · measureIndicator (service) ·
         observePanelTabbable (service) · untilFound (service, until-found mode)
```

- Events are the collections union (`NAVIGATE`, `HIGHLIGHT`, `COLLECTION.CHANGE`) plus
  `PRESS` (press interactions, with `modality`), `FOCUS`/`BLUR` (with `modality`),
  `REVEAL { key }`, `PANEL.TABBABLE { key, tabbable }`, `INDICATOR.MEASURE { box, cause }`.
- `value` is a controllable mapped onto the collections `SelectionValue`
  (`selectionMode: "single"`, `disallowEmptySelection: true` for user actions).
- **Keyboard-only automatic activation** is a guard (`isKeyboard` from `core/a11y/guards`)
  on the `NAVIGATE` transition, not on `FOCUS`. `FOCUS` never selects, so a virtual-cursor
  focus, a programmatic focus or a secondary-button focus only moves the highlight. This
  mirrors Ariakit's `moves` counter and Headless UI's key-handler activation and is what
  the `focus-does-not-commit` invariant checks. Alternative considered: selecting on
  `FOCUS` guarded by `modality === "keyboard"` (React Aria's selectOnFocus entry path) —
  rejected: a Tab into the list is also a keyboard focus, and the rule would then depend
  on which key produced the focus.
- `ensureSelection` (uncontrolled only): when the value is `null` and no `defaultValue`
  was given, or the selected key left the collection, select the collections repair
  target (first enabled for a new collection) and call `onValueChange` — with
  `reason: "INITIAL"` for the first pick after registration (a dedicated `INITIAL`
  event sent once by `ensureSelection`), and `reason: "COLLECTION.CHANGE"` when the
  selected tab left the collection. This is a deliberate, Tabs-only exception to the
  selection model's "collection changes never fire the callback": APG requires one
  visible panel, and consumers mirroring the value need to learn which one (base-ui#2097).
  Controlled values are never written.
- `syncHighlightToSelection` on blur keeps the roving stop on the selected tab when focus
  is outside, so controlled changes move the stop (base-ui#2100).
- Disabled is not a guard on `PRESS`: the press factory sends nothing for disabled tabs
  (`button-like-element`); navigation skips them through the collection's `navigable`.

### Connect

- `list`: `role="tablist"`, `aria-orientation` only when vertical, keydown →
  `toLogicalKey(desc, { dir, orientation: vertical ? "both" : "horizontal" })` →
  `NAVIGATE`; ignores events whose target is not a tab part, modified arrows and composing
  events; collections container props (tab stop fallback).
- `tab`: `button-like-element` props + collections roving item props (`tabIndex`,
  `data-highlighted`), `role="tab"`, `aria-selected` (accessibility-critical),
  `aria-controls` only when the panel part for that key is registered as rendered,
  `aria-disabled`, ids from `itemId("tabs", root, "tab", key)`.
- `panel`: `role="tabpanel"`, `aria-labelledby`, `hidden` / `hidden="until-found"` per
  mode, `tabIndex` from the `PANEL.TABBABLE` state, `data-reveal`.
- Orientation `vertical` maps to the logical-key orientation `"both"` (collections), so
  both arrow pairs navigate; `horizontal` stays `"horizontal"`.
- Development warning for an unnamed list (accname subset in `core/dom`).

### Shared modules

- `core/collection`: `list.ts` (via static registration), `navigation.ts`, `selection.ts`,
  `machine.ts` (actions `navigate`, `highlight`, `repairCollection`,
  `scrollToHighlighted`), `composite.ts` (roving props, SSR tab-stop fallback).
- `core/dom`: `item-registry.ts` (static tabs; panels register separately only to know
  which keys are rendered), `press.ts`, `modality.ts`, `keyboard.ts`, `focus-safely.ts`,
  `until-found.ts`, new `selection-indicator.ts`, new `tabbable-content.ts`.
- `core/a11y`: `guards.ts` (`isKeyboard`, `notComposing`), `keys.ts`.
- `core/ids.ts`.

### Selection indicator (`core/dom/selection-indicator.ts`)

A service-scoped effect factory: `selectionIndicator(env, { container, getItem, onMeasure })`.
It measures with cumulative `offsetLeft/Top` (transform-immune) minus intermediate scroll
offsets relative to the container, computes right/bottom from the container's scroll
size, never rounds up, and re-runs on a `ResizeObserver` over the container and every
registered item plus on selection/registration changes. It sends `INDICATOR.MEASURE` with
`cause: "selection" | "layout"`; connect maps `cause === "layout"` to `data-resizing` and
the box to the six custom properties. Alternatives: `getBoundingClientRect` (fractional,
but transform- and viewport-dependent: base-ui#3425, react-spectrum#9931); React Aria's
shared-element transition (imperative inline styles, react-spectrum#10570); Base UI's
pre-hydration inline script (needs a CSP nonce story; deferred).

### Panel tabbability (`core/dom/tabbable-content.ts`)

Observes the visible panel with a `MutationObserver` (subtree, childList, attributes
affecting tabbability) and reports whether it contains a tabbable element (React Aria
`useHasTabbableChild`). It sends `PANEL.TABBABLE` only on change.

### Panels and presence

`unmount` mode renders panel content only for the selected key; the panel element of an
unselected key is not rendered at all. `hidden` and `until-found` keep every panel
mounted; `untilFound()` from `add-a11y-foundations` owns the imperative attribute and
`beforematch` → `REVEAL`. Panel exit animations, when a consumer wants them, go through
presence; by default an inactive panel leaves synchronously so two panels are never laid
out together (ark#2545).

### Contract

```ts
export const tabsContract = contract("tabs", {
  anatomy: ["root", "list", "tab", "panel", "indicator"],
  locate: (name: string) => ({ role: "tablist", name }),
  actions: {
    select: {
      pointer: (env, name: string) => env.part("tab", { role: "tab", name }).click(),
      touch: (env, name: string) => env.part("tab", { role: "tab", name }).tap(),
      keyboard: (env, name: string) => arrowTo(env, name, { thenEnterIfManual: true }),
      done: async (q, name) => (await q.selected()) === name,
    },
    focusTab: {
      // keyboard-only: a pointer "focus" is a press, which is `select`
      keyboard: (env, name: string) => arrowTo(env, name),
      done: async (q, name) => (await q.focusedTab()) === name,
    },
  },
  queries: { tabs, selected, focusedTab, panel, isDisabled },
  traits: ["composite-roving", "selectable", "directional"],
})
```

Event mapping uses the foundations' review follow-ups: `$sync:value` → a prop step
`{ props: (target) => ({ value: target }) }` (controlled argument class);
`COLLECTION.CHANGE` → a prop step that inserts or removes a tab; `INDICATOR.MEASURE` and
`PANEL.TABBABLE` → `{ skip: "environment event: measured layout / DOM mutation" }`;
`REVEAL` → `{ skip: "find-in-page is browser-driven; covered by browser tests" }`.
No parent-only prop binds a state, so `bindProp` is not used.

`arrowTo` reads `aria-orientation` and the document direction to choose keys, and fails
after one full cycle (bounded). The model runner's argument classes: no default value,
first tab disabled, selected tab disabled, all disabled, vertical, manual, `until-found`.

### Parts (React)

`Tabs.Root` (`useMachine`, provides the service), `Tabs.List`, `Tabs.Tab` (registers via
`use-collection-items`), `Tabs.Panel` (registers its key as rendered, attaches
`untilFound` and the tabbable observer), `Tabs.Indicator` (attaches the indicator effect).
No logic in parts.

### Theme

Component tokens `--rind-tabs-*` (tier 3 of decision 0007, proposed), each defaulting to a semantic token; the stylesheet reads only those. `packages/theme/src/tabs.css`: underline indicator sized from the custom properties,
transition on `left/top/width/height` from duration tokens, `[data-resizing]` and reduced
motion → no transition; selected tab gets a bottom border under forced colors
(`Highlight`), disabled `GrayText`; 24 px minimum target; focus ring from `base.css`.

## Risks / Trade-offs

- [Firing `onValueChange` for the automatic default differs from the selection model's
  rule] → limited to uncontrolled Tabs; documented; covered by a scenario.
- [`unmount` default loses panel state on switch] → `hidden` mode documented as the fix
  (radix#1155); `until-found` for findable content.
- [Layout offsets are integers; fractional tab widths lose up to 1 px] → never rounded up
  (no overflow); themes that need sub-pixel precision can use `round()`.
- [MutationObserver on every visible panel] → one observer, only on the visible panel,
  disconnected on switch.
- [Vertical lists react to Left/Right, which a consumer might bind to something else] →
  consistent with React Aria; keys from descendants are ignored.

## Migration Plan

None: new component. Reado does not use Tabs today.

## Open Questions

- Whether a pre-hydration indicator script is worth a CSP nonce option — deferred; the
  indicator is hidden until the first measurement, which the specs already require.
