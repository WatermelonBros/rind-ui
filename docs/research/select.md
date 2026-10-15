# Select — research

Status: done · Wave: 1 (used by Reado: `atoms/Select.tsx`, about twenty screens)

Covers the select-only combobox: a trigger that shows the value and opens a listbox popup
to pick one or several options. The popup's list, options, sections and selection are
the listbox parts of [listbox.md](listbox.md); keys, navigation, typeahead and the
virtualization contract are [collections.md](collections.md); layering, dismissal, focus
restore, inert and scroll lock are [overlay-infrastructure.md](overlay-infrastructure.md);
placement is [floating-positioning.md](floating-positioning.md) (preset `dropdown`); the
hidden form input is `hidden-form-input` of `add-checkbox` ([checkbox.md](checkbox.md)).
This note covers what is Select-specific: the trigger, opening and initial focus,
closed-trigger keys, value text, closing rules, form participation, item-aligned
placement and touch.

Sources: shallow clones read 2026-10-14 (paths repo-relative; React Aria via
`git show HEAD:`): `zag/packages/machines/select/src/{select.machine,select.connect}.ts`;
`react-spectrum/packages/react-aria/src/select/{useSelect.ts,HiddenSelect.tsx}`,
`react-aria/src/menu/useMenuTrigger.ts`, `react-aria-components/src/Select.tsx`;
`radix/packages/react/select/src/select.tsx`;
`base-ui/packages/react/src/select/{root/SelectRoot,trigger/SelectTrigger,positioner/SelectPositioner,popup/SelectPopup}.tsx`;
`headlessui/packages/@headlessui-react/src/components/listbox/listbox.tsx`,
`internal/form-fields.tsx`; `ariakit/packages/ariakit-react-components/src/select/select.tsx`;
`kobalte/packages/core/src/select/*`; `reka-ui/packages/core/src/Select/*`;
`bits-ui/packages/bits-ui/src/lib/bits/select/*`. Reado (read-only):
`src/components/atoms/Select.tsx`, `atoms/__tests__/Select.uitest.tsx`,
`organisms/__tests__/SettingsControls.uitest.tsx`, `organisms/settings/{fields,AppearanceTab}.tsx`.
Bug history: `gh search issues` over the ten trackers, terms `select touch`, `select
pointerdown`, `select typeahead`, `select item-aligned`, `alignItemWithTrigger`, `hidden
select`, `BubbleSelect`, `HiddenSelect`, `select autofill`, `select form reset`, `select
required`, `select jsdom`, `select testing library`, `select voiceover`, `select
placeholder`, `select multiple`, `select dialog`, `select label`; every row read with
`gh issue view`.

## Pattern

