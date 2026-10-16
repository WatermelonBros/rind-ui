## ADDED Requirements

### Requirement: Anatomy

Pagination SHALL consist of the parts `Root` (default element `nav`), `List` (`ul`),
`Item` (`li`), `Page` (a page control), `Ellipsis`, and the triggers `First`, `Previous`,
`Next` and `Last` (each optional). `Page`, `Ellipsis` and the triggers SHALL be rendered
inside an `Item`. `Root` SHALL give its `render` function the state `page`, `pageSize`,
`totalPages`, `pages` (the visible range) and `range`. Every part SHALL accept `render`.

#### Scenario: Minimal structure

- **WHEN** a pagination with 10 pages renders its visible range with `Previous` and
  `Next`
- **THEN** the DOM is a `nav` containing one `ul` whose `li` children hold the
  controls, and axe reports no list or landmark violation

### Requirement: Landmark And Naming

`Root` SHALL be a navigation landmark with an accessible name: the consumer's
`aria-label` or `aria-labelledby` when given, otherwise `messages.label` ("Pagination").
In development, two pagination roots in one document with the same accessible name
SHALL log a warning.

#### Scenario: Default name

- **WHEN** a pagination renders without labelling props
- **THEN** it is exposed as role `navigation` named "Pagination"

#### Scenario: Two paginations around a table

- **WHEN** a table has a pagination above and one below, both unnamed
- **THEN** a development warning names the duplicate landmark name

### Requirement: Total Pages

Pagination SHALL take either `totalPages`, or `count` (number of items) together with
`pageSize`; passing both forms SHALL be a compile error. With `count`, the total SHALL be
`ceil(count / pageSize)`. The total SHALL never be less than 1: zero items yield one
page, on which every trigger is unavailable. Non-integer or negative inputs SHALL be
treated as their floor clamped to 0 and SHALL log a development warning.

#### Scenario: Empty data (zag#2921, bits-ui#894)

- **WHEN** a pagination renders with `count: 0` and `pageSize: 10`
- **THEN** it shows one page, page 1 is current, and First, Previous, Next and Last are
  unavailable

#### Scenario: Count versus pages (reka-ui#1043)

- **WHEN** a pagination renders with `count: 100` and `pageSize: 10`
- **THEN** `totalPages` is 10

### Requirement: Page Value

`Root` SHALL expose the current page as a controllable value: `page`, `defaultPage`
(default 1) and `onPageChange(page, details)`, with `details.reason` naming the event
(`SET_PAGE`, `PREV`, `NEXT`, `FIRST`, `LAST`, `SET_PAGE_SIZE` or `COUNT.CHANGE`) and the
event's modality. The resolved page SHALL always lie in `1..totalPages`. Activating the
current page SHALL NOT call `onPageChange`. When the total shrinks below the current page,
the page SHALL be clamped to the new last page and the change SHALL be reported with
reason `COUNT.CHANGE` (a proposal when controlled). `onPageChange` SHALL receive the new
page as its argument. A controlled `page` without `onPageChange` SHALL log a development warning.

#### Scenario: Callback sees the new page (bits-ui#646)

- **WHEN** an uncontrolled pagination on page 1 receives Next and the `onPageChange`
  handler reads its argument, then the root state after the callback
- **THEN** the handler receives 2, and the state's `page` is 2 once the callback has
  returned (as every controllable: the callback runs before the commit so `cancel()` works;
  amended 2026-10-16, coordinator)

#### Scenario: Last row deleted (kobaltedev/kobalte#461)

- **WHEN** a pagination on page 3 of 3 receives a `count` that makes the total 2
- **THEN** page 2 is current, nothing throws, and `onPageChange(2)` is called with
  reason `COUNT.CHANGE`

#### Scenario: Controlled refusal

- **WHEN** a controlled pagination's Next is activated and the parent keeps `page`
- **THEN** the current page does not change

### Requirement: Page Size

