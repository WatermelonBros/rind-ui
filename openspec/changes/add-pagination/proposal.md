## Why

Pagination is shipped by four libraries (Ark, Reka, Bits UI, Kobalte) and every one of
them has hit the same bugs: page 0 on empty data, ellipses that hide a single page,
"link mode" that still renders buttons, boundary links that keep navigating, focus
dropped to `<body>` when Next becomes disabled, and hard-coded English names. It is a
wave 2 component and the second consumer of `add-link`'s `link-navigation`.

Research note: [docs/research/pagination.md](../../../docs/research/pagination.md)
(with [accessibility](../../../docs/research/accessibility.md),
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md),
[native-platform](../../../docs/research/native-platform.md)).

Depends on:

- `add-foundations`: runtime, `controllable`, contracts, drivers, `testMachine`, React
  adapter.
- `add-a11y-foundations`: press interactions, modality, focus attributes, messages,
  locale/direction, ids.
- `add-button`: `button-like-element` for page and trigger buttons.
- `add-link`: `link-navigation` (`linkProps`, the `Router` capability) for page and
  trigger links.
- `add-theme-system`: tier-3 tokens and the `toggle item` family.

## What Changes

- A public **Pagination** component:
  - a one-state machine with controllable `page` and `pageSize`;
  - a pure, exported range function (`paginationRange`) with specified invariants;
  - connect; React parts `Root`, `List`, `Item`, `Page`, `Ellipsis`, `First`,
    `Previous`, `Next`, `Last`;
  - a contract and a generated driver (`getPagination`);
  - model-based tests, a theme stylesheet, stories and a docs page.
- Inputs as a typed union: `totalPages`, or `count` + `pageSize`; `totalPages` is never
  below 1, and the page is clamped and re-proposed when the total shrinks.
- Buttons by default; links when `getPageHref` is given (the element changes, not just
  the attributes), with client routing and modifier clicks handled by `link-navigation`.
- Unavailable triggers carry `aria-disabled` and stay focusable by default, so focus is
  never lost at the first or last page.

## Capabilities

### New Capabilities

- `pagination`: the Pagination component — landmark and list structure, names, current
  page, range rules, buttons vs links, disabled and boundary behaviour, page size,
  controlled values, focus, `data-*` per part, contract and driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes.

## Non-goals

- A page-size control part: the consumer binds any Select or Segmented Control to
  `pageSize`.
- Roving tabindex or arrow-key navigation between controls (see design.md §5).
- "Jump" ellipses, a go-to-page input, infinite scroll / "load more", cursor-based
  pagination without a known total.
- Announcing page changes: the content change is the app's (docs show how).
- Slicing data (`slice()` in Zag): `range` gives the indices.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/pagination/{pagination.machine,pagination.connect,pagination.contract,pagination.messages,pagination.range}.ts`,
  `packages/react/src/pagination/`, `getPagination` in `@rind-ui/testing`,
  `packages/theme/src/pagination.css`, stories, the docs page.
- No new dependencies.
