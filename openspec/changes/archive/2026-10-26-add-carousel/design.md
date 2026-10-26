## Context

Research: [docs/research/carousel.md](../../../docs/research/carousel.md) ("Decisions"). The
machine runtime has no parallel regions: the autoplay is the state, the scroll is context.

## Decisions

### 1. Pages

`slideCount` slides (from the registry; a prop for SSR), `slidesPerPage` (1), `slidesPerMove`
(`"page"` or a number). Pages: `ceil(n / perPage)` for `"page"`, else
`max(1, ceil((n - perPage) / move) + 1)`. A page's first slide: `min(page × move, n − perPage)`.
`page` is controllable (`page`, `defaultPage`, `onPageChange(page, details)`), clamped to the
pages.

### 2. Machine

States `stopped | playing | paused` (autoplay). Context: `pageCount`, `holds` (the reasons a
playing carousel is paused: `hover`, `hidden`, `motion`), `remaining` (ms left of the delay when
paused), `startedAt`, `scrolling`. Events: `GO { page, reason }`, `NEXT { reason }`,
`PREV { reason }`, `SCROLL.START`, `SCROLL.END { page }`, `COUNT { slides }`, `PLAY`, `STOP
{ reason }`, `TOGGLE`, `HOLD { hold }`, `RELEASE { hold }`, `TICK`. Reasons: `trigger`,
`indicator`, `keyboard`, `scroll`, `autoplay`, `api`.

### 3. Navigation

`NEXT`/`PREV` move one page; at an end they do nothing unless `loop`, which wraps. A page change
other than `scroll` asks the parts to scroll the Viewport there (`env.scrollToPage(page,
smooth)`, smooth unless reduced motion). `SCROLL.END { page }` from the parts (the nearest page
to the settled scroll position) sets the page with reason `scroll` and never scrolls back.

### 4. Autoplay

`autoplay` (false) starts `playing` on mount, unless reduced motion (`stopped`). In `playing`
one timeout of the remaining delay (`autoplayDelay`, 5000) is pending; `TICK` goes `NEXT`
(`autoplay`), and at the last page without `loop` stops (reason `end`). Any user navigation in
`playing` restarts the delay. `HOLD hover` and `HOLD hidden` pause (the remaining time kept);
when no hold is left it plays on. Focus moving into the Root stops (`STOP focus`, no resume): a
user who tabbed in is reading. `PLAY`/`STOP`/`TOGGLE` from the AutoplayTrigger or the API.
`onAutoplayChange(playing, { reason })` on every change between stopped and playing.

### 5. Visibility and focus

Slides outside the current page are `inert` and `aria-hidden` (computed from the page, not
measured), so Tab never reaches a hidden slide. The parts may report `inView` from an observer
for `data-inview`.

### 6. Accessibility

Root: `role="region"`, `aria-roledescription="carousel"`, named by `aria-label` or
`aria-labelledby`. Slide: `role="group"`, `aria-roledescription="slide"`, `aria-label` "3 of 6".
Prev/Next: buttons with `aria-controls` the Viewport, `aria-disabled` (still focusable) at an
end without loop. Indicators: a `tablist` of `tab`s, one tab stop (roving), `aria-selected` on
the current page, arrows/Home/End move and select. AutoplayTrigger: a button named "Stop
automatic slide show" or "Start automatic slide show". A user page change is announced politely
("Slide 3 of 6"); autoplay advances are never announced. Status: visible "3 / 6",
`aria-hidden`.

### 7. Attributes

`data-scope="carousel"`, `data-part`, `data-instance`, `data-orientation`; Slide: `data-index`,
`data-current`, `data-inview`; Indicator: `data-index`, `data-current`; Prev/Next:
`data-disabled`; Root and AutoplayTrigger: `data-autoplay` (`off`, `playing`, `paused`);
Viewport: `data-scrolling`. Root CSS variables: `--rind-carousel-slides-per-page`,
`--rind-carousel-spacing`, `--rind-carousel-delay`, `--rind-carousel-page`,
`--rind-carousel-pages`.

### 8. Contract

Locate by the Root's name. Actions `next`, `prev`, `goTo(page)`, `play`, `pause`; queries
`page`, `pageCount`, `isPlaying`, `statusText`.
