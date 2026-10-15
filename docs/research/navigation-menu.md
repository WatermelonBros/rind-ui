# Navigation Menu — research

Status: done · Wave: 2

Site navigation: a bar of top-level links and disclosure buttons, each button
showing a panel of links (dropdown or mega menu). Shipped by Ark (Zag), Radix,
Base UI, Reka, Bits UI and Kobalte ([components.md](../components.md)). Read with
[accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) (no
navigation-specific section in §1.4; the Menu, Popover and Tooltip rows apply) and
[native-platform.md](native-platform.md).

Sources read (scratchpad clones, 2026-10-14):

| Library | Files |
|---|---|
| Radix | `packages/react/navigation-menu/src/navigation-menu.tsx` (1,418 lines) |
| Base UI | `packages/react/src/navigation-menu/{root,list,item,trigger,content,link,viewport,positioner,popup}/*.tsx` |
| Zag / Ark | `packages/machines/navigation-menu/src/*.ts`; Ark `packages/react/src/components/navigation-menu/*` (thin wrapper) |
| Reka | `packages/core/src/NavigationMenu/*.vue` (Radix port + `disableClickTrigger`, `disableHoverTrigger`, `disablePointerLeaveClose`, `unmountOnHide`) |
| Bits UI | `packages/bits-ui/src/lib/bits/navigation-menu/navigation-menu.svelte.ts` (Radix model, `openOnHover` per item) |
| Kobalte | `packages/core/src/navigation-menu/*` (built on its `MenubarRoot`) |

## Pattern

