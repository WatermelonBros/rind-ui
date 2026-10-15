# Menu — research

Status: done · Wave: 1 (used by Reado: `Dropdown.tsx`; Context Menu builds on it —
[context-menu.md](context-menu.md); Menubar reuses it in Wave 2)

Covers the dropdown menu: menu button, menu, items, checkbox and radio items, groups,
labels, separators, link items and submenus. Layering, dismissal, focus restore,
inert and scroll lock are [overlay-infrastructure.md](overlay-infrastructure.md);
placement is [floating-positioning.md](floating-positioning.md) (preset `dropdown`,
submenus `submenu`); items, navigation and typeahead are
[collections.md](collections.md); hover delays and the grace area are the
`hover-intent` capability of `add-tooltip` ([tooltip.md](tooltip.md),
[hover-card.md](hover-card.md)). This note only covers what is Menu-specific.

Sources: shallow clones read 2026-10-14 (paths below are repo-relative; React Aria via
`git show HEAD:`). Bug history: `gh search issues` over the ten trackers listed in
[README.md](README.md), terms `menu submenu`, `menu focus trigger`, `menu item select`,
`menu keyboard`, `menu voiceover`, `menu pointer hover`, `menu link`, `menu checkbox`,
`menu dialog`, `menu typeahead`, `menu scroll`, `menu modal`, `menu safari`,
`menu touch mobile` — about 830 hits, ~340 menu-related, ~110 read in full.

## Pattern

