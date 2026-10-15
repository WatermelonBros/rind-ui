# Review backlog

Review findings classified as **warning** (weak tests, quality, edge cases) are not
fixed during a change's review rounds. They are recorded here and picked up later,
when a related change touches the same code or in a dedicated clean-up change.
See CLAUDE.md "Review rules".

| Change | Reado id | File | Finding |
|---|---|---|---|
| add-a11y-foundations (r2) | — | packages/testing/src/model.ts:775-776 | no-touch-hover skips the wait in states with their own `after`; a touch "hover" cancelling a pending close goes undetected — wait anyway and compare with the oracle's what-if of the `after:` event (repro round2/testing/grace.dom.test.tsx) |
| add-a11y-foundations (r2) | — | packages/core/src/dom/keyboard.ts:124 | `registerHotkey(document)` resolves doc as null, so the Safari commit-Enter tracker isn't installed for document-scoped hotkeys; keyboard.dom.test.ts:57-74 order-dependent (module WeakSet already populated) |
| add-a11y-foundations (r2) | — | packages/testing (weak tests) | Untested fixes: imeKey replay for press(","), Apple+WebKit stale-plus-correct parity, exactly-one rule; chromiumTree "never became available" path; R1.3 it.each titles mis-formatted |
| add-a11y-foundations (r2) | — | packages/core/src/a11y/stream.ts | Sentence-mode stream cancelled in the same task still speaks a queued sentence ~16 ms later; spec says "keyed per stream" while sentence mode is unkeyed and the header comment says the flush is keyed — align |
| add-a11y-foundations (r2) | — | scripts/lint-platform.mjs | Evasions: multi-line destructuring, platform[k], Object.entries(platform), nested rename, code after a "…//…" string; false hits on cfg.engine, layout.windows |
| add-a11y-foundations (r2) | — | packages/testing/src/aria-snapshot.ts | missingAriaLines has no ancestry check, an extra wrapper node fails against its doc comment, hidden-content leaks invisible in the closed state; story list hard-coded (derive from index.json) |
| add-a11y-foundations (r2) | — | packages/theme/src/base.css:62-80 | Forced colours: disabled+checked vs disabled+unchecked only by colour; selected+highlighted indistinguishable from selected; invalid has no cue |
| add-a11y-foundations (r2) | — | scripts/docs-gen.ts:97-123 | An inline open-marker swallows the next real block; indented code and unclosed fences are filled |
| add-a11y-foundations (r2) | — | packages/core (misc) | `Engine` type not exported; guides not updated for RindMessageScopes, labelActivation, Announcer.cancel, withEngine, canonicalLocale; until-found deep link runs on every mount (late SPA mount with stale #hash opens); parity count unchecked at 0 results; ariaNotify test restore outside finally; modality.ts:142 attributes shadow-DOM focus to the host; stale comment hover.dom.test.ts:57; press.ts:98 useOptionalChain warning |
| add-a11y-foundations (r1) | — | packages/core/src/dom/modality.ts:94,113 | Any keydown sets `pressTarget`, cleared only by click → a later VO+Space click leaves modality `keyboard` (press events unaffected); record only Enter/Space, clear on keyup/blur |
| add-a11y-foundations (r1) | — | packages/core/src/dom/modality.ts:201-206 | A stray second call of one unsubscribe corrupts the shared subscriber counter; guard with a per-call `done` flag |
| add-a11y-foundations (r1) | — | packages/core/src/dom/modality.ts:209 | `markFocus` calls `stateOf(true)` and can install permanent listeners with no subscriber |
| add-a11y-foundations (r1) | — | packages/core/src/dom/press.ts:233,327 | Untested: press after an iOS VO zero-size / Chromium 1×1 pointer followed by a click with detail ≥ 1; WebKit 228318 double-click test fires both clicks synchronously |
| add-a11y-foundations (r1) | — | packages/core/src/dom/live-announcer.ts:109-115 | Hidden-document drop checked only at request time (pending keyed message / throttled rAF inserted after the tab returns) |
| add-a11y-foundations (r1) | — | packages/core/src/dom/live-announcer.ts:33-34 | Module-global Maps leak detached iframe documents (use WeakMap); keyed timers shared across announcers with different schedulers |
| add-a11y-foundations (r1) | — | packages/core/src/a11y/keep-visible.ts:10-11 | `isKeptVisible` true for any ancestor of a match → a naive hide-outside leaves the whole app exposed; document/provide recursion into kept ancestors |
| add-a11y-foundations (r1) | — | announcer.dom.test.ts:75-83 | RA#3559 test uses a static inert attribute, not a mutation-observing hide-outside opened first; no aria-hidden variant; RA#5191 not asserted under real rAF |
| add-a11y-foundations (r1) | — | packages/core/src/a11y/stream.ts:26-34 | Duplicates i18n's cached segmenter |
| add-a11y-foundations (r1) | — | packages/react/src/provider.tsx:68 | Inline environment/messages props rebuild domEnvironment every render |
| add-a11y-foundations (r1) | — | packages/core/src/dom/quirks.ts | Several entries point at test files that don't obviously reproduce their bug; quirks:check only checks the file exists (require the id in the test); defineQuirks accepts duplicate ids; every entry verified "today" incl. WebKit/VO ones jsdom can't verify |
| add-a11y-foundations (r1) | — | packages/testing/src/broken.dom.test.tsx:157 | No broken fixture for "no ring after arrow" or "double speech on Windows"; the Tab fixture fails pointer runs for the wrong reason (hidden by `some(...)`); RA#9737 fixture doesn't prove Chromium-only; ring contrast checked only against backgrounds |

## Resolved

The six add-foundations warnings first recorded here (10e5b, 10e6c, 1394b, 1394d,
1394e, 1394f) were fixed by the implementer in the same round, before the move;
verified at round 3 (2026-10-14).
