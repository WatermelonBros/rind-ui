# Image

A content image with a fallback for while it is missing, loading or broken. It keeps one
accessible name, its `alt`, in every status, makes `alt` a decision you cannot skip, and
leaves every native image feature (lazy loading, `srcSet`, framework image components) to
the one `<img>` it renders.

```tsx
import { Image } from "@rind-ui/react"

<Image.Root alt="A red bicycle">
  <Image.Img src={photo.url} />
  <Image.Fallback>Image unavailable</Image.Fallback>
</Image.Root>
```

## API

<!-- api:image -->

## Writing `alt`

`alt` sits on Root and is a required `string`: a missing text alternative does not compile.
Describe what the image shows in its context ("A red bicycle leaning on a yellow wall"), not
that it is an image. Pass `alt=""` when the image is decorative (the text next to it already
says everything): nothing of the image is exposed, in any status, and Root carries
`data-decorative`.

rind-ui never defaults to `alt=""`. An untyped caller that omits `alt` gets a development
error, and the `<img>` is rendered without an `alt` attribute so automated checks (axe's
`image-alt`) report it.

## One name in every status

| Status | Named element | The `<img>` | Fallback |
|---|---|---|---|
| `idle` (no `src`/`srcSet`) | Root: `role="img"`, `aria-label={alt}` | `hidden`, no `src` | shown, `aria-hidden` |
| `loading` | the `<img>`, by its `alt` | shown (lazy loading works) | after `fallbackDelay`, `aria-hidden` |
| `loaded` | the `<img>`, by its `alt` | shown | not rendered |
| `error` | Root: `role="img"`, `aria-label={alt}` | `hidden` | shown, `aria-hidden` |

While the image is there the native `<img alt>` carries the name (it is translated with the
page and a `<figure>` associates it). When there is nothing to show, Root takes over with the
same text, so a screen reader resting on it keeps hearing the same name, and the Fallback's
own text ("Image unavailable", an icon) is never read in its place. A source-less or broken
`<img>` is `hidden`, so it never draws its alt text or a broken-image glyph.

## Fallback timing

The same rules as [Avatar](avatar.md): a missing source or an error shows the Fallback at
once; `fallbackDelay` (milliseconds) holds it back only while the image is loading, so a fast
image never flashes it, and once shown the delay never hides it again. With
`fallbackDelay > 0` the server HTML has no Fallback (the delay is a client setting).

`data-state` is on every part, so one stylesheet can draw a different Fallback per status:

```css
[data-scope="image"][data-part="fallback"][data-state="loading"] { /* a shimmer */ }
[data-scope="image"][data-part="fallback"][data-state="error"] { /* an icon */ }
```

A [Skeleton](skeleton.md) `Item` inside the Fallback is a silent shape: the Image keeps the
name.

## Lazy loading and framework image components

The rendered `<img>` is the only loader: there is no hidden probe, so every attribute you pass
to `Image.Img` (`loading`, `decoding`, `fetchPriority`, `srcSet`, `sizes`, `width`, `height`,
`referrerPolicy`, `crossOrigin`) reaches the one request the browser makes, and `src` is set
after `srcSet`, `sizes` and `loading`. Image does not default `loading`: the browser's default
applies, and `loading="lazy"` still shows the Fallback until the image arrives. A server-rendered
image already in the cache is `loaded` in the first snapshot after hydration, with no fallback
frame.

A framework image component goes through `render`; it receives the ref, `alt`, `hidden`, the
`data-*` attributes and the load handlers:

```tsx
<Image.Root alt="A red bicycle">
  <Image.Img
    src={photo.url}
    render={(props) => <NextImage {...props} width={640} height={360} />}
  />
</Image.Root>
```

To retry a failed image, change its `src` (a query parameter is enough): the status goes back to
`loading`.

## Ratio box and `object-fit`

Root keeps its box in every status: the theme stacks the `<img>` and the Fallback in one grid
cell, so a failed image leaves the Fallback in the same area and nothing shifts. Set the ratio
with `--rind-image-aspect-ratio` (default `auto`: Root follows the image) and the fit with
`--rind-image-fit` (default `cover`):

```tsx
<Image.Root alt="A red bicycle" style={{ "--rind-image-aspect-ratio": "16 / 9", "--rind-image-fit": "contain" }}>
  <Image.Img src={photo.url} />
</Image.Root>
```

Without the theme, the same three rules do it: Root `display: grid`, the `<img>` and Fallback
`grid-area: 1 / 1`, and an `aspect-ratio` on Root. See [Aspect Ratio](aspect-ratio.md).

## Figures and long descriptions

Inside a `<figure>`, `alt` describes the image and the `<figcaption>` adds to it; do not repeat
the caption in `alt`. A chart or a diagram that needs more than a sentence keeps a short `alt`
and links or refers to its long description (`aria-describedby` on Root pointing at text on
the page).

## Art direction with `<picture>`

`Image.Img` renders the `<img>`; wrap it in your own `<picture>` with `<source>` elements:

```tsx
<Image.Root alt="A red bicycle">
  <picture>
    <source media="(min-width: 60rem)" srcSet={wide} />
    <Image.Img src={narrow} />
  </picture>
</Image.Root>
```

## Image or Avatar

Image is a content image: its `alt` describes what it shows, and the name moves to Root only
when there is nothing to show. [Avatar](avatar.md) is a person or entity: Root is always the
named `role="img"` (the person's name) and its image is presentational. Both share the same
loading status machine.

## Coming from another Image component

`Image.Img alt` moves to `Image.Root alt`; `onLoadingStatusChange` becomes `onStatusChange` on
Root; `fallbackDelay` is on Root.

## Testing

```tsx
import { getImage } from "@rind-ui/testing"

render(<Product />)
const bike = getImage(screen, { name: "A red bicycle" })
await bike.waitForStatus("error")
await bike.isFallbackVisible() // true
await bike.name() // "A red bicycle"
```

The same driver keeps locating the image when the name moves from the `<img>` to Root. A
decorative image is found inside a container: `getImage(screen, { within: row })`. jsdom never
loads images, so statuses beyond `idle` need a real browser (Vitest browser mode or Playwright,
where the same test runs with a `page`).

## Tested with

<!-- tested-with:image -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
