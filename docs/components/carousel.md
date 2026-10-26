# Carousel

Slides in a scroll-snap Viewport, grouped into pages. Prev and Next move a page, indicators jump to one, and scrolling or swiping natively settles the page. Optional autoplay pauses on hover and while the page is hidden, and stops for good when focus moves in. Slides off the current page are inert, so Tab never reaches a hidden link.

## When to use

- **Use it for** a set of peer items where seeing a few at a time is enough: product images, testimonials, a "related" row.
- **Over a home-made slider**: the Viewport is real scroll snapping (touch, trackpad and keyboard scrolling just work), off-page slides are `inert` and `aria-hidden`, a user's page change is announced ("Slide 3 of 6") while autoplay never is, Prev and Next stay focusable at the ends (`aria-disabled`), indicators are one tab stop with arrow keys, and autoplay stops as soon as someone tabs in.
- **Don't use it for** content everyone must read (put it on the page), or for paging through a long list (a list with [Pagination](pagination.md)).

```tsx
import { Carousel } from "@rind-ui/react"

<Carousel.Root aria-label="Featured products" slidesPerPage={2} spacing="1rem">
  <Carousel.Viewport>
    {products.map((p, i) => (
      <Carousel.Slide key={p.id} index={i}>
        <ProductCard product={p} />
      </Carousel.Slide>
    ))}
  </Carousel.Viewport>
  <Carousel.Control>
    <Carousel.PrevTrigger>‹</Carousel.PrevTrigger>
    <Carousel.NextTrigger>›</Carousel.NextTrigger>
  </Carousel.Control>
  <Carousel.IndicatorGroup>
    {({ pages }) =>
      Array.from({ length: pages }, (_, p) => p).map((p) => <Carousel.Indicator key={p} index={p} />)
    }
  </Carousel.IndicatorGroup>
  <Carousel.Status />
</Carousel.Root>
```

Name the Root with `aria-label` or `aria-labelledby`. Pass `slideCount` when the server renders indicators (slides register on the client).

## API

<!-- api:carousel -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Carousel.Root` | `root` | `<section role="region">`, `aria-roledescription="carousel"`; sets `--rind-carousel-slides-per-page`, `--rind-carousel-spacing`, `--rind-carousel-delay`, `--rind-carousel-page`, `--rind-carousel-pages`. |
| `Carousel.Viewport` | `viewport` | `<div>`; the scroll-snap container. |
| `Carousel.Slide` | `slide` | `<div role="group">` named "2 of 6" (`index`); off the current page it is `inert`. |
| `Carousel.Control` | `control` | `<div>`; lays out the triggers. |
| `Carousel.PrevTrigger` | `prev-trigger` | `<button>` "Previous slide". |
| `Carousel.NextTrigger` | `next-trigger` | `<button>` "Next slide". |
| `Carousel.IndicatorGroup` | `indicator-group` | `<div role="tablist">`; `children` may be a function of `{ page, pages }`. |
| `Carousel.Indicator` | `indicator` | `<button role="tab">` for one page (`index`). |
| `Carousel.AutoplayTrigger` | `autoplay-trigger` | `<button>` "Stop automatic slide show" or "Start automatic slide show". |
| `Carousel.Status` | `status` | `<span>` "3 / 6" (hidden from assistive technology). |

## Autoplay

`autoplay` starts playing on mount (not under reduced motion). Every `autoplayDelay` ms (5000) it moves to the next page; at the last page without `loop` it stops. The pointer over the Root pauses it (`pauseOnHover`), as does a hidden page; it plays on when neither holds. Focus moving into the Root stops it for good: someone who tabbed in is reading. Render an `AutoplayTrigger` with it (WCAG 2.2.2): it stops and starts the slide show, and pressing it does not count as focus moving in. `data-autoplay` on the Root is `off`, `playing` or `paused`.

## Keyboard

| Key | Action |
|---|---|
| Tab | Prev, Next, the current indicator, the autoplay control and the current page's content; never an off-page slide. |
| Enter, Space | On Prev, Next or the autoplay control: press it. |
| Arrow Right, Arrow Left | On an indicator: the next or previous page, wrapping; the focus follows. Mirrored in right-to-left layouts. |
| Arrow Down, Arrow Up | The same with `orientation="vertical"`. |
| Home, End | On an indicator: the first or last page. |

## Accessibility notes

- **A named region** with `aria-roledescription="carousel"`; each slide a `group` with `aria-roledescription="slide"` and a name like "3 of 6".
- **Hidden means unreachable**: off-page slides are `inert` and `aria-hidden`, decided from the page, not measured.
- **Announcements**: a user's page change is announced politely ("Slide 3 of 6"); autoplay advances and scrolling are not.
- **At the ends** Prev and Next keep focus and are `aria-disabled`, so focus never drops to the page.
- **Motion**: reduced motion turns off autoplay and smooth scrolling.

## Testing

```tsx
import { getCarousel } from "@rind-ui/testing"

render(<FeaturedProducts />)
const carousel = getCarousel(screen, { name: "Featured products" })
await carousel.next()
expect(await carousel.page()).toBe(1)
await carousel.via("keyboard").goTo(3)
expect(await carousel.statusText()).toBe("4 / 4")
```

Contract actions: `next`, `prev`, `goTo`, `play`, `pause`. Queries: `page`, `pageCount`, `isPlaying`, `statusText`.

## Tested with

<!-- tested-with:carousel -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
