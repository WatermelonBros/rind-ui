## Purpose

Defines the Breadcrumbs component: a navigation landmark holding an ordered trail of links
to the ancestors of the current location, with an explicit current item, decorative
separators, optional collapsing of middle items into a menu, and a contract and driver.

## ADDED Requirements

### Requirement: Anatomy

Breadcrumbs SHALL consist of these parts, each accepting `render`:

- `Root`: `<nav>`, scope `breadcrumbs`;
- `List`: `<ol>`;
- `Item`: `<li>`, an add-collections static item part with a key and `textValue`;
- `Link`: `<a>`, inside an Item;
- `Separator`: `<span>`, inside an Item;
- `Ellipsis`: `<li>`, inside the List.

`Root` MAY contain other controls outside the `List`. Items SHALL be keyed by their
collection key, so a re-rendered trail keeps its DOM nodes. Breadcrumbs SHALL have no
machine: current and collapsed items are derived from props and the collection.

#### Scenario: Extra controls in the landmark

- **WHEN** a Root contains back and forward buttons before the List
- **THEN** the buttons are inside the `navigation` landmark and the list's item count
  includes only the Items and the Ellipsis

#### Scenario: Trail update keeps nodes (react-spectrum#1961)

- **WHEN** the trail changes from `Home / Docs` to `Home / Docs / Link` with stable keys
- **THEN** the `Home` and `Docs` elements are the same DOM nodes as before

### Requirement: Landmark And List Semantics

`Root` SHALL be a `navigation` landmark named by `messages.label` ("Breadcrumbs") unless
the consumer gives `aria-label` or `aria-labelledby`. `List` SHALL be an `<ol>`, and every
`Item` and the `Ellipsis` SHALL be its `<li>` children. No other element SHALL be a direct
child of the list.

#### Scenario: Default name

- **WHEN** Breadcrumbs is rendered with no label props
- **THEN** a `navigation` landmark named "Breadcrumbs" contains a list whose items are the
  crumbs

#### Scenario: Localised name

- **WHEN** a provider sets `messages={{ breadcrumbs: { label: "Percorso" } }}`
- **THEN** the landmark is named "Percorso"

### Requirement: Current Item

An Item SHALL be current when its `current` prop is `true`. When no Item has `current`
set to `true`, the last Item SHALL be current unless its `current` prop is `false`. At most
one Item SHALL be current. The current Item's `Link` SHALL carry `aria-current` with Root's
`currentValue` (`"page"` by default; `"location"`, `"date"`, `"time"` or `true` allowed).
That Link SHALL keep its `href` and stay a link when one is given. Without an `href` it
SHALL render a `<span>` that:

- carries `aria-current` and `tabindex="-1"`;
- has no `role="link"`;
- has no press handling;

so its text stays selectable, readable in swipe navigation and focusable.

#### Scenario: Last item by default

- **WHEN** a trail `Home / Docs / Link` sets no `current`
- **THEN** only `Link` has `aria-current="page"`

#### Scenario: Explicit current (react-spectrum#6561)

- **WHEN** the last Item sets `current={false}` and no other Item sets `current`
- **THEN** no element in the trail has `aria-current`

#### Scenario: Focus is kept when a crumb becomes current (react-spectrum#2592, react-spectrum#5294)

- **WHEN** the user activates the `Docs` crumb, the app navigates client-side, and the
  trail re-renders with `Docs` as the current Item without `href`
- **THEN** focus stays on the `Docs` element, not on `<body>`, and `data-focus-visible`
  follows the real focus

#### Scenario: TalkBack reaches the current item (react-spectrum#3998)

- **WHEN** the current Item has no `href`
- **THEN** it is not a `link`, has `tabindex="-1"`, and its text is exposed

#### Scenario: Current text is selectable (react-spectrum#5549)

- **WHEN** the user drags across the current item's text with a mouse
- **THEN** the text is selected and no `user-select` style is left on the element

### Requirement: Links