`Root` SHALL expose `pageSize`, `defaultPageSize` (default 10) and
`onPageSizeChange(pageSize, details)`, used only with `count`. Changing the page size
SHALL keep the first item of the current page visible: the new page SHALL be
`floor((page - 1) × oldSize / newSize) + 1`, reported through `onPageChange` with reason
`SET_PAGE_SIZE`. `range` SHALL be the 1-based inclusive item indices of the current page
(`{ start: 0, end: 0 }` when `count` is 0). A controlled `pageSize` without
`onPageSizeChange` SHALL log a development warning.

#### Scenario: Keep the reader's place

- **WHEN** a pagination with `count: 95` on page 3 of size 10 (items 21–30) changes to
  size 25
- **THEN** page 1 (items 1–25) is current, because it contains item 21

#### Scenario: Range is one-based (bits-ui#1346)

- **WHEN** a pagination with `count: 95` and `pageSize: 10` is on page 1, then on page 10
- **THEN** `range` is `{ start: 1, end: 10 }`, then `{ start: 91, end: 95 }`

#### Scenario: Controlled page size without handler (ark#3724)

- **WHEN** `pageSize` is passed without `onPageSizeChange`
- **THEN** a development warning explains that the value is controlled

### Requirement: Visible Range

The visible range SHALL be computed by the exported pure function
`paginationRange({ page, totalPages, siblingCount, boundaryCount })` (defaults 1 and 1)
and SHALL satisfy, for every input:

- every page entry lies in `1..totalPages`, entries are unique and ascending;
- the first `boundaryCount` and last `boundaryCount` pages, the current page and up to
  `siblingCount` pages on each side of it are present;
- every gap between consecutive page entries is one `ellipsis` entry, and an ellipsis
  SHALL NOT stand for exactly one page (that page is shown instead);
- the number of entries is `min(totalPages, 2 × siblingCount + 2 × boundaryCount + 3)`
  whatever the current page, so controls do not shift position as the page changes.

Each entry SHALL carry a stable key (`page-<n>`, `ellipsis-start`, `ellipsis-end`).

#### Scenario: No single hidden page (zag#2885, reka-ui#970)

- **WHEN** `totalPages` is 5 and page 1 is current
- **THEN** the range is 1, 2, 3, 4, 5 with no ellipsis

#### Scenario: Middle page

- **WHEN** `totalPages` is 20 and page 10 is current
- **THEN** the range is 1, ellipsis, 9, 10, 11, ellipsis, 20

#### Scenario: Constant slots near the ends (zag#1889, zag#2313)

- **WHEN** `totalPages` is 20 and page 1, then page 20, is current
- **THEN** the ranges are 1, 2, 3, 4, 5, ellipsis, 20 and 1, ellipsis, 16, 17, 18, 19,
  20 — seven entries each, like the middle page

#### Scenario: Never page 0 (kobaltedev/kobalte#603, reka-ui#595)

- **WHEN** the range is computed for every `totalPages` 1–60, every page, `siblingCount`
  0–3 and `boundaryCount` 0–2
- **THEN** every result satisfies the invariants above

### Requirement: Page Controls

A `Page` SHALL take a `value` (page number). The `Page` whose value is the current page
SHALL carry `aria-current="page"` and `data-current`, whether it is a button or a link;
no other element in the pagination SHALL carry `aria-current`. Its accessible name SHALL
be the consumer's label when given, otherwise `messages.page(value)` ("Page 3"), which
contains the visible number. The current page SHALL stay enabled and focusable;
activating it SHALL do nothing. Activating another page SHALL send `SET_PAGE`.

#### Scenario: Current page on a button (react-spectrum#6159)

- **WHEN** page 4 is current and pages render as buttons
- **THEN** the button "Page 4" has `aria-current="page"` and is not disabled

#### Scenario: Typed names (bits-ui#853)

- **WHEN** page 7 renders with default messages
- **THEN** its accessible name is "Page 7"

### Requirement: Boundary Triggers

`First` and `Previous` SHALL be unavailable on page 1, and `Next` and `Last` on the last
page; all four SHALL be unavailable when there is one page. Activating `Previous` or
`Next` SHALL move by one page, `First` and `Last` to the ends. An unavailable trigger
SHALL follow the Disabled requirement.

#### Scenario: Next on the last page (bits-ui#911)

