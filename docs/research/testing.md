# @rind-ui/testing — research

Status: done · Infrastructure (needed by every wave; first used by Dialog in
`openspec/changes/add-foundations`)

## Summary

Three libraries ship testing helpers for consumers. Each one solves a different
third of the problem, and none of them solves the whole thing:

- **React Aria `@react-aria/test-utils`** has per-pattern *testers* (`Select`,
  `Menu`, `Table`, …). They work on behaviour: open, pick an option, check that
  focus came back. They are hand-written classes (~3.9k lines), tied to the DOM
  and React, and you cannot run them from Playwright.
- **`@ariakit/test`** is a low-level event layer (`click`, `press`, `type`, `q`)
  that copies browser default actions (Tab order, label clicks, text input) into
  happy-dom/jsdom. It has no knowledge of components. It also has a Playwright
  entry, but that entry only shares query *names*, so every example is written
  twice.
- **Zag** puts its behaviour tests in Playwright page-object "models"
  (`e2e/models/*.model.ts`). They locate parts by `data-part`, are not exported,
  and are not role-based.

rind-ui does all three. Each component's **contract** declares its parts,
actions, queries and the observable shape of each machine state. From the
contract we **generate** a typed driver. The driver runs against an async
`Env` interface, which has two adapters: Testing Library (jsdom/happy-dom/Vitest
browser) and Playwright. `testMachine` walks the machine graph. A headless copy
of the machine serves as the oracle, and the runner checks generic and
per-component invariants after every step. `@rind-ui/testing/setup` contains
exactly the polyfills our own `core/dom` would otherwise trip over, and nothing
that fakes layout.

## Prior art

### React Aria — `@react-aria/test-utils`

Source: `react-spectrum/packages/@react-aria/test-utils/src/` (`user.ts`,
`types.ts`, `select.ts`, `utils.ts`, `act.ts`, `testSetup.ts`), `1.0.0-rc.1`.

- **API.** `new User({ interactionType, advanceTimer })` wraps
  `userEvent.setup({ delay: null, pointerMap })`. `user.createTester("Select",
  { root })` maps pattern names to classes via a hand-written conditional-type
  ladder (`Tester<T>`, `TesterOpts<T>` in `user.ts`). Testers have actions
  (`open`, `close`, `toggleOptionSelection`) and *sync* getters returning
  `HTMLElement` (`getTrigger`, `getListbox`, `getOptions`, `findOption`).
- **Portals** are found by following ARIA relations, not containment: the listbox
  is `document.getElementById(trigger.aria-controls)` (`select.ts`). Right idea.
- **Postconditions inside actions.** `open()` waits for the listbox; `close()` and
  single-select `toggleOptionSelection()` wait for focus to return to the trigger
  and throw if the listbox is still mounted. The tester fails when the
  *component* is wrong.
- **Interaction types** `mouse | keyboard | touch`, per user, per tester or per
  call. Keyboard selection walks arrow keys from the active option; touch uses
  `user.pointer({ keys: "[TouchA]" })` with a custom `pointerMap`.
- **Timers.** `advanceTimer` is injected (default: real `setTimeout`). It is used
  by `triggerLongPress` (`utils.ts`, a hand-fired `fireEvent` sequence) and tables.
- **jsdom vs browser.** `act.ts` wraps in `act` only when `IS_REACT_ACT_ENVIRONMENT`
  is set or `jest` exists ("breaks vite browser test" otherwise). The same
  testers run in a Vitest browser project (`vitest.browser.config.ts`,
  `react-aria-components/test/ListBox.browser.test.tsx`), but input there is
  still synthetic user-event. jsdom gaps are opt-in exports:
  `installPointerEvent()`, `installMouseEvent()` (`testSetup.ts`).
- **Strengths:** behaviour-level API, postconditions, modality as an option,
  injected timers, works on any component that follows the ARIA pattern.
- **Limits:** hand-written, so it can drift (no contract); React 18+ only;
  DOM-only (returns `HTMLElement`, reads `document.activeElement`), so no
  Playwright; sync getters can't port to locators; no generated coverage; root
  detection is a heuristic ("the button with `aria-haspopup`").

### Ariakit — `@ariakit/test`

Source: `ariakit/packages/ariakit-test/src/` (`dispatch.ts`, `shims.ts`,
`__utils.ts`, `sleep.ts`, `click.ts`, `press.ts`, `query.ts`, `playwright.ts`).
Experimental, no semver.

