# Link — research

Status: done · Wave: 2

Link is a two-library component (React Aria Components, Kobalte), but every library
renders links somewhere: menu link items, toolbar links, navigation-menu links, tabs as
links, breadcrumb items, pagination pages, hover-card triggers, buttons rendered as `<a>`.
Most of the bugs below come from those places. What this note decides is therefore two
things: the small public **Link** component, and the **link-navigation** rules every
link-rendering part in rind-ui shares (native anchor first, disabled links, `aria-current`,
modifier clicks, client-side routing).

Sources read (scratchpad clones, HEAD of 2026-10-14):

| Library | Files |
|---|---|
| React Aria | `packages/react-aria/src/link/useLink.ts`, `utils/openLink.tsx` (`RouterProvider`, `shouldClientNavigate`, `openLink`, synthetic links, `useLinkProps`, `handleLinkClick`), `react-aria-components/src/Link.tsx`, docs `packages/dev/docs/pages/react-spectrum/routing.mdx` |
| Kobalte | `packages/core/src/link/link-root.tsx`, `link.test.tsx` |
| Base UI | `toolbar/link/ToolbarLink.tsx`, `navigation-menu/link/NavigationMenuLink.tsx` (links inside composites) |
| rind-ui specs | add-button `button-like-element`, add-a11y-foundations `press-interactions`, add-menu "Link Items", add-toolbar "Buttons And Links", add-tabs Non-goals |

## Pattern

