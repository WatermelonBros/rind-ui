# Fieldset — research

Status: done · Wave: 2 (needed by Field for disabled propagation and by group controls for
a group name)

Cross-cutting: [accessibility.md](accessibility.md) §2 (groups), [native-platform.md](native-platform.md).
Related: [field.md](field.md) (one Field = one control; groups of fields go in a Fieldset),
[checkbox-group.md](checkbox-group.md) and `add-radio-group` (which already allow their
root to render as `<fieldset>` with a `<legend>`), `add-button` (`button-like-element`
already tracks a disabled `<fieldset>` through `core/dom/fieldset-disabled.ts`).

## Pattern

- No APG pattern; HTML `<fieldset>` (implicit role `group`) named by its **first `<legend>`
  child** (HTML-AAM). ARIA equivalent: `role="group"` + `aria-labelledby`.
- `<fieldset disabled>` disables every descendant form control (`:disabled` matches, they
  are barred from constraint validation and not submitted) **except those inside its first
  `<legend>` child**; nested fieldsets inherit (an enabled inner fieldset inside a disabled
  outer one is still disabled). It does not disable non-form elements (a `div` with
  `role="radio"`, links, `contenteditable`).
- WCAG 1.3.1: related controls (radio sets, address blocks) grouped and the group named;
  3.3.2 group-level instructions as the group's description.

## How the others built it