- **Own event dispatch, not user-event.** It builds events with Testing
  Library's `createEvent`/`fireEvent` and re-implements default actions: label →
  input forwarding (`click.ts`), Tab order via `getNextTabbable` (`press.ts`),
  radio groups, happy-dom's dropped disabled clicks (happy-dom#2190). It exists
  because user-event's browser model was not faithful enough for composite
  widgets (focus, pointer members, event order).
- **Act.** `wrapAsync` (`__utils.ts`) turns the React act environment *off* while
  events run (depth-counted), then settles with frame → microtasks → frame and a
  final `sleep()` of 4 ms (jsdom) / 150 ms (browser): "a few milliseconds remain
  load-bearing … hiding a dialog by clicking outside" (`sleep.ts`).
- **Shims on import** (`shims.ts`): `focus()` no-op on non-focusables;
  `getClientRects` returns `[{width:1,height:1}]` for anything not hidden; no-op
  `scrollIntoView` and pointer capture; `ClipboardEvent`; mouse-event members.
- **Queries** `q.combobox("Position")`, `q.grid.maybe()`. `@ariakit/test/playwright`
  offers the same names over `getByRole(role, { name, exact: true })`, yet
  Ariakit's examples still keep two files each, `test.ts` (happy-dom) and
  `test-browser.ts` (e.g. `app/src/sandbox/combobox-select-4593/`): shared
  vocabulary, duplicated code. DOM projects run on happy-dom, "~2x faster than
  jsdom" (`vitest.config.ts`).
- **Lessons:** fake layout becomes something tests depend on; a per-environment
  settle delay means work is scheduled through timers the test can't see;
  Playwright role names need `exact: true`.

### Zag and Ark UI

Sources: `zag/e2e/models/{model,select.model}.ts`, `zag/e2e/_utils.ts`,
`zag/playwright.config.ts`, `zag/packages/frameworks/react/vitest.setup.ts`,
`ark/packages/react/src/setup-test.ts`, `ark/packages/react/vite.config.mts`,
`ark/packages/react/src/components/select/tests/select.test.tsx`.

- **Zag tests behaviour in Playwright** (~70 `e2e/*.e2e.ts` against example
  apps, `FRAMEWORK` picks Next/Nuxt/Solid/Svelte/Preact) through page-object
  models (`SelectModel.clickTrigger()`, `seeDropdown()`). This is the nearest
  thing to a driver in the Ark world, but it is internal and locates by
  `[data-scope=select][data-part=trigger]`, not role. Unit tests (jsdom) cover
  utilities and framework bindings; the setup is only jest-dom.
- **DOM APIs Zag machines use** (grep of `packages/`): `scrollIntoView` (select,
  combobox, menu, listbox, tour, toc), `ResizeObserver` (`dom-query`,
  navigation-menu, scroll-area, marquee), `IntersectionObserver` (carousel,
  scroll-area, toc), `setPointerCapture` (splitter, signature-pad,
  floating-panel), `getAnimations` (presence). Presence *assumes an animation is
  running* when `getAnimations` is missing
  (`machines/presence/src/presence.machine.ts:253`). In jsdom, a stylesheet with
  an exit animation keeps content mounted until an `animationend` that never fires.
