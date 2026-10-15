## Purpose

Defines rind-ui's Accordion: a set of headings whose buttons show and hide one
section each, following the WAI-ARIA APG Accordion pattern. Each item behaves as a
Collapsible whose open state the accordion owns. The spec covers heading and
region semantics, keyboard, value modes, disabled and locked items, styling
attributes and the contract.

## ADDED Requirements

### Requirement: Anatomy

Accordion SHALL consist of these parts:

| Part | Default element |
|---|---|
| `Root` | `div` |
| `Item` | `div` |
| `Header` | `h{headingLevel}`; default the surrounding `Heading.Level` context level, else `h3` |
| `Trigger` | `button` with `type="button"` |
| `Content` | `div` |
| `Indicator` | `span` |

Every part SHALL carry `data-scope="accordion"`, `data-part` (`root`, `item`,
`header`, `trigger`, `content`, `indicator`) and `data-instance`. Each item SHALL
have a `value` that is a non-empty string, unique within the accordion. Within
each item, the Trigger, Content and Indicator SHALL behave as the Collapsible
Trigger, Content and Indicator. That includes:

- closed-content modes, find-in-page reveal and exit presence;
- size custom properties, here named `--rind-accordion-content-height` and
  `--rind-accordion-content-width`;
- mount and re-insertion behaviour, and focus on close.

The open state is the item's membership in the accordion's value.

#### Scenario: Item value zero-like

