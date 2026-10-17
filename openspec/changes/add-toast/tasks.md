## 0. Prerequisites

- [ ] 0.1 Confirm `add-foundations`, `add-a11y-foundations`, `add-overlay-infrastructure`, `add-collections` (`Clock`), `add-tooltip` (`timed` invariant, `focusWithTab`), `add-drawer` (`swipe-gesture`, drag input) and `add-theme-system` are applied
- [ ] 0.2 Confirm the request to `add-overlay-infrastructure` (design "Requests to other changes" 1: `[data-rind-top-layer]` is never outside for dismissal) is specified and implemented there

## 1. Page visibility capability

- [ ] 1.1 `core/env` `PageVisibility` (`hidden()`, subscribe) and its `domEnvironment()` implementation over `visibilitychange`; never window focus/blur
- [ ] 1.2 Fake visibility in `@rind-ui/testing`; node tests for both `page-visibility` scenarios

## 2. Store and machines (`core/components/toast/`)

- [ ] 2.1 `toast.machine.ts`: states `timing | paused | persistent | dismissed`, events per design §2, reasons set, `after: remaining` on scheduler + `Clock`, guards `noReasonsLeft`, `isPersistent`, `hasReasons`, `swipeDismisses` (45 px / 0.11 px/ms, non-null allowed direction), announcement effect
- [ ] 2.2 `toaster.machine.ts`: `collapsed | expanded`, region-level reasons (hover, focus, hidden, swipe), `expand` option
- [ ] 2.3 `toaster.ts` (`createToaster`): records with per-show instance keys, id dedupe vs re-show during exit, `attach`/detach with the `unmounted` reason, limit → `limited` reason, reason forwarding and inheritance, `promise()` with per-state options and stale-promise guard, synchronous ordered operations, `subscribe`
- [ ] 2.4 Node tests for every store/machine scenario in the spec (fake scheduler, clock, visibility, recording announcer), including radix#2233, #2268, zag#2238, #295, #2403, #2922, sonner#786, #791, react-spectrum#8131, #9930, mui/base-ui#2291

## 3. Connect (`toast.connect.ts`, `toast.messages.ts`) and DOM helpers

- [ ] 3.1 Region, list, root, title, description, action-trigger and close-trigger props per the spec's Region, Toast Semantics and Data Attributes requirements; relations only to registered parts; `data-rind-top-layer`; no `aria-live`
- [ ] 3.2 Stack CSS variables from presented order and heights; exiting record keeps its offset
- [ ] 3.3 `core/dom/toast-stack.ts`: layout-height measurement + ResizeObserver → `MEASURED`
- [ ] 3.4 `core/dom/toast-region.ts`: hotkey listener (shared matcher, only while toasts exist, `preventDefault`), edge Tab/Shift+Tab leave, focus on removal (newer → older → restore; pointer restores), Escape on a toast consumed
- [ ] 3.5 Swipe wiring through `trackSwipe` (prefix `toast`, directions from placement + `dir`), `data-swiping`, `data-swipe-direction`, `data-swipe-out`
- [ ] 3.6 Messages (`regionLabel`, `close`, `actionHint`, hotkey label, `announce`) and the dev warning for a persistent toast without a close trigger; unit tests for every attribute

## 4. React parts (`packages/react/src/toast`)

- [ ] 4.1 `Toaster` (portal, region, list, render function, `attach` while mounted, `announcer.prepare()`), `Toast.Root` with `usePresence`, `Title`, `Description`, `ActionTrigger`, `CloseTrigger`, `useToaster`; `render` prop on each
- [ ] 4.2 React tests: Strict Mode (no double toasts, sonner#592), SSR renders no region, unmount/remount keeps remaining time, two toasters

## 5. Contracts and drivers

- [ ] 5.1 `toaster.contract.ts` and `toast.contract.ts` per design §7 (keyboard twins, `{ skip }` events, traits `timed`, `presence`)
- [ ] 5.2 `getToaster` and `getToast` in `@rind-ui/testing`; driver tests in `browser`, `jsdom` and Playwright (swipe through the shared drag input)

## 6. Tests

- [ ] 6.1 One browser test per spec scenario; regression scenarios reproduce the cited issue first (radix#1362, #1750, #2268, #2368, #2584, #2906, #3190, #3634, #4115, #4141; zag#885, #2258, #2988, #3173, #3400; ark#2974, #3404, #3686; reka-ui#2469, #2486, #2611, #2626, #2776; mui/base-ui#3336, #3466, #4253, #5135, #5253, #5659, #5955; react-spectrum#5329; sonner#723, #762, #779)
- [ ] 6.2 `testMachine` over both contracts: all modalities incl. `virtual`, both directions, `timed` and `presence` invariants, axe per state
- [ ] 6.3 Virtual screen reader log: one announcement per show/update, assertive only for errors; toast above an open modal dialog (pressable, not inert, dialog stays open)

## 7. Theme (`packages/theme/src/toast.css`)

- [ ] 7.1 Tier-3 tokens `--rind-toast-*` defaulting to semantic tokens (decision 0007); collapsed/expanded stack from the CSS variables, gap filler, swipe and swipe-out, `@starting-style` entry, exit, safe-area insets, placements incl. RTL
- [ ] 7.2 Reduced motion, forced colors (border, type glyph), close trigger ≥ 24×24; Playwright forced-colors captures

## 8. Site examples

- [ ] 8.1 Site examples (apps/site/examples/toast.tsx, state examples for every contract state): Default, every type, action (Undo), promise, limit with held toasts, two toasters, above a modal dialog, RTL, expanded option; state examples for collapsed/expanded and a toast's states
- [ ] 8.2 A driver example (docs testing example); all examples pass axe on the themed component

## 9. Docs and manual checks

- [ ] 9.1 Docs page (generated API facts + guide: store outside React, actions and WCAG 2.2.1, hotkey discoverability, multiple toasters, Reado migration, testing with `getToaster`/`getToast`/`testMachine`)
- [ ] 9.2 Manual tier-1 pass (assistive-tech note §2.8): announcements (NVDA, JAWS, VO macOS/iOS, TalkBack), F6 in and out, Undo above a dialog, list position spoken; record "Tested with"
- [ ] 9.3 Mark `docs/research/toast.md` done at archive; update `docs/components.md` status as work progresses
- [ ] 9.4 `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` green; changeset
