## Context

See proposal.md for motivation and specs/tag-group/spec.md for behaviour. Research, the
library comparison and the Bug history the scenarios cite:
[tag-group.md](../../../docs/research/tag-group.md). This change consumes, without
restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, `controllable()` (`value`), `bindProp()` (`selectionMode`, `disabled`, `removable`), effects, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter (ids, per-part selectors, expected parts) |
| `add-a11y-foundations` | `core/dom/press` (tag and TagRemove presses, `virtual`/`touch`, `preventFocusOnPress` on TagRemove), `core/dom/hover`, modality (hint gating), `core/dom/keyboard` (logical keys, RTL, repeats), announcer (polite), hidden content (hint node), `messages`, invariants |
| `add-collections` | `Collection`, static item registration, `collectionActions` (`navigate`, `highlight`, `typeahead`, `select`, `deselect`, `repairCollection`), `collectionEffects.focusHighlighted`, roving composite props, "Exactly One Tab Stop", "Repair When The Collection Changes", selection model (`toggle`, `disallowEmptySelection`), collection contract fragment, `selectable` trait |
| `add-button` | `button-like-element` for TagRemove (native button, disabled rules) |
| `add-theme-system` | stylesheet convention, `status` family, `data-tone` |

## Goals / Non-Goals

