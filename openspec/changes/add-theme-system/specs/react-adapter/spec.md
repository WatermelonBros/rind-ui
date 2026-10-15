## ADDED Requirements

### Requirement: Reserved Theme Attributes

`data-variant`, `data-size` and `data-tone` SHALL be reserved for consumers and themes.
Connect SHALL never emit them, every part SHALL forward them unchanged from its props to
its rendered element (including elements substituted with `render`), and no machine,
connect or part SHALL read them.

#### Scenario: Variant reaches the DOM

- **WHEN** a consumer renders a Button part with `data-variant="outline"`
  `data-size="sm"` `data-tone="danger"`
- **THEN** the rendered element carries exactly those three attributes and the
  component's behaviour is identical to rendering it without them

#### Scenario: Render substitution

- **WHEN** the same part is rendered with `render={<a href="/x" />}`
- **THEN** the anchor carries the three attributes

### Requirement: Provider Icons

`RindProvider` SHALL accept an `icons` prop mapping icon names (the `theme-icons` token names)
to components, typed so that only known names compile. Indicator parts SHALL render the mapped
component as children when the consumer gave none, and nothing extra when no entry exists.

#### Scenario: Typed by icon name

- **WHEN** `icons={{ chek: Foo }}` is compiled
- **THEN** the compiler reports an unknown key

#### Scenario: Empty indicator gets the provider icon

- **WHEN** `icons={{ x: MyX }}` is provided and a Dialog close button has no children
- **THEN** it renders `MyX`
