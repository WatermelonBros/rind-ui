# Hover Card — research

Status: done · Wave: 2 (also the base of the AI primitive Citation)

A rich preview (profile card, link preview, citation source) that opens when a
pointer rests on a link, or when the link has keyboard focus for a moment. It may
contain interactive content (follow button, links), which is what separates it
from a Tooltip. Names across libraries: Hover Card (Radix, Reka, Ark/Zag,
Kobalte), Preview Card (Base UI), Link Preview (Bits UI), Hovercard (Ariakit),
PreviewTrigger (React Aria Components).

Hover Card adds no new infrastructure. It composes:

- `hover-intent` (delays, grace area, descendants inside, scroll/leave rules) —
  specified in `add-tooltip`, see [tooltip.md](tooltip.md);
- `non-modal-tab-order` (portalled content sits right after its trigger in the
  Tab sequence) — specified in `add-popover`, see [popover.md](popover.md);
- the overlay infrastructure (layer, dismiss, presence, portal) and
  floating positioning.

Cross-cutting notes applied: [accessibility.md](accessibility.md) (§1.5: "Hover
Card is *not* a tooltip: it is a non-modal dialog"; §8 1.4.13),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md),
[native-platform.md §3](native-platform.md) (`interestfor`: avoid, copy its model).

## Pattern

- WAI-ARIA APG pattern: **none**. APG's Tooltip pattern points elsewhere: "a hover
  that contains focusable elements can be made using a non-modal dialog". The
  closest semantics are therefore a non-modal `dialog` related to a link.
- Roles and attributes (rind-ui): content `role="dialog"` (no `aria-modal`),
  named by the trigger (`aria-labelledby` → trigger) unless the consumer names it;
  trigger keeps its own role (usually `link`) and gets `aria-haspopup="dialog"`,
  `aria-expanded`, `aria-controls` while the content is mounted.
- Keyboard: keyboard focus on the trigger opens it after the open delay; Tab
  from the trigger enters the content; Shift+Tab from its first element returns
  to the trigger; Tab past its end continues after the trigger and closes it;
  Escape closes it and keeps (or returns) focus on the trigger.
- WCAG 2.2 1.4.13: dismissible (Escape), hoverable (grace area), persistent.
  2.1.1 Keyboard: whatever the card offers must be operable by keyboard *or*
  also available at the link's destination (the usage rule every library states).

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/hover-card/src/{hover-card.machine,hover-card.connect}.ts`.
- Parts: `trigger`, `positioner`, `content`, `arrow`, `arrowTip`.
- State: `closed | opening | open | closing` (tags `open`/`closed`); events `POINTER_ENTER`, `POINTER_LEAVE`, `TRIGGER_FOCUS`, `TRIGGER_BLUR`, `OPEN`, `CLOSE`, `OPEN_DELAY`, `CLOSE_DELAY`, `CONTROLLED.*`, `TRIGGER_VALUE.SET`. `openDelay` 600, `closeDelay` 300; `isPointer` context keeps a pointer-opened card open on blur. Dismissable layer with focus-outside prevented.
- ARIA: **none** on trigger or content; touch pointers ignored.
- Problems: zag#3181 closes when the pointer crosses the gutter gap (no grace area, only `closeDelay`); zag#3224 closes on pointer leave while the trigger keeps keyboard focus; zag#1951 passive-listener `preventDefault`.

### Radix (Reka, Bits UI Link Preview)

- Source: `radix/packages/react/hover-card/src/hover-card.tsx` (436 lines); `reka-ui/packages/core/src/HoverCard`; `bits-ui/src/lib/bits/link-preview`.
- Parts: `Root`, `Trigger` (an `a`), `Portal`, `Content`, `Arrow`. `openDelay` 700, `closeDelay` 300. Opens on pointer enter (not touch) and on focus; closes on pointer leave and blur.
- **All tabbable nodes in the content get `tabindex="-1"`** — "HoverCard should only be used as an enhancement for links" for sighted pointer users (RX#2692). Text selection inside the card is contained (body `user-select: none` while selecting).
- Bits Link Preview: `SafePolygon`; opens on focus only when focus-visible; trigger gets `role="button"` (overriding the link role), `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`; content `tabindex=-1` and no role.
- Problems: RX#2692 forms in a hover card impossible (by design); RX#920 hover card inside a Dialog not part of the layer logic; RX#3175 (open) a Select inside closes the card (Select disables outside pointer events, so the card loses hover); RX#2502 Chrome autofill dropdown closes it; RX#2138 opens by itself when a popover autofocuses its button trigger; RX#1248 / RX#2853 open delay not cancelled when the pointer leaves (inside a DropdownMenu); RX#1549 asks for a pointer-intent polygon; Reka #771 missing the tooltip's grace area; Reka #1063 closes when moving quickly onto the content; Reka #2203 hover area overlaps neighbours when the content is wide; Reka #802 trigger untappable on mobile (non-passive `touchstart` `preventDefault` in Vue); Bits #1697, #1703 `forceMount` breaks hover and delays; Bits #2103, #2153 timers and listeners leak after close.

### React Aria Components (`PreviewTrigger`)

- Source: `react-aria/src/tooltip/{usePreviewTrigger,useSafeArea}.ts`, RAC `PreviewTrigger.tsx` (uses `useTooltipTriggerState` with `delay` 600, `closeDelay` 200, and a non-modal `Popover`).
- **Accessible by design**: trigger `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` and `aria-describedby` → popover while open; focus-visible on the trigger opens **after the delay** ("tabbing quickly through the page doesn't open previews"); Tab from the trigger moves into the popover; Escape closes and restores focus to the link without re-opening (`ignoreFocus`); **long press** opens on touch (with a localised hint in `aria-describedby`, `-webkit-touch-callout: none`) and then focuses the popover so touch screen readers move into it.
- `useSafeArea`: the convex hull of the padded trigger and popover rects; pointer anywhere inside keeps it open, regardless of placement, even with `closeDelay` 0; leaving the document counts as leaving.
- Shares the global warm-up with tooltips (`useTooltipTriggerState`).
- Problems: RA#10443 (open) a nested popover (Select) closes the preview when hovered — rendered outside the safe area; RA#10460 (open) a Tooltip inside the preview closes it; RA#10680 (open) fast sweep across triggers leaves one unpositioned.

### Base UI (Preview Card)

- Source: `base-ui/packages/react/src/preview-card/{root,trigger,popup,positioner,arrow,backdrop}/*`, `floating-ui-react/safePolygon.ts`.
- Trigger renders an `a`; `delay` 600, `closeDelay` 300; `useFocus` with the same delay; `safePolygon()`; inline-rect anchoring for multi-line links; detached triggers with payloads.
- **No ARIA**: "a visual-only enhancement for sighted, desktop users … only on links, where all of the data and actions inside the popup are also accessible by following the link" (BU#4778). BU#4170 (accessibility audit: not keyboard/SR/touch operable, fails 2.1.1 unless the rule is followed) → documented. BU#5583 (open) asks for React Aria's model; maintainers' concerns: SR users would not know a preview exists, and tabbing through every element in the popup to reach the next page element is "brutal"; Ariakit's disclosure button is the only cross-modality pattern they know.
- Problems: BU#3129 a Menu inside the card closes both; BU#3673 nested preview cards; BU#3519 (open) a group `timeout`; BU#4586 (open) `interestfor` instead of JS.

### Ariakit (Hovercard)

- Source: `ariakit-react-components/src/hovercard/{hovercard,hovercard-anchor,hovercard-disclosure}.tsx`, `ariakit-components/src/hovercard/hovercard-store.ts`.
- `Hovercard` is a `Popover` (non-modal `dialog`); `timeout` 500 (`showTimeout` / `hideTimeout`); `hideOnHoverOutside` with an element polygon; **`disablePointerEventsOnApproach`** (while the pointer travels towards the card, elements under the polygon get `pointer-events: none` so they don't steal hover); opens only on *intentional* mouse movement (AK#1662: scrolling under a resting pointer does not open).
- Keyboard: focusing the anchor does **not** open; a visually hidden **`HovercardDisclosure`** button appears next to the anchor when it is focus-visible; activating it opens the card like a popover (focus moves in).
- Problems: AK#1662 stays after scrolling away; AK#6303 closes while resting on a web component (composed-path target); AK#2238 hides unexpectedly with an absolutely positioned anchor and `modal`; AK#4190 focus returned with `:focus-visible` after mouse use; AK#7622 one Escape dispatched several closes.

### Kobalte

- Source: `kobalte/packages/core/src/hover-card/*`. `openDelay` 700, `closeDelay` 300, safe-area polygon (`ignoreSafeArea`), no touch.

## Accessibility

- **The usage rule first**: everything in a hover card must also be reachable
  without it — the link's destination has the same information and actions
  (Base UI, Radix guidance; BU#4170). The card is an enhancement, never the only
  path. It is documented and stated in the spec's purpose; it cannot be enforced.
- **Keyboard parity anyway** (2.1.1, accessibility.md §4.3 "portalled non-modal
  popups … stay in a sensible order"): keyboard focus on the trigger opens it
  after the open delay (React Aria's rule — quick tabbing through a list of links
  opens nothing), Tab enters it via `non-modal-tab-order`, Escape closes it and
  Tab continues past the trigger. This answers BU#5583's "brutal tabbing" concern:
  the card only joins the Tab sequence once the user lingered on the link, and
  one Escape takes it out again.
- **Semantics**: a non-modal `dialog` named by the trigger; trigger
  `aria-haspopup="dialog"` + `aria-expanded` so screen-reader users learn that a
  preview exists and is open (BU#5583's "how would they know" question). No
  `aria-describedby` from the trigger to the whole card (React Aria does it): a
  full card read as the link's description on every focus is too verbose and
  doubles the content when the user enters it.
- **Virtual cursor focus does not open it** (AT cause C): the VO/NVDA cursor
  moving across links would otherwise pop cards everywhere; SR users open it by
  focusing with Tab (keyboard modality) and waiting, or simply follow the link.
- **Touch: does not open.** A tap follows the link (never `preventDefault` on
  touch — RK#802). React Aria's long press is not adopted in v1: on links it
  replaces the platform's long-press menu (iOS link preview, "open in new tab")
  with ours. Revisit with Citation, whose trigger is not a link.
- **Focus inside keeps it open** (RX#2502 Chrome autofill, RX#3175 Select):
  while focus is in the content or one of its descendant layers, pointer
  movement never closes it — only blur out of both, Escape or an outside press.
- **No initial focus** on open (it is a preview); focus restore on close only
  when focus was inside (overlay infrastructure rule).
- **Escape** closes only the topmost layer (a tooltip or select inside closes first).
- **Forced colors / motion / RTL**: same as Popover (arrow is an element, presence
  waits for running animations only, logical sides).
- **Native**: `interestfor` (Chromium only, non-standard track; BU#4586) is the
  platform's version of this component — keyboard and long-press included — and
  is avoided; we copy its model (delays, keyboard parity, a dismiss key).

## Bug history

Searched open and closed issues (2026-10-14): "hover card", "hovercard" (Radix,
Reka, Bits, Kobalte, Zag, Ark, Ariakit), "preview card" (Base UI, React Aria),
"link preview" (Bits, React Aria), "safe polygon" — ≈ 160 hits, ≈ 70 unique,
≈ 25 read in full. Hover-intent bugs shared with Tooltip are in
[tooltip.md](tooltip.md). **Spec** = a scenario in `openspec/changes/add-hover-card`
(or, where marked, in `add-tooltip`'s `hover-intent`).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag | [#3181](https://github.com/chakra-ui/zag/issues/3181) | Card closes while the pointer crosses the gap to the content | No grace area; only `closeDelay` | Fixed | Grace area (Spec, hover-intent) |
| Reka / Radix | [RK#771](https://github.com/unovue/reka-ui/issues/771), [RK#1063](https://github.com/unovue/reka-ui/issues/1063), [RX#1549](https://github.com/radix-ui/primitives/issues/1549) | Moving quickly onto the content closes it; request for an intent polygon | Hover card lacked the tooltip's grace area | Fixed / closed | One hover-intent implementation for both (Spec) |
| Reka | [#2203](https://github.com/unovue/reka-ui/issues/2203) | Wide content keeps the card open over neighbouring elements | Hover area = trigger ∪ content box hull too large | Fixed | Grace area from the exit point, not a hull of both boxes (hover-intent design) |
| Radix | [#1248](https://github.com/radix-ui/primitives/issues/1248), [#2853](https://github.com/radix-ui/primitives/issues/2853) | Card opens after the pointer already left / inside a DropdownMenu | Open timer not cancelled; focus on tab re-activation | Fixed / closed | Leaving before the delay cancels; window refocus never opens (Spec) |
| Ariakit | [#1662](https://github.com/ariakit/ariakit/issues/1662) | Card stays after scrolling away / appears when content scrolls under the pointer | No movement events during scroll | Closed (by design) | Opening needs pointer movement; scroll re-evaluates the zone (Spec, hover-intent) |
| Zag | [#3224](https://github.com/chakra-ui/zag/issues/3224) | Closes on pointer leave while the trigger still has keyboard focus | Pointer leave ignores focus | Fixed | Keyboard focus on trigger or inside keeps it open (Spec) |
| Radix | [#2502](https://github.com/radix-ui/primitives/issues/2502) | Chrome autofill dropdown over an input closes the card | Browser UI is outside the document: pointer left | Fixed | Focus inside keeps it open regardless of pointer (Spec) |
| Radix / React Aria / Base UI | [RX#3175](https://github.com/radix-ui/primitives/issues/3175), [RA#10443](https://github.com/adobe/react-spectrum/issues/10443), [BU#3129](https://github.com/mui/base-ui/issues/3129) | A Select / Menu inside the card closes it (and itself) | Child layer outside the hover area; Select blocks outside pointer events | Open / open / fixed | Descendant layers are inside; no close while a child layer is open (Spec) |
| React Aria | [#10460](https://github.com/adobe/react-spectrum/issues/10460) | A Tooltip inside the card closes the card | Same | Open | Same (Spec, hover-intent) |
| Base UI | [#3673](https://github.com/mui/base-ui/issues/3673) | Nested preview cards fail | Parent closed when the pointer reached the child | Fixed (partly) | Nested hover cards are descendant layers (Spec) |
| Radix | [#920](https://github.com/radix-ui/primitives/issues/920) | Hover card in a Dialog closes / unfocusable | Hover card not a layer | Fixed | Hover card registers a layer (child of the dialog) (Spec) |
| Radix | [#2138](https://github.com/radix-ui/primitives/issues/2138) | Opens by itself when a popover autofocuses its trigger | Any focus opens | Closed (workaround) | Layer-initiated focus never opens (Spec) |
| Radix | [#2692](https://github.com/radix-ui/primitives/issues/2692) | Forms inside impossible: tabbables forced to `tabindex=-1` | Pointer-only by design | Closed | Content keyboard-reachable through `non-modal-tab-order` (Spec) |
| Base UI | [#4170](https://github.com/mui/base-ui/issues/4170), [#5583](https://github.com/mui/base-ui/issues/5583) | Not operable by keyboard/SR/touch; request for React Aria's model | Visual-only design | Documented / open | Keyboard parity + named dialog + usage rule (Spec) |
| Reka | [#802](https://github.com/unovue/reka-ui/issues/802) | Link with a hover card untappable on mobile | Non-passive `touchstart` `preventDefault` | Fixed | Touch never prevented, tap follows the link (Spec) |
| Base UI | [#4778](https://github.com/mui/base-ui/issues/4778) | "Should open on touch" | Pointer-only by design | Closed | No touch open (documented); revisit for Citation |
| Ariakit | [#6303](https://github.com/ariakit/ariakit/issues/6303) | Closes while resting on a web component in the card | Target = innermost composed-path node, not contained in the card | Fixed | Containment through shadow roots (Spec, hover-intent) |
| React Aria | [#10680](https://github.com/adobe/react-spectrum/issues/10680) | Fast sweep across triggers leaves a card unpositioned | Stale positioning pass won | Open | Positioning drops stale passes (floating-positioning) |
| Bits | [#2103](https://github.com/huntabyte/bits-ui/issues/2103), [#2153](https://github.com/huntabyte/bits-ui/issues/2153) | Timers and document listeners survive close | Cleanup not tied to state exit | Fixed / open | All timers/listeners are state-scoped effects (machine runtime) |
| Bits | [#1697](https://github.com/huntabyte/bits-ui/issues/1697), [#1703](https://github.com/huntabyte/bits-ui/issues/1703) | `forceMount` breaks hover and delays | Mounted-but-closed content treated as open | Fixed | Kept-mounted content registers no layer, no hover zone (overlay infra) |
| Ariakit | [#4190](https://github.com/ariakit/ariakit/issues/4190) | Focus returns with a focus ring after mouse use | Restore ignored modality | Fixed | Restore through `focusSafely` (overlay infra) |
| Radix | [#2293](https://github.com/radix-ui/primitives/issues/2293) | "Links are not crawlable" SEO warning | Trigger rendered without `href` in examples | Closed | Trigger is the consumer's link; we never strip `href` (docs) |

## Known pitfalls

- **Child layers** (Select, Menu, Tooltip, nested hover cards) rendered in
  portals fall outside every rectangle-based hover area — five open or recently
  fixed bugs across three libraries. Layer parentage solves it generically.
- **Focus vs pointer**: closing on pointer leave while focus is inside (forms,
  autofill) or on the trigger.
- **Keyboard access**: libraries chose either "none" (Radix, Base, Zag) or two
  different models (React Aria: Tab in; Ariakit: disclosure button).
- **Touch**: preventing default on touch breaks the link (RK#802); opening on
  long-press replaces the platform menu.
- Cleanup of timers and listeners when closed or unmounted.

## Testing notes

- Same as Tooltip for delays (fake timers through the injected scheduler) and
  the grace area (browser only).
- Driver located by the trigger (role `link` by default) + name; actions `show`
  (pointer hover; keyboard: Tab onto the trigger then wait for the delay), `hide`
  (pointer leave; Escape), `enter` (Tab into the content), `pressEscape`,
  `pressOutside`; queries `isOpen`, `hasFocus`, positioning fragment.
- Model-based: `closed | opening | open | closing` × pointer/keyboard; virtual
  focus must not open; touch hover must not open; a fixture with a Select inside
  the card for the descendant-layer rule.

## Decisions

### Parts

| Part | Element | Notes |
|---|---|---|
| `Root` | none | Machine, layer context. |
| `Trigger` | `a` | Consumer's link; `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` while mounted. |
| `Portal` | generic | Shared. |
| `Positioner` | `div` | Positioning. |
| `Content` | `div` | `role="dialog"`, `aria-labelledby` → trigger by default, `tabindex=-1`. |
| `Arrow` | `div` | `aria-hidden`. |

### Machine

Same four states as Tooltip (and Zag's hover card), its own machine:

```
closed ──HOVER.START──► opening ──after openDelay──► open
closed ──FOCUS(keyboard, not layer-initiated)──► opening
opening ──HOVER.END / BLUR / CLOSE──► closed
open ──HOVER.END (zone left, no focus inside, no child layer open) / BLUR (focus left trigger+content)──► closing ──after closeDelay──► closed
closing ──HOVER.START / FOCUS──► open
open|closing ──CLOSE{escape-key|outside-press|outside-focus|parent-dismissed|api}──► closed
```

- Delays `openDelay` 700, `closeDelay` 300 (Radix, Reka, Kobalte, Bits); no
  delay group (hover cards do not chain like toolbar tooltips; React Aria's
  sharing with tooltips is not copied).
- Controllable `open` / `defaultOpen` / `onOpenChange(open, details)`.
- Effects while open/closing: `layer` (non-modal, kind `popover`; Escape,
  outside press, outside focus), `hoverIntent`, `nonModalTabOrder`,
  `trackPosition`. No initial focus.

### `data-*`

- All parts `data-scope="hover-card"`, `data-part`.
- Trigger: `data-state`, `data-hover`, `data-focus`, `data-focus-visible`.
- Positioner, Content: `data-state`, positioning attributes; Content
  `data-nested`, `data-has-nested`.
- Arrow: `data-side`, `data-uncentered`.

### Contract

`hoverCardContract`: locate the trigger by role (`link` by default) + name;
actions `show`, `hide`, `enter`, `pressEscape`, `pressOutside`, `tab`, `shiftTab`,
`waitForUnmount`; queries `isOpen`, `hasFocus`, `isTopmost`, positioning
fragment. Traits `layer`, `presence`, `anchored`, `restores-focus`.

### Deliberately different from the others, and why

1. **Keyboard-reachable** (React Aria's Tab model) instead of pointer-only
   (Radix/Base/Zag) or a disclosure button (Ariakit, which adds a tab stop to
   every link).
2. **Descendant layers keep it open** and pointer leave never closes it while
   focus is inside.
3. **No `aria-describedby` to the card** (React Aria) — verbose, duplicated.
4. **No long press on touch** in v1.
5. **No delay group shared with tooltips**.

## Open questions

- Long press for Citation (non-link triggers): revisit in the Citation note; it
  is an additional opening event, not a change to these specs.
- Default open delay 700 vs React Aria/Base UI 600 — kept with Radix/Kobalte;
  tunable per instance.
