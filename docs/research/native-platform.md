# Native platform primitives — research

Status: done · Cross-cutting (read before any component note; see [CLAUDE.md](../../CLAUDE.md))

Which web platform primitives rind-ui should **build on** instead of re-implementing
in JavaScript, and where it must still **polyfill or avoid** them. This note feeds
[overlay-infrastructure.md](overlay-infrastructure.md) (layer stack, inert, scroll lock,
presence, portal) and every component note.

## Method

Support from `@mdn/browser-compat-data` **8.1.5** (2026-10-08) queried directly, plus
caniuse, release notes and bug trackers. Stable on 2026-10-14: **Chrome 155, Edge 154,
Firefox 157, Safari / iOS 27**. "iOS" = every iOS browser (all WebKit). Interop 2026
areas that matter: *Anchor positioning* (carry-over), *Dialog and popover additions*
(`closedby`, `popover="hint"`, `:open`), *View Transitions*. Spec text, library sources
(local clones) and issues are listed under Sources.

Notation in support lines: version = first stable with full support; `flag` = behind a
flag; `TP` = Safari Technology Preview only; `—` = none.

---

## 1. `<dialog>` + `showModal()`

**What it does.** `showModal()` puts the dialog in the **top layer** (above every
z-index, escapes `overflow`/`transform` clipping), renders `::backdrop`, makes the
whole document **inert** except the dialog's flat-tree descendants, runs the *dialog
focusing steps* (autofocus → first focusable) and restores focus to the previously
focused element on close. Escape (a *close request*) fires `cancel` then `close`.
`requestClose(value)` fires a cancelable `cancel` first, like a user close request.
`closedby="any|closerequest|none"` decides what closes it (`any` = light dismiss on
backdrop click). Close requests go through the close-watcher machinery, so in Chromium
the Android back button closes a modal dialog.

**Support.**

| Feature | Chrome | Edge | Firefox | Safari / iOS |
|---|---|---|---|---|
| `<dialog>`, `showModal()`, `::backdrop`, `cancel` | 37 | 79 | 98 | 15.4 |
| `:modal` | 105 | 105 | 103 | 15.6 |
| `requestClose()` | 134 | 134 | 139 | 18.4 |
| `closedby` | 134 | 134 | 141 | **TP only** (iOS —) |
| `CloseWatcher` | 126 | 126 | 149 | TP (iOS —) |
| `:open` | 133 | 133 | 136 | 26.5 |
| `overlay` (exit animation out of top layer) | 117 | 117 | — | — |

WebKit's `closedby` meta bug (#284592) shows the sub-bugs "Enable close watchers
(including dialog closedby) in stable" fixed, but BCD 8.1.5 still lists Safari 27 as
TP-only — treat Safari/iOS as **unsupported** until a release note says otherwise.

**Behaviour that matters to us (from the spec).**

- *Blocked by a modal dialog*: "every node connected to document, with the exception
  of the subject element and its flat tree descendants, must become inert." That
  includes elements in the top layer: a toast region or a menu portalled to `<body>`
  is **inert and non-clickable** while a native modal is open, regardless of z-index.
- `showModal()` runs *hide popovers until* the dialog's topmost popover ancestor: every
  open `popover=auto|hint` that is not an ancestor of the dialog is **closed** when the
  dialog opens. `manual` popovers stay, but are inert unless inside the dialog.
- Top-layer order = open order. Nothing can be inserted between two top-layer elements
  except by closing and reopening it (which loses focus and form state inside it).
