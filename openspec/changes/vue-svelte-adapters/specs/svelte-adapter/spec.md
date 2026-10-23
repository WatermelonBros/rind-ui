## ADDED Requirements

### Requirement: Binding A Service

`@rind-ui/svelte` SHALL create one service per component instance at initialisation, push the
latest props to it before every update, start it after mount and stop it on destroy, and update
the instance when the service's snapshot changes. It SHALL never start a service during server
rendering.

#### Scenario: Destroy

- **WHEN** a component is unmounted
- **THEN** its service is stopped and every effect cleanup of its active state has run

#### Scenario: Server render

- **WHEN** a component is rendered with `svelte/server`'s `render`
- **THEN** the markup carries the part's roles and attributes and no effect ran

### Requirement: Prop Normalisation

The adapter SHALL convert connect's framework-neutral props into Svelte props in one place
shared by every part: handlers to Svelte event attributes (`onKeyDown` → `onkeydown`,
`onFocusIn` → `onfocusin`), the style object to a declaration string, attributes unchanged,
`inert` to an empty attribute when true and absent when false.

#### Scenario: Neutral attributes reach the DOM

- **WHEN** connect produces `aria-*`, `data-*`, `id`, `role`, a style and an event handler
- **THEN** the rendered element carries the same attributes and style, and the handler fires on
  the corresponding DOM event

### Requirement: Merging Consumer Props

Every part SHALL merge the consumer's rest props with its own: handlers SHALL both run, the
consumer's first; `event.preventRindHandler()` SHALL skip the part's handler; classes SHALL
combine and styles concatenate with the consumer's last; attachments (including the consumer's
`{@attach}`) SHALL all run; the consumer's `id` SHALL replace the generated one; for other
attributes the consumer SHALL win, and overriding an attribute the part's accessibility depends
on SHALL warn in development.

#### Scenario: Reserved theme attributes

- **WHEN** a part receives `data-variant`, `data-size` and `data-tone`
- **THEN** its element carries them unchanged and behaviour is identical

### Requirement: Controlled Values With Bindings

A part with a controllable value `<value>` SHALL make it `$bindable`: with `bind:<value>` the
binding receives every accepted change; with a function binding the getter alone decides the
value (fully controlled); without a binding the prop is the starting value. It SHALL also accept
`on<Value>Change(value, details)`, called first, where `details.cancel()` vetoes the change.

#### Scenario: Fully controlled

- **WHEN** a Toggle is bound with `bind:pressed={() => pressed, () => {}}` and the user
  activates it
- **THEN** it stays as the parent's `pressed` says

### Requirement: Element Substitution With Snippets

Every part SHALL accept a `child` snippet receiving `{ props, state }`: rendered instead of the
part's default element, the element the consumer spreads `props` on SHALL receive every
attribute, handler and the part's element ref (an attachment), so behaviour is unchanged. The
`children` snippet SHALL receive the part's state.

#### Scenario: Render as a link

- **WHEN** `Toggle.Root` is given a `child` snippet rendering `<a href {...props}>`
- **THEN** the anchor is the button (role, `aria-pressed`, handlers) and activating it toggles

### Requirement: Stable Ids

Each instance SHALL get its root id from `$props.id()` or the consumer's `id`, and derive every
part id from it, so server and client render identical ids. Relations SHALL reference only
rendered parts.

#### Scenario: Two instances

- **WHEN** two instances of a component render on one page
- **THEN** no id is shared between them

### Requirement: Provider

`RindProvider` SHALL give every component below it locale, direction, message overrides,
announcer, typeahead timeout, environment options and icon components, nested providers
overriding their parent field by field, as in `@rind-ui/react`.

#### Scenario: Platform override

- **WHEN** a component renders under `<RindProvider environment={{ platform }}>`
- **THEN** its machine reads that platform

### Requirement: Component Entries

The package SHALL export each component as a module namespace with React's part names from the
root and from `@rind-ui/svelte/<component>`, and its `package.json` `exports` SHALL list exactly
the components it ships (written by the build).

#### Scenario: Subpath import

- **WHEN** code imports `{ Toggle }` from `@rind-ui/svelte/toggle`
- **THEN** `<Toggle.Root>` and `<Toggle.Indicator>` are Svelte components

### Requirement: Contract Parity

Every component the package ships SHALL pass its contract's model-based test (`testMachine`)
rendered with the Svelte parts, in jsdom and in real browsers.

#### Scenario: Toggle model

- **WHEN** the Toggle contract model runs against `Toggle.Root` uncontrolled, starting on and
  fully controlled
- **THEN** every path passes in every modality