- WAI-ARIA APG pattern: [Link](https://www.w3.org/WAI/ARIA/apg/patterns/link/). The APG
  examples all say the same thing: **use `<a href>`**; `role="link"` on another element is a
  fallback that must re-implement Enter activation, focusability and (impossible) the
  browser's context menu, middle click and "open in new tab".
- Roles and attributes: implicit `link` on `<a href>`; `role="link"` + `tabindex="0"` only on a
  non-anchor; `aria-current` (`page | step | location | date | time | true`) when the link is
  the current item in a set (breadcrumb, pagination, site navigation). A disabled link is
  `<a>` without `href` + `role="link"` + `aria-disabled="true"` (Scott O'Hara, "Disabling a
  link", cited in [KB#213](https://github.com/kobaltedev/kobalte/issues/213)).
- Keyboard: **Enter** activates. **Space does not** (it scrolls the page) — press-interactions
  already encodes "link-like parts activate on Enter only". Inside composites (menu, toolbar)
  Space is added by those components, not here.

## How the others built it

### React Aria (useLink + RAC Link)

- Source: `link/useLink.ts`, `utils/openLink.tsx`, RAC `Link.tsx`.
- API: `<Link href target rel download ping referrerPolicy routerOptions isDisabled
  aria-current onPress…>`. RAC renders `<a>` when `href && !isDisabled`, else `<span>`; a
  non-`a` element gets `role="link"` and `tabIndex=0` (none when disabled). Render props:
  `isCurrent` (from `aria-current`), `isHovered`, `isPressed`, `isFocused`, `isFocusVisible`,
  `isDisabled`, as `data-current`, `data-hovered`, `data-pressed`, `data-focused`,
  `data-focus-visible`, `data-disabled`.
- State: none beyond press/hover/focus (usePress, useHover, useFocusRing).
- **Router**: `RouterProvider navigate useHref` puts `{ isNative: false, open, useHref }` in
  context. `handleLinkClick` on every click: if a router is provided, the target is an
  `<a>` with `href`, the event was not already `defaultPrevented` (a router `Link` rendered via
  props may have handled it), and `shouldClientNavigate` holds (no `target` other than
  `_self` — read through `getAttribute` because Firefox reports `_parent` inside iframes —,
  same origin, no `download`, no Meta/Ctrl/Alt/Shift), it calls `preventDefault()` and
  `navigate(href, routerOptions)`. `useHref` maps a router href to the DOM `href`
  (basename). `RouterConfig` module augmentation types `href` and `routerOptions` globally.
- **Synthetic links**: rows, menu items, tags with `href` that cannot be `<a>` carry
  `data-href`/`data-target`/…; `openLink` creates a temporary `<a>`, and dispatches a click
  with the modifiers — **on macOS WebKit a `keydown` Enter instead**, because WebKit ignores
  modifiers on synthetic clicks.
- Notable: the eligibility test (`shouldClientNavigate`) is exactly right and worth copying;
  "do not interfere if already `defaultPrevented`" makes `render`-ing a router's own Link
  work. Since v1.15 the RA team **recommends `render={<RouterLink/>}` over `RouterProvider`**
  ([RA#6397](https://github.com/adobe/react-spectrum/issues/6397) last comment).
- Problems: `useHref` as a React hook passed through context — conditional-hook crash when
  `href` toggles ([RA#7028](https://github.com/adobe/react-spectrum/issues/7028)), React
  Compiler lint error ([RA#7220](https://github.com/adobe/react-spectrum/issues/7220), open),
  called for items without `href` ([RA#9490](https://github.com/adobe/react-spectrum/issues/9490)),
  applied to external URLs ([RA#6397](https://github.com/adobe/react-spectrum/issues/6397),
  [RA#6803](https://github.com/adobe/react-spectrum/issues/6803)), not applied to synthetic
  links ([RA#6347](https://github.com/adobe/react-spectrum/issues/6347)), rendered `href`
  differs from the navigated one under a basename
  ([RA#5335](https://github.com/adobe/react-spectrum/issues/5335)). Keyboard Enter handled by
  usePress without the native `click` reaching third-party routers
  ([RA#9868](https://github.com/adobe/react-spectrum/issues/9868), open). Pressed state stuck
  after Enter opens a `_blank` tab ([RA#6094](https://github.com/adobe/react-spectrum/issues/6094),
  open; dup [RA#8364](https://github.com/adobe/react-spectrum/issues/8364)).

### Kobalte (Link.Root)

- Source: `link/link-root.tsx`.
- API: `<Link.Root href disabled as>`; polymorphic, default `a`.
- Behaviour: reads the rendered tag (`createTagName`); `role="link"` when the tag is not `a`
  **or** when disabled; `tabIndex=0` only for a non-`a` enabled element; disabled removes
  `href` and sets `aria-disabled` + `data-disabled`. No press handling, no router, no
  `aria-current` handling (Breadcrumbs adds it).
- Notable: the smallest correct disabled-link implementation (KB#213 replaced a
  `preventDefault` click handler with "remove `href`").
- Problems: a non-anchor `as` element gets `role="link"` and `tabIndex` but **no Enter
  handler** — the same gap reported for Button
  ([KB#712](https://github.com/kobaltedev/kobalte/issues/712), open).

### Links inside other components (Base UI, Ariakit, Radix, Headless UI)

- Base UI `ToolbarLink`: plain `<a>` as a composite item, "links cannot be disabled"
  (metadata `disabled: false`). `NavigationMenuLink` closes the menu on click (Navigation Menu
  note).
- Ariakit: `Focusable` blocks a disabled element's `click`/`mousedown`/`keypress` but a
  **middle click fires `auxclick`**, so a disabled element rendered as a link still opened
  its destination ([AK#7153](https://github.com/ariakit/ariakit/issues/7153), fixed). Removing
  `href` is what makes it impossible.
- Radix/Headless UI: no link component. Search titles show the recurring problem is menus and
  navigation menus that stay open after a client-router `Link` navigates (RX#1105, RX#1301,
  HUI#818, HUI#449 — titles only, not read; the menu and navigation-menu notes own them).
- Base UI `Tabs.Tab` rendering a react-router `Link` looped forever through a ref-merge
  cleanup ([BU#5432](https://github.com/mui/base-ui/issues/5432), fixed): `render` with a
  router link is the common case and must be tested.

## Accessibility

- **Native first** ([accessibility.md](accessibility.md) §1.4): `<a href>` gives role, Enter
  activation, focusability, context menu ("open in new tab", "copy link"), middle click,
  status-bar URL, prefetch and drag. Nothing we add may remove one of them. A table row or
  other element that cannot be an anchor loses the context menu for good
  ([RA#9863](https://github.com/adobe/react-spectrum/issues/9863), open) — so a non-anchor link
  is a documented fallback, never a default.
- **Name**: from content; icon-only links need `aria-label` (generic name invariant).
  2.5.3 Label in Name: no `aria-label` replacing visible text.
- **`aria-current`**: only for a link that is the current item **of a set** (navigation,
  breadcrumb, pagination); not for selection contexts (tabs, rows use `aria-selected`) —
  RA's position in [RA#5664](https://github.com/adobe/react-spectrum/issues/5664), which we
  adopt. We do not compute "current" from the router automatically (RA#5664 asked for
  NavLink-style automation; rejected because "current" is app knowledge, and a router's own
  NavLink can be used through `render`).
- **Disabled**: no `href` → not focusable and not activatable by any input, including middle
  click and the context menu. `role="link"` keeps it announced as a link; `aria-disabled`
  says why it does nothing. **TalkBack quirk**: Android Chrome + TalkBack skips a
  `role="link"` element that is not focusable in swipe navigation, so the user never hears it
  ([RA#3998](https://github.com/adobe/react-spectrum/issues/3998), open; Google issue
  267670776). `tabindex="-1"` fixes it without adding a Tab stop → disabled links get
  `tabindex="-1"` (still out of the Tab order, as button-like-element requires), recorded as a
  quirk entry.
- **Focus visible**: `data-focus-visible` from the modality tracker; a pointer click on a link
  shows no ring (RA#6982 was a consumer `:focus` style). Note Chrome's URL hint persisting
  after click while a link stays mounted was a Chromium bug fixed in 147
  ([RA#9631](https://github.com/adobe/react-spectrum/issues/9631)) — we never add `tabIndex`
  to a native anchor, which is what triggered it.
- **Interactive content inside a link** is invalid HTML and breaks activation
  ([RA#2234](https://github.com/adobe/react-spectrum/issues/2234),
  [RA#7767](https://github.com/adobe/react-spectrum/issues/7767)): development warning, as
  button-like-element already does for buttons.
- **Forced colors**: native links get `LinkText`; a disabled link should use `GrayText`
  (theme). Target size 2.5.8: inline links in text are exempt (the "inline" exception);
  standalone links (nav, pagination) meet 24×24 in the theme.
- Native platform ([native-platform.md](native-platform.md)): no newer primitive replaces
  `<a>`. The Navigation API (`navigation.navigate`, `navigate` event) could intercept same-
  origin anchors without any click handler, but routers do not build on it uniformly and its
  cross-engine support was not verified for this note; the injected `Router` keeps the door
  open (an implementation can call `navigation.navigate`).

## Bug history

28 issues read in full out of ~210 search hits (react-spectrum: breadcrumbs, RouterProvider,
useLink, Link + router / middle click / disabled / aria-current / `_blank`; kobalte: link,
breadcrumbs; base-ui, ariakit, headlessui, radix, reka, bits, zag, ark: link / breadcrumb /
aria-current). Breadcrumb-specific bugs are in [breadcrumbs.md](breadcrumbs.md).

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| RA | [#9868](https://github.com/adobe/react-spectrum/issues/9868) open | Enter on a Link does not fire `onClick`, third-party router misses it, full reload | usePress handled the key instead of letting the native anchor click happen | Workaround: no-op RouterProvider | Enter on an anchor is the browser's: never `preventDefault` the keydown; activation comes from the native `click` (scenario) |
| RA | [#6094](https://github.com/adobe/react-spectrum/issues/6094) open, [#8364](https://github.com/adobe/react-spectrum/issues/8364) | `data-pressed` stuck after Enter opens a `_blank` tab | keyup goes to the new tab | Open | Press ends on blur and on `visibilitychange` (scenario) |
| RA | [#8827](https://github.com/adobe/react-spectrum/issues/8827) closed | `onClick` runs on a disabled Link | Consumer handler not gated | Fixed | Disabled: no `href`, and consumer activation callbacks are not called (scenario) |
| Ariakit | [#7153](https://github.com/ariakit/ariakit/issues/7153) closed | Disabled element rendered as link opens on middle click | `auxclick` not blocked; `href` kept | Fixed (#7154) | Removing `href` is the only complete disable (scenario) |
| Kobalte | [#213](https://github.com/kobaltedev/kobalte/issues/213) closed | Disabled link still focusable / clickable | `preventDefault` instead of removing `href` | `role=link`, no `href`, `aria-disabled` | Same rule (button-like-element) |
| Kobalte | [#712](https://github.com/kobaltedev/kobalte/issues/712) open | Non-native element gets role + tabindex but no keyboard activation | No key handler for substituted elements | Open | Non-anchor link: Enter activates through press interactions (scenario) |
| RA | [#3998](https://github.com/adobe/react-spectrum/issues/3998) open | TalkBack swipe skips the current/disabled link | Non-focusable `role=link` skipped (Android bug) | Workaround `tabindex=-1` | Disabled link gets `tabindex="-1"`; quirk entry (scenario) |
| RA | [#6397](https://github.com/adobe/react-spectrum/issues/6397), [#6803](https://github.com/adobe/react-spectrum/issues/6803) closed | `https://…` links get the app path prepended | `useHref` applied to every href | RA now recommends `render` | Router `href()` is never applied to absolute or protocol-relative URLs (scenario) |
| RA | [#5335](https://github.com/adobe/react-spectrum/issues/5335) closed | With a basename, rendered `href` ≠ navigation target | Two code paths for href | `useHref` added | Rendered `href` = `router.href(href)`; `navigate` receives the unresolved href (scenario) |
| RA | [#6347](https://github.com/adobe/react-spectrum/issues/6347) closed | ⌘-click on a synthetic link opens a URL without the base path | `data-href` skipped `useHref` | Fixed | Non-anchor links resolve through the same function (scenario) |
| RA | [#7028](https://github.com/adobe/react-spectrum/issues/7028) closed | Hooks-order crash when `href` toggles undefined | `useHref` hook called conditionally | Fixed (empty string) | Router `href` is a plain function, not a hook (design) |
| RA | [#7220](https://github.com/adobe/react-spectrum/issues/7220) open | React Compiler lint error on `useHref` prop | Hooks passed as values | Open | Same (design) |
| RA | [#9490](https://github.com/adobe/react-spectrum/issues/9490) closed | Menu items without `href` crash under TanStack Router | `useHref` called for every item | Fixed (#9396) | `href()` is called only for parts that have an `href` (scenario) |
| RA | [#6557](https://github.com/adobe/react-spectrum/issues/6557) closed | External `_blank` link routed client-side | Two RouterProviders (user error) | Closed | Nested routers: the innermost wins; external/`_blank` never routed (scenario) |
| RA | [#10538](https://github.com/adobe/react-spectrum/issues/10538) closed | Relative `href="a"` navigates to `/a` | href passed through a path the router resolves from root | Closed (router semantics) | `navigate` receives the href exactly as given; resolution is the router's (docs) |
| RA | [#10603](https://github.com/adobe/react-spectrum/issues/10603) closed | `useButton` as `<a>` ignores the router | Only useLink handled routing | Won't fix: use Link | Every part rendered as `<a href>` routes through link-navigation — including Button's anchor branch (request to add-button) |
| RA | [#7566](https://github.com/adobe/react-spectrum/issues/7566) closed | No way to run an animation before client navigation | No veto | `preventDefault` in `onClick` now works | Consumer `preventDefault()` (or `preventRindHandler()`) on click skips routing (scenario) |
| RA | [#2525](https://github.com/adobe/react-spectrum/issues/2525) closed | `useLink` with `next/link` reloads the page | Press handler swallowed the click the router needed | Fixed by relying on native `onClick` | `render={<RouterLink/>}`: the router's own click handling is untouched (scenario) |
| Base UI | [#5432](https://github.com/mui/base-ui/issues/5432) closed | Tab rendering a react-router `Link` loops ("Maximum update depth") | Ref-merge cleanup re-registered on every render | Fixed | Test `render` with a real router Link in React tests (task) |
| RA | [#9863](https://github.com/adobe/react-spectrum/issues/9863) open | Rows with `href` lack "open in new tab" | Not an anchor | Docs: put a link in a cell | Non-anchor link is a fallback; documented loss (docs) |
| RA | [#2234](https://github.com/adobe/react-spectrum/issues/2234), [#7767](https://github.com/adobe/react-spectrum/issues/7767) closed | Button inside a link navigates | Invalid HTML | Won't fix | Development warning for interactive content (task) |
| RA | [#6614](https://github.com/adobe/react-spectrum/issues/6614) open | Alt+click downloads instead of selecting text | Native behaviour (Option+click = download) | Open | Alt is a modifier left to the browser; no routing (scenario row) |
| RA | [#5664](https://github.com/adobe/react-spectrum/issues/5664) closed | Wants automatic `aria-current` from the router | Current is app knowledge | `render` + NavLink | `current` is a prop; NavLink via `render` (Non-goal) |
| RA | [#10572](https://github.com/adobe/react-spectrum/issues/10572) closed | `aria-current` not accepted through LinkContext | Type gap | Fixed | `current` is part of the typed link input (spec) |
| RA | [#9631](https://github.com/adobe/react-spectrum/issues/9631) closed | Chrome URL hint persists after click | Chromium bug with `tabIndex` on anchors | Fixed in Chrome 147 | Never add `tabIndex` to an enabled native anchor (spec) |
| RA | [#8992](https://github.com/adobe/react-spectrum/issues/8992) closed | ⌘/Ctrl+Enter on a virtually focused link item opens in the same tab | Synthetic activation dropped modifiers | Fixed | Programmatic opening (`openLink`) carries modifiers; WebKit needs a key event (design) |
| Menu research | [RX#2718](https://github.com/radix-ui/primitives/issues/2718), [ZG#2704](https://github.com/chakra-ui/zag/issues/2704), [RA#8697](https://github.com/adobe/react-spectrum/issues/8697), [BU#1746](https://github.com/mui/base-ui/issues/1746) | Link items navigate twice, not at all, or scroll on Space | Library and browser both activate | add-menu "Link Items" | Composite hosts add Space; the shared rules stay Enter-native (spec) |
| Toolbar research | [BITS#642](https://github.com/huntabyte/bits-ui/issues/642) | Enter on a toolbar link does nothing | Group swallowed Enter | Fixed | Hosts never swallow Enter on links (add-toolbar) |

## Known pitfalls

- **Double activation**: a library handler plus the browser's own activation (Enter on `<a>`
  fires `click`) → two navigations or two tabs. Rule: the native click is the only
  activation of an anchor.
- **Routers**: href transformation must be pure, idempotent, skip external URLs, and be used
  identically for the rendered `href`, synthetic links and modifier-click opening.
  `navigate` gets the router's href, not the DOM one.
- **Eligibility for client navigation** (RA's list, which we copy): primary button only
  (`button === 0`), no Meta/Ctrl/Shift/Alt, `target` absent or `_self` (attribute, not
  property — Firefox iframes), same origin, no `download`, not already `defaultPrevented`.
- **WebKit synthetic clicks ignore modifiers** → programmatic open with modifiers uses a
  keyboard Enter event on macOS WebKit (RA `openLink`). Only needed for non-anchor links.
- **Pressed state** must clear when the page hides or the element blurs (`_blank`).
- **SSR**: a link is fully server-renderable: `href`, `aria-current`, disabled attributes all
  on the server; the router's `href()` must be deterministic.

## Testing notes

- jsdom does not navigate: the DOM adapter asserts `href`, `defaultPrevented` and the router
  spy; Playwright asserts real navigation, new tabs (`context.waitForEvent("page")`) and
  middle click (`click({ button: "middle" })`).
- Contract queries: `href`, `isCurrent`/`current`, `isDisabled`, `isFocusVisible`. Actions:
  `follow` (pointer click / keyboard Enter; virtual = bare click), `followInNewTab`
  (⌘/Ctrl-click; keyboard ⌘/Ctrl+Enter), `middleClick` (pointer only; keyboard twin declared
  `none` with reason — there is no keyboard middle click; ⌘+Enter is `followInNewTab`).
- A fake `Router` (`fakeRouter()` records `navigate` calls) for node and DOM tests.
- No machine (stateless, like Separator): no `testMachine`; invariants run in driver tests.

## Decisions

- **Parts**: one part, `<Link>` (default `<a>`), with `render`. No Root/Text split.
- **Machine**: none. Press, hover and focus attributes come from `core/dom` (press,
  hover, modality); docs metadata `stateless: true`.
- **Shared `link-navigation` capability** (`core/dom/link.ts` + `core/env/router.ts`), used
  by Link and by every part that renders a link: Breadcrumbs, Pagination, Navigation Menu
  links, and (by request) Button's anchor branch, Menu link items, Toolbar links:
  - `linkProps(input, env)` with `{ href, target, rel, download, ping, referrerPolicy,
    hrefLang, routerOptions, disabled, focusableWhenDisabled, current, onActivate }`,
    plus the rendered tag from `core/dom`.
  - `Router` environment capability: `{ navigate(href, routerOptions): void; href?(href):
    string }` — plain functions, never hooks. Supplied through `RindProvider`'s existing
    `environment` field; `@rind-ui/react` exports `RouterProvider` as a thin, typed wrapper.
    Nested routers: innermost wins.
  - `href()` applied only to relative and root-relative hrefs (not `scheme:` or `//`).
  - Client navigation on a primary, unmodified, same-origin, `_self`, non-download,
    not-already-prevented click: `preventDefault()` + `router.navigate(href, routerOptions)`.
  - `onActivate(details)` reports every activation to the containing component with
    `{ href, modality, disposition: "same-tab" | "elsewhere" }` (`elsewhere` = new tab/window,
    download, other target, middle click), so Menu / Navigation Menu can close only for
    same-tab activations and Pagination can change page only then (add-pagination request 1).
  - Disabled: no `href`, `role="link"`, `aria-disabled="true"`, `tabindex="-1"` (TalkBack
    quirk), every activation ignored; `focusableWhenDisabled` keeps it in the Tab order
    (`tabindex="0"`) — Pagination's default.
  - `current` → `aria-current` (value; `true` → `"true"`) + `data-current`.
  - Non-anchor element: `role="link"`, `tabindex="0"`, Enter-only press; activation opens a
    synthetic anchor with the resolved href and the event's modifiers (WebKit/macOS uses a
    keyboard event — quirk entry).
- **`data-*`**: `data-scope="link"`, `data-part="link"`, `data-current`, `data-disabled`,
  `data-focus`, `data-focus-visible`, `data-hover`, `data-pressed`, `data-external` (resolved
  origin differs from the document's — styling hook for an external-link icon; the core never
  adds text).
- **Contract**: `link` scope, locate by role `link` + name; actions `follow`,
  `followInNewTab`, `middleClick`; queries `href`, `current`, `isDisabled`, `isExternal`,
  `isFocusVisible`; traits none. A `fakeRouter()` helper in `@rind-ui/testing`.
- **Deliberately different**:
  - Router `href` is a function, not a hook (RA#7028, #7220, #9490).
  - External URLs never pass through `href()` (RA#6397, #6803).
  - Disabled links keep `tabindex="-1"` (RA#3998) — RA and Kobalte drop focusability.
  - No automatic `aria-current` from the router (RA#5664; NavLink via `render`).
  - `onActivate` with a disposition, so containers stop guessing from modifiers.

## Open questions

- Should `data-external` also emit an accessible hint ("opens in a new tab") for
  `target="_blank"`? WCAG 3.2.5 (AAA) only; leave to the consumer's `messages`-driven text for
  now.
- Navigation API backend for the default router (no click interception at all): verify
  cross-engine support in BCD first.
