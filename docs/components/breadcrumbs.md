# Breadcrumbs

A navigation landmark with the trail of links to the ancestors of the current location. The
current item is explicit, separators are hidden glyphs, and long trails can collapse their
middle items into a menu you render.

## When to use

- **Use it for** showing the path from the site root to the current page, so users can jump to an
  ancestor.
- **Over a hand-written `<nav>` and `<ol>`**: it sets the navigation landmark, marks the current
  item with `aria-current`, hides separators from screen readers, and can collapse long trails into
  a menu you render.
- **Don't use it for** moving between sibling pages: use [Pagination](pagination.md) or
  [Tabs](tabs.md). A single link back needs only a [Link](link.md).

```tsx
import { Breadcrumbs } from "@rind-ui/react"

<Breadcrumbs.Root>
  <Breadcrumbs.List>
    <Breadcrumbs.Item value="home">
      <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
      <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
    </Breadcrumbs.Item>
    <Breadcrumbs.Item value="docs">
      <Breadcrumbs.Link href="/docs">Docs</Breadcrumbs.Link>
      <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
    </Breadcrumbs.Item>
    <Breadcrumbs.Item value="breadcrumbs">
      <Breadcrumbs.Link>Breadcrumbs</Breadcrumbs.Link>
    </Breadcrumbs.Item>
  </Breadcrumbs.List>
</Breadcrumbs.Root>
```

Breadcrumbs is stateless: it has no machine. The current item and the collapsed items are
derived from the trail on every render.

## API