| Library | Root | Legend | Disabled | Extras |
|---|---|---|---|---|
| Base UI (`fieldset/root/FieldsetRoot.tsx`, `legend/FieldsetLegend.tsx`) | `<fieldset disabled aria-labelledby>` | **`div`** with registered id | prop OR parent Fieldset (context); Fields read it | — |
| Headless UI (`components/fieldset/fieldset.tsx`, `legend/legend.tsx`) | `fieldset` → native `disabled`; other tag → `role="group"` + `aria-disabled` | `Label as="div"`, registered into `aria-labelledby` | `DisabledProvider` to every control | — |
| Ark (`fieldset/use-fieldset.ts`) | `<fieldset disabled aria-labelledby aria-describedby>` | `legend` (ARK#3614 changed it from `div`) | native + context to Fields | HelperText, ErrorText (`aria-live`), `invalid` (not cascaded, ARK#2928) |

Radix, React Aria, Ariakit, Reka, Bits and Kobalte ship no Fieldset (RAC groups are
`CheckboxGroup`/`RadioGroup`; Ariakit `FormGroup` + `FormGroupLabel` = `role="group"` +
`aria-labelledby`).

## Accessibility

- **Name**: native `<legend>` as the first child gives the name with no ARIA and before
  hydration; a substituted (non-`legend`) Legend needs `aria-labelledby` on the root
  (Base UI, HUI). Never both (double reading is harmless but `aria-labelledby` overrides,
  and a dangling id empties the name — ARK#3707 rendered `aria-describedby=""`).
- **Description and error** (group-level instructions, "choose at least one") in the root's
  `aria-describedby`, only while rendered. Group errors are not cascaded to children
  (ARK#2928): each child keeps its own validity.
- **Disabled** must reach non-native rind controls too (HUI#194, HUI#1802, RX#2417): native
  `disabled` for native descendants + context for rind controls (which may render `div`s
  or portal their content).
- Screen readers announce the group name when focus enters the group (NVDA, JAWS, VO);
  keep legends short.
- `role="group"` on a native `<fieldset>` is redundant (first rule of ARIA).

## Bug history

All issues read.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Headless UI | [headlessui#194](https://github.com/tailwindlabs/headlessui/issues/194) | Switch inside `<fieldset disabled>` still toggles | handler on a non-control element | closed (#202) | check `fieldset:disabled` ancestry in every handler |
| Headless UI | [headlessui#1802](https://github.com/tailwindlabs/headlessui/issues/1802) | RadioGroup in a disabled fieldset not disabled | options are `div`s the native cascade misses | closed (workaround) | propagate through context as well as natively |
| Radix | [primitives#2417](https://github.com/radix-ui/primitives/issues/2417) | Select ignores `<fieldset disabled>` | disabled read from props only | open (PR #3174) | disabled = prop OR fieldset context OR `:disabled` ancestor, portalled parts too |
| Ark | [ark#2928](https://github.com/chakra-ui/ark/issues/2928) | Fieldset `invalid` does not make inputs invalid | intentional (HTML cascades only disabled) | closed, by design | cascade only disabled |
| Ark | [ark#3707](https://github.com/chakra-ui/ark/issues/3707) | `aria-describedby=""` on the fieldset | untested id collection | closed (#3708) | omit empty IDREF lists; test name and description |
| Ark | [ark#3614](https://github.com/chakra-ui/ark/issues/3614) | Legend rendered a `div` | used `ark.div` | closed (now `legend`) | default to native `legend` |
| Base UI | [base-ui#3044](https://github.com/mui/base-ui/issues/3044) | why is Legend a `div`? | deliberate, `<legend>` hard to style | closed, by design | either works if the name is tested; we pick native + `aria-labelledby` fallback |
| Ark | [ark#3972](https://github.com/chakra-ui/ark/issues/3972) | `useFieldset` re-renders on every DOM mutation, can loop | MutationObserver + new object each time | closed | register parts; no MutationObserver presence detection |
| Ark | [ark#2895](https://github.com/chakra-ui/ark/issues/2895) | Checkbox Group in a Field: clicks toggle only the first box | one id for all | closed, by design | groups go in a Fieldset (or are one registered control) |
| Base UI | [base-ui#3260](https://github.com/mui/base-ui/issues/3260) | no Fieldset Description/Error; Field.Description works on RadioGroup, not CheckboxGroup | group root ignored the describedby | open | Fieldset has Description and ErrorMessage, referenced from the root |
| Base UI | [base-ui#3930](https://github.com/mui/base-ui/issues/3930) | is Field or Fieldset the validation boundary for groups? | one Field labelling many controls | open | Field = one control; group-level text on Fieldset |
| React Aria | [react-spectrum#3883](https://github.com/adobe/react-spectrum/issues/3883) | in FocusScope, Tab inside a native radio fieldset moves radio to radio | walker treated every radio as a stop | closed (#8488) | focus management treats a radio set as one stop |

## Known pitfalls

- The first-`legend` exception: a control inside the legend (a "select all" checkbox in the
  legend) stays enabled in a disabled fieldset; a tracker that tests "has a disabled
  fieldset ancestor" gets it wrong. `element.matches(":disabled")` on a native element
  gets it right; for non-native parts the tracker must replicate the rule.
- Only the **nearest** fieldset observed (`add-button` design: "MutationObserver on the
  nearest fieldset") misses a disabled outer fieldset.
- Styling `<legend>`: it is rendered over the fieldset border; `float: inline-start;
  inline-size: 100%` (or `display: contents` on the fieldset's content wrapper) normalises
  it. The theme does this.
- `min-inline-size: min-content` default on fieldset breaks responsive layouts; theme sets
  `min-inline-size: 0`.

## Testing notes

- Name and description through `computeAccessibleName/Description` (0008).
- Disabled propagation matrix: native input, rind Button, Checkbox (button control), Select
  (portalled content), Radio item (`div` via `render`), nested fieldsets, control inside
  the first legend.
- Driver: `getFieldset(screen, { name })` → `isDisabled()`, `description()`, `errors()`.

## Decisions

- **Parts**: `Fieldset.Root` (`fieldset`), `Fieldset.Legend` (`legend`, first child),
  `Fieldset.Description` (`p`), `Fieldset.ErrorMessage` (`p`, rendered while the consumer's
  `invalid` is true — Fieldset has no validation of its own).
- **No machine**: `disabled` and `invalid` are props; there are no transitions. The
  contract has no actions; prop steps cover `disabled`/`invalid`.
- **Disabled**: native `disabled` on the `<fieldset>`; a substituted root (`render` →
  `div`) gets `role="group"` + `aria-disabled`; in both cases a **fieldset context**
  publishes `disabled` (OR'ed with an outer one) to Fields and every rind control, so
  `div`-based and portalled parts follow (HUI#1802, RX#2417). Controls inside the first
  Legend are exempt, as natively.
- **Name**: native legend; `aria-labelledby` only when the Legend is not a native first
  `legend` child; `aria-describedby` from rendered Description/ErrorMessage only.
- **`data-*`**: `data-disabled`, `data-invalid` on every part.
- **Different from others**: native `legend` by default (Base UI/HUI use `div`); invalid is
  not cascaded (Ark agrees).

## Open questions

- None blocking. Whether Checkbox Group / Radio Group should render inside a Fieldset by
  default is their decision (they already accept `fieldset`/`legend` rendering).
</content>
</invoke>
