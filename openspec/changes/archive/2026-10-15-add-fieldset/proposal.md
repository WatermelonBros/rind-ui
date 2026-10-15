## Why

Related controls (an address, a radio set, a group of Fields) need a group name, group-level
instructions and errors, and one switch that disables them all. A native `<fieldset>` gives
the name and the disabled cascade, but only to native form controls. rind-ui controls that
render `div`s or portal their content were missed in every library that relied on the
native cascade alone (headlessui#194, headlessui#1802, radix#2417). Field (`add-field`) also
needs the group's disabled state.

Research: [fieldset](../../../docs/research/fieldset.md) ·
[field](../../../docs/research/field.md) ·
[accessibility](../../../docs/research/accessibility.md) §2

Depends on: `add-foundations`, `add-a11y-foundations` (`element-ids`), `add-button`
(`button-like-element`: disabled fieldset tracking) and `add-label` (`label-interaction`, for
the Legend's selection guard).

## What Changes

- A public **Fieldset** component with parts `Root` (`<fieldset>`), `Legend` (`<legend>`),
  `Description` and `ErrorMessage`. It takes the props `disabled` and `invalid`.
- The **name** comes from a native first-child `<legend>`. `aria-labelledby` is used only
  when the Legend is substituted. `aria-describedby` lists the rendered Description and
  ErrorMessage, and is omitted when there are none.
- **Disabled propagation**: native `disabled` on the fieldset, plus a fieldset context that
  every rind control and Field reads. That covers `div`-based and portalled parts, nested
  fieldsets and the first-legend exception. A substituted root becomes `role="group"` +
  `aria-disabled`.
- Group invalid is **not** cascaded to children (HTML has no such cascade; ark#2928).
- The fieldset **contract and driver** (`getFieldset`), plus stories, a theme stylesheet that
  normalises `<legend>`, and a docs page.

## Capabilities

### New Capabilities

- `fieldset`: the Fieldset component: anatomy, group name and description, disabled
  propagation to native and rind controls, data attributes, contract, theme.

### Modified Capabilities

None. `button-like-element`'s disabled-fieldset tracking needs to follow nested fieldsets,
the first-legend exception and the fieldset context. That request is listed in design.md
under "Requests to other changes".

## Non-goals

- Validation. Fieldset shows an error the consumer provides through `invalid` and
  ErrorMessage content. Group validity (for example "pick at least one") belongs to the
  group control (Checkbox Group, Radio Group) or to a Field around it.
- Cascading `invalid`, `readOnly` or `required`: HTML cascades only `disabled`.
- Collapsible fieldsets (a Collapsible inside a Legend is consumer composition).
- Framework adapters other than React; fx.

## Impact

- `packages/core`: `components/fieldset/` (connect, contract) and `dom/fieldset-context.ts`
  (the disabled context read by controls).
- `packages/react/src/fieldset/`, `@rind-ui/testing` (`getFieldset`),
  `@rind-ui/theme/fieldset.css`, stories, docs.
- No new runtime dependency.