<!-- api:breadcrumbs -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Breadcrumbs.Root` | `root` | `<nav>` | The `navigation` landmark, named "Breadcrumbs" unless labelled. May hold other controls. |
| `Breadcrumbs.List` | `list` | `<ol>` | The ordered trail. |
| `Breadcrumbs.Item` | `item` | `<li>` | One crumb, keyed by `value`. Its `render` state (or a children function) gives `{ current, currentValue, collapsed, disabled }`. |
| `Breadcrumbs.Link` | `link` | `<a>` | The crumb's link (`link-navigation`). The current item without `href` renders `<span aria-current tabindex="-1">` instead. |
| `Breadcrumbs.Separator` | `separator` | `<span>` | A glyph after the crumb, `aria-hidden`. No default content. |
| `Breadcrumbs.Ellipsis` | `ellipsis` | `<li>` | Only while items are collapsed. Its children function gets `{ items, label, count }`: render a Menu (or Popover) there. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `maxItems` | `number` | — | Collapse the middle items past this many (Root). |
| `itemsBeforeCollapse` | `number` | `1` | Items always shown before the collapsed range (Root). |
| `itemsAfterCollapse` | `number` | `1` | Items always shown after the collapsed range (Root). |
| `currentValue` | `"page" \| "location" \| "date" \| "time" \| true` | `"page"` | The current item's `aria-current` value (Root). |
| `items` | `readonly BreadcrumbsTrailItem[]` | — | The trail as data (Root): collapse is known while rendering, so the server render collapses too. Items still render with the same `value`s. |
| `messages` | `Partial<BreadcrumbsMessages>` | — | `label` and `showCollapsed(count)` (Root). |
| `value` | `string` | — | The Item's key, stable across renders (Item). |
| `current` | `boolean` | — | `true` makes the Item current; `false` on the last Item opts out of the default (Item). |
| `disabled` | `boolean` | `false` | Disables the Item's Link (Item). |
| `textValue` | `string` | — | The Item's text in the ellipsis menu; default its Link's text (Item). |
| `href` | `Href` | — | Where the crumb goes (Link). |
| `routerOptions` | `RouterOptions` | — | Passed unchanged to the router's `navigate` (Link). |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element, on every part. |
| `children` | `ReactNode \| ((state: BreadcrumbsItemState) => ReactNode)` | — | Nodes, or a function of the Item's state (a non-link control sets `aria-current`). |
| `download` | `boolean \| string` | — | Download instead of navigating (the browser handles it); a string names the file. |
| `referrerPolicy` | `ComponentPropsWithRef<"a">["referrerPolicy"]` | — | Passed to the anchor. |
| `focusableWhenDisabled` | `boolean` | — | Keeps a disabled link in the Tab order (it stays `aria-disabled`). |
| `onActivate` | `LinkInput["onActivate"]` | — | Once per activation that is not disabled or prevented, with where it opened. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "breadcrumbs" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |
| `root` | `data-collapsed` | While items are collapsed. |
| `list` | `data-scope` | "breadcrumbs" |
| `list` | `data-part` | "list" |
| `list` | `data-instance` | The instance id. |
| `item` | `data-scope` | "breadcrumbs" |
| `item` | `data-part` | "item" |
| `item` | `data-instance` | The instance id. |
| `item` | `data-current` | On the current Item. |
| `item` | `data-disabled` | On a disabled Item. |
| `item` | `data-collapsed` | While collapsed (the Item is also `hidden`). |
| `link` | `data-scope` | "breadcrumbs" |
| `link` | `data-part` | "link" |
| `link` | `data-instance` | The instance id. |
| `link` | `data-current` | On the current item's link or text. |
| `separator` | `data-scope` | "breadcrumbs" |
| `separator` | `data-part` | "separator" |
| `separator` | `data-instance` | The instance id. |
| `separator` | `data-last` | In the last visible Item: themes hide it. |
| `ellipsis` | `data-scope` | "breadcrumbs" |
| `ellipsis` | `data-part` | "ellipsis" |
| `ellipsis` | `data-instance` | The instance id. |
| `ellipsis` | `data-count` | The number of collapsed items. |
| `ellipsis` | `data-label` | Its trigger's accessible name (`messages.showCollapsed(count)`). |

### Keyboard

| Key | Action |
|---|---|
| Tab | Moves through the crumb links and the ellipsis trigger; the current text is skipped. |
| Enter | Follows the focused link. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

| Action | Modalities |
|---|---|
| `follow` | pointer, keyboard |
| `openCollapsed` | pointer, keyboard |
| `followCollapsed` | pointer, keyboard |

Queries: `items`, `current`, `collapsedCount`, `href`. Traits: none.
<!-- /api -->

## The current item

The current item is the Item with `current`, or else the last Item, unless the last Item
says `current={false}` (a trail that ends on a parent of the page). Its Link gets
`aria-current` with the Root's `currentValue` (`"page"` by default; `"location"`, `"date"`,
`"time"` or `true`).

- **With an `href`** the current item stays a link (the APG example).
- **Without an `href`** it renders `<span aria-current tabindex="-1">`: text, not a link and
  not a disabled link. It is not a Tab stop, its text is selectable, and screen readers on
  touch devices (TalkBack) still reach it. When the focused crumb becomes the current text
  after a client-side navigation, focus moves to the new text instead of falling to the
  page.

## Separators

`Breadcrumbs.Separator` goes inside the Item, after its link, and is `aria-hidden`: a
screen reader hears "list, 3 items" and the crumbs, never "slash". It has no default glyph:
pass yours (`/`, `›`, an icon). The separator in the last visible Item carries `data-last`
so the theme hides it. Drawing separators with CSS works too:

```css
[data-scope="breadcrumbs"][data-part="item"] + [data-part="item"]::before {
  content: "/" / "";
}
```

## Collapsing long trails

`maxItems` collapses the middle items when the trail is longer: the first
`itemsBeforeCollapse` (default 1) and the last `itemsAfterCollapse` (default 1) stay, at
least two items collapse, and the current item never does. Collapsed Items stay mounted
with `hidden` and `data-collapsed`. Place one `Breadcrumbs.Ellipsis` right after the first
`itemsBeforeCollapse` Items: it renders only while items are collapsed, and its children
function gets the collapsed `items`, a `count` and the trigger's `label` ("Show 4 more
breadcrumbs"). Render a Menu or a Popover there:

```tsx
<Breadcrumbs.Root maxItems={4}>
  <Breadcrumbs.List>
    <Breadcrumbs.Item value="home">
      <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
      <Breadcrumbs.Separator>/</Breadcrumbs.Separator>
    </Breadcrumbs.Item>
    <Breadcrumbs.Ellipsis>
      {({ items, label }) => (
        <Popover.Root>
          <Popover.Trigger aria-label={label}>…</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Content aria-label="More breadcrumbs">
                {items.map((item) => (
                  <Link key={item.key} href={item.href}>
                    {item.textValue}
                  </Link>
                ))}
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </Breadcrumbs.Ellipsis>
    {/* … the other Items … */}
  </Breadcrumbs.List>
</Breadcrumbs.Root>
```

The trigger must be named by `label`: "…" alone is read as nothing useful.

**Server rendering.** Items register when they mount, so with static Items the server
render shows every Item and collapse applies in the first commit after hydration (no
mismatch, one layout change). Pass the trail as data with `items` and the server render
already collapses:

```tsx
<Breadcrumbs.Root maxItems={4} items={trail.map((c) => ({ key: c.id, textValue: c.title, href: c.url }))}>
  <Breadcrumbs.List>{/* one Item per entry, value={c.id} */}</Breadcrumbs.List>
</Breadcrumbs.Root>
```

## Items with their own controls

An Item may hold a control other than a Link, such as a menu trigger per path segment. Its
`render` state, or a children function, gives `{ current, currentValue, collapsed,
disabled }`, so the control carries `aria-current` itself:

```tsx
<Breadcrumbs.Root aria-label="File path" currentValue="location">
  <Breadcrumbs.List>
    {segments.map((name) => (
      <Breadcrumbs.Item key={name} value={name}>
        {(state) => (
          <button type="button" aria-current={state.current ? "location" : undefined}>
            {name}
          </button>
        )}
      </Breadcrumbs.Item>
    ))}
  </Breadcrumbs.List>
</Breadcrumbs.Root>
```

In development, a current Item that contains no element with `aria-current` logs a warning,
and so does Breadcrumbs rendered inside a listbox, menu or combobox popup.

## Keyboard

Breadcrumbs adds no keys. Each link and the ellipsis trigger is one Tab stop, in order;
Enter follows a link (client routing and ⌘-click as for [Link](link.md)); the ellipsis
trigger's keys are its Menu's or Popover's. The current text without `href` is not a Tab
stop.

## Styling

| Selector | What it is |
|---|---|
| `[data-scope="breadcrumbs"][data-part="item"][data-current]` | The current Item |
| `[data-part="item"][data-collapsed]` | A collapsed Item (also `hidden`) |
| `[data-part="link"][data-current]` | The current link or text |
| `[data-part="separator"][data-last]` | The separator to hide |
| `[data-part="ellipsis"][data-count]` | The collapsed items' place |

The theme reads `--rind-breadcrumbs-*` tokens (gap, color, current color and weight,
separator color and size, minimum target) and falls back to the link tokens. A chevron
separator mirrors in right-to-left text.

## Testing

```tsx
import { getBreadcrumbs } from "@rind-ui/testing"

const trail = getBreadcrumbs(screen, { name: "Breadcrumbs" })
expect(await trail.current()).toEqual({ name: "Breadcrumbs", value: "page" })
expect(await trail.items()).toEqual(["Home", "Show 4 more breadcrumbs", "Page"])
await trail.follow("Docs")
await trail.followCollapsed("Guides")
```

`getBreadcrumbs` finds the landmark by its name. `openCollapsed` presses the ellipsis
trigger, `followCollapsed(name)` then activates the named menu item or link. The contract
checks that separators are `aria-hidden` and never list items, and that at most one element
is current. The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:breadcrumbs -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