`Link` SHALL be built with add-link's `linkProps`, with scope `breadcrumbs` and part
`link`. Routing, modifier clicks, disabled links, `href` resolution and the shared link
data attributes SHALL be those of `link-navigation`. An `Item` with `disabled` SHALL
disable its Link. Item state (`current`, `disabled`) SHALL reach only that Item's own
`Link`, never other links or components rendered inside the Item.

#### Scenario: Client routing

- **WHEN** a `RouterProvider` is present and the user clicks the `Docs` crumb
- **THEN** the router navigates once and ⌘-click opens a new tab instead

#### Scenario: Menu inside the last item (react-spectrum#10571)

- **WHEN** the current Item contains a Menu whose items are links
- **THEN** the menu's links are enabled and navigate

### Requirement: Separators

`Separator` SHALL render inside an `Item`, after its control, with `aria-hidden="true"`.
It SHALL have no role and SHALL NOT be focusable. Its content SHALL be only its children:
there is no default glyph. A Separator SHALL NOT be a direct child of the list. A
Separator in the last visible Item SHALL carry `data-last` so themes can hide it. The
shared `separatorProps` of add-separator SHALL NOT be used: its decorative output exposes
the glyph text to assistive technology.

#### Scenario: Separator not read (APG)

- **WHEN** the trail `Home › Docs` is read with a screen reader
- **THEN** "›" is not spoken and the list has 2 items

#### Scenario: Custom separator (kobaltedev/kobalte#566)

- **WHEN** a Separator is given a chevron icon as children
- **THEN** it renders the chevron and no other glyph

### Requirement: Collapsing Into A Menu

When Root's `maxItems` is set and the trail has more than `maxItems` Items, the Items
between the first `itemsBeforeCollapse` (default 1) and the last `itemsAfterCollapse`
(default 1) SHALL be collapsed. Collapse SHALL apply only when at least two Items would be
hidden. Collapsed Items SHALL stay mounted with the `hidden` attribute and `data-collapsed`.
The `Ellipsis` part SHALL render, at the position of the first collapsed Item, only while
items are collapsed. Its render state SHALL give:

- the collapsed items in order, each with `{ key, textValue, href, routerOptions, disabled }`;
- `label`: `messages.showCollapsed(count)`, default "Show {count} more breadcrumbs".

The consumer SHALL render an add-menu Menu in it, whose trigger takes `label` as its
accessible name and whose link items are the collapsed items. A current Item SHALL never
be collapsed. Changing `maxItems` to `undefined` SHALL show every Item.

#### Scenario: Six items, four visible

- **WHEN** a trail of six Items has `maxItems={4}`
- **THEN** items 2–5 are hidden, the Ellipsis follows item 1, and the list's visible items
  are item 1, the Ellipsis and item 6

#### Scenario: Short trails never collapse (react-spectrum#2923)

- **WHEN** a trail has one, two or three Items with `maxItems={2}` and the defaults
- **THEN** nothing is collapsed when fewer than two Items would be hidden, and nothing
  throws

#### Scenario: Named ellipsis trigger (react-spectrum#3967)

- **WHEN** three Items are collapsed and the trigger is rendered with the render state's
  `label`
- **THEN** the trigger's accessible name is "Show 3 more breadcrumbs" in NVDA, VoiceOver
  and the accessibility tree, never "…"

#### Scenario: Following a collapsed item

- **WHEN** the user opens the ellipsis menu and activates the `Guides` item
- **THEN** the router (or the browser) navigates to `Guides`' `href` once and the menu
  closes

### Requirement: Non-Link Items

An `Item` MAY contain a control other than `Link`, such as a Menu trigger or a button. Its
render state SHALL expose `{ current, currentValue, collapsed, disabled }`, so the control
can carry `aria-current` itself. In development a warning SHALL be logged when the current
Item contains no element with `aria-current`. In development a warning SHALL also be
logged when Breadcrumbs is rendered inside a `listbox`, `menu` or `combobox` popup.

