## Context

See proposal.md for why and specs/toolbar/spec.md, specs/composite-host/spec.md for
behaviour. Research and the Bug history the scenarios cite:
[toolbar.md](../../../docs/research/toolbar.md). This change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter (`render`, merged handlers called once) |
| `add-a11y-foundations` | `core/dom/press` (activation, virtual clicks, Press Without Focus), `core/dom/keyboard` (`toLogicalKey` with `dir` / orientation, IME guard), modality, `focusSafely`, `data-focus(-visible)`, invariants |
| `add-collections` | static item registration (`item-registry`, `use-collection-items`), `navigation.ts` (bounded walker, loop, disabled), `composite.ts` roving props, repair on `COLLECTION.CHANGE`, `focusHighlighted`, collection contract fragment |
| `add-button` | `button-like-element` for `Toolbar.Button` |
| `add-separator` | `separatorProps({ context: "toolbar", defaultOrientation })` |
| `add-theme-system` | tier-3 tokens and stylesheet convention |

## Goals / Non-Goals

**Goals:**
- Key ownership decided by one pure function, testable in Node.
- Hosted composites reuse their own machines and connects; no toolbar-specific copies.
- The toolbar graph is the collections roving fixture plus one programmatic event.

**Non-Goals:**
- Overflow, nested toolbars, typeahead (proposal).

## Decisions

### 1. Machine

```
            FOCUS (control)                 BLUR (focus left the toolbar)
   idle ─────────────────────► focused ──────────────────────────────► idle

focused:  NAVIGATE { move: next | previous | first | last }  → navigate (highlight + focus)
          FOCUS (another control)                             → highlightFocused
root:     FOCUS_TOOLBAR                                       → focusHighlighted (programmatic)
          COLLECTION.CHANGE                                   → repairCollection
effects (focused): focusHighlighted
```

- Context: the collections fields only (`highlightedKey`, `highlightSource`,
  `lastCollection`). No selection. The highlight is **not** cleared on `BLUR`: it is the
  "last focused control" memory, and the roving tab stop is computed from it.
  `data-highlighted` is connect-side `highlighted && state === "focused"`.
- Props: `orientation` (default `horizontal`), `loop` (default `true`), `disabled`,
  `focusableWhenDisabled` (default `true`). Navigation uses `navigable = enabled ||
  focusableWhenDisabled` per control (a control's own setting wins over the root's).
- `FOCUS` carries `{ key, modality }`; it only highlights (invariant 13: focus never
  commits). Pointer presses focus through `focusSafely` (Safari does not focus buttons
  on click), which arrives as `FOCUS`.
- SSR: before registration, the first rendered control claims `tabIndex=0` (the same
  rule add-toggle-group uses; the collections fallback to the container is not used,
  because a toolbar always has controls).
