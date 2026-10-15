## Context

`add-foundations` (not yet archived) gives us: the machine runtime with named
guards/actions/effects in `setup`, an `Environment` built from small capability
interfaces with `domEnvironment()` (`core/env`), contracts whose actions run per
modality `pointer | keyboard | touch | virtual` (virtual = bare `click`, programmatic
focus), drivers over a DOM and a Playwright adapter, `testMachine` with a headless
oracle fed through `inspect`, trait-gated generic invariants, `@rind-ui/testing/setup`
with `resetRindGlobals`, React's `useMachine`, `normalizeProps`, `mergeProps` and
`useId`-based root ids. This change adds the accessibility layer every component
reuses; see proposal.md for why. The binding sources are accessibility.md §3–§10 and
"Rules for every component", the AT note §1.2, §1.5, §2.9–2.10 and Decisions, and
native-platform.md §5, §6, §13.

## Goals / Non-Goals

**Goals:**
- Every module is framework-free, receives the environment, and runs its logic in Node
  with fake capabilities; the DOM part is a thin listener layer.
- Each real bug cited in the specs has a test that reproduces it (jsdom where the
  event sequence can be synthesised, browser mode otherwise).
- Nothing in this change requires a component to exist; a small `press-fixture`
  (button + toggle) and the `disclosure` fixture from `add-foundations` exercise it.

**Non-Goals:**
- Changing `add-foundations` artifacts. Where this change needs something from a
  foundations type (`KeyOptions`, the key set, contract fields), it is added by this
  change's tasks on top of the foundations code, and specified in this change's
  capabilities.
- Overlay modules. `inertOutside` belongs to `add-overlay-infrastructure`; it must
  import the keep-visible rule exported here.

## Decisions

### 1. Layout

```
packages/core/src/
├─ a11y/            pure, DOM-free; machines may import it
│  ├─ events.ts     PressEvent, HoverEvent, FocusEvent, LogicalKeyEvent types (all carry modality)
│  ├─ guards.ts     isKeyboard, isVirtual, isKeyboardOrVirtual, notComposing
│  ├─ keys.ts       toLogicalKey(desc, { dir, orientation, platform })
│  └─ stream.ts     streamAnnouncement policy (completion | sentences)
├─ dom/             DOM listeners; receive the environment
│  ├─ modality.ts   per-window tracker
│  ├─ focus-safely.ts
│  ├─ press.ts, hover.ts, long-press.ts, text-selection.ts, touch-action.ts
│  ├─ inject-style.ts  one rule set per document and id, CSP nonce (round 2)
│  ├─ keyboard.ts   native KeyboardEvent → key description (composing, mod) → a11y/keys
│  ├─ live-announcer.ts, keep-visible.ts
│  ├─ visually-hidden.ts, until-found.ts
│  ├─ platform.ts   detection for domEnvironment()
│  └─ quirks.ts     the registry
├─ i18n/            messages, locale, direction, formatters (no DOM except defaults)
├─ ids.ts           partId / itemId
└─ env/             + new capability interfaces (below)
```

`core/a11y` exists so machines import guards and event types without importing
`core/dom` (layer direction). Alternative considered: everything in `core/dom` —
rejected because machines would import a module whose siblings touch the DOM.

### 2. Environment capabilities added

```ts
// core/env — each a small interface; machines ask only for what they use (ISP)
export interface ModalitySource {
  modality(): Modality                         // Modality is the contract's union
  subscribe(listener: (m: Modality) => void): () => void
}
export interface PlatformInfo {
  readonly platform: Readonly<{ apple: boolean; mac: boolean; ios: boolean; android: boolean;
    windows: boolean; webkit: boolean; chromium: boolean; firefox: boolean
    engine: "webkit" | "blink" | "gecko" }>                   // R1: webkit/chromium/firefox agree with it
}
export interface MotionPreference {
  reducedMotion(): boolean
  subscribeReducedMotion(listener: (reduced: boolean) => void): () => void
}
export interface LocaleSource { locale(): string; dir(): "ltr" | "rtl" }
export interface Announcer {
  announce(message: Announcement): void
  /** Called by components that may announce, on mount: creates the regions eagerly. */
  prepare(): () => void
}
export interface Announcement {
  readonly message: string
  readonly priority?: "polite" | "assertive"
  readonly key?: string
  readonly lang?: string
}
export interface StyleInjection { readonly nonce?: string }
```

