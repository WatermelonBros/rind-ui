# Tooltip — research

Status: done · Wave: 1 (used by Reado; build order step 2 in [0002](../decisions/0002-architecture.md#build-order))

A short, non-interactive text that describes (or names) a focusable element,
shown on pointer hover and keyboard focus. Built on
[overlay-infrastructure.md](overlay-infrastructure.md) (layer stack, dismiss,
presence, portal), [floating-positioning.md](floating-positioning.md) and the
a11y foundations (hover never from touch, modality, focus-visible). This note
introduces two shared pieces, specified in `add-tooltip` and reused later:

- **hover intent** — open/close delays, the grace area (safe polygon) that lets
  the pointer travel from trigger to content, descendants counting as inside;
  reused by Hover Card and, later, submenus and Navigation Menu;
- **delay group** — warm-up / cool-down shared across tooltips (one open at a
  time, skip delay); reusable by Navigation Menu triggers.

Cross-cutting notes applied: [accessibility.md](accessibility.md) (rules cited by
number), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
§1.4 "Tooltip" (name vs description, kept in DOM, inert in modals, touch),
[native-platform.md §3](native-platform.md) (`interestfor`: avoid, copy its model).

## Pattern

- WAI-ARIA APG: [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) —
  "work in progress … does not yet have task force consensus", and no example.
- Roles and attributes (APG): container `role="tooltip"`; the trigger references
  it with `aria-describedby`; the tooltip never receives focus.
- Keyboard (APG): Escape dismisses. The tooltip appears on keyboard focus and on
  hover, typically after a small delay, and disappears on blur or mouse out.
- **Known gaps of the APG pattern** (each decided below):
  1. Only *descriptions*; icon-only buttons whose tooltip is their *name* are not
     covered (AK#2228: label tooltips use `aria-labelledby`, no `role`).
  2. Nothing about touch: tooltips are unreachable by touch (AT note §1.4).
  3. Nothing about WCAG 1.4.13 *hoverable* (pointer can move onto the tooltip).
  4. No delays or grouping guidance; no word on focus moved by script.
  5. No guidance for disabled triggers (natively disabled elements are neither
     focusable nor (in Chromium) hoverable).
  6. `aria-describedby` set only while open is "dynamic" and arguable (AK#3242,
     the WordPress accessibility team), and leaves browse-mode users without the
     text (RA#2101).
- WCAG 2.2 **1.4.13 Content on Hover or Focus** (AA): *dismissible* (Escape
  without moving pointer or focus), *hoverable* (pointer can move over the
  content), *persistent* (stays until hover/focus is removed, it is dismissed, or
  it is no longer valid). Accessibility.md §8 makes it machine behaviour.

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/tooltip/src/{tooltip.machine,tooltip.connect,tooltip.store,tooltip.dom}.ts`.
- Parts: `trigger`, `positioner`, `content`, `arrow`, `arrowTip`.
- State: `closed | opening | open | closing`; events `pointer.move`, `pointer.leave`, `content.pointer.move/leave`, `open`, `close`, `controlled.*`, `triggerValue.set`, `after.openDelay`, `after.closeDelay`. Defaults `openDelay` 400, `closeDelay` 150, `interactive` **false** (content `pointer-events: none`), `closeOnScroll` true, `closeOnEscape` true, `closeOnPointerDown`, `closeOnClick`.
- Group: a module-global `store { id, prevId, instant }` — only one visible tooltip; a second one opens instantly while one is visible (`data-instant` on both). Closes on `pointerlockchange`.
- Notable: opens from `pointermove`, not `pointerenter` (works when the trigger moves under a resting pointer); focus opens only when `isFocusVisible()`; multiple triggers per tooltip.
- Problems: zag#3390 an open tooltip unmounted never cleared the global store, so every later tooltip skipped `openDelay`; zag#2850 no safe zone: crossing another trigger on the way replaces the tooltip; zag#1506 not hoverable by default; zag#1589 / ark tabbing to an off-screen trigger: focus scroll closes it (`closeOnScroll`); zag#1601 `closeOnScroll` in Safari; zag#1723 several tooltips open at once; ark#2565 tooltip on the first element of a popover opens on the popover's autofocus; ark#3378 trap wrap focus did not open the tooltip (focus-visible check); ark#1254, #3572 not on touch; zag#2702 default delay "excessive".

### Radix (Reka is a Vue port; Bits copies it)

- Source: `radix/packages/react/tooltip/src/tooltip.tsx` (804 lines); `reka-ui/packages/core/src/Tooltip`; `bits-ui/src/lib/bits/tooltip`.
- Parts: `Provider`, `Root`, `Trigger`, `Portal`, `Content`, `Arrow`.
- `Provider`: `delayDuration` 700, `skipDelayDuration` 300, `disableHoverableContent` false; `isOpenDelayed` ref flips to false on open and back after the skip window. Only one open: a `tooltip.open` document event closes the others.
- Trigger: opens on the first `pointermove` (not touch) unless the pointer is "in transit" through another tooltip's grace area; closes on pointerdown, click and blur; opens on focus unless a pointer is down. Content: `role="tooltip"` + `id` on the visible content (an `aria-label` prop renders a visually hidden `role=tooltip` copy instead); closes on scroll of any ancestor of the trigger; `data-state="closed|delayed-open|instant-open"`.
- **Grace area**: on `pointerleave` of trigger or content, a convex hull of the padded exit point and the other element's rect; pointer moves outside it close, entering the target cancels.
- Problems: #2248 (open) tooltip in a popover opens on autofocus; #1800 (open) opens again when the browser tab is re-activated (window refocus); #2988 label read twice when `aria-label` equals the content; #3185 Tab from a tooltip trigger inside a Dialog jumped to the dialog root (tooltip content not a focus-scope branch); #3299 (open) stays open when the window loses focus or the pointer leaves the window from the tooltip side; #1944 (open) focus that scrolls the trigger into view closes it; #1068, #1110, #3873 skip-delay timing (moving between triggers, siblings, `0`); #2598 consumer `aria-describedby` not merged; #3034, #3689 content mounted twice; #3858 (positioning) update loops with many instances; #2994 (open) tooltip on a DropdownMenu item; #4125 (open) no deferred outside-press fix. Reka #2868 the one-at-a-time close never fired (event on `document`, listener on `window`); Reka #850, #1544 several tooltips open because of the grace area; Reka #2543 no close on ancestor scroll; Reka #2598 hoverable content keeps stacked tooltips open; Reka #2278 broken after a modal with exit animation; Reka #733 empty `aria-describedby` on first hover; Bits #2093 content never received its `id`; Bits #1979 grace area bypassed when an element sits between trigger and content; Bits #2001 skip delay inconsistent; Bits #1687 update depth with many tooltips; Bits #1419, #1704, #1523, #2200 tooltip + popover/menu on the same trigger.

### React Aria / React Aria Components

- Source: `react-stately/src/tooltip/useTooltipTriggerState.ts`; `react-aria/src/tooltip/{useTooltipTrigger,useTooltip}.ts`; RAC `Tooltip.tsx`.
- `delay` **1500**, `closeDelay` 500, `trigger: "hover" | "focus"`, `shouldCloseOnPress` (true), `isDisabled`.
- Global state: `globalWarmedUp`, warm-up timer (`delay`), cool-down timer (`max(500, closeDelay)`); a registry closes other tooltips instantly; `shouldSkipAnimation` while warm.
- Trigger: hover counts only when the global modality is `pointer` (Chrome re-hover after an obscuring element disappears); focus opens **immediately** and only when `isFocusVisible()`; any `pointerdown` / `keydown` on the trigger closes; document capture Escape closes and stops propagation. `aria-describedby` only while open; the tooltip is **unmounted when closed**. Tooltip content itself is hoverable (`useTooltip` hover keeps it open) but there is no grace area.
- Problems: #2101 (open) keep the tooltip hidden in the DOM so `aria-describedby` resolves in JAWS virtual / NVDA browse mode; #8915 (open) tooltip inside a Modal becomes inert (MutationObserver), NVDA + Chrome/Firefox skip the description; #1170 tooltip reappears on focus restore after a menu closes; #10333 (open) in a Table, the scroll caused by focus closes it immediately; #9517 (open) cool-down tied to `closeDelay`; #8026 `open()` twice skipped the warm-up; #10460 (open) a tooltip in a PreviewTrigger popover closes the popover; #8539 tooltip on disabled buttons; #8953 Escape dismissal not configurable; #10334 interactive content in a tooltip mis-positions; #5701 E2E hover testing.

### Base UI

- Source: `base-ui/packages/react/src/tooltip/{provider,root,trigger,popup,positioner,arrow}/*`, `floating-ui-react/{safePolygon.ts,hooks/useHover*.ts,components/FloatingDelayGroup.tsx}`.
- `Provider` (`delay`, `closeDelay`, `timeout` 400 = group window); trigger `delay` 600 (**rest** time: the pointer must stop moving), `closeDelay` 0, `mouseOnly`, `closeOnClick`; `disableHoverablePopup`; `trackCursorAxis`; detached triggers; adjacent tooltips open instantly while the group is active.
- `safePolygon()`: a triangle from the exit point to the floating element plus the rectangle between them, a cursor-speed check, and "abort while a child floating element is open".
- Nested triggers (a tooltip trigger inside another's trigger) handled explicitly (#4499).
- Problems: #3075 (open) disabled `button` → no mouse events → no tooltip (`mouseOnly`); #4966 pseudo-disabled toolbar button; #891 should hide when the child becomes disabled; #4022 (open) Escape on a hover-opened tooltip inside a Dialog closes the Dialog; #1447 (open) stuck open when the page scrolls under a stationary pointer; #3304 sometimes does not close on mouse-leave; #5305 labelable controls as trigger: open then immediately close; #559, #3530 no touch support ("use a Popover infotip"); #1427 tooltip role; #3444 render performance.

### Headless UI

- Source: `@headlessui-react/src/components/tooltip/tooltip.tsx` (in source, not in public docs).
- `showDelayMs` 750, `hideDelayMs` 300; a group so the next tooltip shows immediately; `role="tooltip"`, trigger `aria-describedby` while visible; Escape closes.

### Ariakit

- Source: `ariakit-components/src/tooltip/tooltip-store.ts` (extends the hovercard store), `ariakit-react-components/src/tooltip/{tooltip,tooltip-anchor}.tsx`.
- `placement` top, `showTimeout` 500 (hovercard `timeout`), `hideTimeout` 0, `skipTimeout` 300; a global `activeStore` so a following tooltip shows without delay; `hideOnHoverOutside` with the hovercard's polygon; portal by default.
- `type: "label" | "description"`: `label` used `aria-labelledby` and no role. **Deprecated** (2024): "Render a visually hidden label or use `aria-label`/`aria-labelledby` on the anchor" — because the tooltip content is not in the DOM while closed, so the name came and went.
- Problems: #2228 labelledby vs describedby; #3242 the APG tooltip pattern is contested — don't add `tabindex` to non-focusable anchors, don't set `aria-describedby` dynamically; #887 hoverable (answered "tooltips are not interactive — use a hovercard"); #750 tooltip shown after a menu/dialog restores focus; #7622 one Escape dispatched several close events; #7116 a truly disabled anchor opened the tooltip when the disabled state was below the anchor; #471 inconsistent on disabled buttons; #4058 (open) stays visible when the container scrolls (no `mousemove` on scroll); #3216 wish for several tooltips at once; #4428 performance cycling through a toolbar.

### Kobalte

- Source: `kobalte/packages/core/src/tooltip/{tooltip-root,tooltip-trigger,utils}.tsx`.
- `openDelay` 700, `closeDelay` 300, `skipDelayDuration` 300, `ignoreSafeArea`, `triggerOnFocusOnly`; a safe area polygon from the placement (`getTooltipSafeArea`); never opens on touch.
- Problems: #187 should not open when the pointer only sweeps over the trigger; #604 (open) `forceMount` leaves dangling nodes; #632 (open) how to make it not interactive.

## Accessibility

- **Description tooltip** (default): content `role="tooltip"`, trigger
  `aria-describedby` → content id **always**, not only while open. The content
  stays mounted (`hidden` while closed): referenced hidden nodes still contribute
  their text (accname), so JAWS virtual cursor and NVDA browse mode read it
  without focusing (RA#2101), and the attribute is not "dynamic" (AK#3242).
  Consumer `aria-describedby` ids are merged, ours last (RX#2598).
- **Label tooltip** (`type: "label"`, icon-only buttons): trigger
  `aria-labelledby` → content, no `role`, no `aria-describedby`. Because the
  content is always mounted, the name never disappears — the reason Ariakit
  deprecated its `label` type does not apply. Satisfies 2.5.3 (visible text is the
  name). A consumer `aria-label` on the trigger is then ignored by AT
  (`aria-labelledby` wins) → development warning.
- **No double reading** (AT cause H, invariant 15): a trigger whose name equals
  its description is a development warning and fails the generic
  "name ≠ description" invariant (RX#2988).
- **Never focusable, never interactive**: no `tabindex`, and tabbable content
  inside the tooltip is a development warning (keyboard users can't reach it;
  RA#10334, AK#887 → use Hover Card or Popover).
- **Trigger must be focusable**: tooltips on non-focusable elements are
  unreachable by keyboard; rind-ui never adds `tabindex` (AK#3242). The trigger
  renders a `button` by default; a non-focusable rendered element is a dev warning.
- **Disabled triggers**: a natively `disabled` element can't be focused and gets
  no mouse events in Chromium (BU#3075) — the tooltip that explains *why* it is
  disabled is lost. Rule: use `focusableWhenDisabled` (`aria-disabled`, still
  focusable and hoverable — accessibility.md §1.4); a natively disabled trigger
  is a development warning. The tooltip itself opens on hover and focus of an
  `aria-disabled` trigger (BU#4966).
- **Open on focus only with keyboard intent** (AT cause C; invariant 13): focus
  with `keyboard` modality opens immediately; a pointer focus, a virtual
  (screen-reader cursor) focus, the window regaining focus (RX#1800) and focus
  moved by a layer's initial focus or focus restore (RX#2248, ARK#2565, RA#1170,
  AK#750) do not open it. Screen-reader users lose nothing: the description is
  wired permanently. Focus moved by a key (Tab wrap in a modal, roving arrows in a
  toolbar) does open it (ARK#3378).
- **1.4.13**: *dismissible* — Escape closes the tooltip without moving focus or
  pointer, routed through the layer stack, so it closes the tooltip first even if
  it was opened by hover inside a dialog (BU#4022: the dialog closes on the next
  Escape); *hoverable* — always (no opt-out, unlike Radix's
  `disableHoverableContent` and Zag's `interactive: false`): the grace area and
  the content keep it open; *persistent* — no auto-hide timer; it closes only on
  leaving hover/focus, dismissal, trigger press, or when the trigger scrolls out
  from under the pointer.
- **Touch**: never opens (hover never from touch, a11y foundations; focus after a
  tap is `touch` modality). Tooltip text must therefore never be essential; the
  description/name wiring still reaches touch screen-reader users. Long-press
  (Material, `interestfor`) is not adopted: it collides with the platform link
  and text-selection menus. Toggletip (click-to-show "i" button) = Popover.
- **Inside modals**: the mounted-while-closed content is inserted after the modal
  opened (it renders with the trigger inside the modal), so outside hiding leaves
  it alone (overlay-infrastructure: late nodes untouched) and the description
  target is never inert — RA#8915's NVDA + Chromium/Firefox silence cannot
  happen; the generic "name sources reachable" invariant guards it.
- **Escape vs parent layers**: one Escape = one layer (AK#7622).
- **Forced colors / motion**: arrow is a real element; skip-delay opens mark
  `data-instant` so the theme drops the animation; presence waits for running
  animations only.
- **Native** ([native-platform.md §2–§3](native-platform.md)): `popover="hint"`
  (Safari TP only, semantics changed in 2026) and `interestfor` (Chromium only)
  are avoided; we copy `interestfor`'s model (show/hide delays, keyboard parity,
  a dismiss key). The `title` attribute is not a substitute (no keyboard, no
  touch, not hoverable).

## Bug history

Searched open and closed issues in the ten repositories (2026-10-14):
"tooltip in:title", "tooltip delay", "tooltip touch", "tooltip disabled",
"tooltip focus", "tooltip screen reader", "safe polygon" — ≈ 560 hits,
≈ 280 unique titles, ≈ 45 read in full. **Spec** = a scenario in
`openspec/changes/add-tooltip`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [#2101](https://github.com/adobe/react-spectrum/issues/2101) | Browse-mode users never hear the tooltip | Tooltip and `aria-describedby` exist only while open | Open | Content mounted (hidden) while closed; describedby permanent (Spec) |
| React Aria | [#8915](https://github.com/adobe/react-spectrum/issues/8915) | Tooltip inside a Modal not announced (NVDA + Chrome/Firefox) | Modal's MutationObserver inerts the tooltip portal | Open | Late nodes never inerted; description target never inert (Spec) |
| Radix / Ark / React Aria / Ariakit | [RX#2248](https://github.com/radix-ui/primitives/issues/2248), [ARK#2565](https://github.com/chakra-ui/ark/issues/2565), [RA#1170](https://github.com/adobe/react-spectrum/issues/1170), [AK#750](https://github.com/ariakit/ariakit/issues/750) | Tooltip pops up when a popover autofocuses its trigger or a menu/dialog restores focus | Any focus opens the tooltip | Open / closed / by design | Focus moved by a layer (initial focus, restore) never opens (Spec) |
| Radix | [#1800](https://github.com/radix-ui/primitives/issues/1800) | Tooltip opens when the browser tab is re-activated | Window refocus fires `focus` on the trigger | Open | Window refocus does not change modality, does not open (Spec) |
| Ark | [#3378](https://github.com/chakra-ui/ark/issues/3378) | First trigger after a focus-trap wrap does not open | Programmatic wrap failed the focus-visible check | Closed (won't fix) | Focus moved in response to a key keeps `keyboard` modality and opens (Spec) |
| Radix / React Aria / Zag | [RX#1944](https://github.com/radix-ui/primitives/issues/1944), [RA#10333](https://github.com/adobe/react-spectrum/issues/10333), [ZG#1589](https://github.com/chakra-ui/zag/issues/1589) | Tabbing to an off-screen trigger: tooltip flashes and closes | The scroll caused by focus triggers close-on-scroll | Open / open / option added | Scroll only re-checks pointer hover; a focus-opened tooltip stays (Spec) |
| Ariakit / Base UI / Reka | [AK#4058](https://github.com/ariakit/ariakit/issues/4058), [BU#1447](https://github.com/mui/base-ui/issues/1447), [RK#2543](https://github.com/unovue/reka-ui/issues/2543) | Hover tooltip stays when its container scrolls away from the pointer | Hover logic driven by `mousemove`, none on scroll | Open / open / fixed | Scroll re-evaluates the hover zone with the last pointer position (Spec, hover-intent) |
| Radix | [#3299](https://github.com/radix-ui/primitives/issues/3299) | Stays open when the window loses focus or the pointer exits the window over the tooltip | No `pointerleave` delivered | Open | Leaving the document / window blur ends hover (Spec, hover-intent) |
| Radix | [#2988](https://github.com/radix-ui/primitives/issues/2988) | VoiceOver reads the label twice | `aria-label` equals the description | Closed (dup #3689) | Dev warning + name ≠ description invariant (Spec) |
| Ariakit | [#2228](https://github.com/ariakit/ariakit/issues/2228), [#3242](https://github.com/ariakit/ariakit/issues/3242) | Labelledby vs describedby confusion; contested pattern | One mechanism for two jobs | `type` option, later deprecated | `type: "description"` default, `"label"` explicit, both permanently wired (Spec) |
| Radix | [#2598](https://github.com/radix-ui/primitives/issues/2598) | Consumer `aria-describedby` drops the tooltip id | Attribute replaced, not merged | Closed | Ids merged (Spec) |
| Bits / Reka | [BITS#2093](https://github.com/huntabyte/bits-ui/issues/2093), [RK#733](https://github.com/unovue/reka-ui/issues/733) | `aria-describedby` empty / dangling | Content never got its id; id assigned after first hover | Fixed | Ids derived from the root id, rendered from the first paint (generic IDREF invariant) |
| Ariakit / Zag | [AK#887](https://github.com/ariakit/ariakit/issues/887), [ZG#1506](https://github.com/chakra-ui/zag/issues/1506) | Moving onto the tooltip closes it (1.4.13 hoverable) | Content not hoverable by default | Closed | Always hoverable, grace area (Spec) |
| Zag / Bits | [ZG#2850](https://github.com/chakra-ui/zag/issues/2850), [BITS#1979](https://github.com/huntabyte/bits-ui/issues/1979) | Diagonal move toward the tooltip crosses another trigger and replaces it | No grace area / bypassed by an element in between | Fixed | While the pointer travels in the grace area, other hover-intent triggers don't open (Spec, hover-intent) |
| Reka | [#850](https://github.com/unovue/reka-ui/issues/850), [#1544](https://github.com/unovue/reka-ui/issues/1544) | Two tooltips visible at once | Grace area kept the first open while the second opened | Fixed | One open member per group; opening one closes the others (Spec, delay-group) |
| Reka | [#2868](https://github.com/unovue/reka-ui/issues/2868) | One-at-a-time close never fired | Event dispatched on `document`, listened on `window`, non-bubbling | Fixed | Group is a shared object, not DOM events (design) |
| Zag | [#3390](https://github.com/chakra-ui/zag/issues/3390) | After an open tooltip unmounts, every tooltip skips its delay | Global id cleared only on entering `closed` | Fixed | Group membership released by effect cleanup on stop (Spec, delay-group) |
| React Aria | [#9517](https://github.com/adobe/react-spectrum/issues/9517) | `closeDelay: 0` still leaves a 500 ms warm window | Cool-down = `max(500, closeDelay)` | Open | Skip window independent of close delay (Spec, delay-group) |
| Radix | [#3873](https://github.com/radix-ui/primitives/issues/3873), [#1110](https://github.com/radix-ui/primitives/issues/1110) | `skipDelayDuration` 0 still skips; short values ignored for siblings | Timer always scheduled | Fixed | `skipDelay: 0` never warms; all timing on the injected scheduler (Spec, delay-group) |
| React Aria | [#8026](https://github.com/adobe/react-spectrum/issues/8026) | Calling `open()` twice opens immediately | Second call saw a warm-up in progress as "warm" | Fixed | Repeated open requests while opening change nothing (Spec) |
| Base UI | [#4022](https://github.com/mui/base-ui/issues/4022) | Escape on a hover-opened tooltip in a Dialog closes the Dialog | Escape handled by the focused element's layer | Open | Tooltip is a layer; Escape closes the topmost — the tooltip (Spec) |
| Ariakit | [#7622](https://github.com/ariakit/ariakit/issues/7622) | One Escape dispatches several closes | Close requested by two paths | Fixed | One key, one close request (overlay infra) |
| Radix | [#3185](https://github.com/radix-ui/primitives/issues/3185) | Tab from a tooltip trigger in a Dialog jumps to the dialog root | Portalled tooltip not a branch of the dialog focus scope | Fixed | Containment wraps only at edges, no focus reclaim; tooltip is a child layer (Spec) |
| Base UI / React Aria / Ariakit | [BU#3075](https://github.com/mui/base-ui/issues/3075), [RA#8539](https://github.com/adobe/react-spectrum/issues/8539), [AK#471](https://github.com/ariakit/ariakit/issues/471) | No tooltip on disabled buttons | Disabled elements get no focus / mouse events | Open / closed | `aria-disabled` trigger supported; native `disabled` warned (Spec) |
| Base UI / Ariakit | [BU#4966](https://github.com/mui/base-ui/issues/4966), [AK#7116](https://github.com/ariakit/ariakit/issues/7116) | Pseudo-disabled trigger gets no tooltip / truly disabled one does | Disabled state read from the wrong layer of composition | Fixed | Disabled-ness read from the rendered element (connect receives it) (Spec) |
| Ark / Base UI / Reka / Bits | [ARK#3572](https://github.com/chakra-ui/ark/issues/3572), [BU#559](https://github.com/mui/base-ui/issues/559), [RK#1443](https://github.com/unovue/reka-ui/issues/1443), [BITS#571](https://github.com/huntabyte/bits-ui/issues/571) | "Tooltip doesn't work on touch" | By design | Closed | Never on touch; documented; toggletip = Popover (Spec) |
| Bits / Ariakit / Base UI | [BITS#2200](https://github.com/huntabyte/bits-ui/issues/2200), [AK#3754](https://github.com/ariakit/ariakit/issues/3754), [BU#3576](https://github.com/mui/base-ui/issues/3576) | Tooltip + menu/popover on one trigger: menu doesn't take focus / doesn't open | Handlers competing; tooltip consumed events | Open / fixed | Tooltip consumes no press or key; press closes it; composition scenario (Spec) |
| React Aria | [#10460](https://github.com/adobe/react-spectrum/issues/10460) | A tooltip inside a preview popover closes the popover | Pointer over a child layer counted as outside | Open | Descendant layers are inside the hover zone (Spec, hover-intent) |
| Base UI | [#5305](https://github.com/mui/base-ui/issues/5305) | Labelable control as trigger: open then instant close | The control's label click re-dispatched a click to the trigger | Fixed | Only primary presses on the trigger close; browser test with checkbox/switch triggers |
| Radix / Bits | [RX#3858](https://github.com/radix-ui/primitives/issues/3858), [BITS#1687](https://github.com/huntabyte/bits-ui/issues/1687), [AK#4428](https://github.com/ariakit/ariakit/issues/4428) | Many tooltips: update loops, jank cycling a toolbar | Per-instance effects and listeners while closed | Fixed | A closed tooltip has no listeners, timers, observers or layer (Spec) |
| Zag | [#2702](https://github.com/chakra-ui/zag/issues/2702) | Default open delay "excessive" / too short elsewhere | No agreed default (400–1500 ms) | Changed | 700 ms default (majority), tunable per tooltip |

## Known pitfalls

- **Focus that is not intent** — autofocus, focus restore, window refocus, the
  focus-induced scroll — is the most-reported tooltip bug class (four libraries).
- **Global group state** leaks (ZG#3390), never fires (RK#2868) or couples to the
  close delay (RA#9517).
- **Hover detected from `mousemove` only**: scroll, window blur and leaving the
  window over the tooltip leave it stuck (AK#4058, RX#3299, BU#1447).
- **Grace area vs one-at-a-time**: the polygon must stop other triggers from
  opening while the pointer travels (ZG#2850), and must not keep two tooltips
  open (RK#850).
- **Disabled triggers** and **touch** are unsolvable inside a tooltip; the
  library must say so and offer the accessible alternative.
- **Composition** with menu/popover triggers on the same element.
- Hover-opened tooltip + Escape inside a dialog: which layer closes.

## Testing notes

- Delays run on the injected scheduler → fake timers in every environment
  (Radix #3419 "cannot test unhover", Zag #2134 RTL hover not working, RA#5701).
- The driver's `show()` has a pointer implementation (hover the trigger) and a
  keyboard twin (move focus onto the trigger with Tab: the adapter focuses the
  preceding tabbable and presses Tab, so the focus carries `keyboard` modality);
  `hide()` = move the pointer away / press Escape. Hover with `pointerType:
  "touch"` must not open (a11y invariant "hover never from touch").
- The content is always mounted, so the driver reads `data-state` and `hidden`,
  and `description()` reads the trigger's accessible description — the thing
  users get.
- The grace area needs real geometry → browser mode only; jsdom checks the
  delays, group and focus rules.
- Model-based: states `closed | opening | open | closing` × modalities
  (pointer, keyboard, virtual focus must *not* open); delay-group paths need two
  instances (a two-tooltip fixture story).

## Decisions

### Parts

| Part | Element | Notes |
|---|---|---|
| `Root` | none | Machine; joins the document delay group. |
| `Trigger` | `button` | `aria-describedby` (description) or `aria-labelledby` (label), permanent. |
| `Portal` | generic | Optional, shared. |
| `Positioner` | `div` | Positioning; `pointer-events` only on content. |
| `Content` | `div` | `role="tooltip"` (description type), id; mounted while closed with `hidden`. |
| `Arrow` | `div` | `aria-hidden`. |

No `Provider`/`Group` part: one group per document by default, delays per
tooltip; consumers wrap Tooltip once in their design system anyway.

### Machine

```
closed ──HOVER.START / OPEN──► opening ──after openDelay──► open
closed ──FOCUS(keyboard) / HOVER.START when group warm──► open
opening ──HOVER.END / BLUR / PRESS / CLOSE──► closed
open ──HOVER.END (left the hover zone)──► closing ──after closeDelay──► closed
closing ──HOVER.START (zone re-entered) / FOCUS(keyboard)──► open
open|closing ──CLOSE{escape-key|outside-press|trigger-press|blur|group|disabled|api}──► closed
```

- Events: `HOVER.START`, `HOVER.END` (from hover intent), `FOCUS { modality,
  cause }`, `BLUR`, `PRESS.START` (trigger press), `CLOSE { reason }`, `OPEN`
  (api), `GROUP.REPLACED`, `POSITION.PLACED`; delays `openDelay` (700),
  `closeDelay` (300) as delayed transitions.
- Controllable `open` / `defaultOpen` / `onOpenChange(open, details)`.
- Effects: `delayGroupMembership` (service lifetime: registered while mounted,
  released on stop), `hoverIntent` (while open/closing), `layer` (open/closing,
  non-modal `tooltip` kind, Escape + outside press + outside focus), `trackPosition`.
- Guards: `isKeyboardFocus` (modality keyboard and not a layer-initiated move),
  `isGroupWarm`, `notDisabled`.

### `data-*`

- All parts `data-scope="tooltip"`, `data-part`.
- Trigger: `data-state="open|closed"`, `data-hover`, `data-focus`,
  `data-focus-visible` (a11y foundations).
- Positioner, Content: `data-state`, `data-instant` (opened during the warm
  window or replaced, no animation), positioning `data-side`, `data-align`,
  `data-placing`, `data-anchor-hidden`.
- Arrow: `data-side`, `data-uncentered`.

### Contract

`tooltipContract`: locate the trigger by role + name. Actions `show` (pointer:
hover; keyboard: Tab onto the trigger), `hide` (pointer: unhover; keyboard:
Escape), `pressEscape`, `pressTrigger`, `hoverContent`; queries `isOpen`, `text`,
`description` (trigger's accessible description), `label` (trigger's name),
`isInstant`, positioning fragment. Traits `layer`, `anchored`. The always-mounted
content is checked by a per-contract invariant (closed ⇒ `hidden`, still
referenced).

### Deliberately different from the others, and why

1. **Content mounted while closed**, describedby/labelledby permanent (RA#2101
   asks for it; nobody ships it) — which also revives Ariakit's `label` type.
2. **Focus opens only with keyboard intent**, excluding layer-initiated moves and
   window refocus — the single biggest bug class.
3. **Always hoverable**, no opt-out (1.4.13).
4. **Scroll re-evaluates the pointer** instead of "close on any scroll" (fixes
   both RX#1944 and AK#4058 classes).
5. **Group without a Provider**, stored on the document (two copies share it),
   membership tied to service lifetime.
6. **Hover intent as a shared capability** — the grace area, "in transit"
   suppression and descendant-layers rule, written once for Tooltip, Hover Card,
   submenus.

## Open questions

- Open delay: 700 ms (Radix, Kobalte, Reka, Bits) vs 600 (Base UI) vs 400 (Zag,
  what Reado has today). Spec fixes 700; Reado can pass 400 during its migration.
- Base UI's "rest" delay (open only after the pointer stops) avoids tooltips while
  sweeping across a toolbar (KB#187) but is harder to reason about; revisit with
  user feedback — it changes only the hover-intent start condition.
- VoiceOver + Safari reading a `hidden` description target: expected to work
  (accname), confirm in the manual tier-1 pass.
