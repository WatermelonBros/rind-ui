## Purpose

Defines the element, disabled, current-state, activation and client-routing rules shared by
every part in rind-ui that renders a link (Link, Breadcrumbs, Pagination, Navigation Menu
links and any other part that opts in), so a link behaves like a native `<a href>` wherever
it appears and no component re-implements routing or modifier-click handling.

## ADDED Requirements

### Requirement: Native Anchor By Default

A link part SHALL render a native `<a>` with the resolved `href` by default, and SHALL pass
through `target`, `rel`, `download`, `ping`, `referrerPolicy` and `hrefLang`. On an enabled
native anchor it SHALL emit no `role` and no `tabIndex`. It SHALL NOT call `preventDefault()`
on the `keydown` of Enter, so Enter activates the anchor only through the browser's own
`click`. The anchor's browser features (context menu, middle click, drag, status-bar URL)
SHALL be left untouched.

#### Scenario: Enter reaches the router's click handler (react-spectrum#9868)

- **WHEN** a link rendered with `render={<RouterLink to="/docs" />}` is focused and the user
  presses Enter
- **THEN** the router link's own `onClick` runs once, the page does not reload, and exactly
  one navigation happens

#### Scenario: No tabIndex on an enabled anchor (react-spectrum#9631)

- **WHEN** an enabled link renders its default `<a href>`
- **THEN** the element has no `tabindex` and no `role` attribute

#### Scenario: Space does nothing

- **WHEN** a standalone link is focused and the user presses Space
- **THEN** the link does not navigate and the browser's default (page scroll) is not
  prevented

### Requirement: Non-Anchor Fallback

When `render` substitutes an element that is not an `<a>`, the part SHALL add
`role="link"` and `tabIndex=0`. It SHALL activate on Enter (not Space), on a pointer click
and on a bare `click`, through press interactions. To activate, it SHALL open the resolved
`href` with the event's modifier keys through a temporary anchor, applying the same
routing and modifier rules as a native anchor. The `webkit-synthetic-click-modifiers`
quirk entry SHALL dispatch a keyboard Enter instead of a click where WebKit drops
modifiers on synthetic clicks. A development warning SHALL say that the element loses
the browser's link features.

#### Scenario: Div rendered as a link (kobaltedev/kobalte#712)

- **WHEN** a Link is rendered as a `<div>` with `href="/a"` and activated with Enter, with a
  pointer click and with a bare `click`
- **THEN** each activation navigates to `/a` exactly once, and the element has
  `role="link"` and `tabindex="0"`

#### Scenario: Modifier on a non-anchor (react-spectrum#6347)

- **WHEN** a router with `href: (h) => "/base" + h` is provided and a non-anchor link to
  `/a` is ⌘-clicked
- **THEN** a new tab opens at `/base/a`

### Requirement: Activation Routine For Parts With Their Own Role

The temporary-anchor activation routine (resolved `href`, event modifier keys, `target`,
router and `download` handling) SHALL be exported as a function, separate from the
`role="link"` non-anchor fallback props, so a part that must keep its own role (`row`,
`treeitem`) can activate a link without gaining `role="link"` or `tabIndex`. The function
SHALL apply the same routing, modifier and disposition rules as the fallback, SHALL call
`onActivate` once, and SHALL apply the `webkit-synthetic-click-modifiers` quirk entry. The
non-anchor fallback SHALL be built on it.

#### Scenario: Row with a link keeps its role

- **WHEN** a part with `role="row"` and `href="/a"` calls the exported routine on Enter
  with the Meta key held
- **THEN** a new tab opens at the resolved `/a`, the row keeps `role="row"` and its own
  `tabindex`, and `onActivate` is called once with `disposition: "elsewhere"`

#### Scenario: Fallback uses the same routine

- **WHEN** a `<div>` Link is activated with Enter
- **THEN** it navigates through the same routine and has `role="link"`

### Requirement: Disabled Links

A disabled link SHALL:

- have no `href`;
- carry `role="link"` and `aria-disabled="true"`;
- carry `tabindex="-1"`, so it is out of the Tab order but stays reachable by the
  TalkBack swipe (quirk entry `talkback-unfocusable-link`);
