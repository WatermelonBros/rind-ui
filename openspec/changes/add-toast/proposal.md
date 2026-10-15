## Why

Apps need brief notifications ("Saved", "Couldn't connect", "Message archived — Undo")
that reach screen-reader users, can be acted on by keyboard before they vanish, stay
usable above a modal dialog and survive route changes. Every headless library that
ships Toast has repeated the same failures: a first toast that is never announced,
invalid roles on list elements, focus sentinels flagged by axe, timers that stop or
never resume, toasts lost when created before the toaster mounts, and toast presses
that close the open dialog. Reado's `Notice` (a zustand store called from library code)
migrates to this component.

Research: [toast](../../../docs/research/toast.md) (sources, Bug history, Accessibility,
decisions) · [accessibility](../../../docs/research/accessibility.md) §7 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) §1.4 ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) §4 ·
[native-platform](../../../docs/research/native-platform.md) §2, §13.

**Depends on** `add-foundations` (runtime, contracts, drivers, `testMachine`, React
adapter), `add-a11y-foundations` (announcer, keep-visible rule, hover, press,
modality, hotkey matching, messages, focus cause, quirks), `add-overlay-infrastructure`
(outside-inert keep-visible set, presence, portal), `add-collections` (the `Clock`
capability only), `add-tooltip` (the `timed` invariant and `focusWithTab`),
`add-drawer` (the `swipe-gesture` capability and its drag test input) and
`add-theme-system` (tier-3 tokens). It must be applied after all of them.

## What Changes

- `@rind-ui/core`: `createToaster(options)` — a framework-free store usable from any
  module (no provider, no React context), holding toasts, their timers and their
  machines; `show/success/error/info/warning/loading/promise/update/dismiss/pause/resume`;
  multiple toasters are multiple stores.
- A `toast` machine per toast (`timing | paused | persistent | dismissed`) and a
  `toaster` machine per store (`collapsed | expanded`), run as sibling services owned
  by the store; pause reasons as a set (pointer over the region, focus in it, document
  hidden, swipe, API, no region mounted).
- Announcements through the injected Announcer only (polite; assertive for errors);
  the region and toasts are not live regions.
- Native list semantics (`section` region > `ol` > `li`), rendered only while toasts
  exist; F6 hotkey into the newest toast and back; Escape dismisses the focused toast;
  no focus sentinels.
- Region marked `data-rind-top-layer`: exposed and pressable above modal layers.
- Stacking: collapsed stack expanded on hover/focus, measured heights exposed as CSS
  custom properties, `limit` visible toasts with older ones held, not dropped.
- Swipe to dismiss on the shared `swipe-gesture`; Escape and a close trigger as
  non-gesture alternatives.
- Promise toasts (loading → success / error, per-state options, stale-promise guard).
- Actionable toasts persist by default (WCAG 2.2.1).
- A small `page-visibility` environment capability (document hidden + subscription).
- `@rind-ui/react`: `Toaster` (region and list, render function per toast),
  `Toast.Root`, `Title`, `Description`, `ActionTrigger`, `CloseTrigger`.
- `@rind-ui/testing`: `getToaster` and `getToast` drivers, model-based tests with the
  `timed` and `presence` traits.
- Theme stylesheet (tier-3 `--rind-toast-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `toast`: the Toast component — store API, lifetime and pausing, announcements,
  region, focus and keyboard, stacking and limits, swipe, promise toasts, modal
  interplay, parts, `data-*`, contracts and drivers.
- `page-visibility`: the injected capability that reports whether the document is
  hidden and notifies on change, so machines pause without reading globals.

### Modified Capabilities

None. Capabilities this builds on are introduced by unarchived changes; requests for
additions to them are listed in design.md ("Requests to other changes").

## Non-goals

- Anchored toasts (Base UI `Positioner`, Reka `ToastPositioner`) and arrows.
- A progress-bar part or a per-frame remaining-time variable; the remaining time is a
  store query only.
- Rich JSX passed through the store: the store carries data (`title`, `description`,
  `type`, `action`, `meta`); rendering is the consumer's `Toaster` render function.
- Native `popover="manual"` top-layer promotion (Wave 2 spike in native-platform §2).
- On-screen keyboard avoidance on mobile (open question in the research note).
- Window blur as a pause reason; toast priorities/queue sorting (Zag).
- A global landmark manager for F6 across all regions (React Aria's).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/toast/{toaster.ts,toast.machine.ts,toaster.machine.ts,toast.connect.ts,toast.contract.ts,toaster.contract.ts,toast.messages.ts}`,
  `packages/core/src/dom/page-visibility.ts`, `packages/core/src/dom/toast-stack.ts`
  (height measurement), `packages/core/src/env` (`PageVisibility`),
  `packages/react/src/toast/*`, `packages/testing` exports and a fake visibility,
  `packages/theme/src/toast.css`, `apps/storybook/stories/toast.stories.tsx`, docs page.
- Public API: `createToaster`, toast machines/connect/contracts in core; `Toaster`,
  `Toast` parts in React; `getToaster`, `getToast` in testing.
- No new runtime dependency.
