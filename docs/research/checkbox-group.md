# Checkbox Group — research

Status: done · Wave: 2 (built right after Checkbox, which it composes)

Builds on [checkbox.md](checkbox.md) (the `checkbox` machine, `hidden-form-input`,
`control-label`) and the cross-cutting notes
([accessibility](accessibility.md), [assistive-tech-and-a11y-testing](assistive-tech-and-a11y-testing.md),
[native-platform](native-platform.md)). This note covers only what the *group* adds: a shared
array value, group labelling, the "select all" parent checkbox, group-level disabled /
read-only / required, and form reset of several checkboxes at once.

## Pattern

- WAI-ARIA APG: [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/) — the
  [mixed (tri-state) example](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/examples/checkbox-mixed/)
  is exactly the "select all" parent. There is no separate "checkbox group" pattern.
- Roles and attributes:
  - Container: `role="group"` (or a native `<fieldset>`), named by `aria-labelledby` →
    visible label (or `<legend>`). A group is **not labelable**: `<label for>` cannot
    point at it.
  - Items: ordinary checkboxes (`role="checkbox"`, `aria-checked="true|false"`).
  - Parent: `role="checkbox"` with `aria-checked="mixed"` when some (not all) children
    are checked; APG's example adds `aria-controls` listing the children's ids.
  - `aria-required` is **not allowed** on `group` (ARIA 1.2: supported only on
    checkbox, combobox, gridcell, listbox, radiogroup, spinbutton, textbox, tree).
  - Description / errors via `aria-describedby` (AT note §I: `aria-errormessage` support
    is too uneven).
- Keyboard: **each checkbox is its own Tab stop**; Space toggles the focused checkbox.
  No arrow-key navigation (APG; unlike Radio Group).
- Parent cycle (APG mixed example): Space on the parent cycles *mixed → checked (all) →
  unchecked (none) → mixed (the previous partial selection restored)*. When the last
  user-made selection was already all or none, the parent simply toggles between them.

## How the others built it

The inventory ([components.md](../components.md)) lists only RAC and Base UI. Reading the
clones shows **five more**: Ark UI (`Checkbox.Group`), Reka UI (`CheckboxGroupRoot`), Bits UI
(`Checkbox.Group` + `Checkbox.GroupLabel`), Ariakit (`CheckboxProvider` / `useCheckboxStore`
with an array value) — and Base UI and RAC. Radix, Headless UI, Kobalte and Zag (machine
level) have none (Radix Themes has one, radix#3696; Ark's lives in the framework layer,
not in Zag).

### Base UI

- Source: `packages/react/src/checkbox-group/{CheckboxGroup.tsx,useCheckboxGroupParent.ts}`,
  `checkbox/root/CheckboxRoot.tsx` (`parent`, group wiring).
- API: `CheckboxGroup` (`value`/`defaultValue`/`onValueChange(value, details)`, `allValues`,
  `disabled`) renders `div role="group"` with `aria-labelledby` from `Field.Label`. Items are
  `Checkbox.Root value="…"`; the parent is `Checkbox.Root parent`.
