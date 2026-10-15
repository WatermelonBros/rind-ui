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
- **State stories**: every contract state has a story (`missingStateStories`), and each
  story's ARIA snapshot is checked in Chromium, Firefox and WebKit.
- **Pseudo-locale**: `pseudoMessages(defaults)` and `englishLeaks(container)` find
  untranslated strings.
- **Real screen readers** run nightly (VoiceOver + Playwright's WebKit, NVDA + Chrome), non-blocking;
  see the [support matrix](../accessibility/support-matrix.md).

## What assistive technology sees, per state

Each state story's ARIA snapshot is generated into the docs page with a
`<!-- aria:<story-id> --><!-- /aria -->` block. The disclosure fixture, open:

<!-- aria:foundations-disclosure-fixture--open -->
```yaml
- button "Details" [expanded]
- text: Body text
```
<!-- /aria -->
