## 0. Research and spec

- [x] 0.1 Research note `docs/research/marquee.md` (Zag / Ark, react-fast-marquee, Magic UI, Nuxt UI; APG Carousel rotation, WCAG 2.2.2; bug history; a11y)
- [x] 0.2 This change: proposal, design, `specs/marquee/spec.md`; `openspec validate add-marquee --strict`

## 1. Machine

- [x] 1.1 `marquee.machine.ts`: states `idle` / `running` / `paused` / `static` by the precedence of design §2; events with discriminated types; controllable user pause with `pending` and `PAUSED.SYNCED`; `FOCUS.ENTER` pauses for keyboard / virtual only; zero sizes → `idle`; `marqueeCopies`, `marqueeDuration`; speed clamp with a dev warning
- [x] 1.2 Node tests: precedence, hover vs user pause, sticky focus pause, reduced motion on / off, controlled refusal and arrival, copies (2, autoFill, cap 32, static 1), duration from copy size and speed

## 2. Connect

- [x] 2.1 `marquee.connect.ts`: parts and attributes per design §3, structural styles per state and orientation, `--rind-marquee-duration`, copy attributes, trigger name from messages, `hidden` in `static`
- [x] 2.2 `marquee.messages.ts` (`pause`, `play`)
- [x] 2.3 `core/dom/marquee-motion.ts`: `observeMarquee` (one ResizeObserver, frame-coalesced through the Scheduler), `retime`, `mirror`, `reveal`, `untabbable` (on `tabbable-content`, with a MutationObserver)
- [x] 2.4 Connect and meta tests (`marquee.meta.ts` checked against the code); dom tests for `untabbable` (jsdom) and for `retime` / `mirror` / `reveal` (browser)

## 3. React parts

- [x] 3.1 `Marquee.Root`, `PauseTrigger`, `Viewport`, `Content`: motion subscription after mount, hover (not touch), focusin with modality and reveal, measuring, retime / mirror in a layout effect, copies rendered with the same `render`, dev warning for ids in the content

## 4. Contract and driver

- [x] 4.1 `marquee.contract.ts`: anatomy, locate, actions, queries, trait, invariants per design §6
- [x] 4.2 `getMarquee` exported from `@rind-ui/testing`

## 5. Tests

- [x] 5.1 DOM tests (jsdom and browser): anatomy, server render and hydration, pause control and labels, controlled, hover (browser) and touch, sticky keyboard-focus pause, reduced motion via an injected `MotionPreference` and `emulateMedia`, copies hidden and untabbable (with a child adding a link later), copies clickable (browser), autoFill cap, speed, continuity on resize and reverse (browser, `currentTime` read, no waiting on time), focus reveal with `scrollLeft` 0, RTL and vertical
- [x] 5.2 Model-based tests over the configurations of design §7 in Chromium, Firefox and WebKit, keyboard / virtual in jsdom

## 6. Theme

- [x] 6.1 `packages/theme/src/marquee.css` per design §8, imported from `index.css`, `marquee` in the `decoration` family
- [x] 6.2 Browser test: play state per `data-state`, RTL keyframes, `mask-image` fade on / off, reduced-motion media query, trigger ≥ 24 px, forced colours

## 7. Site and docs

- [x] 7.1 Site example `apps/site/examples/marquee.tsx` (logos with links, text ticker, vertical, reverse, RTL, autoFill, controlled, `pauseOnHover={false}` with the trigger) and skin `apps/site/skins/marquee.css`, registered; state examples `paused` and `static`
- [x] 7.2 Replace the site's hand-built band (`apps/site/components/marquee.tsx`, `marquee.module.css`) with `Marquee`: the Viewport `aria-hidden` as today, a PauseTrigger added (2.2.2), the look kept through the module CSS
- [x] 7.3 Docs page `docs/components/marquee.md` with "When to use" (and when not: essential information), eager images, ids in content; `docs/components.md` status
- [x] 7.4 Changeset

## 8. Proof

- [x] 8.1 `pnpm lint`, `pnpm typecheck`, changed tests (node, jsdom, browser in three engines), site audit 0 findings (axe: no `aria-hidden-focus`)
