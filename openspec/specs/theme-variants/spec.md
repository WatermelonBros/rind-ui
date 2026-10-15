# theme-variants Specification

## Purpose
Defines the ready-made component variants — `data-variant`, `data-size` and `data-tone`
set by the consumer and styled only by the theme — the per-family matrix, and how each
component stylesheet plugs into the token tiers.
## Requirements
### Requirement: Consumer Attributes, Core Untouched

`data-variant`, `data-size` and `data-tone` SHALL be set only by the consumer. The
core's connect functions SHALL NOT emit or read them, and every part SHALL forward
them unchanged to its element. Behaviour, ARIA output and contract results SHALL be
identical with and without them.

#### Scenario: Pass-through

- **WHEN** a button part is rendered with `data-variant="ghost" data-size="sm"
  data-tone="danger"`
- **THEN** the element carries exactly those values and its contract tests pass
  unchanged

### Requirement: Variant Values

`data-variant` SHALL take `solid`, `soft`, `outline` or `ghost`, each defined by
palette role tokens:

| Variant | Background | Text | Border |
|---|---|---|---|
| `solid` | `solid` / `solid-hover` | `on-solid` | transparent |
| `soft` | `soft` / `soft-hover` | `text` | transparent |
| `outline` | transparent / `soft` | `text` | `border` |
| `ghost` | transparent / `soft` | `text` | transparent |

A value a component family does not support SHALL render that family's default.

#### Scenario: Unsupported value

- **WHEN** a checkbox is rendered with `data-variant="ghost"`
- **THEN** it renders exactly like its default variant

### Requirement: Size Values

`data-size` SHALL take `sm`, `md` (default) or `lg` and SHALL set the local size
tokens (`--rind-size-control`, `--rind-text-control`, `--rind-space-control`) on its
element, which descendants inherit until a descendant sets its own `data-size`.

#### Scenario: Size cascades into a popup

- **WHEN** a menu's content carries `data-size="sm"`
- **THEN** its items use the small control height and text without their own attribute

#### Scenario: Small stays a target

- **WHEN** a `data-size="sm"` button is rendered at density 0.75
- **THEN** its target is at least 24×24 CSS px

### Requirement: Tone

`data-tone` SHALL take `accent` (default), `neutral`, `danger`, `warning` or `success`
and SHALL re-point the accent role tokens inside its element to that palette, so every
variant follows without component-specific rules.

#### Scenario: Destructive confirm

