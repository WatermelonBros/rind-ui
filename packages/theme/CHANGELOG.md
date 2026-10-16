# @rind-ui/theme

## 0.2.0

### Minor Changes

- 6c01b92: Separator: `Separator.Root` with role by context (`separator`, implicit on `<hr>`, `none` when
  decorative or in a listbox), `aria-orientation` only when vertical, `SeparatorHostContext` for
  containers, `separatorProps` in core for every divider, `getSeparator` with `orientation`,
  `isDecorative` and `isExposed` queries, and `separator.css` (a border, stretching in flex rows,
  visible in forced colors).
- a135fd4: Add Toolbar: one tab stop with focus memory, arrows and Home / End over its own controls, hosted Toggle Group and Radio Group, text fields that keep their caret keys, `Toolbar.Item` for any other control, `getToolbar` driver and `toolbar.css`.

## 0.1.0

### Minor Changes

- a383a92: Accordion: items built on Collapsible, with `value` / `defaultValue` / `onValueChange`,
  `multiple`, `collapsible` (default true), `disabled`, `focusableWhenDisabled`, `orientation`,
  `dir`, `headingLevel` (default: the surrounding `Heading.Level`, else 3) and `closedContent`.
  Arrow-key, Home and End navigation between triggers is opt-in (`keyboardNavigation`, as in
  APG 2026). Open panels are regions by the region rule (up to 6 items, single mode, or
  `contentRole`). `getAccordion`, `accordionContract`, and `accordion.css`.
- 08430f7: Button: one `onPress` per activation from every input with its modality, `onPressStart` /
  `onPressEnd`, a pending state that keeps focus, swaps `submit` to `button` and announces
  `messages.pending` when focused, and `getButton` with `press` / `pressWithSpace`. Shared
  button-like rules for every button-like part (`buttonLikeProps`: native by default with
  `type="button"`, `<a href>` delegated to link-navigation, generic elements with role and
  tabIndex, disabled and `focusableWhenDisabled`, `elementInfo`, a fieldset-disabled tracker
  following every ancestor fieldset). Press interactions now keep the native Enter and Space
  activation of submit and reset buttons, so a form submits or resets once.
- be08d71: Checkbox Group: a set of Checkboxes with one array `value` (controlled or not, set-equality
  change detection), submitted as one entry per checked item under the group's `name`.
  Parts: `Root`, `Label`, `Description`, `ErrorMessage`, and `Parent`, a select-all Checkbox
  that is mixed for a partial selection and follows the APG cycle (select all, none, restore).
  `required` means at least one item; disabled and read-only apply to the whole group; one
  form reset answers for every item. Registers as one control in a Field.
  `getCheckboxGroup`, `checkboxGroupContract` and `checkbox-group.css` (structural).
- 758adfb: Checkbox: checked, unchecked or `indeterminate` (`aria-checked="mixed"`), controllable and
  form-associated through a hidden native input (`name`, `value`, `uncheckedValue`, `form`,
  `required`, form reset to the current `defaultChecked`). Parts: `Root`, `Control`,
  `Indicator` (children may be a function of the state), `Label`, `Description`. Space
  toggles; Enter submits the form. Shared `hidden-form-input` and `control-label` behaviour
  for Switch and Checkbox Group. `getCheckbox`, `checkboxContract` and `checkbox.css`
  (structural; forced colors map checked and mixed to `Highlight`).
- 06aba0c: Collapsible: a trigger and a content region with controllable `open`, `disabled` and
  `focusableWhenDisabled`, and `closedContent` (`until-found` by default so the browser's
  search can open it, `hidden`, or `unmount`). The content publishes its size as
  `--rind-collapsible-content-height` / `-width` (measured without disabling animations, `auto`
  at rest) for CSS transitions; `data-reveal` marks instant reveals. `getCollapsible`,
  `collapsibleContract`, and `collapsible.css`.
- 4311bfb: Field: one form control with a Label, Description and ErrorMessage, validated by one
  engine (sources in order: `invalid`, external errors, native constraints, `validate`;
  native validity as the source of truth; submit / blur / change modes; native and aria
  behaviours; async validation with stale-result dropping and debounce; touched, dirty,
  filled; reset; focus on the first invalid control in tree order with a focus ring; polite
  announcements once per message). The `field-control` binding for control authors
  (`useFieldControl`, `mergeFieldProps`), `constraintValidity` as an environment capability,
  `focusSafely` with an optional modality, `getField` with `.control()` composition,
  `field.css`, and the "Implementing field-control" guide.
