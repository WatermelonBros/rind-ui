# vue-adapter Specification

## Purpose
TBD - created by archiving change vue-svelte-adapters. Update Purpose after archive.
## Requirements
### Requirement: Binding A Service

`@rind-ui/vue` SHALL create one service per component instance at setup, push the latest props
to it before every render, start it after mount and stop it before unmount, and re-render the
instance when the service's snapshot changes. It SHALL never start a service during server
rendering.

#### Scenario: Unmount

- **WHEN** a component unmounts
- **THEN** its service is stopped and every effect cleanup of its active state has run

#### Scenario: Server render and hydration

- **WHEN** a component is rendered with `renderToString` and hydrated with `createSSRApp` with
  the same props
- **THEN** Vue reports no hydration mismatch and no effect ran on the server

### Requirement: Prop Normalisation

The adapter SHALL convert connect's framework-neutral props into Vue props in one place shared
by every part: handlers to Vue listener keys (`onKeyDown` → `onKeydown`, `onFocusIn` →
`onFocusin`), attributes unchanged, `inert` to an empty attribute when true and absent when
false.

#### Scenario: Neutral attributes reach the DOM

- **WHEN** connect produces `aria-*`, `data-*`, `id`, `role` and an event handler for a part
- **THEN** the rendered element carries the same attributes and the handler fires on the
  corresponding DOM event

#### Scenario: Inert false

- **WHEN** connect produces `inert: false`
- **THEN** the element has no `inert` attribute

### Requirement: Merging Consumer Props

Every part SHALL disable attribute inheritance and merge the consumer's attributes and
listeners with its own: handlers SHALL both run, the consumer's first; `event.preventRindHandler()`
SHALL skip the part's handler for that event; classes and styles SHALL combine with the
consumer's style winning per property; the consumer's `id` SHALL replace the generated one in
every relation; for other attributes the consumer SHALL win, and overriding an attribute the
part's accessibility depends on SHALL warn in development.

#### Scenario: Both handlers run

- **WHEN** a consumer listens with `@click` on a trigger part
- **THEN** the consumer's listener runs, then the part's, and the machine receives its event

#### Scenario: Reserved theme attributes

- **WHEN** a part receives `data-variant`, `data-size` and `data-tone`
- **THEN** its element carries them unchanged and behaviour is identical

### Requirement: Controlled Values With v-model

A part with a controllable value `<value>` SHALL accept a `<value>` prop (uncontrolled when
absent), emit `<value>Change(value, details)` for every proposed change and then
`update:<value>` unless a listener called `details.cancel()`, so `v-model:<value>` binds it.

#### Scenario: Cancelled change

- **WHEN** a `pressedChange` listener calls `details.cancel()`
- **THEN** `update:pressed` is not emitted and the part's state does not change

### Requirement: Element Substitution With asChild

Every part SHALL accept `asChild`: its default slot's single element SHALL render instead of
the part's default element and receive every prop, listener and ref the part would have
applied, its own props merged as the consumer layer. With anything other than exactly one
element child the part SHALL render its default element and warn in development. A part's
default slot SHALL receive the part's state.

#### Scenario: Render as a link

- **WHEN** `Toggle.Root` is given `asChild` and an `<a href>` child
- **THEN** the anchor is the button (role, `aria-pressed`, handlers) and activating it toggles

### Requirement: Stable Ids

Each instance SHALL get its root id from Vue's `useId()` or the consumer's `id`, and derive
every part id from it, so server and client render identical ids. Relations SHALL reference
only rendered parts.

#### Scenario: Two instances

- **WHEN** two instances of a component render on one page
- **THEN** no id is shared between them

### Requirement: Provider

`RindProvider` SHALL give every component below it locale, direction, message overrides,
announcer, typeahead timeout, environment options and icon components, nested providers
overriding their parent field by field, and parts SHALL obtain the environment by naming the
capabilities their machine needs, as in `@rind-ui/react`.

#### Scenario: Platform override

- **WHEN** a component renders under `<RindProvider :environment="{ platform }">`
- **THEN** its machine reads that platform

### Requirement: Component Entries

The package SHALL export each component as a module namespace with React's part names from the
root and from `@rind-ui/vue/<component>`, and its `package.json` `exports` SHALL list exactly the
components it ships.

#### Scenario: Subpath import

- **WHEN** code imports `{ Toggle }` from `@rind-ui/vue/toggle`
- **THEN** `Toggle.Root` and `Toggle.Indicator` are Vue components

### Requirement: Contract Parity

Every component the package ships SHALL pass its contract's model-based test (`testMachine`)
rendered with the Vue parts, in jsdom and in real browsers.

#### Scenario: Toggle model

- **WHEN** the Toggle contract model runs against `Toggle.Root` uncontrolled, starting on and
  controlled
- **THEN** every path passes in every modality

