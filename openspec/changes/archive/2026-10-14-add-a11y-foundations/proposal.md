## Why

Every rind-ui component needs the same accessibility plumbing: knowing *how* the
user is interacting (keyboard, pointer, touch, assistive technology), activating
reliably from every input, normalising keys for RTL and IME, announcing through
live regions that actually speak, localised strings, and hidden content that stays
correct for AT. The research found that most screen-reader bugs in other libraries
come from getting this plumbing wrong once and then copying it into every
component (root causes A–L in the AT note). This change specifies it once, on top
of `add-foundations`, before the first component (Dialog) is built.

Research notes this change is based on:
[accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) ·
[overlay-infrastructure](../../../docs/research/overlay-infrastructure.md) (keep-visible list only)

Depends on: `add-foundations` (machine runtime, injected environment, contracts with
the `pointer | keyboard | touch | virtual` modalities, drivers, `testMachine`).

## What Changes

- **Interaction modality** tracking per window (keyboard / pointer / touch /
  virtual), virtual (AT) click and focus detection, `data-focus` and
  `data-focus-visible` on focusable parts, and `modality` on every interaction
  event a machine receives, so guards can use it. No prototype patching.
- **Press, long press and hover**: one activation model for mouse, touch, pen,
  keyboard and virtual input (activate on release, cancel by moving off,
  Enter/Space rules, key repeat, the macOS ⌘ keyup bug, activation bound to
  `click` for AT), long press with a keyboard twin, hover that never fires from
  touch; `data-pressed` and `data-hover`.
- **Keyboard**: logical keys with the RTL flip decided once, the platform `mod`
  key, an IME composition guard usable as a named machine guard, and the shared
  typeahead timing default (1000 ms, provider-configurable).
- **Announcer**: an injected service with persistent polite/assertive regions that
  follow root cause D, carry `lang`, are never hidden by hide-outside operations,
  are muted in hidden tabs, with an opt-in `ariaNotify` backend; a streaming policy
  (once on completion, or per sentence); contracts declare `focusAnnouncement`,
  `countAnnouncement` and `selectionAnnouncement` for drivers to assert.
- **Messages, locale and direction**: typed per-component `messages` with English
  defaults, a provider for locale, direction and messages, cached `Intl` helpers.
- **Hidden content**: visually hidden styles and part, `hidden="until-found"` with
  `beforematch` turned into an open event.
- **Platform and preferences** in the environment: platform flags and
  `reducedMotion()`.
- **Element ids**: one framework-neutral id derivation so every adapter and connect
  produce the same ids, with item keys encoded into valid id tokens.
- **Quirks registry** (`core/dom/quirks.ts`): every UA-gated workaround is an entry
  with condition, bug links, repro test and removal condition; contracts reference
  quirks to declare invariant exceptions.
- **New generic invariants** for `testMachine` (accessibility.md rule 12; AT note
  invariants 8, 12, 13, 18, 20) and a modality-aware oracle.
- **Test tooling**: virtual screen reader announcement logs, a Chromium CDP
  accessibility-tree helper (`chromiumTree`), partial ARIA snapshots per state
  story, nightly non-blocking Guidepup VoiceOver/NVDA runs, the manual tier-1
  protocol and the support matrix in docs.
- **Theme accessibility** baseline for `@rind-ui/theme`: focus ring, forced
  colors, target size, reduced motion.

## Capabilities

### New Capabilities

- `interaction-modality`: modality tracking, virtual input detection, focus and
  focus-visible attributes, modality on machine events, safe programmatic focus.
- `press-interactions`: press, long press and hover semantics across every input
  type, and their data attributes.
- `keyboard-interactions`: logical keys and RTL, platform modifier, IME guard,
  hotkey matching, typeahead timing.
- `announcer`: the injected announcement service, its live-region and `ariaNotify`
  backends, streaming policy, and contract announcement declarations.
- `i18n-messages`: messages, locale, direction, provider and `Intl` formatting.
- `hidden-content`: visually hidden content and find-in-page reveal.
- `platform-and-preferences`: injected platform detection and reduced-motion
  preference.
- `element-ids`: framework-neutral derivation of part and item ids.
- `a11y-quirks`: the registry of UA-gated workarounds and how contracts reference
  them.
- `a11y-invariants`: generic accessibility invariants and the modality-aware oracle
  added to model-based testing. (A new capability rather than a delta on
  `model-based-testing`: that capability is defined by the unarchived
  `add-foundations`, and OpenSpec deltas can only target specs under
  `openspec/specs/`.)
- `a11y-test-tooling`: announcement logs, the Chromium tree helper, ARIA snapshots,
  nightly screen-reader runs, the manual protocol and the support matrix.
- `theme-accessibility`: what `@rind-ui/theme` guarantees for focus, forced colors,
  target size and motion.

### Modified Capabilities

None. The capabilities this builds on (`machine-runtime`, `component-contract`,
`test-drivers`, `model-based-testing`, `react-adapter`) are introduced by the
unarchived `add-foundations`; additions to them are specified in the new
capabilities above.

## Non-goals

- Any public component. Components consume these modules in their own changes.
- Overlay infrastructure (focus trap, layer stack, `inertOutside`, scroll lock,
  presence, portal) — `add-overlay-infrastructure`. This change only exports the
  keep-visible rule that change must honour.
- Collections, roving focus, `aria-activedescendant` management and the typeahead
  matcher — the collections change. This change fixes only the typeahead *timing*
  default and the IME guard it uses.
- A translations package (`@rind-ui/locales`) — deferred, see design.
- Drags (`setPointerCapture` surfaces) — first needed by Slider.
- `aria-errormessage`, element reflection by default, the `suggestion` role.
- JAWS automation (no driver exists); the manual protocol covers JAWS.
- Framework adapters other than React; fx.

## Impact

- New code in `packages/core`: `dom/` (modality, press, hover, long-press,
  keyboard, live-announcer, visually-hidden, until-found, focus-safely, platform,
  quirks), `a11y/` (event types, guards, announcement policies), `i18n/`
  (messages, locale, direction, formatters), `ids.ts`; new capability interfaces in
  `env/` and their `domEnvironment()` implementations.
- `@rind-ui/react`: `RindProvider` (locale, direction, messages, announcer,
  environment overrides), `VisuallyHidden` part, `inert` normalisation.
- `@rind-ui/testing`: recording announcer, platform presets, new invariants,
  adapter inputs (composing keys, touch hover, virtual focus, context-menu keys),
  `chromiumTree` in `./playwright`, virtual screen reader helper.
- `@rind-ui/theme`: focus ring, forced-colors and hit-area rules in `base.css` /
  `tokens.css`.
- CI: nightly Guidepup workflow (macOS + Windows runners), Playwright ARIA snapshot
  and forced-colors runs.
- Docs: `docs/accessibility/` with the support matrix, the manual protocol, the
  quirks list; resolved open questions noted in the research notes.
- New dev dependencies: `@guidepup/virtual-screen-reader`, `@guidepup/guidepup`,
  `@guidepup/playwright`. No runtime dependency added to `@rind-ui/core` or
  `@rind-ui/react`.
