## Why

Toolbar ships in six of nine libraries and is the container most wave-1 controls end up
in: buttons, toggles, Toggle Group, Radio Group, Menu / Select / Popover triggers and the
occasional text field. Every library's bug history is the same story — the toolbar and a
control inside it both want the same key (a text field's caret, a Select's arrows, a
radio group's arrows, keys bubbling out of popups), or two roving groups fight over the
tab stop. `add-radio-group` and `add-toggle-group` explicitly left "inside a Toolbar" to
this change. It defines the toolbar and the host contract those composites read.

Research: [toolbar](../../../docs/research/toolbar.md) (sources, Bug history,
Accessibility, Decisions) · [collections](../../../docs/research/collections.md) ·
[separator](../../../docs/research/separator.md) ·
[toggle-group](../../../docs/research/toggle-group.md) ·
[radio-group](../../../docs/research/radio-group.md) ·
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (runtime, contracts, drivers, `testMachine`, React
adapter), `add-a11y-foundations` (press, modality, logical keys, focus attributes,
invariants), `add-collections` (static item parts, navigation, roving composite, repair,
item registry), `add-button` (`button-like-element`), `add-separator` (separator
semantics), `add-theme-system`. It integrates with, and requests small changes to,
`add-toggle-group` and `add-radio-group`; it is used with `add-menu`, `add-select`,
`add-popover` and `add-tooltip` triggers through element substitution.

## What Changes

- `@rind-ui/core`: the `toolbar` machine (collections roving fixture plus focus memory),
  connect with one key-ownership function, contract; the `CompositeHost` port that lets a
  composite run inside another composite.
- Behaviour: one tab stop with re-entry on the last focused control; axis arrows
  (mirrored in RTL), Home / End, optional wrap; perpendicular arrows, Enter, Space and
  letters left to the controls; text fields keep their caret keys; keys from popups and
  nested content ignored; disabled controls focusable with `aria-disabled` by default;
  hosted Toggle Group and Radio Group join the toolbar's roving focus (radios move
  without checking, Enter / Space check); `focus()` for app hotkeys.
- `@rind-ui/react`: `Toolbar.Root`, `Button`, `Link`, `Item`, `Group`, `Separator`.
- `@rind-ui/testing`: `getToolbar` driver and model-based coverage.
- Theme stylesheet (`--rind-toolbar-*`), stories, docs page.

## Capabilities

### New Capabilities

- `toolbar`: the Toolbar component — anatomy, roles and naming, keyboard and key
  ownership, tab stop and focus memory, disabled controls, triggers and text fields
  inside it, `data-*`, contract and driver, theme expectations.
- `composite-host`: how a composite component (Toggle Group, Radio Group, later Tabs or
  Segmented Control) behaves when an enclosing composite owns focus navigation — item
  registration into the host, no own tab stop or arrow handling, values and roles kept.

### Modified Capabilities

None. The capabilities this builds on are introduced by unarchived changes; the hosted
behaviour they need is requested in design.md "Requests to other changes".

## Non-goals

- Overflow handling (a "more" menu for controls that do not fit).
- A built-in hotkey to reach the toolbar (APG note 3): `focus()` is provided; the key
  binding is the application's.
- Typeahead across toolbar controls (not in the APG pattern; letters belong to fields).
- Nested toolbars (a toolbar inside a toolbar); `Toolbar.Group` covers grouping.
- `focusgroup` (native-platform.md §9); a toolbar-specific copy of Toggle Group
  (Radix `ToolbarToggleGroup`) — the standalone components are hosted instead.
- Up / Down moving inside a hosted radio group of a horizontal toolbar (APG example
  extra): radios are toolbar items like any other.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/toolbar/{toolbar.machine,toolbar.connect,toolbar.contract,toolbar.messages}.ts`,
  `packages/core/src/collection/composite-host.ts`, `packages/react/src/toolbar/*`,
  `getToolbar` in `@rind-ui/testing`, `packages/theme/src/toolbar.css`, stories,
  generated docs page.
- Public API: `toolbar` machine / connect / contract, `CompositeHost`, `Toolbar` parts,
  `getToolbar`.
- No new runtime dependency.
