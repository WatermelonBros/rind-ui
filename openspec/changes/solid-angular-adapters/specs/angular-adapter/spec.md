## ADDED Requirements

### Requirement: Binding A Service

`@rind-ui/angular` SHALL create one service per root directive instance, push the latest
inputs to it whenever an input signal it reads changes, start it after the first render in the
browser and stop it when the directive is destroyed, and update the bound elements when the
service's snapshot changes. It SHALL never start a service during server rendering.

#### Scenario: Destroy

- **WHEN** the element carrying a root directive is removed
- **THEN** its service is stopped and every effect cleanup of its active state has run

#### Scenario: Server render

- **WHEN** a component is rendered with `@angular/platform-server`
- **THEN** the markup carries the part's roles and attributes and none of the machine's effects
  ran (the binder's Angular `effect` writes the attributes; the service is never started)

### Requirement: Parts As Attribute Directives

Each React part SHALL be an attribute directive `[rind<Component><Part>]` applied to the
consumer's element, with `exportAs` `rind<Component><Part>`; each component SHALL export a
const tuple of its directives for `imports`. A part SHALL add no wrapper element, so the
rendered markup is the consumer's elements with the part's attributes. A part that renders
elements of its own (Kbd's keys, Badge's hidden label) SHALL be a component with the same kind of
attribute selector, so its host is still the consumer's element. A static attribute that sets one
of the part's inputs (`orientation="vertical"`) SHALL NOT stay on the element unless connect
writes it.

#### Scenario: Static input attribute

- **WHEN** a template renders `<div rindSeparatorRoot orientation="vertical"></div>`
- **THEN** the element carries React's vertical separator attributes and no `orientation`
  attribute

#### Scenario: Heading on another heading element

- **WHEN** a template renders `<h2 rindHeading>` inside one `rindHeadingLevel` section
- **THEN** the `h2` carries `aria-level="3"` (the consumer writes the element, so its tag can
  differ from React's `h3`; the accessible level is the same)

#### Scenario: Toggle on a button

- **WHEN** a template renders `<button rindToggleRoot>Bold</button>`
- **THEN** the button has `aria-pressed="false"` and React's Toggle attributes, and no other
  element is added

### Requirement: Binding Connect Output

One binder per element SHALL apply connect's props through `Renderer2`: attributes set and
removed by difference (`false` / `undefined` removed, `true` as an empty attribute), styles
per property, the consumer's classes kept, handlers through one listener per event. The
consumer's own listener on the same event SHALL run first and MAY call
`event.preventRindHandler()` to skip the part's handler. Overriding an attribute the part's
accessibility depends on SHALL warn in development.

#### Scenario: Both handlers run

- **WHEN** a consumer binds `(click)` on a `rindToggleRoot` button and clicks it
- **THEN** the consumer's handler runs, then the toggle changes

### Requirement: Controlled Values With Input And Output

A part with a controllable value `<value>` SHALL expose an `input()` `<value>`, an `output()`
`<value>ChangeDetails` emitting `{ value, details }` and an `output()` `<value>Change` emitting
the value (never `model()`): controlled while the input is not `undefined`, uncontrolled from
`default<Value>` otherwise. `<value>ChangeDetails` SHALL fire first; `details.cancel()` called
from it SHALL veto the change, and `<value>Change` SHALL then not fire. `[(<value>)]` SHALL work.

#### Scenario: Fully controlled

- **WHEN** a Toggle is bound with `[pressed]="false"` only and the user activates it
- **THEN** it stays not pressed

#### Scenario: Cancelled change

- **WHEN** a Toggle bound with `[(pressed)]` cancels the change from `(pressedChangeDetails)`
- **THEN** `pressed` keeps its value and `(pressedChange)` does not fire

### Requirement: Context Through Dependency Injection

Parts SHALL find their root through an injection token the root provides; a part outside its
root SHALL throw a descriptive error. Collection items SHALL register with the root and be
ordered by DOM position, not by content queries.

#### Scenario: Projected items

- **WHEN** a Listbox's options are projected through `<ng-content>` from a parent template
- **THEN** they register with the Listbox and keyboard navigation follows their DOM order

### Requirement: Stable Ids

Each instance SHALL get its root id from a root-provided id source (`APP_ID` and a counter) or
the consumer's `id` input, and derive every part id from it, so the server and the hydrated
client render identical ids.

#### Scenario: Hydration

- **WHEN** a component's server HTML is hydrated
- **THEN** no id changes and no hydration warning is logged

### Requirement: Provider

A `provideRind()` provider (and a `rindProvider` directive for a subtree) SHALL give every part
below it locale, direction, message overrides, announcer, typeahead timeout, environment
options and icons, nested ones overriding their parent field by field, as in `@rind-ui/react`.

#### Scenario: Platform override

- **WHEN** a component renders under a provider with `environment: { platform }`
- **THEN** its machine reads that platform

### Requirement: Component Entries

The package SHALL export each component's directives from the root and from
`@rind-ui/angular/<component>` as partially compiled ESM with type declarations, and its
`package.json` `exports` SHALL list exactly the components it ships.

#### Scenario: Subpath import

- **WHEN** a standalone component imports `{ Toggle }` from `@rind-ui/angular/toggle` into its
  `imports`
- **THEN** `rindToggleRoot` and `rindToggleIndicator` apply in its template

### Requirement: Contract Parity

Every component the package ships SHALL pass its contract's model-based test (`testMachine`)
rendered with the Angular directives (compiled ahead of time), in jsdom and in real browsers,
and render React's markup for the same inputs (compared with `canonicalHtml` after Angular's own
attributes are removed).

#### Scenario: Toggle model

- **WHEN** the Toggle contract model runs against `rindToggleRoot` uncontrolled, starting on
  and fully controlled
- **THEN** every path passes in every modality
