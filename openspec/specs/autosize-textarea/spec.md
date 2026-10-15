# autosize-textarea Specification

## Purpose
Defines how a rind-ui textarea grows and shrinks with its content: native `field-sizing:
content` where supported, and otherwise a measured fallback with no side effects on the
value, events or undo. Introduced by `add-text-field`; reused by Prompt Input and Editable.
## Requirements
### Requirement: Content-Sized Height

A textarea with autosize on SHALL take the height of its content, between its minimum
height (`rows`, or the consumer's `min-block-size`) and its maximum height (the
consumer's `max-block-size`). Above the maximum it SHALL scroll. An empty textarea SHALL
keep its minimum height and SHALL NOT collapse to one line. The textarea SHALL NOT be
user-resizable vertically while autosize is on.

#### Scenario: Grow and shrink

- **WHEN** an autosizing textarea with `rows={2}` receives five lines of text, then the
  text is deleted
- **THEN** it grows to five lines, and after the deletion it returns to two lines

#### Scenario: Maximum height

- **WHEN** the consumer sets `max-block-size: 10lh` and the user types 30 lines
- **THEN** the textarea stops at ten lines and scrolls

### Requirement: Native First

When the browser supports `field-sizing: content`, autosize SHALL apply it (with `rows`
mapped to a minimum block size) and SHALL run no measuring code.

#### Scenario: Supported browser

- **WHEN** autosize runs where `CSS.supports("field-sizing", "content")` is true
- **THEN** the textarea's computed `field-sizing` is `content`, and no inline `height` is
  ever written

### Requirement: Side-Effect-Free Fallback

Where `field-sizing` is unsupported, autosize SHALL measure the content height and write an
inline height:

- after every value commit, including a programmatic or controlled value change and a form
  reset;
- when the textarea's width changes;
- when fonts finish loading.

It SHALL write the height no earlier than the next animation frame after a size
observation, so a resize observation never causes another in the same frame. It SHALL use
fractional border and padding sizes. It SHALL NOT override the textarea's `value` property,
dispatch any event, or change the value, the selection or the undo stack. It SHALL stop
all observation and scheduled work on unmount.

#### Scenario: Controlled React textarea (zag#3204, zag#2924)

- **WHEN** a controlled autosizing textarea is cleared by its parent and the user types
  the same character again
- **THEN** `onValueChange` fires once with that character, and the value is not reverted

#### Scenario: Value set externally (kobalte#484)

- **WHEN** the parent sets a controlled value with ten lines
- **THEN** the textarea's height fits ten lines in the next frame

#### Scenario: Inside a drawer (zag#2281)

- **WHEN** an autosizing textarea inside an animating Drawer grows
- **THEN** no "ResizeObserver loop" error is reported

#### Scenario: Fractional device pixel ratio (zag#2312)

- **WHEN** the page is zoomed to 110% and the textarea holds three lines
- **THEN** no scrollbar appears and the height fits the content within one CSS pixel

#### Scenario: Unmounted during a window resize (base-ui#164)

- **WHEN** an autosizing textarea is unmounted and the window is then resized
- **THEN** no error is thrown

