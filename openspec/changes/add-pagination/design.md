## Context

See proposal.md for why. Binding sources: the Decisions in
[pagination.md](../../../docs/research/pagination.md) and these unarchived changes,
which this change uses without modifying:

| From | Used for |
|---|---|
| `add-foundations` | `setup().machine()`, `controllable()`, `onProps`, `$sync`/`$reverted`, contracts (`{ skip }`, prop steps), drivers, `testMachine`, React adapter, `render` |
| `add-a11y-foundations` | press interactions (`PRESS` with modality, Enter/Space by role), `data-focus`/`data-focus-visible`, `partId`, `messages` + `resolveMessages`, locale/`dir`, invariants |
| `add-button` | `button-like-element` (native `<button type="button">`, substitution, `focusableWhenDisabled`) |
| `add-link` | `link-navigation`: `linkProps()`, the injected `Router` capability, `RouterProvider`, modifier-click rules |
| `add-popover` | the "default name only without own content" rule for triggers (Messages) |
| `add-theme-system` | stylesheet convention, `toggle item` family, `data-tone` |

No `core/dom` or `core/collection` module is added. `core/collection` is not used: the
controls are a plain Tab sequence, not a composite (§5).

## Goals / Non-Goals

**Goals:**
- A pure range function whose invariants are tested by property, so the bug class
  "wrong pages shown" is closed once.
- Link mode that changes elements and never breaks native link behaviour.
- No focus loss at the ends.

**Non-Goals:** see proposal Non-goals.

## Decisions

### 1. Machine (`pagination.machine.ts`)

```ts
type PaginationEvent =
  | { type: "SET_PAGE"; page: number; modality: Modality }
  | { type: "PREV" | "NEXT" | "FIRST" | "LAST"; modality: Modality }
  | { type: "SET_PAGE_SIZE"; pageSize: number }          // API / consumer control
  | { type: "COUNT.CHANGE" }                             // onProps: total shrank below page

setup({
  types: type<{ props: PaginationProps; events: PaginationEvent; env: LoggerEnv }>(),
  guards: { enabled, notCurrent, hasPrev, hasNext, outOfRange },
  actions: { setPage, step, toEnd, setPageSize, keepFirstItem, clampPage },
}).machine({
  id: "pagination",
  values: {
    page: controllable("page", { fallback: 1 }),
    pageSize: controllable("pageSize", { fallback: 10 }),
  },
  initial: "idle",
  states: { idle: { on: {
    SET_PAGE: { guard: ["enabled", "notCurrent"], actions: ["setPage"] },
    PREV: { guard: ["enabled", "hasPrev"], actions: ["step"] },
    NEXT: { guard: ["enabled", "hasNext"], actions: ["step"] },
    FIRST: { guard: ["enabled", "hasPrev"], actions: ["toEnd"] },
    LAST: { guard: ["enabled", "hasNext"], actions: ["toEnd"] },
    SET_PAGE_SIZE: { actions: ["setPageSize", "keepFirstItem"] },
    "COUNT.CHANGE": { guard: "outOfRange", actions: ["clampPage"] },
  } } },
})
```

- `totalPages(props, pageSize)` = `max(1, totalPages ?? ceil(count / pageSize))`; the
  resolved page is `clamp(page, 1, totalPages)` at view time, so a render never shows a
  page outside the total even before `COUNT.CHANGE` is processed.
- `onProps` sends `COUNT.CHANGE` when `count`, `totalPages` or `pageSize` changes and the
  stored page exceeds the new total.
- One state: the graph is self-loops with guards; `testMachine` covers it through
  argument classes (spec Model-Based Coverage), not states.
- Props are a union: `{ totalPages: number } | { count: number; pageSize?; defaultPageSize?; onPageSizeChange? }`
  plus the common props. `pageSize` with `totalPages` is a type error.
- *Alternative:* states `single | first | middle | last` derived from the page. Rejected:
  they would be a second source of truth for a number, and the runtime binds states to
  values only through `controllable`'s state map, which does not fit a range.

### 2. Range (`pagination.range.ts`)

Zag's `getRange` (constant slots, single-page ellipsis replaced) re-specified as the
invariants in the spec, exported as `paginationRange` and used by `Root`'s state. Keys
`page-<n>`, `ellipsis-start`, `ellipsis-end` (at most two ellipses), so React keeps page
elements across changes (focus stays, spec Focus). Property test over the full grid in
the spec.

### 3. Connect (`pagination.connect.ts`)

- Root: `aria-label` from messages unless `aria-label`/`aria-labelledby` given;
  `data-disabled`. Element `nav` (no role emitted).
- Page: `linkProps({ href: getPageHref(n, size), current: n === page ? "page" : undefined, disabled, focusableWhenDisabled }, env)`
  in link mode, otherwise `buttonLikeProps({ disabled, focusableWhenDisabled })` plus
  `aria-current`; `aria-label` from `messages.page(n)` unless labelled; `data-value`,
  `data-current`. Press → `SET_PAGE { page: n, modality }`.
- Triggers: same split; unavailable → disabled; name from messages only when the
  trigger has no text content (the add-popover close-trigger rule, checked after
  commit); `data-direction`.
- Link activations: the press handler sends `SET_PAGE` only for activations that
  `link-navigation` reports as same-tab primary activations (request 1); modifier and
  middle clicks reach the browser untouched.
