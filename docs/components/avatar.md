# Avatar

A person or an entity shown as an image, with a fallback (initials, an icon) while the image
is missing, loading or broken. The avatar has one accessible name in every status, and the
rendered `<img>` is the only thing that loads the image.

```tsx
import { Avatar } from "@rind-ui/react"

<Avatar.Root aria-label="Ada Lovelace">
  <Avatar.Image src={user.photoUrl} />
  <Avatar.Fallback>AL</Avatar.Fallback>
</Avatar.Root>
```

## API

<!-- api:avatar -->

## Named or decorative

Name the **Root**, not the image: `aria-label` (or `aria-labelledby`) gives it `role="img"`,
and everything inside it (the `<img>`, the initials) is presentational. The `<img>` renders
`alt=""`, so the name is the same while the image loads, after it loads and after it fails.
Use the person's full name, never the initials: "AL" read aloud is noise.

When the avatar sits beside the person's visible name (a comment, a message, a list row), it
adds nothing for assistive technology: mark it decorative with `aria-hidden="true"`, and the
name is read once, from the text.

```tsx
<p>
  <Avatar.Root aria-hidden="true">
    <Avatar.Image src={url} />
    <Avatar.Fallback>AL</Avatar.Fallback>
  </Avatar.Root>
  Ada Lovelace
</p>
```

An avatar with neither a name nor `aria-hidden` logs a development error. Inside a button or
link, the button takes its name from the avatar's (`<button><Avatar.Root aria-label="Ada
Lovelace">…</button>` is the button "Ada Lovelace").

## Statuses and the fallback

The status is `idle` (no image, or no `src`/`srcSet`), `loading`, `loaded` or `error`, read
from the rendered `<img>`. It is observed, not controlled: `onStatusChange(status, { reason })`
on Root reports every change. Root, Image and Fallback carry `data-state` with it, so one
Fallback can show different content for a missing and a broken image:

```css
[data-scope="avatar"][data-part="fallback"][data-state="error"] .initials { display: none; }
```

The Fallback is rendered while the status is not `loaded`, and unmounted once it is, so a
transparent image never shows initials through it.

- **No image or a broken one**: the Fallback shows at once.
- **Loading**: the Fallback shows at once too, unless Root's `fallbackDelay` (ms) asks it to
  wait. The delay only applies to `loading`; once the Fallback has been shown, a later source
  change never hides it again.

With the theme, the image is stacked over the Fallback in the same box: a cached or
server-rendered image paints over the Fallback as its bytes arrive, so you rarely need a
delay.

## Server rendering

The server HTML contains the `<img>` with its `src`, so the browser fetches it (and uses a
`<link rel="preload">`) before React hydrates. When the image is registered — on hydration
and on every source change — its `complete` and `naturalWidth` are read, so an image that
loaded before hydration starts as `loaded` and the Fallback never flashes. An image that is
complete but has no natural width (some SVGs) is settled with `decode()`.

With `fallbackDelay` 0 (the default), the server HTML has both the image and the Fallback.
With a delay, the Fallback is client-only: the server HTML has none.

## Lazy loading and framework image components

The `<img>` is never hidden while loading (`hidden` only with no source and after an error),
so `loading="lazy"`, `decoding`, `fetchPriority`, `srcSet`/`sizes`, `referrerPolicy` and
`crossOrigin` all work: they are attributes of the one request the browser makes. `src` is
written after `srcSet`, `sizes` and `loading`.

A framework image component goes through `render`; it receives the ref, `alt`, `hidden`,
`data-*` and the `onLoad`/`onError` handlers, and is fetched once:

```tsx
<Avatar.Root aria-label="Ada Lovelace">
  <Avatar.Image src={url} render={(props) => <NextImage {...props} width={40} height={40} />} />
  <Avatar.Fallback>AL</Avatar.Fallback>
</Avatar.Root>
```

Your own `onLoad` and `onError` run too.

## Retrying

There is no retry policy: give the Image a new `src` (for example with a query parameter) and
the status goes back to `loading`. Removing the `src` or unmounting the Image returns it to
`idle` and brings the Fallback back.

## Initials

There is no initials helper: names vary too much. Take grapheme clusters, not code units, so
an emoji or a combining character is never cut in half:

```ts
const initials = (name: string, locale = "en") => {
  const seg = new Intl.Segmenter(locale, { granularity: "grapheme" })
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => seg.segment(word)[Symbol.iterator]().next().value?.segment ?? "")
    .join("")
    .toLocaleUpperCase(locale)
}
```

## Group

`Avatar.Group` is a named `role="group"`; it keeps no state and chooses no avatars. Render the
avatars you want to show and the count of the rest in `Avatar.GroupOverflow`: "+4" is visible
and hidden from assistive technology, "4 more" is visually hidden. Translate it with the
`overflowLabel` message (per instance with `messages`, or for a tree with the provider's
`messages.avatar`).

```tsx
<Avatar.Group aria-label="Reviewers">
  {shown.map((p) => (
    <Avatar.Root key={p.id} aria-label={p.name}>
      <Avatar.Image src={p.photo} />
      <Avatar.Fallback>{initials(p.name)}</Avatar.Fallback>
    </Avatar.Root>
  ))}
  <Avatar.GroupOverflow count={rest.length} />
</Avatar.Group>
```

An interactive overflow ("show all") is a `render={<button />}` on GroupOverflow, named "4
more", composed with a Popover.

## Styling

The theme (family `identity`: `data-variant` `soft` (default), `solid`, `outline`;
`data-size` `sm`, `md`, `lg`; `data-tone`) reads `--rind-avatar-*` tokens: `size`, `radius`,
`bg`, `text`, `border`, `font-size`, `font-weight`, `ring`, `ring-width`, `group-overlap`,
`overflow-bg`, `overflow-text`. Under forced colors the Fallback keeps a `CanvasText` border.

Without the theme, image and fallback sit side by side while loading; stack them yourself:

```css
[data-scope="avatar"][data-part="root"] { display: inline-grid; }
[data-scope="avatar"][data-part="root"] > * { grid-area: 1 / 1; }
[data-scope="avatar"][data-part="image"] { z-index: 1; }
```

Never hide the loading image with `display: none`: a lazy image would never load.

## Coming from Radix or Base UI

- `delayMs` / `delay` on Fallback → `fallbackDelay` on Root (and it no longer delays a missing
  or broken image).
- `onLoadingStatusChange` on Image → `onStatusChange` on Root.
- `alt` on Image → `aria-label` on Root.

## Testing

```tsx
import { getAvatar } from "@rind-ui/testing"

render(<Profile />)
const ada = getAvatar(screen, { name: "Ada Lovelace" })
await ada.waitForStatus("loaded")
await ada.isFallbackVisible() // false
```

A decorative avatar is found inside a container: `getAvatar(screen, { within: row })`. jsdom
never loads images, so statuses beyond `idle` need a real browser (Vitest browser mode or
Playwright, where the same test runs with a `page`).

## Tested with

<!-- tested-with:avatar -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
