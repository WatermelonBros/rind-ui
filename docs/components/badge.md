# Badge

A small piece of static status text: a count, a label, a dot. It is never interactive and
never a live region; its meaning reaches assistive technology through the control it sits
on.

## When to use

- **Use it for** a small static piece of status text: a count, a label such as "Beta", or an unread
  dot.
- **Over a plain `<span>`**: with `label` it gives a short visual text (like "99+") a full spoken
  name, and warns in development when an exposed badge has no text. Without a label, a `<span>` is
  enough.
- **Don't use it for** anything interactive or live: use [Button](button.md) or [Toggle Group](toggle-group.md)
  for actions, and [Alert](alert.md) for a message that must be announced.

```tsx
import { Badge } from "@rind-ui/react"

<Badge.Root>Beta</Badge.Root>
<Badge.Root label="more than 99 notifications">99+</Badge.Root>
```

Badge is stateless: it has no machine.

## API

<!-- api:badge -->
### Anatomy

| Part | `data-part` | Element | Description |
|---|---|---|---|
| `Badge.Root` | `root` | `<span>` | The badge: no role, never a live region, never focusable. |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | — | The text assistive technology gets: the visible content is hidden from it and the label rendered visually hidden. |
| `id` | `string` | — | Default: generated. A host that keeps an `aria-label` lists it in `aria-describedby`. |
| `render` | `ReactElement \| (props, state) => ReactNode` | — | Another element. |

Every attribute of the rendered element is accepted and forwarded.

### Data attributes

| Part | Attribute | When |
|---|---|---|
| `root` | `data-scope` | "badge" |
| `root` | `data-part` | "root" |
| `root` | `data-instance` | The instance id. |

### States

None: the component is stateless (no machine, no `testMachine`).

### Contract

No actions.

Queries: `text`, `isExposed`. Traits: none.
<!-- /api -->

## What assistive technology hears

Without `label`, the badge's text is exposed as it is. With `label`, the visible content is
wrapped in `aria-hidden="true"` and the label is rendered as visually hidden text: a text
node, so it is translated with the page (an `aria-label` on a `span` is ignored and never
translated).

| Badge | Heard |
|---|---|
| `<Badge.Root>Beta</Badge.Root>` | "Beta" |
| `<Badge.Root label="more than 99 notifications">99+</Badge.Root>` | "more than 99 notifications" |
| `<Badge.Root label="unread messages" />` (a dot) | "unread messages" |
| `<Badge.Root aria-hidden="true">2</Badge.Root>` | nothing |

An exposed badge with no text and no `label` warns in development: pass `label`, or
`aria-hidden="true"` when the host already says it.

## On an icon button

The count must reach the button's accessible name or description. Two ways:

**Name from content (preferred).** No `aria-label` on the host: its name is computed from
its content, badge included, and every word in it is a text node the page translates.
Screen readers also keep the button's hints this way.

```tsx
<Button>
  <VisuallyHidden>Comments</VisuallyHidden>
  <CommentIcon aria-hidden="true" />
  <Badge.Root label="3 unread">3</Badge.Root>
</Button>
// name: "Comments 3 unread"
```

**The host keeps an `aria-label`.** An `aria-label` replaces the content, so the badge is no
longer heard: list the badge's id in the host's `aria-describedby`.

```tsx
<Button aria-label="Comments" aria-describedby="comments-count">
  <CommentIcon aria-hidden="true" />
  <Badge.Root id="comments-count" label="3 unread">3</Badge.Root>
</Button>
// name: "Comments", description: "3 unread"
```

This form keeps the count audible, but the visible "3" is not part of the name, which axe
reports as `label-content-name-mismatch` (WCAG 2.5.3, Label in Name: speech users say what
they see). Prefer name from content; when the host must keep an `aria-label`, the label can
also say the count itself (`aria-label="Sync (2 incoming)"` around a badge "2"), which
satisfies both rules and logs nothing.

In development, after mount, a badge inside a button, link, tab, menu item, option, tree
item, switch or checkbox whose `aria-label`/`aria-labelledby` does not contain the badge's
text, and whose `aria-describedby` does not list the badge, warns naming the host and both
remedies. The check compares attribute text; the browser test suite checks the real name.

## Never a live region

A badge has no role and never `aria-live`: a count that changes does not interrupt the
user. A `role` of `status`, `alert` or `log`, or an `aria-live`, passed to the root is
forwarded and warns in development. When a change is a status message, announce it:

```tsx
const announcer = useEnvironment().announcer
useEffect(() => {
  if (count > previous) announcer.announce({ message: `${count} unread`, priority: "polite" })
}, [count])
```

## Formatting a count

The count and its words are the app's: format with `Intl.NumberFormat` and the app's own
plural messages.

```tsx
const format = new Intl.NumberFormat(locale)
const shown = count > 99 ? `${format.format(99)}+` : format.format(count)
<Badge.Root label={t("unread", { count })}>{shown}</Badge.Root>
```

## Styling

The theme styles the `status` family: `data-variant` `soft` (default), `solid`, `outline`;
`data-size` `sm`, `md`, `lg`; every `data-tone`. The pill is sized in `em`, so longer text
grows it instead of clipping, and it never stretches in a flex or grid parent. Under forced
colors it keeps a 1 px border. Tokens: `--rind-badge-bg`, `--rind-badge-text`,
`--rind-badge-border`, `--rind-badge-radius`, `--rind-badge-height`,
`--rind-badge-padding-inline`, `--rind-badge-font-size`, `--rind-badge-font-weight`.

Positioning on a corner of the host is consumer CSS, with logical properties so it mirrors
in right-to-left:

```css
.icon-button { position: relative; }
.icon-button [data-scope="badge"] {
  position: absolute;
  inset-block-start: -0.25rem;
  inset-inline-end: -0.25rem;
}
```

## Testing

```tsx
import { getBadge } from "@rind-ui/testing"

const badge = getBadge(screen, { within: commentsButton })
expect(await badge.text()).toBe("3 unread")
expect(await badge.isExposed()).toBe(true)
```

`getBadge` takes the one badge inside `within` (or the target); a badge has no role and no
name. When several match, it fails listing every match. The same test runs with a
Playwright `page`.

## Tested with

<!-- tested-with:badge -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
