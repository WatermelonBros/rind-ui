# navigation-menu Specification

## Purpose
Site navigation following the APG Disclosure Navigation pattern: a named `nav`
landmark with top-level links and disclosure buttons whose panels hold links, opened
by press, keyboard or hover intent, with an optional shared viewport that animates
between panels, nested levels, current-page links and a driver that operates and
verifies it.
## Requirements
### Requirement: Anatomy

Navigation Menu SHALL consist of `Root`, `List`, `Item`, `Trigger`, `Content` and
`Link`, and the optional `Indicator`, `Viewport`, `Positioner` and `Sub` parts, used
with the generic `Portal`. `Root` SHALL render `<nav>`, `List` a `<ul>`, `Item` an
`<li>`, `Trigger` a button-like element (add-button `button-like-element`), `Content`
and `Viewport` a `<div>`, `Link` an `<a>` built with add-link `link-navigation`, and
`Sub` a `<div>` holding a nested level (its own `List`, `Item`s and value) inside a
`Content`. An `Item` SHALL contain at most one `Trigger` and one `Content`; an `Item`
with only a `Link` is a top-level link; an `Item` with a `Link` and a `Trigger` is a
split item whose trigger opens the content and whose link navigates. Every part SHALL
accept `render`.

#### Scenario: Split item (mui/base-ui#4186, reka-ui#3001)

- **WHEN** an item renders a "Products" link and a trigger named "Show Products
  submenu"
- **THEN** pressing the link navigates and does not open the panel, and pressing the
  trigger toggles the panel without navigating

#### Scenario: Element substitution

- **WHEN** a `Link` is rendered with `render` as a client router's link component
- **THEN** it keeps link semantics, `aria-current` and closing behaviour (add-link
  `link-navigation`)

### Requirement: Landmark And Naming

`Root` SHALL be a `navigation` landmark named by `aria-labelledby` when the consumer
points it at a visible heading, otherwise by `aria-label` from the `label` message
(default `"Main"`). A `Sub` level SHALL NOT be a landmark. `List` SHALL keep the
`list` role and SHALL carry no `aria-orientation`; orientation SHALL be exposed only
as `data-orientation`.

#### Scenario: Default name

- **WHEN** a navigation menu is rendered without a label
- **THEN** it is exposed as a navigation landmark named "Main"

#### Scenario: No aria-orientation (mui/base-ui#4349, mui/base-ui#4305, mui/base-ui#4403)

- **WHEN** a vertical navigation menu is checked with axe and Lighthouse
- **THEN** no element carries `aria-orientation` and no ARIA-attribute rule fails

### Requirement: Disclosure Semantics

Each `Trigger` SHALL have `aria-expanded` equal to whether its item is the open item
of its level, and `aria-controls` pointing at its content only while the content is
in the document. No part SHALL carry the roles `menu`, `menubar`, `menuitem` or
`aria-haspopup`. `Content` SHALL have no role. Opening a panel SHALL NOT move focus.

#### Scenario: Toggle with Enter keeps focus

