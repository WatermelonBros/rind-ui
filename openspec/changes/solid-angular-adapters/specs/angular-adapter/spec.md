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

### Requirement: Parts React Renders Nothing For

A part React renders nothing for in a state (Skeleton's Status once loaded, an Image or Avatar
Fallback before it is due, an Alert after it is dismissed and its exit has run, and its parts)
SHALL keep the consumer's element, hidden by both the `hidden` attribute and an inline
`display: none`, with only `data-scope` and `data-instance`: no `data-part`, no role and no
`aria-*`, so drivers, skins and assistive technology find no part. The part SHALL remove both
when it renders again, and only the `display` it wrote.

#### Scenario: A consumer display rule does not reveal it

- **WHEN** a dismissed Alert is styled by `[data-scope="alert"] { display: block }`
- **THEN** its element computes `display: none`, carries `hidden`, and no element with
  `data-part` remains inside it

#### Scenario: Markup parity in the rendered states

- **WHEN** a loaded Skeleton is compared with React's
- **THEN** the markup matches once the hidden Status element is set aside

### Requirement: A Directive Does Not Become Another Part

A part React renders as another component in some context SHALL, in Angular, be written as that
other part's directive: a Toggle Group item outside a group SHALL throw a descriptive error naming
`rindToggleRoot` (React's lone item renders a Toggle). A component that composes another one's
behaviour (a Text Field Root composing a Field) SHALL do it through a host directive.

#### Scenario: A lone Toggle Group item

- **WHEN** a template renders `<button rindToggleGroupItem value="b">` outside any group
- **THEN** creating it throws an error that names `rindToggleGroupRoot` and `rindToggleRoot`

### Requirement: The Element Picks The Part

An element never changes its tag in Angular, so a part React renders as one element or another
by state or props SHALL be one directive per element, the consumer writing the element the state
asks for: a Pagination page or trigger SHALL be a Button on `<button>` and a Link on `<a>` (with
the Root's `getPageHref`), and the current crumb without `href` SHALL be
`<span rindBreadcrumbsCurrent>` (React's text span) where a linked crumb is
`<a rindBreadcrumbsLink>`; a Stepper Trigger SHALL be `<button rindStepperTrigger>` while its
step is reachable and `<span rindStepperTrigger>` otherwise (`i.triggerIsButton()`). The state the choice reads SHALL be readable from the template
(`#i="rindBreadcrumbsItem"`, `i.state().current`); focus SHALL move to the new element when the
focused one is replaced.

#### Scenario: Pagination with links

- **WHEN** a Pagination Root has `getPageHref` and its pages are `<a rindPaginationPage>`
- **THEN** each page is a link to its `getPageHref` value, the current one `aria-current="page"`,
  and the markup matches React's

#### Scenario: The current crumb

- **WHEN** the last Item has no `href` and its template renders `<span rindBreadcrumbsCurrent>`
  for `i.state().current`
- **THEN** it is a focusable `<span aria-current="page">`, as React renders it

### Requirement: Repeated Content Is A Structural Directive

A part React renders several times from the same children (a Marquee's copies) SHALL be a
structural directive on the consumer's element (`<div *rindMarqueeContent>`), stamped once per
copy, so every copy stays live as the content changes; the stamped elements SHALL carry the same
part props React gives each copy, and the consumer's `id` only on the first.

#### Scenario: Marquee copies

- **WHEN** an auto-filled Marquee needs three copies of its content
- **THEN** the Viewport holds three stamped elements, the second and third `aria-hidden` with no
  tab stop inside, and the markup matches React's

### Requirement: Outputs Never Share A Native Event's Name

An output SHALL NOT be named like a DOM event that bubbles to its element, since a template
listener of that name hears both: Clipboard's and Code Block's copy result is `copyResult`, not
`copy`.

#### Scenario: Copying from the Input

- **WHEN** the user copies the Clipboard Input's text with `(copyResult)` bound on the Root
- **THEN** the handler runs once per result

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
