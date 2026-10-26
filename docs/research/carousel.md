# Carousel — research

Status: done · Wave: 3

A Carousel shows a set of slides one page at a time (or several per page) in a scrollable strip, with
previous and next buttons, indicators (dots), optionally an autoplay that rotates the slides. Of the
nine libraries only Ark/Zag ships one. The rest of the field is dedicated carousel libraries:
Embla, Swiper, Splide and Slick (React/Vue wrappers are thin). That field is where the bug history
lives, and most of it is accessibility: auto-rotation nobody can stop, slides that are hidden
visually but still tabbable, live regions that read every slide, indicators that add one tab stop
per dot. This note records Zag's design, the four libraries' accessibility work and trackers, the
APG pattern and WCAG 2.2.2, and the decisions for `add-carousel`.

Builds on [accessibility.md](accessibility.md) §4 (focus), §7 (live regions and the Announcer),
§10 (hidden content, `inert`), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
causes A, D, H, [tabs.md](tabs.md) (roving indicators), [timer.md](timer.md) (clock-derived time, the
injected `Clock`, `Scheduler`, `PageVisibility`), [scroll-area.md](scroll-area.md), and
[button.md](button.md). rind-ui's `dom/swipe.ts` (CSS-variable movement, discrete events) and
`dom/item-registry.ts` (slides register themselves) are reused.

