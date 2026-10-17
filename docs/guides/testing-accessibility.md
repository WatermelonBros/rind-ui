# Testing accessibility

`@rind-ui/testing` checks accessibility as part of every model-based test, not as a
separate suite.

- **Generic invariants** run after every step of `testMachine`: names, roles, id
  references, `aria-*`/`data-*` agreement, focus never lost, `data-focus-visible` only
  after keyboard or virtual input, focus never commits (a screen-reader cursor landing on
  a tab does not select it), IME Enter never commits, no hover from touch, bare clicks
  activate once (`virtual-parity`), and — for `composite-activedescendant` contracts —
  Apple-only announcement parity. A failure names the invariant and the step path.
- **Modalities, directions, platforms**: `testMachine(contract, { modalities, directions:
  ["ltr", "rtl"], platforms: [platforms.apple, platforms.windows] })`. `currentRun()` gives
  the setup the platform and locale of the run.
- **Exceptions** are declared on the contract (`exceptions`) and must name a quirk that
  lists the invariant.
- **Announcements**: `installAnnouncementLog()` / `recordingAnnouncer()` and the driver's
  `announcements()`.
- **Virtual screen reader** (jsdom): `spokenLog(container, (virtual) => virtual.next())`
  and `liveAnnouncements()`.
- **Chromium's tree** (Playwright): `chromiumTree(page)` and `axNodeOf(page, expr)` from
  `@rind-ui/testing/playwright`; the Playwright runner checks names through `inert`,
  description targets and exposed popups automatically.
- **State examples**: every contract state has a site example (`states` in
  `apps/site/examples/<slug>.tsx`, checked by the coverage check), and each example's ARIA
  snapshot is checked in Chromium, Firefox and WebKit.
- **Pseudo-locale**: `pseudoMessages(defaults)` and `englishLeaks(container)` find
  untranslated strings.
- **Real screen readers** run nightly (VoiceOver + Playwright's WebKit, NVDA + Chrome), non-blocking;
  see the [support matrix](../accessibility/support-matrix.md).

## What assistive technology sees, per state

Each state example's ARIA snapshot is generated into the docs page with a
`<!-- aria:<slug>--<example> --><!-- /aria -->` block (snapshots live in
`packages/testing/fixtures/__aria__`). The disclosure fixture, open:

<!-- aria:disclosure--open -->
```yaml
- button "Details" [expanded]
- text: Body text
```
<!-- /aria -->

## Setup and cleanup

List `@rind-ui/testing/setup` in your runner's `setupFiles`. It fills in the DOM APIs a
simulated DOM lacks (nothing changes in a real browser), records errors and
announcements from the first render, and registers two `afterEach` hooks: one resets
rind-ui's document-level state (layer stack, scroll lock, logs), the other runs Testing
Library's `cleanup`, so a second `render` in the same file does not leave the first tree
in the document. Without that cleanup a driver would find two matching components and
fail ("2 elements match the anchor"). Vitest without `globals` does not run Testing
Library's own auto-cleanup, so the setup does it for you; `afterEach` is taken from the
globals when present, else from `vitest`.

To manage cleanup yourself, opt out from an earlier setup file:

```ts
// vitest.setup-first.ts, listed before @rind-ui/testing/setup
globalThis.RIND_AUTO_CLEANUP = false
```