**Goals:**
- Removal is the collections repair applied to a consumer-owned collection: no second focus
  repair, no unmount-driven restore (Reka's approach).
- One Tab stop and a guessable keyboard path for removal without a second stop.
- The same roles on every device (no Ariakit-style touch role swap).

**Non-Goals:**
- Input chips (`add-combobox`), tag creation/editing (Tags Input), collapsing (`maxRows`).

## Decisions

### 1. Machine

```
idle ──FOCUS──► focused ──BLUR──► idle
focused: NAVIGATE · HIGHLIGHT · TYPEAHEAD · ACTIVATE · REMOVE
root:    COLLECTION.CHANGE → repairCollection, announceRemoved · $sync:value · $reverted ·
         REMOVE (TagRemove press may arrive before FOCUS)
entry(focused): highlightInitial (last highlighted → first selected → first navigable)
exit(focused):  resetTypeahead
effects(focused): focusHighlighted (roving)
```

```ts
type TagGroupEvent =
  | CollectionEvent                                     // add-collections design §5
  | { type: "FOCUS"; modality: Modality } | { type: "BLUR" }
  | { type: "ACTIVATE"; key: CollectionKey; modality: Modality; via: "enter" | "space" | "press" }
  | { type: "REMOVE"; key: CollectionKey; via: "delete" | "backspace" | "enter" | "space" | "button" }
```

- `ACTIVATE` resolves the precedence of spec "Actions And Links" in one action
  (`activate`): `href` → `followLink` effect (`core/dom` clicks the tag's anchor), `onAction`
  → callback, selectable → collections `select` with `{ shift: false, mod: false }` in
  `toggle` behaviour, else, for keyboard `via` and a removable tag, it re-sends `REMOVE`.
  A press never reaches the removal branch (guard `fromKeyboard`).
- `REMOVE` (action `requestRemoval`): ignored when the tag or group is disabled or the group
  is not removable; keys = the selection minus disabled keys when the tag is selected and
  `via` is a key, else `{ key }`; deselects them (selection-model "Removing an item on purpose
  deselects it explicitly"), calls `onRemove(keys, { reason: via })`, stores
  `pendingRemoval: { keys, texts }` in context (texts captured now, since the items will be
  gone).
- `COLLECTION.CHANGE` runs `repairCollection` (collections; focus follows in roving mode,
  else the List) and `announceRemoved`: the keys of `pendingRemoval` no longer in the new
  collection are announced (one → `removedAnnouncement(text)`, several →
  `removedCountAnnouncement(n)`), then `pendingRemoval` is cleared. A refused removal
  therefore announces nothing.
- `selectionMode`, `disabled` and `removable` (= `onRemove !== undefined`) are read-only
  bound props; `interactive` is computed in `view` and decides the roles in connect. A
  display-only group still runs the machine (for the collection) but connect attaches no
  handlers.
- Context: `CollectionContext` + `pendingRemoval`.

*Alternatives:* restore focus on Tag unmount (Reka; breaks with virtualization and when the
consumer re-keys); RA's effect that focuses the grid when the size drops to zero (a second
repair path; covered by the collections rule "else the container").

### 2. Roles and connect

- `listProps`: `role` = `interactive ? (size > 0 ? "grid" : "group") : "list"`;
  `aria-labelledby` (Label) / `aria-describedby` (Description); `aria-multiselectable` in
  multiple mode; `tabIndex` from the collections tab-stop rule when interactive and empty
  (the List is the container stop); `data-*` per spec.
- `itemProps(key)`: `role="row"` (`listitem` when not interactive), roving `tabIndex`,
  `aria-labelledby` → TagText id unless the consumer passes `aria-label`, `aria-selected`
  explicit when selectable, `aria-disabled`, `aria-describedby` → hint node when
  `removable && enabled && modality ∈ {keyboard, virtual} && !touchDevice`.
- `itemCellProps(key)`: `role="gridcell"` (none when not interactive). The theme gives it
  `display: contents`; connect never relies on the cell or List being a box for focus.
- `itemRemoveProps(key)`: `button-like-element` props, `tabIndex=-1`,
  `aria-label=removeLabel(text)`, `disabled`, press → `REMOVE { via: "button" }` with
  `preventFocusOnPress` and a pointer-down that highlights the tag (focus goes to the row).
- Keymap (through `core/dom/keyboard`, orientation `both`): arrows/Home/End → `NAVIGATE`;
  Delete/Backspace → `REMOVE`; Enter/Space → `ACTIVATE`; printable → `TYPEAHEAD`; Escape not
  mapped. Repeats are allowed for Delete/Backspace only.
- Hint node: one shared hidden description per document and message (`hidden-content`
  "Visually Hidden Content", `display:none` is acceptable for an IDREF target).

### 3. Value shapes

As add-listbox §3 without `"all"`: single `string | null`, multiple `string[]`, set equality
in the controllable. `onValueChange` details reasons: `ACTIVATE`, `REMOVE`.

### 4. React parts

`TagGroup.Root`, `Label`, `Description`, `List`, `Tag` (renders the row and its internal
cell; `render` substitutes the row element), `TagText` (renders `<a>` when the Tag has
`href`), `TagRemove`, `Empty` (rendered by the List only while empty; dev assertion that it
is placed inside List). Tags from `collection` + render function or static `Tag` parts
(collections registration). Dev warnings: interactive List without a name; Tag Group inside
an `option`/`menuitem` (closest role check after commit); TagRemove outside a Tag.

### 5. Contract

```ts
export const tagGroupContract = contract(tagGroupMachine, {
  scope: "tag-group",
  locate: { role: ["grid", "group", "list"], name: true },   // role set (request 1, applied)
  ...collectionContract({ itemRole: "row", strategy: "roving", select: "both" }),
  traits: ({ props }) => ["composite-roving", "directional",
    ...(props.selectionMode && props.selectionMode !== "none" ? ["selectable"] as const : [])],
  announcements: { removalAnnouncement },
  actions: { remove, removeSelected, act },
  queries: { tags, isEmpty, isRemovable },
  events: {
    REMOVE: "remove", ACTIVATE: "act",
    FOCUS: { skip: "covered by every keyboard step" }, BLUR: { skip: "tab out; driver test" },
    "$sync:value": { props: (value) => ({ value }) },
  },
})
```

Props classes as spec "Model-Based Coverage". The removable class supplies a consumer
`onRemove` that drops the keys from the fixture's data, so `COLLECTION.CHANGE` follows; a
second fixture refuses removals (spec "Consumer keeps the tag").

### 6. Theme

`packages/theme/src/tag-group.css`, tier-3 tokens only (decision 0007): `--rind-tag-group-gap`,
`-label-text`, `-description-text`, `-empty-text`, `-tag-height` (≥ 24px), `-tag-padding`,
`-tag-radius`, `-tag-bg`, `-tag-text`, `-tag-border`, `-tag-hover-bg`, `-tag-selected-bg`,
`-tag-selected-text`, `-tag-selected-border`, `-tag-disabled-text`, `-remove-size`,
`-remove-radius`, `-remove-hover-bg`; `status` family rules for `data-variant` (solid,
**soft**, outline) and `data-size`; `data-tone="danger"`; `item-cell` gets `display:
contents`, the List never does (ariakit/ariakit#7160).

## Risks / Trade-offs

- [Enter/Space removing a remove-only tag can surprise someone expecting nothing] → only when
  the tag has no other activation (Fluent's dismissible tags behave the same); the removal is
  announced; open question in the research note for a user test.
- [The remove button is not Tab-reachable] → the RA#7483 audit asked for that; we answer with
  Delete/Backspace + Enter + the hint, and the button stays reachable by virtual cursor and
  touch SR; documented, and the hint is a message the consumer can also render visibly.
- [Role changes with interactivity and emptiness] → a driver locating by role would break;
  the contract locates by the role set and exact name (request 1, applied).
- [Removal depends on the consumer updating its data] → `pendingRemoval` makes refusal safe;
  the docs show the one-line `onRemove` handler.

## Requests to other changes

1. **`add-foundations` (`component-contract` "Location By Accessible Name")** — archived to
   `openspec/specs/component-contract`: allow `locate` to accept a set of roles (here `grid`,
   `group`, `list`) with the exact name, instead of one role. APPLIED (coordinator,
   2026-10-14) as a delta in this change: `specs/component-contract/spec.md` (MODIFIED
   "Location By Accessible Name"); task A.1.
2. **`add-combobox`** (`combobox` "Multiple Selection With Chips", and the shared
   `input-chips` capability the Tags Input change requests): use the same message keys and
   defaults as Tag Group for the shared strings — `removeLabel(text)` ("Remove {text}") and
   `removedAnnouncement(text)` ("{text} removed") — so a consumer translating both
   components writes each string once. No behaviour change: input chips stay a `toolbar`
   inside the control and are not composed from Tag Group (supersedes the note in
   combobox.md Decisions that "Chips becomes a Tag Group composition"). APPLIED (coordinator, 2026-10-14): add-combobox
   `input-chips` "Input Chips Messages", task A.4.
3. **Cross-cutting note `accessibility.md` §1.5**: it mapped Tag Group to the Listbox pattern;
   this change uses the layout grid. APPLIED (coordinator, 2026-10-14): §1.5 now lists Tag Group under Grid as
   "Layout grid (APG Pill List example)".

## Migration Plan

New API. React Aria: `TagGroup`/`TagList`/`Tag` → `TagGroup.Root`/`List`/`Tag`; `Button
slot="remove"` → `TagGroup.TagRemove`; `renderEmptyState` → `TagGroup.Empty`; `onRemove(keys:
Set)` → `onRemove(keys: string[], details)`; `escapeKeyBehavior` has no equivalent. Reka:
`TagGroupRoot`/`TagGroupItem`/`TagGroupItemText`/`TagGroupItemDelete` map one to one; `@remove`
→ `onRemove`.