- **WHEN** an alert dialog's confirm button has `data-variant="solid"
  data-tone="danger"`
- **THEN** it uses `danger-solid` and `danger-on-solid`, and focus uses the danger
  border colour

#### Scenario: Every component consumes the tone (chakra-ui#10581)

- **WHEN** each themed component's state stories are rendered with `data-tone="danger"`
  on the story root
- **THEN** every accent-coloured part of every component renders in the danger
  palette

### Requirement: Family Matrix

The theme SHALL support exactly this matrix (default in bold):

| Family | Components | `data-variant` | `data-size` |
|---|---|---|---|
| action | Button, Toggle, triggers styled as buttons | **solid**, soft, outline, ghost | sm, **md**, lg |
| toggle item | Toggle Group item, Toolbar button, link and toggle, Menubar trigger, Navigation Menu trigger and bar link | soft, outline, **ghost** | sm, **md**, lg |
| field | Text Field, Select / Combobox control, Number Input, Date Field, Time Field, Date Range Field, Time Range Field, Date Picker and Date Range Picker fields | **outline**, soft | sm, **md**, lg |
| choice | Checkbox, Radio, Switch | **solid**, soft | sm, **md**, lg |
| selector | Tabs list | **ghost** (underline), soft (pill) | sm, **md**, lg |
| selector | Segmented Control | **soft**, outline | sm, **md**, lg |
| status | Badge, Tag, Alert, Toast | solid, **soft**, outline | sm, **md**, lg |
| identity | Avatar, Avatar Group | solid, **soft**, outline | sm, **md**, lg |
| panel | Dialog, Alert Dialog, Drawer, Popover, Menu, Hover Card, Tooltip, Toolbar root, Menubar root, Navigation Menu viewport and content, Calendar root, Range Calendar root, Date Picker and Date Range Picker popover content, Month Picker and Year Picker root | — | Dialog / Drawer only: sm, **md**, lg (width); others inherit `data-size` into items |
| collection item | Menu item, Listbox option, Calendar and Range Calendar day cell, Month Picker and Year Picker cell | — | inherited |
| link | Link, Breadcrumbs link, Navigation Menu content link | — | — (inherits font size) |
| range | Slider, Progress, Meter | **solid**, soft | sm, **md**, lg |
| decoration | Separator, Skeleton, Image (and future decorative parts) | — | — (look via each component's own tokens: `--rind-separator-*` thickness, `--rind-skeleton-*` sizes, `--rind-image-*` look) |

A component change SHALL place its component in one family; adding a family or a
value SHALL be a change to this capability. The structural components Label, Field,
Fieldset and Form, and Heading, SHALL belong to NO family: they SHALL NOT read `data-variant`, and they
SHALL only read typography and spacing tokens, so an inherited `data-size` scales their
text and spacing and nothing else. Every other component SHALL be in exactly one family.

#### Scenario: Field soft variant

- **WHEN** a text field control has `data-variant="soft"`
- **THEN** it renders with the neutral `soft` background and keeps its
  `border-strong` boundary at 3:1

#### Scenario: Separator has no variant or size

- **WHEN** a Separator is rendered with `data-variant="solid"` and `data-size="lg"`
- **THEN** it renders the `decoration` family default, with its thickness taken from
  its `--rind-separator-*` token

#### Scenario: Structural components have no family

- **WHEN** a Label, a Field, a Fieldset and a Form are each rendered with
  `data-variant="solid"` and `data-size="lg"`
- **THEN** none of the four renders a variant style, and each one's text and spacing use
  the `lg` typography and spacing tokens

#### Scenario: Skeleton and Image ignore variant and size

- **WHEN** a Skeleton and an Image are each rendered with `data-variant="solid"` and
  `data-size="lg"`
- **THEN** each renders the `decoration` family default, with its look taken from its
  own `--rind-skeleton-*` or `--rind-image-*` tokens

#### Scenario: Heading has no family

- **WHEN** a Heading is rendered with `data-variant="solid"` and `data-size="lg"`
- **THEN** it renders no variant style, and its text uses the `lg` typography tokens

#### Scenario: Avatar defaults to the identity family's soft variant

- **WHEN** an Avatar with a visible Fallback is rendered with no `data-variant` and no
  `data-size`
- **THEN** it renders the `identity` default `soft` (tinted fallback) at size `md`, and
  with `data-variant="outline"` it renders the outline look instead

#### Scenario: Toolbar and menubar items share the toggle item look

- **WHEN** a Toolbar button, a Toolbar link and a Menubar trigger are rendered with no
  `data-variant`
- **THEN** each renders the `toggle item` default `ghost` at size `md`, like a Toggle
  Group item

#### Scenario: Links have no variant or size

- **WHEN** a Link, a Breadcrumbs link and a Navigation Menu content link are rendered
  inside text with `data-variant="solid"` and `data-size="lg"`
- **THEN** each renders the `link` family look (underlined, no variant style) at the font
  size of its surrounding text

#### Scenario: Navigation Menu parts follow Menubar's families

- **WHEN** a Navigation Menu trigger and a bar link are rendered with no `data-variant`,
  and a panel is open in the viewport
- **THEN** the trigger and the bar link render the `toggle item` default `ghost` at size
  `md`, and the viewport and its content render the `panel` look, as a Menubar does

#### Scenario: Calendar and date fields follow existing families

- **WHEN** a Calendar, a Range Calendar, a Date Field and a Time Field are rendered with no
  `data-variant`
- **THEN** the calendar roots render the `panel` look, their day cells the `collection item`
  look, and the two fields the `field` default `outline` at size `md`

#### Scenario: Date pickers and range fields follow existing families

- **WHEN** a Date Picker, a Date Range Picker, a Date Range Field, a Time Range Field, a
  Month Picker and a Year Picker are rendered with no `data-variant`, the pickers open
- **THEN** the picker fields and the two range fields render the `field` default `outline` at
  size `md`, the pickers' popover content renders the `panel` look, the Month and Year Picker
  roots the `panel` look and their cells the `collection item` look

### Requirement: Component Stylesheet Convention

Each component SHALL ship one stylesheet `packages/theme/src/<scope>.css`, in
`@layer rind.components`, selecting only on `data-scope`, `data-part`, state
attributes and the three consumer attributes, reading only `--rind-<scope>-*` tokens
with semantic fallbacks, and importable on its own after `tokens.css`. Its component
tokens SHALL be listed in the generated manifest with their fallback and family.
Checked, selected and pressed indicators SHALL draw an edge in the palette `border`
role, so the state meets 3:1 even when `solid` does not.

#### Scenario: Per-component override from an ancestor

- **WHEN** a consumer sets `--rind-button-radius: 0` on a form element
- **THEN** buttons inside the form are square and other components are unchanged

#### Scenario: Yellow checked checkbox

- **WHEN** a checkbox is checked with a light-yellow accent
- **THEN** the checked indicator's edge has at least 3:1 against the background

#### Scenario: Stylesheet imported alone

- **WHEN** a consumer imports only `@rind-ui/theme/tokens.css` and
  `@rind-ui/theme/button.css`
- **THEN** a button renders fully themed

