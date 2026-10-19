# Marquee — research

Status: done · Wave: 3

A Marquee scrolls a row (or column) of content in a continuous loop: partner logos, a
news ticker, the site's own "component names" band. One of the nine libraries ships it
(Ark, through Zag's `@zag-js/marquee`, since Zag 1.26.4). Outside the nine, the common
implementations are `react-fast-marquee` (the most used React one), Magic UI's shadcn
registry item and Nuxt UI's `UMarquee`. None of them is accessible as shipped. Zag comes
closest. The questions are: how to loop with no seam, how to keep the speed in px/s
when the content size changes, and how to satisfy WCAG 2.2.2 (Pause, Stop, Hide)
together with `prefers-reduced-motion`. Duplicated content must also stay out of the
accessibility tree and out of the tab order.

The docs site has a hand-built marquee
([apps/site/components/marquee.tsx](../../apps/site/components/marquee.tsx) and
`marquee.module.css`). It doubles the list and animates `translate: -50%` over 60 s. The
whole band is `aria-hidden`. It has no pause control, no reduced-motion handling and no
gap at the seam (the 44 px `gap` sits between items, so the -50% loop is off by half a
gap). The component must be able to replace it.

Builds on [accessibility.md](accessibility.md) (§1 SC 2.2.2, §8 reduced motion,
invariants 20, 26, 27), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md),
[native-platform.md](native-platform.md) (§10 animation), the Environment
capabilities `MotionPreference` (`reducedMotion()`, `subscribeReducedMotion`) and
`Scheduler`, and the Toast machine's "set of pause reasons" lesson
(zag#2238, radix#2268, kobalte#564).

Sources read (local shallow clones, 2026-10-19):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/marquee/src/{marquee.machine,marquee.connect,marquee.dom,marquee.utils,marquee.anatomy,marquee.types}.ts`, `CHANGELOG.md` |
| react-fast-marquee | `src/components/{Marquee.tsx,Marquee.scss}` (v1.6.5) |
| Magic UI | `apps/www/registry/magicui/marquee.tsx`, `apps/www/public/r/marquee.json` (keyframes) |
| Nuxt UI | `src/runtime/components/Marquee.vue`, `src/theme/marquee.ts` |

## Pattern

- WAI-ARIA APG pattern: **none**. The closest is the
  [Carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) pattern's auto-rotation
  rules, which [accessibility.md](accessibility.md) §2 already assigns to Marquee:
  - a button that stops and restarts the motion, "particularly important for supporting
    assistive technologies operating in a mode that does not move either keyboard focus
    or the mouse";
  - motion stops when keyboard focus enters the content, and **does not restart unless
    the user explicitly asks**;
  - motion stops while the mouse hovers the content;
  - the rotation control is the first element in the Tab sequence inside the widget,
    before the moving content;
  - the control's label changes with the action ("Stop slide rotation" / "Start slide
    rotation"). Because the label changes, it has **no `aria-pressed`**.
- The ARIA `marquee` role ("a type of live region where non-essential information
  changes frequently", implicit `aria-live="off"`) is for content that *changes* (a stock
  ticker whose values update). It is not for content that *moves*. Screen readers expose
  it as a generic container. We do not use it (Decisions).
- Roles and attributes required: none of its own. The content keeps its own semantics
  (a list of logos is a `ul`). The pause control is a native `button`. The copies made
  for the loop are `aria-hidden="true"` with every tabbable element inside at
  `tabindex="-1"`.
- Keyboard interactions required: none beyond the button (Enter / Space) and Tab through
  the original content.

## How the others built it

### Zag.js / Ark UI

- Source: `packages/machines/marquee/src/*`. Ark wraps it as `Marquee.Root`, `Viewport`,
  `Content`, `Item`, `Edge`.
- API shape: parts `root`, `viewport`, `content` (rendered `contentCount` times by the
  consumer, index 0 the original), `item` (margin-based spacing), `edge` (absolutely
  positioned overlay for a fade). Props: `side` (`start` / `end` / `top` / `bottom`),
  `speed` (px/s, default 50), `delay` (s), `loopCount` (0 = infinite), `spacing`
  (`"1rem"`), `autoFill`, `pauseOnInteraction` (default **false**), `reverse`,
  `paused` / `defaultPaused` / `onPauseChange`, `onLoopComplete`, `onComplete`,
  `translations.root` (default "Marquee content").
- State model: one state `idle`. `paused` is a bindable context value set by `PAUSE`,
  `RESUME`, `TOGGLE_PAUSE`. Hover, focus and the API all write the same flag. `duration`
  is a context value. `trackDimensions` measures root and content with a ResizeObserver
  (rAF-throttled) but **sets the duration only once**, on mount (`initialDurationSet`).
  It is recalculated only when `speed`, `spacing` or `side` change.
- Connect: Root `role="region"`, `aria-roledescription="marquee"`, `aria-live="off"`,
  `aria-label` from translations, `data-state="paused" | "idle"`, and CSS variables
  `--marquee-duration`, `--marquee-spacing`, `--marquee-delay`, `--marquee-loop-count`,
  `--marquee-translate` (`-100%` or `100%` from side and `dir`). Clones get
  `aria-hidden` and `role="presentation"`. Structural inline styles: root
  `overflow: hidden`, `contain: layout style paint`; content `flex-shrink: 0`,
  `backface-visibility: hidden`, `transform: translateZ(0)`, `contain: paint`,
  `will-change: transform` while running.
- Notable:
  - Each content copy translates by `-100%` of its own size, so all copies move as one
    and the loop is exact when the copies are equal.
  - Duration = content size / speed (after #3231). The distance is one copy, not the
    viewport.
  - `autoFill` multiplier = `ceil(rootSize / contentSize)` when the content is smaller
    than the root.
  - `restartAnimation` (on speed change) clears `animation`, forces a reflow and
    restores it.
  - `onAnimationIteration` / `onAnimationEnd` are filtered to the first copy.
- Problems:
  - Focus pause resumes on blur (`onBlurCapture` sends `RESUME`). This is against APG's
    "does not restart unless the user explicitly requests it".
  - Hover and focus share one `paused` flag with the user's choice. A user who paused
    with a button and then hovers and leaves is resumed. This is the bug Toast fixed with
    a set of reasons.
  - No `prefers-reduced-motion` handling in the machine or the styles.
  - Pausing is off by default (`pauseOnInteraction: false`). No pause control part.
  - The Root is a labelled `region` landmark by default, with an English label and an
    unlocalised role description, on every marquee on the page.
  - Clones are `aria-hidden` but not `inert`. A link inside a clone is still in the tab
    order and focusable while hidden (the axe rule `aria-hidden-focus`).
  - The duration is not recomputed when fonts load or the content changes size: the
    speed drifts from `speed`.
  - Changing the duration mid-run (speed change) restarts the loop from 0, a visible jump.

### react-fast-marquee

- Source: `src/components/Marquee.tsx`, `Marquee.scss`.
- API shape: one component. `play`, `pauseOnHover`, `pauseOnClick`, `direction`
  (`left` / `right` / `up` / `down`), `speed`, `delay`, `loop`, `autoFill`, `gradient`
  (`gradientColor`, `gradientWidth`), `onFinish`, `onCycleComplete`, `onMount`.
- State model: React state for container width, marquee width, multiplier and
  `isMounted`. Duration = `max(marquee, container) / speed`, or
  `marquee × multiplier / speed` with `autoFill`. Two `.rfm-marquee` tracks, each
  `min-width: 100%` (or `auto` with autoFill), animate `translateX(0 → -100%)`.
- Notable:
  - `min-width: 100%` per track makes two copies always enough without measuring
    (short content leaves a blank stretch instead of repeating).
  - Pause via CSS: `animation-play-state: var(--pause-on-hover)` on `:hover` of the
    container. No JS for hover.
- Problems:
  - **Renders `null` until mounted** (`!isMounted ? null`): nothing in the server HTML,
    a layout shift on hydration.
  - Vertical directions **rotate** the whole container by ±90° and counter-rotate each
    child (`--transform`), with the width set to `100vh`. Layout, hit-testing and focus
    rings are rotated.
  - Gradient edges are painted with a colour (`white` by default). They do not work on
    non-white or theme-switching backgrounds.
  - The second track is not `aria-hidden` and not inert. Every item is read twice.
  - No reduced motion, no pause control.

### Magic UI (shadcn registry)

- Source: `registry/magicui/marquee.tsx`, keyframes in `public/r/marquee.json`.
- API shape: `reverse`, `pauseOnHover`, `vertical`, `repeat` (default **4**), CSS
  variables `--duration` (40 s) and `--gap` (1 rem).
- Notable: keyframes `translateX(calc(-100% - var(--gap)))`. The gap at the seam is
  part of the distance, so the loop is exact with flex `gap`.
- Problems: the content is rendered `repeat` times, **none of them hidden**, so a screen
  reader reads the logos four times and tabs through four copies of every link. No
  reduced motion. The duration is a fixed time, so speed depends on the content length.

### Nuxt UI (`UMarquee`)

- Source: `Marquee.vue`, `theme/marquee.ts`.
- API shape: `pauseOnHover`, `reverse`, `orientation`, `repeat` (4), `overlay` (fade
  edges, default on).
- Notable: animations only under `motion-safe:`, so reduced motion gets static content.
  Separate `marquee-rtl` keyframes (added after #4813). `backface-hidden`.
- Problems: repeats not hidden from assistive technology; overlay painted with the
  background colour; the reduced-motion fallback shows only what fits, so the rest of
  the content is invisible and unreachable.

### Not shipped

Radix, React Aria, Base UI, Headless UI, Ariakit, Reka UI, Bits UI and Kobalte have no
marquee (searched their component folders and issue trackers for "marquee" and
"ticker"). Mantine: no marquee component (issue search, no hits).

## Accessibility

Applying [accessibility.md](accessibility.md):

- **WCAG 2.2.2 Pause, Stop, Hide (A).** Moving content that starts automatically, lasts
  more than five seconds and is shown in parallel with other content needs a mechanism
  to pause, stop or hide it, unless the movement is essential. A marquee loops forever,
  so it always qualifies. The criterion has no exception for decorative motion: the
  site's `aria-hidden` band still needs a pause control. Sufficient technique G4 says the
  content can be paused *and restarted from where it was paused*. Failure F16 is
  scrolling content with no pause mechanism. Pause-on-hover alone does not satisfy it:
  keyboard, touch and switch users cannot hover. A real button is required.
- **Reduced motion.** `prefers-reduced-motion: reduce` is technique C39 (for 2.3.3, AAA).
  It is also what users with vestibular disorders set. accessibility.md §8 already
  decides: "Marquee (paused, content static)", read through `Environment.reducedMotion()`.
  "Static" must not mean "only what fits": a stopped marquee clipped to its viewport
  hides the rest of its content from sighted users (Nuxt UI's fallback does this). The
  static layout wraps, so everything is visible.
- **Duplicates.** The copies needed for a seamless loop must be `aria-hidden="true"` (not
  read) and must have no tabbable content. `aria-hidden` alone leaves links in the tab
  order, which axe reports as `aria-hidden-focus` (react-fast-marquee#40 comment). Two
  ways to fix it:
  - `inert` (Chrome 102, Firefox 112, Safari 15.5) removes copies from Tab and from the
    tree, but it also makes them **unclickable**. In a two-copy logo band, part of the
    visible links at any moment would be dead.
  - `tabindex="-1"` on every tabbable element inside a copy keeps them clickable, keeps
    them out of Tab, and satisfies `aria-hidden-focus`.

  We take the second. `core/dom` already has `tabbable-content` (`hasTabbable`,
  `observeTabbable`). A MutationObserver re-applies it when a child renders new
  content. A pointer click on a copy's link focuses it. That is mouse focus, and screen
  reader users do not reach copies.
- **Focusable content inside.** Links in a moving band have two problems. Focus lands on
  an element that keeps moving, possibly out of view: SC 2.4.11 Focus Not Obscured (AA)
  and 2.4.7. And focusing an element inside an `overflow: hidden` box makes the browser
  scroll that box (`scrollLeft`) to reveal it. That shifts the whole band by an offset
  the animation does not know about, and the seam breaks. Fixes:
  - pause when focus enters (APG), and stay paused until the user presses Play;
  - clip with `overflow: clip`, which is not a scroll container, so focus cannot scroll
    it (Chrome 90, Firefox 81, Safari 16);
  - bring the focused element into view by **seeking the animation** (Web Animations
    `currentTime` on the copies' running animations), not by scrolling.
- **Pause control placement and naming.** APG: first in the Tab sequence of the widget,
  before the moving content. The label changes with the action and the button has no
  `aria-pressed`. Default labels come from `messages` and are localisable. A visible text
  label wins over `aria-label` (2.5.3 Label in Name), so the part sets `aria-label` only
  from messages, and a consumer who renders visible text passes their own name.
- **Hover never from touch** (invariant 20). A tap on a moving logo must not "hover-pause"
  it until the next tap elsewhere (the sticky-hover problem on iOS). Touch users use the
  button.
- **Screen readers.** Browse mode reads the DOM, so motion does not disturb reading order
  once the copies are hidden. iOS VoiceOver and TalkBack touch exploration target a
  moving rectangle. The pause button covers this. We do not try to detect assistive
  technology.
- **Landmarks.** No region by default. A marquee is rarely a landmark, and Zag's default
  "Marquee content" region adds one landmark per band in English. The Root forwards
  `role`, `aria-label` and `aria-labelledby`, so a consumer who wants a labelled group or
  region adds it.
- **Forced colors.** Nothing is conveyed by colour. Edge fades use `mask-image`, which
  is unaffected by forced colours and needs no background colour. The pause button
  gets a `CanvasText` outline and a `Highlight` focus ring.
- **RTL.** "Toward the start" mirrors: in RTL the content moves right. A `translate`
  of -100% is physical, so the theme mirrors the keyframes under `:dir(rtl)`
  (Nuxt UI#4813, react-fast-marquee#79).

[native-platform.md](native-platform.md): the `<marquee>` element is obsolete (HTML LS,
non-conforming) and has no pause control or reduced-motion handling. Native pieces we
use: `overflow: clip`, CSS animations with `animation-play-state`, and
`Element.getAnimations()` (Chrome 84, Firefox 75, Safari 14), which presence already
uses.

## Bug history

Method: `gh issue list --search marquee --state all` on `chakra-ui/zag`,
`chakra-ui/ark`, `magicuidesign/magicui` and `nuxt/ui`. All 120 issues of
`justin-chu/react-fast-marquee` were listed and the relevant ones read. Ark has no marquee
issues. Zag has one bug issue (#3231) plus changelog fixes.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#3231](https://github.com/chakra-ui/zag/issues/3231) closed | Speed depends on content width when content < viewport | Duration from root size, but each copy moves by its own size | [PR #3233](https://github.com/chakra-ui/zag/pull/3233): duration = content size / speed | Distance is one copy (with its trailing gap); duration = copy size / speed; scenario |
| RFM | [#3](https://github.com/justin-chu/react-fast-marquee/issues/3), [#18](https://github.com/justin-chu/react-fast-marquee/issues/18) closed | Short content scrolls faster than long at the same `speed` | Fixed duration | Measured width | `speed` is px/s, never a fixed duration |
| Zag | changelog 1.27.0 (`abb8854`); Nuxt UI [#6277](https://github.com/nuxt/ui/issues/6277) open | Flicker at the loop point in Firefox | Sub-pixel repaint when the animation wraps | `backface-visibility: hidden`, `contain: paint`, margin spacing | Theme: `backface-visibility: hidden` on copies; whole-copy percentages |
| RFM | [#108](https://github.com/justin-chu/react-fast-marquee/issues/108), [#128](https://github.com/justin-chu/react-fast-marquee/issues/128) open; [#106](https://github.com/justin-chu/react-fast-marquee/issues/106) open | Glitch on iOS / Samsung when the loop restarts; random flash moving right | Layer re-creation at wrap | Workaround `translate3d(0,0,0)` on children | Same: keep the copies on their own layer for the whole run |
| RFM | [#40](https://github.com/justin-chu/react-fast-marquee/issues/40) closed | Screen reader reads the content twice; focusable content in the copy | Copy not hidden; then hidden but still focusable | `aria-hidden` added; focusability left open | Copies `aria-hidden` with no tabbable content (not `inert`: copies stay clickable); invariant |
| Magic UI | source (`repeat = 4`) | Content read and tabbed 4× | No hiding on repeats | Open (by design) | Same as above |
| Zag | source (`onBlurCapture`) | Marquee resumes when focus leaves | Focus pause is a temporary flag | Open | Focus pause is sticky (APG); only the user resumes |
| Zag | source (one `paused` flag) | Hover-leave resumes a marquee the user paused | Hover and user share one flag | Open | User pause and hover are separate inputs; hover never clears a user pause; scenario |
| RFM | [#79](https://github.com/justin-chu/react-fast-marquee/issues/79) closed (unsolved); Nuxt UI [#4813](https://github.com/nuxt/ui/issues/4813) closed | Wrong motion in `dir="rtl"` | Physical `translateX(-100%)` with row direction reversed | Nuxt: `marquee-rtl` keyframes | Theme mirrors keyframes under `:dir(rtl)`; RTL test |
| RFM | [#66](https://github.com/justin-chu/react-fast-marquee/issues/66), [#110](https://github.com/justin-chu/react-fast-marquee/issues/110) open | `autoFill` freezes the page | The container's width grows with the copies (shrink-to-fit parent), so more copies are added, forever | Workaround: fixed width on a wrapper | Viewport `contain: inline-size` (its size never depends on its copies) and a hard cap on copies |
| RFM | [#39](https://github.com/justin-chu/react-fast-marquee/issues/39) open; source `isMounted` | SSR crash (`window` at module scope); nothing rendered on the server | Style injection at import; render gated on mount | Open | Server render is the full content; nothing touches globals at import; hydration test |
| RFM | [#12](https://github.com/justin-chu/react-fast-marquee/issues/12) closed | Safari starts, then stops until mouseover | `animation-play-state` toggled through a variable on `:hover` with old Safari | Fixed in a later release | Play state from `data-state`, not from `:hover` |
| RFM | [#35](https://github.com/justin-chu/react-fast-marquee/issues/35) open; Magic UI [#215](https://github.com/magicuidesign/magicui/issues/215) closed | Content jumps when the direction changes at runtime | `animation-direction: reverse` at the same `currentTime` shows the mirrored position | Open | On `reverse` change, set `currentTime = duration − currentTime`; scenario |
| RFM | [#47](https://github.com/justin-chu/react-fast-marquee/issues/47), [#111](https://github.com/justin-chu/react-fast-marquee/issues/111), [#113](https://github.com/justin-chu/react-fast-marquee/issues/113) open; RFM [#9](https://github.com/justin-chu/react-fast-marquee/issues/9) closed | Content shifts when children update; speeds up after reload | A new `animation-duration` at the same `currentTime` is a new progress | Open | Keep the progress when the duration changes: scale `currentTime` by new/old |
| Zag | source (`initialDurationSet`) | Speed wrong after a web font loads | Duration computed once on mount | Open | Recompute on every size change, keeping progress |
| RFM | [#101](https://github.com/justin-chu/react-fast-marquee/issues/101) open | `onFinish` fires at start | `animationend` from a restart with `elapsedTime` 0 | Workaround | No completion callbacks (non-goal); loops are infinite |
| RFM | [#81](https://github.com/justin-chu/react-fast-marquee/issues/81) open | Images missing in the first cycle | `loading="lazy"` images positioned off-screen by the transform are not loaded | Use eager loading | Docs: images in a marquee load eagerly; copies share the cache |
| RFM | [#7](https://github.com/justin-chu/react-fast-marquee/issues/7), [#58](https://github.com/justin-chu/react-fast-marquee/issues/58) closed; site marquee | No space (or half a space) between the last and the first item | Gap only *between* items, not after the last | Magic UI: `calc(-100% - gap)` | The gap is the copy's trailing padding, so −100% is exact |
| RFM | [#120](https://github.com/justin-chu/react-fast-marquee/issues/120), [#89](https://github.com/justin-chu/react-fast-marquee/issues/89), [#117](https://github.com/justin-chu/react-fast-marquee/issues/117) open | Vertical marquees are hard to size; transforms go wrong | Vertical by rotating the container 90° | Open | Vertical is a column with `translate` on the block axis |
| RFM | [#91](https://github.com/justin-chu/react-fast-marquee/issues/91) open | Cannot render the content as `ul` / `li` | Fixed wrapper elements | Open | Content accepts `render`; the copies use the same element |
| RFM | [#127](https://github.com/justin-chu/react-fast-marquee/issues/127), [#104](https://github.com/justin-chu/react-fast-marquee/issues/104) open | Gradient edges only work on white | Fade painted with a colour | Open | Theme fades with `mask-image`; no Edge part |
| RFM | [#103](https://github.com/justin-chu/react-fast-marquee/issues/103) open | Wants to scroll only when content overflows | — | Open | Open question; not in the first change |
| Nuxt UI | [#3454](https://github.com/nuxt/ui/issues/3454) closed | Lighthouse drop, DOM too deep | 4 repeats of heavy testimonial cards | Stale | Default 2 copies; `autoFill` measured and capped |
| Magic UI | [#835](https://github.com/magicuidesign/magicui/issues/835) closed | No animation in production | Keyframes declared in Tailwind config, purged | Config fix | Keyframes ship in `marquee.css`, not in a consumer config |

## Known pitfalls

1. **Jumps on any timing change.** CSS animations keep `currentTime` when
   `animation-duration` or `animation-direction` change. Progress = time / duration, so
   a new duration (resize, font load, content change, speed change) or a reverse moves
   the content. Several libraries hit this (RFM#9, #35, #47; Magic UI#215; Zag restarts
   from 0). Fix through Web Animations: rescale or mirror `currentTime` in the same
   frame as the change.
2. **Starting before measuring.** A duration computed after the first frame changes a
   running animation (pitfall 1). Do not run the animation until the first measurement
   has arrived. The server and no-JS render is static.
3. **Copies in the tab order** (RFM#40, Magic UI, Nuxt UI, Zag): `aria-hidden` is not
   enough.
4. **Runaway fill** (RFM#66): measured fill inside a shrink-to-fit container. Contain the
   viewport's inline size and cap the copies.
5. **Physical translate in RTL** (RFM#79, Nuxt UI#4813).
6. **Focus scrolls the clip box.** `overflow: hidden` is a scroll container. Focusing a
   link inside sets `scrollLeft` and shifts the band. Use `overflow: clip`.
7. **Hover pause from touch** sticks on iOS until the next tap elsewhere.
8. **Firefox / iOS flicker at the wrap** (Zag 1.27, Nuxt UI#6277, RFM#108): keep the
   copies composited (`backface-visibility: hidden`).
9. **Hydration.** Reading `matchMedia` during render makes the server (no preference)
   and the client (reduce) render different trees. Read it in an effect, after hydration.
10. **Duplicated ids.** Copies repeat the consumer's markup. An `id` inside the content
    appears two or more times and breaks every IDREF that points to it
    (accessibility.md §3). Warn in development.
11. **Sub-pixel seams.** Copies of fractional width make a 1 px seam at the wrap in some
    engines. Each copy translates by its own `-100%` (identical copies), never by a
    pixel value computed in JS.

## Testing notes

- **Layout-free machine.** Sizes reach the machine as `MEASURED { viewport, content }`
  (px along the axis). Reduced motion arrives as `MOTION.CHANGED`. Hover and focus arrive
  as events. Every transition and the derived copy count and duration run in Node.
- **Never time-based** (rules: no sleeps). The animation is a CSS animation. Browser
  tests read `data-state`, the CSS variables and `getAnimations()[0].playState` /
  `currentTime`. They do not watch pixels move. Progress-keeping is checked by reading
  `currentTime / duration` before and after a change, with the animation paused at a
  known `currentTime`.
- **Reduced motion.** Node: an injected `MotionPreference` fake. Browser: Playwright
  `page.emulateMedia({ reducedMotion: "reduce" })` (vitest browser:
  `page.emulateMedia` through the commands API), switched at runtime to check the live
  subscription.
- **Copies out of Tab.** jsdom and browser: no element inside a copy has `tabIndex >= 0`,
  also after a child renders a new link (mutation). Browser: Tab from the trigger walks
  only the original's links; a pointer click on a copy's link still activates it.
- **Focus reveal.** Browser: pause the animation at a time where the first link is
  outside the viewport, Tab into it, and check that its box intersects the viewport's box
  and that the viewport's `scrollLeft` is still 0.
- **axe:** no `aria-hidden-focus` (copies have no tabbable content), button named, no landmark by default.
- **Driver:**
  - actions: `togglePause()` (pointer / keyboard / virtual click on the trigger),
    `hover()` / `leave()` (pointer only; touch is a no-op by contract), `focusContent(name?)`
    (Tab from the trigger, or focus by role and name);
  - queries: `state()` (`idle` / `running` / `paused` / `static`), `isPaused()` (the
    user's pause), `triggerLabel()`, `copies()`, `copiesUntabbable()`.

## Decisions

- **Behaviour vs motion.** The motion is a CSS animation in the theme, driven by
  `data-state` and CSS variables. The machine owns only *whether* it may move (pause,
  hover, reduced motion, measured) and the numbers the CSS needs (copy count, duration).
  The DOM helpers own what CSS cannot do: measuring, keeping progress across timing
  changes, and seeking to a focused element. No `requestAnimationFrame` loop moves
  content in JS.
- **Parts:** `Root` (wrapper: no role, forwards `role` / `aria-*`), `PauseTrigger`
  (native `button`, placed before the Viewport), `Viewport` (the clip box: hover and focus
  listeners, measured), `Content` (the consumer's content; the part renders its copies,
  with the same element, after it). No `Item` part (spacing is the copy's gap, styled by
  the theme on children). No `Edge` part (the theme's `mask-image`).
- **Machine states:** `idle` (not measured yet: no motion), `running`, `paused`, `static`
  (reduced motion). Precedence: static > idle > paused > running. `paused` holds while
  the user paused (controllable) **or** a non-touch pointer hovers with `pauseOnHover`.
  Events: `MEASURED`, `MOTION.CHANGED`, `TRIGGER.PRESS`, `POINTER.ENTER`,
  `POINTER.LEAVE`, `FOCUS.ENTER`, `PAUSED.SYNCED`. **Keyboard** (or virtual) focus
  entering the Viewport sets the user pause (reason `focus`), as APG specifies. It does
  not resume on blur. A pointer press that focuses a link does not pause; hover already
  covers it.
- **Props:** `speed` (px/s, default 50), `orientation` (`horizontal` / `vertical`),
  `reverse`, `autoFill`, `pauseOnHover` (default **true**, APG), `paused` /
  `defaultPaused` / `onPausedChange(paused, { reason })`, `dir`, `messages`
  (`pause`, `play`). Reduced motion comes from `Environment.reducedMotion()`; there is no
  prop to override it.
- **Copies:** static → 1. Otherwise 2, each at least the viewport's size, so two always
  close the loop without measuring (react-fast-marquee). With `autoFill`:
  `ceil(viewport / content) + 1` copies of natural size, at most 32. Duration =
  one copy's size (with its trailing gap) / `speed`.
- **`data-*`:** every part `data-scope="marquee"`, `data-part`, `data-instance`,
  `data-state`, `data-orientation`, `data-reverse`. Content `data-index`, `data-copy`
  on copies. PauseTrigger `data-paused` while the user pause holds. CSS variables on the
  Viewport: `--rind-marquee-duration`. Theme variables: `--rind-marquee-gap`,
  `--rind-marquee-fade`.
- **Contract actions / queries:** as in Testing notes; trait `directional`.
- **Deliberately different from the others, and why:**
  - A pause control part and reduced-motion handling built in (none of them has both).
  - User pause, focus pause and hover pause are separate: hover never clears the
    user's pause, and focus pause is sticky (APG; Zag resumes on blur).
  - Copies are `aria-hidden` *and* free of tabbable content, but stay clickable (not
    `inert`).
  - The static layout wraps instead of clipping, so all content stays visible.
  - No region landmark or role description by default (Zag).
  - Progress survives every timing change (resize, font load, content, speed, reverse).
  - Server-rendered: the server HTML has the content and its copy; it does not wait for
    mount (react-fast-marquee).
  - No `loopCount`, `delay`, `onComplete` / `onLoopComplete` (RFM#101). Infinite loops
    only; a delay is `animation-delay` in the consumer's CSS.

## Open questions

- **Play only when overflowing** (RFM#103): with measurement in place, `running` could
  require `content > viewport`. Left out until someone asks. The `static` layout
  already handles the case visually.
- **Pause when off-screen or when the page is hidden.** Browsers already throttle
  off-screen and background CSS animations. `PageVisibility` exists in the Environment if
  a measurement ever shows a cost.
- **Drag to scrub** (RFM#93, #102, #53): a draggable marquee is a Carousel concern.
