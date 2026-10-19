## Why

Navigation Menu (site navigation with dropdown and mega-menu panels) ships in six of
the nine libraries in [components.md](../../../docs/components.md), and every one of
them has the same bug trail: sentinels and `aria-owns` hacks for Tab order, inline
`pointer-events` writes that freeze the page, panels that close on the user's click or
reopen after Escape, stale sizes when switching panels, and links that do not close the
menu through a client router. Two of them do not follow the APG Disclosure Navigation
pattern at all (menubar keys or roles). The infrastructure it needs — hover intent,
non-modal Tab order, content sizing, indicator measurement, links — is specified, so
this change specifies the component on top.

Research note: [docs/research/navigation-menu.md](../../../docs/research/navigation-menu.md)
(with [accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md),
[native-platform](../../../docs/research/native-platform.md),
[tooltip](../../../docs/research/tooltip.md) for hover intent,
[collapsible](../../../docs/research/collapsible.md) for content sizing).

**Depends on**: `add-foundations` (runtime, `controllable`, contracts, drivers,
`testMachine`, React adapter); `add-a11y-foundations` (press, modality, focus cause,
logical keys and RTL, messages, invariants); `add-overlay-infrastructure` (layer stack,
dismissable layer, presence, portal); `add-floating-positioning` (optional
Positioner); `add-button` (`button-like-element` for triggers); `add-tooltip`
(`hover-intent`); `add-popover` (`non-modal-tab-order`); `add-collapsible`
(`content-size`, plus the additive request in design.md); `add-tabs`
(`selection-indicator`); `add-link` (`link-navigation`); `add-theme-system`.

## What Changes

- `@rind-ui/core`: the `navigation-menu` machine (one service per level), connect,
  contract and messages; a small level tree so link activation and Escape work across
  nested levels.
- Behaviour: APG disclosure navigation — every top-level item a Tab stop, Enter/Space
  toggles with focus on the trigger, Escape closes the innermost level and returns
  focus, optional arrow keys between items and links (mirrored in RTL); hover opening
  with delays, grace area and in-transit suppression; press-opened panels that stay
  open; immediate switching while open; closed panels mounted and `hidden` by default;
  content following its trigger in the Tab order wherever it renders; link activation
  closing the whole tree, modifier clicks untouched; `aria-current` on links.
- `@rind-ui/react`: `NavigationMenu.Root`, `List`, `Item`, `Trigger`, `Content`,
  `Link`, `Indicator`, `Viewport`, `Positioner`, `Sub`, with the generic `Portal`.
- `@rind-ui/testing`: `getNavigationMenu` driver and model-based coverage.
- Theme stylesheet (tier-3 `--rind-navigation-menu-*` tokens), stories, docs page.

## Capabilities

### New Capabilities

- `navigation-menu`: the Navigation Menu component — parts, landmark and disclosure
  semantics, keyboard, hover and press opening, switching, dismissal and focus,
  nested levels, links and current page, viewport sizing and motion, indicator,
  closed-content modes, `data-*` per part, controlled `value`, contract and driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; this
change uses them. One additive need on `add-collapsible`'s `content-size` module and
two theme-matrix rows are listed in design.md "Requests to other changes" (not edited
here).

## Non-goals

- Menubar or menu semantics (`role="menubar"`/`menuitem`; Kobalte's model) — that is
  Menubar (`add-menubar`).
- Turning into a drawer or hamburger menu on small screens. Mobile layouts compose a
  Dialog/Drawer with a vertical Navigation Menu (inline content) — documented, not
  built in.
- A trigger that is also a link (one element that navigates and toggles). Use the
  split item: `Link` + `Trigger` in one `Item`.
- Drill-down navigation (reka#2986), typeahead, focus trapping inside a panel
  (reka#621), `aria-owns` re-parenting.
- `hidden="until-found"` panels (deferred; see the research note).
- Re-specifying hover intent, Tab order, sizing, indicator, link or overlay rules.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/navigation-menu/{navigation-menu.machine,navigation-menu.connect,navigation-menu.contract,navigation-menu.messages,navigation-menu-tree}.ts`,
  `packages/react/src/navigation-menu/*`, driver export in `@rind-ui/testing`,
  `packages/theme/src/navigation-menu.css`, stories, generated docs page.
- Public API: `navigation-menu` machine/connect/contract, `NavigationMenu` parts,
  `getNavigationMenu`.
- No new runtime dependency.
