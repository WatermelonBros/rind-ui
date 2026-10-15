# button-like-element Specification

## Purpose
Defines the element, substitution, disabled and keyboard rules shared by every
button-like part in rind-ui (Button, Toggle, the Switch and Checkbox controls, and every
trigger), so substituting the rendered element never changes behaviour and no component
re-implements them.
## Requirements
### Requirement: Native Button By Default

A button-like part SHALL render a native `<button>` by default with `type="button"`, so
it never submits a surrounding form by accident. Only the Button component SHALL let the
consumer choose `type="submit"` or `type="reset"`. The `type` attribute SHALL be
emitted only when the rendered element is a native `<button>` (or `<input>`), never on
other elements, where it has a different meaning (MIME type on `<a>`). Connect SHALL
emit only the attributes the rendered element lacks natively: no `role="button"` and no
`aria-disabled` on an enabled or natively disabled `<button>`.

#### Scenario: Trigger inside a form (radix#3468, reka-ui#3007)

- **WHEN** a button-like part with no `type` prop is rendered inside a `<form>` and
  activated
- **THEN** the form is not submitted

#### Scenario: No type on a non-button (headlessui#619)

- **WHEN** a button-like part is rendered as a `<div>` or an `<a>`
- **THEN** the element has no `type` attribute

#### Scenario: Native button attributes

- **WHEN** an enabled button-like part renders its default `<button>`
- **THEN** it has no `role` attribute and no `aria-disabled` attribute

### Requirement: Element Substitution Keeps Behaviour

Connect SHALL read the rendered element's tag and role from the element itself (through
`core/dom`, after the reference is attached; the default element's semantics are used
for the server render) and SHALL adapt the attributes so the part behaves the same:

- a native `<button>`: native semantics, as above;
- an `<a href>`: link semantics are kept — no `role="button"` — and the part SHALL take
  its activation, disabled and routing behaviour from add-link's `link-navigation`
  (`linkProps`: Enter only, modifier and middle clicks left to the browser, client
  routing through the environment router, `href` resolution) instead of the button
  activation rules (react-spectrum#10603);
- any other element: the part's role (`button`, or the role the component declares,
  such as `checkbox` or `switch`), `tabIndex=0`, and keyboard activation through press
  interactions with the rules for that role.

Activation callbacks, `data-*` attributes and the contract SHALL behave identically for
every rendered element. In development, a part whose rendered element has interactive
content inside it (a button or link descendant) SHALL log a warning.

#### Scenario: Link keeps its role (base-ui#4021)

- **WHEN** a Button is rendered with `render={<a href="/docs" />}`
- **THEN** the element is exposed with role `link`, has no `role` attribute, and Space
  does not activate it while Enter does

#### Scenario: Anchor-rendered Button routes like a Link (react-spectrum#10603)

- **WHEN** a router is provided and a Button rendered with `render={<a href="/docs" />}` is
  clicked, then ⌘-clicked
- **THEN** the plain click calls the router's `navigate("/docs")` once without a page
  load, and the ⌘-click is left to the browser (new tab) with no client navigation

#### Scenario: Generic element

- **WHEN** a Button is rendered as a `<div>`
- **THEN** it has `role="button"` and `tabIndex=0`, and Enter, Space, a pointer click
  and a bare `click` each activate it exactly once

#### Scenario: Server render of a substituted element

- **WHEN** a button-like part rendered as a `<div>` is server-rendered and hydrated
- **THEN** the hydrated markup matches and, once the element is attached, it carries
  `role` and `tabIndex`

### Requirement: Disabled And Focusable When Disabled

A disabled button-like part SHALL use the native `disabled` attribute when its element
is a native `<button>`. With `focusableWhenDisabled` it SHALL instead carry
`aria-disabled="true"` and stay in the tab order. A disabled non-native element SHALL
carry `aria-disabled="true"` and be removed from the tab order (`tabIndex=-1`) unless
`focusableWhenDisabled` is set. A disabled link SHALL lose its `href`, keep role `link`
(explicit `role="link"` once `href` is gone) and carry `aria-disabled="true"`. While
disabled, every activation — pointer, touch, Enter, Space and a bare `click` — SHALL be
ignored by the machine whatever handlers the consumer adds, while Tab and Shift+Tab
SHALL keep moving focus. Disabled attributes SHALL be present on the server render. The
part SHALL NOT disable itself through inline styles such as `pointer-events: none`.

#### Scenario: Focusable when disabled still ignores presses (base-ui#1312)

