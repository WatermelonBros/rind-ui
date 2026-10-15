# Tabs — research

Status: done · Wave: 1

Builds on [collections.md](collections.md) (static item registration, roving focus,
single tab stop, disabled items, single selection) and the cross-cutting notes
[accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md). The selection indicator designed here is
reused by [segmented-control.md](segmented-control.md).

Sources read (local clones, 2026-10-14; paths relative to each repo):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/tabs/src/{tabs.machine,tabs.connect,tabs.dom,tabs.types}.ts` |
| Radix (Reka, Bits port it) | `radix/packages/react/tabs/src/tabs.tsx`, `roving-focus/src/roving-focus-group.tsx`; `reka-ui/packages/core/src/Tabs/{TabsRoot,TabsTrigger,TabsContent,TabsIndicator}.vue`; `bits-ui/src/lib/bits/tabs/tabs.svelte.ts` |
| React Aria (Kobalte ports it) | `react-aria/src/tabs/{useTab,useTabList,useTabPanel,TabsKeyboardDelegate}.ts`, `react-stately/src/tabs/useTabListState.ts`, `react-aria/src/selection/useSelectableCollection.ts`, `react-aria-components/src/{Tabs,SelectionIndicator}.tsx` (read with `git show HEAD:`); `kobalte/packages/core/src/tabs/*` |
| Base UI | `base-ui/packages/react/src/tabs/{tab/TabsTab,list/TabsList,panel/TabsPanel,indicator/TabsIndicator,indicator/prehydrationScript.template}.tsx` |
| Headless UI | `headlessui/packages/@headlessui-react/src/components/tabs/tabs.tsx` |
| Ariakit | `ariakit-react-components/src/tab/{tab,tab-list,tab-panel}.tsx`, `ariakit-components/src/tab/tab-store.ts` |

## Pattern

- WAI-ARIA APG: [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) (examples with
  automatic and manual activation).
- Roles and attributes:
  - `tablist` containing the tabs; named with `aria-labelledby` (visible label) or
    `aria-label`; `aria-orientation="vertical"` when vertical (horizontal is the
    implicit default).
  - `tab`: `aria-selected="true"` on the active tab and `"false"` on the others;
    `aria-controls` → its `tabpanel`; `aria-disabled` when disabled; `aria-haspopup`
    only if the tab opens a menu (not in scope). Name from content.
  - `tabpanel`: `aria-labelledby` → its tab. APG: when the panel has no focusable
    content (or its first meaningful element is not focusable) it gets `tabindex="0"`.
- Keyboard (APG):

  | Key | Behaviour |
  |---|---|
  | Tab | Into the list: focus the active tab. From the list: next element in the page tab sequence (the panel, or its first focusable element) |
  | Left / Right (horizontal) | Previous / next tab, wrapping; with automatic activation the panel follows |
  | Up / Down (vertical) | "Down performs as Right, Up performs as Left" |
  | Home / End | First / last tab (optional) |
  | Space / Enter | Activate the focused tab (manual activation) |
  | Shift+F10, Delete | Popup menu / delete a tab (optional; out of scope) |

  APG recommends automatic activation "as long as their associated tab panels are
  displayed without noticeable latency".

## How the others built it

| | Zag/Ark | Radix/Reka/Bits | React Aria/Kobalte | Base UI | Headless UI | Ariakit |
|---|---|---|---|---|---|---|
| Default activation | automatic | automatic | automatic | **manual** (`activateOnFocus=false`) | automatic | automatic (`selectOnMove`) |
| Automatic selection triggered by | arrow/Home/End handlers | **`focus` event** | keyboard navigation + focus entry (`selectOnFocus`) | **`focus` event** (keyboard or touch) | key handler | `moves` counter (keyboard moves only) |
| Pointer activation | `click` | **`mousedown`** | press start (mouse), press up for links | `click` (after BU#1323) | `click` (after HUI#845) | `click` |
| Disabled tab | native `disabled`, skipped | native `disabled`, skipped | `aria-disabled`, skipped | `aria-disabled`, focusable and **in** arrow order | native `disabled` | focusable (`accessibleWhenDisabled`) |
| Wrap | `loopFocus` (default on) | `loop` (default on) | always | `loopFocus` (default on) | always | `focusLoop` |
| Vertical keys | Up/Down only | Up/Down only | Up/Down **and** Left/Right (RA#4140) | Up/Down | Up/Down | Up/Down |
| Empty selection | allowed (`value: null`, `deselectable`) | allowed | never (first enabled tab auto-selected, RA#5700) | first enabled tab auto-selected | index 0 | first tab |
| Inactive panels | mounted with `hidden` | unmounted (`forceMount` keeps them) | unmounted (`shouldForceMount` → `inert`) | unmounted (`keepMounted` → `hidden` + `inert`) | unmounted (`unmount={false}` → hidden) | mounted, `hidden` |
| Panel `tabindex` | `0` unless it has focusables | always `0` | `0` unless it has a tabbable child (`useHasTabbableChild`) | `0` when open | `0` | `0` unless tabbable content |
| `aria-controls` | selected tab only | every tab (dangling when unmounted) | selected tab only | when the panel is mounted | every tab | when the panel exists |
| Indicator | `Indicator` with `--left/--top/--width/--height` from `offsetLeft/Width`, ResizeObserver on every tab and the list, transition only when the value changed | Reka `TabsIndicator` (`--reka-tabs-indicator-size/-position`) | RAC `SelectionIndicator` (shared-element transition inside the tab) | `Indicator` with `--active-tab-{left,right,top,bottom,width,height}` and a pre-hydration script | — | — |

### Zag.js / Ark UI

- Source: `tabs.machine.ts` (states `idle`/`focused`), `tabs.connect.ts`, `tabs.dom.ts`.
- API: `value`/`defaultValue` (string or null), `orientation`, `activationMode`,
  `loopFocus`, `composite`, `deselectable`, `navigate` (anchor tabs), `translations.listLabel`.
- Notable: selection on arrows, not on focus (`TAB_FOCUS` only records
  `focusedValue`), so the virtual cursor does not select. Indicator rect is measured with
  `offsetLeft/Top/Width/Height` (transform-immune) and re-measured on `ResizeObserver`
  of every trigger and the list; `animateIndicator` is true only when the value changed,
  so resizes and first paint do not animate. Panel `tabindex` follows "has focusables".
- Problems: `tabIndex` is `0` only on the selected trigger, so no value means no tab stop
  ([ZG#2762](https://github.com/chakra-ui/zag/issues/2762)); disabled tabs use native
  `disabled`; navigation moves focus in `raf` (timing issues,
  [ZG#2387](https://github.com/chakra-ui/zag/issues/2387)); selecting an anchor tab
  clicks it with a synthetic event ([ZG#3354](https://github.com/chakra-ui/zag/issues/3354)).

### Radix (and Reka UI, Bits UI)

- Source: `tabs.tsx` on top of `RovingFocusGroup`.
- API: `Root` (`value`, `defaultValue`, `orientation`, `dir`, `activationMode`), `List`
  (`loop`), `Trigger` (`value`, `disabled`), `Content` (`value`, `forceMount`).
- Notable: tiny; `aria-controls` and ids derived from one base id.
- Problems: automatic activation runs in `onFocus`, so screen-reader focus selects
  ([RX#1047](https://github.com/radix-ui/primitives/issues/1047), open since 2021) and so
  does a right click ([RX#1113](https://github.com/radix-ui/primitives/issues/1113),
  [BITS#780](https://github.com/huntabyte/bits-ui/issues/780)); activation on `mousedown`
  ([RX#1879](https://github.com/radix-ui/primitives/issues/1879), open;
  [RX#3600](https://github.com/radix-ui/primitives/issues/3600) blur lost;
  [RK#842](https://github.com/unovue/reka-ui/issues/842)); roving focus moves in a
  `setTimeout`, so fast keys are lost ([RX#4136](https://github.com/radix-ui/primitives/issues/4136),
  [RX#2910](https://github.com/radix-ui/primitives/issues/2910)); Bits' DOM query picks
  up nested roots' triggers ([BITS#2189](https://github.com/huntabyte/bits-ui/issues/2189)).

### React Aria (and Kobalte)

- Source: `useTabList` (on `useSelectableCollection` with `selectOnFocus` and
  `disallowEmptySelection`), `useTab`, `useTabPanel`, `TabsKeyboardDelegate`,
  `useTabListState`.
- API: `Tabs` (`selectedKey`, `defaultSelectedKey`, `keyboardActivation`,
  `orientation`, `disabledKeys`, `isDisabled`), `TabList`, `Tab` (`id`, `href`), `TabPanel`
  (`shouldForceMount`).
- Notable: collection model, keys; always one tab selected (first enabled if none given,
  re-selected when the selected tab disappears); delegate walks are bounded and skip
  disabled keys; in vertical lists both arrow pairs work because screen-reader users
  cannot perceive the orientation ([RA#4140](https://github.com/adobe/react-spectrum/issues/4140));
  panel `tabIndex` from `useHasTabbableChild` (MutationObserver); link tabs select on
  press up.
- Problems: focus target is the selected key even when disabled
  ([RA#10633](https://github.com/adobe/react-spectrum/issues/10633), open); controlled
  `null` loops ([RA#9584](https://github.com/adobe/react-spectrum/issues/9584)); scroll
  into view on page load ([RA#4132](https://github.com/adobe/react-spectrum/issues/4132));
  automatic activation follows links while arrowing ([RA#8470](https://github.com/adobe/react-spectrum/issues/8470)).

### Base UI

- Source: `TabsTab.tsx`, `TabsList.tsx`, `TabsPanel.tsx`, `TabsIndicator.tsx`.
- API: `Root` (`value`, `defaultValue`, `orientation`), `List` (`activateOnFocus`,
  `loopFocus`), `Tab` (`value`, `disabled`), `Panel` (`keepMounted`), `Indicator`
  (`renderBeforeHydration`).
- Notable: the most careful indicator: six CSS variables (left/right/top/bottom/width/
  height, so RTL can anchor on `right`), layout offsets that ignore ancestor transforms
  ([BU#3425](https://github.com/mui/base-ui/issues/3425), [BU#4837](https://github.com/mui/base-ui/issues/4837)),
  no rounding up ([BU#2235](https://github.com/mui/base-ui/issues/2235)), re-measure when
  a sibling tab resizes ([BU#4156](https://github.com/mui/base-ui/issues/4156)), no
  animation on load ([BU#998](https://github.com/mui/base-ui/issues/998)), an inline
  pre-hydration script; `data-activation-direction` on the root; main-button-only focus
  activation ([BU#1317](https://github.com/mui/base-ui/issues/1317)).
- Problems: `activateOnFocus` runs in `onFocus` (screen-reader focus selects when
  enabled); disabled tabs are deliberately kept in arrow order
  ([BU#5285](https://github.com/mui/base-ui/issues/5285), [BU#1442](https://github.com/mui/base-ui/issues/1442));
  a run of initial-selection bugs ([BU#2096](https://github.com/mui/base-ui/issues/2096)–[#2101](https://github.com/mui/base-ui/issues/2101)).

### Headless UI

- Source: `tabs.tsx` (index-based registration, `manual` prop).
- Notable: automatic activation happens inside the key handler (`activateUsing`), so
  focus alone never selects; `mousedown` is prevented and selection happens on `click`.
- Problems: index pairing of tabs and panels broke on insertion and reordering
  ([HUI#1834](https://github.com/tailwindlabs/headlessui/issues/1834),
  [HUI#2131](https://github.com/tailwindlabs/headlessui/issues/2131),
  [HUI#1092](https://github.com/tailwindlabs/headlessui/issues/1092)); inactive panels
  were only visually hidden ([HUI#2688](https://github.com/tailwindlabs/headlessui/issues/2688));
  no RTL ([HUI#3020](https://github.com/tailwindlabs/headlessui/issues/3020)); Narrator
  cannot activate tabs ([HUI#3274](https://github.com/tailwindlabs/headlessui/issues/3274), open).

### Ariakit

- Source: `tab.tsx`, `tab-store.ts`.
- Notable: `selectOnMove` subscribes to the composite's `moves` counter, which only
  keyboard moves increment — the cleanest "focus alone does not commit" rule (it was
  fixed after [AK#421](https://github.com/ariakit/ariakit/issues/421), ChromeVox
  selecting on focus); its sandbox test is "do not select with focus (e.g., screen
  reader focus)". Disabled tabs focusable by default; tabs inside comboboxes.
- Problems: stale panel tabindex when one panel is reused for every tab
  ([AK#6332](https://github.com/ariakit/ariakit/issues/6332)); scrolling the active tab
  into view under the pointer broke the click ([AK#4132](https://github.com/ariakit/ariakit/issues/4132)).

## Accessibility

Applies [accessibility.md](accessibility.md) §2, §4, §5, §6, §8, §10 and the AT note's
causes A, C, J and K. Pattern-specific:

- **Focus alone does not commit** (cause C, invariant 13). Automatic activation is a
  keyboard-only consequence of a logical move (`NAVIGATE` with `modality: "keyboard"`),
  never of `focus`. The VoiceOver and ChromeVox virtual cursors fire `focus` without a
  key (RX#1047, AK#421); a right click focuses a button (RX#1113). Tabbing into the list
  lands on the selected tab, so no change either. HUI and Ariakit already work this way;
  Radix, Reka, Bits and Base UI do not.
- **Activation on release** (WCAG 2.5.2, rule 15): pointer selection is a `PRESS`
  (from `click`), not `mousedown` (RX#1879, HUI#845, BU#1323, RK#842). Selecting on press
  also lets a blur inside the old panel fire before it unmounts (RX#3600).
- **Virtual activation** (cause A): NVDA/JAWS browse mode, VO+Space and Narrator click
  the tab; the press module turns a bare `click` into `PRESS` (HUI#3274 is the failure
  mode).
- **One tab stop always** (rule 8): selected tab, else first enabled; never a disabled
  tab unless focusable (RA#10633); never no tab stop (ZG#2762).
- **Explicit `aria-selected`** on every tab (`selectable` trait).
- **Inactive panels hidden for AT**: unmounted or `hidden`, never visually hidden only
  (HUI#2688, invariant 11). `aria-controls` points only at a rendered panel (rule 2;
  Radix's dangling ids, RA#8699 debate: APG "SHOULD" set it, but a dangling IDREF is
  worse than none).
- **Panel focusability**: `tabindex="0"` only while the panel contains no tabbable
  element (APG; RK#2430, BITS#2067, BU#5126); recomputed when the panel's content
  changes (AK#6332).
- **Orientation is not perceivable** by screen-reader users (RA#4140; RX#1743): vertical
  lists accept both arrow pairs; horizontal lists accept Left/Right only, leaving Up/Down
  to the page.
- **RTL**: horizontal arrows are mirrored by the logical-key function (RX#468, HUI#3020,
  AK#7482, BU#59).
- **Modifiers**: arrows with Ctrl/Meta/Alt/Shift are not navigation (BU#1465); a keydown
  from a focusable descendant of a tab is ignored (RX#3232 in the Radix source, RX#2915:
  Space inside an input in a tab selected it).
- **Mobile**: TalkBack does not read text-only panels (RA#6153, open; the APG example
  fails the same way) — recorded for the manual protocol, not worked around.
- **Forced colors** (cause K): the selected tab needs a non-colour cue; the theme draws
  the indicator with a border/`Highlight` and adds `outline` on the selected tab under
  `forced-colors: active`. The indicator part is decorative (`aria-hidden`).
- **Target size**: each tab at least 24×24 CSS px in the theme (2.5.8).
- **Motion**: the indicator transition is theme-only and disabled under
  `prefers-reduced-motion`; layout-driven moves never animate.
- **Scrolling**: a keyboard move scrolls the focused tab into view (`nearest`, instant);
  nothing scrolls on mount (RA#4132) or on pointer activation (AK#4132).
- **Native platform** ([native-platform.md](native-platform.md)): there is no native
  tabs element; `focusgroup` is avoided (§9); `hidden="until-found"` is used for
  mounted inactive panels (§6; Safari 26.2 reveals but does not scroll to the match —
  acceptable, the match is still revealed); `beforematch` selects that tab with
  `reason: "find-in-page"` (BU#3734 asks for exactly this).

## Bug history

Method: `gh search issues` over the ten repositories (radix-ui/primitives, chakra-ui/zag,
chakra-ui/ark, mui/base-ui, adobe/react-spectrum, tailwindlabs/headlessui, ariakit/ariakit,
unovue/reka-ui, huntabyte/bits-ui, kobaltedev/kobalte) with "tabs in:title", "tab in:title",
"tablist", "tabs keyboard", "activationMode", "tabs indicator", "tabs disabled",
"tabs focus", "tabs screen reader", "tabs RTL", "tabs forceMount", "tabs SSR", "roving
focus" (Radix: 13 queries × 40; the others: "tabs/tab in:title" and "tablist" × 100).
About 330 hits, 70 relevant, 45 read in full.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#1047](https://github.com/radix-ui/primitives/issues/1047) open | VoiceOver cursor moving over a tab selects it; previous panels unreachable | Automatic activation in `onFocus` | Open since 2021 | Automatic activation only on keyboard `NAVIGATE`; scenario + invariant 13 |
| Ariakit | [#421](https://github.com/ariakit/ariakit/issues/421) closed | ChromeVox linear navigation selects every tab | Same | `selectOnMove` driven by keyboard moves | Same rule; it holds for every AT |
| Radix / Bits | [RX#1113](https://github.com/radix-ui/primitives/issues/1113), [BITS#780](https://github.com/huntabyte/bits-ui/issues/780) closed | Right click switches tabs | Focus from a secondary button runs focus activation | Mouse-button check | Only `PRESS` (primary activation) selects |
| Base UI | [#1317](https://github.com/mui/base-ui/issues/1317) closed | Non-main mouse button activates a tab | Same | `isMainButton` ref | Same |
| Radix | [#1879](https://github.com/radix-ui/primitives/issues/1879) open | Tab activates on `mousedown` (WCAG 2.5.2) | Speed over pointer cancellation | Open | Select on `PRESS` (release); press moved off cancels |
| Headless UI / Base UI / Reka | [HUI#845](https://github.com/tailwindlabs/headlessui/issues/845), [BU#1323](https://github.com/mui/base-ui/issues/1323), [RK#842](https://github.com/unovue/reka-ui/issues/842) | Same | Same | HUI, BU: `click`; Reka open | Same |
| Radix | [#3600](https://github.com/radix-ui/primitives/issues/3600) closed | `onBlur` of an input in the old panel never fires on switch | Panel unmounted on `mousedown` before the blur | Focus the trigger first | Releasing activates after focus moved, so blur runs first |
| Radix | [#4136](https://github.com/radix-ui/primitives/issues/4136), [#2910](https://github.com/radix-ui/primitives/issues/2910) | Fast ArrowRight swallowed; arrows and clicks give different results | Focus moved in `setTimeout`; next key reads stale DOM focus | Open | Highlight and selection update synchronously in the machine |
| React Aria | [#10633](https://github.com/adobe/react-spectrum/issues/10633) open | Disabled selected tab makes the tab list unreachable | Tab stop = selected key without a disabled check | PR (uncontrolled only) | Tab stop rule of collections; scenario |
| Zag | [#2762](https://github.com/chakra-ui/zag/issues/2762) closed | No `value`: no tab focusable | `tabIndex=0` only on the selected tab | Fixed client-side; "SSR still wrong" | Tab stop = first enabled when nothing is selected, including SSR |
| Zag / Base UI | [ZG#2762](https://github.com/chakra-ui/zag/issues/2762), [BU#2097](https://github.com/mui/base-ui/issues/2097), [BU#2098](https://github.com/mui/base-ui/issues/2098) closed | Auto-picked first tab is disabled / fires no change | Default selection computed without disabled check or callback | Fixed | Default = first enabled tab; report it once through `onValueChange` |
| React Aria | [#5700](https://github.com/adobe/react-spectrum/issues/5700), [#9584](https://github.com/adobe/react-spectrum/issues/9584) closed | Controlled `null` overwritten / infinite render | "A tab must be selected" enforced by writing state in an effect | Types changed | Controlled `null` is respected (no panel, first enabled tab is the stop); no state writes from effects |
| Base UI | [#2100](https://github.com/mui/base-ui/issues/2100), [#2101](https://github.com/mui/base-ui/issues/2101) closed | After a controlled change the roving stop stays on the old tab; tabbing in selects it | Highlight not synced with selection while blurred | Fixed | While the list is not focused the highlight follows the selection |
| Headless UI | [#1834](https://github.com/tailwindlabs/headlessui/issues/1834), [#2131](https://github.com/tailwindlabs/headlessui/issues/2131), [#1092](https://github.com/tailwindlabs/headlessui/issues/1092) closed | Inserted / reordered / filtered tabs open the wrong panel or none | Tabs and panels paired by index | Keep active by identity | Pair tab and panel by key; selection is a key |
| Headless UI | [#2688](https://github.com/tailwindlabs/headlessui/issues/2688) closed | Inactive panels still in the accessibility tree | Hidden visually, not with `hidden` | Fixed | Mounted inactive panels carry `hidden`/`hidden="until-found"`; invariant 11 |
| Radix | [#1703](https://github.com/radix-ui/primitives/issues/1703) closed | Lighthouse: invalid `aria-controls` | IDREF to an unmounted panel (or overwritten id) | Usage | `aria-controls` only to rendered panels |
| Reka / Bits / Base UI | [RK#2430](https://github.com/unovue/reka-ui/issues/2430), [BITS#2067](https://github.com/huntabyte/bits-ui/issues/2067), [BU#5126](https://github.com/mui/base-ui/issues/5126) | Panel is an extra Tab stop even when it has focusable content | Panel always `tabindex=0` | Reka fixed; others won't fix | `tabindex=0` only when the panel has no tabbable element |
| Ariakit | [#6332](https://github.com/ariakit/ariakit/issues/6332) closed | Reused panel keeps the previous tab's tabindex | "Has tabbable" computed once per mount | Fixed | Recompute on panel content change (mutation) |
| React Aria | [#4140](https://github.com/adobe/react-spectrum/issues/4140) closed | SR users cannot know which arrows a tab list uses | Orientation not announced | Both pairs in vertical | Vertical accepts both arrow pairs |
| Radix / HUI / Ariakit / Base UI | [RX#468](https://github.com/radix-ui/primitives/issues/468), [HUI#3020](https://github.com/tailwindlabs/headlessui/issues/3020), [AK#7482](https://github.com/ariakit/ariakit/issues/7482), [BU#59](https://github.com/mui/base-ui/issues/59) | Arrows not mirrored in RTL | Direction ignored by the key handler | Fixed | Logical keys; `directional` trait runs both directions |
| Base UI | [#1465](https://github.com/mui/base-ui/issues/1465) closed | Alt+Arrow (browser back) also moves tabs | Modifiers not checked | Fixed | Modified arrows are not navigation |
| Radix | [#2915](https://github.com/radix-ui/primitives/issues/2915) closed | Space typed in an input inside a tab selects it in manual mode | Key events from descendants handled | Fixed (#3999) | Only keys whose target is the tab itself |
| Bits | [#2189](https://github.com/huntabyte/bits-ui/issues/2189) open | End / wrap on outer tabs jumps into a nested tab list | Candidates from a subtree `querySelectorAll` | Open | Items register with their own root; machine never queries the DOM |
| React Aria | [#4132](https://github.com/adobe/react-spectrum/issues/4132) closed | Page scrolls to the tabs on load | Scroll-into-view on initial focus key | Fixed | Scroll only on keyboard navigation |
| Ariakit | [#4132](https://github.com/ariakit/ariakit/issues/4132) closed | Clicking an edge tab scrolls it away from the pointer and the click is lost | Scroll on `mousedown`-focus | Fixed | Pointer focus never scrolls |
| Ark | [#2545](https://github.com/chakra-ui/ark/issues/2545) closed | Arrowing makes the whole component jump | Presence of exiting panel kept both panels laid out | Fixed | Unmounted panels leave synchronously unless the theme animates via presence |
| Zag | [#3354](https://github.com/chakra-ui/zag/issues/3354) closed; RA [#8470](https://github.com/adobe/react-spectrum/issues/8470) | Anchor tabs navigate on programmatic change / while arrowing | Selection clicks the link | Fixed / use manual | Tabs do not navigate; links-as-tabs are a non-goal (Navigation Menu) |
| Zag | [#2387](https://github.com/chakra-ui/zag/issues/2387), [#3100](https://github.com/chakra-ui/zag/issues/3100) closed | Indicator animates inconsistently; stale after a responsive layout change | rAF timing; observer only on some elements | Fixed | Measure in the same commit; observe list and every tab |
| Base UI | [#998](https://github.com/mui/base-ui/issues/998) closed; RA [#1462](https://github.com/adobe/react-spectrum/issues/1462) | Indicator animates on load; resizes before moving | Transition active before first measurement | Fixed | `data-resizing`-style attribute: layout-driven moves never animate |
| Base UI | [#3425](https://github.com/mui/base-ui/issues/3425), [#4837](https://github.com/mui/base-ui/issues/4837), [#2235](https://github.com/mui/base-ui/issues/2235), [#4156](https://github.com/mui/base-ui/issues/4156) closed | Indicator wrong in a scaling dialog / 3D parent; overflow from rounding; stale when a sibling resizes | `getBoundingClientRect` under transforms; rounding up; observer scope | Fixed | Layout offsets relative to the list, scroll-corrected, never rounded up; observe all tabs |
| Base UI | [#3734](https://github.com/mui/base-ui/issues/3734) open | Find-in-page cannot reveal a tab's content | No `hidden="until-found"` | Open | `inactivePanels: "until-found"`; `beforematch` selects the tab |
| Radix | [#1155](https://github.com/radix-ui/primitives/issues/1155) closed, [#2359](https://github.com/radix-ui/primitives/issues/2359) | Panel state lost on switch / want hidden panels | Unmount only | `forceMount` | One `inactivePanels` option: `unmount` / `hidden` / `until-found` |
| Headless UI | [#3274](https://github.com/tailwindlabs/headlessui/issues/3274) open | Narrator cannot activate tabs, focus trapped | AT activation path not handled (HUI activates in key handlers only) | Open | Virtual activation parity (invariant 12) |
| React Aria | [#6153](https://github.com/adobe/react-spectrum/issues/6153) open | TalkBack does not read text-only panels | AT bug (APG example fails too) | Open | Manual-protocol item; no workaround |

## Known pitfalls

1. Selecting on `focus` (four libraries) — the single most reported accessibility bug.
2. `mousedown` activation (four libraries).
3. No tab stop: nothing selected, or the selected tab disabled (Zag, React Aria).
4. Index pairing of tabs and panels (Headless UI).
5. Deferred focus moves (`setTimeout`, `raf`) losing keys (Radix, Zag).
6. Panels hidden only visually, dangling `aria-controls`, panels that are always a Tab
   stop.
7. Indicator measurement: transforms, rounding, animation on first paint and on resize,
   missing observers.
8. Default selection that picks a disabled tab or fires no change (Base UI).
9. DOM queries that cross into nested instances (Bits).

## Testing notes

- jsdom has no layout: the indicator's variables are zero there; its scenarios run in
  browser mode. `hidden="until-found"` and `beforematch` need a real browser (Chromium,
  Firefox; WebKit partial).
- Model-based paths need argument classes: no default value, first tab disabled,
  selected tab disabled, all disabled, vertical, RTL, manual activation.
- The `virtual` modality covers both cause A (bare click selects) and cause C
  (programmatic focus does not select).
- Driver actions: `select(name)` (pointer: press; keyboard: arrows to it, plus Enter in
  manual mode), `focusTab(name)` (arrows only); queries `tabs()`, `selected()`,
  `focusedTab()`, `panel()` (accessible name of the visible panel), `isDisabled(name)`.

## Decisions

- **Parts**: `Root` (`div`), `List` (`div[role=tablist]`), `Tab` (`button[role=tab]`,
  via `button-like-element`), `Panel` (`div[role=tabpanel]`), `Indicator` (`div`,
  `aria-hidden`, inside `List`).
- **Collection**: static item registration (collections §3) with roving focus, single
  selection, `loop` default true, `focusableWhenDisabled` default false.
- **Value**: controllable `value: string | null`. Uncontrolled with no `defaultValue`:
  the first enabled tab once items register, reported once through `onValueChange`
  (`reason: "COLLECTION.CHANGE"`). Controlled `null` is honoured. If the selected tab
  leaves the collection (uncontrolled), the repair target becomes selected.
- **Activation**: `activationMode: "automatic" | "manual"`, default `automatic`;
  automatic = select on keyboard `NAVIGATE` only.
- **Orientation**: `horizontal` (Left/Right) default; `vertical` accepts Up/Down and
  Left/Right; Home/End always.
- **Panels**: `inactivePanels: "unmount" | "hidden" | "until-found"`, default `unmount`
  (seven of nine libraries; mounting every panel runs every panel's effects). The
  mounted modes keep panels in the DOM; `until-found` is the find-in-page mode.
- **Indicator**: a shared `selection-indicator` module (`core/dom`) — also used by
  Segmented Control — measures the selected item relative to the list with layout
  offsets, exposes `--rind-indicator-{left,right,top,bottom,width,height}`, sets
  `data-resizing` for layout-driven moves, hides while nothing is measured.
- **`data-*`**: every part `data-scope="tabs"`, `data-part`, `data-orientation`; tab
  `data-key`, `data-selected`, `data-highlighted`, `data-disabled`, `data-focus(-visible)`,
  `data-pressed`, `data-hover`; panel `data-key`, `data-selected`, `data-reveal`;
  root and list `data-activation-direction` (`next`/`previous`/`none`, Base UI).
- **Contract**: anchor `tablist` by name; actions `select`, `focusTab`; queries
  `tabs`, `selected`, `focusedTab`, `panel`, `isDisabled`; traits `composite-roving`,
  `selectable`, `directional`; no part commits on focus.
- **Deliberately different**: keyboard-only automatic activation (vs Radix/Base UI),
  release activation (vs Radix/Reka), both arrow pairs in vertical (RA), no anchor/link
  tabs, controlled `null` allowed (vs RA).

## Open questions

- Pre-hydration indicator placement (Base UI's inline script). Deferred: the indicator
  is hidden until hydration; a script needs a CSP nonce story first.
- Tabs that close, reorder by drag (RA#5366) or overflow into a menu (RA collapsing) —
  separate features once a consumer needs them.