- **WHEN** a pagination of 5 pages is on page 5
- **THEN** Next and Last are unavailable and Previous and First are available

### Requirement: Buttons And Links

Without `getPageHref`, page controls and triggers SHALL be button-like elements
(add-button `button-like-element`). With `getPageHref(page, pageSize)`, their default
element SHALL be `<a>` with that `href`, built with add-link's `linkProps`
(`link-navigation`), and `render` MAY substitute a router's link component. A primary,
same-tab activation of a link SHALL also send `SET_PAGE` (so `onPageChange` fires); an
activation that `link-navigation` leaves to the browser (⌘, Ctrl, Shift or Alt click,
middle click, `target` other than `_self`, `download`) SHALL NOT change the page.
Unavailable triggers rendered as links SHALL have no `href`.

#### Scenario: Link mode renders links (ark#4056, ark#3475)

- **WHEN** a pagination renders with `getPageHref={(p) => "/posts?page=" + p}`
- **THEN** every page control and available trigger is an `<a>` with the matching
  `href`, and none is a `<button>`

#### Scenario: Boundary links do not navigate (zag#3399)

- **WHEN** a link-mode pagination is on page 1
- **THEN** First and Previous have no `href`, have role `link` and
  `aria-disabled="true"`

#### Scenario: Open a page in a new tab

- **WHEN** the user ⌘-clicks (Ctrl-click elsewhere) the link "Page 3" on page 1
- **THEN** the browser opens page 3 in a new tab, the click is not prevented, and the
  current page stays 1 with no `onPageChange` call

#### Scenario: Client router

- **WHEN** a link-mode pagination is inside a `RouterProvider` and "Page 3" is clicked
- **THEN** the router's `navigate` is called once with the page-3 URL and
  `onPageChange(3)` is called

### Requirement: Disabled

An unavailable trigger, and every control while `Root` has `disabled`, SHALL carry
`aria-disabled="true"` and `data-disabled`, SHALL ignore every activation (pointer, touch,
Enter, Space, bare `click`) and SHALL stay focusable, unless the consumer sets
`focusableWhenDisabled={false}`, in which case buttons use native `disabled` and links
are removed from the tab order. Links SHALL have no `href` while disabled.

#### Scenario: Holding Next to the end

- **WHEN** focus is on Next and the user presses Enter repeatedly until the last page
- **THEN** after the last page is reached focus is still on Next, which carries
  `aria-disabled="true"`, and further Enter presses change nothing

#### Scenario: Disabled while loading (zag#626)

- **WHEN** `Root` has `disabled` and the user clicks a page or hovers it
- **THEN** the page does not change, and every control has `data-disabled` so the theme
  shows no hover state

### Requirement: Keyboard Interactions