- **WHEN** a disabled part with `focusableWhenDisabled` and a consumer `onClick` is
  clicked, tapped, activated with Enter or Space, or receives a bare `click`
- **THEN** the component's activation does not happen, the element keeps focus, and
  Tab moves focus to the next element

#### Scenario: Disabled link is not tabbable (ariakit#722)

- **WHEN** a Button rendered as `<a href>` is disabled
- **THEN** it has no `href`, has role `link` and `aria-disabled="true"`, and Tab skips
  it

#### Scenario: Disabled in the server render (base-ui#1843)

- **WHEN** a disabled part is rendered on the server
- **THEN** the HTML already carries `disabled` (or `aria-disabled` for non-native
  elements)

#### Scenario: No inline style (ariakit#845)

- **WHEN** a part is disabled
- **THEN** no inline `pointer-events` style is set on it

### Requirement: Disabled Fieldset

A native button-like part inside a disabled `<fieldset>` SHALL be treated as disabled:
its `data-disabled` attribute SHALL be present and the machine SHALL ignore activation,
updating when the fieldset's `disabled` attribute changes. The fieldset-disabled tracking
(`core/dom/fieldset-disabled.ts`) SHALL follow EVERY ancestor fieldset, not only the
nearest one, and SHALL apply HTML's first-legend exception: a part inside a disabled
fieldset's first `<legend>` child is not disabled by that fieldset (it is still disabled
by any other disabled ancestor fieldset it is not exempt from). The part's effective
disabled SHALL be its own prop OR the native tracker OR the disabled state carried by an
enclosing rind-ui Fieldset or Field context (`add-fieldset`, `add-field` `field-control`
binding), so portalled parts that have no DOM fieldset ancestor follow it too.

#### Scenario: Fieldset disabled at runtime

- **WHEN** the `<fieldset>` containing a button-like part becomes disabled
- **THEN** the part gains `data-disabled` and activating it does nothing

#### Scenario: Outer fieldset disabled

- **WHEN** a button-like part is inside an enabled `<fieldset>` that is inside a
  `<fieldset>` which becomes disabled
- **THEN** the part gains `data-disabled` and activating it does nothing, and it loses
  them when the outer fieldset is enabled again

#### Scenario: First legend is exempt

- **WHEN** a button-like part is inside the first `<legend>` of a disabled `<fieldset>`,
  and another one is inside a second `<legend>` of the same fieldset
- **THEN** the first stays enabled and activates, and the second is disabled

#### Scenario: Legend of a nested fieldset inside a disabled one

- **WHEN** a button-like part is inside the first `<legend>` of an enabled `<fieldset>`
  nested in a disabled `<fieldset>`
- **THEN** the part is disabled

#### Scenario: Portalled part follows the Fieldset context

- **WHEN** a button-like part is portalled out of a rind-ui Fieldset that is disabled
- **THEN** the part is disabled, though no DOM fieldset contains it

### Requirement: Keyboard Activation By Role

Keyboard activation of a button-like part SHALL follow press interactions'
per-element rules for its rendered element and role: role `button` activates on Enter
and on Space (on keyup); a link on Enter only; parts whose component declares role
`checkbox` or `switch` follow the keyboard rules that component specifies. A held key
SHALL activate once, and a native button SHALL activate once per key press whatever its
`type`.

#### Scenario: Space on a submit button (react-spectrum#10658)

- **WHEN** Space is pressed and released on a Button with `type="submit"` inside a form
- **THEN** `onPress` is called once and the form is submitted once

#### Scenario: Enter on a reset button

- **WHEN** Enter is pressed on a Button with `type="reset"`
- **THEN** `onPress` is called once and the form is reset once

### Requirement: Shared Data Attributes

Every button-like part SHALL carry `data-scope`, `data-part` and `data-instance`;
`data-disabled` while disabled (natively, through `aria-disabled` or through a
fieldset); `data-focus` and `data-focus-visible` as defined by interaction modality;
`data-pressed` only while a press is in progress (press interactions) and for no other
meaning; and `data-hover` as defined by press interactions. Components SHALL express
their own state through `data-state` and component-specific attributes, never by
reusing `data-pressed`.

#### Scenario: Pressed means press in progress

- **WHEN** a pointer is held down on a button-like part and then released
- **THEN** `data-pressed` is present only between press and release

#### Scenario: Mouse click shows no ring (base-ui#3759)

- **WHEN** a button-like part is clicked with a mouse
- **THEN** it carries `data-focus` and not `data-focus-visible`, and after a following
  Tab press elsewhere and Shift+Tab back it carries both

