## ADDED Requirements

### Requirement: Part Namespaces Are Tree-Shakeable

A compound component SHALL expose its parts as an ES module namespace, which bundlers that
shake namespace members (at least Rolldown and Rollup) can tree-shake member by member: a consumer that renders some parts SHALL NOT bundle the parts it never
references, nor what only those parts import. Importing the namespace and rendering
`<Name.Part>` SHALL keep working with the same types, from the package root and from the
component's subpath.

#### Scenario: Color Picker without inputs

- **WHEN** an application renders `ColorPicker.Root`, `ColorPicker.Area` and
  `ColorPicker.ChannelSlider` only, and is bundled for production with Rolldown
- **THEN** the bundle contains no Number Input, Radio Group or format-select implementation

#### Scenario: Same consumer code

- **WHEN** existing code imports `{ Dialog }` from `@rind-ui/react` and renders
  `<Dialog.Root>`, `<Dialog.Trigger>` and `<Dialog.Content>`
- **THEN** it compiles and behaves as before

#### Scenario: Unknown part

- **WHEN** code renders `<Dialog.Nope>`
- **THEN** the code does not compile