- WAI-ARIA APG: [Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
  and [Menu and Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).
- Roles and attributes:
  - Trigger: a button with `aria-haspopup="menu"` (or `true`), `aria-expanded`
    (`true` while open), `aria-controls` → menu (only while it exists).
  - Menu: `role="menu"`, named by `aria-labelledby` → the trigger (or `aria-label`);
    `aria-orientation="vertical"` is the default and need not be set.
  - Items: `menuitem`, `menuitemcheckbox` / `menuitemradio` with `aria-checked`;
    `aria-disabled` for disabled items; groups `role="group"` named by their label;
    `role="separator"` (not focusable); children of a menu other than items, groups
    and separators must be `none`/`presentation`.
  - Submenu trigger: a `menuitem` with `aria-haspopup="menu"`, `aria-expanded`;
    the submenu is labelled by it.
- Keyboard (APG):

  | Where | Key | Behaviour |
  |---|---|---|
  | Trigger | Enter, Space | open, focus first item |
  | Trigger | ArrowDown (optional) | open, focus first item |
  | Trigger | ArrowUp (optional) | open, focus last item |
  | Menu | ArrowDown / ArrowUp | next / previous item, optionally wrapping |
  | Menu | Home / End | first / last item |
  | Menu | a–z | typeahead to the next item starting with the typed text |
  | Menu | Enter | activate item, close menu; on a submenu trigger open it and focus its first item |
  | Menu | Space (optional) | checkbox: toggle without closing; radio: check without closing; submenu trigger: open |
  | Menu | ArrowRight (LTR) | on a submenu trigger: open, focus first item |
  | Submenu | ArrowLeft (LTR) | close submenu, focus its trigger |
  | Menu | Escape | close the menu that contains focus; focus its trigger / parent item |
  | Menu | Tab / Shift+Tab | close all menus, move focus to the next / previous element (menubar wording; the menu-button examples close the menu) |

- APG also recommends that disabled menu items stay focusable ("Focusability of
  disabled controls") so screen-reader users discover them.

## How the others built it

Full per-library notes with line references were taken during the reading; the
decision-relevant facts are below.

### Zag / Ark UI

- Source: `zag/packages/machines/menu/src/{menu.machine,menu.connect,menu.dom,menu.utils,menu.types}.ts`.
- API: one machine for dropdown and context menu (`Menu.ContextTrigger`); parts
  `trigger`, `context-trigger`, `positioner`, `content`, `item`, `trigger-item`
  (submenu trigger), `option-item` (checkbox/radio, consumer-owned `checked`),
  `item-group`, `item-group-label`, `separator`. Defaults: `closeOnSelect: true`
  (option items too), `loopFocus: false`, typeahead 350 ms, `navigate()` hook for links.
- State: `idle | closed | opening | opening:contextmenu | open | closing`; `opening` =
  200 ms submenu hover delay, `closing` = 100 ms close delay with a polygon.
- Submenus: **sibling machines linked by refs** (`PARENT.SET`/`CHILD.SET`); the child
  also writes the parent's refs and context directly (a "routing lock"). Escape in a
  submenu closes the whole tree.
- Focus: **`aria-activedescendant`** on the content (items not focusable). Ark users
  asked for real DOM focus ([ark#3718](https://github.com/chakra-ui/ark/issues/3718)).
- Trigger opens on `click` (pointerdown prevented), so assistive-technology clicks work.
  Not modal; users asked for modal ([ark#2874](https://github.com/chakra-ui/ark/issues/2874)).
- Item pointer handlers guard on `getInteractionModality() === "pointer"` (keyboard
  scroll fires pointermove on the item under the cursor, [zag#3255](https://github.com/chakra-ui/zag/issues/3255)).
  Modifier/middle clicks on link items keep the browser default and do not close.

### Radix (Reka and Bits are ports)

- Source: `radix/packages/react/{menu,dropdown-menu,context-menu}/src/*.tsx`.
- Parts: Root, Trigger, Portal, Content, Group, Label, Item, CheckboxItem
  (`checked: boolean | "indeterminate"`), RadioGroup, RadioItem, ItemIndicator,
  Separator, Arrow, Sub, SubTrigger, SubContent. `modal` default true, `loop` false,
  typeahead 1000 ms; `onSelect(event)` cancelable — `preventDefault()` keeps the menu
  open; checkbox/radio items close by default.
- Submenus: nested React contexts sharing a root context (`onClose` closes the tree).
- Trigger opens on **`pointerdown` only** — no click handler, so VO+Space and NVDA
  browse-mode activation do nothing (RX#1963, RX#2700). Reka switched to `@click`;
  Bits added `onclick` with `detail === 0`.
- Focus on open: content first, first item only if the last input was a key —
  an AT click looks like a mouse (RX#1815, open).
- Hover moves DOM focus; pointer leave focuses the content. Drag-to-select: an item
  `pointerup` dispatches `click` when the press started elsewhere.
- Grace area: pentagon from the exit point to the submenu rect, 300 ms, plus a
  movement-direction check (`clientX` deltas: Safari's `movementX` is always 0).
- Modal: `hideOthers` + body `pointer-events: none` + scroll lock + focus trap; Tab is
  prevented inside the menu (RX#1934, closed as by design).

### React Aria / React Aria Components

- Source: `react-aria/src/menu/{useMenuTrigger,useMenu,useMenuItem,useSubmenuTrigger,useSafelyMouseToSubmenu}.ts`,
  `react-stately/src/menu/*`, `react-aria-components/src/Menu.tsx`.
- API: `MenuTrigger` (`trigger: press | longPress | contextMenu`) > `Button` + `Popover`
  > `Menu` (collection, `selectionMode` per `MenuSection`, `shouldFocusWrap` default
  true), `MenuItem` (`href` → `<a>`, router-aware, `shouldCloseOnSelect`),
  `SubmenuTrigger` (`delay` 200).
- Submenu state: **one `expandedKeysStack` owned by the root** — opening a sibling
  closes the other; closing the root clears the stack.
- Trigger: press start for mouse/pen/virtual, release for touch; virtual open focuses
  the first item, pointer open the menu.
- Close rule: Space toggles checkbox/radio and keeps the menu open, Enter closes;
  pointer closes unless `selectionMode="multiple"`.
- Hover focuses an item only when focus is not visible (keyboard session wins).
  Escape in a submenu closes only that submenu.
- Safe triangle: `atan2` direction test throttled to 50 ms, 1 s rest timeout,
  `pointer-events: none` on the parent menu.
- Modal: `ariaHideOutside({ shouldUseInert: true })` + `usePreventScroll` — the cause
  of RA#9737 (Chromium drops the menu's name because its `aria-labelledby` target, the
  trigger, is inert).

### Base UI

- Source: `base-ui/packages/react/src/menu/**`, `floating-ui-react/safePolygon.ts`,
  `hooks/useClick.ts`.
- Parts include `LinkItem` (`closeOnClick` default false), CheckboxItem and RadioItem
  (default false), Item (default true), SubmenuRoot/SubmenuTrigger (`delay` 100),
  Group/GroupLabel, Backdrop. `modal` default true (never for hover-opened menus),
  `loopFocus` default true, `closeParentOnEsc` default false, typeahead 750 ms.
- Submenus: separate stores in one Floating UI tree with an event bus.
- Trigger: `mousedown` for speed, `click` fallback when no pointer press preceded
  (virtual); a 200 ms window stops the opening mousedown's mouseup from activating an
  item.
- **Disabled items stay highlightable** (BU#1733, BU#4881 complaints, won't fix).
- Modal: an invisible internal backdrop with a cutout for the trigger, scroll lock; no
  inert. VoiceOver: drops `aria-expanded` on an open submenu trigger on Apple
  platforms; TalkBack: submenu triggers toggle so TalkBack users can close a submenu.

### Headless UI

- Source: `headlessui/packages/@headlessui-react/src/components/menu/{menu,menu-machine}.ts(x)`.
- No submenus, no checkbox/radio items, no context menu. Modal default (inert + scroll
  lock). `aria-activedescendant`. Quick release (≥ 5 px drag and ≥ 200 ms hold). Tab
  closes the menu and moves focus relative to the button — the APG behaviour, and it
  sidesteps the portal tab-order problem. Pointer leave clears the highlight only when
  the pointer set it.

### Ariakit

- Source: `ariakit/packages/ariakit-react-components/src/menu/*`, `hovercard/*`.
- `modal` default false; checked `values` live in the store, shared with submenus;
  `hideOnClick` false for checkbox/radio items. A bare `click` (`detail === 0`) opens
  like a keyboard click and focuses the first item — the cheapest correct handling of
  AT activation. Submenu triggers are not rendered as native buttons because VO+Space
  clicks a `<button role=menuitem>` twice (WebKit 228318). Grace area swallows mouse
  events in the capture phase instead of changing `pointer-events`.

### Kobalte

- Source: `kobalte/packages/core/src/menu/*`. Radix structure with React Aria hooks;
  modal default; `shouldFocusWrap` true; trigger opens on `pointerdown` and on `click`
  only for touch, and items select on `pointerup` — so an AT click neither opens the
  menu nor selects an item.

### Reka UI / Bits UI

- Radix ports. Reka opens on click and exposes `graceDuration` (300). Bits rewrote the
  submenu intent (corridor + triangle, both directions, 500 ms rest fallback) and still
  gets "slow and imprecise" reports (BITS#2191).

### Reado (consumer)

- `src/components/atoms/Dropdown.tsx` wraps Ark Menu: placement prop, `onOpen` used to
  fetch rows lazily, controlled `open` for rows that close the menu themselves,
  `lazyMount`/`unmountOnExit` ("a hidden row is still a tab stop"), `value` to
  disambiguate rows sharing a label, checked rows, group headings.
- `ContextMenu.tsx` is hand-rolled (see context-menu.md); its test documents a bug
  only a real mouse found: a menu opened from a *left* click received the opening click
  and closed. Its "keepOpen" items (an item that swaps the menu's own contents) need a
  per-item "don't close".

## Accessibility

Applying [accessibility.md](accessibility.md) (rules by number) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (causes by
letter, "Menu / menubar" in §1.4):

- **AT activation (cause A).** Opening must be bound to `click` (press-interactions
  "Activation Bound To Click"); a virtual press opens like a keyboard press and focuses
  the first item (RX#1815, RX#1963, RX#2700, BITS#1760, HUI#62). Item activation is
  bound to click too (Kobalte's `pointerup`-only items fail).
- **Focus on open by modality.** Keyboard and virtual: first item (ArrowUp: last).
  Pointer and touch: the menu container (no highlight), so arrows and typeahead work at
  once. Base UI#4818 asks why pointer opens don't focus the first item: native menus
  don't, and it avoids an unwanted highlight.
- **Roving focus, not activedescendant** (accessibility §4.2): VoiceOver does not follow
  activedescendant reliably (cause B); Ark users asked for DOM focus (ark#3718).
- **Name.** Menu named by its trigger. Modal menus make the outside `inert`, and
  Chromium does not resolve `aria-labelledby` into an inert subtree (RA#9737,
  crbug 489792331) — decided below (assistive-tech open question 4).
- **Submenus and VoiceOver.** VO announces the trigger's `aria-expanded` change instead
  of the first submenu item; Base UI drops `aria-expanded` while open on Apple. This is
  the `vo-submenu-expanded` quirk the a11y-foundations registry already reserves.
- **TalkBack** cannot close a submenu except by re-activating its trigger, so submenu
  triggers toggle on activation (Base UI comment).
- **iPhone VO** closes the whole menu after the last submenu item (BU#5794, open):
  swiping past the end moves focus out, which counts as outside focus. Our submenus are
  descendant layers, so focus moving from a submenu back into the parent menu is not
  outside the parent; it closes only the submenu.
- **WebKit 228318**: VO+Space on a native `<button role="menuitem">` fires two clicks;
  the `webkit-menuitem-double-click` quirk entry in press-interactions makes it one
  `PRESS`. Items render `div` by default anyway (a menu item is not a button).
- **VO prepends "1"** to checked `menuitemcheckbox` (RX#889; APG demo too): wontfix,
  documented.
- **Disabled items** stay perceivable and, following APG, focusable by keyboard
  (`aria-disabled`); pointer hover does not highlight them (BU#1733/#4881 show that a
  pointer highlight on a disabled item reads as "clickable").
- **Live regions** are not silenced while the menu is open (RX#1820): overlay `inert`
  keeps `[aria-live]`/announcer exposed.
- **Announcements**: none. Roving focus makes the AT speak the item; no announcer use
  (collections: roving components never announce highlight changes).
- **Forced colors**: `data-highlighted` / `data-state="checked"` let the theme draw an
  outline and a real check glyph; the separator is a border.
- **Motion**: presence + `@starting-style`; nothing animates in JS.
- **RTL**: the submenu opens to the inline end; ArrowRight/ArrowLeft are the logical
  expand/collapse keys mirrored by `dir` (keyboard-interactions), not the flipped
  placement side (AK#3029: placement-based keys confused users; RA#6544 asked for the
  opposite — we keep the logical rule, which is what APG and native RTL menus do).
- **Native platform** ([native-platform.md](native-platform.md)): no native element
  does a menu. `popover`/`interestfor`/`focusgroup` avoided (§2, §3, §9).

## Bug history

`RX` Radix · `ZG` Zag · `ARK` Ark · `BU` Base UI · `RA` React Aria/Spectrum · `HUI`
Headless UI · `AK` Ariakit · `RK` Reka · `BITS` Bits UI · `KB` Kobalte. **Spec** = the
lesson is a scenario in `openspec/changes/add-menu`.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#1963](https://github.com/radix-ui/primitives/issues/1963), [#2700](https://github.com/radix-ui/primitives/issues/2700) | VO+Space (Safari/Firefox) and NVDA browse-mode Enter do not open the menu | Trigger opens on `pointerdown` only; AT sends a bare `click` | Closed (still pointerdown-only in source) | Open on press bound to click (Spec) |
| Bits UI | [#1760](https://github.com/huntabyte/bits-ui/issues/1760) | Same with VoiceOver in Safari and Firefox | Same | `onclick` with `detail === 0` | Same (Spec) |
| Radix | [#1815](https://github.com/radix-ui/primitives/issues/1815) | NVDA/Narrator: Enter opens but the first item is not focused | Keyboard-vs-pointer guess from global key listener; AT click looks like a mouse | Open | Virtual open focuses the first item (Spec) |
| Radix | [#3124](https://github.com/radix-ui/primitives/issues/3124) | WCAG 2.5.2 complaint: opens on pointerdown | Down-event activation | Open | Open on release (Spec) |
| Radix | [#2418](https://github.com/radix-ui/primitives/issues/2418), [#3977](https://github.com/radix-ui/primitives/issues/3977) | Touch: a thumb resting on the trigger while scrolling opens it; 2.1.17 made tapping close it again | Open on `pointerdown` for touch | Closed | Touch opens on click only; a scroll cancels the press (Spec) |
| React Aria | [#5350](https://github.com/adobe/react-spectrum/issues/5350) | Menu opens on press start; the release lands on an element rendered under the pointer | Down-event open | Open | Release-based open has no stray release (Spec) |
| Radix | [#610](https://github.com/radix-ui/primitives/issues/610), [#1089](https://github.com/radix-ui/primitives/issues/1089) | Menu placed over its trigger opens and closes, or selects, on the same click | Drag-to-select treats the opening release as a selection | Closed | No release-selects-item in v1; opening release never activates an item (Spec) |
| Base UI | [#1720](https://github.com/mui/base-ui/issues/1720), [#3184](https://github.com/mui/base-ui/issues/3184) | Request to open on click (`:active` style never shows); extended tap area closes the menu at once | mousedown open; outside press computed from the visible box | Closed / open | Release open; trigger subtree is inside the layer (Spec) |
| Kobalte | [#624](https://github.com/kobaltedev/kobalte/issues/624) | Draggable trigger cannot cancel by moving away | pointerdown open | Open | Release open, pointer cancellation (Spec) |
| Radix | [#1655](https://github.com/radix-ui/primitives/issues/1655) | First item rendered as `<button>`: Enter on the trigger opens and instantly "clicks" the item | keydown opens, the same key's keyup/click reaches the newly focused item | Fixed | Item activation needs a press that started on the item (Spec) |
| RA | [#9686](https://github.com/adobe/react-spectrum/issues/9686) | Enter on the first item after opening a submenu with Enter does nothing | Opening key's state leaked into the item press | Fixed | Same rule for submenus (Spec) |
| Radix | [#3640](https://github.com/radix-ui/primitives/issues/3640) | ArrowUp on the trigger does not open | Not implemented | Open | ArrowUp opens on the last item (Spec) |
| Radix | [#1933](https://github.com/radix-ui/primitives/issues/1933) | Escape in a submenu closes every menu | Root `onClose` on Escape | Closed (unchanged) | Escape closes only the innermost menu — APG + rule 19 (Spec) |
| Radix / HUI / Bits / Reka | [RX#1934](https://github.com/radix-ui/primitives/issues/1934), [HUI#1634](https://github.com/tailwindlabs/headlessui/issues/1634), [BITS#1105](https://github.com/huntabyte/bits-ui/issues/1105), [RK#2296](https://github.com/unovue/reka-ui/issues/2296) | Tab does nothing in an open menu (or cannot leave a non-modal one) | Tab prevented / focus trapped | Mixed | Tab closes the tree and moves on from the trigger (Spec) |
| Base UI | [#411](https://github.com/mui/base-ui/issues/411), [#1820](https://github.com/mui/base-ui/issues/1820) | Tab close does not restore focus; Shift+Tab in a submenu misbehaves | Portal order vs trigger order | Fixed | Tab order computed from the trigger (Spec) |
| Radix | [#1420](https://github.com/radix-ui/primitives/issues/1420), [#1751](https://github.com/radix-ui/primitives/issues/1751) | Escape closes the menu and also exits fullscreen (Firefox/Safari) | Escape not `preventDefault`ed after acting | Fixed | Menu prevents default on the Escape it acts on (Spec) |
| Radix | [#1443](https://github.com/radix-ui/primitives/issues/1443) | ArrowLeft no longer closes a submenu; pointer trapped in it | Focus scope regression | Fixed | Collapse key test per direction (Spec) |
| Zag / Ark | [ZG#3056](https://github.com/chakra-ui/zag/issues/3056), [ARK#3733](https://github.com/chakra-ui/ark/issues/3733), [ARK#1706](https://github.com/chakra-ui/ark/issues/1706) | ArrowRight does not open a submenu; arrows in a submenu move the parent | Child/parent event routing between sibling machines | Fixed | Keys go to the level that has focus; tree port routes the rest (design) |
| Radix | [#916](https://github.com/radix-ui/primitives/issues/916) | Submenus not focused when opened from the screen-reader virtual cursor | Sub content focused only for keyboard users | Fixed | Virtual open of a submenu focuses its first item (Spec) |
| Base UI | [#1197](https://github.com/mui/base-ui/issues/1197) | Submenu trigger keeps `data-highlighted` after focus moved into the submenu | Highlight not tied to focus | Fixed | Trigger shows `data-state="open"`, highlight follows focus (Spec) |
| Zag / Reka | [ZG#2955](https://github.com/chakra-ui/zag/issues/2955), [RK#2998](https://github.com/unovue/reka-ui/issues/2998) | Moving into a submenu highlights other trigger items; submenu closes when the highlight returns to its own trigger | Highlight changed in transit; trigger ref unwrapped | Fixed | In-transit pointer moves don't change the parent highlight; own trigger keeps it open (Spec) |
| Zag / Base UI / Radix | [ZG#2811](https://github.com/chakra-ui/zag/issues/2811), [ZG#2931](https://github.com/chakra-ui/zag/issues/2931), [BU#5152](https://github.com/mui/base-ui/issues/5152), [RX#3761](https://github.com/radix-ui/primitives/issues/3761) | Sliding across adjacent submenu triggers leaves two open or opens and closes the next one | Stale hover timers; Chrome drops `mouseleave` in fast sweeps | Fixed / open | One open submenu per level, enforced by the tree; leaving computed from `pointerout` too (Spec) |
| Radix / Bits | [RX#2935](https://github.com/radix-ui/primitives/issues/2935), [BITS#2191](https://github.com/huntabyte/bits-ui/issues/2191) | Pointer resting in the grace area keeps the submenu and blocks the item under it | Grace area has no rest timeout / slow detection | Closed / open | Rest timeout in the submenu grace area (Spec, extension of hover-intent) |
| Radix | [#4036](https://github.com/radix-ui/primitives/issues/4036) | A collision-flipped submenu closes before a click lands (fast flick, Playwright) | Grace direction computed for the unflipped side | Fixed | Grace area built from the placed side (Spec) |
| RA | [#9641](https://github.com/adobe/react-spectrum/issues/9641) | Pointer-friendly submenu regression: closes as soon as another item is hovered | Safe-triangle logic broken by a refactor | Fixed | Browser test with a real diagonal path (tasks) |
| Zag | [#983](https://github.com/chakra-ui/zag/issues/983) | Submenu closes on the way to it | No polygon | Fixed (polygon) | Grace area (hover-intent) |
| Zag | [#2932](https://github.com/chakra-ui/zag/issues/2932) | Parent menu closes when hovering submenus with focusable elements | Focus moving into the child counted as outside the parent | Fixed | Child layers are inside the parent (overlay); test with inputs in submenus |
| Base UI | [#5170](https://github.com/mui/base-ui/issues/5170) | Opening a submenu closes the root with reason "sibling-open" | Submenu misclassified as a sibling | Fixed | Parentage explicit through the tree port (design) |
| RA | [#9915](https://github.com/adobe/react-spectrum/issues/9915) | A submenu that mounts late never opens | Submenu registry built once | Open | Levels register on mount; tree is dynamic (Spec) |
| Radix | [#4095](https://github.com/radix-ui/primitives/issues/4095) | Items inside a nested submenu never fire `onSelect` | Event routing through nested portals | Open | Driver test: select in a third-level submenu (Spec) |
| Radix / Ark / Base UI | [RX#1836](https://github.com/radix-ui/primitives/issues/1836), [RX#3317](https://github.com/radix-ui/primitives/issues/3317), [RX#837](https://github.com/radix-ui/primitives/issues/837), [ARK#2883](https://github.com/chakra-ui/ark/issues/2883), [RK#2267](https://github.com/unovue/reka-ui/issues/2267) | Dialog opened from a menu item freezes the page, doesn't open, or its own menus close | Dialog parented to the closing menu; body pointer-events | Fixed / workarounds | Dialog skips menus as parent (dialog spec); menu scenario (Spec) |
| HUI / Bits / Radix / Base UI | [HUI#259](https://github.com/tailwindlabs/headlessui/issues/259), [BITS#1307](https://github.com/huntabyte/bits-ui/issues/1307), [RX#3106](https://github.com/radix-ui/primitives/issues/3106), [BU#5930](https://github.com/mui/base-ui/issues/5930) | Menu returns focus to its trigger after the item handler moved focus elsewhere | Unconditional restore at close | Fixed / open | Restore only when focus is still in the menu or on body (overlay) (Spec) |
| Radix | [#4195](https://github.com/radix-ui/primitives/issues/4195), [#1266](https://github.com/radix-ui/primitives/issues/1266) | A closing menu takes focus back when the pointer moves during its exit animation | Pointer handlers not gated on open | Fixed | Closing content is inert (overlay); no pointer highlight while closing (Spec) |
| Radix | [#3232](https://github.com/radix-ui/primitives/issues/3232); HUI [#2504](https://github.com/tailwindlabs/headlessui/issues/2504) | Inputs in a dialog rendered inside a menu cannot type Space/Enter | Menu key handler acted on keys from descendants | Fixed | Menu acts only on keys whose target is its own item/content (Spec) |
| Radix / Zag | [RX#2193](https://github.com/radix-ui/primitives/issues/2193), [ZG#2932](https://github.com/chakra-ui/zag/issues/2932) | Hovering items steals focus from an input inside the menu | Hover always moves DOM focus | Closed | Hover moves focus only when focus is on an item or the content (Spec) |
| Zag / Reka / Base UI | [ZG#3255](https://github.com/chakra-ui/zag/issues/3255), [RK#2100](https://github.com/unovue/reka-ui/issues/2100), [BU#4002](https://github.com/mui/base-ui/issues/4002) | Typeahead scroll under a resting cursor loses the highlight | Synthetic pointer moves | Fixed per component | Shared pointer guard (collections) (Spec) |
| Reka | [#2596](https://github.com/unovue/reka-ui/issues/2596) | `data-highlighted` stays after pointer leave | Leave not handled | Fixed | Pointer leave clears a pointer highlight (Spec) |
| RA | [#10767](https://github.com/adobe/react-spectrum/issues/10767) | Clicking outside a mouse-opened menu highlights its first item | Focus strategy re-run on close | Open | Close never moves the highlight (Spec) |
| Base UI / Reka | [BU#1733](https://github.com/mui/base-ui/issues/1733), [BU#4881](https://github.com/mui/base-ui/issues/4881) | Disabled items get `data-highlighted` on hover and look clickable | Disabled items highlightable by every input | Won't fix | Keyboard-reachable (APG), never pointer-highlighted, never activated (Spec) |
| Radix | [#2366](https://github.com/radix-ui/primitives/issues/2366) | Checkbox items close the menu after each toggle | `closeOnSelect` true for all items | `onSelect` preventDefault | Checkbox/radio items keep the menu open by default (Spec) |
| Zag | [#237](https://github.com/chakra-ui/zag/issues/237), [#1090](https://github.com/chakra-ui/zag/issues/1090) | `closeOnSelect: false` fires clicks twice; option items not activatable by keyboard | `pointerup` → `click()` plus native click; missing key path | Fixed | One activation per press for every item kind (Spec) |
| Base UI | [#1297](https://github.com/mui/base-ui/issues/1297) | Checkbox items close a `defaultOpen` menu | Default-open path ignored `closeOnClick` | Fixed | Scenario under `defaultOpen` (tasks) |
| Radix / RA / Zag | [RX#2718](https://github.com/radix-ui/primitives/issues/2718), [RA#8697](https://github.com/adobe/react-spectrum/issues/8697), [ZG#2704](https://github.com/chakra-ui/zag/issues/2704), [RA#9431](https://github.com/adobe/react-spectrum/issues/9431) | Link items: menu does not close; Enter closes without navigating; Enter opens two tabs; two synthetic clicks | Library and browser both activate the `<a>` | Fixed / open | Enter on a link is native only; exactly one navigation (Spec) |
| Base UI / RA | [BU#1746](https://github.com/mui/base-ui/issues/1746), [RA#8916](https://github.com/adobe/react-spectrum/issues/8916) | Space on a link item closes without navigating / scrolls the page | Space is not link activation | Closed / open | Space activates a link item once and never scrolls (Spec) |
| Radix | [#2366 (comment)](https://github.com/radix-ui/primitives/issues/2366) | ⌘-click on link items closes the menu, so users can't open several tabs | Every click closes | — | Modifier and middle clicks keep the browser default and the menu open (Spec) |
| Base UI | [#2126](https://github.com/mui/base-ui/issues/2126) | In-page anchor link in a menu is undone by scroll restore | Scroll lock restores position after navigation | Fixed (LinkItem) | Close before navigation default runs; scroll lock never scrolls back (overlay) (Spec) |
| Base UI | [#2281](https://github.com/mui/base-ui/issues/2281) | `render={<MyButton/>}` item: the element's `onClick` is not called for keyboard users | Keyboard activation bypassed `click` | Fixed | Keyboard activation dispatches `click` on the rendered element (Spec) |
| Radix | [#2756](https://github.com/radix-ui/primitives/issues/2756), [#1214](https://github.com/radix-ui/primitives/issues/1214) | Fast right-click selects an item; others asked for right-click to select | Undefined secondary-button policy | Closed | Secondary-button presses never activate items (Spec) |
| RA | [#1513](https://github.com/adobe/react-spectrum/issues/1513); Zag [#776](https://github.com/chakra-ui/zag/issues/776) | Selecting an item on touch also clicks the element behind | Close on pointerup, compatibility click lands underneath | Fixed | Item activation on click; menu closes after it (Spec) |
| Radix / Zag / HUI / RA | [RX#548-class: ZG#548](https://github.com/chakra-ui/zag/issues/548), [HUI#1019](https://github.com/tailwindlabs/headlessui/issues/1019), [RA#10248](https://github.com/adobe/react-spectrum/issues/10248) | With one menu open, clicking another menu's trigger only closes the first | Modal outside / dismiss order | Mixed | Accepted for modal menus (one press = one dismissal, native behaviour); non-modal menus open the other at once (Spec) |
| Ark | [#2874](https://github.com/chakra-ui/ark/issues/2874) | Non-modal menu: dismissing click activates what's under it | No modal option | Closed | Modal by default (Spec) |
| Radix | [#1241-class: #837](https://github.com/radix-ui/primitives/issues/837), [#3141](https://github.com/radix-ui/primitives/issues/3141); Kobalte [#160](https://github.com/kobaltedev/kobalte/issues/160) | Page left unclickable after menu + dialog or rapid toggling | body `pointer-events` | Fixed repeatedly | Never mutate body styles (overlay) |
| Radix / Reka / Base UI | [RX#1272](https://github.com/radix-ui/primitives/issues/1272), [RK#2270](https://github.com/unovue/reka-ui/issues/2270), [BU#2077](https://github.com/mui/base-ui/issues/2077), [BU#2078](https://github.com/mui/base-ui/issues/2078) | Opening a modal menu shows scrollbars / shifts layout | Scroll lock compensation | Fixed | Overlay scroll-lock rules apply (no new rule) |
| RA | [#9737](https://github.com/adobe/react-spectrum/issues/9737) | Modal menu has no accessible name in Chromium | `aria-labelledby` → trigger inside `inert` | Open | Trigger stays outside the inert set (decision below) (Spec) |
| Radix | [#1820](https://github.com/radix-ui/primitives/issues/1820) | Page live regions silent while a menu is open | `hideOthers` over the body | Fixed | Overlay keep-exposed set (no new rule) |
| Radix | [#3013](https://github.com/radix-ui/primitives/issues/3013) | `aria-controls` points at a missing element | Set while closed | Fixed | Only while the menu is mounted (Spec) |
| Ariakit | [#5262](https://github.com/ariakit/ariakit/issues/5262); Radix [#3699](https://github.com/radix-ui/primitives/issues/3699) | VO focuses the wrong element when a menu opens from a menubar | Focus moved before the AX tree caught up | Fixed / open | Focus after first placement (positioning); Menubar change re-tests |
| Ariakit | [#7795](https://github.com/ariakit/ariakit/issues/7795), [#7766](https://github.com/ariakit/ariakit/issues/7766) | Removing the focused item sends focus to body; changing the first item re-runs initial focus | Initial focus re-derived; no repair | Fixed | Collections repair; initial focus once per open (Spec) |
| Ariakit | [#7012](https://github.com/ariakit/ariakit/issues/7012) | Hovering an item scrolls the page | focus() without `preventScroll` | Fixed | Pointer focus never scrolls (collections) (Spec) |
| Base UI | [#5794](https://github.com/mui/base-ui/issues/5794) | iPhone VO swipe past the last submenu item closes the whole menu | Focus leaving the submenu counted as outside the tree | Open | Focus into the parent menu closes only the submenu (Spec) |
| Radix | [#3257 (window blur)](https://github.com/radix-ui/primitives/issues/3257); Base UI [#3125](https://github.com/mui/base-ui/issues/3125) | Menu stays open after the window loses focus (OS menus close) | No window blur handling | Radix closes on blur; BU open | Window blur closes the tree (Spec) |
| Radix | [#2551](https://github.com/radix-ui/primitives/issues/2551) | `Sub` `defaultOpen` ignored | Sub open state seeded later | Open | Not supported: submenus are not controllable in v1 (Non-goals) |
| Bits | [#2200](https://github.com/huntabyte/bits-ui/issues/2200); Radix [#2727](https://github.com/radix-ui/primitives/issues/2727) | Trigger that is also a tooltip trigger: menu doesn't take focus; restored focus re-opens the tooltip | Focus-scope pause bookkeeping; tooltip on focus | Open / closed | Tooltip opens on focus-visible only (tooltip spec); scenario with a tooltip on the trigger (Spec) |
| Radix | [#1488-class: #742](https://github.com/radix-ui/primitives/issues/742), [#623](https://github.com/radix-ui/primitives/issues/623) | Firefox: clicking an item leaves a text selection drag; Space on items scrolls the page | Default actions not prevented | Fixed | Press module prevents selection; Space on items prevented (Spec) |

## Known pitfalls

- **Down-event opening** (Radix, Kobalte, Base UI, React Aria) buys speed and
  drag-to-select but produces three bug classes: AT clicks ignored, touch scroll
  opening menus, and releases landing on the wrong element. Release-based opening
  (Reka, Ariakit, Zag) avoids all three.
- **Escape and Tab** are where libraries diverge from APG most; both are trivially
  testable and both were reported against Radix.
- **Submenu hover** is the most fragile area: stale timers, Chrome dropping
  `mouseleave`, flipped sides, rest inside the grace area, sibling triggers in transit.
- **Focus restore** fights consumer focus moves (dialogs, editors) whenever restore is
  unconditional.
- **Link items** double-activate when both the browser and the library click the `<a>`.
- **Key handlers on the content** must ignore events from embedded inputs/dialogs.

## Testing notes

- Model tests per menu level: props classes `{ modal: true }`, `{ modal: false }`,
  `{ loop: false }`; a fixture with a submenu where the parent level is driven into the
  open state as a setup step.
- Hover/grace: browser mode only (real pointer paths in Playwright, a diagonal path and
  a flicked path); Node machine tests use the fake hover-intent capability.
- Virtual modality: bare `click` on the trigger and on items; invariant "virtual
  activation parity" (a11y-invariants) covers both.
- VO quirk `vo-submenu-expanded` declared as a contract exception.
- Driver: `open()`, `openWith(key)`, `choose(name)`, `toggle(name)`, `openSubmenu(name)`,
  `closeSubmenu()`, `pressEscape()`, `tabOut()`, queries `isOpen()`, `items()`,
  `highlighted()`, `checked(name)`, `openPath()`.

## Decisions

- **Parts**: `root`, `trigger`, `positioner`, `content`, `arrow`, `item`,
  `link-item` (an item rendering `<a>`; same part via `render`), `checkbox-item`,
  `radio-group`, `radio-item`, `item-indicator`, `item-text`, `group`, `group-label`,
  `separator`, `submenu` (root of a nested level), `submenu-trigger`. Generic `Portal`.
- **Opening**: on press **release/click** for every modality (no down-event open, no
  drag-to-select in v1). Keyboard: Enter/Space/ArrowDown → first item, ArrowUp → last.
  Virtual → first item. Pointer/touch → content focused, nothing highlighted.
- **Navigation**: roving tabindex over a `core/collection` collection of static item
  parts; `loop` default `true` (RA, Base UI, Kobalte; APG examples wrap); typeahead
  through the shared module (1000 ms); disabled items keyboard-reachable
  (`focusableWhenDisabled` default `true`, APG), not pointer-highlighted, never
  activated; `focusableWhenDisabled={false}` skips them.
- **Hover**: mouse/pen movement highlights and focuses the item (`preventScroll`), unless
  a keyboard navigation session is active or focus is in an embedded text field; pointer
  leaving the content clears a pointer highlight and focuses the content.
- **Activation**: from `click` (press module), one per press; secondary button never
  activates; `onSelect(details)` with `details.cancel()` keeping the menu open;
  `closeOnSelect` default `true` for items and link items, `false` for checkbox and
  radio items; Space on checkbox/radio never closes. (Deliberate deviation from APG's
  "Enter closes" for checkbox/radio items: keyboard and pointer get the same result,
  which is what Base UI, Ariakit and Kobalte do and what RX#2366 asked for.)
- **Links**: `render={<a href>}`. Enter is the native link activation (no synthetic
  click); Space dispatches one `click` and is `preventDefault`ed (no scroll); a primary
  activation closes the menu; ⌘/Ctrl/Shift/middle clicks keep the browser default and
  leave the menu open.
- **Submenus**: Enter/Space/expand key (ArrowRight in LTR, ArrowLeft in RTL) open and
  focus the first item; collapse key and Escape close only that submenu and focus its
  trigger; activating an open submenu trigger closes it (TalkBack); hover opens after
  `submenuOpenDelay` (100 ms) through `hover-intent`; one open submenu per level.
- **Grace area**: `hover-intent`'s grace area from the placed side of the submenu, plus a
  menu-level extension: in-transit pointer moves do not move the parent highlight, and
  resting inside the grace area for 300 ms (Radix's duration) ends it so the item under
  the pointer takes over.
- **Escape** closes only the innermost menu (APG, rule 19); **Tab / Shift+Tab** close the
  whole tree and move focus to the element after / before the trigger.
- **Window blur** closes the tree (native menus do).
- **Modal by default**: the root menu is a modal layer (`kind: "menu"`): outside `inert`,
  scroll locked; outside press closes without reaching the page. `modal={false}`: no
  inert, no scroll lock, outside press closes and reaches the page, outside focus closes.
  Submenus are non-modal descendant layers.
- **Assistive-tech open question 4 (Chromium inert-labelling, crbug 489792331)** —
  **decided: keep the label source outside the inert set; do not copy names.** The menu's
  trigger is returned among the layer's `elements()`, so `inert-outside` keeps it (and
  its ancestors) exposed while the menu is modal, `aria-labelledby` keeps resolving in
  Chromium, and there is one source of truth for the name. Side effects are wanted: the
  trigger counts as inside for dismissal (pressing it toggles the menu, no
  outside-close-then-reopen), and Tab containment never reaches it (it is not in the
  content). Copying the trigger text into `aria-label` was rejected: it duplicates the
  name, goes stale when the trigger's text changes (Reado's triggers show the current
  value), and breaks label-in-name for icon triggers with `aria-label`. RA's alternative
  (trigger outside inert but `aria-hidden`) was rejected: a focusable `aria-hidden`
  element violates rule 10. A consumer `aria-labelledby` pointing at other outside
  content is caught by the generic "name sources reachable" invariant and a dev warning.
  Dialog and Popover can reuse the same rule if they ever label by their trigger.
- **Submenu composition (machine-runtime open question 2)** — **decided: sibling
  services, one `menu` service per level, linked by an injected `MenuTree` port** (no
  runtime `spawn`). The root adapter creates the tree; every level registers with its
  parent id and kind (`menu`, later `menubar`, `context-menu`). The tree holds the open
  path (React Aria's root-owned stack: at most one open child per level), forwards
  `PARENT.CLOSE` / `CHILD.SELECTED` events, and is a capability machines reach through
  `env`, so a level runs in Node with a fake tree. Each level's graph is the same static
  definition (graphs are separate, not a product); the tree's own rules are pure and
  unit-tested. Rejected: one machine for the whole tree (open path, per-level highlight,
  typeahead and hover timers would all become context, i.e. a hand-written nested
  machine in a flat runtime); Zag's ref-linked siblings that write each other's context
  (ZG#2811/#2931/#3056 class). Menubar becomes a tree parent of kind `menubar`.
- **Checked state**: `CheckboxItem` reuses the `toggle` machine (`pressed` exposed as
  `checked`) as a per-part sibling service; `RadioGroup` is a small `menu-radio-group`
  service with one controllable `value`. Both are driven by the item's activation.
- **`data-*`**: per part in the spec; `data-state` (`open|closed` on trigger, content,
  submenu trigger; `checked|unchecked` on checkbox/radio items and indicators),
  `data-highlighted`, `data-disabled`, `data-focus-visible`, placement attributes.
- **Contract**: actions `open`, `openWithArrowUp`, `close`, `choose`, `toggle`,
  `openSubmenu`, `closeSubmenu`, `pressEscape`, `pressOutside`, `tabOut`, `typeahead`;
  queries `isOpen`, `items`, `highlighted`, `isChecked`, `isDisabled`, `openPath`,
  `focusedItem`, plus collection and positioning fragments.
- **Deliberately different**: release-based opening; Escape per level; Tab closes;
  disabled items keyboard-only; trigger kept out of inert instead of copied names;
  composition through a typed tree port.

## Open questions

- Drag-to-select (press on trigger, release on item) as an opt-in: wait for a consumer;
  it needs the 200 ms / movement guards Base UI and Headless UI use.
- Whether macOS VO + Safari needs a hidden dismiss for modal menus on iOS (AK#7310): a
  quirk entry only if the manual pass reproduces it.
