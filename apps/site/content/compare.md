# rind-ui compared to other headless libraries

Every headless library gives you behaviour and accessibility without styles. They differ in
what else they ship, how mature they are and which frameworks they run on. This page says
where rind-ui is different, where other libraries are ahead, and when you should pick them
instead. It is written by the rind-ui maintainers; the gaps it lists are tracked in the open.

<!-- coverage -->

## What rind-ui does differently

- **A test driver for every component.** Each component ships a driver: what a user does
  (`expand`, `toggle`, `select`) and asks (`isChecked`, `expanded`). The same test runs in
  Testing Library and in Playwright and never reaches into your markup.
- **Machine-readable contracts.** Every component's behaviour is a declared state machine plus
  a contract of actions and queries. Model-based tests walk the machine's graph, so every state
  and transition is exercised, not only the ones someone thought to test.
- **Built for coding agents.** The whole API (props, parts, `data-*` attributes, states,
  actions) is generated from source into `llms.txt`, `llms-full.txt` and a markdown twin of
  every page. An agent can write with rind-ui and check its own work with the drivers.
- **AI-UI primitives.** Prompt Input, Message Thread, Streaming Message and Reasoning are
  headless components with the same keyboard, screen-reader and test guarantees as a Dialog.
  None of the libraries below ships them.
- **One styling contract.** Every part exposes `data-scope`, `data-part` and `data-state`;
  the optional theme is a white-label system that derives a full palette from a few brand
  inputs and validates contrast in light and dark.
- **Research before code.** Each component starts from a written study of how the other
  libraries built it and which bugs their users reported over the years.

## Where other libraries are ahead

### React Aria (Adobe)

The most thorough accessibility and internationalisation work in the field, proven in
Adobe's products for years. It ships translations for more than 30 languages, deep
collection and drag-and-drop support, and a large team. React Aria also publishes
`@react-aria/test-utils`, testers for a set of its components.
**Pick it if** you need a long production record and many locales today.

### Radix Primitives

The most widely adopted headless library, and the base of a large ecosystem of copy-paste
component kits. Answers to almost any question already exist online. It ships fewer
components than most, and its development has slowed.
**Pick it if** your team already builds on that ecosystem.

### Base UI

From the people behind Radix, Material UI and Floating UI, with a company behind it and a
carefully designed API.
**Pick it if** you want a company-backed React library with a polished API.

### Ark UI

Runs on React, Vue, Solid and Svelte today, built on the same idea as rind-ui: components
as state machines (Zag.js). rind-ui's core is framework-free too: {{released}} are published{{partial}}<!-- unreleased -->,
{{unreleased}} not yet<!-- /unreleased -->.
**Pick it if** you need a component rind-ui does not ship yet<!-- unreleased -->, or {{unreleased-or}} now<!-- /unreleased -->.

### Headless UI

The smallest and simplest API, made by the Tailwind CSS team for Tailwind projects.
**Pick it if** you need a handful of components and nothing more.

### Ariakit, Reka UI, Bits UI, Kobalte

Ariakit is a careful, low-level toolkit for React and Solid. Reka UI (Vue), Bits UI
(Svelte) and Kobalte (Solid) bring the Radix model to other frameworks.

## When not to choose rind-ui yet

<!-- pre-1.0 -->
- You need a 1.0 with a frozen API: rind-ui is still in 0.x.
<!-- /pre-1.0 -->
- You need a long record in production: rind-ui's first production user is Reado, an IDE
  by the same author.
<!-- unreleased -->- You need {{unreleased-or}} today.
<!-- /unreleased -->
- You need built-in translations for many locales: rind-ui's messages ship in English and
  are overridable, but not translated yet.
- Your policy rules out dependencies with a single maintainer.

## When rind-ui fits

<!-- 1.0+ -->
- You want a stable API: rind-ui is 1.0 and follows semantic versioning, so only a major
  release removes or renames anything, and the old name warns for a minor release first.
<!-- /1.0+ -->
- You want every component tested from the outside, the way a user drives it, in both
  Testing Library and Playwright.
- You build with coding agents and want them to know the API and verify what they write.
- You are building an AI product and need accessible chat primitives.
- You re-skin one product for many brands and want contrast checked, not hoped for.

## How this page is kept honest

Component counts come from rind-ui's inventory of every headless library (collected from
their documentation and source in October 2026) and are approximate where a library's
boundaries are fuzzy. Every point above where another library is ahead is tracked as a gap
below, with what rind-ui will do about it. Corrections are welcome as issues.

<!-- gaps -->