- 13fa6bb: Fieldset: a native `<fieldset>` named by its Legend and described by Description and
  ErrorMessage, whose `disabled` reaches every rind-ui control through a context (portalled
  parts and nested Fieldsets included, the first Legend exempt) and native controls natively.
  Button now follows it. `getFieldset`, `Part.accessibleDescription()`, optional parts in the
  part registry, `fieldset.css`; the native fieldset tracker also follows moved nodes.
- 70581a4: Floating positioning: a `position` capability (`domPositioning`, on `@floating-ui/dom`) that
  places anchored popups against an element, a virtual rectangle or a point, with collision
  avoidance, available-size and anchor-size CSS variables, an arrow, a hidden-anchor state,
  tracking (visual viewport, layer stack, ancestor animations), strategy `auto`, side lock and
  a manual mode for CSS anchor positioning; connect helpers for the positioner, content and
  arrow parts; the `positioningQueries` contract fragment, `fakePositioning()` and the
  `anchored` layout invariant in `@rind-ui/testing`; and the positioner stylesheet.
  Fix: a registered trigger is no longer made inert while its layer exits, so focus returns to it.
- 63f8e5f: Form: a native `<form>` that validates every Field on a submit attempt (native `invalid`
  events grouped into one attempt), focuses the first invalid Field in tree order once,
  holds a submission for pending async checks and requests it again with the same
  submitter, maps server `errors` to Fields by exact name, announces one summary for two or
  more invalid Fields, calls `onFormSubmit` with typed values, exposes `validate(name?)`,
  and keeps server errors through React 19's automatic action reset. Fields take the Form's
  defaults and let it lead attempts; async results are cached per input. `getForm`,
  `Part.scoped()`, `data-name` on Field roots, `form.css`.
- 430a92f: Heading: levels from the nesting of `Heading.Level` sections (root 2, explicit `level`
  wins, clamped to 1–6 with development warnings), native `h1`–`h6` with the role and
  `aria-level` rules for substituted elements, `useHeadingLevel()` for your own components,
  `headingProps` in core for every heading part, `getHeading` with a `level()` query,
  `Part.tagName()` in the test environment, and `heading.css` sizing by `data-level`.
- 5c82f1a: Label: a native `<label>` with no role, the shared `label-interaction` rules (double-click
  selection guard, focus forwarding for non-labelable targets, development check of `for`),
  `getLabel` with `click` / `doubleClick` and `text` / `controlName` / `isControlFocused` /
  `selectedText`, new test environment operations (`Part.accessibleName()`,
  `Part.labelled()`, `Part.doubleClick()`, `env.selectedText()`), `label.css`, and a Labels
  guide.
- d309928: Link: the first component. `linkProps` (core/dom) gives every link part the same rules:
  a native anchor by default, client routing through a hooks-free `Router` environment
  capability that never double-navigates, modifier, middle and cross-origin activations left
  to the browser, href resolution that never rewrites external URLs, the disabled-link rule
  (TalkBack-reachable), `aria-current`, activation reports with a disposition, and a
  `role="link"` fallback built on the exported `activateLink` routine. `<Link>` and
  `RouterProvider` in React; `staticContract` for stateless components; `getLink`,
  `fakeRouter()` and `env.navigated()` in the DOM and Playwright adapters; `link.css` in the
  theme; generated API docs from component meta files.
- ee3687d: Overlay infrastructure: a per-document layer stack with explicit parentage, dismissal by
  Escape, outside press and outside focus (vetoable, with reasons), focus containment and
  restore without sentinels, outside hiding with `inert`, a reference-counted scroll lock,
  presence for exit animations, portal target resolution and the `overlayEffect` that ties
  them together. React gains `Portal`, `usePresence` and `LayerProvider`; testing gains the
  `modal` and `presence` traits, a document-clean check after unmount, and driver support for
  overlays; the theme gains overlay base styles.
- 058f6e8: Radio Group: one choice out of several with a roving single tab stop. Arrow keys move and
  check (every arrow whatever the orientation, mirrored in RTL); focus alone never checks. Parts:
  `Root`, `Label`, `Description`, `ErrorMessage`, `Item`, `ItemControl`, `ItemIndicator`,
  `ItemLabel`, `ItemDescription`. One native radio input per item shares the group's `name`;
  `readOnly`, `required`, `invalid`, `disabled` and `focusableWhenDisabled` apply to the whole
  group, and the group registers as one control in a Field.
  `getRadioGroup`, `radioGroupContract` and `radio-group.css` (structural, forced-colors aware).
