# Aspect Ratio

There is no `AspectRatio` component to import: put the native CSS `aspect-ratio` property on the element itself (`<div style={{ aspectRatio: "16 / 9" }}>`), with no wrapper. This page is the recipe that replaces Radix, Reka and Bits' `AspectRatio.Root`.

```tsx
<div style={{ aspectRatio: "16 / 9", inlineSize: "100%" }}>…</div>
```

Aspect Ratio is a recipe: no part, no state, no contract, no driver, no stylesheet. The
component other libraries ship exists only because CSS once had no ratio property; it wraps
the content in a `padding-bottom` box and positions it absolutely, which breaks in flex rows
(chakra-ui#2582), clips text at zoom, restyles its children (chakra-ui#5343, #4347) and
breaks framework image components (chakra-ui#10290). `aspect-ratio` (Chrome 88, Firefox 89,
Safari 15) does the job in one declaration without any of that.

## A ratio box

Set the property on the element that should keep the ratio, and give it a width; the
height follows.

```css
.video-slot {
  aspect-ratio: 16 / 9;
  inline-size: 100%;
}
```

The element is an ordinary box: it works in block flow, in a flex row and in a grid cell,
and you style it like any other element.

## Media inside a ratio box

Put the ratio and the fit on the media itself. `object-fit` is the image's own CSS:
`cover` crops to fill the box, `contain` letterboxes.

```css
.thumbnail {
  aspect-ratio: 1;
  inline-size: 100%;
  object-fit: cover;
}
```

## Images before they load

The `width` and `height` attributes give an `img` (or `video`, `iframe`) its ratio before
its bytes arrive (the browser's own `aspect-ratio: auto w / h`), so the page does not shift
when it loads. Keep them, and let CSS scale the image:

```tsx
<img src={src} alt="Lake and hills" width={400} height={200} style={{ inlineSize: "100%", blockSize: "auto" }} />
```

## Embeds keep their names

A ratio box adds no semantics; its content carries them. An `iframe` needs a `title`, a
`video` a name and captions:

```tsx
<iframe title="Map of the office" src={url} style={{ aspectRatio: "16 / 9", inlineSize: "100%" }} />
<video aria-label="Product tour" controls style={{ aspectRatio: "16 / 9", inlineSize: "100%" }}>
  <track kind="captions" srcLang="en" label="English" src={captions} />
</video>
```

## Image

The Image component's stylesheet reads its own ratio token,
`--rind-image-aspect-ratio`: set it on the Image root instead of wrapping the Image in a
ratio box.

## Zoom and reflow

`aspect-ratio` is a *preferred* ratio: when the content needs more height (text at 200 %
zoom, a longer translation, captions) the box grows instead of clipping it, which WCAG
1.4.4 and 1.4.10 require. The padding technique cannot grow: its content is absolutely
positioned, so text overflows or is cut off. If a box must never grow (a video slot),
put only media in it.

## Migrating from Radix, Reka and Bits

| Before | After |
|---|---|
| `<AspectRatio.Root ratio={16 / 9}>children</AspectRatio.Root>` | `<div style={{ aspectRatio: "16 / 9" }}>children</div>` |
| `<AspectRatio.Root ratio={1} asChild><img … /></AspectRatio.Root>` | `<img style={{ aspectRatio: "1" }} … />`: the property on the child element itself |
| Reka `<AspectRatio :ratio="4 / 3">` | `<div style="aspect-ratio: 4 / 3">` |
| Bits `<AspectRatio.Root ratio={4 / 3}>` and its `child` snippet | `<div style="aspect-ratio: 4 / 3">`, or the property on the snippet's element |
| `position: absolute; inset: 0` on the children | Remove it: the children are in normal flow |
| `[data-radix-aspect-ratio-wrapper]` styles | Move them to the element itself; there is no wrapper |

## Testing

There is nothing to drive. The examples on this page are checked in real browsers: the
box's height is its width divided by the ratio, in block flow and in a flex row, at two
widths, and a square card whose text overflows at 200 % zoom grows taller instead of
clipping (`packages/testing/src/components/aspect-ratio.browser.test.tsx`).
