# clipboard Specification

## Purpose
TBD - created by archiving change add-code-block. Update Purpose after archive.
## Requirements
### Requirement: Injected Clipboard Capability

The Environment SHALL expose a `clipboard` capability with
`writeText(text: string, options?: { near?: Element }): Promise<void>`, so machines copy text
through an injected abstraction and tests run without a DOM. The test environment SHALL provide
a fake that records writes and can be told to reject or to be absent.

#### Scenario: Fake in node tests

- **WHEN** a machine copies "abc" in a node test with the fake clipboard
- **THEN** the fake's log holds "abc" and the promise resolves

#### Scenario: Fake set to fail

- **WHEN** the fake is set to reject and a machine copies
- **THEN** the promise rejects with an error the machine can report

### Requirement: DOM Clipboard Implementation

The DOM implementation SHALL use `navigator.clipboard.writeText` when it is a function, checked
at call time; when it is absent, or when it rejects (no permission, an iframe without
`clipboard-write`), it SHALL fall back to a temporary visually hidden element holding the
text, inserted next to `near` (or into `document.body` without `near`) so it is inside the same
layer and not inert, selected and copied with `document.execCommand("copy")`, then removed and
the previous selection and focus restored. It SHALL reject when both paths fail, and SHALL never
throw synchronously.

#### Scenario: Insecure context (regression: docusaurus#11791)

- **WHEN** `navigator.clipboard` is undefined
- **THEN** `writeText` uses the fallback and resolves when `execCommand` reports success

#### Scenario: Inside a modal dialog (regression: docusaurus#11109)

- **WHEN** `writeText` falls back with `near` inside an open modal `<dialog>`
- **THEN** the temporary element is inserted inside the dialog and the copy succeeds

#### Scenario: Focus and selection restored

- **WHEN** the fallback runs while a text selection exists and a button has focus
- **THEN** after the copy the same selection exists and the same button has focus

#### Scenario: Both paths fail

- **WHEN** the Clipboard API rejects and `execCommand` returns false
- **THEN** `writeText` rejects and nothing is thrown synchronously