#### Scenario: Reado path segments

- **WHEN** each Item contains a Menu trigger, and the last Item's trigger is given
  `aria-current={state.current ? "location" : undefined}` from the render state
- **THEN** the file segment's button is announced as the current location, and every
  segment opens its menu

#### Scenario: Inside a combobox popup (react-spectrum#7790)

- **WHEN** Breadcrumbs is rendered inside a listbox popup
- **THEN** a development warning names the Root

### Requirement: Keyboard Interactions

Breadcrumbs SHALL add no key handling. Every crumb link and the ellipsis trigger SHALL be
one Tab stop each, in visual order. Enter SHALL follow a link, according to
`link-navigation`. The ellipsis trigger's keys SHALL be add-menu's. A current item
without `href` SHALL NOT be a Tab stop.

#### Scenario: Tab order

- **WHEN** the user tabs through a collapsed trail `Home / [Show 3 more] / Section / Page`
  whose current `Page` has no `href`
- **THEN** focus visits `Home`, the ellipsis trigger and `Section`, then leaves the trail

### Requirement: Messages

Breadcrumbs SHALL export typed `messages` with English defaults: `label` ("Breadcrumbs")
and `showCollapsed(count: number)` ("Show {count} more breadcrumbs", pluralised through
`Intl.PluralRules`). Overrides SHALL work by prop and through the provider.

#### Scenario: Plural

- **WHEN** two items are collapsed with the English defaults
- **THEN** the label is "Show 2 more breadcrumbs"

### Requirement: Data Attributes

Parts SHALL expose:

| Part | Attributes |
|---|---|
| `Root` | `data-scope="breadcrumbs"`, `data-part="root"`, `data-instance`, `data-collapsed` while items are collapsed |
| `List` | `data-part="list"` |
| `Item` | `data-part="item"`, `data-current`, `data-disabled`, `data-collapsed` |
| `Link` | `data-part="link"` plus `link-navigation`'s shared link data attributes |
| `Separator` | `data-part="separator"`, `data-last` in the last visible Item |
| `Ellipsis` | `data-part="ellipsis"`, `data-count` (number of collapsed items) |

`data-variant`, `data-size` and `data-tone` SHALL pass through untouched.

#### Scenario: Attributes agree with ARIA

- **WHEN** the last Item is current and has no `href`
- **THEN** its `li` has `data-current`, and its span has `data-current` and
  `aria-current="page"`

### Requirement: Breadcrumbs Contract

Breadcrumbs SHALL ship a contract with scope `breadcrumbs` and anatomy `root`, `list`,
`item`, `link`, `separator` and `ellipsis`. It SHALL locate an instance by role
`navigation` and exact accessible name. It SHALL declare:

- actions:
  - `follow(name)`: pointer click and keyboard Enter on the named crumb link;
  - `openCollapsed()`: pointer click and keyboard Enter on the ellipsis trigger, done
    when its menu is open;
  - `followCollapsed(name)`: `openCollapsed()`, then add-menu's choose action on the
    named item;
- queries:
  - `items()`: visible crumb names in order, with the ellipsis as its label;
  - `current()`: `{ name, value }` of the element with `aria-current`, or `null`;
  - `collapsedCount()`;
  - `href(name)`;
- no traits.

Per-contract invariants SHALL check that separators are `aria-hidden` and are never list
children, that at most one element in the trail has `aria-current`, and that the list's
items are exactly the visible Items plus the Ellipsis. A `getBreadcrumbs` driver SHALL be
exported from `@rind-ui/testing`.

#### Scenario: Driver in both environments

- **WHEN** a test runs `getBreadcrumbs(screen, { name: "Breadcrumbs" }).current()` and the
  same test runs with a Playwright `page`
- **THEN** both resolve `{ name: "Link", value: "page" }`

#### Scenario: Consumer wrapper adds a separator list item

- **WHEN** a consumer's styled wrapper renders separators as `<li>` elements
- **THEN** the separator invariant fails, naming the element
