## Context

See proposal.md for why. The binding sources are the Decisions in
[breadcrumbs.md](../../../docs/research/breadcrumbs.md) and these capabilities, which this
change consumes without restating them:

| From | Used for |
|---|---|
| `add-foundations` | `render`, `mergeProps`, contracts, drivers, React adapter, instance scoping attributes |
| `add-a11y-foundations` | typed `messages` + provider, `plural()`, logger, `partId`, focus attributes |
| `add-collections` | static item parts (commit-time registration, document order), keys, `textValue` |
| `add-link` | `link-navigation`: `linkProps`, `Router`, disabled / current / routing rules, shared link data attributes; `link` theme family (its request 2) |
| `add-menu` | the consumer's `Menu` in `Ellipsis` (link items, close on same-tab activation) and `getMenu` for the contract's `followCollapsed` |
| `add-theme-system` | stylesheet convention |

## Goals / Non-Goals

**Goals:**
- No machine, no effects: a trail is derived data.
- Reado's segment-as-menu-trigger bar migrates with no special case.

**Non-Goals:**
- Width measurement (Non-goal in the proposal).
- Any change to Link or Menu behaviour.

## Decisions

### 1. No machine

There are no events. "Current" and "collapsed" are pure functions of props and the
collection. The docs generator marks the component `stateless: true`, as for Separator and
Link.

### 2. Derivation (`breadcrumbs.connect.ts`)

```ts
interface BreadcrumbsInput {
  items: readonly { key: Key; current?: boolean; disabled?: boolean; href?: Href; textValue: string; routerOptions?: RouterOptions }[]
  maxItems?: number; itemsBeforeCollapse?: number; itemsAfterCollapse?: number
  currentValue?: "page" | "location" | "date" | "time" | true
}
function deriveTrail(input): { currentKey: Key | null; collapsed: readonly Key[]; ellipsisAfter: Key | null }
```

- `currentKey` is the first item with `current === true`. Otherwise it is the last item,
  unless that item has `current === false`.
- Collapse:
  - `before = itemsBeforeCollapse ?? 1`, `after = itemsAfterCollapse ?? 1`;
  - collapse when `maxItems !== undefined && n > maxItems && n - before - after >= 2`;
  - the collapsed range is `[before, n - after)`, with the current key removed (if
    removing it splits the range, the range ends before it);
  - `ellipsisAfter` is the key of item `before - 1`.
- Item parts read `deriveTrail` through a selector (react-adapter per-part
  subscriptions), so only Items whose flags change re-render.

### 3. Current item without `href`

`Link` calls `linkProps` only when the Item has an `href`, or when the Item is not current.
In that case `disabled` comes from the Item. For a current Item without `href`, `Link`
renders `<span aria-current tabindex="-1" data-current>`. It has no press, no hover
handler and no role. Why not a disabled link (RA, Kobalte):

- a disabled link announces "dimmed link" for the page you are on;
- removing its `tabIndex` while focused drops focus (react-spectrum#2592);
- press handling left `user-select: none` behind (react-spectrum#5549).

`tabindex="-1"` keeps a focused crumb focused when it becomes current, because the
element is the same node (keys are stable) and is still focusable. It also keeps it
reachable by TalkBack.

### 4. Separators

`Separator` is `<span aria-hidden="true" data-part="separator">`. connect knows from the
trail whether its Item is the last visible one and sets `data-last`.
`separatorProps({ decorative: true })` from add-separator yields `role="none"`, which keeps
text glyphs in the accessibility tree. A breadcrumb separator is a glyph, so it uses
`aria-hidden`. The theme may instead draw separators with CSS (`li + li::before`, `content:
"/" / ""`). The docs show both.

### 5. Ellipsis and Menu composition

```tsx
<Breadcrumbs.Ellipsis>
  {({ items, label }) => (
    <Menu.Root>
      <Menu.Trigger aria-label={label}>…</Menu.Trigger>
      <Menu.Positioner><Menu.Content>
        {items.map((i) => <Menu.Item key={i.key} render={<a href={i.href} />}>{i.textValue}</Menu.Item>)}
      </Menu.Content></Menu.Positioner>
    </Menu.Root>
  )}
</Breadcrumbs.Ellipsis>
```

Breadcrumbs ships no menu of its own. The Ellipsis `li` exists only while items are
collapsed. Collapsed Items keep rendering, with `hidden`, so their keys, refs and
`textValue` stay registered. Routing of the menu's link items is add-menu's ("Link Items",
plus add-link request 4 when applied).

### 6. Server render

Static item parts register at commit (add-collections), so with static Items the server
render and the first client render show every Item uncollapsed. Collapse then applies in
the first commit. There is no hydration mismatch, because the first client render equals
the server render. There is a layout change after hydration, though. A data-driven `items`
prop (the collection model's data form) gives the count during render: with it, server
and client collapse identically. The docs recommend `items` whenever `maxItems` is used
with SSR.

### 7. Contract

```ts
export const breadcrumbsContract = contract("breadcrumbs", {
  anatomy: ["root", "list", "item", "link", "separator", "ellipsis"],
  locate: { part: "root", role: "navigation", name: true },
  actions: {
    follow: { pointer: ({ part }, name: string) => part("link", { name }).click(), keyboard: …focus + Enter, done: ({ env }) => env.navigated() },
    openCollapsed: { pointer: ({ part }) => part("ellipsis").find({ role: "button" }).click(), keyboard: …Enter, done: ({ env }) => getMenu(env, …).isOpen() },
    followCollapsed: { pointer/keyboard: openCollapsed + menu.choose(name), done: navigated },
  },
  queries: { items, current, collapsedCount, href },
  traits: [],
  invariants: [separatorsHidden, singleCurrent, listChildrenAreCrumbs],
})
```

`env.navigated()` is add-link's fake-router hook.

### 8. Theme (`packages/theme/src/breadcrumbs.css`)

- Tier-3 tokens: `--rind-breadcrumbs-gap`, `-color`, `-current-color`, `-current-weight`,
  `-separator-color`, `-separator-size` and `-min-target`. They default to `--rind-link-*`
  and semantic tokens.
- Layout: `ol` as an inline flex that wraps, list style reset.
- `[data-last]` separator hidden.
- `[dir=rtl]` mirrors chevron separators.
- Links meet the 24 px target height.
- Current item: weight, not colour alone.
- Forced colors: `LinkText`, and `CanvasText` for the current item.
- Family: `link` (add-link request 2). Breadcrumbs adds no row.

### 9. Shared modules used

From `core/collection`: static item parts and `textValue`. From `core/dom`: `link`
(add-link). The i18n `plural` helper. No overlay or positioning module: the consumer's Menu
brings those.

## Requests to other changes

None new. Breadcrumbs relies on add-link's request 2 (the `link` theme family row) and,
for client routing of plain `<a>` menu items in the ellipsis menu, on add-link's optional
request 4 to add-menu. Until request 4 is applied, consumers render their router's Link in
`Menu.Item render`, which add-menu already supports ("Client router link").

## Risks / Trade-offs

- [Static items collapse after the first commit] → §6; the data-driven `items` prop avoids
  it.
- [The current item may not be a link, unlike APG's example] → the APG requires
  `aria-current` on the current item, not that it is a link. A `href` keeps it a link.
- [Reado's trail has no links] → items are controls in a `nav` list. This is valid, and the
  research note records it as the migration shape.

## Open Questions

- Width-based `collapse="auto"`, reusing a shared overflow-measurement module if Toolbar or
  Tabs overflow ever needs one.
- Should the theme's default separator be CSS-drawn, so trails without a `Separator` part
  still show one?