- 1e7460e: Segmented Control: one choice out of a joined strip of segments, with radio semantics (a
  `radiogroup` of `radio` buttons, one roving tab stop; every arrow moves and selects, Space
  selects, Enter submits the form). Parts: `Root`, `Label`, `Item` (the segment, its hidden input
  a sibling) and an optional measured `Indicator` (`--rind-indicator-*`). `readOnly`, `required`,
  `invalid`, `disabled` and `focusableWhenDisabled` apply to the whole control.
  `getSegmentedControl`, `segmentedControlContract` and `segmented-control.css` (structural,
  forced-colors and reduced-motion aware).
- d9c190c: Switch: an on/off setting (`role="switch"`), controllable and form-associated through a
  hidden native input (`name`, `value`, `uncheckedValue`, `form`, `required`, form reset to
  the current `defaultChecked`). Parts: `Root`, `Control`, `Thumb`, `Label`, `Description`.
  Space toggles; Enter submits the form. `getSwitch`, `switchContract` and `switch.css`
  (structural; the thumb mirrors in RTL, forced colors keep the track border and map checked
  to `Highlight`).
- e5c91c9: Tabs: a tablist with one roving tab stop and a panel per tab. `activationMode` `automatic` or
  `manual` (focus alone never selects), `orientation`, `loop`, `disabled`, `focusableWhenDisabled`
  and `inactivePanels` (`unmount`, `hidden`, `until-found` with find-in-page). Parts: `Root`, `List`,
  `Tab`, `Panel` and an optional measured `Indicator` (`--rind-indicator-*`). `getTabs`,
  `tabsContract` and `tabs.css` (structural, forced-colors and reduced-motion aware).
- 97bac9f: Text Field: a native input or textarea with a controllable value (`onValueChange` with
  reason, native event and composition flag), IME-safe handling, a ClearTrigger that keeps
  focus and clears through one `input` event, a CharacterCount (hard `maxLength` or soft
  `max`, announced near the limit), and autosize (`field-sizing: content` or a side-effect-free
  measured fallback). `TextField.Root` is a Field when standalone and joins an enclosing one
  (the shared `FieldHost` helper). `buildTextFieldMachine(preset)` for presets,
  `textFieldContractFor(scope)`, `getTextField`, `text-field.css`, and an Autosize guide.
- c093212: Theme system: three token tiers (twelve `--rind-brand-*` inputs, semantic tokens derived in
  CSS, per-component tokens), `data-tone` and `data-size` variants, `calm` and `crisp` presets,
  `icons.css`, and a typed builder (`@rind-ui/theme/builder`: `defineTheme`, `checkTheme`,
  contrast validation, DTCG export). `RindProvider` accepts `icons`.
  
  Breaking token and selector renames:
  
  - `--rind-color-accent` is now `--rind-color-accent-solid`
  - `--rind-color-accent-hover` is now `--rind-color-accent-solid-hover`
  - `--rind-color-accent-text` (text on an accent background) is now `--rind-color-accent-on-solid`;
    `--rind-color-accent-text` now means accent-coloured text on the page
  - `--rind-color-danger` is now `--rind-color-danger-solid`
  - `--rind-color-focus` is removed: use `--rind-focus-color`
  - `.rind-root` is replaced by `[data-rind-theme]`
  - radius tokens are derived from `--rind-brand-radius`
- 2e3d605: Toggle Group: a set of toggle buttons with one roving tab stop. `selectionMode` `single` or
  `multiple`, a `string[]` value, `disallowEmptySelection`, `orientation`, `loop`, `disabled` and
  `focusableWhenDisabled`. Arrow keys only move focus; Space and Enter press. Parts: `Root`, `Item`.
  `getToggleGroup`, `toggleGroupContract` and `toggle-group.css` (structural, forced-colors aware).
- c6c972c: Toggle: a two-state button (`aria-pressed`) with controllable `pressed`, `disabled` and
  `focusableWhenDisabled`, activated by Enter and Space. `Toggle.Indicator` swaps its content
  with the state (`fallback` while off) for icon-only toggles whose accessible name must not
  change. In development a name that follows the state is warned about. `data-state` is
  `on`/`off`; `data-pressed` is a press in progress. `getToggle`, `toggleContract`, and
  `toggle.css` (on state is an outline plus a background, never colour alone).
