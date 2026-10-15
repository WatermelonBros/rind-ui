# Accordion — research

Status: done · Wave: 1

An accordion is a vertically stacked set of headings. Each heading holds a
button that shows or hides one section. Each item is a
[Collapsible](collapsible.md) whose open state the group owns. Everything
decided for Collapsible (hide modes, size vars, find-in-page, focus on close,
no `aria-hidden`) holds here. This note adds only what the group adds.

Issue prefixes as in [collapsible.md](collapsible.md).

## Pattern

- WAI-ARIA APG: [Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
  (fetched 2026-10-14).
- Roles and attributes:
  - Each header button (`role="button"`) is the **only element** inside a
    `role="heading"` with an `aria-level` that fits the page's outline. A
    native `h2`–`h6` gives both.
  - The button has `aria-expanded`, plus `aria-controls` → the panel.
  - If a panel cannot be collapsed (one panel must always stay open), its
    header button has `aria-disabled="true"`.
  - Panels *may* be `role="region"` with `aria-labelledby` → the button.
    Avoid this when it would make too many landmarks, "e.g. … more than
    approximately 6 panels that can be expanded at the same time."
- Keyboard:
  - Enter or Space expands a collapsed panel. It collapses an expanded panel
    when the implementation allows collapsing.
  - Tab and Shift+Tab move through every focusable element in page order.
- **Change (2026-04-29):** w3c/aria-practices#3434 ("Remove optional arrow,
  home, and end keys") resolved #3406. Arrow keys that move between headers
  stopped users from scrolling the page to read the panel they had just
  opened. APG no longer lists Up/Down/Home/End. Base UI has since deprecated
  `orientation` and `loopFocus` ("This prop no longer affects keyboard focus
  behavior", `AccordionRoot.tsx`).

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/accordion/src/{accordion.machine,accordion.connect,accordion.dom}.ts`.
  Ark: `ark/packages/react/src/components/accordion/{accordion-item,accordion-item-content}.tsx`.
- API: `Root` (`value: string[]`, `defaultValue`, `onValueChange`, `multiple`,
  `collapsible` (default `false`), `disabled`, `orientation`, `onFocusChange`),
  `Item` (`value`, `disabled`), `ItemTrigger`, `ItemContent`, `ItemIndicator`.
  There is no header part: consumers wrap the trigger themselves.
- State model:
  - States `idle | focused` track the focused trigger.
  - `TRIGGER.CLICK` is guarded by `isExpanded` and `canToggle`
    (`collapsible || multiple`).
  - `GOTO.NEXT/PREV/FIRST/LAST` focus triggers found by
    `[data-controls][data-ownedby]:not([disabled])` (no looping).
  - The keydown handler is on the trigger.
- Notable:
  - **Ark builds each item as a `Collapsible.Root` with `open={item.expanded}`.**
    It strips `hidden` and `data-state` from the accordion content props and
    lets the collapsible own them. This is the reuse we want.
  - The content is `role="region"`, `aria-labelledby` → the trigger.
  - Safari focuses the trigger on click (`isSafari()` hack).
- Problems:
  - ZG#3137: redundant `aria-disabled` next to native `disabled`.
  - ARK#1656: `onValueChange` was not fired when closing with `multiple`.
  - ARK#3732: keyboard navigation skipped triggers after `unmountOnExit`.
  - ARK#3196: a non-button trigger did nothing without `tabIndex`.
  - ARK#3716: `data-state` lost (the collapsible mount skip).
  - ZG#2310: no toggle in Safari.

### Radix

- Source: `radix/packages/react/accordion/src/accordion.tsx` (578 lines).
- API: `Root` (`type: "single" | "multiple"` with value `string` or `string[]`,
  `collapsible` for single, default `false`; `disabled`, `orientation`, `dir`),
  `Item` (a `Collapsible.Root`), `Header` (always `h3`), `Trigger`, `Content`.
- State: `useControllableState` per type. Items render `Collapsible` controlled
  by `value.includes(item)`. `onOpenChange` maps to `onItemOpen` / `onItemClose`.
- Keyboard:
  - Root `onKeyDown` handles Home, End and arrows by orientation, mirroring
    Left/Right in RTL, and **always loops**.
  - Disabled triggers are skipped.
  - It returns early when `event.target` is not a trigger.
- Notable:
  - The trigger of the open item in a non-collapsible single accordion gets
    `aria-disabled` (APG), but not `data-disabled`.
  - The content is `role="region"` with `aria-labelledby`.
  - `--radix-accordion-content-height` is an alias of the collapsible var.
- Problems:
  - RX#2296: `value={undefined}` needs two clicks, because it switches from
    controlled to uncontrolled.
  - RX#2937: a numeric `0` value.
  - RX#2903: the user asked to turn off the keyboard handling (Space in a
    header input toggled).
  - RX#2891 (open): layout shift with initially open items.
  - RX#3030: close flicker.
  - RX#2738 and RX#3439: requests to use `<details>`.
  - RX#1660: `until-found`.

### React Aria (DisclosureGroup)

- Source:
  - `react-aria-components/src/Disclosure.tsx`;
  - `react-stately/src/disclosure/useDisclosureGroupState.ts`.
- API: `DisclosureGroup` (`allowsMultipleExpanded`, `expandedKeys: Set<Key>`,
  `defaultExpandedKeys`, `onExpandedChange`, `isDisabled`), with `Disclosure`
  items keyed by `id`.
- State: `toggleKey` replaces the set in single mode. An effect trims the set
  to one key when there are too many.
- Notable:
  - There is **no keyboard navigation** between headers.
  - There is no "must keep one open" mode.
  - The panel role is `group` by default (`region` is opt-in). Avoiding
    landmarks is RA's default.
  - Headers are `Heading` with a `level` prop (RA#7671: `level` does not
    change the visual size; that is styling).
- Problems:
  - The old Spectrum `useAccordion` was a selectable collection. That caused
    typeahead stealing Space from inputs in panels (RA#5745) and a
    `mousedown` preventDefault that made inputs need two clicks (RA#2801).
  - RA#1726: disabled items not announced by TalkBack/VO.
  - RA#7950: `items` missing on DisclosureGroup.

### Base UI

- Source: `base-ui/packages/react/src/accordion/{root/AccordionRoot.tsx,item/AccordionItem.tsx,trigger/AccordionTrigger.tsx,header/AccordionHeader.tsx,panel/AccordionPanel.tsx}`.
- API: `Root` (`value: any[]`, `defaultValue`, `onValueChange(value, details)`,
  `multiple`, `disabled`, `hiddenUntilFound`, `keepMounted`; deprecated
  `orientation`, `loopFocus`), `Item` (`value`, `onOpenChange`, `disabled`),
  `Header` (`h3`), `Trigger`, `Panel` (`role="region"`, `aria-labelledby`).
- State:
  - The item calls `useCollapsibleRoot({ open: isOpen, onOpenChange })` and
    provides `CollapsibleRootContext`. **Trigger and Panel reuse Collapsible's
    hooks.**
  - Single mode always collapses on a second click. There is no
    "non-collapsible" option.
- Notable:
  - Item ids are registered with `setTriggerId`, so `aria-labelledby` follows
    a consumer `id` (BU#1531).
  - Changes are cancelable through `details.cancel()`.
  - Arrow navigation was removed after the APG change.
- Problems:
  - BU#2320: a keydown handler on the root, plus `stopPropagation`, broke
    arrow keys in inputs inside panels. The fix moved it to the trigger.
  - BU#4114: native `disabled` missing on the trigger.
  - BU#3632: `render` with `nativeButton={false}` broke semantics, and a
    `<div>` inside the `h3` is invalid HTML.
  - BU#1678: `h3` as the default heading level.
  - BU#3099: the exit animation was skipped when one item closes and another
    opens in the same frame.
  - BU#1148 (open): `<details>`.

### Reka UI / Bits UI / Kobalte

- Reka (`reka-ui/packages/core/src/Accordion/*`):
  - Radix-shaped, built on `CollapsibleRoot`.
  - `useArrowNavigation` is on the item.
  - The trigger returns early when `isSingle && open && !collapsible`, but it
    sets `aria-disabled` only for disabled items.
  - Problems: RK#1504 (ArrowDown inside a panel input changed the accordion),
    RK#2521 (VO "doesn't announce expanded": tester settings), RK#2060 (iOS
    does not close).
- Bits (`bits-ui/src/lib/bits/accordion/accordion.svelte.ts`):
  - It **re-implements** the collapsible content logic (measurement,
    `until-found`, `beforematch`) instead of reusing Collapsible. That makes
    two copies of the same bugs.
  - The trigger sets `aria-disabled` only when disabled.
  - Problems: BITS#654 (`disabled` not reactive), BITS#533 (`value=undefined`
    did not collapse), BITS#1854 (no-JS content).
- Kobalte (`kobalte/packages/core/src/accordion/*`):
  - Built on its selectable list (`createSelectableList`,
    `disallowEmptySelection = !multiple && !collapsible`).
  - It hard-codes `setFocusedKey("item-1")`.
  - Problems: KB#577 (open: arrows do not move focus, Escape is swallowed),
    KB#440 and KB#236 (inputs in panels need two clicks, from the list's
    pointer handling), KB#119 (a keyboard expand closes immediately), KB#226
    (`defaultValue` ignored in SSR).

## Accessibility

Applying [accessibility.md](accessibility.md), the
[AT note](assistive-tech-and-a11y-testing.md) and [native-platform.md](native-platform.md).
Collapsible's section applies per item. Additions:

- **Headings.**
  - The `Header` part renders `h3` by default, which matches APG and every
    library. A heading with the wrong level is easy to spot; a `div` that drops
    the heading is not (BU#1678).
  - The level is a root prop, `headingLevel: 2 | 3 | 4 | 5 | 6`. Every header
    uses it, and connect picks the element `h{level}`.
  - When `render` swaps the element for a non-heading, connect adds
    `role="heading"` and `aria-level` (Liskov).
  - The trigger is the heading's only child. Anything else (badges, actions)
    goes outside it (APG). Development warns when the header has other element
    children.
- **Regions.**
  - Panels are `role="region"` with `aria-labelledby` → the trigger. This
    applies when at most one panel can be open (`multiple: false`), or when the
    accordion has at most 6 items.
  - Otherwise panels have no role. That is APG's landmark-proliferation rule,
    applied as data: items register, so the count is known.
  - `contentRole: "region" | "none"` overrides the rule.
  - **While a panel is closed, its role and `aria-labelledby` are omitted.**
    With `until-found` the panel element stays in the DOM. A labelled region
    with no content can be reported as an empty landmark, which is the
    duplicate announcement React Aria fixed with `aria-hidden` (RA PR 7218).
    HTML-ARIA forbids that fix (RA#10552). Dropping the role is valid and
    gives the same result.
- **Non-collapsible single mode.**
  - Pressing the open item's trigger does nothing.
  - That trigger is `aria-disabled="true"` and stays focusable. It is not
    native `disabled`, which would take it out of the Tab order.
  - Its `data-disabled` agrees with `aria-disabled` (accessibility.md rule 6).
  - The item's own `data-disabled` reflects only a real disabled item, so the
    theme dims real disabled items only.
- **Disabled items.**
  - Disabled items use native `disabled` on the trigger. There is no redundant
    `aria-disabled` (ZG#3137), and native `disabled` is present (BU#4114).
  - With `focusableWhenDisabled` they use `aria-disabled`, so screen-reader
    users can find them (RA#1726).
- **Keyboard.**
  - Enter and Space are per trigger (press semantics). Tab moves through the
    page order.
  - **No arrow, Home or End navigation by default**, following the 2026 APG
    (#3434: arrows that trap page scrolling are a blocking problem).
  - `keyboardNavigation` (opt-in) restores the previous optional behaviour for
    consumers who need it (Reado migrating from Ark, horizontal accordions,
    RX#2693):
    - logical `NEXT`/`PREV`/`FIRST`/`LAST` with orientation, so RTL mirrors
      horizontal arrows only (rule 17);
    - it loops (as Radix does);
    - it skips disabled triggers, but not locked ones;
    - it handles keys **only when the key event's target is a trigger**, and
      never stops propagation from content (RK#1504, BU#2320).
  - No typeahead (RA#5745).
  - No pointer handlers on the root or the content (RA#2801, KB#440).
- **Announcements.** None. `aria-expanded` changes are spoken by AT. RK#2521
  was a tester setting, which the AT note warns about.
- **Native `<details name>`: avoid**, again, for Accordion (native-platform §6):
  - `<summary>` cannot sit inside a heading, so APG's `h3 > button` is
    impossible.
  - An exclusive group cannot keep the last item open (non-collapsible mode).
  - There is no `aria-controls`, and no optional keyboard navigation.
  - The browser mutates `open`, so a controlled value cannot refuse a change.
  - It inherits every Collapsible reason as well.
- **Motion.**
  - In single mode one item closes while another opens in the same step. Both
    presences must see their own animations. This is the presence spec's
    "after the closed style is applied" (BU#3099).
  - Reduced motion: as Collapsible.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [RX#2296](https://github.com/radix-ui/primitives/issues/2296) | `value={undefined}` needs two clicks to close | Switching controlled → uncontrolled | Closed (misuse) | Mode frozen at creation with a dev warning (runtime); `[]` is "none open" |
| Bits UI | [BITS#533](https://github.com/huntabyte/bits-ui/issues/533) | `value=undefined` does not collapse all | Same | Closed | Same |
| Radix | [RX#2937](https://github.com/radix-ui/primitives/issues/2937) | Item with `value={0}` never opens | Falsy check on the value | Closed (strings only) | Item values are non-empty strings, typed; no truthiness checks |
| Zag/Ark | [ARK#1656](https://github.com/chakra-ui/ark/issues/1656) | `onValueChange` not fired when closing with `multiple` | Collapse path skipped the callback | Fixed in Zag | Every value change goes through the controllable (`onValueChange` in the same `send`) |
| Zag/Ark | [ARK#3732](https://github.com/chakra-ui/ark/issues/3732) | Keyboard navigation loses a trigger after `unmountOnExit` | Trigger lookup tied to content mount | Fixed | Navigation order comes from registered triggers, independent of hide mode |
| Reka | [RK#1504](https://github.com/unovue/reka-ui/issues/1504) | ArrowDown in an input inside a panel changes the accordion | Arrow handler on the item, not the trigger | Closed | Keys handled only when the target is a trigger |
| Base UI | [BU#2320](https://github.com/mui/base-ui/issues/2320) | Arrow/Home/End in inputs inside panels do nothing | Root keydown + `stopPropagation` | Fixed (#2321): handler on trigger | Same; no `stopPropagation` |
| Kobalte | [KB#577](https://github.com/kobaltedev/kobalte/issues/577) | Arrows don't move focus; Escape always swallowed | Selectable-list keyboard delegate | Open | No Escape handling; navigation opt-in and tested in the model |
| Kobalte | [KB#440](https://github.com/kobaltedev/kobalte/issues/440), [KB#236](https://github.com/kobaltedev/kobalte/issues/236) | Inputs in panels need two clicks / lose focus | List pointer handlers hijack focus-in | Fixed (#483) | No pointer handlers outside triggers |
| React Aria | [RA#2801](https://github.com/adobe/react-spectrum/issues/2801) | Inputs in an Accordion region not clickable on first click | `useSelectableCollection` `onMouseDown` | Closed (moved to Disclosure) | An accordion is not a selectable collection |
| React Aria | [RA#5745](https://github.com/adobe/react-spectrum/issues/5745) | Typeahead swallows spaces typed in panel inputs | Collection typeahead | Fixed (`disallowTypeAhead`) | No typeahead |
| Radix | [RX#2903](https://github.com/radix-ui/primitives/issues/2903) | Request: turn off keyboard interactions | Always-on arrow handling | Closed | Arrow navigation off by default (APG 2026) |
| W3C APG | [aria-practices#3406](https://github.com/w3c/aria-practices/issues/3406) | Arrows on headers block page scrolling | Optional arrow guidance | Fixed by #3434 (2026-04-29) | Default follows the current APG |
| Kobalte | [KB#119](https://github.com/kobaltedev/kobalte/issues/119) | Keyboard expand closes immediately | Two activations per key | Closed | One activation per press (virtual parity) |
| Zag | [ZG#3137](https://github.com/chakra-ui/zag/issues/3137) | `aria-disabled` duplicated with native `disabled` | Both emitted | Fixed | Native `disabled` only (rule 5 of HTML-AAM) |
| Base UI | [BU#4114](https://github.com/mui/base-ui/issues/4114) | Disabled trigger has no `disabled`, stays focusable | Only `aria-disabled`/`data-disabled` | Fixed (#5607) | Native `disabled` unless `focusableWhenDisabled` |
| Bits UI | [BITS#654](https://github.com/huntabyte/bits-ui/issues/654) | `disabled` change on an item ignored | Non-reactive prop read | Closed | `disabled` read live by guards and connect |
| React Aria | [RA#1726](https://github.com/adobe/react-spectrum/issues/1726) | Disabled items not announced by TalkBack/VO | Removed from AX/Tab order | Fixed | `focusableWhenDisabled` documented for accordions |
| Base UI | [BU#1531](https://github.com/mui/base-ui/issues/1531) | Panel `aria-labelledby` points at nothing | Trigger lacked the id | Fixed | IDREF invariant; consumer `id` on the trigger flows into `aria-labelledby` |
| Base UI | [BU#3632](https://github.com/mui/base-ui/issues/3632) | Custom non-button trigger breaks semantics and keyboard | `render` + `nativeButton=false` lost role/keys; `div` in `h3` | Fixed | Substituted trigger gets `role="button"`, `tabIndex` and press keys (Liskov) |
| Zag/Ark | [ARK#3196](https://github.com/chakra-ui/ark/issues/3196) | Non-button trigger not interactive | No `tabIndex` added | Closed (user adds it) | Same |
| Base UI | [BU#1678](https://github.com/mui/base-ui/issues/1678) | `h3` wrong for the page outline | Fixed default level | Closed (keep `h3`) | `headingLevel` prop, `h3` default |
| Base UI | [BU#3099](https://github.com/mui/base-ui/issues/3099) | Exit animation skipped when switching items | Exit transition registered a frame late | Fixed (#3101) | Each item's presence reads its own animations after the closed style |
| Radix | [RX#2891](https://github.com/radix-ui/primitives/issues/2891) | Layout shift with initially open items | Measurement on mount | Open | Initially open items render at `auto` (Collapsible) |
| Kobalte | [KB#226](https://github.com/kobaltedev/kobalte/issues/226) | `defaultValue` ignored during SSR | Selection state client-only | Closed | Server snapshot reflects `defaultValue`; hydration test |
| Reka | [RK#978](https://github.com/unovue/reka-ui/issues/978) | Default-open items open only on the client | Same | Fixed | Same |
| Radix | [RX#1074](https://github.com/radix-ui/primitives/issues/1074) | Close animation flickers (React 18) | Unmount after a painted frame | Closed | Presence (Collapsible) |
| Bits UI | [BITS#1854](https://github.com/huntabyte/bits-ui/issues/1854) | Content unreadable without JS | Closed content not in HTML | Closed (won't fix) | `until-found` default keeps content in server HTML |
| Reka | [RK#2521](https://github.com/unovue/reka-ui/issues/2521) | "VO doesn't announce expanded" | VO settings reset | Closed (not a bug) | Manual protocol resets AT settings |
| React Aria | [RA PR 7218](https://github.com/adobe/react-spectrum/pull/7218) → [RA#10552](https://github.com/adobe/react-spectrum/issues/10552) | Duplicate announcement of collapsed labelled panels; the fix (`aria-hidden`) is invalid HTML | Labelled `group` panel exposed while hidden | Open trade-off | Drop role and name while closed instead of `aria-hidden` |

## Known pitfalls

- **Re-implementing the collapsible.** Bits copied the content logic and
  carries every collapsible bug twice. Ark, Radix and Base UI reuse it. We
  reuse the machine, connect and the `core/dom` modules.
- **Accordion as a selectable collection** (React Spectrum v1, Kobalte) brings
  typeahead, pointer interception and selection semantics that an accordion
  does not have. The bugs are RA#2801, RA#5745, KB#440 and KB#236.
- **Keyboard handlers on the root** catch keys from panel content (BU#2320,
  RK#1504).
- **Controlled `undefined`** flips the mode (RX#2296, BITS#533).
- **Single-mode switch**: one exit and one enter animation in the same step
  (BU#3099).
- **Heading level** cannot be right by default. Make it one prop and warn on
  invalid content (BU#3632).

## Testing notes

- The accordion machine is shallow: one state, and the value is an array that
  cannot be enumerated as states. The model graph's edges are
  `ITEM.TOGGLE { item }` with guards (`isOpen`, `canCollapse`, `notDisabled`),
  `ITEM.OPEN` and `ITEM.CLOSE`. So:
  - The contract gives **argument classes** for item events: first item,
    second item, a disabled item.
  - The props configurations are `multiple` × `collapsible` (and
    `keyboardNavigation`), so the oracle covers single/multiple and the locked
    item.
  - Per-contract invariants carry the rest (below).
- Each item's collapsible is a sibling service. Its own model test already
  covers it. The accordion test checks the composition.
- The `disclosure` trait's invariants run for **each** trigger–content pair,
  found through `aria-controls`.
- Per-contract invariants:
  - In single mode at most one trigger has `aria-expanded="true"`.
  - Each trigger's `aria-expanded` equals `value.includes(item)`.
  - Non-collapsible single mode: the open trigger has `aria-disabled="true"`.
  - Every trigger is the only element child of an element with role `heading`
    and an `aria-level`.
  - Open panels have `role="region"` with a resolving `aria-labelledby` exactly
    when the region rule says so. Closed panels have no role.
  - With `keyboardNavigation` off, arrow keys on a trigger move nothing.
- Driver: `getAccordion(target, { item: "Shipping" })` locates any trigger by
  name, then scopes by `data-instance`. The root has no role or name, and
  `aria-label` on a generic `div` is prohibited.
  - Actions: `expand(label)`, `collapse(label)`, `toggle(label)` (pointer,
    keyboard); `focusNext/Prev/First/Last()` (keyboard only, with a stated
    reason for no pointer twin).
  - Queries: `expanded()` (labels), `items()`, `isDisabled(label)`,
    `contentText(label)`.

## Decisions

- **Parts.**

  | Part | Element | Notes |
  |---|---|---|
  | `Root` | `div` | Accordion machine; items register |
  | `Item` | `div` | Owns one Collapsible service controlled by the root value |
  | `Header` | `h{headingLevel}` (default `h3`) | `role="heading"` + `aria-level` when substituted |
  | `Trigger` | `button` | Collapsible trigger + lock (`aria-disabled`), optional arrow navigation |
  | `Content` | `div` | Collapsible content + region rule |
  | `Indicator` | `span` | Collapsible indicator |

- **Machine.**
  - One state, `idle`. The controllable `value: string[]` is not bound to
    states.
  - Context: registered items in DOM order (`key`, `disabled`).
  - Events:
    - `ITEM.REGISTER { item, disabled }` and `ITEM.UNREGISTER { item }`;
    - `ITEM.TOGGLE { item, modality }`;
    - `ITEM.OPEN { item, reason: "api" | "find-in-page" }` and
      `ITEM.CLOSE { item, reason: "api" }`;
    - `FOCUS.NEXT | FOCUS.PREV | FOCUS.FIRST | FOCUS.LAST { from }`.
  - Guards: `isOpen`, `canCollapse` (`multiple || collapsible`),
    `itemEnabled`, `navigationEnabled`.
  - Actions: `openItem` (in single mode it replaces the value), `closeItem`,
    `focusTrigger` (`env.focus`, through `focusSafely`).
  - Each item's Collapsible service runs in controlled mode
    (`open = value.includes(item)`). Its `onOpenChange` sends `ITEM.TOGGLE`,
    `ITEM.OPEN` or `ITEM.CLOSE` to the root. The root's guards decide; the
    collapsible sees the result through `$sync` or `$reverted`.
- **Values.**
  - `value` / `defaultValue: string[]` (default `[]`) and
    `onValueChange(value, details)`.
  - `multiple: boolean` (default `false`).
  - `collapsible: boolean` (default `true`; ignored when `multiple`).
  - In single mode, a value with more than one key warns in development, and
    the first key is kept.
- **Hide mode.** `closedContent` on Root, the same as Collapsible (default
  `until-found`), overridable per item.
- **`data-*`.**
  - Every part: `data-scope="accordion"`, `data-part`, `data-instance`,
    `data-orientation`.
  - Item, Header, Trigger, Content, Indicator: `data-state`.
  - Item: `data-disabled` for a real disabled item.
  - Trigger: `data-disabled` mirrors native or ARIA disabled, including the
    lock, plus the focus, press and hover attributes.
  - Content: `data-reveal`.
  - CSS vars: `--rind-accordion-content-height` / `-width` (the collapsible
    module with the accordion prefix).
- **Contract.** `accordion`. Actions and queries as in Testing notes. Traits:
  `disclosure` (per pair), `presence`, `directional`. Per-contract invariants
  as listed.
- **Deliberately different.**
  1. No arrow navigation by default (APG 2026); opt-in and scoped to triggers.
  2. Single mode is collapsible by default. Base UI and React Aria allow only
     this; Radix, Zag and Reka default to `false`. The open-is-stuck mode
     stays available.
  3. Role and name are dropped from closed panels instead of adding
     `aria-hidden`.
  4. The region role follows APG's ">6 simultaneously open" rule
     automatically.
  5. It reuses Collapsible's machine and connect (Ark, Radix, Base UI) and is
     not a collection (Kobalte, old Spectrum).
  6. One value shape (`string[]`) for both modes, not a type-dependent union
     (Radix).

## Open questions

- Is `collapsible: true` the right default for Reado's migration from Ark
  (default `false`)? This is a prop default, so it changes no spec structure.
  Confirm during the migration.
- Does an empty labelled region actually get announced by TalkBack/VO under
  `content-visibility: hidden` (the RA PR 7218 report), or is dropping the role
  merely harmless? Check in the manual protocol.
