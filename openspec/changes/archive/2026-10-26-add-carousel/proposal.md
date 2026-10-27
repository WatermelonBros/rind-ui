## Why

A row of slides scrolled one page at a time: product images, onboarding steps, testimonials.
Embla, Swiper, Zag/Ark and others ship it with a recurring list of failures: autoplay on by
default with no way to stop it (WCAG 2.2.2), hidden slides still focusable, a live region that
speaks every autoplay advance, indicators as one tab stop each, mouse-drag emulation fighting
native scrolling, timers that drift in a background tab. rind-ui has the clock, scheduler,
visibility, motion and announcer capabilities to do it on native scroll snap.

Research: [carousel](../../../docs/research/carousel.md) · [tabs](../../../docs/research/tabs.md) ·
[timer](../../../docs/research/timer.md)

Depends on: `add-tabs` (roving indicators), `add-timer` (clock-derived time), `add-theme-system`.

## What Changes

- A public **Carousel** in `@rind-ui/core` and every framework package: parts `Root`, `Viewport`,
  `Slide`, `Control`, `PrevTrigger`, `NextTrigger`, `IndicatorGroup`, `Indicator`,
  `AutoplayTrigger`, `Status`.
- Pages over slides (`slidesPerPage`, `slidesPerMove`, `loop`); the Viewport scrolls with native
  scroll snap, the machine requests a page and learns where the scroll settled.
- Autoplay off by default; when on, a required stop control, paused while hovered, stopped by
  focus or a user action restarts its delay, paused while the page is hidden, never with reduced
  motion; the delay measured on the injected clock.
- `getCarousel` driver, `carousel.css`, site example, docs page.

## Capabilities

### New Capabilities

- `carousel`: anatomy, pages, navigation, scrolling, autoplay, slide visibility, indicators,
  announcements, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Seamless infinite loop (clones), fades or other transitions, thumbnails as indicators,
  free-scroll without snap, video handling, mouse-drag emulation.

## Impact

- New: `packages/core/src/components/carousel/`, framework parts, driver, theme file, site example
  and skin, `docs/components/carousel.md`.
- Modified: `families.ts` (`carousel` in `decoration`).
