## Purpose

Defines how rind-ui components get their locale, text direction and every string
that reaches assistive technology, with typed English defaults that consumers
override per component or once for a tree, and locale-aware formatting.

## ADDED Requirements

### Requirement: Typed Messages With English Defaults

Each component that produces text reaching assistive technology (default labels,
announcements, hints, segment names, role descriptions, value texts) SHALL export a
typed `messages` object with English defaults. Parameterised messages SHALL be
functions with typed parameters; plural forms SHALL be chosen with the locale's plural
rules, without an ICU parser in core. Consumers SHALL be able to override any subset
through a `messages` prop or the provider; a key or parameter type that does not exist
SHALL be a compile error.

#### Scenario: Partial override

- **WHEN** a consumer passes `messages={{ close: "Chiudi" }}` to a component
- **THEN** the close button's name is "Chiudi" and every other string keeps its
  English default

#### Scenario: Unknown key

- **WHEN** a consumer passes a `messages` key the component does not declare
- **THEN** the code does not compile

#### Scenario: Plural

- **WHEN** a count message is rendered for 1 and for 5 in English
- **THEN** it reads "1 result" and "5 results"

### Requirement: No Hard-Coded AT Strings

Every string a component exposes to assistive technology SHALL come from its
`messages`.

#### Scenario: Pseudo-locale

- **WHEN** a component is rendered with every message replaced by a pseudo-localised
  value
- **THEN** no accessible name, description, `aria-roledescription`,
  `aria-valuetext` or announcement contains an English default

### Requirement: Locale And Direction

The environment SHALL provide a locale and a direction. Unless set by the provider or
a component prop, the locale SHALL default to the document element's `lang`, then the
browser language, and SHALL follow `languagechange`; the direction SHALL default to the
locale's text direction (from the platform's locale text info when available,
otherwise from a list of right-to-left scripts and languages). Every part rendered
outside its component's root element SHALL carry the root's `dir` and `lang`.

#### Scenario: Arabic page

- **WHEN** the document has `lang="ar"` and no provider sets a direction
- **THEN** components resolve `dir` to `rtl`

#### Scenario: Portalled content (RTL inside portals)

- **WHEN** a component under `dir="rtl"` renders its content in a portal at the end of
  `body`
- **THEN** the portalled content carries `dir="rtl"` and the component's `lang`

### Requirement: Provider

`@rind-ui/react` SHALL offer a provider that sets locale, direction, message
overrides, the announcer and the typeahead timeout for every component below it;
nested providers SHALL override their parent's values field by field, and a component
prop SHALL override the provider.

#### Scenario: Nested provider

- **WHEN** an outer provider sets locale `de-DE` and direction `ltr` and an inner
  provider sets only locale `he-IL`
- **THEN** components inside the inner provider use `he-IL` and the direction resolved
  for `he-IL`, `rtl`, unless the inner provider sets a direction

### Requirement: Locale-Aware Formatting

rind-ui SHALL provide number formatting, collation (search usage, base sensitivity),
plural rules and sentence segmentation for the current locale, cached per locale and
options so repeated calls do not construct new formatters. Value texts
(`aria-valuetext`) SHALL be formatted with the component's locale and format options.

#### Scenario: Accent-insensitive match

- **WHEN** typeahead compares "é" with "e" under locale `fr-FR`
- **THEN** the collator reports them equal

#### Scenario: Percent value text

- **WHEN** a value of 0.5 is formatted as a percent for locale `de-DE`
- **THEN** the text is "50 %" (with a no-break space before the sign)
