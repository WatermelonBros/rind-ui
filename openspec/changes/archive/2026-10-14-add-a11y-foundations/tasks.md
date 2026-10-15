## 0. Prerequisite

- [x] 0.1 Confirm `add-foundations` tasks 2 (runtime, `core/env`), 3.5 (ids), 4 (contracts) and 5 (testing, `testMachine`) are merged; this change builds on their code

## 1. Platform, preferences and quirks registry

- [x] 1.1 Capability interfaces `PlatformInfo`, `MotionPreference`, `ModalitySource`, `LocaleSource`, `Announcer`, `StyleInjection` in `core/env`; extend `domEnvironment()` with overrides (design §2)
- [x] 1.2 `dom/platform.ts`: detection from user agent data with iPadOS touch-points rule; `platforms.apple|windows|android|linux` presets exported from `@rind-ui/testing`; node tests
- [x] 1.3 `reducedMotion()` + subscription from `matchMedia`; node tests with a fake media query; jsdom test that the setup's `matchMedia` stub yields `false`
- [x] 1.4 `dom/quirks.ts`: `Quirk` type, `defineQuirks` with inferred `QuirkId`, `quirkActive`; type tests for missing link and unknown id
- [x] 1.5 Lint rule (Biome plugin or script in `pnpm lint`) forbidding user-agent and platform-flag reads outside `dom/platform.ts`, `dom/quirks.ts`, `a11y/keys.ts`; a fixture file proves it fails
- [x] 1.6 `quirks:check` script: fail on missing test paths, warn on entries verified > 12 months ago; wired into CI

## 2. Ids

- [x] 2.1 `core/ids.ts` `partId` / `itemId` with injective key encoding; node tests for whitespace keys, `"a b"` vs `"a-b"`, Node/browser equality
- [x] 2.2 Switch the React adapter's `use-ids.ts` to these functions; existing hydration test stays green

## 3. Interaction modality and focus

