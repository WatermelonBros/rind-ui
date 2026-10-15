## Context

[fieldset.md](../../../docs/research/fieldset.md) has the comparison and the bug history.
`add-button` already ships `core/dom/fieldset-disabled.ts`: a MutationObserver on the
nearest `<fieldset>`'s `disabled` attribute feeds `FIELDSET.CHANGE` into each machine that
uses `button-like`. Checkbox Group and Radio Group already allow their root to be a
`<fieldset>` with a `<legend>`.

## Goals / Non-Goals

**Goals:**
- One answer to "is this rind-ui part disabled by a fieldset", shared by the DOM tracker and
  the React context, and correct for nested fieldsets, the first legend, `div` parts and
  portals.

**Non-Goals:**
- A machine. `disabled` and `invalid` are props, and nothing transitions.

## Decisions

### 1. Layout

```
packages/core/src/
├─ components/fieldset/fieldset.connect.ts   parts' props; legend-is-native detection
├─ components/fieldset/fieldset.contract.ts
└─ dom/fieldset-context.ts                   effective disabled: context ∪ native ancestry
packages/react/src/fieldset/                 Root (provides context), Legend, Description, ErrorMessage
packages/theme/src/fieldset.css
```

### 2. Effective disabled

```ts
// framework-neutral; each adapter provides `parent` through its context mechanism
interface FieldsetScope { disabled: boolean; legend: Element | null; parent: FieldsetScope | null }
isFieldsetDisabled(scope: FieldsetScope | null, part: Element | null): boolean
```

- The context value is `own disabled || parent's effective disabled`, with the first-legend
  exemption: a part is exempt when it is inside the root's first Legend. The adapter knows
  this from the render tree, because the Legend part provides an `inLegend` marker to its
  subtree. The DOM test is the fallback for consumer-rendered legends.
- The DOM tracker in `fieldset-disabled.ts` uses the same rule for native ancestry. It
  checks `closest("fieldset:disabled")` and every disabled ancestor fieldset, and exempts
  parts inside such a fieldset's first `legend` child. It observes every ancestor fieldset,
  not only the nearest one, through a single MutationObserver per document on the
  `disabled` attribute filter. That is the request to `add-button` below.
- A rind-ui control's disabled is `prop || field || fieldset context || native tracker`.
  Portalled parts read the context, because they are rendered in the React tree under the
  Fieldset.

### 3. Name

- Connect marks the Legend as native when its rendered element is a `legend` and it is the
  root's first element child, which is checked after commit. On the server it assumes
  native when the Legend's element is the default `legend`. A substituted Legend makes the
  root emit `aria-labelledby` (an expected part, so the server HTML carries it).
- Description and ErrorMessage register on mount (`expected parts` for SSR when rendered in
  the first pass). `aria-describedby` is built from registered ids only.

### 4. Legend interaction

The Legend uses `label-interaction`'s double-click selection guard only. A legend activates
nothing.

### 5. Theme

`fieldset.css`: `:where([data-scope="fieldset"][data-part="root"])` with `border: 0;
padding: 0; margin: 0; min-inline-size: 0`, and the Legend with `float: inline-start;
inline-size: 100%; padding: 0` plus a following-sibling clear, the known normalisation that
removes the border notch. Tokens: `--rind-fieldset-gap`, `--rind-fieldset-legend-font-*`,
`--rind-fieldset-error-color` (fallback `--rind-color-danger-text`). Disabled lowers
contrast through the semantic disabled role and keeps text at 3:1 or more.

## Requests to other changes

- **APPLIED (coordinator, 2026-10-14).** **add-button (`button-like-element`, `core/dom/fieldset-disabled.ts`)**: follow every
  disabled ancestor fieldset, not only the nearest one, and exempt parts inside a disabled
  fieldset's first `<legend>`. Also OR in the Fieldset context (§2). Add scenarios for
  nested fieldsets and the legend exemption.
- **APPLIED (coordinator, 2026-10-14).** (Through add-field's `field-control` amendment, which carries the Fieldset disabled; add-listbox not edited.) **Every form control change (add-checkbox, add-switch, add-checkbox-group,
  add-radio-group, add-select, add-combobox, add-autocomplete, add-listbox when
  form-associated, and later Slider, Number Input, Pin Input, Date Picker)**: read the
  Fieldset context as a disabled source, through the `field-control` binding of `add-field`,
  which carries it.

## Risks / Trade-offs

- [The first-legend check differs between server and client for consumer-built legends] →
  The server assumes the default markup, and the client re-checks after commit. Only the
  `aria-labelledby` presence can change, not the name.
- [A substituted root (`div`) does not disable native inputs] → `aria-disabled` plus a
  development warning. Native inputs inside rind-ui Text Fields are rind controls and do
  follow the context.

## Migration Plan

None.
