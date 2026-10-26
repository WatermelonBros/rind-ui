## ADDED Requirements

### Requirement: Carousel Anatomy

A Carousel SHALL consist of `Root` (`role="region"`, `aria-roledescription="carousel"`, named),
`Viewport` and `Slide`s (`role="group"`, `aria-roledescription="slide"`, named "i of n"), with
optional `Control`, `PrevTrigger`, `NextTrigger`, `IndicatorGroup`, `Indicator`,
`AutoplayTrigger` and `Status`.

#### Scenario: Slide names

- **WHEN** a Carousel of 4 slides renders
- **THEN** the second slide is a group named "2 of 4"

### Requirement: Carousel Pages

Pages SHALL be computed from the slide count, `slidesPerPage` (default 1) and `slidesPerMove`
(`"page"` default, or a number). `page` SHALL be controllable and clamped to the pages.

#### Scenario: Pages of two

- **WHEN** there are 5 slides and `slidesPerPage` is 2
- **THEN** there are 3 pages

### Requirement: Carousel Navigation

Next and Prev SHALL move one page; at an end without `loop` they SHALL do nothing and their
triggers SHALL be `aria-disabled` and stay focusable; with `loop` they SHALL wrap. A page change
not caused by scrolling SHALL scroll the Viewport to that page (smoothly unless reduced motion).

#### Scenario: End without loop

- **WHEN** the last page is current and Next is pressed
- **THEN** the page does not change and the NextTrigger has `aria-disabled="true"`

#### Scenario: Loop

- **WHEN** `loop` is true, the last page is current and Next is pressed
- **THEN** the first page is current

### Requirement: Carousel Scrolling

The Viewport SHALL scroll natively with scroll snap; touch, wheel and trackpad input SHALL NOT be
intercepted and no mouse drag SHALL be emulated. When a scroll settles, the page nearest to the
scroll position SHALL become current with reason `scroll`, without scrolling again.

#### Scenario: Swipe

- **WHEN** the user swipes the Viewport to the third page
- **THEN** the page is 2 and `onPageChange` reports reason `scroll`

### Requirement: Carousel Autoplay

Autoplay SHALL be off by default. With `autoplay`, it SHALL advance one page every
`autoplayDelay` ms (default 5000) measured on the injected clock; SHALL pause while the pointer
is over the Root and while the page is hidden, keeping the remaining time; SHALL stop when focus
enters the Root and SHALL NOT resume by itself after that; SHALL restart its delay after a user
navigation; SHALL stop at the last page without `loop`; and SHALL NOT start with reduced motion.
An AutoplayTrigger SHALL stop and start it.

#### Scenario: Off by default

- **WHEN** a Carousel renders without `autoplay`
- **THEN** no page change happens after 10 seconds

#### Scenario: Hover pauses with the remaining time

- **WHEN** autoplay runs with a 5000 ms delay, the pointer enters after 3000 ms, leaves 10 s later
- **THEN** the next page comes 2000 ms after the pointer left

#### Scenario: Focus stops

- **WHEN** autoplay runs and focus moves into the Carousel
- **THEN** autoplay is stopped and the AutoplayTrigger is named "Start automatic slide show"

### Requirement: Carousel Slide Visibility

Slides outside the current page SHALL be `inert` and `aria-hidden="true"`; slides on the current
page SHALL be neither.

#### Scenario: Hidden slides are not focusable

- **WHEN** slide 1 is current and slide 2 contains a link
- **THEN** Tab from the PrevTrigger does not reach that link

### Requirement: Carousel Indicators

The IndicatorGroup SHALL be a `tablist` and each Indicator a `tab` for one page, with
`aria-selected` on the current page and one tab stop: only the current Indicator has
`tabindex="0"`. Arrow keys SHALL move to and select the next or previous page (wrapping), Home
and End the first and last.

#### Scenario: Roving

- **WHEN** the first Indicator has focus and ArrowRight is pressed
- **THEN** the second page is current and the second Indicator has focus

### Requirement: Carousel Announcements

A page change by the user (trigger, indicator, keyboard, API) SHALL be announced politely
("Slide 3 of 6"); a change by autoplay or by scrolling SHALL NOT be announced; no live region
SHALL wrap the slides.

#### Scenario: Autoplay is silent

- **WHEN** autoplay advances a page
- **THEN** nothing is announced

### Requirement: Carousel Data Attributes

Parts SHALL carry `data-scope="carousel"`, `data-part`, `data-instance`, `data-orientation`;
Slides `data-index` and `data-current`; Indicators `data-index` and `data-current`; Prev and Next
`data-disabled` at an end; Root and AutoplayTrigger `data-autoplay` (`off`, `playing`,
`paused`); the Viewport `data-scrolling`. The Root SHALL set `--rind-carousel-slides-per-page`,
`--rind-carousel-spacing`, `--rind-carousel-delay`, `--rind-carousel-page` and
`--rind-carousel-pages`.

#### Scenario: Autoplay attribute

- **WHEN** autoplay is paused by hover
- **THEN** the Root has `data-autoplay="paused"`

### Requirement: Carousel Messages

The strings SHALL come from `messages` with English defaults: the role descriptions, slide and
indicator names, trigger names, the announcement and the status text.

#### Scenario: Localised slide name

- **WHEN** `messages.slideLabel` returns "Diapositiva 2 di 4"
- **THEN** the second slide is named "Diapositiva 2 di 4"

### Requirement: Carousel Contract

The contract SHALL locate by the Root's name and provide `next`, `prev`, `goTo`, `play`, `pause`
and the queries `page`, `pageCount`, `isPlaying`, `statusText`.

#### Scenario: Driver

- **WHEN** a test calls `next()` on the first page
- **THEN** `page()` is 1

### Requirement: Carousel Theme

`@rind-ui/theme` SHALL style the Carousel in the `decoration` family: a scroll-snap Viewport with
hidden scrollbars only where a control exists, slides sized by `--rind-carousel-slides-per-page`
and `--rind-carousel-spacing`, round Prev/Next buttons, dot indicators with a visible current
state not by colour alone, and a visible focus ring.

#### Scenario: Current indicator

- **WHEN** an indicator is current
- **THEN** it differs from the others by size or shape, not only by colour
