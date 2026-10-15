## 0. Prerequisite

- [x] 0.1 Confirm `add-foundations` is applied (machine runtime, `Environment`, contracts, drivers, `@rind-ui/testing/setup`, `testMachine`); this change builds on its APIs and must not start before

## 1. Layer stack (`core/dom/layer-stack.ts`)

- [x] 1.1 Types `LayerId` (branded), `LayerKind`, `LayerOptions`, `LayerHandle`, `LayerStack`; `getLayerStack(doc)` stored under `Symbol.for("rind-ui.layer-stack@1")` with a dev warning on shape mismatch
- [x] 1.2 `push` (idempotent per id), explicit parent with DOM-containment fallback via `opener`, `contains` over descendants, `topmost`, `topmostModal`, `meta()`
- [x] 1.3 `release()` dismisses descendants with `parent-dismissed` (topmost first) and moves the layer to `exiting`; `dispose()`; `isExitingAt(x, y)`; `subscribe`
- [x] 1.4 Browser tests for every `layer-stack` scenario, including two copies of the module in one page (load the built entry twice) and an iframe document

## 2. Dismiss (`core/dom/dismiss.ts`)

- [x] 2.1 Document `keydown` router (bubble, `defaultPrevented`, IME guard, not deferred) to `topmost()`
- [x] 2.2 Capture-phase pointer tracking: down-after-registration, down+up outside, primary button, no macOS Ctrl-click, single touch, scrollbar test, connected target, `isExitingAt`, nodes-present-at-open set; mouse on `pointerup`, touch/pen on `click`; bare `click` never outside
- [x] 2.3 Cascade rule (stop at containing layer, veto, modal; modal only if topmost at press start); one gesture dismisses once
- [x] 2.4 Outside focus for non-modal layers (ignore `null`, descendants, late nodes, active press)
- [x] 2.5 `DismissRequest` with `cancel()`; per-source enable flags
- [x] 2.6 Browser + jsdom tests for every `dismissable-layer` scenario, each regression scenario reproducing the cited issue first

## 3. Focus containment (`core/dom/focus-scope.ts`, `focus-restore.ts`)

- [x] 3.1 Sequential-order helper: positive `tabindex`, radio groups as one stop, keyboard-focusable scrollers, shadow roots, skips inert/hidden
- [x] 3.2 `focusInitial` (consumer choice incl. `false`, `[data-autofocus]`, first tabbable, container with `tabindex=-1`, touch → container, `preventScroll`, within one frame via `env.scheduler`)
- [x] 3.3 `trapTab` document singleton driven by `topmostModal()`; pause/resume without moving focus; wrap with `preventScroll`; one/zero tab stops
- [x] 3.4 Recovery `MutationObserver` keyed on the last focused element being disconnected
- [x] 3.5 `captureFocus` with opener, previously focused, bounded `WeakRef` history, parent-layer fallback; restore only when focus is inside the layer or on `body`; never focus inside `inert`
- [x] 3.6 Browser tests for every `focus-containment` scenario (host + iframe, shadow root, TalkBack-style `body` activeElement, open-at-mount, fake-timer teardown)

## 4. Outside hiding (`core/dom/inert-outside.ts`)

- [x] 4.1 `inertOutside(keep)` walk with ref counts and author-`inert` memory; never `<html>`/`<body>`; no `aria-hidden`
- [x] 4.2 Stack-driven singleton: recompute on topmost-modal change; keep-exposed set from the `announcer` keep-visible rule (add-a11y-foundations) plus `script`/`style`/`template`/`link`; late nodes untouched
- [x] 4.3 Closing content `inert` from close until `dispose()`
- [x] 4.4 Browser tests for every `outside-inert` scenario (toast above modal, nested modal portal ancestors, password-manager node inserted after open, author `inert` preserved)

## 5. Scroll lock (`core/dom/scroll-lock.ts`)

- [x] 5.1 Ref-counted `lockScroll(doc)`; scroller detection (`scrollingElement` vs `body` under `overflow: hidden` `<html>`)
- [x] 5.2 Compensation: padding on inline-end unless `scrollbar-gutter: stable` in effect; `--rind-scrollbar-width`; `data-rind-scroll-locked`; never set `scrollbar-gutter`; no scroll-position change (smooth scrolling pages)
- [x] 5.3 Snapshot and exact restore; `MutationObserver` adopting foreign style changes while locked
- [x] 5.4 iOS touch policy read from the stack at `touchstart`; allow pinch, ranges, selection handles; `overscroll-behavior: contain` on layer elements
- [x] 5.5 Stack-driven singleton (locked iff any modal layer)
- [x] 5.6 Browser tests (Chromium, Firefox, WebKit) for every `scroll-lock` scenario; iOS scenarios added to the manual device checklist in `docs/research/assistive-tech-and-a11y-testing.md` §2.8

## 6. Presence (`core/presence/`, `core/dom/presence.ts`)

- [x] 6.1 Presence machine (`present | exiting | absent`; `OPEN | CLOSE | EXIT_DONE`) with `waitForExit` as an injected effect
- [x] 6.2 `waitForExit` over `getAnimations()` (own element by default, finite only, replaced-animation re-check, immediate when unsupported / nothing running / document hidden)
- [x] 6.3 `node` tests of the machine graph; browser tests for transitions, keyframes, WAAPI, early-finished animation, infinite spinner, reopen during exit

