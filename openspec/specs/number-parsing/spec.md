# number-parsing Specification

## Purpose
Defines how rind-ui turns text a user types or pastes into a number and back, for a locale
and `Intl.NumberFormat` options: which partial input is acceptable while typing, how a
complete text is parsed, and how a value is formatted for display and for assistive
technology. Introduced by `add-number-input`; reused by every numeric text field.
## Requirements
### Requirement: Parse In The Locale

Parsing SHALL interpret text with the component's locale and format options: the locale's
decimal and group separators, its minus and plus signs (an ASCII `-` and `+` SHALL also be
accepted), currency symbols and codes, percent and per-mille signs, unit literals in every
plural form the formatter produces, accounting parentheses as a negative sign, and
whitespace or bidi formatting characters around them. Percent values SHALL be parsed by
moving the decimal point in the text, never by floating-point division. Text that is not a
number in that locale SHALL parse to no value (`null`), never to a partial number.

#### Scenario: German currency

- **WHEN** "1.234,56 €" is parsed with locale `de-DE` and `{ style: "currency", currency: "EUR" }`
- **THEN** the result is 1234.56

#### Scenario: Percent without float error (zag#2783)

- **WHEN** "414%" is parsed with `{ style: "percent" }`
- **THEN** the result is exactly 4.14

#### Scenario: Accounting negative

- **WHEN** "($57.00)" is parsed with `{ style: "currency", currency: "USD", currencySign: "accounting" }`
- **THEN** the result is -57

#### Scenario: Plural unit literals (react-spectrum#6861)

- **WHEN** a value of 2 formatted with locale `ar` and `{ style: "unit", unit: "day", unitDisplay: "long" }` is parsed back
- **THEN** the result is 2

#### Scenario: Implausible text (base-ui#5424)

- **WHEN** "1.2.3" is parsed with locale `en-US`
- **THEN** the result is `null`

### Requirement: Numbering Systems

Parsing SHALL accept digits of the numbering systems `latn`, `arab`, `arabext` (Persian),
`deva`, `beng`, `hanidec` and `fullwide` in any locale whose locale identifier does not fix a
numbering system, choosing the numbering system that makes the whole text valid. Formatting
SHALL keep the numbering system the user typed while the field shows that value.

#### Scenario: Persian digits (base-ui#4718)

- **WHEN** "۱۲۳" is parsed with locale `fa-IR`
- **THEN** the result is 123

#### Scenario: Hindi digits (react-spectrum#6623)

- **WHEN** "१२३" is parsed with locale `hi-IN`
- **THEN** the result is 123

#### Scenario: Full-width digits from an IME (zag#1507)

- **WHEN** "１２" (full-width) is parsed with locale `ja-JP`
- **THEN** the result is 12

### Requirement: Partial Input

A validity check for partial input SHALL report whether text could become a number by
further typing in the locale and options: a lone sign, a trailing decimal separator, digits
with group separators anywhere (including a leading one), and incomplete literals (a prefix of
a currency, unit or percent literal) SHALL be acceptable; a minus sign SHALL be acceptable
only when negative values are allowed; a decimal separator SHALL NOT be acceptable when the
format allows no fraction digits; any other character SHALL NOT be acceptable.

#### Scenario: Deleting before a group separator (react-spectrum#5927)

- **WHEN** ",337" is checked with locale `en-US`
- **THEN** it is acceptable, and it parses to 337

#### Scenario: Multi-character currency (base-ui#5107)

- **WHEN** "R$ 12" and "R$ 12," are checked with locale `pt-BR` and `{ style: "currency", currency: "BRL" }`
- **THEN** both are acceptable

#### Scenario: Minus not allowed

- **WHEN** "-" is checked for a field whose minimum is 0
- **THEN** it is not acceptable

#### Scenario: Integer format

- **WHEN** "1." is checked with `{ maximumFractionDigits: 0 }` and locale `en-US`
- **THEN** it is not acceptable

### Requirement: Keypad Decimal Separator

On touch platforms (iOS, iPadOS, Android), when the user inserts `.` or the decimal
separator of the device's locale and it differs from the field's decimal separator, the
inserted character SHALL be treated as the field's decimal separator (touch keypads
often emit `.` regardless of locale). This SHALL be a quirk entry
(react-spectrum#5731, ark#3500).

#### Scenario: Italian iPhone, English field

- **WHEN** on iOS with device locale `it-IT` the user types "1", ",", "5" into a field with locale `en-US`
- **THEN** the field's text is "1.5" and it parses to 1.5

### Requirement: Formatting For Display

Formatting SHALL use the locale and format options. When the options set no fraction-digit
limits, the formatter SHALL NOT round the value: it SHALL show as many fraction digits as the
value and the step need (up to 20). When the options set fraction digits or rounding, the
value a field commits SHALL be the value of the formatted text (what the user sees is what
is submitted). Format options SHALL be compared by value, never by object identity.

#### Scenario: No silent rounding (base-ui#5420)

- **WHEN** 1.23456 is formatted with locale `en-US` and no options
- **THEN** the text is "1.23456"

#### Scenario: Explicit rounding

- **WHEN** a field with `{ maximumFractionDigits: 2 }` commits the typed text "1.239"
- **THEN** the committed value is 1.24 and the text is "1.24"

#### Scenario: Inline options object (react-spectrum#1893, react-spectrum#9899)

- **WHEN** a parent re-renders a field while the user is typing, passing a new but equal
  `formatOptions` object each time
- **THEN** the typed text is not reset

### Requirement: Value Text For Assistive Technology

The value text SHALL be the formatted value, with every hyphen-minus replaced by U+2212
MINUS SIGN and accounting parentheses replaced by a leading minus, so screen readers say
"minus" (react-spectrum#4160). An empty value SHALL produce the component's "empty" message.

#### Scenario: Negative currency

- **WHEN** -57 is formatted for assistive technology with `{ style: "currency", currency: "USD", currencySign: "accounting" }` and locale `en-US`
- **THEN** the value text is "−$57.00"