- *Alternative:* React Aria's all-tabbable toolbar with Tab interception — rejected
  (APG contract, adobe/react-spectrum#10496, #5457).

### 2. Key ownership (connect)

```ts
// core/components/toolbar/toolbar.keys.ts — pure, no DOM globals
export function toolbarKeyAction(
  key: KeyDescription,                // key, modifiers, composing, defaultPrevented, shift
  target: { isControl: boolean; textField: { value: number; start: number; end: number } | null },
  opts: { orientation: "horizontal" | "vertical"; dir: "ltr" | "rtl" },
): "next" | "previous" | "first" | "last" | null
```

1. `null` unless `target.isControl` (registered element === `event.target`), no
   Alt/Ctrl/Meta, not composing, not `defaultPrevented`.
2. `toLogicalKey(key, { dir, orientation })` from a11y-foundations; only `NEXT`, `PREV`
   on the toolbar's axis and `FIRST`, `LAST` map; the perpendicular arrows never map.
3. Text field: `FIRST`/`LAST` → `null`; `NEXT` only when `!shift && start === end ===
   value`; `PREV` only when `!shift && start === end === 0`.
4. Connect turns a non-null result into `NAVIGATE` and calls `preventDefault()`.

`textField` is read through `core/dom` (`isTextField(el)`: `tagName` + `type` list,
`isContentEditable`; never `instanceof`, ariakit#6316). Contenteditable caret uses the
selection of the element's own document.

Because the toolbar only listens on its root and checks `event.target`, keys from
portalled popups and nested content are ignored without asking every component to stop
propagation (mui/base-ui#1759). A component that must keep an axis arrow (a slider or a
number field hosted later) calls `preventDefault()` on it and the toolbar steps aside.

### 3. Composite host (`core/collection/composite-host.ts`)

```ts
export interface CompositeHost {
  readonly kind: "toolbar"
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  /** Register a hosted item; it joins the host's collection in document order. */
  register(item: RegisteredItem): () => void
  /** Roving props for a hosted item (tabIndex, data-highlighted, onFocus → host FOCUS). */
  itemProps(key: CollectionKey): CompositeItemProps
}
```

- The toolbar adapter provides it (React context `CompositeHostContext`); the toolbar's
  item registry is the one in `core/dom/item-registry.ts`, so hosted items are sorted
  with the toolbar's own controls by document position once per commit.
- A hosted component registers each item twice: in its **own** registry (its collection
  still drives its value — toggle pressed set, radio value, disabled) and in the
  **host's** (navigation, tab stop). Its connect, when `host` is present: root gets no
  keydown navigation and no fallback `tabIndex`; items take `host.itemProps(key)` instead
  of its own roving props; its own machine never receives `NAVIGATE`.
- Radio Group hosted: `NAVIGATE` never reaches it, so "check on move" cannot happen; the
  item's activation keys become Space **and** Enter (APG toolbar example).
- Portal boundary: the React adapter resets `CompositeHostContext` to `null` inside
  `Portal` and inside overlay content, so components in popups are not hosted.
- *Alternatives:* Radix's `rovingFocus={false}` prop on each composite (a flag the
  consumer must remember, and the radio case is missing — radix#2146); Base UI's
  `stopPropagation` per component (a rule every component must remember,
  mui/base-ui#1759); a toolbar-specific Toggle Group (two implementations).

### 4. Parts (React)

`Toolbar.Root` (service, `CompositeHostContext`, item registry), `Button`
(`button-like-element` + roving props), `Link` (`a` + roving props; Space → one
`click()`, `preventDefault`; Enter native; built with add-link's `linkProps` for
modifier clicks, router and disabled rules, amended from add-link), `Item` (roving props merged onto whatever
`render` gives — a Menu / Select / Popover / Tooltip trigger, an input), `Group`
(`role="group"`, disables its controls; provides the same host context with its
`disabled`), `Separator` (`separatorProps`). Text-field controls that are disabled and
focusable get `readOnly` + `aria-disabled` (mui/base-ui#5366). Thin.

### 5. Contract

```ts
export const toolbarContract = contract(toolbarMachine, {
  scope: "toolbar",
  locate: { role: "toolbar", name: true, part: "root" },
  ...collectionContract({ itemRole: "any", strategy: "roving", select: "none" }), // queries only
  traits: ["composite-roving", "directional"],
  actions: {
    tabIn: { keyboard: tabFromPrevious, done: focusInside },
    moveTo: { keyboard: arrowUntilFocused /* one cycle */, pointer: { none: "pointer focus is a press" }, done: focusedIs },
    press: { pointer: clickControl, touch: tapControl, keyboard: moveToThenActivate, done: activatedOnce },
    tabOut: { keyboard: tabForward, done: focusOutside },
    focus: { keyboard: { none: "programmatic API" }, programmatic: callFocus, done: focusInside },
  },
  queries: { items, focusedItem, tabStop, isDisabled, orientation },
  events: {
    NAVIGATE: "moveTo", FOCUS: "press", BLUR: "tabOut", FOCUS_TOOLBAR: "focus",
    "COLLECTION.CHANGE": { props: (target) => ({ controls: target }) },
  },
})
```

`press` postcondition is per control kind: a button / link fired one activation (spy in
fixtures), a toggle flipped `aria-pressed`, a trigger opened. Hosted components keep
their own contracts and drivers, located by name anywhere in the document.

### 6. Theme

`packages/theme/src/toolbar.css`: tier-3 `--rind-toolbar-bg`, `-border`, `-radius`,
`-padding`, `-gap`, `-group-gap`, `-separator-color` (→ `--rind-separator-color`), each
read with a semantic fallback. The toolbar draws only its container, gaps and
separators; controls keep their own stylesheets. Toolbar buttons and links follow the
`toggle item` family (soft / outline / **ghost**), as Toolbar toggles already do in the
matrix (request below). `data-tone="danger"` capture covers a destructive button.

## Requests to other changes

To `add-radio-group` — APPLIED (coordinator, 2026-10-14):

1. **APPLIED (coordinator, 2026-10-14).** **Hosted mode instead of the `checksOnMove` flag.** Its design says "`add-toolbar`
   will set `checksOnMove` to `false`". With the composite host the group never receives
   `NAVIGATE` while hosted, so the flag is unnecessary. Ask instead: when a
   `CompositeHost` is present, (a) items register with the host and take
   `host.itemProps(key)`, (b) the root renders no keydown navigation and no fallback
   `tabIndex`, (c) item activation accepts **Enter as well as Space** (APG toolbar
   example), (d) host `disabled` / `focusableWhenDisabled` apply. Spec: a "Hosted By A
   Toolbar" requirement pointing to `composite-host`.

To `add-toggle-group`:

2. **APPLIED (coordinator, 2026-10-14).** **Hosted mode.** Its proposal leaves "no own tab stop and no loop inside a Toolbar"
   here. Ask: when a `CompositeHost` is present, items register with the host and take
   its roving props; the root renders no keydown navigation; the "tab stop is always an
   item" rule is the host's; roles (`group`, `aria-pressed`) and value unchanged.

To `add-theme-system` (`theme-variants`, Family Matrix):

3. **APPLIED (coordinator, 2026-10-14) — `toggle item` row only; the Toolbar root in `panel` was not in the approved scope.** Extend the `toggle item` row's components to "Toggle Group item, Toolbar button,
   link and toggle" (only "Toolbar toggle" is listed), and add the Toolbar root to
   `panel` (no variant; `data-size` inherited by its controls).

To `add-collections` — none: the composite host reuses `item-registry` and
`composite.ts` as published; a second registry instance per host is ordinary use.

## Risks / Trade-offs

- [Consumers expect Up / Down to move in a horizontal toolbar, as VoiceOver hints
  (radix#756)] → APG reserves them for controls; documented.
- [A text field in the middle of a toolbar makes navigation slower (caret first)] → it
  is what Base UI and Ariakit do and what users of text fields expect; APG suggests text
  fields last, documented.
- [Hosted components must support the host] → only Toggle Group and Radio Group in this
  wave (requests 1–2); other composites placed in a toolbar stay standalone (their own
  tab stop) until their change adds hosting.
- [Contenteditable caret detection is approximate (selection in shadow roots)] → caret
  read through the element's root `getSelection`; shadow-root editors tested in browser
  mode.

## Migration Plan

New API. No Reado usage today. From Radix: `Toolbar.ToggleGroup` / `ToggleItem` become a
`ToggleGroup` inside `Toolbar.Root`; `asChild` triggers become `Toolbar.Item render`.