- **Ark** runs on happy-dom with jest-dom + `vitest-axe` and **no polyfills** at
  HEAD (the Vue `scrollTo` mock that ark#3185 links to is gone). Tests use
  Testing Library + user-event with `waitFor` after nearly every interaction (38
  in select/menu/dialog/tooltip). Its own Select test needs
  `getByText("React", { ignore: "option" })` because the hidden native `<select>`
  duplicates every label. A few tests are `it.skip` (slider, tags-input a11y).

### Base UI and Radix

Sources: `base-ui/vitest.shared.mts`, `base-ui/test/setupVitest.ts`,
`radix/scripts/setup-tests.ts`, `radix/vitest.config.mts`, `radix/playwright.config.ts`.

- **Base UI** runs **one suite in jsdom and in real browsers**
  (`VITEST_ENV=chromium|firefox|webkit|all-browsers` turns on Vitest browser mode).
  The cost: **511 `skipIf(isJSDOM)` and 93 `skipIf(!isJSDOM)`** in
  `packages/react/src`. Environment differences are skipped, not abstracted.
  Animations are disabled by a global (`BASE_UI_ANIMATIONS_DISABLED`); under
  jsdom `requestAnimationFrame` becomes `setTimeout(cb, 0)`; the frame scheduler
  is reset in `afterEach`.
- **Radix** unit tests run on jsdom; the setup fakes `ResizeObserver` (calls back
  on `observe` with a 0×0 box) and no-ops `scrollIntoView`. Playwright e2e runs
  against Storybook, `hasTouch`, with a 20 s expect timeout "while menus/popovers
  animate".

### Model-based testing prior art

- **`@xstate/graph` / `@xstate/test`.** `createTestModel(machine)` →
  `getShortestPaths()` / `getSimplePaths()`; each path runs with
  `path.test({ states: {…assertions}, events: {…executors} })`. We take: the
  machine is the model, one test per path, states → assertions, events →
  executors, "all states" / "all transitions" coverage. We leave: simple paths
  explode, and assertions in machine `meta` mix test code into the definition
  (ours live in the contract).
- **fast-check.** `fc.commands([...])` + `fc.asyncModelRun(setup, cmds)`; each
  `Command` has `check(model)`, `run(model, real)`, `toString()`; failures shrink
  to a minimal sequence, replayable from a seed. We take: run a model next to the
  real system and compare after every command. Our model is free: the pure
  machine, run headless, is the oracle. Random walks with shrinking are a later,
  optional strategy (Open questions); the graph walk needs no dependency.

### Playwright locators vs Testing Library queries

What a shared adapter has to hide:

| Concern | Testing Library | Playwright | `Env` decision |
|---|---|---|---|
| Sync/async | `getBy*` sync; `findBy*` async | everything async | everything async |
| Resolution | eager: an element *now* | lazy `Locator`, resolved per action | lazy `Part` handles |
| Waiting | none; `waitFor`/`findBy` polling | actions auto-wait for actionability; `expect` retries | actions wait for the part; queries read once; `until()` polls in both |
| Multiple matches | `getBy` throws | strict mode throws | throw, and print every match |
| Role name match | exact string by default | **substring, case-insensitive** by default | always `exact: true` (Ariakit does the same) |
| Hidden elements | excluded (jsdom CSS is partial) | excluded | excluded; a duplicated role is an invariant failure |
| Input | user-event: synthetic, pointer at (0,0) | real CDP input | DOM adapter takes a pluggable `user` (user-event or `vitest/browser`) |
| Key names | `"{Escape}"`, `"[ArrowDown]"` | `"Escape"`, `"ArrowDown"` | typed `Key` union, mapped per adapter |
| Focus | `document.activeElement` | `locator.evaluate(el => el === document.activeElement)` | `part.isFocused()`, `env.focused()` |
| Portals | `within(container)` misses them | page-wide by default | parts resolve document-wide, scoped by instance |
| act / framework flush | `getConfig().asyncWrapper` / `eventWrapper` (set by `@testing-library/react`) | n/a | DOM adapter calls through TL's config, so it stays framework-neutral |
| Timers | fake timers possible; must be advanced | real browser clock (`page.clock` optional) | `advanceTimers` injected, as in RA / user-event |

## Pain points in practice

### Reado (`/Users/urion/Projects/Watermelon/reado`)

`vitest.config.ts` has three projects: `ui` on happy-dom (`*.uitest.tsx`;
`src/test/setup.ts` is only jest-dom, cleanup and an i18n mock) and `browser` in
Vitest browser mode on Chromium (`*.browser.tsx`; `src/test/browserSetup.ts`
loads the real CSS, fonts and i18n, plus a fake backend). In the browser project
`onConsoleLog` filters React act warnings as "noise". Workarounds, all under
`src/components/**/__tests__/`:

1. **A Select that won't open.** `SettingsControls.uitest.tsx:117`: the
   theme-mode select "won't open under happy-dom (pointer and keyboard both leave
   it closed), so any test of it would assert the harness". The test drives the
   store instead.
2. **The hidden native `<select>` duplicates roles.** `SettingsControls.uitest.tsx:107`
   falls back to `querySelectorAll('[data-scope="select"][data-part="trigger"]')`
   plus a text filter; `SettingsTabs.uitest.tsx:92` does
   `findAllByRole("combobox").find(…)`.
