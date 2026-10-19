## Why

A "copy this value" control (API key, URL, install command) ships as a component only in
Ark/Zag, and as a hook or render function in Mantine and Chakra. Its bug history repeats: the
UI says "Copied" before the write settles (Zag), nothing is copied and nothing is shown on
plain HTTP or in a WebView (Mantine), the fallback opens a `window.prompt` (Chakra v2), copies
styled HTML (Chakra#3921) or fails inside a modal or fullscreen element (Chakra#414,
copy-to-clipboard#127), Safari rejects a write that starts after an `await` (VueUse#5368), and
the result is "announced" by swapping the focused button's name, which screen readers do not
speak. rind-ui already has the hard half: the injected `clipboard` capability with its
fallback and test fake, and a copy state machine inside Code Block. This change adds the
component on top of it and makes Code Block share its copy logic.

Research: [clipboard](../../../docs/research/clipboard.md) ·
[code-block](../../../docs/research/code-block.md) (copy bug table) ·
[accessibility](../../../docs/research/accessibility.md) §7 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
causes A, D, H

Depends on: `add-foundations`, `add-a11y-foundations` (Announcer, modality, focus attributes),
`add-button` (`button-like-element`), `add-code-block` (the `clipboard` capability, the DOM
implementation, `fakeClipboard`), `add-theme-system`.

## What Changes

- A public **Clipboard** in `@rind-ui/core` (machine, connect, contract, messages, meta) and
  `@rind-ui/react` (parts `Root`, `Label`, `Control`, `Input`, `Trigger`, `Indicator`,
  `ValueText`).
- Copy states `idle`, `copying`, `copied`, `error`, decided by the write's promise; the
  feedback returns to `idle` after `copyFeedbackDuration` on the injected Scheduler; the result
  announced through the injected Announcer; `onCopy(details)`.
- A stable trigger name that includes the Label ("Copy API key"); a read-only Input that
  selects its value on focus; a native copy of the whole value from the Input counts as a copy.
- Code Block's copy write and announcement move to a module shared with Clipboard; Code Block's
  behaviour does not change.
- The contract Env gains `Part.copySelection()` (the twin of `paste`), for copy from the Input.
- `getClipboard` driver, model-based tests, `clipboard.css`, site example and skin, docs page.

## Capabilities

### New Capabilities

None. The component's requirements are added to the existing `clipboard` capability, which
already holds the injected clipboard it is built on.

### Modified Capabilities

- `clipboard`: adds the Clipboard component — anatomy, copy states, write timing, trigger name,
  announcements, input, disabled, data attributes, messages, contract, invariants, theme.

## Non-goals

- Async values (a value fetched after the click; Safari needs `ClipboardItem` with a promise),
  rich formats (`text/html`, images), reading the clipboard.
- An imperative `copy()` / `setValue()` API; `value` is a plain prop.
- A tooltip with "Copied!": the result is announced and shown by the Indicator.
- Framework adapters other than React; fx.

## Impact

- New: `packages/core/src/components/clipboard/`, `packages/react/src/clipboard/`,
  `getClipboard` in `@rind-ui/testing`, `packages/theme/src/clipboard.css`, site example and
  skin, `docs/components/clipboard.md`.
- Modified: Code Block's machine imports the shared copy effect; `Part` in
  `core/src/contract/env.ts` and the DOM and Playwright adapters gain `copySelection()`;
  `families.ts` lists `clipboard` in the `field` family.
- No new dependency.