- **Cancel-event anti-abuse**: close requests consume user activation. If there was no
  user activation since the dialog opened, `cancel` is fired with `cancelable=false`
  (WPT `close-watcher/esc-key/not-user-activation.html`; Chromium intent "Close
  requests for CloseWatcher, `<dialog>`, and popover"), or several dialogs close at
  once. Consequence: an Alert Dialog opened programmatically (session timeout) **cannot
  veto Escape** — `preventDefault()` in `cancel` silently fails. `closedby="none"`
  avoids it but is not in Safari. Base UI's Drawer CloseWatcher code handles exactly
  this (`if (!event.cancelable) eventDetails.cancel = NOOP`, `DrawerRoot.tsx`).
- `cancel` fires synchronously, `close` is queued as a task; with grouped dialogs both
  `cancel`s fire before both `close`s (Mozilla WPT notes). Removing the `open`
  attribute by hand leaves the document blocked — React rendering `open={false}` on a
  modal dialog is a bug, not a close.
- No scroll lock: the page behind a native modal still scrolls (wheel, touch, keyboard
  on iOS). Focus is **not trapped**: Tab can leave to browser chrome (HTML spec vs APG
  disagreement; Ariakit deliberately copies this — `dialog.tsx` "Modal dialogs don't use
  tab-order sentinels to match native `<dialog>`").

**Accessibility.** Browsers expose `role=dialog` with modal semantics (aria-modal
equivalent) and real inertness, which is better than `aria-modal` alone. Known AT bugs:
WebKit #311125 "REGRESSION (Safari 18.4–26): VoiceOver focus issue in modal dialogs"
(VO cursor stays on the opener and can reach content behind; reproduced on *ARIA*
dialogs, closed as dup of #314893, fixed upstream 2026-05) — so this is not a native-vs-JS
differentiator; WebKit #273635 (VO cursor lands behind the dialog after close);
WebKit #245549 (shadow-DOM focusables inside a `showModal` dialog not announced).
iOS: backdrop light dismiss needed a `pointerdown`-listener hack until WebKit fixed
popover (#267688, Safari 18.3) and later dialog (2026) touch light dismiss.

**React / SSR / portals.** `showModal()` is imperative — it can only run after mount
(effect), so SSR output is a closed dialog and the first paint after hydration opens
it. The machine must own open state and treat `cancel`/`close` as *requests*, because
the browser can close the dialog without asking (radix#2830, chaance: "its close event
is not cancellable … DOM state gets out-of-sync with React state"). React portals
break it: anything a child portals to `<body>` (Select, Menu, Tooltip, toasts,
third-party comboboxes, chat widgets) is under the top layer **and inert**. Portals
must target the dialog itself, or children must also be top-layer popovers *inside*
the dialog's DOM. Fullscreen has the same shape (react-spectrum#10506).

**Testing.** jsdom does **not** implement `HTMLDialogElement.showModal` (jsdom#3294,
open; jsdom 30.1.2), `popover` (#3721) or `inert` (#3605). A native-dialog Dialog would
need a polyfill in `@rind-ui/testing/setup` that fakes top layer, inertness and focusing
steps — i.e. we would maintain a second, fake implementation of the thing we chose not
to implement.

**How libraries handle it.** None of the nine libraries renders `<dialog>.showModal()`.
- Radix: #2830 closed "not planned" (state sync, third-party portals below the top
  layer, toasts); #2941 (move to popover) closed.
- Base UI: #485 open; atomiks: "3rd party extension elements appear underneath it (e.g.
  Grammarly popups) and are inaccessible … Unless all extension elements also use
  top-layer, it's not a viable solution." Unsplash moved from native dialogs to Base UI
  ("tired of fighting with portals"). #3905 (CloseWatcher for Dialog) open; only Drawer
  uses CloseWatcher, Android only.
- React Aria (discussion #9696): top-layer stacking with third-party overlays, toast
  ordering, aria-modal too broad (they use per-element `inert`), exit animations need
  `overlay`, no scroll lock, focus not contained.
- Zag/Ark, Headless UI, Ariakit: `role=dialog` + their own inert/aria-hidden; Headless
  UI's `useIsTopLayer` is explicitly *not* the native top layer.

**Decision: avoid for Dialog / Alert Dialog / Drawer (v1).** See the recommendation at
the end. Use `<dialog>` knowledge, not the element: copy its *semantics* (`requestClose`
→ cancelable `CLOSE` request; close reasons; focus restore to previously focused).
**Interop requirement**: our `Portal` must render into the nearest open
`dialog:modal`, `:popover-open` top-layer ancestor or `document.fullscreenElement` when
the trigger lives inside one, so rind components work inside a consumer's native dialog.

---

## 2. `popover` attribute (`auto` / `manual` / `hint`)

**What it does.** Any element with `popover` can be shown in the top layer
(`showPopover()`, `popovertarget`, `commandfor`). `auto`: light dismiss (outside
click, Escape), closes other non-ancestor `auto` popovers, nests by DOM ancestry **or**
by invoker (`popovertarget`/`showPopover({ source })`). `manual`: no light dismiss, no
Escape, doesn't close others. `hint`: closes other hints but not `auto` (tooltips).
`beforetoggle` (cancelable on open) / `toggle` events; `::backdrop` applies.

**Support.**

| Feature | Chrome | Edge | Firefox | Safari / iOS |
|---|---|---|---|---|
| `popover`, `showPopover`, `:popover-open`, `beforetoggle` | 114 | 114 | 125 | 17 (iOS 17; `HTMLElement.popover` IDL iOS 18.3) |
| `showPopover({ source })` | 137 | 137 | 144 | 26 |
| `ToggleEvent.source` | 140 | 140 | 145 | 26.5 |
| `popover="hint"` (current spec) | 151 (133–150 older semantics) | 151 | 153 (149–152 older) | **TP** (iOS —) |

**Accessibility** (Hidde de Vries, "On popover accessibility"; MDN). With a
*declarative* invoker the browser sets `aria-expanded` on the invoker (all engines),
`aria-details` invoker→popover when not adjacent (Chrome/Edge/Firefox, not Safari),
`role=group` on a role-less popover (not Safari), puts the popover next to its invoker
in the **tab order** (desktop), and returns focus to the invoker on close if focus was
inside. Opened from script (`showPopover()` without `source`) none of the invoker
wiring happens. It never adds roles for menus/listboxes and does not move content in
the accessibility tree.

**Pitfalls.**
- Light-dismiss nesting is DOM/invoker based. React portals break DOM ancestry, so a
  portalled submenu inside an `auto` popover closes its parent unless `source` is
  passed (Safari 26+ only) — and `auto` closes *unrelated* `auto` popovers, which
  conflicts with our explicit `parent` layer model.
- Inside a native modal, popovers that aren't DOM descendants of the dialog are inert
  (§1); a modal opening closes `auto`/`hint` popovers.
- Exit animation: hiding removes the element from the top layer immediately; the CSS
  fix (`overlay` + `allow-discrete`) is Chrome-only. Workaround we control: keep it
  shown until our presence machine finishes, then call `hidePopover()`.
- Third-party UI (extensions, chat widgets) cannot render above it (Base UI #485).
- iOS light dismiss was broken until Safari 18.3 (WebKit #267688).
- `showPopover()` throws if not connected / already a modal dialog; jsdom has none of it.
- `hint` semantics changed in 2026 (Chrome 150 release notes: hint no longer closes
  unrelated auto popovers; nested auto popovers downgrade to hint instead of throwing).

**Libraries.** None uses it for components (radix#2941 closed; react-spectrum#7067
closed — devongovett: "maybe we'll eventually support it"; RAC's `ariaHideOutside`
breaks consumer native popovers). Ariakit's styles use `:popover-open` selectors only.

**Decision: avoid in v1; spike `popover="manual"` as an internal "top-layer
promotion" for floating layers before Wave 2.** Never `auto`/`hint` — browser light
dismiss would compete with our layer stack. If adopted, `manual` is used purely for
paint order (escape `overflow`/`transform`, no z-index), with our dismiss, focus and
presence unchanged, calling `showPopover({ source: trigger })` when available. Blockers
to resolve in the spike: extension UI under the top layer, consistent ordering with a
non-top-layer Dialog, jsdom (needs a no-op polyfill). Components: Popover, Menu,
Select, Combobox, Tooltip, Hover Card, Toast region.

---

## 3. Invoker commands (`commandfor` / `command`) and interest invokers (`interestfor`)

**What.** `<button commandfor="id" command="show-modal|close|request-close|toggle-popover|show-popover|hide-popover|--custom">`
— declarative open/close without JS; fires `CommandEvent` on the target.
`interestfor` (on `<a>`/`<button>`) shows a popover on hover/focus/long-press with
built-in delays — designed for tooltips and hover cards.

**Support.** Invoker commands: Chrome/Edge 135, Firefox 144, **Safari/iOS 26.2** →
Baseline newly available (Dec 2025). Interest invokers: **Chrome/Edge 142 only**;
Firefox —, Safari — (WebKit #297786 open, no position); BCD marks it non-standard-track
experimental.

**A11y.** Same implicit `aria-expanded`/`aria-details` wiring as `popovertarget`.
`interestfor` includes keyboard (focus) and touch (long-press) triggering and a
"lose interest" hotkey, which is better than most JS hover cards — but only in Chromium.

**React/SSR.** Plain lowercase attributes pass through React, and they work **before
hydration** (a real progressive-enhancement win). But the browser then changes state
behind the machine's back; we'd have to treat `command`/`toggle` events as inputs, and
they target dialogs/popovers we don't render (§1, §2).

**Libraries.** None uses them.

**Decision: avoid (both).** Revisit `commandfor` if we adopt `popover="manual"`
(pre-hydration triggers). `interestfor`: watch only; Tooltip/Hover Card keep JS hover
intent (delays, safe polygon, focus/long-press), and we copy its behaviour model
(show/hide delays, keyboard parity, long-press on touch) into our spec.

---

## 4. CSS anchor positioning vs `@floating-ui/dom`

**What.** `anchor-name` / `position-anchor` / `anchor()` / `position-area` /
`position-try-fallbacks` / `anchor-size()` / `position-visibility` / `anchor-scope` —
position an absolutely/fixed-positioned element relative to another, in CSS.

**Support.** Core features: Chrome/Edge 125, **Firefox 147** (Jan 2026), Safari/iOS 26
(`position-visibility` 26.2) → Baseline newly available 2026-01. Still moving:
`position-anchor` initial value changed (`normal`) in Chrome 151 / Firefox 151 /
Safari 27 after earlier engines shipped `none`/`auto` (BCD notes, crbug 501399489);
Interop 2026 carries it over for "spec clarity and test reliability".

**Gaps for a component library.** No arrow placement; no *virtual anchors* (caret
rect for Mentions, pointer for Context Menu need a positioned dummy element); only
discrete fallbacks, no `shift`/`limitShift` sliding; no portable way for JS to learn
which fallback won (needed for `data-side`, arrow and transform-origin); anchor names
must be unique per instance (`anchor-scope` helps). Portals are fine (names are
document-scoped; top-layer elements can anchor to anything).

**Libraries.** None ships CSS positioning; Base UI #1663 (open) asks to make
`Positioner` optional so CSS anchoring can drop Floating UI from the bundle; Ariakit
uses `anchor-name` only in its styling package for selection gliders.

**Decision: use with fallback — keep `@floating-ui/dom` as the positioning engine**
(already an allowed dependency). Expose positions as CSS custom properties as planned,
and **additionally** set `anchor-name` on triggers (via connect, `--rind-anchor-<id>`)
so consumers can opt into pure-CSS positioning for simple cases. Revisit making
Floating UI lazy/optional when Interop 2026 closes. Components: all anchored overlays.

---

## 5. `inert`

**What.** Makes a subtree non-focusable, non-clickable, hidden from AT and find-in-page.

**Support.** Chrome/Edge 102, Firefox 112, Safari/iOS 15.5 — Baseline since 2023.

**A11y.** Solid in all engines; it is what removes the need for `aria-hidden` +
`pointer-events` hacks. Note: `inert` on an *ancestor* applies to descendants even if
they are in the top layer; only a modal `<dialog>` escapes ancestor inertness.

**React.** React 19 accepts `inert` as a boolean prop (React 18 needed `""`). We set it
imperatively from `core/dom/inert-outside.ts` anyway (ref-counted).

**Testing.** Not implemented in jsdom (#3605): assert in browser mode only.

**Libraries.** React Aria (`shouldUseInert` for modals), Headless UI
(`useInertOthers`), Zag (`inertOthers` when `supportsInert()`), Ariakit
(`supports-inert.ts`).

**Decision: use** (already decided in overlay-infrastructure §4). No fallback needed.
Components: Dialog, Alert Dialog, Drawer, Tour (modal), closing layers during exit.

---

## 6. `<details name>` and `hidden="until-found"` / `beforematch`

**What.** `<details name="g">` makes a group exclusive (opening one closes the others).
`hidden="until-found"` hides content with `content-visibility: hidden` but lets
find-in-page and fragment navigation reveal it: the browser fires `beforematch`, then
**removes the `hidden` attribute itself**.

**Support.** `details[name]`: Chrome 120, Firefox 130, Safari 17.2 (Baseline 2024).
`::details-content`: Chrome 131, Firefox 143, Safari 18.4. `hidden=until-found`:
Chrome/Edge 102, **Firefox 148**, Safari/iOS **26.2 partial** (doesn't scroll to the
match, WebKit #304174). `beforematch`: Chrome 102, Firefox 139, Safari 26.2.
`interpolate-size` (animate to `height: auto`): Chrome only.

**A11y / why not `<details>` for Accordion.** `<summary>` cannot be wrapped in a heading
(APG Accordion wants `h3 > button[aria-expanded]`), exclusive groups cannot prevent
closing the last open item (`collapsible={false}`), no `aria-controls`, no arrow-key
navigation between headers, and the open state is mutated by the browser. Fine for
plain content disclosure, wrong primitive for a widget.

**React/SSR.** `hidden="until-found"` renders on the server (good: content is in the
HTML and searchable before hydration). Because the browser removes the attribute,
both Base UI (`useCollapsiblePanel.ts`, `panel.setAttribute('hidden','until-found')`)
and React Aria (`useDisclosure.ts`, "Wait a frame to revert browser's removal of hidden
attribute") set it **imperatively** and turn `beforematch` into an OPEN event.
Pitfall: CSS resets with `[hidden]{display:none!important}` defeat it (the content is
then not findable).

**Libraries.** Base UI: `hiddenUntilFound` on Collapsible/Accordion panels. React Aria:
Disclosure uses it by default. Radix, Zag, Headless UI: no.

**Decision.** `<details name>`: **avoid**. `hidden="until-found"`: **use** (progressive
— where unsupported it is plain `hidden`), default on for Collapsible, Accordion, Tabs
panels (closed-but-mounted), Navigation Menu content; `beforematch` → machine `OPEN {
reason: "find-in-page" }`, skipping the animation. Theme must not ship a
`[hidden]{display:none}` override.

---

## 7. Customizable `<select>` (`appearance: base-select`, `<selectedcontent>`)

**What.** Opt a native `<select>` into a stylable rendering: rich `<option>` content,
`::picker(select)` (a top-layer popover anchored with anchor positioning),
`<selectedcontent>` mirrors the selected option's DOM into the button.

**Support.** Chrome/Edge 135, **Safari/iOS 27** (Sep 2026), Firefox **flag only**
(149, `dom.select.customizable_select.enabled`); `<selectedcontent>`, `::picker`,
`::checkmark`: Firefox —. Unsupported browsers fall back to the classic select.

**A11y.** Keeps native keyboard, typeahead and AT semantics — its main strength. WebKit's
"golden rule": every option needs text (visually hidden is fine), images need `alt`.
Chrome's RFC feedback raised screen reader and keyboard concerns while experimental.

**Pitfalls.** No search/filter, no async or virtualised lists, no grouping beyond
`<optgroup>`, no `multiple` styled picker, no interactive content in options;
`<selectedcontent>` is a DOM **clone** (no React state/events, duplicated ids; Chrome
150 changed its update timing); behaviour differs across the three engines; iOS
Safari 27 is days old.

**Libraries.** None builds Select on it. RAC renders a `HiddenSelect` (native, hidden)
only for form submission and autofill.

**Decision: avoid as the Select implementation.** *Updated by
[select.md](select.md) (add-select):* no hidden native `<select>` either — it duplicates
roles and names for tests and AT; one visually hidden `<input>` carries the form value
(Base UI's approach), plus `type=hidden` carriers for multiple values, and autofill is
adopted through `hidden-form-input`'s native-input opt-in. Revisit a "native-styled" Select variant
once Firefox ships. Components: Select (and Native Select docs recipe).

---

## 8. Native `<input type=…>`: date, color, range, number

**Support.** All Baseline for years (date: Safari 14.1; color: Safari 12.1). New bits:
`alpha`/`colorspace` on color inputs Safari 18.4 only (Firefox TP, Chrome —);
`showPicker()` Chrome 99, Firefox 101, Safari 16; `<input switch>` Safari 17.4 only.

**Why libraries avoid them as the visible control.**
- **date**: picker UI, format and first-day-of-week come from the *browser/OS locale*,
  not the app's `locale` prop; unstylable; no ranges, unavailable dates, custom
  calendars or time zones (@internationalized/date needs); segment behaviour differs per
  engine. RAC keeps a visually hidden `type=date`/`datetime-local` (`HiddenDateInput`)
  only so browser autofill works.
- **number**: wheel changes the value, accepts `e`, locale decimal comma handling is
  inconsistent, `valueAsNumber` is `NaN` mid-typing, no formatting (currency, units,
  percent). Base UI and Zag render `type=text` + `inputMode` (Base UI keeps a hidden
  `type=number` for forms and validity, `NumberFieldRoot.tsx`, noting the React
  `stepMismatch` bug #12334).
- **range**: single thumb, pseudo-element styling per engine; but it is the most
  robust AT and touch semantics. Base UI's Slider renders a nested `<input type=range>`
  per thumb; Radix uses `span[role=slider]`. Vertical: `writing-mode` is the
  standard way now.
- **color**: OS picker, no alpha outside Safari, no swatches/areas.

**Decision.** date/number/color: **avoid as visible controls; use hidden native inputs
for form participation, validity and autofill**. range: **use** a visually hidden
`<input type=range>` per Slider/Angle Slider thumb for AT and keyboard semantics (Base
UI's model), with our machine owning the value. Components: Date Picker / Date Field,
Number Input, Color Picker, Slider, Angle Slider.

---

## 9. `focusgroup` (roving focus)

**What.** `focusgroup="toolbar wrap"` etc.: browser-managed arrow-key navigation, one
tab stop, last-focused memory for composite widgets.

**Support.** Shipped in **Chrome 150** (June 2026; "Intent to Ship: Focusgroup",
Chrome 150 release notes) → Chrome/Edge 150+. Firefox: standards position positive, no
implementation; Safari: none (WebKit earlier raised device-independence concerns).
Not in BCD 8.1.5 yet; `@microsoft/focusgroup-polyfill` exists.

**A11y.** Does not add roles or `aria-activedescendant`; only focus movement.

**Decision: avoid.** Roving tabindex stays in `core/collection` (we need typeahead,
disabled-item skipping, RTL, grid navigation, virtualisation anyway). Revisit when a
second engine ships. Components: Toolbar, Tabs, Radio Group, Toggle Group, Menu,
Menubar, Listbox, Tree View, Segmented Control.

---

## 10. Enter/exit animation: `@starting-style`, `transition-behavior: allow-discrete`, View Transitions

**Support.** `@starting-style`: Chrome 117, Firefox 129, Safari 17.5.
`transition-behavior`: Chrome 117, Firefox 129, Safari 17.4. `overlay`: Chrome only.
`interpolate-size`/`calc-size()`: Chrome only. Same-document
`document.startViewTransition`: Chrome 111, **Firefox 144**, Safari 18 (Baseline
newly, Oct 2025); `view-transition-class`: Chrome 125, Firefox 144, Safari 18.2;
element-scoped `Element.startViewTransition`: Chrome 147 only; cross-document
`@view-transition`: Chrome 126, Safari 18.2, Firefox —.

**Fit.**
- `@starting-style` solves **entry** in CSS: style `[data-state=open]` plus a
  `@starting-style` block — no `data-starting-style` JS frame needed (Base UI still
  ships `data-starting-style` for older browsers).
- **Exit** of a removed or `display:none` element still needs JS to keep it in the DOM;
  `allow-discrete` works for `display` but out of the top layer only with `overlay`
  (Chrome). Our presence machine (`getAnimations()`) handles CSS transitions, keyframes
  and WAAPI uniformly.
- View Transitions are document-level: one transition at a time (a toast starting a
  transition aborts a dialog's), the `::view-transition` overlay blocks pointer events
  during the transition, and top-layer capture was added to engines late (WebKit 2024).
  Wrong level for component presence; fine for consumers around `onOpenChange`.

**Decision.** `@starting-style`: **use** — the theme uses it for entry; presence does
not emit a starting attribute (one fewer frame of JS). `allow-discrete`: theme
convenience only. View Transitions: **avoid** inside components; document a recipe
(`flushSync` in `onOpenChange` inside `startViewTransition`). Presence stays JS.
Components: every overlay, Collapsible/Accordion, Toast, Tabs indicator.

---

## 11. `field-sizing: content`

**What.** Form controls size to their content: an auto-growing `<textarea>` in CSS.

**Support.** Chrome/Edge 123, **Firefox 152** (mid-2026), Safari/iOS **26.2** →
Baseline newly available 2026.

**Pitfalls.** Without `min-block-size` an empty field collapses to one line (or the
placeholder's size), so set `min-block-size` instead of relying on `rows`; cap with
`max-block-size` (then it scrolls); growth reflows the layout on every keystroke (anchored
popovers must reposition — Floating UI's `autoUpdate` with `ResizeObserver` handles it).

**Decision: use with fallback.** Theme sets `field-sizing: content` on Prompt Input /
Text Field textareas; when `CSS.supports("field-sizing", "content")` is false the
autosize effect measures `scrollHeight` (one module in `core/dom`, deleted when the
fallback window closes). Components: Prompt Input, Text Field (textarea), Editable,
Tags Input input width.

---

## 12. EditContext API

**What.** Decouples text input/IME from the DOM so custom editors (canvas or DOM)
receive `textupdate`/`textformatupdate`/`characterboundsupdate` directly.

**Support.** **Chrome/Edge 121 only.** Firefox: bug 2046107 — planning DOM-based only,
"not sure how accessibility will be handled" for canvas; WebKit: no published position
(request from 2021). Not an Interop area.

**A11y.** The editing host's text is still whatever DOM you render; canvas rendering
is invisible to AT. Screen reader interaction with EditContext is unproven.

**Decision: avoid.** Prompt Input and Mentions build on `<textarea>` (plain text,
IME-correct, mobile-correct) with a mirror element for caret coordinates and Floating
UI virtual anchors; rich-text (chips inside the field) uses `contenteditable` as a
later, separate component decision. Components: Prompt Input, Mentions / Slash Commands.

---

## 13. `ariaNotify()`

**What.** `element.ariaNotify(text, { priority })` / `document.ariaNotify()` — speak a
message without a live region.

**Support.** Chrome/Edge 141, **Firefox 150**, **Safari/iOS 27** → available in all
engines as of September 2026, but iOS 27 and Firefox 150 are recent; older Safari is
still in use. Real AT behaviour (NVDA/JAWS/VoiceOver queuing, `priority: "high"`
interrupting) has little published testing.

**Decision: use with fallback.** Behind the `Announcer` abstraction (already injected
into machines): `ariaNotify` when present on the target element, otherwise our shared
polite/assertive live region (`[data-rind-top-layer]`, never inerted). jsdom/tests use a
recording Announcer. Components: Toast, Streaming Message, Message Thread, Agent
Presence, Tool Approval, Combobox/Command result counts, File Upload, drag and drop.

---

## 14. `ElementInternals` / form-associated custom elements

**What.** `attachInternals()` + `static formAssociated = true` let a **custom element**
participate in forms (`setFormValue`, validity, `:invalid`) and set default ARIA.

**Support.** Chrome 77, Firefox 93/98, Safari 16.4 — Baseline 2023.

**Fit.** Only available to autonomous custom elements. rind-ui renders native elements
from React (and later Vue/Solid/Svelte), so there is nothing to attach to. Every library
uses hidden native inputs instead (Radix `BubbleInput`, Base UI hidden inputs, RAC
`HiddenSelect`/`HiddenDateInput`), which also gives browser autofill and native
constraint validation for free.

**Decision: avoid.** Hidden native inputs (one `core/dom` helper that dispatches
bubbling `input`/`change` so form libraries see changes). Revisit only for a
Web Components adapter. Components: Checkbox, Switch, Radio Group, Select, Combobox,
Slider, Number Input, Pin Input, Date Picker, Color Picker, Tags Input, Rating.

---

## 15. `scrollbar-gutter` / `overscroll-behavior` for scroll lock

**Support.** `scrollbar-gutter`: Chrome 94, Firefox 97, **Safari 18.2** (Baseline Dec
2024). `overscroll-behavior`: Chrome 63 / Firefox 59 / Safari 16, but it only applied to
containers with scrollable overflow until **Chrome 144** and **Firefox 150** made it
work on non-scrollable containers (so `overscroll-behavior: contain` on a dialog or
backdrop now stops scroll chaining there); **Safari is still partial** (WebKit #243452).

**Fit.** CSS alone cannot lock iOS Safari scrolling (no full `overscroll-behavior`,
`overflow: hidden` on the root ignored while the toolbar is collapsed — see
overlay-infrastructure §5). `scrollbar-gutter: stable` on `<html>` is the cleanest
layout-shift fix but leaves a visible gutter some users dislike (mui/base-ui#4645).

**Decision: use with fallback** — as overlay-infrastructure §5 already states:
`overflow: hidden` on the scroller, compensate with `scrollbar-gutter: stable` when the
author already uses it else padding, `overscroll-behavior: contain` on layer content and
backdrop, plus the iOS `touchmove` policy. Components: Dialog, Alert Dialog, Drawer,
modal Select/Menu on touch, Tour.

---

## Summary

| Primitive | Decision | Components affected |
|---|---|---|
| `<dialog>.showModal()`, `closedby`, `requestClose` | **Avoid** (copy semantics; Portal targets a consumer's open modal dialog / fullscreen element) | Dialog, Alert Dialog, Drawer, Tour |
| `popover` (`auto`/`hint`) | **Avoid** | — |
| `popover="manual"` as top-layer promotion | **Spike before Wave 2**, then use-or-drop | Popover, Menu, Select, Combobox, Tooltip, Hover Card, Toast |
| `commandfor` / `command` | **Avoid** (revisit with popover spike) | Dialog, Popover triggers |
| `interestfor` | **Avoid** (Chromium only); copy its behaviour model | Tooltip, Hover Card |
| CSS anchor positioning | **Use with fallback**: Floating UI positions, `anchor-name` exposed for opt-in CSS | All anchored overlays |
| `inert` | **Use** | Modal layers, exiting layers |
| `<details name>` | **Avoid** | Accordion |
| `hidden="until-found"` + `beforematch` | **Use** (progressive) | Collapsible, Accordion, Tabs, Navigation Menu |
| Customizable `<select>` | **Avoid**; hidden `<input>` (not `<select>`) for forms/autofill — see select.md | Select |
| `<input type=date/number/color>` | **Avoid** visible; hidden native inputs for forms | Date Picker, Number Input, Color Picker |
| `<input type=range>` | **Use** (visually hidden, per thumb) | Slider, Angle Slider |
| `focusgroup` | **Avoid** (Chromium only) | Toolbar, Tabs, Menus, Listbox, Radio/Toggle Group |
| `@starting-style` | **Use** (theme entry animations) | All overlays, disclosures |
| `allow-discrete` / `overlay` | Theme convenience only; presence stays JS | All overlays |
| View Transitions | **Avoid** in components; docs recipe | — |
| `field-sizing: content` | **Use with fallback** | Prompt Input, Text Field, Editable |
| EditContext | **Avoid** | Prompt Input, Mentions |
| `ariaNotify()` | **Use with fallback** (Announcer → live region) | Toast, AI primitives, Combobox |
| `ElementInternals` | **Avoid**; hidden native inputs | All form controls |
| `scrollbar-gutter` / `overscroll-behavior` | **Use with fallback** (+ iOS touch policy) | Modal layers |

## Recommendation: Dialog / Alert Dialog

**A JS-managed `role="dialog"` / `role="alertdialog"` element, not `<dialog>.showModal()`.**
Built on the overlay-infrastructure modules (layer stack, `inert` outside, focus trap,
scroll lock, presence, portal). Weighing the criteria:

1. **Nested layers (Select/Menu/Popover/Tooltip inside a dialog).** With `showModal()`
   everything outside the dialog's DOM subtree is inert — every portalled child must
   render *inside* the dialog, and any non-ancestor `auto` popover is force-closed on
   open. Our explicit-`parent` stack keeps portalled children interactive wherever they
   render. Native wins only if every child layer also lives in the dialog subtree.
2. **Toasts above modals.** Spec-inert: a toast region outside a native modal cannot be
   clicked ("Undo") and cannot rise above it without close/reopen. With JS modals,
   `inertOutside` skips `[data-rind-top-layer]` and the toast stays usable. Decisive.
3. **Portals and third parties.** Extension and widget UIs (Grammarly, chat, password
   managers) render under the top layer (Base UI #485, Radix #2830). A JS dialog with
   z-index coexists with them.
4. **Animation.** Native exit needs `overlay` (Chrome-only) or delaying `close()`; we
   need presence anyway for Drawer, Popover and Toast. JS dialog: one presence model.
5. **Escape semantics.** Alert Dialog must be able to ignore Escape. Native `cancel` is
   non-cancelable without fresh user activation, and `closedby="none"` is not in Safari
   27. JS keydown handling is deterministic.
6. **iOS Safari.** Native gives no scroll lock and no `closedby` on iOS; VoiceOver modal
   focus bugs (WebKit #311125/#314893) hit ARIA dialogs too, so there's no a11y win to
   offset the cost. Both need the same iOS scroll work.
7. **Testing in jsdom.** `showModal`, `popover` and `inert` are all missing in jsdom
   30. A native dialog would need a fake top layer in `@rind-ui/testing/setup`; the JS
   dialog runs as-is in jsdom (minus real inert, which browser mode asserts).
8. **What we give up**: escaping ancestor `overflow`/`transform` without a portal, a
   real `::backdrop`, Android back-button for free. Mitigations: Portal by default
   (needed by every library anyway); a `Backdrop` part; CloseWatcher on Android as a
   follow-up (Base UI Drawer pattern, honouring `cancelable === false`).

Keep native interop anyway: Portal resolves into the nearest open modal `<dialog>`,
top-layer popover or fullscreen element, so rind components work inside a consumer's
native dialog. Revisit when (a) top-layer elements can avoid modal inertness
(whatwg/html#9936-style proposals), (b) `closedby` ships in Safari, (c) `overlay` ships
in Firefox and Safari. The `popover="manual"` spike (§2) is the more likely path to the
top layer: it keeps our own inert/focus/Escape and only borrows paint order.

## Open questions

- `popover="manual"` spike: does top-layer promotion for floating layers behave
  coherently with a non-top-layer Dialog (a popover opened from the page stays above a
  later modal unless the stack dismisses it — copy the spec's "modal closes
  non-ancestor popovers" rule)?
- Android back button: CloseWatcher for every modal layer, or Drawer only (Base UI
  #3905 UX concerns)?
- When does `field-sizing` / `ariaNotify` fallback code get deleted — define the
  browser support policy (e.g. "last 2 major versions + Safari N-1") in a decision record.

## Sources

- MDN browser-compat-data 8.1.5 (2026-10-08): https://unpkg.com/@mdn/browser-compat-data@8.1.5/data.json
- caniuse: https://caniuse.com/wf-invoker-commands, https://caniuse.com/wf-interest-invokers
- HTML spec: https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element,
  https://html.spec.whatwg.org/multipage/popover.html, https://html.spec.whatwg.org/multipage/interaction.html#modal-dialogs-and-inert-subtrees
- Interop 2026: https://web.dev/blog/interop-2026, https://webkit.org/blog/17818/announcing-interop-2026/
- Close requests / user activation: https://groups.google.com/a/chromium.org/g/blink-dev/c/jM5au7yYzHM/m/5SWuXPMdAgAJ,
  https://searchfox.org/firefox-main/source/testing/web-platform/tests/close-watcher/esc-key/not-user-activation.html
- WebKit: https://bugs.webkit.org/show_bug.cgi?id=284592 (closedby), https://bugs.webkit.org/show_bug.cgi?id=267688
  (iOS popover light dismiss), https://bugs.webkit.org/show_bug.cgi?id=311125 (VoiceOver modal focus),
  https://bugs.webkit.org/show_bug.cgi?id=297786 (interestfor)
- Popover a11y: https://hidde.blog/popover-accessibility/
- focusgroup: https://groups.google.com/a/chromium.org/g/blink-dev/c/53PP0LgddCQ/m/Be_6nT9VBgAJ,
  https://developer.chrome.com/blog/new-in-chrome-150, https://developer.chrome.com/release-notes/150
- Customizable select: https://webkit.org/blog/18117/the-golden-rule-of-customizable-select/,
  https://developer.chrome.com/blog/rfc-customizable-select-findings
- Entry/exit animations: https://developer.chrome.com/blog/entry-exit-animations
- EditContext: https://bugzilla.mozilla.org/show_bug.cgi?id=2046107
- field-sizing: https://developer.chrome.com/docs/css-ui/css-field-sizing
- Issues: radix-ui/primitives#2830, #2941; mui/base-ui#485, #1663, #3905, #4645;
  adobe/react-spectrum#7067, #10506, discussions/9696; jsdom/jsdom#3294, #3721, #3605
