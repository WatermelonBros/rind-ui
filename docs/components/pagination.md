# Pagination

Navigation between the pages of a long list: a `nav` landmark with the page controls, Previous and Next, and optionally First and Last. The controls are buttons, or links when each page has a URL.

## When to use

- **Use it for** moving between the pages of a long list or table, with Previous, Next and optionally First and Last.
- **Over a row of plain buttons**: it adds a `nav` landmark, a range of page controls whose size never changes, `aria-current="page"` on the current page, unavailable controls that keep focus, and real links when each page has a URL (`getPageHref`).
- **Don't use it for** switching between views of the same page: use [Tabs](tabs.md). A "load more" button needs no component, only a `<button>`.

```tsx
import { Pagination } from "@rind-ui/react"

<Pagination.Root totalPages={20} onPageChange={(page) => load(page)}>
  {(state) => (
    <Pagination.List>
      <Pagination.Item type="trigger">
        <Pagination.Previous />
      </Pagination.Item>
      {state.pages.map((e) =>
        e.type === "page" ? (
          <Pagination.Item key={e.key}>
            <Pagination.Page value={e.value} />
          </Pagination.Item>
        ) : (
          <Pagination.Item key={e.key} type="ellipsis">
            <Pagination.Ellipsis position={e.position} />
          </Pagination.Item>
        ),
      )}
      <Pagination.Item type="trigger">
        <Pagination.Next />
      </Pagination.Item>
    </Pagination.List>
  )}
</Pagination.Root>
```

## API