- **WHEN** focus is on the "Products" trigger and the user presses Enter
- **THEN** the panel opens, the trigger has `aria-expanded="true"` and keeps focus
  (regression: mui/base-ui#5413)

#### Scenario: Not a menu

- **WHEN** a navigation menu with two open-able items is rendered
- **THEN** the accessibility tree contains a navigation landmark, a list, buttons and
  links, and no menu or menuitem roles (regression: kobaltedev/kobalte#446)

### Requirement: Open Value And Reasons

Which item is open SHALL be a controllable value per level (`value`, `defaultValue`,
`onValueChange(value, details)`), the open item's key or `null` (default `null`). At
most one item per level SHALL be open. Each change SHALL carry a reason:
`trigger-press`, `trigger-hover`, `trigger-key`, `pointer-leave`, `escape-key`,
`outside-press`, `outside-focus`, `link-activate`, `parent-close` or `api`. A
controlled parent that refuses a change SHALL leave the menu as it was; a parent
changing `value` SHALL NOT call `onValueChange`. Item keys SHALL default to a
generated, SSR-stable key when the consumer gives none.

#### Scenario: Controlled switch

- **WHEN** "Products" is open in a controlled menu and the user hovers "Resources"
- **THEN** `onValueChange("resources", details)` is called once with
  `details.reason === "trigger-hover"`, and only "Resources" is open after the parent
  accepts it

#### Scenario: Default open item in a dialog (radix#3473)

- **WHEN** a vertical navigation menu with `defaultValue="docs"` is inside an open
  dialog that autofocuses its Close button
- **THEN** "Docs" stays open and `onValueChange` is not called

### Requirement: Opening By Press

A press on a `Trigger` (pointer, touch, Enter, Space or a bare `click`) SHALL toggle
its item, exactly once per press: a closed item opens with reason `trigger-press`
(`trigger-key` for Enter/Space), its open item closes. When the item was opened by
hover less than the patient-click window ago (default 500 ms), the press SHALL keep it
open instead of closing it. An item opened or kept open by a press SHALL NOT close
when the pointer leaves the hover zone.

#### Scenario: Hover then click (radix#1630, radix#2326)

- **WHEN** the pointer rests on "Products" until its panel opens by hover and the user
  clicks the trigger 100 ms later
- **THEN** the panel stays open, and moving the pointer away from trigger and panel
  does not close it

#### Scenario: Screen reader press

- **WHEN** the trigger receives a bare `click` (`detail: 0`, no pointer or key events)
- **THEN** the panel toggles exactly once and focus stays on the trigger

#### Scenario: Click mode without pointerType (reka-ui#2168)

- **WHEN** a trigger is clicked in Firefox, where the click event has no `pointerType`
- **THEN** it toggles exactly as in Chromium

### Requirement: Opening On Hover

Hovering a `Trigger` with a mouse or pen SHALL open its item through add-tooltip's
`hover-intent` after the open delay (default 200 ms); leaving the hover zone SHALL
close a hover-opened item after the close delay (default 300 ms), and the grace area
and in-transit suppression of `hover-intent` SHALL apply between a trigger and its
panel. After an item is closed by Escape or by a press, hovering SHALL NOT reopen it
until the pointer has left its trigger. Touch input SHALL never open, keep or close an
item through hover. Opening by hover SHALL be disableable per root (`openOnHover`,
default true) without affecting press and keyboard.

#### Scenario: Diagonal move to the panel (radix#1553, radix#2437)

- **WHEN** the "Resources" panel is open below the rightmost trigger and the pointer
  moves diagonally towards it across the "Products" trigger
- **THEN** "Products" does not open and "Resources" stays open

#### Scenario: Escape then mouse move (radix#1529)

- **WHEN** the user closes a hover-opened panel with Escape and moves the mouse
  within the trigger
- **THEN** the panel stays closed until the pointer leaves and re-enters the trigger

#### Scenario: Pen hover (radix#1403)

- **WHEN** a pen hovers a trigger, is lifted and hovers it again
- **THEN** the panel opens by hover both times

#### Scenario: Pointer already resting at hydration (mui/base-ui#3570)

- **WHEN** the pointer is on a trigger before the page hydrates and then moves
- **THEN** the open delay starts on that first movement

#### Scenario: No style writes (mui/base-ui#5453, mui/base-ui#5239)

- **WHEN** the pointer sweeps across every trigger faster than the open delay, or a
  trigger unmounts while its panel is open
- **THEN** no inline `pointer-events` style is written on any element and every
  trigger and link keeps responding

### Requirement: Switching Between Items

While an item of a level is open, hovering another trigger of that level SHALL switch
to it with no open delay, and pressing another trigger SHALL switch to it. After the
level closes, hovering a trigger within the warm window (default 300 ms) SHALL open
with no delay. A switch SHALL close the previous item in the same step, so two items
are never open together.

#### Scenario: Fast switching (reka-ui#2664)

- **WHEN** "Products" is open and the pointer moves onto "Resources"
- **THEN** "Resources" opens without waiting for the open delay and "Products" closes
  in the same step

### Requirement: Tab Order

Every top-level `Trigger` and `Link` SHALL be in the sequential Tab order (no roving
tabindex). While an item is open, its content SHALL follow its trigger in the Tab
order through add-popover's `non-modal-tab-order`, whether the content renders inline
in its item, in the `Viewport` or in a `Portal`. Leaving the content forward SHALL
continue with the element after the trigger; leaving it backward from its first
element SHALL return to the trigger; Shift+Tab from the element after the trigger
SHALL enter the open content at its last tabbable element. The navigation menu SHALL
NOT add focusable sentinels, rewrite `tabindex` of content elements or use
`aria-owns`.

#### Scenario: Tab through an open panel in the viewport (radix#3085)

- **WHEN** "Products" is open in a shared viewport rendered after the list, focus is
  on its trigger and the user presses Tab three times
- **THEN** focus visits the panel's links in order and then the next top-level
  trigger, and axe reports no `aria-hidden-focus` violation

#### Scenario: Reverse Tab re-enters the panel (mui/base-ui#4463)

- **WHEN** focus left the open "Products" panel forward onto "Resources" and the user
  presses Shift+Tab
- **THEN** focus moves to the last link of the "Products" panel if it is still open,
  otherwise to the "Products" trigger

#### Scenario: Nested level does not skip items (reka-ui#1191)

- **WHEN** a panel contains a `Sub` level and the user tabs through the panel
- **THEN** every link and nested trigger of the panel is visited once, in DOM order

#### Scenario: First item first (radix#3396)

- **WHEN** a menu whose first item is a link is entered with Tab in Chromium, Firefox
  and WebKit
- **THEN** the first link receives focus

### Requirement: Keyboard Interactions

The keys SHALL be (logical keys mirror in RTL; vertical orientation swaps the arrow
axes):

| Key | Focus on | Action |
|---|---|---|
| Enter, Space | Trigger | Toggle its item; focus stays |
| Enter | Link | Activate the link (native) |
| Escape | Trigger or inside content | Close the innermost open level; focus its trigger if focus was inside the content |
| ArrowDown (horizontal) / ArrowRight in LTR, ArrowLeft in RTL (vertical) | Open trigger | Focus the first link or nested trigger of its content |
| Next arrow | Top-level item | Focus the next top-level trigger or link, no wrap |
| Previous arrow | Top-level item | Focus the previous one, no wrap |
| ArrowDown / ArrowUp | Link or nested trigger in content | Next / previous link or nested trigger in that content, no wrap |
| Home / End | Any navigation part | First / last item of the same set |
| Tab, Shift+Tab | Any | See Tab Order |

Arrow keys and Home/End SHALL act only when focus is on a `Trigger` or `Link` part of
the menu; key events on any other element inside the content (inputs, custom widgets)
SHALL be left untouched and not prevented. Keys with Ctrl, Meta or Alt and composing
key events SHALL be ignored.

#### Scenario: Input in a panel (reka-ui#548)

- **WHEN** a panel contains a search input and the user types and presses the arrow
  keys and Space in it
- **THEN** the input receives every key and the panel stays open

#### Scenario: Top-level link in arrow navigation (huntabyte/bits-ui#1373)

- **WHEN** focus is on the "Products" trigger, followed by a "Pricing" link, and the
  user presses ArrowRight
- **THEN** "Pricing" is focused

#### Scenario: Nested trigger reached by arrows (mui/base-ui#3343)

- **WHEN** focus is on a link in a panel followed by a nested trigger, and the user
  presses ArrowDown
- **THEN** the nested trigger is focused

#### Scenario: Right-to-left

- **WHEN** `dir="rtl"` and focus is on the first top-level trigger
- **THEN** ArrowLeft focuses the next top-level item and ArrowRight does nothing

### Requirement: Escape And Focus Restore

Escape SHALL close only the innermost open level (layer stack). When focus was inside
the closing content, focus SHALL move to that level's open trigger in the closing
step, through the safe focus operation with cause `layer`, whether or not anything
animates. Closing by pointer leave, outside press or outside focus SHALL NOT move
focus.

#### Scenario: Escape without animations (radix#1774, mui/base-ui#2775)

- **WHEN** focus is on a link inside an open panel that has no transitions and the
  user presses Escape
- **THEN** the panel closes and its trigger is focused

#### Scenario: Escape in a nested level

- **WHEN** a `Sub` panel is open inside the "Products" panel and focus is in the sub
  panel
- **THEN** Escape closes only the sub panel and focuses its trigger; a second Escape
  closes "Products" and focuses the "Products" trigger

### Requirement: Dismissal

Open content SHALL be a non-modal layer while open, and only then. A pointer press
outside the root, its contents and its descendant layers SHALL close the level tree
with reason `outside-press`; a press on another trigger of the menu SHALL switch, not
dismiss. Focus moving from inside the menu to outside it SHALL close with reason
`outside-focus`; focus arriving from outside (another layer's initial focus) SHALL
NOT. Layers opened from inside a panel (dialogs, selects, popovers) SHALL be
descendant layers: interacting with them SHALL NOT close the panel. Closed content
SHALL register no layer, listener or timer.

#### Scenario: Dialog opened from a panel (mui/base-ui#2390)

- **WHEN** a link-styled button in a panel opens a dialog and the user clicks inside
  the dialog
- **THEN** the dialog and the panel stay open

#### Scenario: Kept-mounted content is inert to dismissal (reka-ui#2608, huntabyte/bits-ui#2034, radix#2476)

- **WHEN** all panels are mounted and hidden, one is open, and the user clicks inside
  it; and separately a native `<dialog>` on the page is open while every panel is
  closed and the user presses Escape
- **THEN** the open panel stays open, and the native dialog closes

#### Scenario: Touch drag inside content (reka-ui#729)

- **WHEN** a panel opened by tap is scrolled with a touch drag that starts and ends
  inside it
- **THEN** it stays open

### Requirement: Links And Current Page

`Link` SHALL be built with add-link's `link-navigation`: native link activation,
`current` → `aria-current="page"` and `data-current`, router navigation, disabled
links. A primary activation of any `Link` in the tree SHALL close every open level
immediately (no close delay, reason `link-activate`), also when the navigation is
performed by a client router. Activations the browser handles as "open elsewhere" —
⌘/Ctrl/Shift click, middle click, `target` other than `_self`, `download` — SHALL
leave the menu open. When a panel contains a current link, its `Trigger` SHALL carry
`data-current` (no `aria-current` on the button).

#### Scenario: Link in a nested level closes the tree (mui/base-ui#4262, reka-ui#2383)

- **WHEN** the user clicks a link inside a `Sub` panel of the "Products" panel
- **THEN** both panels close in the same step

#### Scenario: Client router (radix#1364, reka-ui#1196)

- **WHEN** a link rendered by a client router's link component is clicked inside an
  open panel
- **THEN** the route changes and the panel closes

#### Scenario: Opening links in new tabs (radix#2074)

- **WHEN** the user ⌘-clicks, Ctrl-clicks and middle-clicks three links of an open
  panel in turn
- **THEN** three background tabs open and the panel is still open

#### Scenario: Immediate close (kobaltedev/kobalte#490)

- **WHEN** a hover-opened panel's link is activated
- **THEN** the panel is closed in the activation step, without waiting for any delay

#### Scenario: Current section

- **WHEN** the "Docs" panel contains the link for the current page
- **THEN** that link has `aria-current="page"` and the "Docs" trigger has
  `data-current` and no `aria-current`

### Requirement: Nested Levels

A `Sub` inside a `Content` SHALL be a level with its own value, controllable like the
root's, opening by press and keyboard, and by hover when the root opens on hover. Its
triggers SHALL toggle like top-level triggers. A level's hover zone SHALL include its
open descendant levels, so moving into a deeper panel never closes an ancestor. Closing
a level SHALL close its descendant levels with reason `parent-close`.

#### Scenario: Nested trigger toggles (radix#1806, radix#2089)

- **WHEN** a nested trigger's panel is open and the user presses the nested trigger
- **THEN** the nested panel closes

#### Scenario: Third level by hover (mui/base-ui#4386)

- **WHEN** the root panel was opened by hover, a second-level panel is open, and the
  pointer moves into a third-level panel
- **THEN** all three levels stay open

### Requirement: Closed Content

`Root` SHALL take `closedContent: "hidden" | "unmount"` (default `"hidden"`). In
`hidden` mode every item's content SHALL be in the document while closed, with the
`hidden` attribute, so its links are present for crawlers and find-in-page indexing;
in `unmount` mode closed content SHALL be removed after its exit animation. Closed
content SHALL never be hidden only visually and SHALL never carry `aria-hidden`.
`data-state` SHALL be present on content in every state and mode. The server render
SHALL include `hidden` content in `hidden` mode.

#### Scenario: Links in the server HTML (radix#1273, radix#2143)

- **WHEN** a menu in default mode is rendered on the server with every panel closed
- **THEN** the HTML contains every panel's links inside elements with `hidden`

#### Scenario: data-state on kept content (radix#1623, radix#3786)

- **WHEN** a menu in `hidden` mode with a `Viewport` renders a closed panel
- **THEN** the panel carries `data-state="closed"` and `hidden`

### Requirement: Viewport And Size

When a `Viewport` is rendered, the open item's content of that level SHALL render
inside it (other contents stay hidden or unmounted per `closedContent`), and the
viewport SHALL carry `--rind-navigation-menu-viewport-width` and
`--rind-navigation-menu-viewport-height`, written by add-collapsible's `content-size`
module: `0px` while closed; on opening, the content's natural size in px, then `auto`
once enter animations end; on switching, from the current size in px to the incoming
content's own natural size in px, then `auto`; on closing, the current px size and
then `0px`. The incoming size SHALL be measured from the incoming content only; an
interrupted switch SHALL start from the size currently rendered. An item without
content SHALL never change the viewport's size. Without a `Viewport`, each `Content`
SHALL carry the same pair of properties for itself.

#### Scenario: Rapid hovering between panels (mui/base-ui#4619)

- **WHEN** the pointer moves over five triggers with panels of different sizes faster
  than the theme's transition and stops on the third
- **THEN** once the transition ends the viewport's size equals the third panel's
  natural size

#### Scenario: Item without content in between (mui/base-ui#3308, mui/base-ui#3073)

- **WHEN** the pointer moves from a panel item, over a top-level link, to another
  panel item, in Chromium, Firefox and WebKit
- **THEN** the viewport never has a zero width while open and the size transition
  runs from the first panel's size to the second's

#### Scenario: Window resize while open (mui/base-ui#2035)

- **WHEN** a panel is open and settled and the window narrows so its content wraps
- **THEN** the content is not clipped, because the size properties are `auto`

#### Scenario: Large panel scrolls (mui/base-ui#2240)

- **WHEN** a panel taller than the available height is open with the theme loaded
- **THEN** the viewport is capped at the available height and its content scrolls

### Requirement: Motion Direction

Content SHALL carry `data-motion` while it is entering or leaving because of a switch
between items of the same level: `from-start` or `from-end` on the incoming content,
`to-start` or `to-end` on the outgoing content, in logical order (start = the
inline-start side, mirrored in RTL). Opening from closed and closing to closed SHALL
carry no `data-motion`. The viewport SHALL carry `data-instant` while a switch or open
skipped the open delay.

#### Scenario: Switching to the right in RTL

- **WHEN** `dir="rtl"`, "Products" (first) is open and the user opens "Resources"
  (second, visually to the left)
- **THEN** "Resources" content has `data-motion="from-end"` and "Products" content has
  `data-motion="to-start"`

### Requirement: Indicator

`Indicator` SHALL be rendered inside `List` and positioned with add-tabs'
`selection-indicator`, treating the open item's trigger as the selected item: hidden
with `data-state="hidden"` while no item of its level is open, decorative and never
focusable.

#### Scenario: Scrolled list (radix#2424)

- **WHEN** a horizontally scrolling list is scrolled and an item opens
- **THEN** the indicator's custom properties equal the open trigger's box, corrected
  for the scroll

### Requirement: Positioning And Portal

Without a `Positioner`, contents and the viewport SHALL render in flow and SHALL be
positioned by the consumer's CSS. A `Positioner` around the `Viewport` (or around a
`Content` when no viewport is used) SHALL place it with add-floating-positioning,
anchored to the open trigger by default (`anchor: "trigger"`) or to the `List`
(`anchor: "list"`), with defaults `side: "bottom"` (horizontal) or `"inline-end"`
(vertical), `align: "start"`, `sideOffset` 4, and expose its placement attributes and
available-size properties. A `Portal` SHALL change neither behaviour nor Tab order.

#### Scenario: Header with overflow hidden (radix#3159)

- **WHEN** the menu sits in a header with `overflow: hidden` and uses `Portal` +
  `Positioner`
- **THEN** the open panel is fully visible and Tab from its trigger enters it

#### Scenario: Scaled ancestor (reka-ui#3015)

- **WHEN** the menu is inside an ancestor scaled to 0.8 within a clipping container
  and a positioned panel opens near the container's edge
- **THEN** the panel is placed next to its trigger and kept inside the clipping
  container

### Requirement: Touch And Small Screens

On touch, a tap on a trigger SHALL toggle its item and a tap on a link SHALL navigate
and close the tree; emulated mouse events after a touch SHALL NOT open or close
anything. A vertical menu with inline contents SHALL work as a list of disclosures
inside a Dialog or Drawer.

#### Scenario: Emulated mouse after tap (reka-ui#1131)

- **WHEN** a trigger is tapped on iOS and the browser fires emulated `mouseenter` and
  `mousemove`
- **THEN** the panel is open exactly once and nothing re-opens or steals focus

#### Scenario: Links on iOS (kobaltedev/kobalte#446)

- **WHEN** a link inside an open panel is tapped on iOS Safari
- **THEN** the browser navigates to it

### Requirement: Disabled

A `Trigger` with `disabled` SHALL follow `button-like-element`'s disabled rules and
SHALL NOT open by press, keyboard or hover; arrow navigation SHALL skip it unless it is
focusable when disabled. Disabling the open item's trigger SHALL close it with reason
`api`.

#### Scenario: Disabled trigger is not hover-opened

- **WHEN** the pointer rests on a disabled trigger past the open delay
- **THEN** nothing opens

### Requirement: Announcements

The navigation menu SHALL make no live-region announcements; opening and closing are
conveyed by `aria-expanded` and focus.

#### Scenario: No announcer use

- **WHEN** a panel opens and closes by hover, press and keyboard
- **THEN** the injected announcer receives no message

### Requirement: Messages

The default landmark name (`label`, `"Main"`) SHALL come from the component's typed
`messages`, overridable per instance and through the provider.

#### Scenario: Localised landmark

- **WHEN** the provider sets `messages={{ "navigation-menu": { label: "Principale" } }}`
- **THEN** the landmark is named "Principale"

### Requirement: Data Attributes

Parts SHALL expose:

| Part | Attributes |
|---|---|
| `Root` | `data-orientation`, `data-state` (`open` if any item of the root level is open, else `closed`) |
| `List` | `data-orientation` |
| `Item` | `data-state`, `data-value` |
| `Trigger` | `data-state`, `data-current`, `data-disabled`, `data-focus`, `data-focus-visible`, `data-hover`, `data-pressed` |
| `Content` | `data-state`, `data-orientation`, `data-motion`, `data-value`, the size properties when no viewport is used |
| `Link` | add-link's attributes (`data-current`, `data-disabled`, focus, hover, pressed) |
| `Viewport` | `data-state`, `data-orientation`, `data-instant`, the size properties |
| `Positioner` | floating-positioning's placement attributes |
| `Indicator` | selection-indicator's attributes |

`data-state` SHALL be `open` or `closed` and present on every part listed with it in
every state.

#### Scenario: Attributes agree with ARIA

- **WHEN** "Products" is open
- **THEN** its item, trigger and content have `data-state="open"`, its trigger has
  `aria-expanded="true"`, and every other item and trigger has `data-state="closed"`

### Requirement: Navigation Menu Contract

Navigation Menu SHALL ship a contract with scope `navigation-menu`, the anatomy above,
located by role `navigation` and exact accessible name. It SHALL declare:

- actions `open(item)`, `close()`, `toggle(item)` with pointer (click) and keyboard
  (Enter on the trigger, reached with Tab) implementations; `hover(item)` with a
  pointer implementation that advances the open delay, a keyboard twin that opens with
  Enter, and touch declared as none; `followLink(name)` (click / Enter);
  `pressEscape()`; `enterContent(item)` (ArrowDown on the open trigger);
- queries `openItem()` (the trigger name or `null`), `isOpen(item)`, `links(item?)`,
  `currentLink()`, `contentText(item)`;
- traits `layer`, `presence` and `timed`, and `anchored` when a `Positioner` is
  rendered;
- `$sync:value` and `$props:disabled` prop steps.

It SHALL ship per-contract invariants: at most one open item per level; `aria-expanded`
matches the open item; every top-level trigger and link is tabbable; closed content is
`hidden` or absent and never `aria-hidden`; no `aria-orientation`, `aria-haspopup`,
`aria-owns` or `menu*` role anywhere in the component.

#### Scenario: Driver in both environments

- **WHEN** a test calls `getNavigationMenu(screen, { name: "Main" }).open("Products")`
  then `openItem()`, and the same test runs with a Playwright `page`
- **THEN** both resolve `"Products"`

#### Scenario: Consumer wrapper adds menu roles

- **WHEN** a consumer runs `testMachine` with the navigation-menu contract on a wrapper
  that adds `role="menubar"` to the list
- **THEN** the per-contract invariant fails naming the list part

#### Scenario: Model-based coverage

- **WHEN** `testMachine` runs over the navigation-menu contract in the pointer,
  keyboard and virtual modalities with nested levels and both `closedContent` modes
- **THEN** every transition is exercised and every generic and per-contract invariant
  holds after each step