`domEnvironment()` (foundations) is extended to implement all of them; it takes
overrides (`domEnvironment({ platform, announcer, locale, reducedMotion })`). The
quirks registry is not a capability: entries are pure predicates over `PlatformInfo`,
so injecting the platform is enough to test every branch.

Round 2 (from add-number-input): `dom/inject-style.ts` is the only consumer of
`StyleInjection`. `injectStyle(doc, id, css, env)` inserts `<style data-rind-style="<id>">`
into `head` once per document and id, wraps `css` in an anonymous `@layer`, sets the nonce
(property and attribute: jsdom does not reflect the property), no-ops without a document,
and registers the element with the test reset. `touch-action.ts` becomes a call to it;
Scroll Area and Number Input inject their rule sets through it
(`platform-and-preferences` → "Document Style Injection"). Alternative: each module keeps
its own injector, as `touch-action.ts` did — rejected now that a second and third user
exist.

### 3. Modality tracker (`dom/modality.ts`)

Port of React Aria `useFocusVisible.ts` without patching `HTMLElement.prototype.focus`.
Capture listeners on `keydown/keyup`, `pointerdown`, `click`, `focus` (window and
document) per window, installed on the first subscription and ref-counted per window
(multi-document: the window is taken from the node's `ownerDocument`). Rules are in the
interaction-modality spec. Virtual heuristics (`detail === 0` without a preceding
press, empty `pointerType`, 0×0 and 1×1-zero-pressure pointers) are quirk entries.
Alternative considered: patching `focus()` as React Aria does — rejected (global side
effect in a headless library; breaks other libraries' assumptions). Consequence: a
consumer's bare `focus()` is `virtual`, which shows the ring, matching the native
`:focus-visible` heuristic for programmatic focus. `focusSafely(el, env)` marks its own
moves so they keep the current modality.

How attributes reach parts: machines track focus with `FOCUS`/`BLUR` events (carrying
modality); connect computes `data-focus-visible = focused && env.modality()` not in
`pointer | touch`, plus the text-input rule. The React binding subscribes the root to
`ModalitySource` only while some part of the instance has focus, so a modality change
re-renders only focused instances. Alternative: writing attributes imperatively
(Ariakit) — rejected, connect owns every `data-*`.

### 4. Press, hover, long press (`dom/press.ts`, `hover.ts`, `long-press.ts`)

Not machine-runtime services: a press handler exists per pressable element (hundreds
in a grid) and its state is local. Each is a factory returning handler props for
connect to spread, plus an internal state:

| Internal state | Enter on | Leaves on |
|---|---|---|
| `idle` | — | pointerdown / valid keydown / virtual click |
| `pressed-inside` | press start, pointer re-enters | pointer leaves → `pressed-outside`; release → `idle` |
| `pressed-outside` | pointer leaves | re-enter → `pressed-inside`; release / cancel → `idle` |

Emitted machine events: `PRESS.START | PRESS.UP | PRESS.END | PRESS | PRESS.CANCEL`,
`LONG_PRESS`, `HOVER.START | HOVER.END`, all with `{ modality, pointerType, shiftKey,
ctrlKey, metaKey, altKey }`. `PRESS` fires from `click`; a ≥ 32 ms scheduler fallback
fires it when no `click` follows `pointerup` (React Aria). Keyboard: keydown Enter/Space
→ `PRESS.START` with `preventDefault` (stops the native synthetic click), keyup →
`PRESS`; repeats ignored; per-element rules from the rendered tag and role (the
connect layer passes the tag it receives from the ref). The macOS ⌘ case synthesises
the missing keyups on Meta keyup. Touch: `releasePointerCapture` on pointerdown,
contact-rect hit test, `touch-action` stylesheet injected once per document in an
anonymous `@layer` with `StyleInjection.nonce`, iOS text-selection state machine (a
module-level 3-state machine: `default | disabled | restoring`, restore 300 ms after
the last press). Long press: 500 ms through `Scheduler`, cancels the pending `PRESS`,
`contextmenu` prevented during a touch long press. Hover filters `pointerType` and the
iOS emulated-mouse-after-touch quirk.

Label activation (round 1, from add-label): press option `labelActivation: "focus" |
"activate"` (default `"activate"`). A `click` forwarded by an associated label focuses
the part with `focusSafely`; with `"focus"` the module emits no press event (popup
triggers, radix#3679, headlessui#3787). A forwarded click is recognised by the label's
own `click` dispatched just before it (target the label, `control` the part), so pointer
and virtual label clicks are both covered.

Round 2 (from add-link): a press in progress ends with `PRESS.CANCEL` and no activation on
the part's `blur` or on `visibilitychange` to hidden (react-spectrum#6094: Enter opens a
new tab and the keyup never arrives). The module listens to `blur` on the part and to
`visibilitychange` on the part's `ownerDocument` only while a press is in progress, and
marks the press cancelled so a late keyup, `pointerup`, `click` or the click fallback
delivers nothing.

Round 2 (from add-number-input): press option `suppressTouchContextMenu: true` prevents
the `contextmenu` that follows a held touch press, without long press: no `LONG_PRESS`, no
hint, press events unchanged; mouse, pen and keyboard context menus are untouched (stepper
auto-repeat holds past the long-press threshold but is not long-pressable). It reuses the
long-press module's `contextmenu` handler, without its timer.

`data-pressed` and `data-hover` are emitted by connect from the press/hover state the
factory exposes (`isPressed()`, subscribe), not written to the DOM by the module.

### 5. Keyboard (`a11y/keys.ts`, `dom/keyboard.ts`)

```ts
type LogicalKey = "NEXT" | "PREV" | "FIRST" | "LAST" | "PAGE_NEXT" | "PAGE_PREV" | "EXPAND"
  | "COLLAPSE" | "INCREASE" | "DECREASE" | "ACTIVATE" | "DISMISS" | "CONTEXT_MENU"
interface KeyDescription { key: string; code: string; shift: boolean; alt: boolean;
  ctrl: boolean; meta: boolean; repeat: boolean; composing: boolean }
function toLogicalKey(k: KeyDescription, o: { dir: "ltr" | "rtl";
  orientation: "horizontal" | "vertical" | "both"; platform: PlatformInfo["platform"] }):
  LogicalKey | undefined
```

`dom/keyboard.ts` builds the `KeyDescription` (`composing = isComposing || keyCode ===
229 || the Safari commit-Enter quirk`, tracked with `compositionstart/end` per element),
and computes `mod`. `notComposing` is a plain guard implementation machines list in
`setup({ guards: { notComposing } })`, reading `event.composing`. Alternative: dropping
composing events in the adapter — rejected; the AT note and accessibility.md §6 make it
a machine rule so model tests see it.

Typeahead: the constant `DEFAULT_TYPEAHEAD_TIMEOUT = 1000` and the provider field live
here; the matcher is the collections change's.

### 6. Announcer (`dom/live-announcer.ts`, `dom/keep-visible.ts`, `a11y/stream.ts`)

Live-region backend (default): React Aria's design adapted to rule D. `prepare()` (called
by a component's mount effect) creates, once per document, a container
`div[data-live-announcer][data-rind-top-layer]` with visually hidden styles and two
`role="log" aria-relevant="additions"` regions (`aria-live` polite / assertive),
appended to `body`. `announce()` drops the message when `document.hidden`; otherwise,
keyed messages wait a 500 ms debounce (replacing the pending one with the same key),
and every message is inserted on the next `requestAnimationFrame` as a new `<div
lang>` child, removed after 7 s through the scheduler. Each message is a new node, so
repeats are additions (no U+2060 marker needed). The container is never moved.

`ariaNotify` backend (opt-in `announcer: "aria-notify"`): feature-detect
`Element.prototype.ariaNotify`; call it on a hidden element inside the container whose
`lang` is set per message; same key/hidden rules; fall back per call.

`keep-visible.ts` exports `KEEP_VISIBLE_SELECTOR` and `isKeptVisible(el)`; the overlay
change's `inertOutside` must use them (its research note already lists the same set).

Streaming: `streamAnnouncement(announcer, { mode: "completion" | "sentences", key,
locale, flushMs = 2000 })` returns `{ push(chunk), complete(), cancel() }`; sentence mode
uses `Intl.Segmenter(locale, { granularity: "sentence" })` and announces only completed
segments.

Contract declarations: `announcements?: { focusAnnouncement(state); countAnnouncement(state);
selectionAnnouncement(state) }` added to `ContractDef`; required by a conditional type
when `traits` includes `"composite-activedescendant"`. Drivers read the log from the
recording announcer (DOM adapter) or from a page-side recorder installed with
`addInitScript` that wraps the announcer the page's environment uses (Playwright).

### 7. Messages, locale, direction (`i18n/`, `@rind-ui/react`)

```ts
type Messages<M> = { readonly [K in keyof M]: M[K] }            // strings or (args) => string
function resolveMessages<M>(defaults: M, ...overrides: Partial<M>[]): M
function plural(locale: string, n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }): string
function isRTL(locale: string): boolean                        // getTextInfo, then script/language list
const format = { number(locale, opts), collator(locale, opts), pluralRules(locale, opts), segmenter(locale, opts) } // cached
```

`<RindProvider locale dir messages announcer typeaheadTimeout environment>` in
`@rind-ui/react` merges field by field with its parent and feeds `useMachine`'s
environment. Messages are keyed by component scope in the provider
(`messages={{ dialog: { close: "Chiudi" } }}`).

**Translations package — deferred.** We ship English defaults and typed overrides only.
When the first consumer needs other locales, `@rind-ui/locales` will be seeded from
React Aria's Apache-2.0 `intl/` JSON (converted from ICU to our function form by a
build script, attribution in `NOTICE`), one entry per component, tree-shakeable per
locale. Specs are unaffected: they require typed defaults and overrides, which any
package plugs into. Alternative: crowdsourcing from scratch — rejected for now (34
locales of reviewed strings already exist under a compatible licence).

### 8. Hidden content (`dom/visually-hidden.ts`, `dom/until-found.ts`)

Base UI's style plus `clip: rect(0 0 0 0)`, as a style object (connect-friendly) and a
class-free inline style; input variant uses `position: absolute`. `untilFound(el, env,
{ onReveal })` sets `hidden="until-found"` imperatively after each commit while closed,
listens to `beforematch`, and re-applies it a frame later if the machine stayed closed
(controlled refusal); `onReveal` sends the machine's open event with `reason:
"find-in-page"`; connect sets `data-reveal="find-in-page"` until the next transition.
React: `normalizeProps` maps `inert: true` to `""` on React 18.

### 9. Ids (`ids.ts`)

The react-adapter spec already requires derivation from the root id and part/item key;
missing was the shared function and key encoding. `partId(scope, root, part)` and
`itemId(scope, root, part, key)`; keys are encoded by escaping `_` and every character
outside `[A-Za-z0-9-]` as `_<hex>_`, which is injective and whitespace-free. The React
adapter's `use-ids.ts` (foundations task 3.5) calls these.

### 10. Quirks registry (`dom/quirks.ts`)

```ts
interface Quirk<Id extends string = string> {
  readonly id: Id
  readonly when: (p: PlatformInfo["platform"]) => boolean
  readonly links: readonly [string, ...string[]]          // at least one: compile error otherwise
  readonly test: string                                   // repo path of the repro test
  readonly removeWhen: string
  readonly verified: `${number}-${number}-${number}`
  readonly invariants?: readonly GenericInvariantId[]
}
export const quirks = defineQuirks([...] as const)         // ids inferred → QuirkId union
export function quirkActive(id: QuirkId, env: PlatformInfo): boolean
```

Initial entries (each with its repro test): `ios-vo-zero-size-pointer` (WebKit 222627,
223202), `chromium-at-click-1x1` (RA#10310), `macos-meta-keyup` (Chromium 1393524,
WebKit 55291, Mozilla 1299553), `webkit-menuitem-double-click` (WebKit 228318),
`ios-emulated-mouse-after-touch` (WebKit 214609), `webkit-touch-action-manipulation`
(WebKit 240917), `ios-text-selection` (React Aria `textSelection.ts` rationale),
`safari-ime-commit-enter` (WebKit bug link found while writing its test),
`vo-activedescendant` (ZG#2936, RA#10326, BU#5721, RA PR #10503; `when: p.apple &&
p.engine === "webkit"` since round 1 — VoiceOver in Chrome speaks activedescendant
natively and a live announcement interrupts it; affects announcement parity).
Round 1 adds `vo-section-entry` (RA PR #10503; `when: p.apple`; section label + option
count on section entry, and the selection on commit, which VoiceOver speaks in no
browser) and `react-action-form-reset` (react-spectrum#6830, #7708; `when: () => true`;
repro test in `packages/react`: React 19 calls `form.reset()` after an action with no
user event in progress; the adapter code that classifies resets belongs to add-form,
removal when React exposes a reset reason). The result count is never quirk-gated: it
is a WCAG 4.1.3 status message, announced on every platform. Round 2 (from add-number-input) adds `ios-vo-spinbutton-input` (`when: p.ios`; React Aria
`useNumberField.ts` comment; repro test covers the condition, the failure itself is a
manual-protocol device check; removal when a device test shows iOS VoiceOver focusing and
editing `<input role="spinbutton">`) and `keypad-decimal-separator` (`when: p.ios ||
p.android`; react-spectrum#5731, ark#3500; touch decimal keypads insert "." or the device
region's separator whatever the field's locale; Number Input maps it to the field locale's
separator; removal when keypads follow the field's locale). Both gate code in
add-number-input. `vo-submenu-expanded` is added by the Menu change; the
registry's spec scenario uses it as the example only.

Contract exceptions: `exceptions?: readonly { part: Part; invariant: GenericInvariantId;
quirk: QuirkId }[]` on `ContractDef`, typed so the quirk must list the invariant.
A Biome rule (or a grep-based lint script if Biome's plugin API cannot express it)
forbids `navigator.userAgent`, `userAgentData` and `env.platform.*` reads outside
`dom/platform.ts`, `dom/quirks.ts` and `a11y/keys.ts` (the `mod` key and the macOS
Control+click context-menu rule are platform conventions, not workarounds; both live in
`a11y/keys.ts`, which `dom/press.ts` calls). A `quirks:check` script fails on missing test paths and warns on entries
verified more than 12 months ago; the docs generator lists entries per component.

### 11. Invariants and runner changes (`@rind-ui/testing/model.ts`)

- The runner passes each step's modality to the oracle's events (the contract's
  event-mapping already knows the modality of the action it runs).
- New generic invariants (ids in `GenericInvariantId`): `focus-visible-modality`,
  `announcement-parity` (trait `composite-activedescendant`; the runner registers paths
  three times, with `platforms.apple` (WebKit), `{ ...platforms.apple, engine: "blink" }`
  and `platforms.windows`; count expected everywhere, highlight only where
  `vo-activedescendant` is active), `virtual-parity`
  (single activation; builds on foundations' virtual runs), `focus-does-not-commit`
  (extra virtual-focus steps; contract field `commitsOnFocus?: { part; state }[]`),
  `ime-never-commits` (replays mapped keyboard actions on text-entry roles as composing;
  oracle diff must be empty), `no-touch-hover` (replays hover actions with touch).
- Adapter additions: `KeyOptions.composing`, `Part.hover({ pointerType })`, keys `F10` and
  `ContextMenu`, `inert` in "hidden" for the DOM adapter, `platform`/`locale` options on
  drivers and `testMachine`.
- Round 1: `Part.compose(updates, commit?)` in both adapters, a full IME sequence
  (`compositionstart` → per update composing `keydown`/`compositionupdate`/`input`
  with `isComposing` → one more composing `input` carrying the committed text →
  `compositionend` → committed value; real Chromium via CDP and Firefox send the commit
  before `compositionend`, so "にほん → 日本" yields four composing inputs). Without a
  commit the composition stays open. Playwright: CDP
  `Input.imeSetComposition` + `Input.insertText` in Chromium, an in-page synthesised
  sequence in Firefox and WebKit. `KeyOptions.composing` alone only marks single keys.

### 12. Test tooling

- `@guidepup/virtual-screen-reader` as an optional peer of `@rind-ui/testing` and a dev
  dependency of the repo; `spokenLog(container, run)` helper.
- `chromiumTree(page)` in `@rind-ui/testing/playwright` via `context.newCDPSession` →
  `Accessibility.getFullAXTree`, returning `null` until ready for `expect.poll`, and
  `{ unavailable: true }` outside Chromium.
- State stories: a `states` export convention per component story file; a script checks
  every contract state has one. `toMatchAriaSnapshot` per state story in the Playwright
  project (3 engines); the YAML is written next to the story and picked up by the docs
  generator. This answers the AT note's open question 5 (state stories, kept honest by
  the coverage check).
- Nightly workflow `a11y-nightly.yml`: `guidepup/setup-action` on `macos-latest`
  (VO + Safari) and `windows-latest` (NVDA + Chrome), `@guidepup/playwright` golden flows
  over Storybook, containment matching, `continue-on-error`, opens/updates an issue via
  `gh` with phrase diff and versions. Until components exist, its golden flow is the
  `disclosure` fixture.
- Docs: `docs/accessibility/support-matrix.md`, `manual-protocol.md` (checklist), and
  `tested-with.json` (records the generator renders per component); `quirks.md` is
  generated from the registry.

### 13. Theme

`base.css`: `[data-focus-visible] { outline: var(--rind-focus-width, 2px) solid
var(--rind-focus-color); outline-offset: 2px }`; `@media (forced-colors: active)` maps
states to `Highlight`/`HighlightText`/`GrayText`; `--rind-duration-*` tokens set to `0s`
under `prefers-reduced-motion: reduce`; a `::before` hit-area rule driven by
`--rind-hit-area`; `[data-reveal="find-in-page"]` disables the open transition; no
`[hidden]` override. Verified with Playwright `emulateMedia({ forcedColors: "active",
reducedMotion: "reduce" })` screenshots of the fixture stories.

### Resolved open questions

| Question (note) | Decision | Why |
|---|---|---|
| Typeahead timeout 1000 vs 350 ms (accessibility) | 1000 ms default; per component and provider-level setting | 350 ms is too short for SR and motor-impaired users; React Aria and Radix use 1000; Reado users can tune it without a code change |
| Translations package (accessibility) | Deferred; seed from React Aria's Apache-2.0 JSON with NOTICE when created | Specs need only typed defaults and overrides |
| Announcer inside modal dialogs (accessibility) | Do not relocate; regions stay where created, kept out of `inert` by the keep-visible rule | Moving a live region makes it a new region to AT, which breaks rule D (exists before the message); our modals use `inert`, not native `showModal()`. If the manual protocol reproduces VO ignoring outside regions under `aria-modal`, the fix is a quirk entry that creates a second persistent region pair inside the modal layer when it opens — still never moving regions |
| Apple active-descendant announcements (accessibility; AT note Q1) | Per-item highlight gated on Apple + WebKit (`vo-activedescendant`); section entry and selection on all Apple platforms (`vo-section-entry`); result count on every platform (round 1, from add-combobox) | Announcing highlights everywhere doubles speech in NVDA/JAWS and in VoiceOver + Chrome (RA PR #10503); Safari is still silent (RA#10326); the count is a WCAG 4.1.3 status message. Further narrowing changes quirk conditions, not the specs |
| ariaNotify as default (accessibility) | Stays opt-in; re-checked quarterly | macOS VO drop and ChromeOS silence unresolved; switching later is a backend default, no spec change |
| ARIA snapshots in docs (AT note Q5) | Per state story, with a check that every contract state has one | Snapshots stay readable for docs and cannot silently miss a state |
| Generic a11y invariants, rule 12 (foundations design) | Delivered here as `a11y-invariants` | Needs the modality tracker |

## Risks / Trade-offs

- [Virtual-click heuristics misclassify (RA#10310: JAWS/NVDA + Chrome clicks look like
  mouse)] → misclassification only changes focus-first-item behaviour; activation is on
  `click` either way, so nothing breaks; the heuristics are quirk entries re-tested
  yearly.
- [No prototype patching: consumer `focus()` shows a ring] → matches the native
  heuristic; documented; consumers can use the exported `focusSafely`.
- [Eager regions add two nodes to every page with an announcing component] → one pair
  per document, visually hidden, created only when a component may announce.
- [Dropping messages in hidden tabs loses a message the user never hears] → intended
  (Radix, Inclusive Components); components that must persist status keep it in the DOM.
- [Engine-gated highlight announcements may double-speak or go silent as VoiceOver
  changes per browser (RA PR #10503, RA#10326)] → manual protocol checks VO + Safari and
  VO + Chrome; the quirk conditions are the single switch.
- [Guidepup nightly is flaky] → non-blocking, containment matching, issues deduplicated by
  flow name.
- [The ⌘-keyup synthesis could fire for a key the user is still holding] → only for keys
  whose keydown happened while Meta was down and only on Meta keyup, as React Aria.

## Migration Plan

None: no public API exists yet. Reado's `Announcer.tsx` and `a11y.ts` are replaced by
the injected announcer during its migration (wave 1).

## Open Questions

- Which hosted service (or licence) covers JAWS in the manual protocol (AT note Q3).
  The protocol lists JAWS either way; no spec or task changes.
- The exact WebKit bug link for `safari-ime-commit-enter`, found while writing its
  repro test.