Sources read (local shallow clone and raw files, 2026-10-26):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/carousel/src/{carousel.machine,carousel.connect,carousel.dom,carousel.types,carousel.anatomy,carousel.props}.ts`, `CHANGELOG.md` |
| Embla | `embla-carousel-autoplay/src/components/Options.ts`, `embla-carousel-accessibility/src/components/{Options,Accessibility}.ts` (raw from GitHub master; `Accessibility.ts` listed, options read) |
| Splide | `src/js/constants/defaults.ts` (autoplay, pause and live options, grep) |
| Trackers | chakra-ui/zag, chakra-ui/ark, davidjerleke/embla-carousel, nolimits4web/swiper, Splidejs/splide, kenwheeler/slick (searches "carousel", "accessibility", "autoplay"); "title only" marks issues not opened |
| Standards | [APG Carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) and its [prev/next](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/examples/carousel-1-prev-next/) and [tabbed](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/examples/carousel-2-tablist/) examples; [WCAG 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html); CSS scroll snap |

Radix, Base UI, Headless UI, Ariakit, React Aria, Reka UI, Bits UI and Kobalte ship no Carousel
(shadcn/ui's carousel is Embla in a wrapper). Swiper and Slick were read at tracker level only.

## Pattern

- **APG Carousel**: a region labelled by the page, with `aria-roledescription="carousel"`; each slide
  a `group` with `aria-roledescription="slide"` and a name like "3 of 6"; previous and next
  buttons; optional slide picker (the **tabbed** variant: `tablist` / `tab` / `tabpanel`, the
  slides being tab panels with `aria-roledescription="slide"`). Basic carousel keys: Tab reaches
  the controls and the slide's content; Enter/Space on the buttons. Tabbed: arrow keys move
  between tabs.
- **Rotation (APG)**: a carousel that rotates automatically has a rotation control (a play/pause
  button) that is the **first focusable** element in it; rotation stops while the keyboard focus is
  inside, and while the mouse hovers; it **does not restart on its own after keyboard focus leaves**;
  `aria-live` on the slide container is `off` while rotating and `polite` when not (so a user who
  stepped manually hears the slide). All of this from the pattern's own text.
- **WCAG 2.2.2 Pause, Stop, Hide (A)**: moving content that starts automatically, lasts more than
  five seconds and is shown with other content has a mechanism to pause, stop or hide it.
  An autoplay carousel needs the control; hover and focus pausing are extras.
- **WCAG 2.3.3 and `prefers-reduced-motion`**: no autoplay and no smooth scrolling for users who
  asked for less motion.
- **WCAG 2.5.7 Dragging**: swipe is never the only way; buttons and keyboard exist.
- **WCAG 2.5.8**: indicators are small targets; the theme sets the hit area.
- **Native**: CSS scroll snap (`scroll-snap-type`, `scroll-snap-align`, `scroll-padding`) moves,
  snaps and swipes with no JavaScript (touch, trackpad, wheel, keyboard on a scroll container);
  `scrollend` and `IntersectionObserver` report where it stopped. New CSS (`::scroll-button()`,
  `::scroll-marker`, `scrollsnapchange`) is Chromium-only at the time of writing and is not used.

## How the others built it

### Zag / Ark

- **Anatomy**: `root`, `itemGroup` (the scroll container), `item` (`index`), `control`,
  `prevTrigger`, `nextTrigger`, `indicatorGroup`, `indicator` (`index`), `autoplayTrigger`,
  `progressText`.
- **Props**: `slideCount` (required), `page` / `defaultPage` / `onPageChange`, `slidesPerPage`,
  `slidesPerMove` (`"auto"`), `loop` (defaults to `true` when `autoplay` is set), `autoplay:
  boolean | { delay }` (default delay 4000), `allowMouseDrag`, `orientation`, `dir`, `spacing`,
  `padding`, `autoSize`, `snapType` (`mandatory`), `inViewThreshold` (0.6), `translations`
  (`nextTrigger`, `prevTrigger`, `indicator(i)`, `item(i, count)`, `autoplayStart`,
  `autoplayStop`, `progressText`), `onDragStatusChange`, `onAutoplayStatusChange`. API:
  `scrollTo`, `scrollNext`, `scrollPrev`, `scrollToIndex`, `isPlaying`, `isDragging`.
- **Mechanism**: a `display: grid` scroll container with CSS scroll snap; `scrollTo` moves it;
  an `IntersectionObserver` fills `slidesInView`; page snap points come from slide positions
  (`ResizeObserver` and `MutationObserver` refresh them).
- **States**: `idle`, `focus`, `dragging`, `settling`, `userScroll`, `autoplay`. In `focus`, arrow keys
  scroll (`trackKeyboardScroll`).
- **ARIA**: Root `role="region"` `aria-roledescription="carousel"`; slide `role="group"`
  `aria-roledescription="slide"`, `aria-label` from `translations.item`, **`aria-hidden` when not in
  view**; the item group has `aria-live` `off` while playing and `polite` otherwise; prev/next
  have `aria-controls`; the autoplay trigger swaps its `aria-label` (start/stop) and sets
  `data-pressed`. The item group gets `tabindex="0"` only if it has no tabbable descendants
  (`syncTabIndex`), so a scroll container with nothing focusable can still be scrolled by keys.
- **Autoplay**: a `setInterval` in the `autoplay` state sends `AUTOPLAY.TICK`; a hidden document
  sends `AUTOPLAY.PAUSE` and **nothing resumes it** (request zag#3310, closed). The graph has no
  hover or focus pause, and a drag leaves `autoplay` for `dragging` → `settling` → `idle`: after any
  drag, rotation has stopped. The pause button is the only a11y mechanism.
- **Mouse drag** (`allowMouseDrag`) is emulated: `mousedown` on the item group, document pointer
  movement turned into `scrollBy`; it has the largest share of the bug history below.

### Embla (plugins)

- Core is a headless scroller; **Autoplay** plugin options: `delay` (4000), `instant`,
  `defaultInteraction`, `stopOnLastSnap`, `rootNode`. It exposes `play`, `stop`, `reset`, `isPlaying`; **no
  button**.
- **Accessibility** plugin (separate package, opt-in): `announceChanges` (default false: no live
  region unless asked), `carouselAriaLabel`, `carouselAriaRoleDescription` ("carousel"),
  `carouselRole` (`region`), `slideRole` (`group`), `slideAriaRoleDescription` ("slide"),
  `previousButtonAriaLabel`, `nextButtonAriaLabel`, `slideAriaLabel`, `dotButtonAriaLabel` and
  `liveRegionContent` as functions of `(hasAnyGroupedSlides, firstSlideIndex, lastSlideIndex,
  totalSlides, selectedSnapIndex, totalSnaps)`. It marks slides outside the selected snap `aria-hidden`
  and their focusable children `tabindex="-1"`, decided from **snap group membership**, not from
  what is visible.

### Splide

- Defaults read: `pauseOnHover` (true), `pauseOnFocus` (true), `resetProgress` (true), `live`
  (true), `i18n`; its `reducedMotion` defaults set `speed: 0` and `autoplay: 'pause'`, so autoplay is
  paused for users who prefer reduced motion. The source of the pause and play buttons was not read.

### Swiper and Slick (tracker only)

- Swiper has an A11y module and Slick an `accessibility` option; both have long accessibility
  threads (below). Neither was read in source.

## Bug history

| Bug | Where | Cause | Decision |
|---|---|---|---|
| No way to pause autoplay (APG, WCAG 2.2.2) | [zag#2212](https://github.com/chakra-ui/zag/issues/2212) (read), [swiper#7640](https://github.com/nolimits4web/swiper/issues/7640) (read, open), [splide#58](https://github.com/Splidejs/splide/issues/58) (read) | Library offered `autoplay` and no control | `AutoplayTrigger` is part of the component; autoplay defaults **off**; a docs rule and a dev warning when `autoplay` is on and no trigger is mounted. |
| Autoplay never resumes after the tab was hidden | [zag#3310](https://github.com/chakra-ui/zag/issues/3310) (read), closed 2026-09 | A hidden document sent a pause with no matching resume | Hidden is a *reason* that clears itself: hover and visibility pauses resume when the condition ends; a keyboard-focus pause or a user pause does not (APG). |
| Autoplay stops after clicking an indicator | [zag#2595](https://github.com/chakra-ui/zag/issues/2595) (title and template read), closed 2025-07 | Interaction left the `autoplay` state | Interaction **restarts the delay**; it does not end autoplay. Only the user's pause, focus-in and hover pause it. |
| Autoplay ignores `loop: false`; carousel does not react to `slideCount` or `autoplay` changes | [zag#2612](https://github.com/chakra-ui/zag/issues/2612), [#2610](https://github.com/chakra-ui/zag/issues/2610) (titles only), fixed 1.21.2 | `autoplay` forced `loop` | `autoplay` pauses itself at the last page when `loop` is false and reports `onAutoplayChange` (`reason: "end"`). `loop` is independent. |
| Drag stops working after switching tabs, scrolling the page, or a wheel event | [zag#2838](https://github.com/chakra-ui/zag/issues/2838), [#2846](https://github.com/chakra-ui/zag/issues/2846), [#2856](https://github.com/chakra-ui/zag/issues/2856) (#2846 read), fixed 1.28.0 (`event.button` checked instead of `event.buttons`) and 1.29.0 (wheel) | Emulated mouse drag with its own state | **No mouse-drag emulation**: touch, trackpad and wheel scroll natively on the scroll container; the mouse uses buttons, indicators and keys. Removes a whole class (also zag#2994, #3367, [#2344](https://github.com/chakra-ui/zag/issues/2344) titles). |
| `allowMouseDrag` advances a page per pointer move | [zag#3367](https://github.com/chakra-ui/zag/issues/3367) (title only), fixed 1.45.0 | Same emulation | Same. |
| Arrow keys twice freeze the transition | [zag#2382](https://github.com/chakra-ui/zag/issues/2382) (read), closed 2025-05 | A second scroll started mid-animation | A programmatic scroll to a page replaces the previous target; target computed from the page, not from the current scroll offset. |
| Wrong page count inside a Dialog (Portal) | [zag#2993](https://github.com/chakra-ui/zag/issues/2993) (title only), changelog 1.35.3: container observed with a `ResizeObserver` | Layout incomplete at mount | Snap points are measured from the Viewport's size on every resize; nothing is read at mount only. |
| Controlled carousel inside a Dialog jumps or skips | [zag#3008](https://github.com/chakra-ui/zag/issues/3008) (title only), changelog 1.36.0: CSS-transformed containers | `getBoundingClientRect` differences inside a scaling container | Positions come from layout geometry (`offsetLeft`, `scrollLeft`), never from rect deltas. |
| Scroll cut short when something inside a slide changes (lazy images) | [zag#3374](https://github.com/chakra-ui/zag/issues/3374) (read), closed 2026-10 | `MutationObserver` on the subtree re-snapped on every change | Slides register through the item registry; only a change of **snap points** re-aligns, never a content change. |
| Carousel non-functional in RTL; next/prev and indicators reversed | [zag#2909](https://github.com/chakra-ui/zag/issues/2909) (title only), fixed 1.32.0 | Scroll direction and sign not handled | `dir` in the machine; scroll position read through one helper that normalises RTL's sign; browser test per engine. |
| Controlled `page` ignores the last slide | [zag#2607](https://github.com/chakra-ui/zag/issues/2607) (title only), fixed 1.21.1 | Not read | `page` is a controllable clamped to the registered pages, re-clamped when slides register or unregister. |
| Next/prev ignore `slidesPerView` with `loop` | [zag#1447](https://github.com/chakra-ui/zag/issues/1447) (title only), changelog 0.58.3 | Not read | `slidesPerMove` is a page-size rule applied in one function; looping wraps pages, not slides. |
| Seamless looping with drag requested | [zag#3285](https://github.com/chakra-ui/zag/issues/3285) (title only) | Needs cloned slides | Not supported (see Open questions). |
| Hidden slides still visible or focusable; hidden slides decided by snap, not visibility | [embla#1299](https://github.com/davidjerleke/embla-carousel/issues/1299) (read, closed 2026-03), [#1389](https://github.com/davidjerleke/embla-carousel/issues/1389) (read, open) | `aria-hidden` and `tabindex=-1` set from snap membership | `inert` on slides that are not in view, from an `IntersectionObserver` of actual visibility (default threshold 0.6, as Zag), never from the snap. |
| `aria-hidden` over interactive content leaves it tabbable | [splide#370](https://github.com/Splidejs/splide/issues/370) (read, closed 2021) | `aria-hidden` does not remove focusability | Same: `inert`. |
| Screen reader reads all slides on change when slides contain links | [splide#824](https://github.com/Splidejs/splide/issues/824) (read, closed 2022) | Live region over the whole slide list | No `aria-live` on the Viewport; a short announcement through the Announcer (below). |
| Tab does not leave the carousel in loop mode (clones tabbable) | [swiper#8181](https://github.com/nolimits4web/swiper/issues/8181) (read, closed 2026-08) | Cloned slides stay in the tab order | No clones in v1. |
| A link focused with Tab breaks the layout | [swiper#4006](https://github.com/nolimits4web/swiper/issues/4006) (read, open) | The browser scrolls the focused element into view, fighting the transform | A native scroll container: the browser's own scroll-into-view is the right behaviour; a focus-in handler syncs the page. |
| Each pagination bullet is a tab stop | [swiper#7641](https://github.com/nolimits4web/swiper/issues/7641) (read, open) | Plain buttons | Indicators are one tab stop with arrow keys (tabbed pattern, below). |
| Pause and play as one button breaks focus | [splide#58](https://github.com/Splidejs/splide/issues/58) (read; "breaks accessibility because the foc..." is cut off in what I read) | Two elements swapped | One `AutoplayTrigger`, named by state, never unmounted or hidden. |
| Autoplay `pauseDelay` not cleared after `reset()`; playing state lost on resize | [embla#1300](https://github.com/davidjerleke/embla-carousel/issues/1300), [#1395](https://github.com/davidjerleke/embla-carousel/issues/1395) (titles only) | Not read | Timing is derived from the injected `Clock`; resize and layout changes never touch the autoplay state. |
| `autoplayTimeLeft` wrong after pause and resume; remaining time not respected | [swiper#8132](https://github.com/nolimits4web/swiper/issues/8132), [#4977](https://github.com/nolimits4web/swiper/issues/4977), [#7107](https://github.com/nolimits4web/swiper/issues/7107) (titles only) | Not read | A hover or focus pause stores the remaining delay; resume continues from it. |
| Carousel ARIA not applied to a custom root node | [embla#1408](https://github.com/davidjerleke/embla-carousel/issues/1408) (title only) | Plugin option | Roles are on rind-ui's own parts, which accept `render`. |
| Incorrect `aria-orientation="vertical"` found in a professional audit | [splide#1372](https://github.com/Splidejs/splide/issues/1372) (title only) | Not read | No `aria-orientation` on a carousel; the indicators' tablist has one only when vertical. |
| Slick: many open accessibility reports (VoiceOver/TalkBack, dot navigation not visibly keyboard accessible) | [slick#3268](https://github.com/kenwheeler/slick/issues/3268), [#2139](https://github.com/kenwheeler/slick/issues/2139), [#4224](https://github.com/kenwheeler/slick/issues/4224) (titles only) | Not read | Evidence only. |

## Accessibility decisions

- **Roles**: Root `role="region"` + `aria-roledescription="carousel"` + a required name (dev warning
  without one); Slide `role="group"` + `aria-roledescription="slide"` + `aria-label` "3 of 6"
  (`messages.slide({ index, count })`).
- **Indicators = APG tabbed variant**: when an `IndicatorGroup` is rendered, it is a `tablist`, each
  Indicator a `tab` with `aria-selected`, `aria-controls` the slide, roving tabindex, arrows move
  and select (reusing the tabs rule), and the Slides become `tabpanel` with the slide
  roledescription, `aria-labelledby` the tab. Without an `IndicatorGroup` the carousel is the
  basic prev/next pattern. The decision is made by which parts mount (as Dialog's Title does), not
  by a flag.
- **No `aria-live` on the Viewport.** APG puts `aria-live="polite"` on the slide container when not
  rotating. Splide#824 shows the cost (the whole content read). Rind uses the Announcer: when the
  page changes by a user action ("user" reasons: buttons, indicator, key), it announces "Slide 3 of
  6" politely; autoplay changes announce nothing.
- **Hidden slides**: `inert` on slides not in view (removes them from the tab order and the AT
  tree together); never `aria-hidden` alone. A slide being focused or targeted by a link
  scrolls into view and becomes inert-free first (the page follows the focus).
- **Prev/Next at the ends**: `aria-disabled="true"` plus `data-disabled`, not `disabled`: a user pressing Next on
  the last slide would otherwise lose focus (cause D). With `loop`, never disabled.
- **Autoplay**: off by default; `AutoplayTrigger` named "Pause" / "Play" by state (the name changes,
  so no `aria-pressed`); inapplicable triggers are never hidden. Rotation pauses while the pointer is
  over the Root (resumes on leave), while focus is inside (does **not** resume on blur; the trigger
  does), while the document is hidden (resumes on visible), and always with `prefers-reduced-motion`
  (autoplay does not start). The user's explicit pause is sticky.
- **Reduced motion**: programmatic scrolling uses `behavior: "auto"` (instant) under the preference.
- **Keyboard**: Tab reaches the AutoplayTrigger, Prev, the Viewport (a scroll container, focusable only
  when nothing inside is tabbable), the slide contents, Next, then the indicators; ArrowLeft/Right
  (Up/Down vertical) scroll when the Viewport itself is focused; Home/End go to the first and last
  page.
- **Focus order**: the AutoplayTrigger is first in the DOM order in the examples and in the docs
  (APG); the library cannot reorder the consumer's tree, so the contract and docs say so.

## Decisions for `add-carousel`

1. **Parts**: `Root`, `Viewport` (the scroll-snap container), `Slide` (`index`), `PrevTrigger`,
   `NextTrigger`, `IndicatorGroup`, `Indicator` (`index`), `AutoplayTrigger`, `Status` (optional
   visible "3 / 6" text, `aria-hidden` because the Announcer speaks it), `Control` (a
   layout group for the triggers).
2. **Machine**: orthogonal regions in one machine: `scroll` (`idle | scrolling | settling`) and
   `autoplay` (`off | playing | paused`, with a set of reasons `user`, `hover`, `focus`, `hidden`,
   `end`, `reducedMotion`). Events: `PAGE.GO { page, reason }`, `PAGE.NEXT`, `PAGE.PREV`,
   `SCROLL.START`, `SCROLL.END { page }` (from `scrollend`, with a debounce fallback on the injected
   `Scheduler`), `SLIDES.CHANGED` (from the registry), `VIEWPORT.RESIZED`, `IN_VIEW.CHANGED`,
   `AUTOPLAY.TOGGLE`, `AUTOPLAY.TICK`, `HOVER.ENTER/LEAVE`, `FOCUS.IN/OUT`, `VISIBILITY.CHANGED`.
3. **Props**: `page` / `defaultPage` / `onPageChange({ page, reason })`, `slidesPerPage` (1),
   `slidesPerMove` (`"page"` default; a number), `loop` (false; wraps pages, not seamless),
   `orientation`, `dir`, `spacing`, `snapAlign`, `autoplay` (false) / `autoplayDelay` (5000),
   `pauseOnHover` (true), `pauseOnFocus` (true), `slideCount` (optional, for SSR indicators; the
   registry corrects it), `messages`, `locale`, `onAutoplayChange({ playing, reason })`.
4. **Time**: autoplay delay measured by the injected `Clock` and scheduled on the `Scheduler`
   (timer.md); a pause stores the remaining time; no `setInterval`. `PageVisibility` pauses and
   resumes; `MotionEnv` for the preference.
5. **Scrolling**: native scroll snap. The machine only requests page targets and observes where the
   scroll settled; touch, wheel and trackpad are never intercepted. No mouse-drag emulation, no
   clones, no transforms.
6. **`data-*`**: `data-scope="carousel"`, `data-part`, `data-orientation`, `data-index`,
   `data-inview` (Slide), `data-current` (Slide and Indicator), `data-disabled` (Prev/Next at the
   ends), `data-autoplay="off|playing|paused"` (Root and AutoplayTrigger), `data-scrolling` (Viewport).
   CSS variables on Root: `--rind-carousel-slides-per-page`, `--rind-carousel-spacing`,
   `--rind-carousel-delay` (ms), `--rind-carousel-page` and `--rind-carousel-pages`.
7. **Contract**: locate by the Root's name. Actions `next`, `prev`, `goTo(index)`, `play`, `pause`,
   `swipeTo(page)` (scroll the Viewport as a touch would, with a keyboard twin through `goTo`),
   `advanceTime(ms)` (virtual clock, as Timer); queries `page`, `pageCount`, `isPlaying`,
   `slidesInView`, `announcement`.
8. **Reuse**: `dom/item-registry.ts`, `dom/swipe.ts` (only for the vertical-scroll lock if needed;
   likely unused), `dom/motion.ts`, the Announcer, Clock, Scheduler, `PageVisibility`, the Tabs
   roving rule for indicators, `focus-safely`, `scroll-metrics.ts`.
9. **Deliberately different from Zag and the others, and why**: autoplay off by default with a
   required control; interaction restarts rather than ends autoplay; hover pause resumes, focus pause
   does not; `inert` from observed visibility; no live region on the slides; indicators as one tab
   stop; no mouse-drag emulation; clock-derived timing.
10. **Non-goals**: seamless infinite loop, fade or other transitions (other than scrolling),
    thumbnails-as-indicators, parallax, free-scroll (no snap) mode, `Autoplay` progress rendering
    (the `--rind-carousel-delay` variable lets the theme animate one), video-slide handling.

## Open questions

- **Live region vs Announcer**: this note deviates from APG's `aria-live="polite"` on the slide
  container. Verify with NVDA, JAWS and VoiceOver that the Announcer message plus focus on the
  control the user pressed is at least as clear; if not, add a live region to a visually hidden
  status node (not the slides).
- **`inert` on partially visible slides**: a slide 60% in view with `slidesPerPage` fractional is
  interactive, one at 59% is inert. Is that visible to keyboard users as a skipped control? Check
  with peek layouts.
- **`scrollend` support**: Safari's support is recent; the debounce fallback must be tested on WebKit
  with momentum scroll.
- **Seamless loop**: needs clones or scroll-position rewrites, and clones are an a11y hazard
  (swiper#8181). Defer until asked; `loop` wraps with an instant jump (or a smooth scroll back).
- **Vertical carousels and `aria-orientation`**: confirm which element carries it (the tablist only).
- **Progress**: expose elapsed fraction as `--rind-carousel-progress` updated per frame, or leave
  it to a CSS animation on `--rind-carousel-delay` driven by `data-autoplay` (a CSS animation pauses
  with `animation-play-state` and keeps its place, but drifts from the machine's clock)?
