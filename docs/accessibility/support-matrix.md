# Support matrix

Which screen reader and browser combinations rind-ui supports, and how each is tested.
Tiers follow usage (WebAIM Screen Reader User Survey #11, 2026) and where bugs actually
come from; the reasoning is in
[assistive-tech-and-a11y-testing.md §1.1](../research/assistive-tech-and-a11y-testing.md#11-support-matrix).

| Tier | Combination | Why | How tested |
|---|---|---|---|
| 1 | JAWS + Chrome, NVDA + Chrome | about half of desktop screen-reader users | [manual protocol](manual-protocol.md) before `done` and at release; NVDA + Chrome nightly (Guidepup) |
| 1 | NVDA + Firefox | Firefox has its own accessibility API mapping; many click and role quirks show up only here | manual protocol |
| 1 | VoiceOver + Safari (macOS), VoiceOver + Safari (iOS) | VoiceOver is most of mobile; WebKit causes the most quirks | manual protocol; VoiceOver + WebKit nightly (Guidepup, Playwright's WebKit) |
| 1 | TalkBack + Chrome (Android) | most of the rest of mobile; pointer-event and slider quirks | manual protocol on a real device |
| 2 | JAWS/NVDA + Edge, VoiceOver + Chrome, JAWS + Firefox, Narrator + Edge | Edge is Chromium, so tier 1 covers most of it | on bug report |
| — | VoiceOver + Firefox, Orca | small user base and known AT/browser bugs | issues accepted; no guarantee |

Automated checks run on every change in Chromium, Firefox and WebKit: axe on every
site example, the generic accessibility invariants in every model-based test, the virtual
screen reader in jsdom, ARIA snapshots per state example, and Chromium's own
accessibility tree. They catch regressions; they do not replace a real screen reader.

Each component's docs page shows a **Tested with** table generated from
[tested-with.json](tested-with.json): screen reader and browser versions and the date of
the last manual pass. Workarounds for specific combinations are listed in
[quirks.md](quirks.md).
