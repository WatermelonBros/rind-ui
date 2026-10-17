# theme-scoping Specification

## Purpose
Defines where a theme applies: the default on `:root`, named scopes on any subtree for
multi-tenant pages, nesting, light/dark as an orthogonal axis, portalled content, and
first paint with server rendering and strict CSP.
## Requirements
### Requirement: Default Theme Without Attributes

Importing `@rind-ui/theme` SHALL theme every component with the `calm` preset on
`:root`, with no attribute, class or script required.

#### Scenario: Plain import

- **WHEN** a page imports `@rind-ui/theme` and renders a button with no theme
  attribute anywhere
- **THEN** the button uses the `calm` tokens in the OS colour scheme

### Requirement: Named Scopes

A theme SHALL apply to the subtree of any element carrying
`data-rind-theme="<name>"`. Several named scopes SHALL coexist on one page without
affecting each other. A scope SHALL take every brand input it does not set from its
nearest ancestor scope; a built theme SHALL set all of them, so it never inherits brand
inputs. The element carrying `data-rind-theme` SHALL receive the base text colour,
font and background, except a portal host, which receives text colour and font only.

#### Scenario: Two tenants side by side

- **WHEN** a dashboard renders `[data-rind-theme="acme"]` and
  `[data-rind-theme="globex"]` panels next to each other
- **THEN** each panel's components use its own accent, radius and density

#### Scenario: Nested built theme does not inherit outer inputs

- **WHEN** a `crisp` scope is nested inside an `acme` scope whose radius is `1rem`
- **THEN** components inside the inner scope use `crisp`'s radius

#### Scenario: Live scope inherits the rest

- **WHEN** a scope with no built stylesheet sets only `--rind-brand-accent` inside an
  `acme` scope
- **THEN** its components use the new accent and `acme`'s radius, density and fonts

### Requirement: Light And Dark Are Orthogonal

Colour tokens SHALL follow the element's used `color-scheme`. The theme SHALL set
`color-scheme: light dark` on `:root`, `light` on `[data-theme="light"]` and `dark`
on `[data-theme="dark"]`, at any depth. Any consumer rule that sets `color-scheme`
SHALL switch the tokens the same way. A named theme SHALL never fix the scheme.

#### Scenario: Dark island in a light page (radix-ui/themes#418)

- **WHEN** a tooltip's content carries `data-theme="dark"` in a light page and contains
  a link and a badge
- **THEN** the link and badge use the dark-scheme tokens and meet their contrast pairs
  against the dark surface

#### Scenario: App's own dark class (radix-ui/themes#280)

- **WHEN** an app sets `.dark { color-scheme: dark }` on `<html>` and renders no
  `data-theme`, including on a framework error page
- **THEN** every component renders in the dark scheme

#### Scenario: Tenant and scheme combine

- **WHEN** `[data-rind-theme="acme"][data-theme="dark"]` wraps a dialog trigger
- **THEN** the dialog uses `acme`'s dark-scheme tokens

### Requirement: Portalled Content Keeps The Theme

The host of portalled content SHALL carry the `data-rind-theme` and `data-theme` values
of the nearest ancestors of its logical parent that carry them, and SHALL update them
while mounted when those ancestor attributes change. Tokens SHALL reach portalled
content through these attributes and the cascade only, without framework context.

#### Scenario: Portal content keeps the tenant theme (radix-ui/themes#708)

- **WHEN** a menu is opened from a trigger inside `[data-rind-theme="acme"]` and its
  content is portalled to `body`
- **THEN** the menu content uses `acme`'s tokens, not the `:root` theme

#### Scenario: Scheme switch while a toast is open (chakra-ui#3076)

- **WHEN** a toast is visible and the ancestor's `data-theme` changes from `light` to
  `dark`
- **THEN** the toast repaints in the dark scheme without being re-opened

#### Scenario: Brand switch while a popover is open

- **WHEN** `data-rind-theme` changes on an example's root while a popover is open
- **THEN** the popover content uses the new brand

### Requirement: No Script For First Paint

Theme selection SHALL be expressible entirely in server-rendered markup and static
CSS (attributes plus a stylesheet or a builder-generated `<style>`), so the first
paint is themed without client script. Colour tokens SHALL NOT be transitioned by the
theme, so a scheme or brand change never animates.

#### Scenario: Server-rendered tenant (chakra-ui#2430, shadcn-ui#5476)

- **WHEN** a server renders `<html data-rind-theme="acme" data-theme="dark">` with
  `acme`'s CSS in the `<head>` and the page is loaded with JavaScript disabled
- **THEN** the page renders in `acme`'s dark tokens

#### Scenario: No transition on scheme change (tailwindcss#3272)

- **WHEN** `data-theme` flips from `light` to `dark` on a page with themed buttons
- **THEN** no CSS transition runs on any colour property

### Requirement: Forced Colors Override Tokens

Under `forced-colors: active` the theme SHALL NOT depend on any colour token to show
a component's boundary or state: every variant SHALL keep a border (transparent by
default) and focus SHALL follow `theme-accessibility`.

#### Scenario: Ghost button in high contrast

- **WHEN** a `ghost` and a `soft` button are rendered with forced colors emulated
- **THEN** both buttons show a visible border

### Requirement: Re-Skinning A Built Theme

A theme built by the builder and applied to `:root` (the default `calm` preset in the
`rind.themes` layer) fixes `:root`'s derived tokens, so changing brand inputs on
`:root` alone SHALL NOT be expected to re-skin it. Re-skinning SHALL be done through a
`[data-rind-theme]` scope (where the CSS derivation applies) or by building a new theme
with the builder. The documentation SHALL state this.

#### Scenario: Brand input on root after a built preset

- **WHEN** the built `calm` preset is loaded and a consumer sets `--rind-brand-accent`
  on `:root`
- **THEN** `:root`'s accent tokens are unchanged, and the same input set on a
  `[data-rind-theme="acme"]` scope re-skins that scope