- Ellipsis: no role, `aria-hidden="true"` on the part (it holds only the glyph), never
  focusable. Item: `data-type`.
- Dev warnings: duplicate landmark names (checked against other pagination roots in the
  document after mount), controlled `page`/`pageSize` without handler, invalid inputs.

### 4. Disabled defaults

`focusableWhenDisabled` defaults to `true` for every pagination control (button-like
default is `false`). Native `disabled` on a focused Next button drops focus to `<body>`
when the user reaches the last page, and the common "disable while loading" pattern does
the same to whatever control was just pressed. `aria-disabled` keeps the element focused
and still announces it unavailable. The consumer can opt out.

### 5. Keyboard: Tab order, not a composite

accessibility.md §4.2 and collections.md list Pagination with the roving composites. We
deviate: a navigation landmark of links is expected to be traversed link by link (Tab,
browse mode and SR link lists agree), a composite needs a widget role (`toolbar`) that
cannot also be the `nav` landmark, and no shipping library with links uses roving focus
(Bits UI keeps every control tabbable and adds arrows). Arrow keys are therefore left to
the page. This is recorded as request 2.

### 6. Theme (`packages/theme/src/pagination.css`)

- Family `toggle item` (theme-variants Family Matrix: pagination controls fit the row
  next to Toolbar buttons; no new row): default `ghost`, `data-size` sm/md/lg on `Root`
  inherited by controls; the current page uses the family's selected look
  (`[data-current]`), with an edge in the palette `border` role (3:1) and, under
  `forced-colors: active`, a `Highlight` outline.
- Tier-3 tokens, read with semantic fallbacks and never declared:
  `--rind-pagination-gap`, `--rind-pagination-item-min-size` (≥ 24px),
  `--rind-pagination-item-radius`, `--rind-pagination-current-bg`,
  `--rind-pagination-current-fg`, `--rind-pagination-ellipsis-fg`.
- `[data-disabled]` removes hover styling; chevrons mirror under `[dir="rtl"]`;
  `data-tone="danger"` state captured in stories.

### 7. Contract

```ts
export const paginationContract = contract("pagination", {
  anatomy: ["root", "list", "item", "page", "ellipsis", "first", "previous", "next", "last"],
  locate: { part: "root", role: "navigation", name: true },
  actions: {
    goTo: { pointer: ({ part }, n) => part("page", { name: messages.page(n) }).click(),
            keyboard: ({ part, keyboard }, n) => part("page", …).focusWithTab().then(() => keyboard.press("Enter")),
            done: (q, n) => q.currentPage().then((p) => p === n) },
    next, previous, first, last,   // same shape on their trigger parts
  },
  queries: { currentPage, visiblePages, isDisabled, href, focused },
  events: {
    SET_PAGE: "goTo", NEXT: "next", PREV: "previous", FIRST: "first", LAST: "last",
    SET_PAGE_SIZE: { skip: "set by the consumer's control; covered by $props:pageSize" },
    "COUNT.CHANGE": { skip: "emitted from props; covered by $props:count" },
    "$sync:page": { props: (target) => ({ page: target }) },
    "$props:pageSize": { props: () => ({ pageSize: 25 }) },
    "$props:count": { props: () => ({ count: 11 }) },
    "$props:disabled": { props: () => ({ disabled: true }) },
  },
  invariants: [oneCurrentPage, rangeMatchesOracle, ellipsisNotFocusable, disabledLinkHasNoHref],
})
```

`focusWithTab` is the part-handle operation added by `add-tooltip`.

### 8. Requests to other changes

1. **add-link (`link-navigation`)** — `linkProps` SHALL accept `focusableWhenDisabled`
   (disabled link keeps `tabIndex=0`, `role="link"`, `aria-disabled`, no `href`), and
   SHALL let the caller tell a same-tab primary activation from one left to the browser
   (for example an `onActivate` callback or a `PRESS` flag), so Pagination changes the
   page only when the current tab navigates. **Satisfied by add-link**: `linkProps`
   accepts `focusableWhenDisabled` and reports `onActivate({ disposition: "same-tab" |
   "elsewhere" })` ("Disabled Links", "Activation Reports"); nothing left to do.
2. **Cross-cutting notes (accessibility.md §4.2, collections.md table row) and
   add-collections' proposal** — they list Pagination as a roving composite; this change
   decides plain Tab order (§5). Their owners should drop Pagination from those lists.
   No spec change is required: no add-collections requirement depends on Pagination.
  **APPLIED (coordinator, 2026-10-14)**: dropped from add-collections' proposal,
  accessibility.md §4.2 and the collections.md table.

No add-theme-system request: the `toggle item` row covers the controls.

## Risks / Trade-offs

- [Focusable unavailable triggers add Tab stops that do nothing] → they announce
  "unavailable"; consumers who prefer skipping them set `focusableWhenDisabled={false}`.
- [Constant slot count shows more pages than `siblingCount` suggests near the ends] →
  specified and documented with the three example ranges (zag#1889).
- [Link mode depends on add-link's activation signal] → request 1; until it lands, link
  activations would not report `onPageChange` for client routing.

## Open Questions

- Opt-in arrow-key navigation by hosting the controls in add-toolbar's `composite-host`
  (Bits UI's behaviour)? Not in this change.