- WAI-ARIA APG: [Select-Only Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)
  (Combobox pattern) with a [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
  popup.
- Roles and attributes: trigger `role="combobox"` (its value is its text content; name
  from a label — combobox does not take its name from content), `aria-expanded`,
  `aria-controls` → listbox (only while it exists), implicit `aria-haspopup="listbox"`;
  popup `role="listbox"` named like the trigger; options per the Listbox pattern;
  `aria-required`, `aria-invalid` on the combobox.
- Keyboard (APG, closed): Down / Up / Enter / Space / Alt+Down open (Up to the last option
  is optional); Home / End open to first / last; printable characters "open and move to
  the first match". Open: Down / Up move; Enter selects and closes; Escape closes; Tab
  "selects and closes"; Alt+Up selects and closes. The APG example keeps DOM focus on the
  combobox and uses `aria-activedescendant`.
- Native counterpart: `<select>`. Desktop natives disagree on closed keys: Windows
  changes the value with arrows and typeahead without opening; macOS opens on arrows and
  selects on typeahead; native selects open on mouse *down*.

## How the others built it

### Zag / Ark UI

- Source: `select.machine.ts` (792 lines), `select.connect.ts`.
- API shape: `Root`, `Label`, `Control`, `Trigger`, `ValueText`, `Indicator`,
  `ClearTrigger`, `Positioner`, `Content`, `List`, `Item`, `ItemText`, `ItemIndicator`,
  `ItemGroup`, `ItemGroupLabel`, `HiddenSelect` (explicit part). `collection` prop
  (`createListCollection`), `multiple`, `closeOnSelect` (`!multiple`), `loopFocus`
  (false), `composite`, `positioning` (bottom-start).
- State model: `idle | focused | open`; trigger `role="combobox"` named by
  `aria-labelledby` → label id (always, even when no label is rendered); content keeps
  focus with `aria-activedescendant`; closed trigger: ArrowLeft/Right select prev/next,
  Home/End select first/last, typeahead selects — single only; opens on `click`.
- Notable: `selectedItemMap` keeps labels of values that left the collection; the label's
  `htmlFor` points at the hidden select; the hidden select is `aria-hidden`, `tabIndex=-1`,
  forwards focus to the trigger and listens to `input`/`change` for autofill (zag#2956).
- Problems: activedescendant (VO silent); the hidden select renders every option, so
  virtualized selects still render all of them (ark#3021); `toString()` change detection;
  label → hidden select means `getByLabelText` finds the hidden control.

### React Aria / React Aria Components (Kobalte is a port)

- Source: `useSelect.ts`, `HiddenSelect.tsx`, `useMenuTrigger.ts`, `Select.tsx`.
- API shape: `Select` with `Label`, `Button` + `SelectValue`, `Popover` > `ListBox`,
  `Text slot="description|errorMessage"`, `FieldError`; `selectionMode` (multiple added
  late), `isRequired`, `validationBehavior: "aria" | "native"`, `autoComplete`, `name`.
- State model: `useSelectState` over `useListState`; the trigger is a plain button
  (`aria-haspopup="listbox"`) named by `aria-labelledby = [valueId, labelId]`, so its
  name is "Italy Country" and changes with the value; listbox with real focus on options
  (roving), `shouldFocusOnHover`, `shouldSelectOnPressUp`, `disallowEmptySelection`;
  opens on press **start** for mouse and keyboard, press **end** for touch
  (`useMenuTrigger.ts:125–140`, "for consistency with native"); closed ArrowLeft/Right
  and typeahead select (single only); label is a `span` whose click focuses the trigger
  with keyboard modality.
- `HiddenSelect`: a visually hidden, `aria-hidden` container with a `<label>` and a
  `<select>` containing an empty option plus every item's `textValue`; above 300 items an
  `<input type="hidden">` (or `type="text"` with `display:none` for native validation)
  instead. Comment: Safari autofill needs a non-`display:none` select; Firefox needs a
  `<label>`.
- Problems: the 300-item switch broke `required` and reset (rsp#8034, rsp#10642); the
  hidden `<label>` gives `getByLabelText` two matches; value-dependent trigger name.

### Radix (Reka UI is a port; Bits UI follows the API)

- Source: `select.tsx` (2,094 lines); `reka-ui/.../Select/*`; `bits-ui/.../select/*`.
- API shape: `Root`, `Trigger`, `Value`, `Icon`, `Portal`, `Content` (`position:
  "item-aligned"` **default** | `"popper"`), `Viewport`, `Item`, `ItemText`,
  `ItemIndicator`, `ScrollUpButton`, `ScrollDownButton`, `Group`, `Label`, `Separator`,
  `Arrow`; a `BubbleSelect` rendered when inside a form.
- State model: trigger `role="combobox"` button; opens on `pointerdown` for mouse (with
  `preventDefault` so focus stays) and on `click` for touch/pen (PR #2939 after
  radix#1641/#1658); typeahead on the trigger selects; content focuses the selected item;
  `aria-selected = isSelected && isFocused` "fixes stuttering in VoiceOver" (contested,
  radix#1907); `SelectItemAlignedPosition` positions the content so the selected item's
  text overlays the trigger's value text, with scroll buttons and a fallback popper mode.
- Problems: native `<option>`s require every item mounted while closed (radix#2602,
  reka#1985); item-aligned edge cases (radix#1663, #3686, #2440); the bubble select's
  change events (radix#4102) and reset (radix#3089); `id` and label split between trigger
  and bubble select (radix#3294); Bits UI's trigger lacks `role=combobox` (bits#2134).

### Base UI

- Source: `SelectRoot.tsx`, `SelectTrigger.tsx`, `SelectPositioner.tsx`, `SelectPopup.tsx`.
- API shape: `Root`, `Label`, `Trigger`, `Value`, `Icon`, `Portal`, `Backdrop`,
  `Positioner` (`alignItemWithTrigger`, default `true`), `Popup`, `List`, `Item`,
  `ItemText`, `ItemIndicator`, `Group`, `GroupLabel`, `ScrollUpArrow`,
  `ScrollDownArrow`, `Arrow`, `Separator`; `modal` (true), `isItemEqualToValue`.
- State model: trigger `role="combobox"`; opens on mousedown and supports
  press-drag-release (the mouseup handler cancels when released outside); real focus on
  items; `alignItemWithTrigger` only for mouse (`openMethod !== "touch"`), with its own
  scroll lock and anchor-tracking off.
- Form participation **without a hidden `<select>`**: one visually hidden `<input>`
  (`aria-hidden`, `tabIndex=-1`, `value` = serialized value, `required`, `autoComplete`,
  focus forwarded to the trigger) plus one `<input type="hidden">` per value in multiple
  mode. Autofill writes text into the input; `onChange` matches it against serialized
  values, then labels, then rendered labels (`SelectRoot.tsx:500–560`).
- Problems: item-aligned bugs at zoom and with `max-height` (base-ui#4290, #3396),
  scroll arrows (#2517, #2518), closed-trigger typeahead picks disabled items
  (base-ui#5776, open), controlled value reset to `null` when items unregister (#5875).

### Headless UI

- Source: `listbox.tsx`, `listbox-machine.ts`, `internal/form-fields.tsx`.
- API shape: `Listbox` (the select), `ListboxButton` (`aria-haspopup="listbox"`),
  `ListboxOptions` (`anchor`, `anchor="selection"` = item-aligned via Floating UI
  `inner`, `portal`, `modal` default true → scroll lock + inert others), `ListboxOption`,
  `ListboxSelectedOption`; `by` for value equality; `name` → `<input type="hidden">`
  fields (objects flattened to `name[key]`, arrays to `name[0]`, hui#3751).
- State model: options element focused with `aria-activedescendant`; quick release
  (open on press, select on release) — reworked several times for touch (hui#3750,
  #3757, #3765) and changing the opening event broke consumers' tests (hui#3703).

### Ariakit

- Source: `select/select.tsx` and siblings.
- API shape: `SelectProvider`, `Select` (`role="combobox"`, `aria-autocomplete="none"`),
  `SelectPopover`/`SelectList`, `SelectItem`, `SelectGroup`, `SelectLabel`,
  `SelectValue`, `SelectArrow`; `showOnKeyDown`, `moveOnKeyDown`, `toggleOnClick`.
- Notable: a visually hidden native `<select>` only when `name` is set, `aria-hidden`,
  focus forwarded (password managers move focus to it), `onChange` → value and a
  `data-autofill` flag on the trigger until the next non-autofill change. Option text is
  the value, not the label.
- Problems: auto-selects the first async item when no default (ariakit#2516).

### Reado (consumer)

- `atoms/Select.tsx`: Ark `Select` with `createListCollection` rebuilt every render,
  single value wrapped in an array, `""` as a real value ("built-in"/"auto" options,
  guarded by length, not truthiness), a colour dot in trigger and items,
  `positioning={{ gutter: 4, placement: "bottom-start", sameWidth: true }}`, a `Portal`,
  no `HiddenSelect`, `aria-label` optional.
- Tests (testing.md "Reado"): `SettingsControls.uitest.tsx` locates triggers with
  `querySelectorAll('[data-scope="select"][data-part="trigger"]')` and a text filter, its
  comment blaming "the hidden native `<select>` it renders alongside". **Verified wrong
  for Reado:** the atom renders no `HiddenSelect`. The real cause is naming: most
  triggers have no `aria-label` and sit inside a `<label>` that wraps the label text *and*
  the trigger, so the computed name mixes label and value and an exact-name lookup is
  unstable. The theme-mode select (`AppearanceTab.tsx`, no `ariaLabel`, wrapped by
  `Field`'s `<label>`) "won't open under happy-dom"; root cause not reproduced here (we
  ran nothing). The likely mechanism is radix#3679's: a label re-dispatching the click to
  the trigger, which toggles twice in a DOM that does not implement the "activation
  target is the labeled control" rule. Spec response: the trigger opens exactly once per
  click inside a consumer label in browser, jsdom and happy-dom, and the driver suite runs
  in happy-dom.
- **ark#3792** is not a hidden-select bug: it is "RadioGroup: individual radio options
  are not testable with Playwright" (hidden radio input without a name). testing.md cites
  it next to "the hidden select"; do not cite it for Select.

## Accessibility

Applies [accessibility.md](accessibility.md) §2, §4.2, §4.3, §5, §6 and rules 1–24,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, B, H, I,
J and the "Select" paragraph of §1.4, and everything in [listbox.md](listbox.md)
Accessibility for the popup. Select-specific:

- **Trigger role `combobox`, named by the label only.** Name stays the same when the value
  changes (value is the combobox's content), which is what role+name location needs and
  what Reado's tests already query. RA's button named "value label" changes name with
  every selection. Bits UI's missing role (bits#2134) is a bug report.
- **Focus strategy: roving into the popup** (collections, accessibility §4.2): no text
  field, so no activedescendant and no Apple announcer (Zag/HUI activedescendant is
  cause B; hui#3838 shows activedescendant on the wrong element).
- **List name**: from the label; never `aria-labelledby` → the trigger, because a
  referenced combobox contributes its *value* to the name (accname "embedded control").
  Modal inert must not cut the label off: Chromium drops `aria-labelledby` into inert
  subtrees (RA#9737), so the label and trigger stay in the layer's elements.
- **Value text in Safari** (cause H): VO reads a cached value after a change (ZG#3099,
  RX#3671); replace the text node on every value change.
- **Virtual / touch SR** (causes A, J): VO+Space is a bare click → open on `click`;
  iOS VO taps are not outside presses (RX#1343, handled by dismissable-layer).
- **Required / invalid**: `aria-required` on the combobox (RA#8607, ZG#2785 were not
  announced), `aria-invalid`, description via `aria-describedby`.
- **No hidden duplicate**: nothing rendered by the component duplicates the trigger's
  role, name, the label's text or option text (the hidden input is `aria-hidden`, has no
  label and no options).
- **Closed typeahead** changes the value without opening; the combobox's content change
  is read by NVDA/JAWS on a focused combobox; VO behaviour is in the manual protocol.
- **Touch** (2.5.2 Pointer Cancellation, rule 15): open on release, select on release,
  scroll never opens or selects (RX#1641, RX#1658).
- **Target size** ≥ 24 × 24 for trigger and options; **forced colors**: trigger border and
  focus as `outline`, selected via the indicator.
- **Native platform** (native-platform.md §7, §14): customizable `<select>` is avoided
  (Firefox flag only, no virtualization, no rich value); form participation uses a
  hidden `<input>` — this note **narrows native-platform §7's "hidden native `<select>`
  for form value + autofill"**: autofill is kept through value/text matching on an
  `<input>` (Base UI), which avoids every duplicate-text and duplicate-label problem in
  the Bug history.

## Bug history

Method above; 68 Select rows, every one read with `gh issue view`; raw results in the
session scratchpad. Rows already in [collections.md](collections.md) (RX#2602, ARK#3021,
ZG#1947, BU#3818, RA#3910, RX#2440, ZG#3255/#3273, BU#5776) are only repeated where a
Select scenario cites them.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [radix#1641 (closed)](https://github.com/radix-ui/primitives/issues/1641) | Mobile: starting a page scroll with the finger on the trigger opens the Select | Trigger opened on `pointerdown` for every pointer type | Fixed in PR #2939 ("Fix touch devices bugs"): touch opens on click | Open on `pointerdown` only for `pointerType==="mouse"`. Touch and pen open on `click`. |
| Radix | [radix#1658 (closed)](https://github.com/radix-ui/primitives/issues/1658) | Tapping an option also clicks/taps the element positioned behind the list (Android, Chrome emulation) | Item selected and content unmounted on `pointerup`, so the browser's compatibility click lands on whatever is underneath. A remaining Shadow DOM case comes from `content.contains(event.target)` failing on retargeted events | PR #2939 (touch items select on `click`). 106 comments, Shadow DOM case still reported | Commit touch selection on `click`, not `pointerup`. Use `event.composedPath()` for containment checks. |
| Radix | [radix#1770 (open)](https://github.com/radix-ui/primitives/issues/1770) | Firefox Android: an option needs two taps, and press-drag-release does not work | Firefox touch/pointer event ordering differs (not diagnosed) | Open | Run touch tests in Firefox Android too. Gecko event order differs from Chromium/WebKit. |
| Radix | [radix#2634 (open)](https://github.com/radix-ui/primitives/issues/2634) | Select closes as soon as the on-screen keyboard appears (input inside content) | Viewport resize/blur from the virtual keyboard is treated as a dismiss | Open (workaround borrowed from ariakit#3274) | Do not close on viewport resize. Keyboard-driven `visualViewport` changes are not a dismissal. |
| Radix | [radix#1343 (open)](https://github.com/radix-ui/primitives/issues/1343) | With iOS VoiceOver (touch), the Select closes immediately after opening | VO's synthesized pointer events land "outside" the content and trigger pointer-down-outside dismissal (workaround: `preventDefault` in `onPointerDownOutside`) | Open | Test with touch screen readers. Virtual clicks may come with odd or missing coordinates and targets. |
| Radix | [radix#3679 (open)](https://github.com/radix-ui/primitives/issues/3679) | Inside a `<label>` on mobile, the list stays open after picking an option | The label's activation behavior re-dispatches a click to the trigger, which reopens or toggles it | Open | Labels forward clicks. Ignore label-forwarded clicks, or make the label focus the trigger only. |
| Radix | [radix#1822 (closed)](https://github.com/radix-ui/primitives/issues/1822) | Cannot open Select in Jest/Vitest + Testing Library; `target.hasPointerCapture is not a function` | Opening relies on pointer events and pointer-capture/`scrollIntoView` APIs that jsdom lacks | Closed with no lib fix. Users polyfill `hasPointerCapture`/`scrollIntoView` or drive the hidden `<select>` | Feature-detect optional DOM APIs. Keep a keyboard/click open path that works in jsdom. Document test recipes. |
| Radix | [radix#2706 (closed)](https://github.com/radix-ui/primitives/issues/2706) | Users can no longer clear an optional Select (v2 forbids `value=""` items) | #2174 reserved `""` to mean "no value / show placeholder" and threw on empty item values | Fixed by PR #3960 (allow empty item value to clear) | Decide early how "no value" (`null` / `""` / `undefined`) is represented, and support a clear path. |
| Radix | [radix#2817 (open)](https://github.com/radix-ui/primitives/issues/2817) | A controlled value set before its async options arrive does not show and gets lost | Value text is derived from mounted items. A value with no matching item is dropped | Open | Keep the controlled value even when no item matches. Value text needs a fallback (`itemToString`/lookup). |
| Radix | [radix#3089 (closed)](https://github.com/radix-ui/primitives/issues/3089) | `form.reset()` resets the hidden native select, but the component keeps the old value | No listener for the form's `reset` event | Fixed in PR #3958 (listen to form reset for all form controls) | Subscribe to `form` `reset` and restore `defaultValue`. |
| Radix | [radix#4102 (closed)](https://github.com/radix-ui/primitives/issues/4102) | Hidden bubble `<select>` dispatches a bubbling `change` on programmatic/controlled value updates, and can trigger `onValueChange("")` when the new item is not mounted (#3135) | `usePrevious` diffing cannot tell user changes from programmatic ones | Closed. PR #4104 proposed porting the `userInteractionCount` pattern from #4028 | Dispatch native `change` only for user-initiated changes. |
| Radix | [radix#3294 (open)](https://github.com/radix-ui/primitives/issues/3294) | `id` on Trigger is not passed to the hidden select, so `<label for>` association breaks and required forms submit empty | Two elements (trigger and hidden select) compete for the label/id | Open | Decide which element owns the `id` and the label. The label should point at the focusable trigger. |
| Radix | [radix#2417 (open)](https://github.com/radix-ui/primitives/issues/2417) | Select ignores `<fieldset disabled>` | Disabled state is read only from props | Open (PR #3174 proposed) | Derive disabled from `trigger.matches(':disabled')` (the trigger is a `<button>`) as well as props. |
| Radix | [radix#3875 (open)](https://github.com/radix-ui/primitives/issues/3875) | Hidden native `<select>` makes the document scroll or grow in constrained `100dvh` layouts | Absolutely positioned hidden select escapes to a far offset parent | Open | Pin the hidden control inside the root (`position:absolute` in a `relative` root, or clip it). See bits#1987 and ark#2741. |
| Radix | [radix#1663 (closed)](https://github.com/radix-ui/primitives/issues/1663) | When every item is disabled, the content opens at the bottom of the document or off-screen | Item-aligned mode aligns to the selected or first enabled item. With none, there is no anchor | Fixed in PR #3973 (align content when all items disabled) | Item-aligned positioning needs a fallback when no anchor item exists. |
| Radix | [radix#3686 (open)](https://github.com/radix-ui/primitives/issues/3686) | With ScrollUp/Down buttons, scrolling to the start or end snaps back to the selected item | Mounting or unmounting a scroll button resizes the viewport and re-runs selected-item positioning | Open | Run "scroll selected into view" once per open, not on every layout change. |
| Radix | [radix#2440 (open)](https://github.com/radix-ui/primitives/issues/2440) | Appending items while open (infinite scroll) jumps the list back to the top | Item-aligned layout re-runs when the collection changes | Open | Keep `scrollTop` when the collection changes while the list is open. |
| Radix | [radix#2369 (open)](https://github.com/radix-ui/primitives/issues/2369) | Select in a sticky header scrolls the page on open or close | Focusing the trigger or content without `preventScroll` | Open | Always `focus({ preventScroll: true })` and scroll the list yourself. |
| Radix | [radix#4097 (closed)](https://github.com/radix-ui/primitives/issues/4097) | Typeahead silently broken in production builds (Next 16/SWC) | The build added `/* @__PURE__ */` to a side-effect-only IIFE in typeahead, and the minifier deleted it | Fixed in PR #4106 (hoist IIFEs to functions) | Test the published, minified bundle. Never rely on side-effect IIFEs. |
| Radix | [radix#3962 (open)](https://github.com/radix-ui/primitives/issues/3962) (+ [#4110 open](https://github.com/radix-ui/primitives/issues/4110)) | VoiceOver/Chrome announces wrong counts ("1 of 3"). With no selection, the first option announces no position | `aria-posinset`/`setsize` computed late (layout effect + state). An empty-value item acts as a placeholder | Open (PR #4112 proposed) | Set `aria-setsize`/`posinset` synchronously and correctly. Do not render a placeholder as a real option. |
| Base UI | [base-ui#4290 (closed)](https://github.com/mui/base-ui/issues/4290) | `alignItemWithTrigger` sometimes falls back to below-trigger at 90% or 110% browser zoom | Fractional-pixel rounding in the fit check | Fixed in PR #4292 | Use epsilon tolerances in item-aligned fit checks. Test at non-100% zoom. |
| Base UI | [base-ui#3396 (closed)](https://github.com/mui/base-ui/issues/3396) | `alignItemWithTrigger` with a popup `max-height` looks like the popup scrolls away from the trigger | Item-aligned growth and inner scroll interact badly | Fixed in PR #3573 | Item-aligned mode must own height and inner scroll. Document how it interacts with user `max-height`. |
| Base UI | [base-ui#2517 (closed)](https://github.com/mui/base-ui/issues/2517) | Hovering the scroll-down arrow moves the whole popup to the top of the screen | Item-aligned popup grows toward the viewport edge while "scrolling". Arrows were missing in non-aligned mode (#2516) | Closed in favour of #2516 (arrows in popper mode) | Scroll arrows should scroll content, not resize the popup. Support them in both positioning modes. |
| Base UI | [base-ui#2518 (closed)](https://github.com/mui/base-ui/issues/2518) | ScrollUpArrow stops before the top when a GroupLabel is the first child | Scroll target computed from the first item, not the top of the list | Fixed in PR #2523 (sticky arrows) | Scroll arrows scroll to `scrollTop=0`, not to the first item. Use sticky arrows to avoid layout shift. |
| Base UI | [base-ui#5633 (closed, not planned)](https://github.com/mui/base-ui/issues/5633) | ArrowDown on a focused closed select opens it instead of changing the value (Windows native behavior) | Deliberate: follows the APG select-only combobox pattern and macOS | Not planned | Decide and document closed-trigger arrow behavior. Platforms disagree. |
| Base UI | [base-ui#5776 (open)](https://github.com/mui/base-ui/issues/5776) | Typing on a closed trigger selects a disabled item and fires `onValueChange` | Closed-trigger typeahead does not skip disabled items | Open | Typeahead (open and closed) must skip disabled items. See ark#3601. |
| Base UI | [base-ui#5875 (open)](https://github.com/mui/base-ui/issues/5875) | Controlled value reset to `null` (`reason:"none"`) when one update removes the old item and sets a new valid value | Item-unregistration handler resets the value before the new value is reconciled | Open | Never auto-mutate a controlled value when items unregister. |
| Base UI | [base-ui#5472 (open)](https://github.com/mui/base-ui/issues/5472) | VoiceOver announces "completion selected" on every item (Chrome) and "(null)" (Safari) | Not diagnosed (role/state mapping of `combobox` + `listbox`) | Open | Run screen-reader tests per browser. VoiceOver differs between Chrome and Safari. |
| Base UI | [base-ui#3725 (closed)](https://github.com/mui/base-ui/issues/3725) | Select inside a Radix-based (shadcn) Drawer is unresponsive | The other library's modal sets `body { pointer-events:none }`, and the portalled popup inherits it | Closed (stale). Answer: interop issue | Set `pointer-events:auto` on portalled popups. Do not depend on other libraries' modality. |
| Ark/Zag | [ark#3601 (closed)](https://github.com/chakra-ui/ark/issues/3601) | Typeahead can select disabled items | Typeahead match ignored the disabled state | Fixed in zag commit 4790d22 | Filter disabled items in typeahead. |
| Ark/Zag | [zag#2956 (closed)](https://github.com/chakra-ui/zag/issues/2956) (from [ark#3779](https://github.com/chakra-ui/ark/issues/3779)) | Chrome address autofill sets the hidden select, but ValueText does not update | Machine did not listen to the hidden select. Setting `el.value` from code fires no event (React Hook Form does this) | Fixed in zag 1.34.0 (listen to `change`/`input` on the hidden select) | Sync from hidden-select `input`/`change` events. Document that setting `.value` from code fires no event. |
| Ark/Zag | [zag#3099 (closed, not planned)](https://github.com/chakra-ui/zag/issues/3099) | Safari VoiceOver announces the placeholder or previous value after selecting | Safari caches the value span's text when focus returns. Remounting it (`key={valueAsString}`) works | Auto-closed | Update value text before returning focus. Remounting the text node may be needed for Safari. |
| Ark/Zag | [zag#2682 (closed)](https://github.com/chakra-ui/zag/issues/2682) | Testing Library `selectOptions()` and `toHaveValue()` do not work on the select | Options are not descendants of the `role=combobox` button, and the button has no `value` | Closed | Ship test helpers or document using the hidden select. Expect test-API mismatch. |
| Ark | [ark#3653 (closed)](https://github.com/chakra-ui/ark/issues/3653) | HiddenSelect submits nothing when items are objects (Svelte) | Object items were not serialized to an option value | Fixed (commit, released in patch) | Serialize object values through `itemToValue` (a string) for native forms. |
| Ark | [ark#3728 (closed, not planned)](https://github.com/chakra-ui/ark/issues/3728) | A portalled Select.Positioner inside a Dialog gets `aria-hidden="true"`, so screen readers cannot see the list | Pre-mounted portal content exists when the dialog hides its outside siblings | Workaround: `lazyMount` | Coordinate portals with the aria-hide stack. Register popups as part of their parent layer. |
| Ark | [ark#3473 (closed, not planned)](https://github.com/chakra-ui/ark/issues/3473) | Select in a Popover: tapping an item closes the Popover on touch devices (and in Playwright) | Mouse dismisses on `pointerdown` outside. Touch dismisses on `click`/`touchend` outside, after the Select has unmounted | Not planned | Nested layers need consistent dismissal timing across pointer types. |
| Ark | [ark#3146 (closed)](https://github.com/chakra-ui/ark/issues/3146) | In Shadow DOM, clicking the trigger while open closes and reopens it | `target`/`currentTarget` are retargeted to the host, so the "is trigger" check fails | Closed | Use `composedPath()` for trigger and outside checks. See kobalte#445 (fixed in PR #722). |
| Ark | [ark#3021 (closed)](https://github.com/chakra-ui/ark/issues/3021) | Virtualized Select still renders every `<option>` in the hidden native select | Hidden select mirrors the whole collection | Closed (fixed) | The hidden native select can defeat virtualization. Render only the selected `<option>`s. |
| React Aria | [rsp#1634 (closed)](https://github.com/adobe/react-spectrum/issues/1634) | Picker in a `<form>` submits the first option when nothing is selected | Hidden `<select>` had no empty option, so the browser auto-selects the first | Fixed in PR #1657 | Give the hidden select an empty option. |
| React Aria | [rsp#8034 (closed)](https://github.com/adobe/react-spectrum/issues/8034) | Required Select with >300 options still submits null | Above 300 items HiddenSelect falls back to `<input type=hidden>`, which ignores `required` | Fixed in PR #8280 | Every hidden-control fallback path must keep `required` validation working. |
| React Aria | [rsp#10642 (closed)](https://github.com/adobe/react-spectrum/issues/10642) | Select with >300 items and no `name` does not reset on `form.reset()` | Hidden control rendered only under some conditions (`name` / size) | Fixed in PR #10695 | Render the form-mirror control the same way in every case. See rsp#3917 (null value warning in the >300 path, PR #3928). |
| React Aria | [rsp#7660 (closed)](https://github.com/adobe/react-spectrum/issues/7660) | Browser autofill does not update Select | `onChange` of the hidden select read a stale `e.target.value` through `useEffectEvent` | Fixed in PR #7670 | Test autofill for real. It exercises the hidden select's `onChange` path. |
| React Aria | [rsp#8511 (closed)](https://github.com/adobe/react-spectrum/issues/8511) | `new FormData(form)` in a mount effect misses `defaultSelectedKey` (CSR only) | Hidden select value is applied after the first client render | Fixed in PR #9466 | The hidden control must have its value on the first render. |
| React Aria | [rsp#9031 (open)](https://github.com/adobe/react-spectrum/issues/9031) | Searchable Select does not scroll to the selected item on open | scrollIntoView runs before overlay positioning, or against the wrong scroll container | Open | Scroll the selected item into view after positioning, inside the right scroller. |
| React Aria | [rsp#8722 (open)](https://github.com/adobe/react-spectrum/issues/8722) | Virtualized Select with many items is slow to mount and slows the containing Dialog | Collection is built from children synchronously, even while closed | Open (`deferCollectionRendering` proposed) | Do not build or render the full collection while closed. |
| React Aria | [rsp#1432 (closed)](https://github.com/adobe/react-spectrum/issues/1432) (cf. [radix#2673](https://github.com/radix-ui/primitives/issues/2673)) | Users expect the native iOS picker on tap | By design: custom listbox, no native fallback | Closed as by-design in both libraries | Document a "native select on mobile" recipe. |
| Headless UI | [hui#3750 (closed)](https://github.com/tailwindlabs/headlessui/issues/3750) | Android Chrome: a slightly slow tap (>100 ms) opens and then immediately closes the Listbox | Quick-release logic (open on press, select on release) treated the touch release as a selection or close | Fixed in PR #3755. A desktop slow-click regression was reported afterwards | Press-drag-release must be mouse-only and gated by time and distance. |
| Headless UI | [hui#3757 (closed)](https://github.com/tailwindlabs/headlessui/issues/3757) | Touch scrolling that starts on the button opens the Listbox | Opened on press for touch | Fixed by PR #3755 | Same as radix#1641: touch opens on click. |
| Headless UI | [hui#3703 (closed)](https://github.com/tailwindlabs/headlessui/issues/3703) | Moving open to mousedown/pointerdown broke 800+ unit tests that used `fireEvent.click` | The event that opens the menu changed in a patch release | Closed | The opening event is public API. Changing it breaks consumers' tests. |
| Headless UI | [hui#3765 (closed)](https://github.com/tailwindlabs/headlessui/issues/3765) | `multiple` Listbox closes immediately on selecting an option (2.2.6) | Quick-release select path ignored `multiple` | Fixed in PR #3766 | Multi-select must never close on item activation. Cover it in regression tests. |
| Headless UI | [hui#3751 (open)](https://github.com/tailwindlabs/headlessui/issues/3751) | `multiple` value submits as `name[0]`, `name[1]` instead of a repeated `name` | `objectToFormEntries` indexes arrays | Open | Submit multi values as repeated same-name entries, like native `<select multiple>`. |
| Reka | [reka#2292 (open)](https://github.com/unovue/reka-ui/issues/2292) | Typing on the closed trigger does not change the selection (native `<select>` does) | Typeahead is only wired up while open | Open | Decide on closed-trigger typeahead, and skip disabled items when doing it. |
| Reka | [reka#1872 (open)](https://github.com/unovue/reka-ui/issues/1872) | `multiple` + `required`: the form says "select an item" when more than one is selected | Native `<select multiple>` mirror is not synced correctly (Vue v-model on select) | Open | Test native constraint validation with 0, 1 and N values. |
| Reka | [reka#2954 (closed)](https://github.com/unovue/reka-ui/issues/2954) / [bits#2049 (open)](https://github.com/huntabyte/bits-ui/issues/2049) | Multiple select: Space toggles unreliably and needs 2+ presses | Space handled twice: by selection and by typeahead (toggle on, then off) | reka fixed in PR #2955 (exclude Space from typeahead). bits open | Space is a typeahead character only mid-search. Handle each key once. |
| Reka | [reka#1985 (open)](https://github.com/unovue/reka-ui/issues/1985) | Select is slow because closed SelectContent still renders all items into a fragment | Needed to populate the native `<option>`s | Open (opt-out proposed) | Do not render the whole list just to fill the native mirror. |
| Reka | [reka#2572 (closed)](https://github.com/unovue/reka-ui/issues/2572) | BubbleSelect renders inside a form even without `name`, unlike other controls | Inconsistent render condition | Closed | Use one rule, the same for all controls, for when the hidden form control renders. |
| Bits UI | [bits#2134 (open)](https://github.com/huntabyte/bits-ui/issues/2134) | Trigger has no `role="combobox"` or `aria-controls` | Trigger rendered as a plain button | Open (PR pending) | Select-only combobox: `role=combobox` + `aria-controls` (only while the listbox is mounted) + `aria-expanded`. |
| Bits UI | [bits#2173 (open)](https://github.com/huntabyte/bits-ui/issues/2173) | Unselected options have no `aria-selected`, so no selection state is announced | Only the selected option gets `aria-selected="true"` | Open | Set `aria-selected="false"` explicitly on selectable unselected options (APG). |
| Bits UI | [bits#1923 (open)](https://github.com/huntabyte/bits-ui/issues/1923) | An item chosen by typeahead is scrolled under the ScrollDown button | scrollIntoView ignores the overlaying scroll buttons | Open | Scroll padding must account for scroll buttons. |
| Bits UI | [bits#1712 (closed)](https://github.com/huntabyte/bits-ui/issues/1712) | Selected item scrolled into view on reopen only in Chrome | Browser-dependent scroll timing | Fixed in PR #1765 | Scroll the selected item into view explicitly after mount. Do not rely on focus scrolling. |
| Bits UI | [bits#1807 (closed)](https://github.com/huntabyte/bits-ui/issues/1807) | `required` has no effect without `name` | Hidden input only rendered when `name` is set | Docs updated (PR #1891) | Validation should not depend on `name` (see rsp#10642). |
| Bits UI | [bits#1987 (closed)](https://github.com/huntabyte/bits-ui/issues/1987) (cf. [ark#2741](https://github.com/chakra-ui/ark/issues/2741)) | Hidden input makes the whole page scroll in nested overflow layouts (ark: clicking the label scrolls) | Absolutely positioned hidden control escapes the root's containing block, and focus or label activation scrolls to it | Fixed in PR #2018. Ark: add `position:relative` to the root | Contain hidden controls (relative root, `preventScroll`). |
| Bits UI | [bits#1108 (closed)](https://github.com/huntabyte/bits-ui/issues/1108) | Touch: picking an item clicks the element behind (Combobox, then also reported for Select) | Same tap-through as radix#1658 | Fixed for Combobox. Workaround for Select | Delay unmount until after the compatibility click. |
| Kobalte | [kobalte#567 (open)](https://github.com/kobaltedev/kobalte/issues/567) | Space selects an item and also scrolls the page | Space keydown not `preventDefault`ed | Open | `preventDefault` on keys you handle (Space, Home/End/PageUp/PageDown). See rsp#10720. |
| Kobalte | [kobalte#621 (open)](https://github.com/kobaltedev/kobalte/issues/621) | Select inside a Dialog often will not open a second time | Focus-outside handling closes the Select right after it opens (`setValue(true)` then `false`) | Open (workaround: `onFocusOutside`) | Nested layers: focus moving into a child popup is not "focus outside". |
| Kobalte | [kobalte#639 (closed)](https://github.com/kobaltedev/kobalte/issues/639) | `onChange` fires when `options` change though the value did not | Selection reconciliation on collection change emits change | Fixed in PR #708 | Emit value-change only on real value changes. |
| Ariakit | [ariakit#2516 (open)](https://github.com/ariakit/ariakit/issues/2516) | Async items: the first item is auto-selected with no `defaultValue` (placeholder flashes) | Store defaults the value to the first item when items register | Open (workaround: explicit `defaultValue=""`) | Never auto-select. Empty means empty. |
| Ariakit | [ariakit#7011 (closed)](https://github.com/ariakit/ariakit/issues/7011) | On open, the selected item is only minimally scrolled into view, not centered | Uses the shortest scroll | Fixed in PR #7067 | Center the selected item on open, as native selects do. |

## Known pitfalls

1. **Opening on `pointerdown` for touch** — scroll opens the select, the release taps
   through to whatever is under the popup (Radix, Headless UI, Bits UI all fixed it the
   same way: touch opens on `click`). rind opens on release for every input.
2. **The hidden native `<select>`** — duplicated option text and labels for Testing
   Library, all options mounted or rendered from data on every change, size-based
   fallbacks that drop `required` or reset, `change` on programmatic updates, page
   scroll from a mispositioned control, an empty option needed so the first one is not
   submitted. Every library with one has a cluster of these bugs.
3. **Item-aligned positioning** — zoom rounding, `max-height`, all-disabled lists, scroll
   buttons that resize the popup and snap back, append jumps; disabled for touch anyway.
4. **Closed-trigger typeahead** — selecting disabled items, Space doubling as a typeahead
   character and a toggle.
5. **Value without items** — values dropped or reset when items load late or change.
6. **Labels** — label `for` → hidden control, label-forwarded clicks toggling twice
   (radix#3679), names that include the value.
7. **jsdom/happy-dom** — pointer-capture and `scrollIntoView` missing (radix#1822), the
   opening event change breaking consumer tests (hui#3703).

## Testing notes

- The driver (`getSelect`) locates by `combobox` + exact label name and resolves parts by
  `data-instance`, so the portalled list belongs to the right instance; no
  `querySelectorAll` workaround.
- Opening on `click` works with `userEvent.click`, `fireEvent.click` and keyboard Enter
  in jsdom and happy-dom; `@rind-ui/testing/setup` polyfills `scrollIntoView`. The
  driver suite runs in happy-dom too (Reado's environment).
- Form tests read the hidden inputs' `value` properties; autofill is simulated by setting
  the input's value and dispatching a native `input` event.
- Testing Library's `selectOptions()`/`toHaveValue()` (zag#2682) do not apply to a
  custom select; docs point to `getSelect().choose()` and `formValue()`.
- Touch scenarios run with Chromium and WebKit touch emulation; Firefox Android
  (radix#1770) is manual.

## Decisions

- **Parts** (`scope: "select"`): `root` (no element; renders the hidden inputs last),
  `label` (`span`), `trigger` (`button`, `role=combobox`), `value-text`, `indicator`,
  `description` (control-label), `positioner`, `content`, the listbox parts, and
  `hidden-input`.
- **Machine**: `closed | open`; events `TRIGGER_PRESS`, `TRIGGER_KEY`, `LABEL_PRESS`,
  `ESCAPE_KEY`, `OUTSIDE_PRESS`, `OUTSIDE_FOCUS`, `TAB_KEY`, `WINDOW_BLUR`,
  `POSITION.PLACED`, `FORM.RESET`, `FORM.AUTOFILL`, `OPEN`, `CLOSE` plus the collection
  events; `TYPEAHEAD` state-scoped (closed: select; open: highlight).
- **Defaults**: open on release (all inputs); `modal: true` (layer kind `listbox`);
  `loop: false`; `focusableWhenDisabled: false`; preset `dropdown`; selected option
  focused and centred on open; single closes on select, multiple stays open; Escape and
  Tab close without committing.
- **Value**: `string | null` / `string[]`, `""` a real key, never auto-selected; value text
  from collection data (key → text map for absent items), placeholder, list format for
  multiple.
- **Form**: one visually hidden `<input>` (+ `type=hidden` value carriers for multiple)
  through `hidden-form-input`; autofill adopted by key or text; `data-autofill`.
- **`data-*`**: trigger `data-state`, `data-placeholder`, `data-autofill`, focus, pressed,
  disabled, readonly, required, invalid; content `data-state`, placement, `data-modal`,
  `data-close-reason`; listbox attributes on items.
- **Contract**: `selectContract` located by `combobox` + name; actions `open`,
  `openWithArrowUp`, `close`, `choose`, `toggle`, `typeahead`, `typeaheadClosed`,
  `pressOutside`, `tabOut`, `resetForm`; queries `isOpen`, `value`, `selected`, `items`,
  `highlighted`, `focusedItem`, `isPlaceholder`, `isDisabled`, `isInvalid`,
  `isRequired`, `formValue`, `closeReason`; traits `disclosure`, `layer`,
  `restores-focus`, `presence`, `anchored`, `composite-roving`, `selectable`,
  `form-associated`, `modal`.
- **Deliberately different**:

| Others | rind-ui | Why |
|---|---|---|
| Hidden native `<select>` with every option (RA, Radix, Zag, Ariakit) | One hidden `<input>` + autofill matching (Base UI, Bits) | No duplicate text/labels, nothing to render while closed, no size-based fallback |
| Open on mouse/pointer down (RA, Radix, Base UI, native) | Open on release for every input | Rule 15; touch bugs; one opening event across inputs (hui#3703) |
| Item-aligned default (Radix, Base UI) | Dropdown only in v1 | Bug cluster; disabled on touch; Reado uses bottom-start |
| Trigger name includes the value (RA, HUI) | Name = label only | Stable role+name location |
| Activedescendant popup (Zag, HUI) | Roving | VoiceOver |
| Closed ArrowLeft/Right change the value (RA, Zag) | Arrows only open | APG; base-ui#5633 shows platforms disagree; fewer surprises |
| Label `for` → hidden select (Zag) | Label is a `span`; click focuses the trigger | Hidden input never a label target |

## Open questions

- Item-aligned placement as a later positioning option (`alignItemWithTrigger`), mouse
  only, after the dropdown ships.
- Whether VoiceOver reads the value change after closed-trigger typeahead (manual
  protocol); an announcer quirk entry if not.