Pagination SHALL NOT be a composite: every available control and every unavailable
control kept focusable SHALL be its own Tab stop in DOM order, and the component SHALL
NOT handle arrow keys, Home or End. Buttons SHALL activate on Enter and Space, links on
Enter (Space keeps the browser's default), following press interactions.

| Key | Action |
|---|---|
| Tab / Shift+Tab | Next / previous control |
| Enter | Activate the focused page, trigger or link |
| Space | Activate the focused button |

#### Scenario: Arrow keys are the page's

- **WHEN** focus is on "Page 2" and the user presses ArrowRight
- **THEN** focus does not move and the page does not change

#### Scenario: Enter on a link

- **WHEN** focus is on the link "Page 3" and the user presses Enter
- **THEN** the link is followed once

### Requirement: Focus

After any activation through the pagination, focus SHALL stay on the activated control,
which SHALL still be rendered (pages are keyed by number and the activated page is in
the new range). Focus SHALL never move to `<body>` because of a page change.

#### Scenario: Activating a page near the end

- **WHEN** page 1 of 20 is current, the user tabs to "Page 5" and presses Enter
- **THEN** page 5 is current and "Page 5" is focused

### Requirement: Announcements

Pagination SHALL NOT render a live region and SHALL NOT call the Announcer; the result of
a page change is announced or focused by the application.

#### Scenario: No live region

- **WHEN** the page changes
- **THEN** no element with `aria-live` or a live-region role is rendered by the
  pagination and the Announcer log is empty

### Requirement: Messages

Every string exposed to assistive technology SHALL come from the pagination's
`messages`: `label` ("Pagination"), `page(n)` ("Page n"), `first` ("First page"),
`previous` ("Previous page"), `next` ("Next page"), `last` ("Last page"). A trigger SHALL
use its message as its accessible name only when it has no text content or label of its
own.

#### Scenario: Icon-only trigger in Italian

- **WHEN** an icon-only `Next` renders with `messages={{ next: "Pagina successiva" }}`
- **THEN** its accessible name is "Pagina successiva"

#### Scenario: Trigger with its own text

- **WHEN** `Previous` renders the text "Older posts"
- **THEN** its accessible name is "Older posts"

### Requirement: Data Attributes

Parts SHALL expose:

| Part | Attributes |
|---|---|
| `Root` | `data-disabled` |
| `List` | — (scope, part, instance only) |
| `Item` | `data-type` (`page`, `ellipsis` or `trigger`) |
| `Page` | `data-value`, `data-current`, `data-disabled`, shared button/link attributes (`data-focus`, `data-focus-visible`, `data-hover`, `data-pressed`) |
| `Ellipsis` | `data-position` (`start` or `end`); its content is `aria-hidden="true"`, it has no role and is never focusable |
| `First`, `Previous`, `Next`, `Last` | `data-direction` (`first`, `previous`, `next`, `last`), `data-disabled`, shared button/link attributes |

`data-current` SHALL be present exactly when `aria-current="page"` is, and `data-disabled`
exactly when the control is unavailable or disabled.

#### Scenario: Attributes agree with ARIA

- **WHEN** a pagination of 3 pages is on page 3
- **THEN** "Page 3" has `data-current` and `aria-current="page"`, and Next has
  `data-disabled` and `aria-disabled="true"`

### Requirement: Pagination Contract

Pagination SHALL ship a contract with scope `pagination`, anatomy `root`, `list`, `item`,
`page`, `ellipsis`, `first`, `previous`, `next`, `last`, located by role `navigation` and
exact accessible name. It SHALL declare:

- actions `goTo(page)`, `next()`, `previous()`, `first()`, `last()`, each with a pointer
  implementation (click the control) and a keyboard implementation (Tab to the control,
  Enter), and a postcondition on `currentPage()`;
- queries `currentPage()` (the value of the control with `aria-current="page"`),
  `visiblePages()` (numbers and `"ellipsis"` in order), `isDisabled(control)`,
  `href(page)` (or `null` for buttons) and `focused()`;
- events mapped to actions (`SET_PAGE` → `goTo`, `NEXT` → `next`, …) and prop steps
  `$sync:page`, `$props:pageSize`, `$props:count` and `$props:disabled`;
- per-contract invariants: exactly one element with `aria-current="page"` and it is the
  oracle page; `visiblePages()` equals `paginationRange` for the oracle; no ellipsis is
  focusable; an unavailable link has no `href`.

#### Scenario: Driver in both environments

- **WHEN** a test runs `const p = getPagination(screen, { name: "Pagination" })`, then
  `await p.next()` and `await p.currentPage()`, and the same test runs with a Playwright
  `page`
- **THEN** both resolve 2

#### Scenario: Consumer wrapper drops aria-current

- **WHEN** a consumer runs `testMachine` with the pagination contract on a wrapper that
  removes `aria-current` from page buttons
- **THEN** the current-page invariant fails naming the `page` part

### Requirement: Model-Based Coverage

`testMachine` over the pagination contract SHALL cover every event in the pointer,
keyboard and virtual modalities, with argument classes: 1 page, 5 pages, 20 pages;
current page first, middle and last; buttons and links; `disabled`; and
`focusableWhenDisabled` true and false, and SHALL pass every generic and accessibility
invariant plus the focus-never-on-body rule after each step.

#### Scenario: Virtual activation

- **WHEN** Next is activated by a bare `click` with `detail: 0`
- **THEN** the page advances exactly once
