# Pagination — research

Status: done · Wave: 2

Sources read 2026-10-14 in the local clones (paths relative to each repo). Cross-cutting
rules come from [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) and
[native-platform.md](native-platform.md); links and client routing come from
[link.md](link.md) / `add-link` (`link-navigation`), buttons from `add-button`
(`button-like-element`).

## Pattern

- WAI-ARIA APG pattern: **none**. Pagination is a [navigation
  landmark](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/) holding
  [links](https://www.w3.org/WAI/ARIA/apg/patterns/link/) (page URLs) or
  [buttons](https://www.w3.org/WAI/ARIA/apg/patterns/button/) (in-page state). Base UI
  declines to ship it for that reason ("it's not an ARIA pattern. It's really just Base
  UI Toolbar", [BU#29](https://github.com/mui/base-ui/issues/29)); React Aria never
  shipped its `usePagination` ([RA#1748](https://github.com/adobe/react-spectrum/issues/1748),
  closed as inactive). Design systems that document it (GOV.UK, USWDS) use a `nav` with
  a label, a list, `aria-current="page"` on the current page, and plain Tab order.
- Roles and attributes required: `nav` (implicit `navigation`) with an accessible name
  (a page often has several navigation landmarks); a list of items; the current page
  marked `aria-current="page"`; controls that have names ("Page 3", "Next page");
  unavailable controls marked `aria-disabled` (links cannot be `disabled`).
- Keyboard: none specific. Tab / Shift+Tab move between controls, Enter activates a
  link, Enter or Space a button.

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/pagination/src/{pagination.machine,pagination.connect,pagination.utils,pagination.anatomy}.ts`;
  `ark/packages/react/src/components/pagination/*.tsx`.
- API: Root (`nav`), Item, Ellipsis, FirstTrigger, PrevTrigger, NextTrigger,
  LastTrigger; props `count` (items), `pageSize`/`defaultPageSize` (10), `page`/`defaultPage`,
  `siblingCount` (1), `boundaryCount` (1), `type: "button" | "link"`, `getPageUrl`,
  `translations`. API helpers `pages`, `pageRange`, `slice(data)`, `setPageSize`.
- State: one `idle` state; `page` and `pageSize` bindables; `totalPages = ceil(count /
  pageSize)` computed; a watch resets `page` to 1 when a page-size change makes it
  invalid.
- Notable: the range algorithm (`getRange`) keeps a **constant number of slots**
  (`min(2·siblings + 3 + 2·boundary, totalPages)`) and replaces an ellipsis that would
  hide exactly one page by that page (added after [ZG#2885](https://github.com/chakra-ui/zag/issues/2885)).
  Item names from translations, with "last page, page N" for the last. Boundary link
  triggers lose `href` and get `role="link"` + `aria-disabled` ([ZG#3399](https://github.com/chakra-ui/zag/issues/3399)).
- Problems: `type: "link"` changes attributes, not elements, so parts render
  `<button href>` ([ARK#4056](https://github.com/chakra-ui/ark/issues/4056),
  [ARK#3475](https://github.com/chakra-ui/ark/issues/3475)); `onClick` sets the page on
  every click including ⌘-click on a link (the current tab's state changes while the
  page opens in a new tab); boundary buttons use native `disabled`, so the focused Next
  button drops focus to `<body>` on the last page; the root label is the lowercase
  "pagination"; `count: 0` gives `totalPages = 0` ([ZG#2921](https://github.com/chakra-ui/zag/issues/2921)).

### Reka UI

- Source: `reka-ui/packages/core/src/Pagination/{PaginationRoot,PaginationList,PaginationListItem,PaginationNext,PaginationEllipsis}.vue`, `utils.ts`.
- API: Root (`nav`), List, ListItem (button), Ellipsis, First/Prev/Next/Last; props
  `total`, `itemsPerPage` (required since [RK#1043](https://github.com/unovue/reka-ui/issues/1043)),
  `siblingCount` (2), `showEdges` (false), `disabled`.
- State: `page` via `useVModel`; `pageCount = max(1, ceil(total / itemsPerPage))`.
- Notable: `pageCount` never drops below 1. Without `showEdges` the range is a fixed
  sliding window of `2·siblings + 1` with no ellipsis.
- Problems: hard-coded English names (`aria-label="Page N"`, "Next Page"); no
  `aria-label` on the root nav; native `disabled`; the "edges" algorithm needed two fixes
  ([RK#595](https://github.com/unovue/reka-ui/issues/595), [RK#970](https://github.com/unovue/reka-ui/issues/970)).

### Bits UI

- Source: `bits-ui/packages/bits-ui/src/lib/bits/pagination/pagination.svelte.ts`, `components/*.svelte`.
- API: Root (a `div`), Page, PrevButton, NextButton; `count`, `perPage`, `siblingCount`,
  `loop`, `orientation`; snippet props `pages`, `range`, `currentPage`.
- Notable: **arrow keys** move focus between page buttons (Left/Right, Home/End, RTL
  aware, optional `loop`) while every control stays in the Tab order.
- Problems: root is not a `nav`; the current page has only `data-selected`, no
  `aria-current`; `Page N` label hard-coded (it rendered `[object Object]`,
  [BITS#853](https://github.com/huntabyte/bits-ui/issues/853)); ellipsis keys from
  `useId()` inside a derived computation; Enter/Space handled in `keydown` with
  `preventDefault` — a link page would no longer navigate.

### Kobalte

- Source: `kobalte/packages/core/src/pagination/{pagination-root,pagination-items,pagination-item,pagination-next}.tsx`.
- API: Root (`nav` wrapping its own `ul`), Items (renders `itemComponent` /
  `ellipsisComponent`), Item, Ellipsis, Previous, Next; `count` (pages), `siblingCount`,
  `showFirst`, `showLast`, `fixedItems: boolean | "no-ellipsis"`, `disabled`.
- Notable: `aria-current="page"` + `data-current`; every item in an `li`; `fixedItems`
  keeps the item count constant so controls do not jump under the pointer.
- Problems: the fixed-items arithmetic produced page 0 and broken ranges
  ([KB#603](https://github.com/kobaltedev/kobalte/issues/603), [KB#461](https://github.com/kobaltedev/kobalte/issues/461)),
  and a `RangeError` when the count shrinks below the current page (comment on KB#461);
  Next is `disabled` + `aria-disabled` + `tabIndex=-1` (redundant, and drops focus).

### Not shipped

Radix (requests [RX#886](https://github.com/radix-ui/primitives/issues/886),
[RX#1856](https://github.com/radix-ui/primitives/issues/1856)), Base UI (BU#29), React
Aria (RA#1748; RA#6159 shows a team building one from `Button` + `aria-current`),
Headless UI and Ariakit (no issues found) do not ship Pagination.

## Range algorithms compared

| Library | Inputs | Constant slot count | Ellipsis hiding 1 page | Edge cases |
|---|---|---|---|---|
| Zag/Ark | `siblingCount` 1, `boundaryCount` 1 | yes: `min(2s+2b+3, total)` | replaced by the page (since ZG#2885) | `total 0 → []` |
| Reka | `siblingCount` 2, `showEdges` | edges on: yes; off: sliding window | fixed in RK#970 | `pageCount ≥ 1` |
| Bits (melt) | `siblingCount` 1 | yes (first, last, 3+s window) | no rule; can hide one | `count 0` gave page 0 (BITS#894) |
| Kobalte | `siblingCount`, `showFirst/Last`, `fixedItems` | only with `fixedItems` | only with `fixedItems === true` | page 0 (KB#603) |

`siblingCount` is misread in every tracker as "items shown on each side, always"
([ZG#1889](https://github.com/chakra-ui/zag/issues/1889), [ZG#2313](https://github.com/chakra-ui/zag/issues/2313));
Zag's answer is that siblings apply in "ellipsis mode", and slots are filled to keep the
count constant near the ends. That is the behaviour worth keeping; it needs to be
specified as properties, not as code.

## Accessibility

- **Landmark and name.** Root is a `nav` named by `messages.label` ("Pagination") unless
  the consumer passes `aria-label`/`aria-labelledby` (several pagination navs on a page —
  top and bottom of a table — need distinct names; dev warning when two share one).
- **List.** `ul` + `li` lets SRs say "list, 9 items" and keeps the structure axe-valid;
  Kobalte and GOV.UK do this. The ellipsis is an `li` whose glyph is `aria-hidden`; the
  gap is conveyed by the page names themselves ("Page 1", "Page 4"). A "…" read as "dot dot
  dot" adds nothing.
- **Current page.** `aria-current="page"` on the current page control, whether link or
  button (valid on any element; RA#6159 shows libraries that drop it on buttons). Bits
  exposes no current state at all. The current control stays enabled and focusable;
  activating it does nothing.
- **Names.** Page controls: `messages.page(n)` = "Page 3" (2.5.3: contains the visible
  "3"). Triggers: `messages.first/previous/next/last` only when the trigger has no text
  of its own (same rule as add-popover's close trigger), so "Older posts" keeps its name.
  Names are typed functions of numbers, so BITS#853 cannot recur.
- **Unavailable triggers.** At the first/last page Previous/First and Next/Last are
  unavailable. Native `disabled` on the focused Next button moves focus to `<body>` when
  the user reaches the last page (a WCAG 2.4.3 failure every native-`disabled`
  implementation has); ZG#626 asked for the opposite (skip disabled triggers in Tab).
  Decision: **`aria-disabled` and stay focusable by default** (`focusableWhenDisabled`
  default `true` for pagination controls), which keeps focus where the user is and still
  announces "dimmed/unavailable". Links lose `href` (ZG#3399).
- **Keyboard.** Plain Tab order; no roving tabindex and no arrow keys. accessibility.md
  §4.2 and collections.md list Pagination among roving composites; we deviate: a
  navigation landmark of links is expected to be tabbable link by link (links lists,
  browse mode and Tab all agree), a composite would need a widget role (`toolbar`)
  that cannot also be the `nav` landmark, and none of the shipping libraries with
  links use roving focus (Bits keeps all controls tabbable and adds arrows). Recorded as
  a request against the cross-cutting notes.
- **Focus after a change.** Pages are keyed by number and the activated page is always
  in the new range (it becomes current), so focus stays on the activated control; the
  triggers keep focus because they stay focusable.
- **Announcements.** None from the component (rule 23: components own no live region).
  The result of a page change is content; the docs show focusing the results heading or
  announcing "Page 3 of 10" through the app's Announcer.
- **Native platform.** Nothing applies beyond `<nav>`, `<a href>` and `<button>`.
- **Forced colors / target size.** The current page must differ by more than colour
  (border or `Highlight` outline in the theme); controls ≥ 24×24 CSS px (2.5.8).
- **RTL.** DOM order is logical; flex reverses visually under `dir="rtl"`; the theme
  mirrors chevrons.

## Bug history

Searched 2026-10-14: `pagination` in chakra-ui/zag (12 hits), chakra-ui/ark (13),
unovue/reka-ui (6), huntabyte/bits-ui (8), kobaltedev/kobalte (4),
adobe/react-spectrum (23), radix-ui/primitives (7), mui/base-ui (3), ariakit (2),
headlessui (0), plus `getPageUrl`, `perPage`. About 30 were about pagination; all of those
were read.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Ark | [#4056](https://github.com/chakra-ui/ark/issues/4056) | `type: "link"` renders `<button href>` | link mode changes attributes, not the element | closed | The element follows the mode: `getPageHref` makes `<a>` the default element |
| Ark | [#3475](https://github.com/chakra-ui/ark/issues/3475) | link type keeps a button | same; maintainers point to `asChild` | closed (docs) | Same; `render` for router links |
| Zag | [#3399](https://github.com/chakra-ui/zag/issues/3399) | First/Last links keep `href` on their own boundary | boundary only guarded for prev/next | fixed #3409 | Every boundary trigger loses `href` (link-navigation disabled rule) |
| Zag | [#626](https://github.com/chakra-ui/zag/issues/626) | disabled pagination still keyboard reachable, hover styles | link vs button disabled semantics | closed | Deliberate: unavailable stays focusable with `aria-disabled`; `data-disabled` for styling |
| Zag | [#2921](https://github.com/chakra-ui/zag/issues/2921) | Next enabled with `count: 0` | `totalPages = 0` | fixed | `totalPages ≥ 1` |
| Bits | [#894](https://github.com/huntabyte/bits-ui/issues/894) / [#891](https://github.com/huntabyte/bits-ui/issues/891) | empty pagination renders page 0 | `ceil(0/10) = 0` | fixed | Same |
| Kobalte | [#603](https://github.com/kobaltedev/kobalte/issues/603) | page 0 with `showLast={false}` + `fixedItems` | slot arithmetic | closed | Range invariants (1..total, unique, ascending) tested by property |
| Kobalte | [#461](https://github.com/kobaltedev/kobalte/issues/461) | broken items when count < 6; crash when count shrinks | arithmetic + no clamping | closed | Clamp the page when `totalPages` drops; property tests for small totals |
| Zag | [#2885](https://github.com/chakra-ui/zag/issues/2885) | 1,2,3,…,5 instead of 1..5 | ellipsis hides one page | fixed | An ellipsis never hides exactly one page |
| Reka | [#970](https://github.com/unovue/reka-ui/issues/970) | single page hidden behind ellipsis | same | fixed | Same |
| Reka | [#595](https://github.com/unovue/reka-ui/issues/595) | more pages than the total | window larger than total | fixed | Slots ≤ total |
| Zag | [#1889](https://github.com/chakra-ui/zag/issues/1889), [#2313](https://github.com/chakra-ui/zag/issues/2313) | `siblingCount` "not applied" | semantics: constant slots near ends | by design | Specify the semantics and document them with examples |
| Reka | [#1043](https://github.com/unovue/reka-ui/issues/1043) | `total` read as page count | ambiguous inputs, defaulted `itemsPerPage` | `itemsPerPage` required | Accept `totalPages` **or** `count` + `pageSize`, as a discriminated union |
| Ark | [#3724](https://github.com/chakra-ui/ark/issues/3724) | page size select does nothing | `pageSize` passed controlled without handler | docs fixed | Dev warning: controlled `pageSize`/`page` without its change handler |
| Bits | [#646](https://github.com/huntabyte/bits-ui/issues/646) | `onPageChange` sees the old page | callback before the bound value updates | fixed #657 | Callback receives the new page; reading the API inside it gives the new page (uncontrolled) |
| Bits | [#1346](https://github.com/huntabyte/bits-ui/issues/1346) | `range.start` is 0 on page 1 | 0-based start | fixed | `range` is 1-based inclusive; `{0, 0}` when empty |
| Bits | [#853](https://github.com/huntabyte/bits-ui/issues/853) | `aria-label="Page [object Object]"` | label built from the item object | fixed | Typed `messages.page(n: number)` |
| Bits | [#911](https://github.com/huntabyte/bits-ui/issues/911) | Prev/Next not disabled at the ends (regression) | lost in a rewrite | fixed | Contract invariant on boundary state, run by `testMachine` |
| Zag | [#867](https://github.com/chakra-ui/zag/issues/867) | page items do not fire `onChange` (regression) | Solid adapter | fixed | Every activation path is a contract action covered by model tests |
| Zag | [#1007](https://github.com/chakra-ui/zag/issues/1007) | `page` prop captured by styling libraries | style-prop systems | closed | Not applicable (no style props); keep `page` |
| RA | [#6159](https://github.com/adobe/react-spectrum/issues/6159) | `aria-current` dropped from a Button used as page | DOM prop filtering | open PR | Connect owns `aria-current` on page parts, links and buttons alike |
| Ark | [#1355](https://github.com/chakra-ui/ark/issues/1355) | slot props undefined (Vue) | API reshuffle | closed | Root state passed to `render` is typed |
| BU | [#29](https://github.com/mui/base-ui/issues/29) | — (design) | "not an ARIA pattern; it's a Toolbar" | not shipped | Considered; rejected roving focus (see Accessibility) |

## Known pitfalls

- Page 0 / empty data (Zag, Bits, Kobalte): `totalPages` must be ≥ 1.
- Ellipsis that hides one page (Zag, Reka): replace it with the page.
- Link mode that keeps buttons (Ark, twice); boundary links that still navigate (Zag).
- Native `disabled` on a focused trigger drops focus to `<body>` (all except Bits).
- Modifier clicks on page links change the current tab's state (Zag `onClick`).
- Count shrinking below the current page (deleting the last row) crashes or shows an
  empty page (Kobalte).
- Hard-coded English strings (Reka, Bits).

## Testing notes

- The range function is pure: property tests over `totalPages 1..60 × page × siblings
  0..3 × boundary 0..2` assert the range invariants. No DOM needed.
- Driver actions: `goTo(page)`, `next()`, `previous()`, `first()`, `last()`, each with a
  pointer and a keyboard implementation (Tab to the control, Enter); queries
  `currentPage()` (from the `aria-current` control), `visiblePages()`, `isDisabled(control)`,
  `href(page)`.
- Focus: after `next()` to the last page the focused element is still Next.
- Link mode needs a browser to prove ⌘-click opens a new tab and leaves state alone;
  jsdom can only assert the click was not prevented.

## Decisions

- **Parts:** `Root` (`nav`), `List` (`ul`), `Item` (`li`), `Page` (button or link),
  `Ellipsis`, `First`, `Previous`, `Next`, `Last`. No page-size part: the consumer binds
  any Select/Segmented Control to `pageSize`.
- **Inputs:** `totalPages` **or** `count` + `pageSize` (typed union); `page`/`defaultPage`
  (1)/`onPageChange`; `pageSize`/`defaultPageSize` (10)/`onPageSizeChange`;
  `siblingCount` (1); `boundaryCount` (1); `getPageHref(page, pageSize)`; `disabled`;
  `focusableWhenDisabled` (true); `messages`.
- **Machine:** one state `idle`; events `SET_PAGE`, `PREV`, `NEXT`, `FIRST`, `LAST`,
  `SET_PAGE_SIZE`, `COUNT.CHANGE`; controllables `page`, `pageSize`. Page-size change keeps
  the first item of the current page visible; a shrinking total clamps the page and
  proposes it.
- **Range:** Zag's algorithm specified as properties: first `boundaryCount` and last
  `boundaryCount` pages, current ± `siblingCount`, constant slot count
  `min(totalPages, 2s + 2b + 3)`, no ellipsis for a single page, exported as
  `paginationRange()`.
- **`data-*`:** Root `data-disabled`; Page `data-current`, `data-value`; triggers
  `data-disabled`, `data-direction`; all button/link shared attributes.
- **Contract:** `pagination`; locate by role `navigation` + name; actions above; invariant
  "exactly one `aria-current="page"` and it is the oracle page".
- **Different from the others:** focusable unavailable triggers; modifier-click safety;
  `totalPages` floor of 1 with clamping; no arrow-key composite; strings in `messages`.

## Open questions

- Should Pagination offer an opt-in arrow-key mode (Bits) by hosting its controls in
  add-toolbar's `composite-host`? Not now: the nav landmark is the better default, and
  Toolbar cannot be the landmark.
- accessibility.md §4.2 and collections.md list Pagination as a roving composite; this
  note decides plain Tab order. The cross-cutting notes should be corrected by their
  owner.
- A "jump to page" input or jump ellipsis (± 5 pages): consumer composition for now.