<!-- api:pagination -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Pagination.Root` | `root` | `<nav>` | A navigation landmark named "Pagination" unless you pass `aria-label`/`aria-labelledby`; owns the page and the page size. |
| `Pagination.List` | `list` | `<ul>` | The list of controls. |
| `Pagination.Item` | `item` | `<li>` | Holds one page, ellipsis or trigger. |
| `Pagination.Page` | `page` | `<button>` | A page control (`<a>` with `getPageHref`); the current one has `aria-current="page"` and stays enabled. |
| `Pagination.Ellipsis` | `ellipsis` | `<span>` | Stands for two or more hidden pages; `aria-hidden`, no role, never focusable. |
| `Pagination.First / Previous / Next / Last` | `first \| previous \| next \| last` | `<button>` | Triggers; unavailable at the ends (`aria-disabled`, still focusable), named from messages when icon-only. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `totalPages` | `number` | — | The number of pages (at least 1). Or pass `count` and `pageSize`. |
| `count` | `number` | — | The number of items; the total is `ceil(count / pageSize)`. |
| `page` | `number` | — | Controlled current page (1-based). |
| `defaultPage` | `number` | `1` | Uncontrolled initial page. |
| `onPageChange` | `(page, { reason, cancel }) => void` | — | Every change, once; `reason` is SET_PAGE, PREV, NEXT, FIRST, LAST, SET_PAGE_SIZE or COUNT.CHANGE. |
| `pageSize` | `number` | — | Controlled page size (with `count` only). |
| `defaultPageSize` | `number` | `10` | Uncontrolled page size. |
| `onPageSizeChange` | `(pageSize, details) => void` | — | Page size changes; the page moves so its first item stays visible. |
| `siblingCount` | `number` | `1` | Pages shown beside the current one. |
| `boundaryCount` | `number` | `1` | Pages always shown at each end. |
| `getPageHref` | `(page, pageSize) => string` | — | Renders links instead of buttons; same-tab activations also change the page. |
| `disabled` | `boolean` | `false` | Every control ignores activation and shows no hover (disable while loading). |
| `focusableWhenDisabled` | `boolean` | `true` | Unavailable controls keep focus (`aria-disabled`); `false` uses native disabled. |
| `messages` | `Partial<PaginationMessages>` | — | `label`, `page(n)`, `first`, `previous`, `next`, `last`. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | On every part; Root's state is `page`, `pageSize`, `totalPages`, `pages`, `range`. |
| `children` | `ReactNode \| ((state: PaginationRootState) => ReactNode)` | — | The parts, or a function of the state (to map `pages`). |
| `type` | `"page" \| "ellipsis" \| "trigger"` | — | What the item holds (`data-type`). Default `"page"`. |
| `value` | `number` | — | The page number it goes to; `aria-current="page"` when it is the current page. |
| `pending` | `boolean` | — | Ignores activation, keeps focus, announces `messages.pending` when focused. |
| `focusOnPress` | `boolean` | — | `false`: a press activates without moving focus (press-interactions "Press Without Focus": an editor toolbar's Bold keeps the editor focused). |
| `onPressStart` | `(details: ButtonPressDetails) => void` | — | A press starts. |
| `onPressEnd` | `(details: ButtonPressDetails) => void` | — | A press ends, also when cancelled or released outside. |
| `position` | `"start" \| "end"` | — | Which gap it stands for, before or after the current page (`data-position`). Default: "end". |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "pagination" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-disabled` | Present while the pagination is disabled. |
| `list` | `data-scope` | "pagination" |
| `list` | `data-part` | "list" |
| `list` | `data-instance` | The instance id. |
| `item` | `data-scope` | "pagination" |
| `item` | `data-part` | "item" |
| `item` | `data-instance` | The instance id. |
| `item` | `data-type` | "page", "ellipsis" or "trigger". |
| `page` | `data-scope` | "pagination" |
| `page` | `data-part` | "page" |
| `page` | `data-instance` | The instance id. |
| `page` | `data-value` | The page number. |
| `page` | `data-current` | Present on the current page (with `aria-current="page"`). |
| `page` | `data-disabled` | Present when the control is unavailable or the pagination is disabled. |
| `page` | `data-focus` | Present while focused. |
| `page` | `data-focus-visible` | Present while focused by keyboard or assistive technology. |
| `page` | `data-hover` | Present while hovered by a mouse or pen. |
| `page` | `data-pressed` | Present while pressed. |
| `ellipsis` | `data-scope` | "pagination" |
| `ellipsis` | `data-part` | "ellipsis" |
| `ellipsis` | `data-instance` | The instance id. |
| `ellipsis` | `data-position` | "start" or "end". |
| `next` | `data-scope` | "pagination" |
| `next` | `data-part` | "next" |
| `next` | `data-instance` | The instance id. |
| `next` | `data-direction` | "first", "previous", "next" or "last" (part named the same). |
| `next` | `data-disabled` | Present when the control is unavailable or the pagination is disabled. |
| `next` | `data-focus` | Present while focused. |
| `next` | `data-focus-visible` | Present while focused by keyboard or assistive technology. |
| `next` | `data-hover` | Present while hovered by a mouse or pen. |
| `next` | `data-pressed` | Present while pressed. |

### Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | Next / previous control (not a composite: no arrow keys). |
| Enter | Activates the focused page, trigger or link. |
| Space | Activates the focused button. |

### States

| State | Description |
|---|---|
| `idle` | The only state: page changes are guarded self-loops. |

### Contract

| Action | Modalities |
|---|---|
| `goTo` | pointer, keyboard, virtual |
| `next` | pointer, keyboard, virtual |
| `previous` | pointer, keyboard, virtual |
| `first` | pointer, keyboard, virtual |
| `last` | pointer, keyboard, virtual |

Queries: `currentPage`, `visiblePages`, `isDisabled`, `href`, `isFocused`. Traits: none.
<!-- /api -->

## The visible range

`state.pages` (and the exported `paginationRange`) always has the same number of entries, `2 × siblingCount + 2 × boundaryCount + 3` (seven by default), or every page when there are fewer. The controls therefore never shift as the page changes, and an ellipsis always stands for at least two pages: a single hidden page is shown instead.

