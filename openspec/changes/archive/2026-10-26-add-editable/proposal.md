## Why

Edit-in-place text (a title, a name in a list, a cell) switches a preview to an input and back.
Zag/Ark and Reka ship it with recurring bugs: the preview named "edit" instead of its value,
editing on focus (WCAG 3.2.1, reka#1016), Escape restoring a stale value (zag#3510, #2743, #658),
Space submitting (reka#1008), outside-press tracking left on while previewing (zag#721,
reka#1944). rind-ui has the hidden form input, autosize and field wiring it needs.

Research: [editable](../../../docs/research/editable.md) ·
[text-field](../../../docs/research/text-field.md)

Depends on: `add-text-field` (autosize), `add-field` (Label, hidden input), `add-theme-system`.

## What Changes

- A public **Editable** in `@rind-ui/core` and every framework package: parts `Root`, `Label`,
  `Area`, `Preview` (a button), `Input`, `Control`, `EditTrigger`, `SubmitTrigger`,
  `CancelTrigger`.
- States `preview | edit` (controllable `edit`); the committed `value` (controllable), a draft,
  and the value saved on entering edit (Escape restores it); `activationMode` (`click` default,
  `dblclick`, `focus`, `none`), `submitMode` (`both` default, `enter`, `blur`, `none`) with one
  outside-press table; every change with a reason, `onEditChange` cancelable.
- `getEditable` driver, `editable.css`, site example, docs page.

## Capabilities

### New Capabilities

- `editable`: anatomy, states and reasons, activation, submit and cancel, outside press, keys,
  form value, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Rich text, async pending state, validation rules, linked fields, undo history.

## Impact

- New: `packages/core/src/components/editable/`, framework parts, driver, theme file, site
  example and skin, `docs/components/editable.md`.
- Modified: `families.ts` (`editable` in `field`).
