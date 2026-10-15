# Collapsible — research

Status: done · Wave: 1

Collapsible is the APG **Disclosure** pattern: one button shows and hides one
region of content. Accordion ([accordion.md](accordion.md)) is built from it.
The `disclosure` fixture in `add-foundations` is a test fixture. This note is
for the public component.

Sources read 2026-10-14 (read-only clones; paths relative to each repo). Issue
prefixes: **RX** radix-ui/primitives · **ZG** chakra-ui/zag · **ARK**
chakra-ui/ark · **BU** mui/base-ui · **RA** adobe/react-spectrum · **HUI**
tailwindlabs/headlessui · **AK** ariakit/ariakit · **RK** unovue/reka-ui ·
**BITS** huntabyte/bits-ui · **KB** kobaltedev/kobalte.

## Pattern

- WAI-ARIA APG: [Disclosure (Show/Hide)](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
- Roles and attributes:
  - The trigger is `role="button"`. A native `<button>` gives it.
  - The trigger has `aria-expanded="true|false"`, which mirrors whether the
    content is visible.
  - `aria-controls` → the content's id is optional in APG.
  - The content has no required role.
- Keyboard: Enter and Space toggle the content. Nothing else is required.
  Focus does not move.

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/collapsible/src/{collapsible.machine,collapsible.connect,collapsible.types}.ts`.
  Ark: `ark/packages/react/src/components/collapsible/{use-collapsible.ts,collapsible-content.tsx}`.
- API: `Root`, `Trigger`, `Content`, `Indicator`. Props:
  - `open`, `defaultOpen`, `onOpenChange({ open })`, `onExitComplete`;
  - `disabled`;
  - `collapsedHeight` / `collapsedWidth`, for content that stays partly visible;
  - Ark adds `lazyMount`, `unmountOnExit`, and `hideMode: "display-none" | "activity"`
    (React `<Activity>`).
- State model:
  - States are `closed | open | closing`. Presence is built into the machine:
    `closing` waits for `animationend`.
  - Controlled mode uses `controlled.open` / `controlled.close` events plus a
    `watch` on `open`.
  - Size: `computeSize` runs in a rAF. It sets `animationName: none`, un-hides
    the content, reads `getBoundingClientRect()`, then restores both. The
    result is `--height` / `--width`.
- Notable:
  - When `collapsedHeight` is set, tabbables inside the closed content get
    `inert` (`trackTabbableElements`).
  - On the first open, `data-state` is left `undefined`, so a keyframe does not
    play on mount (`skip = !initial && open`).
- Problems:
  - `aria-expanded` is `visible`, so it stays `true` during `closing`.
  - Only keyframe animations are detected (`animationName`); CSS transitions
    are not.
  - Dropping `data-state` to prevent the mount animation created a bug of its
    own: ARK#3716 and ARK#3432, "ItemContent loses data-state when open".
  - ZG#1396: items animate on the initial render.
  - ZG#2138: content flashes when list items are reordered.

### Radix

- Source: `radix/packages/react/collapsible/src/collapsible.tsx` (244 lines).
- API: `Root` (`open`, `defaultOpen`, `onOpenChange`, `disabled`), `Trigger`,
  `Content` (`forceMount`).
- State model: `useControllableState` + `Presence`.
- Content measurement, in `useLayoutEffect` on every `open` change:
  1. Set `transitionDuration: 0s` and `animationName: none`.
  2. Read `getBoundingClientRect()`.
  3. Restore both, except on mount (`isMountAnimationPreventedRef`, cleared
     after one rAF).
- Size is exposed as `--radix-collapsible-content-height` / `-width`. The value
  is left unset when it is 0.
- Children render only while open (`{isOpen && children}`). `hidden={!isOpen}`.
- `aria-controls` is set only while open.
- Notable: measuring "natural size, then animate to it" is the pattern every
  Radix port copies (Reka, Bits, Kobalte).
- Problems:
  - The size is measured once per toggle, so it goes stale when content
    changes.
  - The var is missing when the size is 0: RX#3037 (open), RX#3607.
  - `forceMount` content is visible while closed: RX#2546, RX#957.
  - Exit flicker: RX#1074, RX#3030.
  - `display:flex` content animates twice: RX#2832 (open).
  - The first open does not animate in Firefox/Safari: RX#1265.
  - The open animation replays when `<Activity>` shows the content again:
    RX#3778 (open).
  - No find-in-page: RX#1660, RX#2338.
  - Closed form fields are not submitted: RX#2808.

### React Aria (Disclosure)

- Source:
  - `react-aria/src/disclosure/useDisclosure.ts` (sparse clone `ra/`);
  - `react-stately/src/disclosure/useDisclosureState.ts`;
  - `react-aria-components/src/Disclosure.tsx` (via `git show`).
- API:
  - `Disclosure` (`isExpanded`, `defaultExpanded`, `onExpandedChange`,
    `isDisabled`) holds a `Heading` with a `Button slot="trigger"`.
  - `DisclosurePanel` (`role: "group" | "region"`, default `group`).
- State: `useDisclosureState`, which is `expand`, `collapse` and `toggle`.
- Notable:
  - The panel always uses `hidden="until-found"`, set in a layout effect.
    `beforematch` toggles with `flushSync`, and the attribute is re-set a
    frame later.
  - Size uses `--disclosure-panel-height` / `-width`:
    - On open, it is set to `scrollHeight` px. After
      `getAnimations().finished` it becomes `auto`, so the content can resize.
    - On close, it is set to px, a reflow is forced, then it is set to `0px`.
      `hidden` is applied after the animations finish.
    - This works with **transitions**, because an `until-found` box keeps its
      layout.
  - Keyboard toggles on `onPressStart`; pointer toggles on `onPress`.
- Problems:
  - RA#10552: `aria-hidden` and `hidden="until-found"` on the same element.
    HTML-ARIA forbids this. `aria-hidden` was added for duplicate TalkBack/VO
    announcements (RA PR 7218).
  - Disabled changes visibility: RA#9004 and RA#7444.
  - Tailwind preflight `[hidden]{display:none}` broke the panel: RA#7160
    (fixed in Tailwind 3.4.14).
  - In SSR, `hidden` is rendered as a boolean (`isSSR`), so the server HTML is
    not findable.

### Base UI

- Source: `base-ui/packages/react/src/collapsible/{root/useCollapsibleRoot.ts,panel/useCollapsiblePanel.ts (635 lines),trigger/CollapsibleTrigger.tsx}`.
- API: `Root` (`open`, `defaultOpen`, `onOpenChange(open, details)`, `disabled`),
  `Trigger` (`nativeButton`), `Panel` (`hiddenUntilFound`, `keepMounted`).
- Size is `--collapsible-panel-height` / `-width`, read from
  `scrollHeight`/`scrollWidth`. It is `auto` when idle.
- Data attributes: `data-open`, `data-closed`, `data-starting-style`,
  `data-ending-style`.
- Notable, the most careful implementation:
  - It detects the animation type (`css-transition | css-animation | none`) and
    warns when both are used.
  - It resets `justify-*` / `align-*` while measuring, so flex and grid content
    measure correctly (BU#2767).
  - It suppresses the mount keyframe for panels that start open (BU#904, BU#740).
  - It suppresses the replay when React Activity resumes.
  - A `beforematch` reveal skips motion once. It is cancelable through
    `eventDetails`; when cancelled, `hidden="until-found"` is restored in a
    task and then a frame (BU#5513).
  - It waits one frame before watching exit animations, because Chrome
    registers the exit transition late (BU#3099).
- Problems:
  - The code is mostly sequencing workarounds around React state (a 635-line hook).
  - BU#1458: the panel did not resize with its content.
  - BU#4553: a `keepMounted` panel controlled from outside never closed
    without a transition.
  - BU#5821 (open): server HTML has plain `hidden` (react#24740), so text
    extractors and LLM fetchers drop the answers.
  - BU#4282: multiple triggers.
  - BU#1148 (open): a `<details>`-based implementation.

### Headless UI (Disclosure)

- Source: `headlessui/packages/@headlessui-react/src/components/disclosure/disclosure.tsx` (546 lines).
- API: `Disclosure` (`defaultOpen`; not controllable, HUI#3082), `DisclosureButton`,
  `DisclosurePanel` (`static`, `unmount`, `transition`), `close(focusRef)`.
- Notable:
  - A `DisclosureButton` *inside* the panel closes it and refocuses the main
    button.
  - Toggle runs on keydown Enter/Space. On keyup, Space calls `preventDefault`
    because of a Firefox synthetic click.
  - `aria-controls` is set only when a panel element exists.
- Problems:
  - HUI#1741: `aria-controls` was dropped with `static`.
  - HUI#3702: `defaultOpen` plays the open transition.
  - HUI#1561, HUI#2913: SSR id mismatches.
  - HUI#2757: lazy content inside the panel.

### Ariakit (Disclosure)

- Source: `ariakit/packages/ariakit-react-components/src/disclosure/{disclosure.tsx,disclosure-content.tsx,disclosure-store.ts}`.
- API: `useDisclosureStore`, `Disclosure` (`toggleOnClick`), `DisclosureContent`
  (`alwaysVisible`, `unmountOnHide`), `data-open`, `data-enter`, `data-leave`.
- Notable:
  - Several buttons can control one content. Only the button that last
    toggled it gets `aria-expanded="true"`.
  - The animation timeout is derived from the computed durations, because end
    events may never fire.
  - The content is hidden with `display: none`.
- Problems:
  - There is no size variable.
  - AK#3835 (open): content animates in when `defaultOpen`.
  - AK#5053: an async `setOpen` restores the old state.

### Reka UI / Bits UI / Kobalte

- Reka (`reka-ui/packages/core/src/Collapsible/CollapsibleContent.vue`):
  - A Radix port with `unmountOnHide` (default `true`; when `false`, it uses
    `hidden="until-found"` plus `beforematch`).
  - Problems:
    - RK#920 (open): the open animation replays after a node is moved in a
      list, because the mount-suppression styles are gone after the first cycle.
    - RK#978: open on the client only, with SSR `defaultOpen`.
    - RK#2320 (open): collapsed base height.
- Bits (`bits-ui/src/lib/bits/collapsible/collapsible.svelte.ts`):
  - A Radix port with `hiddenUntilFound`.
  - Problems:
    - BITS#2039 (open): mount suppression races a rAF flag.
    - BITS#2167 (open): exit flicker from deferred completion.
- Kobalte (`kobalte/packages/core/src/collapsible/*`):
  - A Radix port (`--kb-collapsible-content-height`, `forceMount`).
  - KB#528: content cannot be reached without JavaScript.

## Accessibility

Applying [accessibility.md](accessibility.md), the
[AT note](assistive-tech-and-a11y-testing.md) and [native-platform.md](native-platform.md):

- **Roles and naming.**
  - The trigger is a native `<button type="button">`. Its name comes from its
    content (2.5.3).
  - `aria-expanded` mirrors the machine's `open` value at the moment of the
    transition. It is not true during the exit animation (Zag bug above).
  - `aria-controls` points to the content's id whenever the content element is
    rendered, including while it is hidden. While it is unmounted the attribute
    is absent (rule 2; RX#3242, HUI#1741). Referencing hidden content is
    allowed. Some object to it (w3c/aria#531, BU#1024), but the IDREF
    invariant only requires that the id resolves.
  - The content has **no role** by default. A labelled `region` is the
    accordion's business. A consumer may pass a role and a name.
- **Keyboard.**
  - Enter and Space use the press semantics of `add-a11y-foundations`
    (keydown starts, keyup activates, repeats ignored). There are no other keys.
  - A bare `click` from VO, NVDA browse mode or TalkBack toggles exactly once
    (invariant 12; KB#119 is the double-toggle failure).
- **Focus.**
  - Closing while focus is inside the content would drop focus on `<body>`
    (rule 11). So the machine moves focus to the trigger when the content
    closes with focus inside it. HUI does this for its in-panel button.
  - Opening never moves focus.
- **Disabled.**
  - Disabled is native `disabled` on the trigger. With `focusableWhenDisabled`
    it is `aria-disabled="true"`.
  - Disabled ignores user activation only. It never changes visibility
    (RA#9004, RA#7444).
  - A disabled, closed collapsible uses plain `hidden`, not `until-found`:
    find-in-page is user activation too.
- **Hidden content.**
  - Closed content is either `hidden="until-found"` (default; native-platform
    §6 says *use*), plain `hidden`, or unmounted.
  - `aria-hidden` is **never** added. HTML-ARIA forbids `aria-hidden="true"` on
    `hidden` elements (RA#10552). `content-visibility: hidden` already removes
    the subtree from the accessibility tree.
  - The duplicate announcement RA patched with `aria-hidden` came from a
    *labelled group* panel. Our collapsible content has no role, and the
    accordion drops role and name while closed (see accordion.md).
- **Find-in-page.**
  - `beforematch` → `OPEN { reason: "find-in-page" }`. It must open, never
    toggle (RA uses `toggle()`).
  - The reveal skips the animation: `data-reveal="find-in-page"`, and the size
    var is set straight to `auto`, so the browser highlights the match on the
    first search (BU#5513).
  - A controlled refusal restores `until-found` (hidden-content spec).
  - SSR must emit `hidden="until-found"` (hidden-content spec; BU#5821 shows
    the cost of plain `hidden`).
  - Safari 26.2 support is partial: it reveals but does not scroll (WebKit
    #304174).
  - A consumer CSS reset with `[hidden]{display:none}` defeats it (RA#7160).
    We warn in development.
- **Motion.**
  - Height animates through a measured CSS variable, with transitions as the
    recommended technique (below).
  - Under `prefers-reduced-motion` the theme durations are `0s`. Presence then
    completes at once, because no animation is running.
  - No JS motion. `interpolate-size` / `calc-size()` would remove the
    measurement but is Chrome-only (native-platform §10). The theme may add it
    inside `@supports`.
  - `@starting-style` is not needed here: the size variable provides the
    starting value. That is also why re-inserted nodes do not replay.
- **Native `<details>`/`<summary>`: avoid**, again, for Collapsible:
  - The browser mutates `open` itself, and the `toggle` event is async and not
    cancelable. A controlled consumer cannot refuse a change; machine state and
    DOM would diverge.
  - `<summary>` cannot be substituted with `render`, which breaks Liskov, and
    its role announcement differs across AT (Scott O'Hara's tests, cited in
    BU#1148).
  - Animating `::details-content` height needs `interpolate-size`, which is
    Chrome-only.
  - `hidden="until-found"` already gives the one thing `<details>` has for free:
    find-in-page.
- **Forced colors / RTL.**
  - State is in `aria-expanded` and `data-state`, so forced colors keep it.
  - The theme's indicator is a `currentColor` glyph.
  - There are no directional keys, so RTL only flips the indicator (theme).

AT quirks to keep testing (manual protocol):

- VoiceOver "expanded/collapsed" after a settings reset (RK#2521: tester setup,
  not a bug).
- TalkBack's focus ring after expand (RA#1726).
- Disabled triggers not announced by TalkBack/VO (RA#1726). Native `disabled`
  removes them from the Tab order, so `focusableWhenDisabled` is the documented
  fix.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [RX#3037](https://github.com/radix-ui/primitives/issues/3037) | Nested collapsible with empty content animates with the parent's height | `--radix-collapsible-content-height` omitted when 0; CSS vars inherit | Open | Always set the size vars on the content element, including `0px` |
| Radix | [RX#3607](https://github.com/radix-ui/primitives/issues/3607) | Var removed after close with `forceMount` | Same falsy check | Dup of #3037 | Same |
| Radix | [RX#2109](https://github.com/radix-ui/primitives/issues/2109) | Var undefined on first render | Measured only after a toggle | Closed (expected) | Initially open: var is `auto` from the first render |
| Base UI | [BU#1458](https://github.com/mui/base-ui/issues/1458) | Panel does not resize when content changes | Measured px kept after open | Fixed (#2043): `auto` when idle | Var is px only during the enter animation, `auto` when settled (WCAG 1.4.12) |
| Radix | [RX#2832](https://github.com/radix-ui/primitives/issues/2832) | `display:flex` content animates twice | `getBoundingClientRect` affected by flex sizing | Open | Measure `scrollHeight`/`scrollWidth`, with alignment neutralised |
| Base UI | [BU#2767](https://github.com/mui/base-ui/issues/2767) | Height wrong with flex/grid panels | Alignment props change the measured size | Fixed (#2772): reset `justify-*`/`align-*` while measuring | Same; regression test with flex and grid content |
| Radix | [RX#1265](https://github.com/radix-ui/primitives/issues/1265) | First open not animated in Firefox/Safari | Children mounted in the same pass as the measurement | Closed | Measure after the commit that mounts children; browser suite in 3 engines |
| Zag | [ZG#1396](https://github.com/chakra-ui/zag/issues/1396) | Items animate / flicker on page load | Mount suppression via a rAF flag | Closed | Initially open content starts at `auto`; nothing to suppress |
| Ariakit | [AK#3835](https://github.com/ariakit/ariakit/issues/3835) | Disclosure animates in when `defaultOpen` | No initial-render marker | Open (user workaround `data-initial`) | `data-reveal="mount"` until the first transition |
| Headless UI | [HUI#3702](https://github.com/tailwindlabs/headlessui/issues/3702) | `defaultOpen` transitions from closed | `transition` runs on mount | Closed (use `<Transition>`) | Same |
| Bits UI | [BITS#2039](https://github.com/huntabyte/bits-ui/issues/2039) | Slide on initial mount in busy pages | Suppression races a rAF flag flip | Open | No timing-based suppression |
| Zag/Ark | [ARK#3716](https://github.com/chakra-ui/ark/issues/3716), [ARK#3432](https://github.com/chakra-ui/ark/issues/3432) | Content loses `data-state="open"` | `data-state` dropped to skip the mount animation | Closed | Never drop `data-state`; signal the mount separately |
| Radix | [RX#3778](https://github.com/radix-ui/primitives/issues/3778) | Open animation replays after React `<Activity>` reveal | Keyframes restart when the node is shown again | Open | Transition-based theme: a settled `auto` var gives nothing to replay |
| Reka | [RK#920](https://github.com/unovue/reka-ui/issues/920) | Open animation replays when list items are reordered | Suppression styles gone after first cycle; re-insertion restarts keyframes | Open | Same; reorder story in the browser suite |
| Zag | [ZG#2138](https://github.com/chakra-ui/zag/issues/2138) | Collapsibles flash when moved in a list | Remount on key change re-runs entry | Fixed | Same |
| Radix | [RX#2546](https://github.com/radix-ui/primitives/issues/2546), [RX#957](https://github.com/radix-ui/primitives/issues/957) | `forceMount` content visible when closed / reopens after close | `forceMount` bypasses hiding | Closed (by design) | Kept-mounted closed content is always `hidden`/`until-found`; mode is a prop, not a bypass |
| Radix | [RX#2808](https://github.com/radix-ui/primitives/issues/2808) | Form fields in closed content not submitted | Content unmounted when closed | Closed (use `forceMount`) | Default keeps content mounted (`until-found`), so forms submit |
| Radix | [RX#3242](https://github.com/radix-ui/primitives/issues/3242) | `aria-controls` points at unmounted content | Attribute independent of mount | Fixed | `aria-controls` iff the content element is rendered |
| Headless UI | [HUI#1741](https://github.com/tailwindlabs/headlessui/issues/1741) | `aria-controls` dropped with `static` panel | Tied to visibility, not existence | Fixed (#1747) | Same |
| React Aria | [RA#10552](https://github.com/adobe/react-spectrum/issues/10552) | Validator error: `aria-hidden` on `hidden="until-found"` | `aria-hidden` added for duplicate announcements | Closed | Never emit `aria-hidden` on content |
| React Aria | [RA#9004](https://github.com/adobe/react-spectrum/issues/9004), [RA#7444](https://github.com/adobe/react-spectrum/issues/7444) | Toggling `isDisabled` shows content / expanded+disabled hidden | Visibility derived from disabled in the effect | Fixed | Disabled never changes visibility |
| React Aria | [RA#7160](https://github.com/adobe/react-spectrum/issues/7160) | `until-found` panel `display:none`, width 0 | Tailwind preflight `[hidden]{display:none}` | Fixed upstream | Dev warning when closed `until-found` content computes `display: none` |
| Base UI | [BU#5513](https://github.com/mui/base-ui/issues/5513) | Find-in-page match not highlighted on first reveal | Panel still 0-sized when the browser measured the match | Fixed (#5514) | Reveal sets the size to `auto` synchronously in the `beforematch` task |
| Base UI | [BU#5821](https://github.com/mui/base-ui/issues/5821) | `hiddenUntilFound` renders plain `hidden` in server HTML | React serialises `hidden` as boolean (react#24740) | Open | SSR must emit `until-found` (hidden-content spec) |
| Base UI | [BU#4553](https://github.com/mui/base-ui/issues/4553) | `keepMounted` panel controlled externally never hides | Close completion waited for an animation that never ran | Fixed (#4555) | Presence completes with zero animations, in every hide mode |
| Base UI | [BU#3099](https://github.com/mui/base-ui/issues/3099) | Exit animation sometimes skipped | Chrome registers the exit transition one frame late | Fixed (#3101) | Presence reads `getAnimations()` after the closed style applies (overlay presence spec) |
| Radix | [RX#1074](https://github.com/radix-ui/primitives/issues/1074) | Close animation flickers in React 18 | Unmount committed after a painted frame | Closed | Presence "No Flash On Unmount" |
| Zag | (source) `collapsible.connect.ts` | `aria-expanded` true during closing | `aria-expanded: visible` | — | `aria-expanded` follows the machine value, not presence |
| Kobalte | [KB#119](https://github.com/kobaltedev/kobalte/issues/119) | Keyboard expand closes again immediately | Two activations for one key | Closed | One activation per press (virtual-parity invariant) |
| Bits UI | [BITS#2169](https://github.com/huntabyte/bits-ui/issues/2169) | `onOpenChange` not called when the consumer sets `open` | Callback lives in the setter | Open | Documented: `onOpenChange` reports proposals only; parent changes arrive through `$sync` |
| Ariakit | [AK#5053](https://github.com/ariakit/ariakit/issues/5053) | Async `setOpen` restores the previous state | Store writes out of order | Closed | Run-to-completion `send` (foundations) |
| Kobalte | [KB#528](https://github.com/kobaltedev/kobalte/issues/528) | Collapsed content unreachable without JS | Closed content not in HTML | Closed (won't fix) | `until-found` content is in server HTML and findable before hydration |

## Known pitfalls

- **Measurement timing.** Every library measures natural size by turning
  animations off, measuring and turning them back on. Each mistiming is a
  bug: the first open in some engines, mount, Activity, reorder. Our answer
  has two parts:
  1. One `core/dom` module that runs after the commit, at fixed points of the
     open/close cycle.
  2. A size var that is `auto` at rest, so nothing needs to be suppressed.
- **Keyframes vs transitions.** Keyframes restart when a node is inserted or
  shown, by platform rule (RX#3778, RK#920). Transitions only run on change.
  The theme and docs use transitions on `height: var(--…)`. Keyframes still
  work for exit (presence), and `data-reveal="mount"` lets keyframe users skip
  the first paint.
- **`hidden` in React.** React serialises `hidden` as a boolean (react#24740).
  The attribute is set imperatively after commit and is not kept in React's
  view of the DOM (Base UI, React Aria).
- **CSS resets.** `[hidden]{display:none}` breaks `until-found` (RA#7160).
- **`aria-hidden` + `hidden`** is invalid (RA#10552).
- **Focus inside closing content** goes to `<body>` unless it is moved.

## Testing notes

- Model graph: `closed ⇄ open` with `TOGGLE`, `OPEN`, `CLOSE`. The `disabled`
  guard reads props, so the runner tests both configurations. `$sync:open`
  edges come from the controllable.
- `OPEN { reason: "find-in-page" }` cannot be produced through `Env` (no
  find-in-page API). The contract marks it skipped with that reason. A browser
  test dispatches `beforematch`, and in Chromium uses `window.find()`.
- The size var is measured only in browser mode, which has real layout.
  `@rind-ui/testing/setup` returns `getAnimations() → []`, so presence resolves
  at once in jsdom and the var ends at `auto` / `0px`.
- Traits: `disclosure` (aria-expanded mirrors; closed content absent, `hidden`
  or `until-found`) and `presence`.
- Per-contract invariants:
  - No `aria-hidden` on the content.
  - `aria-controls` present iff the content is in the document.
  - The size vars are always defined on the content.
- Driver:
  - Actions: `open()`, `close()`, `toggle()`, with pointer and keyboard
    (Enter) implementations.
  - Queries: `isOpen()`, `isDisabled()`, `contentText()`, `hiddenMode()`
    (`"until-found" | "hidden" | "unmounted" | "visible"`).

## Decisions

- **Parts.**

  | Part | Element | Notes |
  |---|---|---|
  | `Root` | `div` | Provides the machine |
  | `Trigger` | `button` | `type="button"`, press handlers, `aria-expanded`, `aria-controls` |
  | `Content` | `div` | No role; presence, size vars, hide mode |
  | `Indicator` | `span` | `aria-hidden="true"`, decorative |

- **Machine states and events.**
  - States: `closed | open`, bound to the controllable `open`.
  - Events: `TOGGLE { modality }` from the trigger's press,
    `OPEN { reason: "api" | "find-in-page" }` and `CLOSE { reason: "api" }`.
  - The `notDisabled` guard applies to user events.
  - The exit action of `open` moves focus out of the content when focus was
    inside.
  - Context `reveal: "mount" | "find-in-page" | null` feeds `data-reveal`.
  - Presence (overlay infrastructure), size and `until-found` are part
    bindings over `core/dom` modules, not machine states. The machine stays
    two states.
- **Hide mode.** `closedContent: "until-found" | "hidden" | "unmount"` on
  `Root`, default `"until-found"`. This is one prop, not
  `forceMount`/`keepMounted`/`lazyMount` booleans. It is not named `hidden`,
  which would shadow the native attribute that `Root` forwards. It is the
  `hiddenUntilFound` switch of the hidden-content spec, generalised.
  - `until-found` and `hidden` keep the content mounted.
  - `unmount` removes it once presence has settled.
  - A disabled, closed collapsible degrades `until-found` to `hidden`.
- **`data-*`.**
  - Every part: `data-scope="collapsible"`, `data-part`, `data-instance`.
  - `data-state="open|closed"` on every part, never dropped.
  - `data-disabled` on every part.
  - Trigger: `data-focus`, `data-focus-visible`, `data-pressed`, `data-hover`.
  - Content: `data-reveal="mount|find-in-page"` until the next transition.
- **CSS custom properties.** On `Content`:
  `--rind-collapsible-content-height` and `--rind-collapsible-content-width`.
  - Closed: `0px`.
  - Opening: measured px, then `auto` once the enter animations finish.
  - Closing: px, reflow, then `0px`.
  - Always defined.
- **Controlled / uncontrolled.** `open` / `defaultOpen` /
  `onOpenChange(open, details)`, from the runtime's controllable.
  `details.event.reason` tells find-in-page apart from trigger presses.
- **Contract.**
  - `collapsible`, located by the trigger's role `button` and name.
  - Actions: `open`, `close`, `toggle` (pointer, keyboard; virtual derived).
  - Queries: `isOpen`, `isDisabled`, `contentText`, `hiddenMode`.
  - Traits: `disclosure`, `presence`.
- **Deliberately different.**
  1. `aria-expanded` follows the value, not presence (Zag).
  2. The default keeps content mounted and findable (`until-found`). Radix,
     Zag and HUI unmount, which loses forms, find-in-page and no-JS reading.
  3. There is no mount-animation suppression. A settled `auto` var plus
     transitions makes it unnecessary; this removes the bug class every Radix
     port has.
  4. `beforematch` opens, never toggles.
  5. No `aria-hidden` on hidden content.
  6. Disabled never changes visibility, and it disables find-in-page reveal.
- **Skipped (YAGNI).**
  - A partially collapsed size (Zag `collapsedHeight`, RK#2320).
  - Multiple triggers (BU#4282, Ariakit). One trigger per content for now.
  - `onOpenChangeComplete` (BU#4381; presence's `onExitComplete` covers exit).
  - `orientation` (BU#3910): the width var is enough for horizontal.

## Open questions

- Does any AT announce an empty `content-visibility: hidden` element with no
  role? Our default has none. Check it in the manual protocol, with the
  accordion's closed-region rule.
- `interpolate-size` in the theme under `@supports`: drop the measurement in
  Chromium, or keep one code path? Theme-only, so it can be decided later.
