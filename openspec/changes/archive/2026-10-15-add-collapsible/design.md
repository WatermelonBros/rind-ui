## Context

See proposal.md for why. Binding sources are the Decisions in
[collapsible.md](../../../docs/research/collapsible.md) and these specs:

- `add-foundations`: the runtime (`setup().machine()`, `controllable`, `$sync`,
  `$reverted`), contracts, drivers, `testMachine` and the React adapter.
- `add-a11y-foundations`:
  - press (`PRESS` with `modality`);
  - `focusSafely`, `data-focus` and `data-focus-visible`;
  - `untilFound()` (`hidden="until-found"` set imperatively, `beforematch` →
    open with `reason: "find-in-page"`, re-applied on refusal,
    `data-reveal="find-in-page"`);
  - `partId`, `reducedMotion()`, `focusableWhenDisabled`.
- `add-overlay-infrastructure`, presence only: the presence machine
  (`present | exiting | absent`), `waitForExit` over `getAnimations()`, and
  React `usePresence` with a synchronous unmount commit.

This change consumes those modules. It does not modify them.

## Goals / Non-Goals

**Goals:**
- A two-state machine. Everything about animation lives in `core/dom` modules
  that parts bind after commit, so the machine graph stays the behaviour graph.
- One `content-size` module that Accordion (and later Navigation Menu) reuses
  unchanged.
- Each cited regression has a test: browser mode for layout and animation,
  jsdom where the event sequence is enough.

**Non-Goals:**
- Changing the presence or until-found modules. If they are missing a hook
  this change needs, the gap is filed against their change.

## Decisions

### 1. Machine

```ts
type CollapsibleEvent =
  | { type: "TOGGLE"; modality: Modality }                       // trigger PRESS
  | { type: "OPEN"; reason: "api" | "find-in-page" }
  | { type: "CLOSE"; reason: "api" }

setup({
  types: type<{ props: CollapsibleProps; events: CollapsibleEvent; env: FocusEnv; context: { reveal: Reveal } }>(),
  guards: {
    notDisabled: ({ props }) => !props.disabled,
    isApi: ({ event }) => event.type === "OPEN" && event.reason === "api",
  },
  actions: {
    markFindReveal: ({ event, set }) => set("reveal", event.type === "OPEN" && event.reason === "find-in-page" ? "find-in-page" : null),
    clearReveal: ({ set }) => set("reveal", null),
    moveFocusOutOfContent: ({ env }) => env.focus.moveIfInside("content", "trigger"), // focusSafely
  },
}).machine({
  id: "collapsible",
  context: (props) => ({ reveal: (props.open ?? props.defaultOpen) ? "mount" : null }),
  values: { open: controllable("open", { fallback: false, states: { open: true, closed: false } }) },
  initial: "closed",
  states: {
    closed: { on: {
      TOGGLE: { target: "open", guard: "notDisabled", actions: ["clearReveal"] },
      OPEN: [{ target: "open", guard: { or: ["notDisabled", "isApi"] }, actions: ["markFindReveal"] }],
    } },
    open: {
      exit: ["moveFocusOutOfContent"],
      on: {
        TOGGLE: { target: "closed", guard: "notDisabled", actions: ["clearReveal"] },
        CLOSE: { target: "closed", actions: ["clearReveal"] },
      },
    },
  },
})
```

- `isApi` lets a controlled or imperative `OPEN { reason: "api" }` work while
  disabled. Find-in-page cannot reach a disabled collapsible anyway: its
  content is plain `hidden` (spec Disabled).
- Graph: `closed —TOGGLE→ open`, `open —TOGGLE|CLOSE→ closed`,
  `closed —OPEN→ open`, plus `$sync:open` edges. The prop guard `notDisabled`
  gives two runner configurations.
- `$reverted` (a controlled refusal) is not handled here. The until-found
  module already re-applies the attribute when the open value did not change.
- *Alternative:* a third `closing` state for exit (Zag). Rejected: presence is
  a separate machine by the overlay decision, and "closed means closed
  immediately" keeps `aria-expanded` truthful.

### 2. Connect

- Trigger:
  - `id`, `type: "button"`, `aria-expanded`;
  - `aria-controls` only when the adapter reports the content as mounted
    (`PART.MOUNT` / `PART.UNMOUNT`, the labelling-parts mechanism from
    accessibility.md §2);
  - native `disabled`, or `aria-disabled` with `focusableWhenDisabled`;
  - press handlers. `PRESS` → `TOGGLE { modality }`.