3. **Dialog content only mounts under real timers.** `DefaultAppPrompt.uitest.tsx:24`
   advances fake timers, then switches back to real ones ("Ark's dialog machine …
   doesn't advance under faked timers"). `AuditDialog.uitest.tsx:6` and
   `Settings.uitest.tsx:4` say never to hold fake timers around an Ark dialog.
4. **Ordering differs from the browser.** In `SearchResultsEditor.uitest.tsx:1`,
   `lazyMount` mounts a commit after `open`, which "jsdom does not reproduce". In
   `ContextMenu.uitest.tsx` an outside-click bug was found "only [by] a real
   mouse … this DOM dispatches in an order that hides the bug", so the test spies
   on `addEventListener`.
5. **Tooltip is not tested.** `Tooltip.uitest.tsx:4`: "the hover bubble itself is
   Ark/portal + delay driven and not asserted here".
6. **Zero layout and missing globals.** `getBoundingClientRect` is mocked in
   `ContextMenu`, `GlobalTooltip`, `BrowserPanel` and `KnowledgeGraph`.
   `visualViewport` is stubbed ("Ark's positioner reaches for it",
   `OnboardingTour.uitest.tsx:14`) and so is `matchMedia` (`Mascot.uitest.tsx:13`).
   Clicking a disabled item needs `pointerEventsCheck: 0`
   (`ContextMenu.uitest.tsx:80`).
7. **The same helpers, rewritten everywhere.** `pick`/`choose`/`openMenu`/`openTab`
   appear in `SettingsControls`, `GuidedReviewSources`, `GitPanelMore`,
   `GuidedReviewSession`, `GitPicker`, `FileTree` (×3), `TerminalPanel` (×2),
   `DockRegion` and `CodeView` (×2). Some follow `aria-controls` by hand
   (`ExtensionsPanel.uitest.tsx:66`).
8. **Two query vocabularies.** `__tests__/overlays.browser.tsx` mixes Testing
   Library `screen` with `vitest/browser` `page`/`userEvent`.

### Issue trackers

- **zag#3298**: `Menu.onSelect` no-ops after the first click on happy-dom.
  focus-visible ignores `pointermove` at an unchanged position, and user-event
  puts every pointer at (0,0). **zag#1920**: the Menu trigger won't open under
  user-event because of `preventDefault()` on pointerdown; the workaround is
  `fireEvent`. **ark#2746**: Menu `data-state` stays `closed` in happy-dom and
  jsdom from 3.4.0, a zag regression a browser-only suite could not see.
- **zag#1697**, **ark#3185**: `scrollTo is not a function` / `reading 'scrollTo'`
  (Select, Carousel). The answer was "copy Ark's setup file".
- **zag#2680**: NumberInput types characters out of order in 5–40% of runs
  ("allow a slight delay"). **ark#2049**: controlled NumberInput `onValueChange`
  is wrong in the testing DOM. **ark#1206**: `Pressable` `onClick` doesn't fire in
  jsdom/happy-dom, closed as "works in the browser".
- **zag#3390**: a tooltip unmounted while open leaves a global store set, so
  later tooltips skip `openDelay`. State leaks across tests.
- **ark#3792**: RadioGroup options can't be found with Playwright
  `getByRole("radio", { name })` because the hidden input has no accessible name.

The pattern: these are **harness/component mismatches nobody owns**. The library
tests in a browser, consumers test in a simulated DOM, and neither suite runs the
other's environment.

## Requirements for @rind-ui/testing

1. One driver API for both environments. Moving a test from Testing Library to
   Playwright changes the argument, not the test.
2. Drivers are generated from the contract; nothing per-component is
   hand-written in `@rind-ui/testing`.
3. Location by role + exact accessible name first, then `data-scope`/`data-part`.
   A missing or duplicated accessible name fails (ark#3792: an unnamed hidden radio input; and the duplicated roles a hidden native `<select>` causes).
4. Portalled parts are found document-wide yet belong to the right instance.
5. Actions end on their postcondition; queries read the current state, and
   `until()` polls.
6. Modality (pointer/keyboard/touch) is explicit and enumerable.
7. No timer assumptions: `advanceTimers` is injected, and rind-ui machines work
   under `vi.useFakeTimers()` (Reado #3).
8. No act code of our own. We go through Testing Library's
   `asyncWrapper`/`eventWrapper`, which keeps us framework-neutral.
9. The setup polyfills only what is missing, never fakes layout, and resets
   rind-ui globals after each test (zag#3390).
10. Deterministic state + transition coverage, one readable test per path, usable
    by consumers in both environments.
11. Optional peers: a Playwright user doesn't install Testing Library, and the
    reverse.

## Decisions

### (a) The environment contracts are written against

Lives in `@rind-ui/core` (`core/src/contract/`) because contracts live in core.
It is types only, plus `contract()`. It has no DOM and no adapter code.

```ts
// core/src/contract/env.ts
export type Key =
  | "Enter" | "Escape" | "Space" | "Tab" | "Home" | "End" | "PageUp" | "PageDown"
  | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Backspace" | "Delete"
export interface KeyOptions { readonly shift?: boolean; readonly alt?: boolean; readonly mod?: boolean }

export type Modality = "pointer" | "keyboard" | "touch"

/** How to find an element. Role + exact name first; part only as a fallback. */
export type By =
  | { readonly role: AriaRole; readonly name?: string | RegExp }
  | { readonly text: string | RegExp }

/** A lazy handle, like a Playwright Locator: resolved on every call, never cached. */
export interface Part {
  click(): Promise<void>
  tap(): Promise<void>
  hover(): Promise<void>
  focus(): Promise<void>
  press(key: Key, options?: KeyOptions): Promise<void> // focuses first if needed
  type(text: string): Promise<void>
  attr(name: string): Promise<string | null>
  text(): Promise<string>          // whitespace-normalised textContent
  value(): Promise<string>         // form controls
  exists(): Promise<boolean>       // attached and not hidden
  isFocused(): Promise<boolean>    // also true for aria-activedescendant target
  count(): Promise<number>
  nth(index: number): Part
  all(): Promise<readonly Part[]>
}

export interface Env<P extends string = string> {
  /** A part of *this* instance, wherever it is portalled. Refine with `by`. */
  part(name: P, by?: By): Part
  /** Anywhere in the document (e.g. "the element outside"). */
  find(by: By): Part
  focused(): Part
  keyboard(key: Key, options?: KeyOptions): Promise<void> // to the active element
  pointerOutside(): Promise<void>                         // press on <body> outside all layers
  /** Poll `read` until `accept` holds or the timeout ends; same loop in both adapters. */
  until<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T>
  /** Advance time when the test uses fake timers; resolves after a frame otherwise. */
  advance(ms: number): Promise<void>
  readonly modality: Modality
}
```

**Instance scoping.** Every part rendered by `connect` carries
`data-scope`, `data-part` and `data-instance="<machine id>"`. A driver is
created from an *anchor*: the element found by the contract's `locate` (role +
name), usually the root or trigger. It reads that element's `data-instance`, and
`part(name)` then resolves to `[data-scope=S][data-part=name][data-instance=I]`
across the whole document. Portals work, two instances don't collide, and no
heuristic is needed (unlike RA's "the button with `aria-haspopup`").

### Contract shape

```ts
// core/src/components/select/select.contract.ts
export const selectContract = contract("select", {
  anatomy: ["root", "label", "trigger", "value-text", "content", "item"],
  locate: (name: string) => ({ role: "combobox", name }),       // the anchor
  actions: {
    open: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Enter"),
      done: (q) => q.isOpen(),                                  // postcondition
    },
    choose: {
      pointer: (env, label: string) => env.part("item", { role: "option", name: label }).click(),
      keyboard: async (env, label: string) => { /* arrows to label, Enter */ },
      done: (q, label) => q.value().then((v) => v === label),
    },
    close: { keyboard: (env) => env.keyboard("Escape"), done: async (q) => !(await q.isOpen()) },
  },
  queries: {
    isOpen: async (env) => (await env.part("trigger").attr("aria-expanded")) === "true",
    value: (env) => env.part("value-text").text(),
    options: async (env) => Promise.all((await env.part("item").all()).map((p) => p.text())),
  },
  /** Machine state → what must be observable. Used by testMachine. */
  states: { closed: { isOpen: false }, open: { isOpen: true } },
  /** Machine event → the action that produces it. */
  events: { OPEN: "open", CLOSE: "close", SELECT: { action: "choose", args: (ctx) => [ctx.firstItemLabel] } },
  traits: ["disclosure", "layer", "restores-focus"],             // turns on generic invariants
} as const satisfies ContractDef<SelectMachine>)
```

`ContractDef<M>` takes its keys for `states` and `events` from the machine type.
An unknown state or event name is therefore a compile error, and so is a part
outside `anatomy` (`Env<P>` narrows `part()`). A plain function is shorthand for
`{ pointer: fn }`. `done` is awaited through `env.until`, so `open()` returns
only once the select is open, in both environments.

### (b) Adapters

```ts
// @rind-ui/testing/dom
export interface DomAdapterOptions {
  /** Defaults to document. A container does NOT limit portals; instance scoping does. */
  readonly root?: ParentNode
  /** user-event instance by default; pass `userEvent` from "vitest/browser" for real input. */
  readonly user?: UserLike
  readonly advanceTimers?: (ms: number) => unknown | Promise<unknown>
  readonly timeout?: number // until(), default 1000 (TL's waitFor default)
  readonly modality?: Modality
}
export function domEnv(options?: DomAdapterOptions): EnvFactory

// @rind-ui/testing/playwright
export interface PlaywrightAdapterOptions {
  readonly timeout?: number // default: Playwright's expect timeout
  readonly modality?: Modality
}
export function playwrightEnv(target: Page | Locator | FrameLocator, options?: PlaywrightAdapterOptions): EnvFactory
```

- **DOM adapter.** Queries use `@testing-library/dom` (`queryAllByRole` with
  `exact: true`) and the `data-*` selector. Every action is wrapped in
  `getConfig().asyncWrapper(() => getConfig().eventWrapper(…))`, which is how
  `@testing-library/react` installs `act`. The adapter itself contains no React
  code. Actions first wait for the part to exist (`until`), which matches
  Playwright's auto-wait. Clicks use pointer coordinates taken from a monotonic
  counter, so successive synthetic moves differ (zag#3298). `UserLike` is the
  overlap of user-event and `vitest/browser`'s `userEvent` (`click`, `hover`,
  `keyboard`, `type`, `pointer`).
- **Playwright adapter.** `part()` is a `Locator`
  (`page.locator('[data-scope=…][data-instance=…]')`, or `getByRole(role, { name,
  exact: true })` within that). Actions are locator actions. `attr`/`text` are
  `getAttribute`/`textContent`, normalised. `until` uses the same polling loop
  as the DOM adapter, because `expect.poll` would tie it to `@playwright/test`.
  It has **no runtime import** of Playwright: it calls methods on objects it is
  given and imports only types.
- Both adapters print every match when a lookup finds more than one, which is how
  the hidden-select problem shows up.

### (c) Drivers generated from a contract

```ts
type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never
type ActionArgs<A> = A extends (env: never, ...args: infer R) => unknown ? R
  : A extends { pointer: (env: never, ...args: infer R) => unknown } ? R
  : A extends { keyboard: (env: never, ...args: infer R) => unknown } ? R : never
type ModalitiesOf<A> = A extends (...a: never) => unknown ? "pointer" : Extract<keyof A, Modality>

export type Driver<C extends AnyContract> = {
  readonly [K in keyof C["actions"]]: (...args: ActionArgs<C["actions"][K]>) => Promise<void>
} & {
  readonly [K in keyof C["queries"]]: () => ReturnType<C["queries"][K]>
} & {
  /** Same driver, different modality; only modalities some action declares. */
  via(modality: { [K in keyof C["actions"]]: ModalitiesOf<C["actions"][K]> }[keyof C["actions"]]): Driver<C>
  part(name: C["anatomy"][number], by?: By): Part
  readonly contract: C
}

export function createDriver<const C extends AnyContract>(
  contract: C,
  target: Target,          // Env factory | Page | Locator | FrameLocator | TL `screen` | Element
  ...anchor: Parameters<C["locate"]>
): Driver<C>
```

Usage, one test for either environment:

```ts
export const getSelect = (t: Target, by: { name: string }) => createDriver(selectContract, t, by.name)

const select = getSelect(screen, { name: "Country" })   // or getSelect(page, …)
await select.open()
await select.choose("Italy")            // (label: string) inferred from the contract
expect(await select.value()).toBe("Italy")
await select.via("keyboard").choose("Spain")
// @ts-expect-error — "chose" is not an action; 1 is not a string
await select.chose(1)
```

`Target` is normalised by duck-typing: anything with a `locator` method goes to
the Playwright adapter, everything else to the DOM adapter with default
options. Calling an action with a modality the action doesn't declare throws
`select.choose has no "touch" implementation`. It does not silently fall back.
Generated `getX` functions are re-exported from `@rind-ui/testing`, and docs
pages list their actions and queries (generated, per 0005).

### (d) Setup entry — `@rind-ui/testing/setup`

A side-effect import for `setupFiles`, listed in `sideEffects` in `package.json`.
Each item is installed **only if missing**, so happy-dom, newer jsdom and real
browsers keep their own versions. Browser mode does not need it (it is a no-op
there).

| Polyfill | Shape | Why (who trips) |
|---|---|---|
| `ResizeObserver` | no-op `observe`/`unobserve`/`disconnect`, **no callback** | floating/positioner, scroll-area; Radix fires a fake 0×0 entry, but our core must not need one |
| `IntersectionObserver` | no-op | carousel, scroll-area, toc (Zag) |
| `Element.prototype.scrollIntoView`, `scrollTo`, `scrollBy`; `window.scrollTo` | no-op | select/menu/combobox focus management (zag#1697, ark#3185, Radix setup) |
| `Element.prototype.getAnimations`, `document.getAnimations` | `() => []` | presence must see "no running animation" (Zag assumes the opposite) |
| `PointerEvent` | class over `MouseEvent` with `pointerId`, `pointerType`, `width`, `height`, `pressure`, `isPrimary` | jsdom < 27 (RA `installPointerEvent`, Ariakit README) |
| `setPointerCapture`, `releasePointerCapture`, `hasPointerCapture` | no-op / `false` | slider, splitter, drag (Zag, Ariakit) |
| `window.matchMedia` | `matches: false`, `addEventListener`/`removeEventListener`/`addListener`/`removeListener` | reduced motion, pointer: coarse (Reado `Mascot.uitest.tsx`) |
| `window.visualViewport` | from `innerWidth`/`innerHeight`, no-op listeners | positioner (Reado `OnboardingTour.uitest.tsx`) |

Plus, if `afterEach` is a global (Vitest `globals`, Jest), it registers
`resetRindGlobals()`, which clears the layer stack, scroll lock, focus-trap
stack and tooltip group. The reset is also exported for other runners.

**Deliberately not polyfilled:** layout (`getBoundingClientRect`,
`getClientRects`, `offsetWidth`). Faking it makes positioning tests pass when
they are wrong; layout belongs in the browser suite, as Reado concluded. Also
not polyfilled: `focus()` behaviour (unlike Ariakit), the act environment, and
`requestAnimationFrame` (Base UI swaps it). Core must not need any of these to
function. The rules that make the setup this small belong in
`core/dom` and are specified in the machine-runtime and overlay changes:

- `core/dom` feature-detects every API above and treats "missing" as
  "nothing to do", e.g. no animation → unmount now.
- Every timer goes through the injected `Scheduler`, which resolves
  `setTimeout`/`requestAnimationFrame` **at call time**, never at import, so
  `vi.useFakeTimers()` drives it (Reado #3).
- Presence never waits for a frame when no animation is declared.
- Hidden native form controls (`<select>`, radio/checkbox inputs) are
  `aria-hidden="true"` and `tabindex="-1"`. Where the input itself is the
  accessible element, it gets its accessible name (ark#3792).

### (e) Model-based runner — `testMachine`

```ts
export interface TestMachineOptions<C extends AnyContract, R> {
  /** Fresh component per path. Return what the adapter needs (nothing for TL; a Page for Playwright). */
  readonly setup: () => R | Promise<R>
  readonly target: (rendered: R) => Target
  readonly anchor: Parameters<C["locate"]>
  /** The registrar: Vitest `it`, Jest `test`, Playwright `test`. Avoids depending on any runner. */
  readonly test: (name: string, fn: (...a: never[]) => Promise<void>) => void
  /** Props the wrapper passes to the machine, so the oracle evaluates guards the same way. */
  readonly props?: MachinePropsOf<C>
  readonly coverage?: "states" | "transitions" // default "transitions"
  readonly modalities?: readonly Modality[]    // default: every modality the contract declares
  readonly invariants?: readonly Invariant<C>[]
  readonly a11y?: (target: Target) => Promise<void> // e.g. axe, run on every reached state
}
export function testMachine<const C extends AnyContract, R>(contract: C, options: TestMachineOptions<C, R>): void
/** The paths themselves, for custom runners and for printing. */
export function machinePaths<C extends AnyContract>(contract: C, coverage?: "states" | "transitions"): readonly Path<C>[]
```

```ts
// consumer, Vitest + TL
testMachine(selectContract, { test: it, setup: () => render(<MySelect />), target: () => screen, anchor: ["Country"] })
// consumer, Playwright
testMachine(selectContract, {
  test: (name, fn) => test(name, ({ page }) => fn(page)),
  setup: async () => { /* page.goto("/select") is done inside fn via the fixture */ },
  target: (page) => page, anchor: ["Country"],
})
```

**Algorithm.**

1. Get the static graph from the machine runtime (`graph(machine)` from the
   machine-runtime change): states, and transitions with event, target and
   guard name.
2. Build paths. `"states"`: BFS shortest path to each state. `"transitions"`:
   for each transition, the shortest path to its source state plus that
   transition; paths that are prefixes of other paths are dropped. Events with
   no `events` mapping in the contract are reported as **uncovered** in one
   summary test. They are not silently skipped.
3. For each path × modality, register one test named
   `select [keyboard]: closed —OPEN→ open —SELECT→ closed`.
4. Run: `setup()`, create the driver, start a **headless oracle**, which is the
   same pure machine with the same `props` and no DOM. Each step sends the event
   to the oracle and runs the mapped action through the driver. The oracle
   decides the expected state, including guards (e.g. `closeOnEscape: false`
   means Escape must leave it open), and the runner asserts `states[expected]`
   through the contract's queries. Then it runs the invariants. A failure prints
   the path so far, which replays it deterministically.

**Generic invariants**, switched on by `traits`, with no per-component code:

| Invariant | Applies to |
|---|---|
| Observed queries equal `states[oracleState]` after every step | all |
| `aria-controls`, `aria-labelledby`, `aria-describedby`, `aria-activedescendant` ids resolve to existing elements | all |
| Exactly one element matches the anchor's role + name | all |
| No uncaught error / `console.error` during the step | all (DOM: `console` spy; Playwright: `pageerror`) |
| Trigger `aria-expanded` mirrors open/closed | `disclosure` |
| `data-state` on every rendered part equals the state's declared `data-state` | all with `data-state` |
| Focus is never on `<body>` after a step while a layer is open | `layer` |
| After close, focus is on the trigger (or the declared `finalFocus` part) | `restores-focus` |
| Escape closes only the topmost layer (checked when the path nests layers) | `layer` |
| Content parts are absent or `hidden` when closed (presence settled) | `disclosure` |

**Per-component invariants** live next to the contract
(`select.contract.ts` exports `selectInvariants`) and are on by default for
that contract:

- Dialog: focus is inside content while open (trap); `aria-modal`; body scroll
  locked while modal; outside content `inert`/`aria-hidden` while modal.
- Select: `value-text` equals the selected item's text; exactly one
  `aria-selected` in single mode.
- Message thread: exactly one live-region announcement per completed streamed
  message (0003).

A consumer's `invariants` are added on top. They cannot turn off ours; turning
them off would defeat the "prove your wrapper didn't break it" promise.

## What we do differently from React Aria test-utils, and why

| React Aria | rind-ui | Why |
|---|---|---|
| Hand-written tester class per pattern, kept separately | Driver generated from the contract the component ships | can't drift; every component gets one for free ("missing one = not done") |
| DOM only: returns `HTMLElement`, reads `document.activeElement`, user-event | async `Part` handles through an `Env`; DOM and Playwright adapters | one test, both environments; e2e suites reuse unit-level drivers |
| Sync getters | everything async | the only shape both environments share |
| Root heuristics (`aria-haspopup` button, single button) | `locate` by role + exact name, then `data-instance` scoping | deterministic; two instances on a page work |
| `act` special-cased for React/Jest (`act.ts`) | Testing Library's `asyncWrapper`/`eventWrapper` | framework-neutral (Vue, Solid, Svelte later) |
| `installPointerEvent()` etc. as opt-in helpers | one `@rind-ui/testing/setup` import | consumers shouldn't assemble setup files (zag#1697) |
| No generated coverage | `testMachine` over the machine graph with a headless oracle | exhaustive per state and transition, exported for consumers' wrappers |
| Kept: `interactionType`, injected `advanceTimer`, postconditions inside actions, following `aria-controls` | `via()`, `advanceTimers`, `done`, instance scoping | these are what RA got right |

## Open questions

1. **`data-instance` attribute.** It is one more attribute on every part.
   The alternative is following `aria-controls`/`id` chains (RA's way), which
   fails for parts no ARIA relation points at (positioner, backdrop). Leaning
   towards `data-instance`; confirm in the Dialog change.
2. **Default DOM input.** user-event (synthetic, with the zag#3298/#1920 class
   of mismatches) or Ariakit-style own dispatch. Leaning towards user-event plus
   our dual-environment CI, and revisiting if our own jsdom suite needs
   workarounds.
3. **Random walks / shrinking.** Add a `strategy: "random"` with seed and
   shrinking via an optional `fast-check` peer, or write a small shrinker? Not
   needed until the graph walk misses a real bug.
4. **Event arguments.** `events.SELECT.args(ctx)` picks one value. Should
   `testMachine` enumerate equivalence classes (first, last, disabled item)?
5. **Props-dependent graphs.** A consumer's wrapper may hard-code props we don't
   see. Should `props` be required, or read back from the rendered DOM
   (`data-*`), or should the oracle accept any guard outcome and assert only
   consistency?
6. **Playwright fixture.** Should we ship `@rind-ui/testing/playwright` with a
   `test.extend` fixture (`{ rind: { select(name) } }`) and an `expect` matcher
   set, or keep only `createDriver(page)`?
7. **a11y per step.** axe on every reached state is slow in jsdom. Should it run
   per state (deduplicated) or only at path end?
8. **Native `<dialog>`.** If the Dialog research picks `showModal()`, jsdom lacks
   it, and the setup gains a polyfill or the jsdom suite skips modal paths.