- [x] 3.1 `a11y/events.ts` event types with `modality`; `a11y/guards.ts` (`isKeyboard`, `isVirtual`, `isKeyboardOrVirtual`, `notComposing`); node tests inside a machine built with `setup`
- [x] 3.2 `dom/modality.ts` per-window tracker (ref-counted listeners, multi-document, SSR-safe, no prototype patching) with quirk entries `ios-vo-zero-size-pointer` and `chromium-at-click-1x1`
- [x] 3.3 jsdom tests: pointer→keyboard, ⌘+Tab and lone modifiers ignored, bare `click` (RX#1963, RX#2700), zero-size pointer (WebKit 222627), focus without input (RX#1047), window refocus, server render
- [x] 3.4 `dom/focus-safely.ts`: keeps modality, `scrollIntoView({ block: "nearest" })` honouring reduced motion, waits for running transitions when virtual; browser-mode tests
- [x] 3.5 Focus attributes: connect helper computing `data-focus` / `data-focus-visible` (text-input rule, virtually focused items); React binding subscribes to modality only while an instance has focus; browser test that no `blur`/`focus` fires on modality change (BU#5296)

## 4. Press, long press, hover

- [x] 4.1 `dom/press.ts` internal states (design §4), emitted events, `data-pressed` exposure, disabled handling; node tests with synthetic event objects
- [x] 4.2 Activation from `click` with the ≥ 32 ms fallback; virtual click sequence; one `PRESS` per activation; `webkit-menuitem-double-click` quirk; tests for RA#1513, ZG#1664, BITS#2185, WebKit 228318
- [x] 4.3 Keyboard activation rules per tag/role, repeat ignored, no native double activation; `macos-meta-keyup` quirk with the ⌘-held test (Chromium 1393524, WebKit 55291, Mozilla 1299553)
- [x] 4.4 Touch: capture release, contact-rect hit test, `touch-action` injection with nonce (`webkit-touch-action-manipulation`), iOS text-selection state machine (`ios-text-selection`); browser-mode tests with touch emulation
- [x] 4.5 Press without focus option; browser test with a stepper-like fixture
- [x] 4.6 `dom/long-press.ts` (500 ms via Scheduler, trailing press and context menu suppressed, hint id for `aria-describedby`); fake-timer tests
- [x] 4.7 `dom/hover.ts` (`mouse`/`pen` only, `ios-emulated-mouse-after-touch` quirk, `data-hover`); tests
- [x] 4.8 `press-fixture` (button + toggle: machine, connect, contract, React parts, stories) under `packages/testing/fixtures/`; driver tests in `browser` and `jsdom` projects in all modalities

## 5. Keyboard

- [x] 5.1 `a11y/keys.ts` `toLogicalKey` with RTL flip rules, orientation, `INCREASE`/`DECREASE`, `CONTEXT_MENU`, `mod`, macOS Control+click; exhaustive node table tests in both directions and platforms
- [x] 5.2 `dom/keyboard.ts` key description with `composing` (isComposing, 229, `safari-ime-commit-enter` quirk via composition tracking); jsdom tests replaying Japanese IME and Safari event orders
- [x] 5.3 Hotkey matcher (`key`, `code` fallback when Alt changed the character, focus scoping); node tests (macOS "†")
- [x] 5.4 `DEFAULT_TYPEAHEAD_TIMEOUT = 1000` and the provider field, exported for the collections change

## 6. Announcer

- [x] 6.1 `dom/keep-visible.ts` (`KEEP_VISIBLE_SELECTOR`, `isKeptVisible`); tests; `add-overlay-infrastructure`'s `inertOutside` must import it (design §6)
- [x] 6.2 `dom/live-announcer.ts`: `prepare()` eager regions, next-frame insert, new node per message, key debounce 500 ms, 7 s removal, hidden-document drop, `lang` per message, never moved; jsdom tests with fake timers and rAF
- [x] 6.3 Browser-mode tests: regions exist before the first text mutation (MutationObserver), regions outside a simulated `inert` body sibling (RA#3559, RX#1820)
- [x] 6.4 `ariaNotify` backend with feature detection and per-call fallback; tests with a stubbed `ariaNotify`
- [x] 6.5 Recording announcer in `@rind-ui/testing`; reset in `resetRindGlobals`; announcement log in both adapters (Playwright recorder via `addInitScript`)
- [x] 6.6 `a11y/stream.ts` streaming policy (completion, sentences with `Intl.Segmenter`, 2 s flush, cancel); node tests incl. "Hel","lo"," there" → one announcement
- [x] 6.7 Contract `announcements` field with the conditional requirement for `composite-activedescendant`; `vo-activedescendant` quirk; type tests
- [x] 6.8 Virtual screen reader test: announcer log via `@guidepup/virtual-screen-reader` matches the recording announcer in jsdom and browser

## 7. Messages, locale, direction

- [x] 7.1 `i18n/` `resolveMessages`, `plural`, `isRTL`, cached formatters (number, collator, plural rules, segmenter); node tests (fr-FR accents, de-DE percent, he-IL/ar direction)
- [x] 7.2 Default locale from `documentElement.lang` / `navigator.language` with `languagechange`; `LocaleSource` in `domEnvironment()`
- [x] 7.3 `RindProvider` in `@rind-ui/react` (locale, dir, messages by scope, announcer, typeahead timeout, environment), field-by-field nesting; React tests incl. SSR
- [x] 7.4 Connect helper giving portalled parts the root's `dir` and `lang`; test on the disclosure fixture with content rendered at the end of `body`
- [x] 7.5 Pseudo-locale helper in `@rind-ui/testing` that replaces every message of a contract's component; used by every component's test template

## 8. Hidden content

- [x] 8.1 `dom/visually-hidden.ts` styles (default and input variants); `VisuallyHidden` React part with `focusable`; story with axe; browser tests for name and reveal on focus
- [x] 8.2 `dom/until-found.ts` (imperative attribute, `beforematch` → open with `reason: "find-in-page"`, re-apply after refusal, `data-reveal`); add `hiddenUntilFound` to the disclosure fixture; browser test (Chromium find via `beforematch` dispatch) and SSR test
- [x] 8.3 `normalizeProps` maps `inert: true` → `""` on React 18; test under React 18 and 19

## 9. Invariants and runner

- [x] 9.1 Pass step modality to the oracle's events; test with a fixture guard that differs between `pointer` and `virtual`
- [x] 9.2 Adapter additions in both adapters: `KeyOptions.composing`, touch hover, keys `F10`/`ContextMenu`, `inert` as hidden in the DOM adapter, `platform`/`locale` options on drivers and `testMachine`
- [x] 9.3 Invariant `focus-visible-modality` (rule 12)
- [x] 9.4 Invariant `announcement-parity` (AT 8) with double registration on Apple and Windows platforms
- [x] 9.5 Invariant `virtual-parity` (AT 12, single activation)
- [x] 9.6 Invariant `focus-does-not-commit` (AT 13) with virtual-focus steps and contract `commitsOnFocus`
- [x] 9.7 Invariant `ime-never-commits` (AT 18) for text-entry roles
- [x] 9.8 Invariant `no-touch-hover` (AT 20)
- [x] 9.9 Contract `exceptions` referencing quirks (typed so the quirk must list the invariant); runner skips only that part/invariant while active and lists exceptions in the report
- [x] 9.10 Broken fixture variants, one per invariant (ring after click, missing Apple announcement, double toggle on bare click, tab selected on focus, composing Enter submits, hover from touch); each fails with a readable report

## 10. Test tooling and CI

- [x] 10.1 Add dev dependencies `@guidepup/virtual-screen-reader`, `@guidepup/guidepup`, `@guidepup/playwright`; optional peer for the virtual SR in `@rind-ui/testing`
- [x] 10.2 `spokenLog` helper; reading-order test for the disclosure fixture
- [x] 10.3 `chromiumTree(page)` in `@rind-ui/testing/playwright` (CDP, polling, `unavailable` elsewhere); runner checks for name through inert (RA#9737), description target not ignored (RA#8915), focused node not ignored, popup exposed (RX#4115); a broken fixture proves the RA#9737 case fails in Chromium only
- [x] 10.4 State-story convention and coverage check (every contract state has a story); partial `toMatchAriaSnapshot` per state story in Chromium, Firefox and WebKit; YAML emitted for the docs generator
- [x] 10.5 `a11y-nightly.yml`: Guidepup VO + Safari (macos-latest) and NVDA + Chrome (windows-latest) golden flows on the fixtures, containment matching, non-blocking, issue opened/updated with phrase diff and versions
- [x] 10.6 Forced-colors and reduced-motion Playwright captures of the fixture stories with the theme

## 11. Theme

- [x] 11.1 `tokens.css`: focus width/colour/offset, `--rind-hit-area`, duration tokens zeroed under `prefers-reduced-motion`
- [x] 11.2 `base.css`: `[data-focus-visible]` outline, forced-colors system-colour mapping, hit-area pseudo-element, `[data-reveal="find-in-page"]` skips transitions, no `[hidden]` override
- [x] 11.3 Contrast check (3:1) of focus ring tokens in light and dark in a node test

## 12. Docs

- [x] 12.1 `docs/accessibility/support-matrix.md` (tiers from the AT note §1.1) and `docs/accessibility/manual-protocol.md` (tier-1 checklist from §2.8); link both from the docs index and `docs/research/README.md`
- [x] 12.2 `docs/accessibility/tested-with.json` record format and its rendering into component docs pages ("Tested with" table)
- [x] 12.3 Generated `docs/accessibility/quirks.md` from the registry, with per-component lists
- [x] 12.4 Docs pages for the public pieces (modality and `data-focus-visible`, press/hover/long press data attributes, keyboard and RTL, announcer and streaming, messages/provider, `VisuallyHidden`, `hiddenUntilFound`, testing additions) through the generated-docs pipeline, including `llms.txt` entries
- [x] 12.5 Append "Resolved in add-a11y-foundations" notes to the decided open questions in `accessibility.md` and `assistive-tech-and-a11y-testing.md`

## 13. Proof

- [x] 13.1 `testMachine` over the `disclosure` and `press-fixture` fixtures passes in every modality, both directions and both platform presets, in `browser` and `jsdom`
- [x] 13.2 `pnpm lint`, `pnpm typecheck`, `pnpm build` (core size budget still met: new modules are separate entries), `pnpm test` all green

## Amendments

- [x] A.1 Focus cause (`interaction-modality` → "Focus Cause"): cause recorded by the safe focus operation, reported on `FOCUS` events with `modality`; tests for layer restore, Tab, pointer, window refocus, consumer focus

## Round 1 amendments

- [x] R1.9 Combobox navigation-key exception to the text-input focus-visible rule (`interaction-modality` → Focus Attributes; review W2): navigation keys in a `role="combobox"` input set `keyboard`; test clicked-combobox-then-ArrowDown
- [x] R1.8 Hidden content SSR (review E10): server renders `hidden=""`, client upgrades to `until-found` after hydration; post-hydration deep-link reveal from `location.hash` (open with `find-in-page` reason + scroll into view); SSR + hydration tests; document the pre-hydration find-in-page limitation

- [x] R1.1 Platform `engine` (`webkit | blink | gecko`) in `PlatformInfo` and `dom/platform.ts` detection (brands, then UA; iOS/iPadOS always `webkit`); `webkit`/`chromium`/`firefox` flags derived from it; every `platforms.*` preset carries an engine (Apple → `webkit`) and accepts an engine override; node tests for Chrome on macOS, Chrome on iOS and the override (`platform-and-preferences` → "Rendering Engine")
- [x] R1.2 Narrow `vo-activedescendant` to `p.apple && p.engine === "webkit"` (links add RA PR #10503); per-item highlight announcements follow it; repro test covers Safari (active) and Chrome on macOS (inactive) (`a11y-quirks` → "VoiceOver Active-Descendant Entries", `announcer` → "Highlight Announcements On Apple Platforms")
- [x] R1.3 Add `vo-section-entry` (`p.apple`, RA PR #10503) gating the section-entry (label + option count) and commit-selection announcements, with its repro test; update the "Gated by the injected platform" test to the three environments (`a11y-quirks`, `announcer` → "Highlight Announcements On Apple Platforms")
- [x] R1.4 Result count announced on every platform, keyed and polite, never quirk-gated; `announcement-parity` registers paths for Apple+WebKit, Apple+Blink and Windows, expects `countAnnouncement` everywhere and `focusAnnouncement` only where `vo-activedescendant` is active; broken fixtures for "highlight announced on Apple+Blink" and "count missing on Windows" (`announcer` → "Result Count Is A Status Message", `a11y-invariants` → "Announcement Parity")
- [x] R1.5 Press option `labelActivation: "focus" | "activate"` (default `"activate"`): label-forwarded `click` focuses the part via `focusSafely`, and with `"focus"` sends no press event; press-fixture variant and browser + jsdom tests for label click (both values), virtual label click and direct click (`press-interactions` → "Label Activation")
- [x] R1.6 Quirk entry `react-action-form-reset` (react-spectrum#6830, #7708; not platform-gated; removal when React exposes a reset reason) with its repro test in `packages/react` showing React 19's post-action `form.reset()` with no user event in progress, versus a reset from a user click (`a11y-quirks` → "React Action Form Reset Entry")
- [x] R1.7 Adapter input `compose(updates, commit)` in both adapters driving the full IME sequence (`compositionstart` → composing `keydown`/`compositionupdate`/`input` per update → `compositionend` → committed value); Playwright via CDP `Input.imeSetComposition`/`Input.insertText` in Chromium and an in-page sequence in Firefox/WebKit; driver test "に/にほ/にほん → 日本" in both adapters and a check that `dom/keyboard.ts` marks every in-composition keydown `composing` (`a11y-test-tooling` → "Full IME Composition Sequence")

## Round 2 amendments

- [x] R2.1 Press ends on focus loss or hidden document: while a press is in progress, listen to the part's `blur` and its document's `visibilitychange`; on either send `PRESS.CANCEL`, clear `data-pressed`, and drop the late keyup/`pointerup`/`click`/fallback activation; browser + jsdom tests for Enter then hidden (react-spectrum#6094), focus moved during held Space, and touch press then hidden (`press-interactions` → "Press Ends On Focus Loss Or Hidden Document")
- [x] R2.2 `core/dom/inject-style.ts` `injectStyle(doc, id, css, env)`: once per document and id, anonymous `@layer`, nonce property + attribute, no-op without a document, registered with the test reset; rewrite `touch-action.ts` on it; tests for same document twice, iframe, nonce, SSR (`platform-and-preferences` → "Document Style Injection")
- [x] R2.3 Press option `suppressTouchContextMenu: true`: prevent `contextmenu` during a held touch press without long press (no `LONG_PRESS`, no hint, press events unchanged), mouse/pen/keyboard context menus untouched; press-fixture variant and tests for an 800 ms touch hold and a mouse right-click (`press-interactions` → "Touch Context Menu Suppression Without Long Press")
- [x] R2.4 Quirk entries `ios-vo-spinbutton-input` (`p.ios`, React Aria `useNumberField.ts` link, removal on a passing iOS VoiceOver device test, manual-protocol device check) and `keypad-decimal-separator` (`p.ios || p.android`, react-spectrum#5731, ark#3500, removal when keypads follow the field locale), each with its repro test; regenerate `docs/accessibility/quirks.md` (`a11y-quirks` → "iOS VoiceOver Spinbutton Input Entry", "Keypad Decimal Separator Entry")