- carry `data-disabled`.

With `focusableWhenDisabled` it SHALL carry `tabindex="0"` instead. While disabled, no
input SHALL navigate or call activation callbacks: pointer, middle click, touch, Enter, a
bare `click`, or the context menu's "open link". Consumer `onClick` handlers on the part
SHALL NOT be called. Disabled attributes SHALL be present in the server render. This is
add-button's `button-like-element` disabled-link rule, which this capability applies to
every link part.

#### Scenario: Middle click on a disabled link (ariakit#7153)

- **WHEN** a disabled link is middle-clicked
- **THEN** no tab opens, because the element has no `href`

#### Scenario: Consumer onClick on a disabled link (react-spectrum#8827)

- **WHEN** a disabled link with a consumer `onClick` is clicked
- **THEN** the consumer's `onClick` is not called and nothing navigates

#### Scenario: TalkBack reaches a disabled link (react-spectrum#3998)

- **WHEN** a disabled link is rendered
- **THEN** it has `tabindex="-1"`, Tab skips it, and `element.focus()` focuses it

#### Scenario: Focusable when disabled

- **WHEN** a disabled link has `focusableWhenDisabled`
- **THEN** Tab reaches it, it has `aria-disabled="true"`, and Enter does nothing

### Requirement: Current Link

A link part SHALL accept `current`: `true`, `"page"`, `"step"`, `"location"`, `"date"` or
`"time"`. A truthy `current` SHALL emit `aria-current`, using the given value, or `"true"`
for `true`, and SHALL emit `data-current`. A falsy or absent `current` SHALL emit neither.
`current` SHALL be part of the typed input of `linkProps`, so containers pass it through
the same API. A current link SHALL keep its `href` and stay activatable unless it is also
disabled.

#### Scenario: Current page in a navigation

- **WHEN** a link is rendered with `current="page"`
- **THEN** it has `aria-current="page"` and `data-current`, and it still navigates when
  activated

#### Scenario: Typed through containers (react-spectrum#10572)

- **WHEN** a container calls `linkProps({ href: "/a", current: "location" }, env)`
- **THEN** the result carries `aria-current="location"` and it compiles without casts

### Requirement: Browser-Handled Activations

An activation SHALL be left entirely to the browser, with no `preventDefault()` and no
router call, when any of these holds:

- it is not a primary-button click;
- Meta, Ctrl, Shift or Alt is held;
- the element's `target` attribute, read as an attribute and not as a property, is
  present and not `_self`;
- the link has `download`;
- the resolved URL's origin differs from the document's;
- the click was already `defaultPrevented` by an earlier handler, such as a router link
  rendered through `render` or the consumer.

The consumer can also skip only rind-ui's handling with `preventRindHandler()`.

#### Scenario: ⌘-click opens a background tab

- **WHEN** a router is provided and the user ⌘-clicks (Ctrl-clicks on Windows) a same-origin
  link
- **THEN** the router is not called, the browser opens the link in a new tab, and the
  current page does not change

#### Scenario: Alt-click downloads (react-spectrum#6614)

- **WHEN** the user Alt-clicks a link
- **THEN** no router call happens and the browser's default runs

#### Scenario: External link with a target (react-spectrum#6557)

- **WHEN** a router is provided and the user clicks `<Link href="https://example.org"
  target="_blank">`
- **THEN** the router is not called and a new tab opens at `https://example.org`

#### Scenario: Consumer defers navigation (react-spectrum#7566)

- **WHEN** a consumer's `onClick` calls `preventDefault()` to run an exit animation first
- **THEN** neither the browser nor the router navigates

### Requirement: Client-Side Routing

When a `Router` capability is present in the environment and an activation is not left to
the browser, the part SHALL call `preventDefault()` and `router.navigate(href,
routerOptions)` exactly once. `href` SHALL be the value given to the part, not the resolved
DOM `href`, and `routerOptions` SHALL be passed unchanged. With no router, the browser
SHALL navigate natively. When several routers are provided, the innermost provider SHALL
win.