- Content:
  - `id`, `data-state`, `data-reveal` (from context; `find-in-page` comes from
    `untilFound`'s marker);
  - `hidden` per mode, where a disabled collapsible degrades `until-found` to
    `hidden`.
  - There is no `aria-hidden` and no role.
- Root and Indicator: state attributes only. Indicator has `aria-hidden="true"`.

### 3. `core/dom/content-size.ts` (new, shared)

```ts
export interface ContentSize {
  /** After the commit that opened the content (still un-animated). */
  opened(options: { instant: boolean }): void       // instant: initial render or find-in-page
  /** After the commit that closed it, before presence starts waiting. */
  closed(): void
  /** Another panel's content was committed into the same element (shared viewport). */
  switched(): void
  /** Presence finished the enter animations. */
  settled(): void
  dispose(): void
}
export function contentSize(el: HTMLElement, env: DomEnv & MotionPreference, prefix: string): ContentSize
```

Sequence, writing `--${prefix}-content-height|width` with `style.setProperty`:

- **Open**:
  1. Write `0px` (it already is `0px` when coming from closed).
  2. Remove `hidden` (presence or until-found).
  3. Neutralise `justify-*` / `align-*` inline. Read `scrollHeight` and
     `scrollWidth`. Restore them.
  4. Force a style flush. Write the px values. The theme transition runs
     from 0.
  5. On `settled()`, write `auto`.
- **Instant** (initial render, find-in-page): write `auto` and skip the flush.
  find-in-page calls this synchronously from the `beforematch` handler, in the
  same task (base-ui#5513).
- **Switch** (amended from add-navigation-menu, mui/base-ui#4619): a viewport goes
  from one open panel to another, which `opened()` (always from `0px`) cannot express.
  1. Read the size currently rendered (the px value, or the computed size if `auto`)
     and write it as px.
  2. Measure the incoming content's natural size (already committed) as in Open step 3.
  3. Flush. Write the new px values.
  4. On `settled()`, write `auto`. A second `switched()` before `settled()` starts from
     the size currently rendered.
- **Close**:
  1. Read the current scroll size. Write it as px (from `auto`, so nothing
     animates).
  2. Flush. Write `0px`.
  3. Presence waits for the transition, then the content is hidden or
     unmounted.

The properties are custom properties in `style`, not `aria-*` or `data-*`, so
connect's ownership rule holds. They are written imperatively because they
depend on layout after commit. This matches how `untilFound` writes `hidden`.

*Alternatives:*

- Measure with animations disabled (Radix, Zag, Base UI). Rejected: this is the
  source of the mount, first-open and Activity bugs.
- ResizeObserver to keep px current. Rejected: `auto` at rest already follows
  content (WCAG 1.4.12) at zero cost.
- `interpolate-size`. Chromium-only (native-platform §10); the theme may layer
  it under `@supports`.

### 4. Parts (React)

`Content` composes three bindings:

1. `usePresence(open, ref)` (overlay change).
2. `useContentSize(ref, open)`: it calls `opened`, `closed` and `settled` from a
   layout effect. `settled` comes from presence's enter completion, or
   immediately when nothing animates.
3. `useUntilFound(ref, …)`: only in `until-found` mode while closed. Its
   `onReveal` sends `OPEN { reason: "find-in-page" }` and calls
   `contentSize.opened({ instant: true })`.

`unmount` mode renders nothing once presence is `absent`. Parts hold no other
logic. A dev-only check after commit warns when closed `until-found` content
computes `display: none`.

### 5. Theme (`packages/theme/src/collapsible.css`)

```css
[data-scope="collapsible"][data-part="content"] {
  overflow: hidden;
  height: var(--rind-collapsible-content-height);
  transition: height var(--rind-duration-medium) var(--rind-ease-standard);
}
[data-scope="collapsible"][data-part="content"][data-reveal] { transition: none; }
```

There is no `[hidden]` override. Durations become `0s` under reduced motion
(theme-accessibility). The indicator rotates with `data-state` and mirrors under
`[dir="rtl"]`.

### 6. Contract and tests

- `collapsibleContract` (see spec), with `getCollapsible` re-exported from
  `@rind-ui/testing`.
- `testMachine` runs pointer, keyboard and virtual modalities, both `disabled`
  configurations and all three `closedContent` modes.
- Browser-mode regression tests, three engines:
  - nested zero-size content;
  - flex and grid measurement;
  - first open in `unmount` mode;
  - initially open (no transition, zero CLS);
  - reorder, and `<Activity>` hide/show;
  - find-in-page via `beforematch`, plus `window.find()` in Chromium;
  - exit in the same step as another open;
  - form submission while closed;
  - SSR + hydration markup containing `hidden="until-found"`.

## Risks / Trade-offs

- [Consumers who animate with keyframes still get replays on re-insertion,
  which is platform behaviour] → `data-reveal="mount"` covers the mount. The
  docs recommend transitions on the variable and say so.
- [A forced style flush on every open and close] → one per transition, on one
  element. Accordion switches at most two items per step.
- [`overflow: hidden` in the theme clips focus rings of children] → the theme
  insets content padding through an inner wrapper. The docs page shows it.
- [Presence dependency on an unarchived change] → only its `presence`
  capability is used. If that change slips, this one waits for that capability
  alone.
- [React cannot serialise `hidden="until-found"` (react#24740)] → the
  hidden-content spec already requires server output. If React still cannot
  serialise it, that capability's task owns the workaround, and this change's
  SSR test proves it.

## Open Questions

- Should the docs recommend layering `interpolate-size: allow-keywords` in the
  theme for Chromium? It is theme-only and changes no spec.