- **WHEN** an item has the value `"0"` (regression: radix#2937)
- **THEN** pressing its trigger opens it

#### Scenario: Collapsible behaviour per item

- **WHEN** the user searches the page for text inside a closed item's content
- **THEN** that item opens with `reason: "find-in-page"` and the accordion's
  `onValueChange` is called

### Requirement: Heading Structure

Each `Header` SHALL expose role `heading` with a level: `h2` to `h6` from the root's
`headingLevel`; without `headingLevel`, the level of the nearest surrounding
`Heading.Level` context (add-heading) when there is one, else the native `h3`. The
header's attributes SHALL come from add-heading's shared `headingProps` helper: when the
header element is substituted with a non-heading element, the element SHALL get
`role="heading"` and `aria-level`. Each item's `Content` SHALL wrap its children in a
`Heading.Level` one deeper than the header, so a `Heading` inside a panel renders one
level below its header. The trigger SHALL be the header's only element child. In
development, a header with other element children SHALL produce a warning that
names the item.

#### Scenario: Heading level

- **WHEN** an accordion is rendered with `headingLevel={2}`
- **THEN** every header is an `h2` containing exactly its trigger

#### Scenario: Header level from the heading context

- **WHEN** an accordion without `headingLevel` is rendered inside a `Heading.Level`
  whose level is 4
- **THEN** every header is an `h4`; with `headingLevel={2}` every header is an `h2`

#### Scenario: Heading inside a panel is one level deeper

- **WHEN** an open item's content contains a `Heading` with no `level`, and the
  accordion has no `headingLevel` and no surrounding `Heading.Level`
- **THEN** the inner heading is an `h4`

#### Scenario: Substituted header

- **WHEN** a header is rendered as a `div`
- **THEN** it has `role="heading"` and `aria-level="3"`

#### Scenario: Extra content in the heading (base-ui#3632)

- **WHEN** a header contains the trigger and a separate action button
- **THEN** a development warning names the item, because APG requires the
  button to be the heading's only element

### Requirement: Panel Region Rule

An open item's content SHALL have `role="region"` and `aria-labelledby`
referencing its trigger's id. This holds when the accordion allows at most one
open item (`multiple` false), or when it has at most six items, counting every
item whether enabled or disabled (a disabled item's panel can be open). Otherwise the
content SHALL have no role. The root's `contentRole` (`"region"` or `"none"`)
SHALL override the rule. While an item is closed, its content SHALL have
neither a role nor `aria-labelledby`, and SHALL never carry `aria-hidden`.

#### Scenario: Single accordion

- **WHEN** a single-mode accordion with ten items has one open item
- **THEN** that item's content is a region named by its trigger's text

#### Scenario: Many simultaneously open panels

- **WHEN** a `multiple` accordion has eight items
- **THEN** no content has `role="region"`

#### Scenario: Closed panel exposes no landmark (react-spectrum#10552)

- **WHEN** a single-mode accordion's item is closed and its content is kept
  mounted with `hidden="until-found"`
- **THEN** the content has no `role`, no `aria-labelledby` and no `aria-hidden`

#### Scenario: Consumer trigger id (base-ui#1531)

- **WHEN** a consumer sets `id="faq-shipping"` on a trigger and its item is open
- **THEN** the content's `aria-labelledby` is `faq-shipping`

### Requirement: Value Modes

`Root` SHALL expose the open items as a controllable value: `value` and
`defaultValue` (arrays of item values, default `[]`), and
`onValueChange(value, details)`. With `multiple` false (default), pressing a
closed item's trigger SHALL make the value contain only that item. Pressing the
open item's trigger SHALL empty the value when `collapsible` is true (default),
and SHALL do nothing when it is false. With `multiple` true, pressing a trigger
SHALL add or remove that item and leave the others as they are, and `collapsible`
SHALL be ignored. Every change SHALL be reported during the step that caused it,
including closing. In single mode, a value with more than one item SHALL produce a
development warning, and only the first item SHALL be treated as open.

#### Scenario: Switching in single mode

- **WHEN** item A is open in a single-mode accordion and item B's trigger is
  pressed
- **THEN** the value becomes `["B"]`, A closes and B opens in the same step

#### Scenario: Closing in multiple mode reports the change (ark#1656)

- **WHEN** items A and B are open in a `multiple` accordion and A's trigger is
  pressed
- **THEN** `onValueChange(["B"], details)` is called

#### Scenario: Non-collapsible single mode

- **WHEN** `collapsible` is false and the open item's trigger is pressed
- **THEN** the value is unchanged and `onValueChange` is not called

#### Scenario: Undefined is not "none open" (radix#2296, bits-ui#533)

- **WHEN** a controlled accordion's `value` changes from `["A"]` to `undefined`
- **THEN** a development warning reports the switch from controlled to
  uncontrolled and the accordion stays controlled; `[]` closes every item

### Requirement: Locked And Disabled Items

In non-collapsible single mode, the trigger of the open item SHALL carry
`aria-disabled="true"` and `data-disabled`, SHALL stay focusable, and SHALL ignore
activation. A disabled item (its own `disabled`, or the root's) SHALL ignore
activation. Its trigger SHALL be natively `disabled` and SHALL NOT carry a
redundant `aria-disabled`, unless `focusableWhenDisabled` is set: then the
trigger SHALL carry `aria-disabled="true"` and stay focusable. Disabling SHALL NOT
change whether an item is open. `disabled` changes SHALL take effect on the next
interaction.

#### Scenario: Locked open item stays reachable

- **WHEN** `collapsible` is false and item A is open
- **THEN** A's trigger has `aria-disabled="true"`, is reachable with Tab, and
  pressing it changes nothing

#### Scenario: Native disabled without duplication (zag#3137, base-ui#4114)

- **WHEN** an item is disabled
- **THEN** its trigger has the `disabled` attribute and no `aria-disabled`

#### Scenario: Disabled prop changes at runtime (bits-ui#654)

- **WHEN** an item's `disabled` changes from false to true
- **THEN** its trigger ignores the next press

### Requirement: Keyboard

Enter and Space on a trigger SHALL toggle its item with press semantics (key
repeats ignored; one toggle per bare `click` from assistive technology). Tab and
Shift+Tab SHALL move through every focusable element in page order. By default,
the accordion SHALL handle no other key.

With `keyboardNavigation` set, and only when the key event's target is a
trigger:

- the logical `NEXT` and `PREV` events (ArrowDown/ArrowUp when `orientation` is
  vertical, the default; ArrowRight/ArrowLeft when horizontal, mirrored under
  `dir="rtl"`) SHALL move focus to the next or previous trigger, wrapping at the
  ends;
- `FIRST` and `LAST` (Home, End) SHALL move focus to the first or last trigger;
- disabled triggers SHALL be skipped, unless `focusableWhenDisabled` is set;
  locked triggers SHALL not be skipped;
- the order SHALL be the document order of the registered triggers, whatever
  the closed-content mode.

The accordion SHALL never stop the propagation of, or prevent, key events whose
target is not a trigger. It SHALL have no typeahead and no Escape behaviour.

#### Scenario: Arrows do nothing by default (aria-practices#3406)

- **WHEN** focus is on a trigger and ArrowDown is pressed without
  `keyboardNavigation`
- **THEN** focus stays and the browser's default (page scroll) is not prevented

#### Scenario: Optional navigation in RTL

- **WHEN** a horizontal accordion with `keyboardNavigation` under `dir="rtl"`
  has focus on its first trigger and ArrowLeft is pressed
- **THEN** focus moves to the second trigger

#### Scenario: Keys inside content are left alone (reka-ui#1504, base-ui#2320)

- **WHEN** `keyboardNavigation` is set and the user presses ArrowDown, Home and
  Space in a text input inside an open panel
- **THEN** the caret moves and the text changes as in any input, and neither
  the value nor focus changes

#### Scenario: Navigation after unmounting content (ark#3732)

- **WHEN** an item in `closedContent="unmount"` mode is opened and closed, and
  the user arrows from the previous trigger
- **THEN** focus reaches that item's trigger

#### Scenario: No typeahead (react-spectrum#5745)

- **WHEN** the user types letters and spaces in an input inside a panel
- **THEN** every character reaches the input

### Requirement: Pointer Interaction Inside Panels

The accordion SHALL attach no pointer or mouse handlers outside its triggers.
Interactive content inside panels SHALL behave as it would outside the accordion.

#### Scenario: Input focuses on the first click (kobalte#440, react-spectrum#2801)

- **WHEN** the user clicks once on an input inside an open panel
- **THEN** the input has focus

### Requirement: Simultaneous Transitions

When one step closes one item and opens another, each item's content SHALL run
its own exit or enter animation to completion, as specified for Collapsible.

#### Scenario: Switching items animates both (base-ui#3099)

- **WHEN** item B is opened while A is open, in single mode, with height
  transitions in the theme
- **THEN** A's content runs its exit transition while B's runs its enter
  transition, and A is hidden only after its transition ends

#### Scenario: Initially open items do not shift (radix#2891, kobalte#226)

- **WHEN** an accordion with `defaultValue={["B"]}` is server-rendered and
  hydrated
- **THEN** item B is open in the server HTML, no opening transition runs, and
  the layout does not shift

### Requirement: Styling Attributes

Parts SHALL expose:

| Part | Attributes |
|---|---|
| `Root` | `data-orientation`, `data-disabled` |
| `Item` | `data-state` (`open`/`closed`), `data-disabled` (the item is disabled), `data-orientation` |
| `Header` | `data-state`, `data-disabled`, `data-orientation` |
| `Trigger` | `data-state`, `data-disabled` (agreeing with native or ARIA disabled, including the lock), `data-orientation`, `data-focus`, `data-focus-visible`, `data-pressed`, `data-hover` |
| `Content` | `data-state`, `data-disabled`, `data-orientation`, `data-reveal`, the size custom properties |
| `Indicator` | `data-state`, `data-disabled`, `data-orientation` |

#### Scenario: Lock is not item disablement

- **WHEN** `collapsible` is false and item A is open
- **THEN** A's trigger has `data-disabled` and A's item part does not

### Requirement: Contract

Accordion SHALL ship a contract with scope `accordion` and anatomy `root`,
`item`, `header`, `trigger`, `content` and `indicator`. It SHALL locate an
instance by the exact accessible name of any one of its triggers (role
`button`). It SHALL declare:

- actions `expand(label)`, `collapse(label)` and `toggle(label)`, each with a
  pointer implementation (a click on the named trigger) and a keyboard
  implementation (Enter on it), and postconditions on the expanded set;
- actions `focusNext`, `focusPrev`, `focusFirst` and `focusLast` with keyboard
  implementations only, declaring that no pointer twin exists because they are
  keyboard navigation;
- queries `expanded()` (trigger labels with `aria-expanded="true"`, in order),
  `items()`, `isDisabled(label)` and `contentText(label)`;
- traits `disclosure` (checked for each trigger–content pair linked by
  `aria-controls`), `presence` and `directional`;
- argument classes for item events: the first item, another item, and a
  disabled item.

It SHALL ship per-contract invariants:

- in single mode, at most one trigger is expanded;
- each trigger's `aria-expanded` equals its item's membership in the value;
- in non-collapsible single mode, the open trigger carries
  `aria-disabled="true"`;
- every trigger is the only element child of an element with role `heading` and
  an `aria-level`;
- open contents carry `role="region"` with a resolving `aria-labelledby`
  exactly when the region rule applies, and closed contents carry no role;
- without `keyboardNavigation`, arrow keys on a trigger change neither focus nor
  value.

#### Scenario: Driver usage

- **WHEN** a test calls `getAccordion(screen, { item: "Shipping" }).expand("Returns")`
  and then `expanded()` on a single-mode accordion
- **THEN** the result is `["Returns"]`

#### Scenario: Model-based configurations

- **WHEN** `testMachine` runs the accordion contract
- **THEN** it covers single and multiple modes, collapsible and non-collapsible
  single mode, and `keyboardNavigation` on and off, in the pointer, keyboard
  and virtual modalities and under `dir="rtl"`

#### Scenario: Consumer wrapper breaks the heading

- **WHEN** a consumer's wrapper renders the trigger outside any heading and runs
  `testMachine` with the accordion contract
- **THEN** the heading invariant fails naming the item
