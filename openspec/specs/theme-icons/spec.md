# theme-icons Specification

## Purpose
Defines the default icon set of `@rind-ui/theme` (decision 0010): Phosphor glyphs generated
at build time into `--rind-icon-<name>` custom properties, how component stylesheets draw
them on indicator parts, and how consumers swap them. The core ships no icons.
## Requirements
### Requirement: Icon Tokens Generated From Phosphor

The theme SHALL generate `icons.css` at build time from `@phosphor-icons/core` (a
devDependency of `@rind-ui/theme` only; consumers install nothing) and SHALL declare one
token per glyph as `--rind-icon-<name>: url("data:image/svg+xml,…")` inside `@layer rind`
(on `:where(:root, [data-rind-theme])`). The weight (regular or bold) SHALL be a build
option. Phosphor's MIT licence and attribution SHALL be in the theme's `NOTICE`. The token
set SHALL include at least: `check`, `minus` (indeterminate), `x` (close, remove),
`caret-down`, `caret-up`, `caret-left`, `caret-right`, select),
`magnifying-glass` (search), `eye` and `eye-slash` (password), `plus`, `calendar`, `clock`,
`warning`, `info`, `check-circle`, `x-circle`, `dots-three` (ellipsis, overflow),
`arrow-left` and `arrow-right` (pagination), `copy`.

#### Scenario: Token file contains every name

- **WHEN** the generated `icons.css` is parsed
- **THEN** it declares every token in the list above, each as a `data:image/svg+xml` url,
  all inside `@layer rind`

#### Scenario: No runtime dependency

- **WHEN** the published `@rind-ui/theme` `package.json` is read
- **THEN** `@phosphor-icons/core` appears only in `devDependencies`, and `NOTICE` carries
  its MIT licence text

#### Scenario: Weight option

- **WHEN** the generation script runs with weight `bold`
- **THEN** every token's SVG comes from the bold set and the token names are unchanged

### Requirement: Drawn On Existing Parts

Component stylesheets SHALL draw an icon on an existing indicator part with
`mask-image: var(--rind-icon-<name>)` and `background-color: currentColor`, so plain HTML and
every framework show the icon without markup. Under forced colors the icon SHALL stay
visible by using `CanvasText` as its colour. The core SHALL render no icon element: a part
the consumer filled with children SHALL show those children instead of the masked icon.

#### Scenario: Forced colors

- **WHEN** a Checkbox indicator is rendered with `forcedColors: "active"`
- **THEN** the check glyph is visible and its computed colour is `CanvasText`

#### Scenario: Consumer children win

- **WHEN** an indicator part has consumer children
- **THEN** the children are shown and no masked icon is drawn on the part

### Requirement: Directional Icons Mirror In RTL

Icons that mean "previous" or "next" (`caret-left`, `caret-right`, `arrow-left`,
`arrow-right`) SHALL be mirrored under `[dir="rtl"]` by the component stylesheets that use
them for that meaning; icons that mean a physical direction or no direction SHALL NOT be
mirrored.

#### Scenario: Pagination in RTL

- **WHEN** a pagination "next" button using `arrow-right` is rendered inside `dir="rtl"`
- **THEN** its icon is mirrored horizontally and points left

#### Scenario: Caret down is never mirrored

- **WHEN** a select trigger using `caret-down` is rendered inside `dir="rtl"`
- **THEN** its icon is not mirrored

### Requirement: Swapping Icons In CSS

A consumer SHALL be able to replace any icon by overriding its token, globally or inside a
`[data-rind-theme]` scope, with no change to component CSS.

#### Scenario: Per-tenant override

- **WHEN** a tenant scope sets `--rind-icon-check` to another url and a Checkbox is checked
  inside it and another outside it
- **THEN** the inside indicator draws the tenant's glyph and the outside one the default

### Requirement: Swapping Icons In React

`@rind-ui/react` `RindProvider` SHALL accept `icons={{ <name>: Component }}` typed by icon
name (a typo is a type error). An indicator part SHALL render the provided component as its
children when the consumer gave none; without a provider entry it SHALL render nothing extra
and the CSS token applies.

#### Scenario: Provider typing

- **WHEN** `<RindProvider icons={{ chek: Foo }} />` is compiled
- **THEN** the compiler reports an error for the unknown key `chek`

#### Scenario: Provider icon fills an empty indicator

- **WHEN** `icons={{ check: MyCheck }}` is provided and a Checkbox indicator has no children
- **THEN** the indicator renders `MyCheck`, and with children given it renders the children