## 7. Portal and the overlay effect (`core/dom/portal.ts`, `core/dom/overlay.ts`)

- [x] 7.1 `resolvePortalTarget` (container → open modal dialog / popover / fullscreen containing the logical parent → shadow root → body)
- [x] 7.2 `overlayEffect(env, options)`: push → initial focus; cleanup: release → synchronous inert/scroll recompute → restore focus; same path on `stop()`
- [x] 7.3 Browser tests for every `portal` scenario except hydration (React, task 8.4) and for the cleanup order (react-spectrum#10610)

## 8. React glue (`@rind-ui/react`)

- [x] 8.1 `LayerProvider` context carrying the parent `LayerId`
- [x] 8.2 `Portal` part: client-only mount, host `div[data-rind-portal]` with `dir`/`lang` from the logical parent, reactive `container`, `render` prop support
- [x] 8.3 `usePresence(open, ref)` with `flushSync` unmount, `keepMounted`, `onExitComplete`
- [x] 8.4 Tests: Strict Mode double mount, unmount while open, SSR + hydrate with `defaultOpen`, synthetic events bubbling through the portal (mui/base-ui#2312)

## 9. Testing support (`@rind-ui/testing`)

- [x] 9.1 `modal` trait invariants (outside inert, focus inside topmost modal, scroll locked, no body `pointer-events`; unlocked and clean when nothing is open)
- [x] 9.2 DOM-clean snapshot invariant for every `layer` contract, also after unmount-while-open and under Strict Mode
- [x] 9.3 `presence` trait invariants (closed state while mounted, removal after finite animations, same node on reopen)
- [x] 9.4 Adapter support in DOM and Playwright adapters: press outside every layer (not on a scrollbar), press at a part's position, wait for detach, computed inertness; jsdom run summary notes unexercised inert behaviour
- [x] 9.5 Tests that a deliberately broken fixture variant (no inert, stuck `overflow`, focus left on `body`, never-unmounting content) fails each invariant with a readable report

## 10. Fixture, stories, theme

- [x] 10.1 `packages/testing/fixtures/layer/`: machine, connect (`data-state`, `data-nested`, `data-has-nested`, `--layer-index`, `--nested-layer-count`), contract (traits `layer`, `modal`, `restores-focus`, `presence`; actions `open`, `close`, `pressEscape`, `pressOutside`, `tab`, `shiftTab`, `waitForUnmount`; queries `isOpen`, `hasFocus`, `isTopmost`), driver, React parts
- [x] 10.2 `testMachine` over the fixture in browser and jsdom projects, all modalities including `virtual`
- [x] 10.3 Stories (Storybook, axe on): nested modals, sibling modals, menu-in-dialog, toast above modal, third-party portal in a dialog, native `<dialog>` interop, shadow root, fullscreen, RTL, exit animations; Playwright driver run against them
- [x] 10.4 `@rind-ui/theme`: base rules for `[data-rind-portal]`, `@starting-style` entry and `[data-state=closed]` exit examples for layer parts, fixed elements compensating with `--rind-scrollbar-width`, no `[hidden]{display:none}` override

## 11. Docs

- [ ] 11.1 Mark `docs/research/overlay-infrastructure.md` done once the specs are archived; add any new bug found during implementation to its Bug history
- [x] 11.2 Docs page "Overlays" (generated API facts + hand-written guide): layer parentage, `data-rind-top-layer`, rind components inside a native `<dialog>`, scroll-lock compensation variable, presence with JS animation libraries, testing with the `modal`/`presence` traits
- [x] 11.3 Add the iOS scroll-lock and VO-announcer-under-modal checks to the manual release protocol
- [x] 11.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset for `@rind-ui/core`, `@rind-ui/react`, `@rind-ui/testing`, `@rind-ui/theme`

## 12. Amendments from add-dialog

- [x] 12.1 Stacking family on registration (defaults to kind); stacking metadata counts per family; test with alertdialog over dialog
- [x] 12.2 Dismiss surfaces: registration option; presses that start and end on a surface count as outside; tests for backdrop, selection ending on backdrop, positioner area

## Amendments (from add-theme-system)

- [x] A.1 Portal host copies and syncs `data-rind-theme` and `data-theme` too (`portal` → Portal Host Attributes); tests for tenant theme and live scheme switch
- [x] A.2 Presses and focus inside `[data-rind-top-layer]` never count as outside (dismissable-layer); test toast action above a modal dialog
- [x] A.3 From add-slider: iOS scroll lock never prevents a touch starting inside an element whose `touch-action` excludes the gesture's axis (RA#9493)

## Amendments (from add-field)

- [x] A.4 `layer-stack`: `isLogicallyInside(target, element)` — inside the element's subtree, or inside a layer whose opener / ancestor layers' openers or elements are inside it; `null` → false; `node`/jsdom tests for a portalled Select popup in a Field, a nested tooltip from that popup, and an unrelated dialog

## Amendments (from add-scroll-area)

- [x] A.5 `focus-containment`: export `tabbables(container): HTMLElement[]` from `core/dom` (the order Tab wrapping uses; `trapTab` calls it); test for "Helper matches the wrap order"
