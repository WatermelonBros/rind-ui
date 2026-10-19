## Why

A marquee is moving content that starts by itself and never stops, so WCAG 2.2.2 (Pause,
Stop, Hide) always applies to it. Ark (through Zag) is the only one of the nine libraries
that ships one. Zag and the common implementations outside the nine (react-fast-marquee,
Magic UI, Nuxt UI) all repeat the same bugs:

- no pause control, and no reduced-motion handling except Nuxt UI's;
- duplicated copies that screen readers read and Tab reaches;
- hover clearing a pause the user chose;
- a jump whenever the duration or direction changes;
- speed that depends on the content length;
- broken RTL;
- a runaway auto-fill that freezes the page;
- nothing in the server HTML.

The docs site's own band (`apps/site/components/marquee.tsx`) has no pause control and
ignores reduced motion. This change adds a Marquee that the site can use in its place.

Research: [marquee](../../../docs/research/marquee.md) ·
[accessibility](../../../docs/research/accessibility.md) §1 (2.2.2), §2 (Carousel), §8
(reduced motion), invariants 20, 26 ·
[native-platform](../../../docs/research/native-platform.md) §10

Depends on: `add-foundations` (machine runtime, Environment with `MotionPreference` and
`Scheduler`), `add-a11y-foundations` (modality, messages), `add-button` (press),
`add-theme-system`.

## What Changes

- A public **Marquee** in `@rind-ui/core` (machine, connect, contract, messages, meta)
  and `@rind-ui/react` (parts `Root`, `PauseTrigger`, `Viewport`, `Content`; Content
  renders the loop's copies).
- Motion is a CSS animation in the theme, driven by `data-state` and
  `--rind-marquee-duration`. The machine decides whether the content may move: user
  pause, hover, reduced motion, measured. `core/dom` measures sizes, keeps the
  animation's progress across timing changes, and seeks to bring a focused element into
  view.
- Props: `speed` (px/s), `orientation`, `reverse`, `autoFill`, `pauseOnHover` (default
  on), controllable `paused` / `defaultPaused` / `onPausedChange`, `dir`, `messages`.
- Reduced motion (from the Environment) gives a static, wrapped layout with no copies.
  Keyboard focus entering the content pauses it until the user presses Play (APG).
  Copies are `aria-hidden`, with their tabbable content taken out of the Tab order.
  They stay clickable.
- `getMarquee` driver, model-based tests, `marquee.css` (family `decoration`), site
  example and skin, docs page. The site's hand-built marquee is replaced.

## Capabilities

### New Capabilities

- `marquee`: the Marquee component. Covers anatomy, motion states, pause control,
  hover and focus pause, reduced motion, copies and hiding, measurement and speed,
  timing continuity, focus reveal, direction, data attributes, contract, invariants and
  theme.

### Modified Capabilities

None.

## Non-goals

- `loopCount`, `delay`, `onComplete` / `onLoopComplete`: loops are infinite. A delay is
  `animation-delay` in the consumer's CSS.
- An `Edge` part for fades: the theme uses `mask-image`.
- Scrolling only when the content overflows, pausing off-screen or in a hidden page,
  and drag-to-scrub (research open questions).
- A prop that overrides `prefers-reduced-motion`.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/marquee/`, `packages/core/src/dom/marquee-motion.ts`
  (measure, keep progress, seek), `packages/react/src/marquee/`, `getMarquee` in
  `@rind-ui/testing`, `packages/theme/src/marquee.css` (`decoration` family), site example
  and skin, `docs/components/marquee.md`.
- Changed: `apps/site/components/marquee.tsx` (uses the component), and
  `apps/site/components/marquee.module.css` (reduced to the site's look).
- No new dependency.
