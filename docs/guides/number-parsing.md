# number-parsing

The shared capability that turns text a user types or pastes into a number and back, for a locale and `Intl.NumberFormat` options. Used by [Number Input](../components/number-input.md); later numeric fields reuse it. It wraps `@internationalized/number` and adds what that lacks: Persian digits, group separators and literal prefixes in partial input, no silent rounding, and value text for assistive technology.

```ts
import { createNumberParser } from "@rind-ui/core"

const parser = createNumberParser("de-DE", { style: "currency", currency: "EUR" })
parser.parse("1.234,56 €") // 1234.56
parser.parse("1.2.3") // null: never a partial number
parser.isPartial("1.234,") // true: typing could still complete it
parser.format(1234.5) // "1.234,50 €"
parser.valueText(-5) // "−5,00 €" (U+2212 minus, for assistive technology)
```

`createNumberParser(locale, options)` is cached by value, so an inline options object on every render reuses the same parser.

| Member | Behaviour |
|---|---|
| `parse(text)` | The number the text means in the locale, or `null`. Accepts the locale's separators, an ASCII `-` / `+`, currency and unit text, accounting parentheses as negative, and the digits of `latn`, `arab`, `arabext`, `deva`, `beng`, `hanidec` and `fullwide`. Percent moves the decimal point in the text (414% is exactly 4.14). |
| `isPartial(text, { allowNegative })` | Whether more typing could make the text a number. Group separators anywhere and an incomplete currency, unit or percent literal are accepted. |
| `format(value, { step, numberingSystem })` | The display text. Without rounding options nothing is rounded: as many fraction digits as the value and the step need (up to 20). |
| `valueText(value, { step })` | `format` with U+2212 for every minus. |
| `numberingSystem(text)` | The numbering system the text is written in, to keep it when reformatting. |
| `decimal`, `allowsFraction`, `resolved` | The locale's decimal separator, whether a decimal can be typed at all, and the resolved `Intl` options. |

`keypadDecimal(inserted, parser, deviceLocale)` handles the touch-keypad quirk: a keypad inserts `.` or the device's decimal separator whatever the field's locale; it is mapped to the field's decimal.