- WAI-ARIA APG: [Disclosure Navigation Menu
  example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
  (and its variant with top-level links). **Not** the Menu/Menubar pattern: APG says
  `menu`/`menubar` roles are for application menus, and a site navigation built with
  them promises keys (arrows only, one Tab stop, typeahead) that users of a web page do
  not expect.
- Roles and attributes:
  - a `nav` landmark (implicit from `<nav>`) with an accessible name (`aria-label`, or
    `aria-labelledby` when a visible heading exists); a page with two navs needs two
    distinct names;
  - a list (`<ul>`/`<li>`) of top-level items;
  - each disclosure is a native `<button>` with `aria-expanded` and `aria-controls`
    pointing at its panel;
  - panels are plain containers (no role) of links; closed panels are hidden from
    everyone (`hidden`), never only visually;
  - the link for the current page has `aria-current="page"`.
- Keyboard (APG example):

  | Key | Action |
  |---|---|
  | Tab / Shift+Tab | Move through top-level buttons and links, and into an open panel; every top-level item is a Tab stop |
  | Enter / Space (button) | Toggle its panel; focus stays on the button |
  | Escape | If a panel is open, close it and focus its button |
  | ↓ / → (optional) | On a collapsed button: next top-level item. On an expanded button: first link of its panel. On a link: next link in the same set |
  | ↑ / ← (optional) | Previous top-level item / previous link in the set |
  | Home / End (optional) | First / last item of the current set |

## How the others built it

### Radix (and Reka, Bits UI ports)

- Parts: `Root` (`<nav aria-label="Main">` hard-coded default), `Sub`, `List`, `Item`,
  `Trigger`, `Content`, `Link`, `Indicator`, `Viewport`.
- State: one controllable `value` (`""` = closed); `delayDuration` 200,
  `skipDelayDuration` 300 (instant re-open window after closing), close timer 150 ms
  hard-coded; `activationMode: "automatic" | "manual"` (newer).
- Hover: `whenMouse` gates on `pointerType === "mouse"` (pens excluded, radix#1403).
  `wasEscapeCloseRef` / `wasClickCloseRef` stop a re-open on the next mouse move
  (radix#1529). No grace area (radix#1553, #2437 asked for one).
- Click on a trigger toggles — a hover-open followed by a click closes it
  (radix#1630, #2326, "mouseenter + instantaneous click").
- Keyboard: `FocusGroup` — arrows/Home/End move focus between triggers and links
  without roving tabindex (all stay tabbable); ↓ on an open trigger enters content.
- Viewport: contents are proxied into one `Viewport` element; size exposed as
  `--radix-navigation-menu-viewport-width/height` from `offsetWidth/Height` via
  ResizeObserver + rAF. `data-motion` (`from-start|from-end|to-start|to-end`) on
  content from item order, RTL-aware.
- Tab order: when a panel is open, the trigger renders a **focusable visually hidden
  proxy** (`tabIndex=0`, `aria-hidden`) and `<span aria-owns={contentId}>` to pull the
  viewport content after the trigger. The proxy is the axe `aria-hidden-focus`
  violation in radix#3085 (open). Content tabbables are removed from the tab order
  (`tabindex=-1` rewrite) when leaving.
- Link: `active` → `aria-current="page"`; click dispatches a custom
  `navigationMenu.linkSelect` event and a root-dismiss event unless prevented or
  `metaKey` (radix#2074 — Ctrl/Shift/middle not handled).
- Closed content is unmounted (Presence) unless `forceMount` — SEO complaints
  (radix#1273, #2143, bits#1130) and forced-mount state bugs (radix#1623, #3786, #2476).
- Problems: no Portal (radix#3159), pointer-events style toggles while animating out,
  focus-outside heuristics added late (radix#3473 — a Dialog's autofocus closed it).

### Base UI

- Parts: `Root` (`nav`, or `div` when nested), `List`, `Item`, `Trigger`, `Icon`,
  `Content`, `Link`, `Portal`, `Positioner`, `Popup`, `Viewport`, `Arrow`, `Backdrop`.
  Nested roots inside content are submenus (FloatingTree).
- State: controllable `value` (`null` = closed), reasons (`trigger-press`,
  `trigger-hover`, `outside-press`, `list-navigation`, `focus-out`, `escape-key`,
  `link-press`, `imperative-action`); `delay` 50, `closeDelay` 50;
  `actionsRef.close()`.
- Hover: floating-ui `safePolygon` with `blockPointerEvents` — which writes
  `pointer-events: none` on the list/body and repeatedly got stuck
  (base-ui#5453, #5239, #4186). "Patient click": a click within 500 ms of a hover
  open does not close (`PATIENT_CLICK_THRESHOLD`). Touch: hover ignored.
- Sizing: the most elaborate — `--popup-width/height` and
  `--positioner-width/height`, px → px → `auto` after animations, MutationObserver on
  content, resize listener; bug trail: base-ui#4619 (stale size when hovering fast),
  #3308 (Safari width 0), #3073 (item without content resets transition), #2240
  (`auto` broke scrolling of large menus), #2035 (window resize).
- `data-activation-direction` (`left|right|up|down`) on content.
- Tab order: FocusGuards before/after and an `aria-owns` span; viewport made `inert`
  when focus leaves it; reverse-tab bug base-ui#4463.
- Keyboard: `List` and `Content` are composite roots (arrow keys between items and
  between links; ↓/→ opens and moves into content). A maintainer notes this is the
  menubar keyboard model without menubar roles and asks whether it should follow the
  disclosure example instead (base-ui#5413, open). `aria-orientation` on a `ul` was
  invalid (base-ui#4349, #4305).
- Link: `closeOnClick` (default false); closes every level since base-ui#4262.
- Focus return on close skipped for hover, outside press and focus-out; bug when no
  transition (base-ui#2775).

### Zag / Ark

- One `idle` state; everything in context and actions (`value`, `previousValue`,
  `viewportSize`, `triggerRect`, timers in refs) — not walkable as a graph.
- `openDelay` 200, `closeDelay` 300; hovering while open opens with 0 delay.
- Viewport positioned by hand relative to the trigger with `data-align`
  (start/center/end) and a 10 px screen clamp; trigger proxies + `aria-owns`.
- Link `current` → `aria-current="page"` + `data-current`; `ITEM.NAVIGATE` moves
  between links with arrow keys.
- Problems: trigger missing `type="button"` (zag#3261); SSR crash reading `document`
  in Content (ark#3988).

### Kobalte

- Built on `MenubarRoot`: `role="menubar"`, triggers are `menuitem`s, content is a
  `menu`. Hover with `delayDuration` 200 / `skipDelayDuration` 300; touch ignored.
- This is the pattern APG discourages for site navigation; links inside `menu` roles
  lose link semantics for some AT, and on iOS links did not activate
  (kobalte#446). `closeOnSelect` waited for the skip delay (kobalte#490).

## Accessibility

- **Landmark and name.** Root renders `<nav>`; its name comes from a `label` message
  (default `"Main"`, as Radix) or `aria-labelledby`. Nested levels render a `div`
  (no nested landmarks). The axe `landmark-unique` rule covers two navs with one name.
- **Disclosure semantics.** Triggers are add-button button-like elements (`type=button`,
  zag#3261); `aria-expanded` mirrors the open item; `aria-controls` only while the
  content is mounted (add-collapsible rule). No `aria-haspopup` (a panel is not a
  menu; `aria-haspopup="true"` means `menu`). No `menu`/`menuitem`/`menubar` roles
  (Kobalte's approach rejected). No `aria-orientation` on the list (base-ui#4349).
- **Closed content** is `hidden` (or unmounted): never visually hidden only, never
  `aria-hidden` over focusable links (radix#3085; invariant 11 of the a11y note).
- **Tab order.** Every top-level item is a Tab stop (disclosure navigation is not a
  composite; collections' one-Tab-stop rule does not apply). Open content follows its
  trigger in the Tab order even when it renders inside a shared viewport or a portal:
  add-popover's `non-modal-tab-order` does this without sentinels — the root cause of
  radix#3085 and of the reverse-tab bugs (base-ui#4463, reka#1191, reka#1782).
- **Reading order.** With content inline in its `Item` (the APG structure), DOM order
  equals reading order for the virtual cursor. A shared `Viewport` moves the content
  after the list; Radix, Zag and Base UI patch this with `aria-owns`. We do not emit
  `aria-owns` (it re-parents nodes in the AX tree and support differs per engine;
  to verify in the manual protocol) and document the viewport's reading-order cost.
- **Focus.** Enter/Space keeps focus on the trigger (APG); ↓ on an open trigger moves
  to the first link. Escape closes the innermost open level and restores focus to its
  trigger only when focus was inside the content (radix#1774, base-ui#2775 — never
  dependent on animations). Closing by pointer leave never moves focus.
- **Hover (WCAG 1.4.13).** Hover is an enhancement: every panel opens by press and
  keyboard. Hover open needs a delay, a grace area towards the panel and in-transit
  suppression across neighbouring triggers (radix#1553, #2437) — all provided by
  add-tooltip's `hover-intent`. Pen counts as hover (radix#1403); touch never does.
  Escape-closed panels do not reopen on the next mouse move (radix#1529).
- **Screen-reader press (cause A).** Activation is bound to `click`; a bare click
  toggles like a keyboard press. Focus alone never opens a panel (invariant 13).
- **Touch.** Tap toggles; dragging inside content does not dismiss (reka#729;
  add-overlay-infrastructure "Touch Presses Dismiss On Click").
- **Current page.** Links use add-link's `linkProps` (`aria-current="page"`,
  `data-current`). A trigger whose panel holds the current link gets
  `data-current` for styling only (no `aria-current` on a button).
- **Forced colors.** Open trigger and current link must show state without colour:
  theme adds an outline/underline in `forced-colors: active`; the indicator uses
  `Highlight`.
- **Target size.** Triggers and bar links ≥ 24×24 (theme). Split items (link + chevron
  trigger) keep the chevron ≥ 24×24.
- **RTL.** Horizontal arrows mirror through logical keys; `data-motion` is logical
  (`from-start`/`from-end`), so it needs no RTL rule.
- **Motion.** Viewport size and content motion are CSS transitions on custom
  properties; zero under reduced motion (theme).
- **Native platform.** No native primitive covers it. `popover="auto"` would light-dismiss
  on any other top-layer popover and moves content to the top layer (no inline mega
  menus); `<details name>` gives exclusive disclosure but no hover, no shared
  viewport and `summary` semantics (button) without `aria-controls`. `interestfor`
  (hover/focus invokers) is Chromium-only and opens on focus, which invariant 13
  forbids. CSS anchor positioning is not used (floating-positioning decision).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#1529](https://github.com/radix-ui/primitives/issues/1529) | Escape-closed menu reopens on the next mouse move | Hover re-armed by any `pointermove` | Closed (`wasEscapeCloseRef`) | After Escape or a closing press, hover stays suppressed until the pointer leaves the trigger |
| Radix | [#1774](https://github.com/radix-ui/primitives/issues/1774) | Escape inside content loses focus without animations | Focus restore tied to presence end | Closed | Restore focus in the closing step, independent of animation |
| Radix | [#1630](https://github.com/radix-ui/primitives/issues/1630), [#2326](https://github.com/radix-ui/primitives/issues/2326) | Hover opens, the user's click closes it | Click always toggles | #2326 closed as dup; Base UI added a 500 ms "patient click" | A press shortly after a hover open keeps it open (pins it) |
| Radix | [#1553](https://github.com/radix-ui/primitives/issues/1553), [#2437](https://github.com/radix-ui/primitives/issues/2437) | Moving diagonally to the panel opens the neighbouring trigger | No grace area | Closed (feature requests) | hover-intent grace area + in-transit suppression |
| Radix | [#1403](https://github.com/radix-ui/primitives/issues/1403) | Pen tablet stops hovering after the pen is lifted | `pointerType === "mouse"` only | Closed | Treat `pen` as hover (hover-intent) |
| Radix | [#2899](https://github.com/radix-ui/primitives/issues/2899) | Hover never opens in some Chromium setups (Linux, macOS) | Unconfirmed; hover gated on pointer type | Closed without fix | Press and keyboard always work; hover is never the only path |
| Radix | [#2074](https://github.com/radix-ui/primitives/issues/2074) | ⌘-click on a link closes the menu | Dismiss on every link click | Closed (metaKey only) | Modifier and middle clicks leave the menu open (add-link) |
| Radix | [#1364](https://github.com/radix-ui/primitives/issues/1364), [#1301](https://github.com/radix-ui/primitives/issues/1301) | Menu stays open after a client-side route change | Link activation not tied to dismissal for router links | Closed | Primary link activation closes the whole tree, also through a router |
| Radix | [#3085](https://github.com/radix-ui/primitives/issues/3085) | axe `aria-hidden-focus` on an empty focusable span | Focus proxy sentinel | Open | No sentinels: non-modal-tab-order |
| Radix | [#3396](https://github.com/radix-ui/primitives/issues/3396) | Firefox: Tab into the bar skips the first link | Proxy/tab-order manipulation | Closed (not reproducible later) | Model test: Tab from before the nav lands on the first item in every engine |
| Radix | [#3473](https://github.com/radix-ui/primitives/issues/3473) | A Dialog's Close button resets the menu's value | Focus moving in from another layer counted as outside focus | Closed (focus must come *from* the menu) | Outside focus only when focus leaves from inside |
| Radix | [#2424](https://github.com/radix-ui/primitives/issues/2424) | Indicator ignores a scrolled list | `offsetLeft` without scroll correction | Open | selection-indicator measurement rules |
| Radix | [#1273](https://github.com/radix-ui/primitives/issues/1273), [#2143](https://github.com/radix-ui/primitives/issues/2143) | Closed links missing from the DOM (SEO) | Content unmounted when closed | `forceMount` added | Closed content stays mounted and `hidden` by default |
| Radix | [#1623](https://github.com/radix-ui/primitives/issues/1623), [#3786](https://github.com/radix-ui/primitives/issues/3786) | Force-mounted content has no `data-state` | State attributes only on the presence path | #3786 open | `data-state` on every part in every state |
| Radix | [#2476](https://github.com/radix-ui/primitives/issues/2476) | Force-mounted content breaks Escape for native `<dialog>`s | Mounted closed content keeps a dismissable layer | Closed | No layer, listeners or timers while closed |
| Radix | [#1806](https://github.com/radix-ui/primitives/issues/1806), [#2089](https://github.com/radix-ui/primitives/issues/2089) | Nested trigger cannot close its sub panel | `Sub` `disableToggle` default true | Closed (by design) | Every trigger toggles, at every level |
| Radix | [#3159](https://github.com/radix-ui/primitives/issues/3159) | Panel clipped by a header with `overflow: hidden` | No Portal | Open | Optional `Portal` + `Positioner`; Tab order still follows trigger |
| Radix | [#2350](https://github.com/radix-ui/primitives/issues/2350) | Suspense inside a trigger breaks hydration | Not stated in the issue (render-time item collection is the likely cause) | Closed | Item registration after commit, never during render (react-adapter Expected Parts); SSR + Suspense test |
| Base UI | [#5413](https://github.com/mui/base-ui/issues/5413) | Navigation menu uses menubar keys and moves focus into content on open | Mega-menu model, not APG disclosure nav | Open | Follow the disclosure example: Enter keeps focus on the trigger, Tab stops on every item |
| Base UI | [#5453](https://github.com/mui/base-ui/issues/5453), [#5239](https://github.com/mui/base-ui/issues/5239), [#4186](https://github.com/mui/base-ui/issues/4186) | List or body stuck with `pointer-events: none`, menu frozen | Safe-polygon writes inline styles; release paths missed | Closed / workarounds | Never write `pointer-events` on page elements (hover-intent rule) |
| Base UI | [#4619](https://github.com/mui/base-ui/issues/4619) | Panel keeps the previous panel's size when hovering fast | Sizes from an interrupted measurement | Closed | Measure the new panel from its own content on each switch, cancel stale passes |
| Base UI | [#3308](https://github.com/mui/base-ui/issues/3308) | Safari: positioner width 0 after hovering an item without content | Measured an empty/absent panel | Closed | Items without content never change the viewport's size |
| Base UI | [#3073](https://github.com/mui/base-ui/issues/3073) | Hovering an item without content resets the transition | Value change without content resizes | Closed | Same as above |
| Base UI | [#2240](https://github.com/mui/base-ui/issues/2240) | Large menu no longer scrolls once size is `auto` | Consumers capped `height` var, `auto` removed the cap | Closed | Theme caps with `max-height` on available height; viewport scrolls |
| Base UI | [#2035](https://github.com/mui/base-ui/issues/2035) | Content clipped after window resize | Fixed px size kept while open | Closed | Size is `auto` at rest (content-size) |
| Base UI | [#4463](https://github.com/mui/base-ui/issues/4463) | Shift+Tab after leaving a panel jumps to the trigger | Guards redirected backward focus | Closed | Leaving backward from the element after the trigger re-enters the panel's last item |
| Base UI | [#4262](https://github.com/mui/base-ui/issues/4262) | Link in a nested level closes only that level | Close scoped to nearest root | Closed | Link activation closes the tree |
| Base UI | [#4386](https://github.com/mui/base-ui/issues/4386) | Hover-opened chain closes when entering a third level | Hover zone excluded deeper levels | Closed | Open descendant layers keep ancestors open |
| Base UI | [#3343](https://github.com/mui/base-ui/issues/3343) | Arrow keys skip a nested trigger in content | Nested trigger not in parent composite | Closed | Arrow moves cover links and nested triggers in a panel |
| Base UI | [#4349](https://github.com/mui/base-ui/issues/4349), [#4305](https://github.com/mui/base-ui/issues/4305), [#4403](https://github.com/mui/base-ui/issues/4403) | Invalid / duplicate `aria-orientation`, Lighthouse ARIA errors | `aria-orientation` on a `list` | Closed | No `aria-orientation` anywhere; orientation is `data-orientation` |
| Base UI | [#2775](https://github.com/mui/base-ui/issues/2775) | No focus return when no transition is styled | Return focus waited on animation end | Closed | As radix#1774 |
| Base UI | [#2390](https://github.com/mui/base-ui/issues/2390) | Dialog opened from a panel closes on any click | Panel's outside-press saw the dialog as outside | Closed | Layer stack parentage: a dialog from a panel is a child layer |
| Base UI | [#3570](https://github.com/mui/base-ui/issues/3570) | Hover before hydration is lost | React does not replay hover | Open | hover-intent's "first movement starts the delay" covers a pointer already resting |
| Reka | [#729](https://github.com/unovue/reka-ui/issues/729) | Touch drag inside content closes the panel | Touch handled as pointer leave | Closed | Touch never ends hover; outside dismiss on click |
| Reka | [#1131](https://github.com/unovue/reka-ui/issues/1131) | Mobile: panel re-triggers / steals focus | Emulated mouse events after touch | Closed | hover-intent ignores emulated mouse after touch |
| Reka | [#548](https://github.com/unovue/reka-ui/issues/548) | An `<input>` in content is unusable | Content keydown handler prevents default | Closed | Content key handling acts only on its own Link/Trigger parts and Escape |
| Reka | [#1191](https://github.com/unovue/reka-ui/issues/1191), [#1782](https://github.com/unovue/reka-ui/issues/1782) | Tab skips items with a Sub / inside a Dialog | Tabindex rewriting + focus trap interplay | Closed / open | No tabindex rewriting; Tab order computed by non-modal-tab-order |
| Reka | [#2383](https://github.com/unovue/reka-ui/issues/2383), [#1196](https://github.com/unovue/reka-ui/issues/1196) | Click on a link leaves submenus open (client router) | Router link bypassed dismiss | Closed | Link activation closes the tree (add-link activation hook) |
| Reka | [#2608](https://github.com/unovue/reka-ui/issues/2608) | Kept-mounted dropdowns close on any click inside | Hidden contents' layers treat clicks as outside | Closed | Only the open content registers a layer |
| Reka | [#2664](https://github.com/unovue/reka-ui/issues/2664) | Switching triggers while open is delayed | Open delay re-applied while open | Closed | Switch is immediate while a panel is open |
| Reka | [#2168](https://github.com/unovue/reka-ui/issues/2168) | Click-only mode fails in Firefox | `click` is a `MouseEvent` without `pointerType` | Closed | Never branch on `click.pointerType`; use press modality |
| Reka | [#3015](https://github.com/unovue/reka-ui/issues/3015) | Viewport misplaced under a scaled ancestor, clamped to the document | Hand-written positioning math | Open | Positioner uses floating-positioning |
| Bits UI | [#1638](https://github.com/huntabyte/bits-ui/issues/1638) | Firefox: moving between bar items fails to open | Enter/leave ordering between triggers | Open | Hover handled by hover-intent movement rule; browser test in Firefox |
| Bits UI | [#2034](https://github.com/huntabyte/bits-ui/issues/2034) | Force-mounted item closes on inside click | Same as reka#2608 | Open | As above |
| Bits UI | [#1373](https://github.com/huntabyte/bits-ui/issues/1373) | Arrow keys skip a top-level link | Focus group only had triggers | Closed | Top-level links join arrow navigation |
| Kobalte | [#446](https://github.com/kobaltedev/kobalte/issues/446) | Links in the panel do nothing on iOS | Menubar/menu item press model on links | Closed | Panel links are native anchors, no menu roles |
| Kobalte | [#490](https://github.com/kobaltedev/kobalte/issues/490) | `closeOnSelect` waits for the skip delay | Close went through the delayed path | Open | Link activation closes immediately |
| Zag | [#3261](https://github.com/chakra-ui/zag/issues/3261) | Trigger submits forms | No `type="button"` | Closed | button-like-element |
| Ark | [#3988](https://github.com/chakra-ui/ark/issues/3988) | SSR crash in Content | `document` read during render | Closed | No DOM during render; SSR test |

## Known pitfalls

- **Inline styles on page elements** for pointer blocking (Base UI) and hard-coded
  `pointer-events` on closing content (Radix) get stuck; neither is needed with a grace
  polygon and `inert`-while-exiting from presence.
- **Sentinels and tabindex rewriting** for the trigger → content Tab order cause axe
  failures and skipped items in four libraries. One shared capability fixes it.
- **Measurement races** when switching panels quickly (Base UI's long trail).
  Measure the incoming panel from its own natural size; never derive from an absent
  panel; `auto` at rest.
- **Forced/kept-mounted content** that still behaves as a layer (Escape, outside
  press) — closed content must cost nothing.
- **Pattern confusion**: libraries mix disclosure semantics with menubar keys
  (Base UI) or ship menubar roles (Kobalte). Pick the disclosure example and say so.
- **Router links** need the close-on-activation hook to work with framework links.
- Hover ignored for pens, inconsistent across Firefox enter/leave ordering.

## Testing notes

- Hover timing uses fake timers through the injected scheduler; grace geometry in
  browser mode (three engines; Firefox for bits#1638).
- Tab order through a viewport/portal: browser mode, compare inline vs viewport vs
  portal orders (non-modal-tab-order "Independent Of DOM Position").
- Size transitions between panels of different sizes, fast switching (base-ui#4619),
  items without content (base-ui#3308), window resize.
- Driver: `open(item)`, `close()`, `toggle(item)`, `hover(item)`,
  `focusTrigger(item)`, `followLink(name)`, queries `openItem()`, `isOpen(item)`,
  `links(item?)`, `currentLink()`, `contentText(item)`. Locate by `navigation` role +
  name.
- Invariants: `aria-expanded` ⇔ open item; at most one open item per level; closed
  content hidden; no `aria-hidden` focusables; no `aria-orientation`; every top-level
  item tabbable.

## Decisions

- **Pattern**: APG Disclosure Navigation. No `menu*` roles, no roving tabindex, no
  `aria-haspopup`, no `aria-owns`.
- **Parts**: `Root` (`nav`), `List` (`ul`), `Item` (`li`), `Trigger` (button),
  `Content`, `Link`, `Indicator` (optional), `Viewport` (optional), `Positioner`
  (optional, anchors the viewport or content), `Portal` (generic, optional), `Sub`
  (nested level inside a Content, `div`). Top-level links are `Link`s in an `Item`
  without content; "link + chevron" split items are a `Link` and a `Trigger` in one
  `Item` (APG top-level-links variant, base-ui#4186, reka#3001).
- **Machine** (one per level): `closed | warm | opening | open | closing`; context
  `value`, `pending`, `openedBy` (`hover | press | keyboard | api`), `suppressHover`,
  `motion`. Events `HOVER.START/END {item}`, `PRESS {item, modality}`,
  `KEY.OPEN_INTO {item}`, `ESCAPE`, `DISMISS {reason}`, `LINK.ACTIVATE`, `OPEN/CLOSE`
  (api), `CHILD.CLOSE_TREE`. Delays: `openDelay` 200, `closeDelay` 300,
  `skipDelay` 300 (warm window), `patientClick` 500. While open, hovering another
  trigger switches immediately (reka#2664).
- **Hover** = add-tooltip `hover-intent` (delays in the machine as `after`
  transitions). Panels opened by press or keyboard ignore pointer leave. Not
  `delay-group`: its "one open member per document" would make a tooltip close the
  navigation panel; the warm window is per level.
- **Viewport size** = add-collapsible `content-size`, with one additive entry point
  for switching between two open panels (request below).
- **Indicator** = add-tabs `selection-indicator`, with the open trigger as the
  "selected" item.
- **Tab order** = add-popover `non-modal-tab-order` for content (inline, viewport or
  portal).
- **Layer**: open content registers a non-modal layer (kind `popover`) with Escape,
  outside press and outside focus; only while open.
- **Links** = add-link `link-navigation` (`linkProps`): `aria-current`, router,
  modifier clicks untouched; primary activation closes the tree immediately.
- **Closed content**: `closedContent: "hidden"` (default, links stay in the DOM) or
  `"unmount"`.
- **`data-*`**: `data-state` (open/closed) on item, trigger, content, viewport;
  `data-orientation` on root/list/content/viewport/indicator; `data-motion` on
  content; `data-current` on trigger and link; `data-instant` on viewport when a
  switch skipped the open delay; standard focus/hover/pressed/disabled.
- **Contract**: locate `navigation` by name; actions `open`, `close`, `toggle`,
  `hover`, `followLink`, `pressEscape`; queries `openItem`, `isOpen`, `links`,
  `currentLink`, `isHoverOpen`; traits `layer`, `presence`, `timed`, `anchored`
  (when a Positioner is used).
- **Deliberately different**: disclosure keys (Base UI uses menubar keys), no
  sentinels/aria-owns (Radix, Zag, Base UI), no inline `pointer-events` writes
  (Base UI, Radix), mounted-and-hidden closed content by default (all others
  unmount), arrow keys never touch non-part elements (reka#548), a graph machine
  (Zag is one state).

## Open questions

- `aria-owns` for viewport content: measure in the manual protocol whether VO and
  NVDA read viewport content after its trigger without it; add it as a quirk entry
  only if a tier-1 AT needs it.
- Should `hidden="until-found"` be offered so find-in-page opens a panel? Safari's
  partial support (accessibility.md open question) — deferred.
