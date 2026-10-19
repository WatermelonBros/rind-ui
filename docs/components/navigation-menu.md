# Navigation Menu

Site navigation: a named `nav` landmark with top-level links and disclosure buttons whose panels hold more links. Panels open on press, on Enter or Space, and when a mouse or pen rests on their trigger; one panel per level is open at a time, and an optional shared viewport animates between them.

## When to use

- **Use it for** a site's header or sidebar navigation where some sections hold more links than fit in the bar: a product menu, a docs index, a mega menu.
- **Over a `<nav>` with `<details>` or hand-rolled buttons**: it adds the disclosure semantics (`aria-expanded`, `aria-controls` while the panel exists), hover opening with delays, a grace area so a diagonal move to a panel does not open the neighbour, the press that follows a hover open keeping the panel open, Escape closing the innermost panel and returning focus, the open panel following its trigger in the Tab order wherever it renders, arrow keys between the menu's own triggers and links, link activation closing every level (modifier clicks untouched), `aria-current` on links, closed panels kept in the document with `hidden` so their links are crawlable, and a viewport whose size animates from panel to panel.
- **Don't use it for** application commands (File, Edit, View): that is a [Menubar](menubar.md), with `menu` and `menuitem` roles. A single button with a list of actions is a [Menu](menu.md). A page with no panels needs only a `<nav>` and [Link](link.md)s.

```tsx
import { NavigationMenu } from "@rind-ui/react"

<NavigationMenu.Root>
  <NavigationMenu.List>
    <NavigationMenu.Item value="products">
      <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>
        <NavigationMenu.Link href="/engage">Engage</NavigationMenu.Link>
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item>
      <NavigationMenu.Link href="/pricing">Pricing</NavigationMenu.Link>
    </NavigationMenu.Item>
  </NavigationMenu.List>
</NavigationMenu.Root>
```

## API

<!-- api:navigation-menu -->

## Disclosure navigation, not a menubar

The pattern is the WAI-ARIA disclosure navigation: every top-level trigger and link is its own Tab stop, triggers are buttons with `aria-expanded`, panels have no role and opening one never moves focus. There is no `menu` role, no `aria-haspopup` and no roving tab stop: screen readers announce a list of links and buttons, which is what a site's navigation is. Arrow keys are an addition: they move between the menu's own triggers and links (never inside an input or a widget in a panel) and ArrowDown on an open trigger enters its panel.

## Opening, switching, closing

- **Press** (pointer, touch, Enter, Space, or a screen reader's click) toggles the item; a press-opened panel stays open when the pointer leaves.
- **Hover** with a mouse or pen opens after `openDelay` (200 ms) and closes `closeDelay` (300 ms) after the pointer leaves the trigger and panel. While one panel is open, hovering another trigger switches at once; within `skipDelay` (300 ms) of a close, hovering opens at once too. A press within `patientClick` (500 ms) of a hover open keeps the panel open. After Escape or a press closes a panel, hovering its trigger does nothing until the pointer leaves it. Touch never hovers. `openOnHover={false}` keeps press and keys only.
- **Close**: Escape closes the innermost open level (focus returns to its trigger when it was inside); a press outside the menu, focus leaving the menu, and a same-tab link activation close every level. `onValueChange(value, details)` reports `details.reason`: `trigger-press`, `trigger-key`, `trigger-hover`, `pointer-leave`, `escape-key`, `outside-press`, `outside-focus`, `link-activate`, `parent-close` or `api`.

## In place or in a viewport

By default each `Content` renders in its `Item`, right after its trigger: the reading order a screen reader's virtual cursor follows is the visual one. A `Viewport` gathers the open panel of its level into one element whose `--rind-navigation-menu-viewport-width` and `-height` go from the outgoing panel's size to the incoming one's (px while moving, `auto` at rest, so a window resize never clips it). Its cost: the panel's links come after the whole list in the document. Tab order is unaffected either way, also with a `Portal`: Tab on an open trigger enters its panel, and Tab past the panel's end continues after the trigger.

`data-motion` (`from-start`, `from-end`, `to-start`, `to-end`) says which side a switched panel comes from or goes to, in logical order (mirrored in RTL); `data-instant` on the viewport marks an open that skipped the delay.

## Positioning

Without a `Positioner`, panels are positioned by your CSS (the theme drops them below their item). A `Positioner` around the `Viewport` (or a `Content`) places it next to the open trigger, or next to the list with `anchor="list"`, below and aligned to the start by default, and exposes `--rind-available-height` so a tall panel scrolls instead of leaving the screen. Without a `Viewport`, put a `Positioner` around each item's `Content` instead: each one places its own panel next to its own trigger. Test a positioned menu with `anchoredNavigationMenuContract`, which adds the `anchored` checks.

## Closed panels

`closedContent="hidden"` (default) keeps every closed panel in the document with the `hidden` attribute: its links are in the server HTML for crawlers, and closed panels carry `data-state="closed"` but never `aria-hidden`. `closedContent="unmount"` removes them after their exit animation.

## Links and the current page

`NavigationMenu.Link` is a [Link](link.md): `current="page"` sets `aria-current`, and a panel holding the current link marks its trigger with `data-current` (no `aria-current` on a button). Use your router's link through `render`; set up routing once with the router provider described on the Link page. ⌘, Ctrl or Shift clicks, middle clicks and `target="_blank"` open elsewhere and leave the menu open.

A trigger is never a link. For a section page and a submenu, use a split item: a `Link` and a `Trigger` (named, for example, "Show Products submenu") in one `Item`.

## Small screens

There is no built-in hamburger mode. On a phone, put a vertical menu (`orientation="vertical"`, in-place contents, usually `openOnHover={false}`) inside a [Drawer](drawer.md): it works as a list of disclosures.

## Styling

The theme places triggers and bar links in the toggle item family and panels in the panel family, with `--rind-navigation-menu-*` tokens (gap, trigger height, padding, radius, open background, panel background, border, radius, shadow, padding, indicator size and colour, current colour, slide distance, duration). The open trigger has an inset edge as well as a background; the current link and the current section's trigger are underlined; forced colours draw outlines. Transitions stop under reduced motion and with `data-instant`.

## Testing

```ts
import { getNavigationMenu } from "@rind-ui/testing"

const nav = getNavigationMenu(screen, { name: "Main" })
await nav.via("pointer").hover("Products")
expect(await nav.openItem()).toBe("Products")
expect(await nav.links("Products")).toEqual(["Analytics", "Engage"])
await nav.followLink("Analytics")
expect(await nav.openItem()).toBe(null)
```

The hover delays run on fake time in jsdom (`vi.useFakeTimers()` and `domEnv({ advanceTimers })`): the driver advances time until the panel opens, so a test never waits for real. Actions: `open`, `close`, `toggle`, `hover`, `hoverTrigger`, `followLink`, `pressEscape`, `pressOutside`, `enterContent`. Queries: `openItem`, `isOpen`, `links`, `currentLink`, `contentText`.

## Accessibility tree

An open panel (generated from the state example):

<!-- aria:navigation-menu--open -->
```yaml
- navigation "Docs (open)":
  - list:
    - listitem:
      - button "Components" [expanded]
      - link "Button":
        - /url: /docs/button/
      - link "Dialog":
        - /url: /docs/dialog/
      - link "Tabs":
        - /url: /docs/tabs/
    - listitem:
      - link "All docs":
        - /url: /docs/
```
<!-- /aria -->

## Tested with

<!-- tested-with:navigation-menu -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
