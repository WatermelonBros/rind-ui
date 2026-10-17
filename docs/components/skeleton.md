# Skeleton

Placeholder shapes for content that is still loading. The loading state is exposed once for
the whole area: the region is busy, the placeholders are hidden from assistive technology and
unreachable by Tab, a visually hidden "Loading" text sits outside the region, and the shimmer
stops for users who prefer reduced motion.

```tsx
import { Skeleton } from "@rind-ui/react"

<Skeleton.Root loading={!comments}>
  <Skeleton.Status />
  <Skeleton.Content render={<ul />}>
    {comments ? comments.map((c) => <li key={c.id}>{c.text}</li>) : (
      <>
        <li><Skeleton.Item /></li>
        <li><Skeleton.Item /></li>
      </>
    )}
  </Skeleton.Content>
</Skeleton.Root>
```

## API

<!-- api:skeleton -->

## One loading area, many placeholders

A screen reader should hear "Loading" once for a region, not "group, group, group" for each
grey box. So the ARIA lives on the parts that stand for the area, never on the shapes:

- **Content** is the region: `aria-busy="true"` while loading, nothing when loaded. Render it
  as the list or table it is (`render={<ul />}`) so the busy flag is on that element.
- **Item** is a shape: `aria-hidden="true"` while loading, plus `inert` when it wraps stale
  content, so a stale button is not in the Tab order. It never has a role.
- **Root** holds the state and carries no ARIA of its own.

## Where the loading text goes

`aria-busy` is a hint, and some screen readers skip a busy element's content entirely. The
Status text therefore sits **outside** Content (a development warning says so if it is placed
inside). It is visually hidden and not a live region: a user reading through the page finds
"Loading" where the content will be. Its children replace the default text
(`<Skeleton.Status>Loading comments</Skeleton.Status>`).

## Announcing completion

By default a Skeleton is silent when loading finishes: the content simply appears where the
user was reading. When the end of a load is worth saying (a user waited on it),
`announceOnLoad` makes one polite announcement through the Announcer on `loading → loaded`
(`true` for `messages.loaded`, "Loaded", or your own text). It never announces when it mounts
already loaded or when it starts loading again.

## Progress or Skeleton

A Skeleton says "something is coming here". When you know how far along a load is, use a
Progress bar and reference it from the region with `aria-describedby`.

## Motion

The core runs no animation: loading Items carry `data-animate` (drop it with
`animate={false}` on the Root or an Item). The theme's shimmer runs only under
`prefers-reduced-motion: no-preference`, sweeps no faster than 1.5 s, stops on load, and is in
phase across the page because every Item shares one fixed background.

## Coming from another Skeleton component

| Elsewhere | rind-ui |
|---|---|
| `<Skeleton visible>` | `<Skeleton.Root loading>` + `<Skeleton.Item>` |
| `width`, `height`, `circle`, `radius` | CSS on the Item; `--rind-skeleton-radius: 9999px` for a circle |
| `variant="text"` | an Item wrapping the text (one shape per line) |
| `isLoaded` | `loading={!isLoaded}` |

## Styling

Style it through the data attributes above, or import `@rind-ui/theme/skeleton.css`
(family `decoration`: no variant, size or tone). Tokens: `--rind-skeleton-bg`,
`--rind-skeleton-highlight`, `--rind-skeleton-radius`, `--rind-skeleton-line-height`,
`--rind-skeleton-duration`. An empty Item is a full-width line; an Item over stale text keeps
the text's size with transparent text, so the loaded content does not shift the layout. Under
forced colors every placeholder is filled with `GrayText`.

## Testing

```tsx
import { getSkeleton } from "@rind-ui/testing"

const s = getSkeleton(screen, { within: screen.getByRole("region", { name: "Comments" }) })
await s.isLoading() // true
await s.statusText() // "Loading"
await s.announcements() // what announceOnLoad said since the driver was created
```

The same test runs with a Playwright `page`.

## Tested with

<!-- tested-with:skeleton -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