| Total | Current | Range |
|---|---|---|
| 5 | 1 | 1 2 3 4 5 |
| 20 | 1 | 1 2 3 4 5 … 20 |
| 20 | 10 | 1 … 9 10 11 … 20 |
| 20 | 20 | 1 … 16 17 18 19 20 |

Entries carry stable keys (`page-3`, `ellipsis-start`, `ellipsis-end`), so the control you activated is the same element after the change and keeps focus.

## Total pages

Pass `totalPages`, or `count` (the number of items) with `pageSize`; passing both is a type error. Zero items is one page, on which every trigger is unavailable. When the total shrinks below the current page (the last row was deleted), the page moves to the new last page and `onPageChange` reports reason `COUNT.CHANGE`.

With `count`, `state.range` is the 1-based item range of the current page (`{ start: 21, end: 30 }`), ready for "Items 21–30 of 95".

## Buttons or links

Without `getPageHref` the controls are buttons. With `getPageHref(page, pageSize)` they are links, so a page can be opened in a new tab, bookmarked or shared: a same-tab activation also calls `onPageChange`, while ⌘/Ctrl-click, middle click and the other gestures the browser handles leave the current page as it is. Inside a `RouterProvider` a link navigates with your router; `render` can substitute your router's link component. Unavailable triggers rendered as links have no `href`.

## Unavailable controls keep focus

Previous and First are unavailable on page 1, Next and Last on the last page, and every control while `disabled` (disable the pagination while the next page loads). They carry `aria-disabled="true"` and `data-disabled`, ignore every activation and **stay focusable**: holding Enter on Next walks to the last page and leaves focus on Next, instead of dropping it on the page. Set `focusableWhenDisabled={false}` to use native `disabled` instead.

## Keyboard

Every control is its own Tab stop; Pagination is not a composite and leaves the arrow keys to the page. Enter activates a page, a trigger or a link; Space activates a button.

## Names

The landmark is named "Pagination" unless you pass `aria-label` or `aria-labelledby`. Give each pagination its own name when there are two on a page (above and below a table): a development warning flags duplicates. Pages are named "Page 3", which contains the visible number. An icon-only trigger takes its name from `messages` ("Next page"); a trigger with its own text ("Older posts") keeps it. Translate the names with `messages` or the provider.

## After a page change

`onPageChange` receives the new page as its argument and runs before the change is committed, as every rind-ui change callback does, so `cancel()` can veto it: read the page from the argument, not from the Root's state, which shows the new page once the callback has returned.

Pagination announces nothing and never moves focus itself. Move focus to the results heading or announce the new range from your `onPageChange`, the way that fits your page.

## Page size

A page-size control calls `state.setPageSize(n)` (uncontrolled) or changes the controlled `pageSize`. Either way the page moves so the first item you were looking at stays visible: page 3 of size 10 (items 21–30) becomes page 1 of size 25 (items 1–25).

## Coming from another Pagination component

- The total is `totalPages` or `count` + `pageSize`; pages are 1-based.
- The current page is never disabled: it carries `aria-current="page"` and activating it does nothing.
- Links come from `getPageHref`, not from wrapping each control in your own link.
- `onPageChange` receives the new page and a `reason`.

## Styling

Style it through the data attributes above, or import `@rind-ui/theme/pagination.css` (family `toggle item`). The current page has a fill and an edge in the strong border colour, never colour alone; forced colors outline it with `Highlight`. Unavailable controls show no hover, every control is at least 24 by 24 px and the default chevrons mirror in right-to-left.

## Testing

```tsx
import { getPagination } from "@rind-ui/testing"

const pages = getPagination(screen, { name: "Pagination" })
await pages.next()
await pages.currentPage() // 2
await pages.via("keyboard").goTo(5)
await pages.visiblePages() // [1, "ellipsis", 4, 5, 6, "ellipsis", 20]
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:pagination -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
