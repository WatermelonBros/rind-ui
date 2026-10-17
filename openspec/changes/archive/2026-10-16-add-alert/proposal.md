## Why

Inline alerts ("Couldn't save", "Connection lost") must reach screen-reader users when
they appear and must stay quiet when they are simply part of the page. Every library
puts `role="alert"` on the visible box, and every one inherits the same failures: a
region mounted with its text is not reliably spoken (chakra-ui#3240,
mui/material-ui#40198), alerts present at load or re-inserted are spoken again
(ariakit#7235, mui/material-ui#49440), success messages interrupt like errors, live
content goes silent while a menu or dialog hides the page (radix#1820), and dismissing
the focused alert drops focus to `body` (Reado today). rind-ui already has the answer
for announcements — the injected Announcer that Toast uses — so Alert specifies when it
speaks, through that channel, and what happens to focus when it goes.

Research: [alert](../../../docs/research/alert.md) (sources, Bug history,
Accessibility — including why Alert does not use the native live role rule 23 would
allow) · [accessibility](../../../docs/research/accessibility.md) §7, rules 4, 11, 23,
25 · [assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 D, E · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (archived: runtime with controllable `open`, `$sync`,
effects, contracts, drivers, `testMachine`, React adapter), `add-a11y-foundations`
(Announcer + `prepare()`, recording backend and announcement log, `messages`,
`focusSafely`, dev logger, invariants), `add-overlay-infrastructure` (`presence` and its
contract trait, `tabbables`), `add-theme-system` (tokens, `status` family) and, for
the Title-as-heading recipe only, `add-heading`.

## What Changes

- `@rind-ui/core`: `alert` machine (open/closed, controllable), connect, contract,
  messages (`dismiss`); `core/dom/alert-text.ts` (the text to announce, observed for
  changes).
- Behaviour: no live region anywhere; with `announce="polite" | "assertive"` the alert's
  text is announced once through the Announcer when it appears after hydration and when
  its text changes; never for server-rendered alerts, never on dismissal, never with
  `announce="off"`; the default is `"polite"`. Dismissal through `CloseTrigger` moves focus to a
  neighbour when it was inside. Decorative icon by default, optional icon label for the
  severity.
- `@rind-ui/react`: `Alert.Root`, `Icon`, `Title`, `Description`, `CloseTrigger`.
- `@rind-ui/testing`: `getAlert` driver with the announcement log.
- Theme stylesheet (`--rind-alert-*`, `status` family), stories, docs page.

## Capabilities

### New Capabilities

- `alert`: the Alert component — anatomy, announcement rules, priority, page-load
  silence, dismissal and focus, icon and severity, `data-*`, contract and driver, theme.

### Modified Capabilities

None.

## Non-goals

- A native `role="alert"` / `role="status"` live region (research: Accessibility). A
  consumer who adds one is flagged by the rule-23 invariant.
- Auto-dismiss, stacking, a hotkey region: Toast.
- Moving focus to the alert when it appears; the form "error summary" pattern (focus
  the summary on submit) is documented as consumer code.
- Escape to dismiss (an alert is not a layer).
- Severity-specific icons or a `severity` prop: the core is headless; severity is text
  and `data-tone` is the theme's.
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/alert/{alert.machine,alert.connect,alert.contract,alert.messages}.ts`,
  `packages/core/src/dom/alert-text.ts`, `packages/react/src/alert/*`, `getAlert` in
  `@rind-ui/testing`, `packages/theme/src/alert.css`, stories, generated docs page.
- Public API: `alert` machine/connect/contract, `Alert` parts, `getAlert`.
- Reado: its `role="alert"` divs (`GuidedReviewPanel`, `CodeOverlays`, `ImageView`,
  `Editor`) become `Alert` with explicit `announce` (Migration in design.md).
- No new runtime dependency.
