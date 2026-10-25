# solid-adapter Specification

## Purpose
TBD - created by archiving change solid-angular-adapters. Update Purpose after archive.
## Requirements
### Requirement: Binding A Service

`@rind-ui/solid` SHALL create one service per component instance when the component runs, push
the latest props to it whenever a prop it reads changes, start it after mount and stop it on
cleanup, and update the parts when the service's snapshot changes. It SHALL never start a
service during server rendering.

#### Scenario: Cleanup

- **WHEN** a component is unmounted
- **THEN** its service is stopped and every effect cleanup of its active state has run

#### Scenario: Server render

- **WHEN** a component is rendered with `solid-js/web`'s `renderToString`
- **THEN** the markup carries the part's roles and attributes and no effect ran

### Requirement: Prop Normalisation

The adapter SHALL convert connect's framework-neutral props into Solid props in one place
shared by every part: React spellings folded to neutral names, handlers kept as Solid event
props (`onKeyDown`, `onFocusIn`), the style object kept with kebab-case keys, `children`
dropped (the part renders it), `defaultValue` / `defaultChecked` written as `value` /
`checked`, `inert` present when true and absent when false.

#### Scenario: Neutral attributes reach the DOM

- **WHEN** connect produces `aria-*`, `data-*`, `id`, `role`, a style and an event handler
- **THEN** the rendered element carries the same attributes and style, and the handler fires on
  the corresponding DOM event

### Requirement: Merging Consumer Props

Every part SHALL merge the consumer's props with its own reactively: handlers SHALL both run,
the consumer's first; `event.preventRindHandler()` SHALL skip the part's handler; classes SHALL
combine and styles merge with the consumer's last; the consumer's `ref` and the part's SHALL
both receive the element; the consumer's `id` SHALL replace the generated one; for other
attributes the consumer SHALL win, and overriding an attribute the part's accessibility depends
on SHALL warn in development. A prop changed after mount SHALL reach the element without
remounting.

#### Scenario: Both handlers run

- **WHEN** a consumer passes `onClick` to `Toggle.Root` and clicks it
- **THEN** the consumer's handler runs, then the toggle changes

#### Scenario: Reactive attribute

- **WHEN** the consumer's `aria-describedby` signal changes after mount
- **THEN** the element's attribute changes and the part keeps its state

### Requirement: Controlled Values With Callbacks

A part with a controllable value `<value>` SHALL be controlled while the `<value>` prop is not
`undefined` (read on every access, never decided once), uncontrolled from `default<Value>`
otherwise, and SHALL call `on<Value>Change(value, details)` for every change, where
`details.cancel()` vetoes it.

#### Scenario: Fully controlled

- **WHEN** a Toggle is rendered with `pressed={false}` and no change handler, and the user
  activates it
- **THEN** it stays not pressed

#### Scenario: Becomes controlled later

- **WHEN** a Toggle's `pressed` prop is `undefined` at first and later `true`
- **THEN** it shows pressed from then on

### Requirement: Element Substitution With Render Functions

Every part SHALL accept `render(props, state)`: rendered instead of the part's default element,
the element the consumer spreads `props` on SHALL receive every attribute, handler and the
part's ref, so behaviour is unchanged. `children` MAY be a function receiving the part's state.

#### Scenario: Render as a link

- **WHEN** `Toggle.Root` is given `render={(props) => <a href="#" {...props} />}`
- **THEN** the anchor is the button (role, `aria-pressed`, handlers) and activating it toggles

### Requirement: Stable Ids

Each instance SHALL get its root id from `createUniqueId()` or the consumer's `id`, and derive
every part id from it, so server and hydrated client render identical ids. Relations SHALL
reference only rendered parts.

#### Scenario: Hydration

- **WHEN** a component's server HTML is hydrated
- **THEN** no id changes and no hydration warning is logged

### Requirement: Provider

`RindProvider` SHALL give every component below it locale, direction, message overrides,
announcer, typeahead timeout, environment options and icon components, nested providers
overriding their parent field by field, as in `@rind-ui/react`.

#### Scenario: Platform override

- **WHEN** a component renders under `<RindProvider environment={{ platform }}>`
- **THEN** its machine reads that platform

### Requirement: Component Entries

The package SHALL export each component as a module namespace with React's part names from the
root and from `@rind-ui/solid/<component>`; each entry SHALL resolve to JSX under the `solid`
condition and to DOM-compiled JavaScript otherwise, and `package.json` `exports` SHALL list
exactly the components it ships.

#### Scenario: Subpath import

- **WHEN** code imports `{ Toggle }` from `@rind-ui/solid/toggle`
- **THEN** `<Toggle.Root>` and `<Toggle.Indicator>` are Solid components

### Requirement: Contract Parity

Every component the package ships SHALL pass its contract's model-based test (`testMachine`)
rendered with the Solid parts, in jsdom and in real browsers, and render React's markup for the
same props (compared with `canonicalHtml` after Solid's hydration keys and markers are
removed).

#### Scenario: Toggle model

- **WHEN** the Toggle contract model runs against `Toggle.Root` uncontrolled, starting on and
  fully controlled
- **THEN** every path passes in every modality