#### Scenario: One navigation per click

- **WHEN** a router is provided and the user clicks a same-origin link once
- **THEN** `navigate` is called once with the link's `href` and `routerOptions`, and the
  document does not reload

#### Scenario: Rendered router link is not routed twice (react-spectrum#2525)

- **WHEN** a router is provided and the link is rendered with the router's own Link
  component, which prevents default and navigates itself
- **THEN** `router.navigate` from the provider is not called and exactly one navigation
  happens

### Requirement: Href Resolution

The `Router` capability MAY supply `href(href)`, a plain function, not a framework hook.
The rendered `href` SHALL be `router.href(href)` for relative and root-relative values.
Values with a URL scheme (`https:`, `mailto:`, `tel:`, …) or a protocol-relative `//` SHALL
be rendered unchanged. `href()` SHALL be called only for parts that have an `href`. The
same resolution SHALL be used for native anchors, the non-anchor fallback, and the
server render.

#### Scenario: Basename (react-spectrum#5335)

- **WHEN** a router with `href: (h) => "/app" + h` is provided and a link has `href="/a"`
- **THEN** the anchor's `href` attribute is `/app/a` and a click calls
  `navigate("/a", undefined)`

#### Scenario: External URL is not rewritten (react-spectrum#6397, react-spectrum#6803)

- **WHEN** the same router is provided and a link has `href="https://example.org/x"`
- **THEN** the anchor's `href` is `https://example.org/x`

#### Scenario: Parts without href (react-spectrum#9490)

- **WHEN** a router is provided and a menu renders items with and without `href`
- **THEN** `router.href` is called only for the items that have an `href`, and nothing
  throws

### Requirement: Activation Reports

`linkProps` SHALL accept `onActivate(details)` and call it once per activation that is not
disabled and not prevented by the consumer. `details` SHALL contain:

- `href`;
- `modality`;
- `disposition`: `"same-tab"` for a navigation of the current browsing context, client or
  native, and `"elsewhere"` for anything the browser opens in another tab or window,
  downloads or sends to another target.

Containers SHALL use it to decide whether to close or to change state: a menu or
navigation menu closes on `same-tab`, and pagination changes page only on `same-tab`.
They SHALL NOT inspect modifier keys themselves.

#### Scenario: Middle click is elsewhere

- **WHEN** a link is middle-clicked
- **THEN** `onActivate` is called with `disposition: "elsewhere"`

#### Scenario: Enter is same-tab

- **WHEN** a same-origin link without a target is activated with Enter
- **THEN** `onActivate` is called once with `disposition: "same-tab"` and `modality:
  "keyboard"`

### Requirement: Press State Clears

`data-pressed` on a link part SHALL be present only while a press is in progress. It SHALL
be removed when the element loses focus, when the document becomes hidden, and when the
press ends, including when Enter opens a link in another tab and the keyup never arrives.

#### Scenario: Enter on a _blank link (react-spectrum#6094, react-spectrum#8364)

- **WHEN** the user presses Enter on a link with `target="_blank"`, a new tab opens, and the
  user comes back
- **THEN** the link does not carry `data-pressed`

### Requirement: Interactive Content Warning

In development, a link part whose rendered element contains a button, a link or another
interactive element SHALL log a warning through the injected logger, as button-like
elements do.

#### Scenario: Button inside a link (react-spectrum#2234, react-spectrum#7767)

- **WHEN** a Link contains a `<button>`
- **THEN** a development warning names the part and the nested element

### Requirement: Shared Link Data Attributes

Every link part SHALL carry `data-scope`, `data-part` and `data-instance`, plus:

- `data-current` while current;
- `data-disabled` while disabled;
- `data-external` when the resolved URL's origin differs from the document's;
- `data-focus` and `data-focus-visible` as defined by interaction modality;
- `data-hover` and `data-pressed` as defined by press interactions.

#### Scenario: Pointer click shows no ring

- **WHEN** a link is clicked with a mouse and stays mounted after the navigation
- **THEN** it carries `data-focus` and not `data-focus-visible`
