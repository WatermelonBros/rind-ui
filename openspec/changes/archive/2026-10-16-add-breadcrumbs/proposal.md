## Why

Breadcrumbs (APG Breadcrumb pattern) is a wave-2 component, and Reado uses one: its path
bar in `Breadcrumb.tsx` migrates to it. The structure is plain HTML (`nav > ol > li > a`).
What libraries keep getting wrong is around that structure:

- a current item that drops focus or that TalkBack cannot reach;
- a forced "last item is current" rule;
- separators that are read aloud or counted as list items;
- an overflow trigger named "…".

Each of these is specified once here, on top of add-link's `link-navigation`.

Research note: [docs/research/breadcrumbs.md](../../../docs/research/breadcrumbs.md). It
builds on [link](../../../docs/research/link.md),
[accessibility](../../../docs/research/accessibility.md) and
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md).

Depends on:

- `add-foundations`: `render`, contracts, drivers, React adapter.
- `add-a11y-foundations`: messages, logger, ids, modality and focus attributes.
- `add-collections`: static item parts, keys, `textValue`.
- `add-link`:
  - `link-navigation`: `linkProps`, `Router`, the disabled and current rules;
  - the `link` theme family it requests.
- `add-menu`: the consumer's Menu inside the `Ellipsis` part, through link items.
- `add-theme-system`.

## What Changes

- A public **Breadcrumbs** component:
  - parts `Root` (`nav`), `List` (`ol`), `Item` (`li`), `Link`, `Separator` and `Ellipsis`;
  - connect, no machine (stateless);
  - a contract and the `getBreadcrumbs` driver;
  - messages, a theme stylesheet, stories and a docs page.
- **Current item.** `Item current` marks it explicitly. Otherwise the last item is current
  unless it sets `current={false}`. `currentValue` defaults to `"page"`. A current item
  without `href` is plain text that stays focusable (`tabindex="-1"`).
- **Collapse.** Count-based: `maxItems`, `itemsBeforeCollapse` (1), `itemsAfterCollapse` (1).
  Collapsed items stay mounted and `hidden`. They are listed to the `Ellipsis` part, which
  hosts the consumer's add-menu Menu with a localised trigger label.
- **Separators** are `aria-hidden` and live inside an Item; they are never list items.
- **Non-link items** (a Menu trigger per segment, as in Reado) get `current` from the
  Item's render state.

## Capabilities

### New Capabilities

- `breadcrumbs`: the Breadcrumbs component. It covers:
  - landmark, list and naming;
  - current item rules;
  - links through `link-navigation`;
  - separators;
  - collapse into a menu;
  - non-link items;
  - `data-*` per part;
  - messages;
  - the contract and driver.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; see design.md
"Requests to other changes".

## Non-goals

- Width-based automatic collapsing, as React Spectrum S2 does with a hidden measuring
  copy. It is an Open question for a later additive `collapse="auto"`.
- Arrow-key navigation between crumbs, or a single Tab stop. Neither APG nor React Aria
  nor Kobalte does it (radix-ui/primitives#2050).
- Step lists (`aria-current="step"` with completed and upcoming states): the Steps
  component (react-spectrum#6561).
- An `autoFocusCurrent` prop (react-spectrum#2958). The current item stays focusable;
  the app moves focus.
- Expanding the trail in place instead of a menu (MUI). The consumer can do it by setting
  `maxItems` to `undefined`.
- Framework adapters other than React; fx.

## Impact

- New code:
  - `packages/core/src/components/breadcrumbs/` (connect, contract, messages);
  - `packages/react/src/breadcrumbs/`;
  - `getBreadcrumbs` in `@rind-ui/testing`;
  - `packages/theme/src/breadcrumbs.css`;
  - stories and the docs page.
- Reado: `Breadcrumb.tsx` migrates. It uses `Root` around its back/forward and toggle
  buttons, `List`, and one `Item` per segment containing a Menu trigger with
  `aria-current="location"` on the file segment.
- No new dependency.
