## ADDED Requirements

### Requirement: Paste Input

Both adapters SHALL offer a `paste(text)` input to the focused element that dispatches a
real paste: a `paste` `ClipboardEvent` whose `clipboardData` is a `DataTransfer` holding
`text` as `text/plain`, followed, only when that event was not cancelled, by the browser's
own text insertion (`beforeinput` / `input` with `inputType` `insertFromPaste`). The DOM
adapter SHALL perform it through its configured input implementation and Testing Library's
async wrappers; the Playwright adapter SHALL dispatch the same events without importing
Playwright at runtime. `@rind-ui/testing/setup` SHALL install `ClipboardEvent` and
`DataTransfer` only where missing (jsdom), and in a real browser SHALL change nothing.

#### Scenario: Cancelled paste inserts nothing

- **WHEN** a test calls `paste("a, b")` on a focused text input whose `paste` handler reads
  `clipboardData.getData("text/plain")` and calls `preventDefault()`
- **THEN** the handler receives "a, b", and no `beforeinput` or `input` event follows, so the
  input's value is unchanged

#### Scenario: Plain paste inserts the text

- **WHEN** a test calls `paste("hello")` on a focused empty text input with no paste handler,
  in jsdom with the setup in `setupFiles` and in Playwright
- **THEN** in both environments the input receives `beforeinput` and `input` with
  `inputType` "insertFromPaste" and its value is "hello"
