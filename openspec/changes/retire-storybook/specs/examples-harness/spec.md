## ADDED Requirements

### Requirement: Addressable Examples

Every example of the docs site SHALL be reachable at `/examples/<slug>/<example>/<skin>/`
(example name in kebab-case) in the site's static export, rendering only the example inside
`<main data-example-root data-skin>` with no site navigation or decoration, and with reduced
motion forced. `/examples/<slug>/<example>/` SHALL render the `none` skin. The skins SHALL be
`none` (no stylesheet), `bare`, `crisp`, `juicy`, `theme-calm` and `theme-crisp`
(`@rind-ui/theme` with that preset); `?scheme=light|dark` SHALL select the colour scheme.

#### Scenario: Unstyled example

- **WHEN** `/examples/dialog/basic/` is opened
- **THEN** the page contains only the Basic dialog example and no stylesheet other than the
  page's reset applies to it

#### Scenario: Themed example in dark

- **WHEN** `/examples/dialog/basic/theme-crisp/?scheme=dark` is opened
- **THEN** the example renders with `@rind-ui/theme`'s crisp preset in the dark scheme on the
  first paint

### Requirement: Example Index

The site build SHALL write `/examples/index.json` listing every example with its slug, name,
title, the contract states it represents, whether it is hidden from the docs page, and its URL
per skin. Tests SHALL discover examples from it.

#### Scenario: Hidden fixture example

- **WHEN** a module declares an example with `hidden: true`
- **THEN** it appears in `index.json` with a harness URL and is not listed on its docs page

### Requirement: State Examples

An examples module SHALL be able to map contract states to example names; a check SHALL fail
when a component's contract declares a state with no example mapped to it.

#### Scenario: Missing open state

- **WHEN** the dialog contract declares an `open` state and no dialog example is mapped to it
- **THEN** the coverage check fails naming the component and the state