- Parent: `checked = value.length === allValues.length`, `indeterminate` otherwise when
  non-empty. A `status` (`on | off | mixed`) plus a ref with the last child-made value
  implement the APG cycle. Disabled children are excluded from select-all: "all" = enabled
  ones + checked disabled ones, "none" = checked disabled ones (#729). `aria-controls`
  lists ids children *report after rendering* (`registerChildId`), so custom ids survive and
  no unmounted id is named (#2691).
- Parent is not submitted (`name` unset); `uncheckedValue` is ignored in groups.
- Notable: form value aligned with native submission (only enabled, mounted, checked
  inputs, #5208); each item's own `required` still validated (#4952); invalid submit
  focuses the failing checkbox (#5200).
- Problems: #4552 (stale cycle memory in controlled mode), #4896 (parent sent `true` to
  group validation), #4121 / #1972 (Field gave all items the same id / name), #1043
  (group `disabled` not propagated), #1426 (no required group, open). Arrow keys
  deliberately not supported (#1889, #2012).

### React Aria / RAC

- Source: `react-aria/src/checkbox/{useCheckboxGroup,useCheckboxGroupItem}.ts`,
  `react-stately/src/checkbox/useCheckboxGroupState.ts`, RAC `Checkbox.tsx` (`CheckboxGroup`).
- API: `CheckboxGroup` (`value`/`defaultValue`/`onChange`, `isDisabled`, `isReadOnly`,
  `isRequired`, `isInvalid`, `validate`, `validationBehavior: "aria" | "native"`, `name`,
  `form`) → `div role="group"` labelled by a `span` label (`labelElementType: 'span'`:
  "Checkbox group is not an HTML input element so it shouldn't be labeled by a <label>").
  Description and error message ids are added to every item's `aria-describedby`.
- State: a string array with `addValue/removeValue/toggleValue`; `isRequired` is true only
  **while nothing is selected** and then marks every item `aria-required` (and native
  `required` in `native` mode) — the cleanest "at least one" encoding found.
- No parent / select-all (#5220 open; users hand-roll it).
- Problems: #7749 and its regression #10643 (form reset unchecks only one box), #6173 /
  #5693 (group error not cleared after checking), #5907 (users expect Radio-like arrows;
  answered "by design"), #7674 (Safari Tab skips checkboxes: macOS "Keyboard navigation"
  setting), #4004 (VO reports a native indeterminate input as unchecked).

### Ark UI

- Source: `ark/packages/react/src/components/checkbox/{use-checkbox-group.ts,checkbox-group.tsx}`.
- API: `Checkbox.Group` (`value`/`defaultValue`/`onValueChange`, `name`, `disabled`,
  `readOnly`, `invalid`, `maxSelectedValues`) → `div role="group"` (no labelling part).
  `getItemProps(value)` returns `checked`, `onCheckedChange`, `name`, `disabled` (also
  disabled when the max is reached and unchecked).
- No parent checkbox. Zag's checkbox machine knows nothing about groups.
- Problems: #2895 (inside Field all items got the Field's id, a click toggled only the first),
  #3759 (item `disabled` ignored inside a group, Vue), #3174 (indeterminate inconsistent
  across frameworks).

### Reka UI

- Source: `packages/core/src/Checkbox/{CheckboxGroupRoot.vue,CheckboxRoot.vue}`.
- API: `CheckboxGroupRoot` (`modelValue`/`defaultValue`, `disabled`, `max`, `required`,
  `name`, **`rovingFocus` default `true`** with `orientation`/`loop`). Max-reached items get
  `aria-disabled` but stay focusable. One hidden input with the whole array for forms.
- Deviates from APG: roving focus makes the group one Tab stop by default.
- Problems: #1777 / #2013 (open: `required` on the group never blocks submission), #2652
  (docs example's labels not bound to the checkboxes).

### Bits UI

- Source: `packages/bits-ui/src/lib/bits/checkbox/{checkbox.svelte.ts,components/checkbox-group*.svelte}`.
- API: `Checkbox.Group` (`value`, `name`, `required`, `disabled`, `readonly`) + `Checkbox.GroupLabel`
  → `div role="group" aria-labelledby={labelId}`. Group `name` and `required` are pushed
  into every item — `required` on every item means **all** must be checked natively, the
  opposite of "at least one".
- Problems: #1613 (`onValueChange` fired twice), #1249 (group value not applied on first /
  server render), #1308 (docs example inert).

### Ariakit

- Source: `ariakit-react-components/src/checkbox/{checkbox-store.ts,checkbox.tsx}`.
- One `CheckboxStore` whose `value` may be a boolean, a string/number or an **array**; a
  `Checkbox value="x"` inside a provider with an array value toggles membership. No group
  role or label part (consumer renders `fieldset`/`legend`), no parent checkbox.

## Accessibility

- **Naming**: `role="group"` + `aria-labelledby` → Label part (a `span`/`div`, never
  `<label>`): Reka #2652, Ark #2895 and Base #4121 all come from a label/Field pointing
  `for` at one item. A consumer may render Root as `<fieldset>` and Label as `<legend>`;
  then the implicit `group` role and legend naming are used and connect emits neither
  `role` nor `aria-labelledby` (accessibility.md §1.4: only attributes the element lacks).
- **Announcements**: on entering the group, NVDA/JAWS and VO macOS speak the group name;
  **iOS VoiceOver does not announce groups** (AT note §J). No live region is needed: the
  focused checkbox's state change is spoken by the AT itself; the parent's state change is
  spoken because it has focus. Children changed by the parent are not announced (same as
  the APG example). Component renders no `aria-live` (rule 23).
- **Required**: no `aria-required` on the group. While `required` and empty, every
  enabled item carries `aria-required="true"` and its hidden input `required` (RA);
  as soon as one is checked, none does (unless an item is individually required, Base
  #4952). The group's Description and ErrorMessage reach each item through
  `aria-describedby` (RA), so the requirement is heard on the item that has focus.
- **Mixed**: `aria-checked="mixed"` on a `button role="checkbox"` is spoken as "mixed" /
  "half checked" by VO, NVDA and JAWS; RA #4004 (VO reading a native indeterminate input as
  unchecked) does not apply to rind-ui's button-based Control, but the hidden input still
  gets `.indeterminate` (Zag #3402) for consistency.
- **Keyboard**: each item a Tab stop, Space only (inherited from `checkbox`); no arrows,
  no roving (Base #1889, RA #5907; Reka's roving default is a deviation).
- **Forced colors / target size**: inherited from Checkbox's theme rules (indicator glyph
  in `currentColor`, the mixed dash a real glyph, 24×24 targets). The group adds nothing
  visual beyond spacing.
- **Native platform** (native-platform.md §14): no native group control exists;
  `<fieldset>` gives `group` + name and `fieldset[disabled]` disables every descendant
  control natively (handled by `button-like-element`'s fieldset tracking). Form
  participation stays per item (`hidden-form-input`): each checked item submits
  `name=value`, exactly as native checkboxes sharing a name. Reka's single hidden input
  carrying the whole array is not native-compatible and is not copied.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Aria | [#7749](https://github.com/adobe/react-spectrum/issues/7749), [#10643](https://github.com/adobe/react-spectrum/issues/10643) | `form.reset()` unchecks only one of several boxes | each item's reset handler wrote the group value from its own stale snapshot; last writer wins | fixed (#8316), then regressed | group handles reset once (one `RESET` event); items inside a group do not reset themselves |
| React Aria | [#6173](https://github.com/adobe/react-spectrum/issues/6173), [#5693](https://github.com/adobe/react-spectrum/issues/5693) | required error stays after checking a box | group validity not recomputed on item change | fixed | required/invalid derived from the current value every step |
| React Aria | [#5220](https://github.com/adobe/react-spectrum/issues/5220) | no way to build "select all" | not provided | open | ship the parent checkbox |
| React Aria | [#5907](https://github.com/adobe/react-spectrum/issues/5907) | users expect arrow keys like Radio Group | by design (APG) | closed | document: one Tab stop per item |
| React Aria | [#4004](https://github.com/adobe/react-spectrum/issues/4004) | VO reads an indeterminate checkbox as unchecked | native input `indeterminate` exposed inconsistently by WebKit | closed | button `aria-checked="mixed"` is the accessible state; still mirror `.indeterminate` |
| Base UI | [#4552](https://github.com/mui/base-ui/issues/4552) | controlled parent: after off → on cycle only one child gets checked | cycle memory kept in a ref updated only on uncontrolled child changes | fixed | the cycle memory is machine context written on every item change, controlled or not |
| Base UI | [#729](https://github.com/mui/base-ui/issues/729) | select-all checks disabled children too | parent wrote `allValues` blindly | fixed | select-all/none never changes disabled items |
| Base UI | [#4896](https://github.com/mui/base-ui/issues/4896) | parent sends `true` to group validation | parent ran as a standalone checkbox too | fixed | the parent has no value of its own: one `onValueChange(string[])` |
| Base UI | [#2691](https://github.com/mui/base-ui/issues/2691) | custom child `id` breaks parent's `aria-controls` | parent derived ids instead of reading rendered ones | fixed | `aria-controls` lists ids of rendered items only |
| Base UI | [#4121](https://github.com/mui/base-ui/issues/4121), [#1972](https://github.com/mui/base-ui/issues/1972) | all items share one id / one name inside Field | Field's control id/name pushed into every item | fixed | the group, not an item, is the labelled element; item ids stay unique |
| Base UI | [#1043](https://github.com/mui/base-ui/issues/1043) | group `disabled` not applied to items | no propagation | fixed | group disabled/readOnly win over item props |
| Base UI | [#4952](https://github.com/mui/base-ui/issues/4952) | two required items: one checked passes | group validity replaced item validity | fixed | item-level `required` keeps its own constraint |
| Base UI | [#5200](https://github.com/mui/base-ui/issues/5200) | invalid submit focuses the first (already checked) item | focus target chosen by group, not by failing input | fixed | focus goes to the first *invalid* item (native order) |
| Base UI | [#5208](https://github.com/mui/base-ui/issues/5208) | form value includes disabled / unmounted items | value from state, not from native submission | fixed | submission is native (per-item inputs); document that `value` may contain disabled items FormData omits |
| Base UI | [#1426](https://github.com/mui/base-ui/issues/1426) | no required group | — | open | `required` = at least one, encoded natively |
| Ark | [#2895](https://github.com/chakra-ui/ark/issues/2895) | in a Field, a click toggles only the first checkbox | every item received the Field's id; label `for` hit the first | fixed | unique item ids; group labelled by `aria-labelledby` |
| Ark | [#3759](https://github.com/chakra-ui/ark/issues/3759) | item `disabled` ignored inside group (Vue) | group props overwrote item props | fixed | disabled = group OR item |
| Reka | [#1777](https://github.com/unovue/reka-ui/issues/1777), [#2013](https://github.com/unovue/reka-ui/issues/2013) | required group submits with nothing checked | `required` on a hidden input with an array value never fails | open | required must reach a real checkbox input's validity |
| Reka | [#2652](https://github.com/unovue/reka-ui/issues/2652) | clicking an item's label doesn't toggle | labels not bound | closed (docs) | `control-label` per item; group label separate |
| Bits UI | [#1613](https://github.com/huntabyte/bits-ui/issues/1613) | `onValueChange` fires twice | value set, then callback, then setter echo | fixed | one `onValueChange` per user change (runtime controllable) |
| Bits UI | [#1249](https://github.com/huntabyte/bits-ui/issues/1249) | items unchecked on first / server render | item checked computed after mount | fixed | item checked derived from group value during render, SSR-identical |
| Bits UI | source (`checkbox.svelte.ts` `trueRequired`) | group `required` makes every item required → all must be checked | `required` copied to items unconditionally | — | `required` on items only while the group is empty |

## Known pitfalls

- **Reset races** (RA #7749/#10643): several items reacting to one `reset` event, each
  writing a derived array.
- **Shared ids / labels** (Ark #2895, Base #4121, Reka #2652): treating the group like a
  labelable control.
- **"Required" encoded wrong** (Reka #1777, Bits UI source, Base #1426): there is no native
  group-required; required-on-all means "all", a hidden array input never fails.
- **Select-all and disabled items** (Base #729) and **stale cycle memory** (Base #4552).
- **Double change callbacks** (Bits #1613) and **first-render mismatch** (Bits #1249).

## Testing notes

- The group machine runs headless; child checkbox machines are controlled by it, so model
  tests cover the group graph (parent cycle) and each item's own graph separately.
- Form reset and native validity (`checkValidity`, focus on invalid) need a real browser;
  jsdom implements `reset` and `required` for checkboxes, so both projects run them.
- Driver: `toggle(label)`, `toggleParent()`, `value()`, `parentState()`, `isDisabled()`,
  `isRequired()`; the group is located by role `group` + name.

## Decisions

- **Parts**: `Root` (`div role="group"`, `aria-labelledby` → Label, `aria-describedby` →
  Description/ErrorMessage while rendered), `Label` (`span`), `Description` (`p`),
  `ErrorMessage` (`p`, rendered by the consumer when invalid; not live), `Parent` (a
  Checkbox Root wired to the group: same Control/Indicator/Label children). Items are plain
  `Checkbox.Root value="…"` inside the group.
- **Machine** `checkbox-group`: controllable `value: string[]` (`value`/`defaultValue`/
  `onValueChange`, set equality). One state, `ready`: the value is an array, not bound to
  states, and the runtime turns a controlled write into a proposal, so a parent-cycle
  position kept in *states* would be lost in controlled mode (the Base #4552 class). The
  cycle lives in context instead — `cycle: "idle" | "all" | "none"` and `memory: string[]`
  (the last item-made selection) — written by actions on every change, controlled or not,
  and reset on `$reverted`. Events `ITEM.TOGGLE { value, checked }`, `PARENT.TOGGLE`,
  `ITEM.REGISTER / ITEM.UNREGISTER { value, id, disabled }`, `RESET`. Guards on context
  (`isPartial`, `allSelectableSelected`) give the model tests their branches.
  Composition: **sibling services wired by the adapter** (machine-runtime open question 2,
  option b) — each item and the Parent run a normal `checkbox` service in controlled mode;
  the group connect gives them `checked` and `onCheckedChange`.
- **`allValues`** prop: required to render `Parent` (server-correct parent state, Bits
  #1249); registration supplies ids (for `aria-controls`) and disabled state only.
- **Select-all semantics**: "all" = every enabled item + checked disabled ones; "none" =
  checked disabled ones only (Base). Parent shows checked iff every value in `allValues` is
  selected, unchecked iff none, else mixed — truthful even with disabled unchecked items.
- **Forms**: per-item hidden inputs (`hidden-form-input`), group `name`/`form` propagate,
  Parent never submitted; one group-level `RESET` from the form's `reset` event; items in a
  group do not reset themselves.
- **Required**: `required` = at least one; while empty every enabled item's input is
  `required` and Control `aria-required`; item-level `required` independent.
- **Disabled / readOnly**: group value wins (`group || item`).
- **`data-*`**: Root `data-disabled`, `data-readonly`, `data-required`, `data-invalid`;
  Parent adds `data-parent`; items add `data-value`; everything else from `checkbox`.
- **Contract**: locate `{ role: "group", name }`; actions `toggle(label)`,
  `toggleParent()`; queries `value()`, `parentState()`, `isDisabled()`, `isRequired()`,
  `isInvalid()`; traits `form-associated`.
- **Deliberately different**: parent cycle as machine context written on every change
  (controlled too) instead of a ref updated only by uncontrolled changes; one reset per group; required encoded natively instead of a fake array input; no
  roving focus (Reka) and no `max` in v1 (Ark/Reka have it — Open questions).

## Open questions

- `max` / `min` selections (Ark `maxSelectedValues`, Reka `max` with `aria-disabled`): add
  when a consumer needs it; it is a guard on `ITEM.TOGGLE` plus `aria-disabled`.
- Should the group label be folded into each item's description on iOS, where VO does not
  announce groups? Needs a device test first.
- Validation display timing (on blur / on submit) belongs to the future Field change.
