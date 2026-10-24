# Review backlog

Review findings classified as **warning** (weak tests, quality, edge cases) are not
fixed during a change's review rounds. They are recorded here and picked up later,
when a related change touches the same code or in a dedicated clean-up change.
See CLAUDE.md "Review rules".

| Change | Reado id | File | Finding |
|---|---|---|---|
| merge-alert-dialog-into-dialog (review) | — | packages/testing/src/components/dialog-alert-role.dom.test.tsx | `frames(6)` waits (pre-existing from add-alert-dialog): wait on a postcondition instead of a frame count |
| test-warning-guard (#103) | — | vitest.config.ts | Warning guard in the browser project: re-enable after the Chromium connection-drop root cause (console/task.meta traffic suspected; with the guard, browser-chromium-1 dropped 2/2 runs, without it passed) |
| add-combobox-variants (spec) | — | openspec/changes/add-combobox-variants | The retired Autocomplete mode `inline` (completion without filtering) is out of scope; revisit when a user asks (mode `none`, a static list, is `autoComplete="list"` with `filter: null`) |
| add-color-picker (site report) | — | packages/core/src/components/color-picker | The hue ChannelSlider track is drawn at the current saturation/brightness: with a near-black value (#0B0B0C) the whole hue track is black and the hue cannot be picked by eye. Draw the hue track at full saturation and brightness (the Area shows the S/B) |
| add-tag-group (r1) | — | packages/react/src/tag-group/tag-group.tsx | Link-only static Tag Group: the server HTML renders `role="list"` until the layout effect runs (registration at commit); the `tags` data form is correct on the server |
| color-picker (site, #103) | — | packages/react/src/color-slider/color-slider.tsx | The channel slider's `defaultValue` (`getChannel(defaultValue, channel)`) is not snapped to the step grid like `value` is (#81): alpha 0.50196… for #33669980 logs the slider warning; snap it, then remove #103's allowance in color-slider.model.dom.test |
| add-tag-group (pending) | — | docs/accessibility/tested-with.json | Manual tier-1 pass on real AT, recorded in "Tested with" (task 8.2) |
| add-tag-group (impl) | — | packages/core/src/components/tag-group/tag-group.contract.ts | Removal announcements are asserted through the announcement log in DOM tests (the contract's announcement kinds don't include removal); ACTIVATE and REMOVE are model-walk skips (DOM tests cover them) |
| add-tag-group (impl) | — | packages/react/src/tag-group/tag-group.tsx | The hidden "Press Delete to remove" hint is one node per group, not one per document; hover/press state lives in React, not the machine |
| add-date-field (impl) | — | packages/theme/src/date-field.css | Task 8.2: no Playwright captures (forced colors, RTL ar-AE, invalid, placeholder state) |
| add-date-field (impl) | — | openspec/changes/archive/*-add-date-field | Spec "Error shown after leaving" says default validation, but the Field defaults to submit mode: the test uses validationMode="blur"; decide whether Date Field should default to blur |
| add-date-field (impl) | — | packages/core/src/components/date-field/date-field.connect.ts | `data-validity` on the hidden input (contract query `validity`) is not in the spec's data-attribute list; add it to the spec or replace the query |
| add-date-field (impl) | — | packages/theme/src/date-field.browser.test.tsx | The theme test imports @rind-ui/react and @rind-ui/testing by relative path (other theme tests mount static markup) |
| add-date-field (impl) | — | packages/react/src/date-field/date-field.tsx | A controlled `null` set again over a partial draft (value already null) cannot clear it: no prop change reaches the machine; reset does |
| add-calendar (impl) | — | packages/testing/src/components | Task 7.2: no tests yet for a Calendar inside a modal dialog (announcer not inert), touch scroll over cells (no selection), ten-step keyboard paging focus ring, japanese era boundary |
| add-calendar (impl) | — | packages/theme/src/calendar.css | Task 8.2: no Playwright captures (forced colors, RTL, two months, reduced motion) |
| add-calendar (impl) | — | packages/core/src/dom/quirks.ts | Task A.2: reserve `nvda-calendar-focus-mode` with the manual pass (11.1); enable only if NVDA needs it |
| add-tree-view (pending) | — | docs/research/tree-view.md | Manual real-AT pass of flat vs nested (`group`) DOM (VoiceOver macOS/iOS, NVDA, JAWS, TalkBack): expand/collapse announcement, level/position, busy; freeze the DOM shape before 1.x (task 0.2) |
| add-tree-view (pending) | — | docs/accessibility/tested-with.json | Manual tier-1 pass on real AT, recorded in "Tested with" (task 8.2) |
| add-tree-view (impl) | — | packages/react/src/tree-view/tree-view.tsx | Every row re-renders when the highlight moves (no per-row selectors) |
| add-tree-view (impl) | — | packages/testing/src/components/tree-view.model.dom.test.tsx | PRESS, INDICATOR, CHECK, programmatic expand/collapse, loader settle and tree/expandedValue prop changes are skipped in the model walk (DOM scenario tests cover them); no lazy or link props class |
| add-tree-view (impl) | — | apps/site/examples/tree-view.tsx | No inline-input example (an input in a treeitem fails axe nested-interactive; covered by a DOM test) and no virtualized example |
| add-grid-list | 3.1 / 6.3 (follow-up, with tree-view virtualization) | Virtualized Grid List: `aria-rowcount`, `aria-colcount`, `aria-rowindex` and select all over unloaded rows; a virtualized fixture and measured spatial moves in a three-column fixture |
| color-picker-one-scope (r1) | — | packages/react/src/number-input | A hosted Number Input's Label still renders `host:label` (the Field host's part); the picker never renders it, so no Field part-name option (YAGNI) |
| color-picker (site) | — | packages/core/src/components/shared/color/format.ts | The picker's ValueText shows unrounded hsl/hsb (`hsl(215.88, 100%, 61.96%)` for #3D8BFF); round to the channel step as the sliders do |
| add-calendar (impl) | — | packages/testing/src/components | Task 7.2: no tests yet for a Calendar inside a modal dialog (announcer not inert), touch scroll over cells (no selection), ten-step keyboard paging focus ring, japanese era boundary |
| add-calendar (impl) | — | packages/theme/src/calendar.css | Task 8.2: no Playwright captures (forced colors, RTL, two months, reduced motion) |
| add-calendar (impl) | — | packages/core/src/dom/quirks.ts | Task A.2: reserve `nvda-calendar-focus-mode` with the manual pass (11.1); enable only if NVDA needs it |
| add-toast (impl) | — | packages/testing/src/components/toast.dom.test.tsx | Task 6.1: not every cited regression issue has its own reproduction test |
| add-toast (impl) | — | packages/testing/fixtures/toast | Task 7.2: forced-colors Playwright captures |
| add-toast (impl) | — | docs/components/toast.md | Task 9.2: manual screen-reader pass (NVDA, JAWS, VO macOS/iOS, TalkBack) |
| add-menubar (impl) | — | (Reado repo) | Task 8.3: migrate Reado's `MenuBar.tsx` and its tests to Menubar (design Migration Plan); the site's Application example models it |
| add-menubar (impl) | — | packages/testing/src/components/menubar.dom.test.tsx | Task 5.1: not every cited regression issue has its own reproduction test (radix-ui/primitives#3699 VoiceOver click and #3762 are covered by the model's virtual run and the vertical tests only) |
| add-drawer (impl) | — | packages/testing/src/components/drawer.dom.test.tsx | Task 8.1: not every cited regression issue has its own reproduction test |
| add-drawer (impl) | — | packages/testing/fixtures/drawer | Task 9.3: forced-colors Playwright captures |
| add-drawer (impl) | — | docs/components/drawer.md | Task 11.2: manual device pass (iOS Safari/Chrome, Android Chrome + TalkBack, VO iOS) |
| add-drawer (impl) | — | packages/core/src/machine/service.ts | A controlled close applied after a later render (zag#3144 "100 ms later") is read as a refusal at the first render that keeps `open`: the drawer settles before closing. Holding a proposal across renders needs a runtime decision (proposal lifetime) |
| add-tour (impl) | — | packages/core/src/components/tour/tour.contract.ts | No `modal` trait on the modal variant (an anchored modal step keeps its target exposed); inert and Tab wrap are covered in the DOM suite. No `target` query (no attribute locator in the contract env) |
| add-tour (impl) | — | packages/testing/src/components/tour.model.dom.test.tsx | Model walk covers no wait step (advancing one needs a page interaction the runner can't make); DOM tests cover wait steps |
| add-tour (impl) | — | apps/site/examples/tour.tsx | No RTL, 320 px or nested-scroll examples; no ARIA snapshot files (site-examples harness not on main) |
| add-tour (impl) | — | packages/react/src/tour/tour.tsx | Spotlight geometry painted by the tour from the virtual anchor + a MutationObserver on the positioner's style (positioning reports no `anchorRect`) |
| add-qr-code (r2) | — | packages/testing/fixtures/qr-code/qr-code.pw.test.ts | The download postcondition needed a 20 s deadline on CI (page JS export ~1.6 s at 20× CPU throttle); profile the export path |
| add-color-picker (impl) | — | packages/core/src/components/color-picker | Machine has `closed`/`open` only; `inline` is a prop that blocks opening (a bound state would block leaving `closed`) |
| add-color-picker (impl) | — | packages/react/src/color-picker/color-picker.tsx | Eye dropper handled in the React adapter, not a machine effect; picker root never sets `data-dragging` |
| add-listbox (r1) | — | packages/testing/src/components | Task 5.4 (virtual screen-reader reading order: name, options, description, selection state, empty description) not done |
| add-listbox (r1) | — | apps/site/examples/listbox.tsx | Task 7.1: no virtualized site example (needs a virtualizer recipe without a new dependency) |
| add-combobox (impl) | — | openspec/changes/add-combobox | Task 0.2: design "Requests to other changes" 1–3 not raised with their owners (the Apple-only rule is behind `vo-activedescendant`) |
| add-combobox (impl) | — | packages/react/src/combobox | Task 0.3: the abort signal is an AbortController in the adapter; no `env.abort()` capability |
| add-combobox (impl) | — | packages/testing/src/components | Task 6.1: no tests for the IME edge cases (Korean mid-syllable, Android composition filtering, pointer choice during a composition), the touch ghost click, VoiceOver iOS double tap |
| add-combobox (impl) | — | packages/testing/src/components | Task 6.3: no virtualized combobox test (10,000 options, End/wrap to index 9999) |
| add-combobox (impl) | — | packages/testing/src/components | Task 6.4: no virtual screen-reader log test (open, arrow, choose, empty results) |
| add-combobox (impl) | — | packages/theme/src/combobox.css | Task 7.2: no Playwright forced-colors captures |
| add-combobox (impl) | — | packages/core/src/components/combobox | Separator stays visible between two groups when one is filtered out |
| tags-input-suggestions (impl) | — | packages/react/src/tags-input/tags-input.tsx | Suggestions are data-driven only (`items` / `collection`): static `<TagsInput.Item>` children do not register (the host's `registry` is null), unlike Combobox |
| tags-input-suggestions (review) | — | packages/react/src/tags-input/tags-input.tsx | `results` uses the stale frozen list whenever the popup is closed: use `openNow \|\| !present ? live : frozen.current` |
| tags-input-suggestions (review) | — | packages/core/src/components/tags-input/tags-input.machine.ts | `tagSuggestions` hides chosen options by exact match while the duplicate check uses `compare` |
| tags-input-suggestions (review) | — | packages/core/src/components/tags-input/tags-input.machine.ts | A refusal of a chosen option announces its raw key, not its label |
| tags-input-suggestions (review) | — | packages/testing/src/components/tags-input-suggestions.dom.test.tsx | Missing tests: aria-activedescendant on arrows, ArrowDown opening on the first option, Escape inside a Dialog, Backspace on an empty draft with the popup open, Enter in pointer modality |
| tags-input-suggestions (review) | — | packages/react/src/tags-input/tags-input.tsx | No dev warning for static Items rendered without `items` / `collection` |
| tags-input-suggestions (impl) | — | packages/testing/fixtures/examples.pw.test.ts | `tags-input:suggesting` is listed as transient (no prop opens the popup): no static state example; its ARIA is covered by the suggestions DOM tests |
| add-tags-input (impl) | — | packages/testing/src/components | Tasks 5.1/5.2: no browser IME replays (Japanese, Pinyin, Korean, Safari commit Enter), no Android keyCode 229 delimiter test, no modal dialog host test |
| add-tags-input (impl) | — | packages/theme/src/tags-input.css | Task 6.2: no Playwright forced-colors captures |
| add-tags-input (impl) | — | packages/testing/src/components | Task 5.3: no RTL model run |
| add-listbox (impl) | — | packages/core/src/i18n/locale.ts | Direction comes from the provider or `<html>`; a nested `dir="rtl"` around a horizontal list is ignored (repo-wide; pass the provider's `dir`) |
| add-listbox (impl) | — | packages/theme/src/listbox.browser.test.tsx | Forced-colors checks read the stylesheet; emulated captures still to add (tasks 6.2) |
| add-listbox (impl) | — | packages/core/src/i18n/locale.ts | Direction comes from the provider or `<html>`; a nested `dir="rtl"` around a horizontal list is ignored (repo-wide; pass the provider's `dir`) |
| add-listbox (impl) | — | packages/theme/src/listbox.browser.test.tsx | Forced-colors checks read the stylesheet; emulated captures still to add (tasks 6.2) |
| add-select (impl) | — | packages/testing | Task 4.2: driver tests in happy-dom (not a repo dependency; needs a decision) |
| add-select (impl) | — | packages/testing/src/components/select.dom.test.tsx | Task 5.1: not every cited regression issue has its own reproduction test; Task 3.4: select inside a popover |
| add-select (impl) | — | packages/testing/fixtures/select | Task 6.2: forced-colors Playwright captures; Task 5.3: scroll-overflow and one-element-per-query tests |
| add-select (impl) | — | docs/components/select.md | Task 8.2: manual screen-reader pass (VO/Safari macOS+iOS, NVDA/Firefox, JAWS/Chrome, TalkBack, Firefox Android touch) |
| add-select (impl) | — | packages/core/src/components/select/select.contract.ts | Task A.3: `field-associated` trait and the Field prop × control matrix test |
| add-progress (impl) | — | packages/core/src/components/progress/progress.contract.ts | `$props:value` prop steps set a fixed value (Progress 100, Meter 90): a prop step only receives the target state; coverage of both transitions relies on varied starting configurations |
| add-meter (impl) | — | packages/core/src/components/meter/meter.machine.ts | Internal `VALUE.CHANGE` event from `onProps` instead of "no events" (design §5), so `testMachine` has edges to walk |
| add-image (impl) | — | packages/testing/src/components/image.model.dom.test.tsx | As Avatar: image events are browser-fixture skips in the model walk; statuses covered by browser props-class tests |
| add-qr-code (r1) | — | packages/react/src/qr-code/qr-code.tsx | `apiRef` finds frame/pattern/overlay with `document.getElementById`: breaks inside a shadow root (use the Root element's root node) |
| add-qr-code (r1) | — | packages/testing/src/components/qr-code.dom.test.tsx | No Root re-render test with an inline `encoding` object (the compare-by-value claim) |
| add-qr-code (r1) | — | packages/core/src/qr/qr.test.ts | The auto-mask oracle is circular (it reuses the encoder's own penalty); compare with fixtures' chosen masks instead |
| add-qr-code (impl) | — | packages/core/src/components/qr-code/qr-code.contract.ts | Contract is `qrCodeContractWith(decode)` (core cannot import the testing decoder); `setValue` types into the page's "Value" control |
| add-qr-code (impl) | — | packages/testing/fixtures/qr-code/qr-code.pw.test.ts | ARIA snapshots and axe run inline in the Playwright fixture until the site-examples snapshot harness exists |
| add-listbox (r1) | — | packages/testing/src/components | Task 5.4 (virtual screen-reader reading order: name, options, description, selection state, empty description) not done |
| add-listbox (r1) | — | apps/site/examples/listbox.tsx | Task 7.1: no virtualized site example (needs a virtualizer recipe without a new dependency) |
| add-listbox (impl) | — | packages/core/src/i18n/locale.ts | Direction comes from the provider or `<html>`; a nested `dir="rtl"` around a horizontal list is ignored (repo-wide; pass the provider's `dir`) |
| add-listbox (impl) | — | packages/theme/src/listbox.browser.test.tsx | Forced-colors checks read the stylesheet; emulated captures still to add (tasks 6.2) |
| add-scroll-area (r1) | — | packages/core/src/dom/scroll-metrics.ts:152 | The tabbables walk runs per scroll frame; cache it and invalidate on subtree mutation |
| add-scroll-area (r1) | — | packages/testing/src/components/scroll-area.browser.test.tsx | Release outside the window is tested without a pointer move after release |
| add-scroll-area (r1) | — | packages/testing/src/components/scroll-area.dom.test.tsx | Unmount leak check covers wheel listeners only (pointer, resize and mutation observers unchecked) |
| add-scroll-area (r1) | — | packages/core/src/components/scroll-area/scroll-area.contract.ts | The tab-stop invariant derives from the component's own `data-tab-stop`, not from an independent oracle |
| add-scroll-area (r1) | — | packages/theme/src/scroll-area.css | Forced-colors fallback: confirm the spec intent (system scrollbars vs drawn thumb) |
| add-scroll-area (impl) | — | packages/testing/src/components/scroll-area.browser.test.tsx | Not covered yet: Collapsible inside, 30-instance read/write interleaving trace, Trusted Types enforcement, fast drag released outside the window, re-hover without a thumb jump |
| add-scroll-area (impl) | — | packages/testing/src/components/scroll-area.model.dom.test.tsx | Model walk is browser-only with layout events (`SCROLL`, `DRAG.*`, `METRICS`) skipped; covered by browser tests |
| add-pin-input (r1) | — | packages/core/src/components/pin-input/pin-input.machine.ts:81 | A paste of a code identical to the complete value never completes again (`next !== previous`) |
| add-pin-input (r1) | — | packages/core/src/components/pin-input/pin-input.connect.ts:59 | `codePattern` drops the consumer pattern's flags (an `i` pattern loses case-insensitivity in the native `pattern`) |
| add-pin-input (r1) | — | packages/testing/fixtures/pin-input | No trusted Ctrl/⌘+V run (the clipboard paste through the OS shortcut) |
| add-pin-input (r1) | — | packages/testing/src/components/pin-input.dom.test.tsx | No assertion-level tests for ArrowLeft/Right, Home/End and Backspace moving the active slot |
| add-pin-input (impl) | — | packages/testing/src/components/pin-input.broken.dom.test.tsx | Broken variants "Enter prevented", "focus moved after autoSubmit" and "completion missed on paste replacement" are not modelled: no step invariant records Enter, focus after submit or completion counts (scenarios cover the correct paths) |
| add-pin-input (impl) | — | packages/theme/src/pin-input.browser.test.tsx | Forced-colors and reduced-motion checks read the stylesheet; emulated captures of the six states still to add (tasks 8.2) |
| add-pagination (r1) | — | packages/core/src/components/pagination/pagination.machine.test.ts | Out-of-range page clamp (`defaultPage` above `totalPages`, below 1) untested |
| add-pagination (r1) | — | packages/testing/src/components/pagination.dom.test.tsx | "current page does nothing" has no positive control (a non-current page does call `onPageChange`) |
| add-pagination (r1) | — | packages/core/src/components/pagination/pagination.connect.test.ts:84 | Loose `toContain` where an exact list is meant |
| add-pagination (r1) | — | packages/testing/fixtures/pagination/pagination.pw.test.ts | Middle-click-opens-new-tab skipped on WebKit (headless WebKit follows it in the same tab even on a bare `<a>`) |
| add-pagination (r1) | — | packages/testing/src/components/pagination.model.dom.test.tsx | No model class with `disabled` + `getPageHref` (disabled link triggers) |
| add-breadcrumbs (r1) | — | packages/core/src/components/breadcrumbs/breadcrumbs.test.ts | Development warnings tested only on the positive path (no "does not warn" cases) |
| add-breadcrumbs (impl) | — | packages/react/src/breadcrumbs/breadcrumbs.tsx | One Root context: every Item re-renders on a trail change (task 3.1 asks for per-part selectors) |
| add-breadcrumbs (impl) | — | packages/react/src/breadcrumbs/breadcrumbs.tsx | Static Items register at commit: the server HTML has no `aria-current` (design §6 covers collapse; the `items` form has both) |
| add-breadcrumbs (impl) | — | packages/core/src/components/breadcrumbs/breadcrumbs.contract.ts | No Menu yet: `openCollapsed`/`followCollapsed` work with a Popover; extra Ellipsis `data-label` locates the trigger |
| add-pagination (impl) | — | packages/core/src/components/pagination/pagination.contract.ts | `focused()` became `isFocused(control)`: the runner reads every no-argument query after each step and a focus query trips its focus-does-not-commit check |
| add-password-input (impl) | — | packages/theme/src/text-field theme tests (password and search) | The forced-colors checks read the stylesheet's system colours (as number-input's theme test); an emulated forced-colors capture of the rendered parts is still to add (tasks 7.2) |
| add-search-field (impl) | — | packages/testing/src/components/text-field-search.broken.dom.test.tsx | Broken variant "clear bypassing validation (react-spectrum#7265)" not modelled: no invariant observes a stale Field error yet; the scenario test "Clear re-validates" covers the correct path |
| add-password-input (impl) | — | packages/core/src/components/field (submit on an invalid Field) | A pointer submit of a natively invalid Field focuses the control with `data-focus-visible` (seen in the password model; that config uses `validationBehavior="aria"`) |
| add-number-input (r1) | — | packages/core/src/components/number-input/number-input.machine.ts:253, number-input.connect.ts:181 | `canStep` (trigger aria-disabled, guard) is judged on the committed value while `stepBase` steps from the typed text |
| add-badge (impl) | — | packages/core/src/components/badge/badge.contract.ts | `isExposed()` reads only the root's own `aria-hidden`; an `aria-hidden` ancestor needs an adapter query (`ponytail:` comment) |
| add-badge (r1) | — | packages/react/src/badge/badge.tsx | The post-mount host check's layout effect has no deps and re-warns on every render; dedupe by key (host + message) |
| add-badge (r1) | — | packages/core/src/components/badge/badge.connect.ts | `badgeWarnings` checks live `role` and `aria-live` but misses `aria-atomic` and `aria-relevant` (spec: Never A Live Region) |
| add-skeleton (impl) | — | packages/testing/src/components/skeleton.ts | `announcements()` takes its starting count lazily: an announcement made before the first read is cut from the driver's log (tests await it first) |
| add-avatar (impl) | — | packages/testing/src/components/avatar.model.dom.test.tsx | `$props:src` is declared but the machine graph has no edge for it (`src` is an Image prop): `testMachine` only reports skips; statuses are covered by browser props-class tests |
| add-aspect-ratio (impl) | — | scripts/docs-gen.ts | The spec asks for an `llms-full.txt` that includes the recipe page; no `llms-full.txt` pipeline exists yet (decision 0005) |
| add-slider (r1) | — | packages/core/src/components/slider/slider.machine.ts:182 | `push`: the dragged thumb's input value is written before the neighbours' min/max widen, so the browser can clamp it for a frame |
| add-slider (r1) | — | packages/core/src/components/slider/slider.math.ts:68 | `largeStep` is rounded to the step's decimals (a finer custom largeStep is coarsened) |
| add-slider (r1) | — | packages/react/src/slider/slider.tsx:240 | `formInput` is a new function every render, so the Thumb's track effect re-subscribes each render |
| add-slider (r1) | — | packages/testing/src/invariants.ts:945 | `valued` no longer flags a non-canonical numeric text such as "3.0" against value 4 |
| add-slider (r1) | — | packages/core/src/components/slider/slider.contract.ts:89 | Module-level `gesture` state: two drivers dragging concurrently would share it |
| add-slider (impl) | — | apps/site/examples/slider.tsx | No `dragging` state example or ARIA snapshot (a static page cannot hold a drag); revisit with retire-storybook 2.3 state coverage |
| add-slider (impl) | — | packages/testing/fixtures/slider/slider.pw.test.ts | Bundles its own page with rolldown; move to `openExample` when retire-storybook 2.1 lands |
| add-slider (impl) | — | slider.dom.test.tsx (RX#570) | A vertical swipe scrolling the page over a horizontal Slider is asserted only through `touch-action: pan-y pinch-zoom`; the real-touch check belongs to the manual device protocol |
| add-separator (r1) | — | packages/react/src/separator/separator.tsx:~66 | warnKey omits aria-value* and tag; tabIndex "0" (string) skips the splitter warning — add VALUE_ATTRS to the key, normalise Number(tabIndex) |
| add-separator (r1) | — | packages/react/src/separator/separator.tsx (tag) | function/component render: first render assumes div (role=separator on an <hr>) until the layout effect — harmless, document |
| add-separator (r1) | — | packages/testing/src/adapters/dom.ts:232 + driver docs | `part` anchor never matches the container itself and only data-scope=separator root (host-drawn toolbar separators found only by role/name) — document; add-toolbar decides |
| add-separator (r1) | — | packages/testing/src/entries.test.ts | "optional peers" timed out at 5s under full-suite load — new load flake |
| add-tabs (r1) | — | packages/core/src/dom/tabbable-content.ts (hasTabbable) | ignores CSS-hidden (display/visibility) and fieldset-disabled descendants: a panel whose only control is hidden or in a disabled fieldset loses its own tab stop |
| add-tabs (r1) | — | packages/react/src/tabs/tabs.tsx (Panel) | the panel's tabindex=0 renders before the tabbable observer's first report: a one-commit flash on panels with controls (could seed from hasTabbable in a layout effect) |
| add-tabs (r1) | — | docs/components/tabs.md, tabs.meta.ts | `defaultValue={null}` (uncontrolled, start with nothing selected → still picks the first enabled) is undocumented |
| add-toggle-group (r1) | — | packages/react/src/declared-items.ts | the server tab stop reads items declared in the Root's JSX children; items rendered inside a consumer wrapper component are not seen, so their server stop falls back to registration (the first client commit) |
| add-toggle-group (r1) | — | packages/core/src/components/toggle-group/toggle-group.contract.ts (toggle.done) | `|| before === "true"` accepts a pressed item that failed to release in every mode — only valid with disallowEmptySelection (read props) |
| add-toggle-group (r1) | — | packages/testing/src/components/toggle-group.dom.test.tsx | "modifiers, IME and foreign targets ignored" only tested for Control+ArrowRight — add Alt/Meta/isComposing/nested-instance keydown tests |
| add-radio-group (r1) | — | packages/core/src/components/radio-group/radio-group.connect.ts:202-210 | pending + no value: server HTML has no tab stop (spec: first rendered item tabindex=0 in server render) — needs a first-rendered signal or a spec amendment **Resolved** in add-toggle-group (r1): the Root computes the server stop from the declared items (react/src/declared-items.ts). |
| add-radio-group (r1) | — | packages/testing/src/invariants.ts:~256-267 | stateAttrs exemption (data-invalid without aria-invalid under any aria-invalid ancestor) too broad — gate on radiogroup/radio **Resolved** in add-radio-group (r1): gated on role radio inside a radiogroup with aria-invalid. |
| add-radio-group (r1) | — | packages/testing/src/invariants.ts:~113-117 | selectedFlag accepts data-state="checked" for every composite — gate on itemPart === item-control **Resolved** in add-radio-group (r1): gated on role radio. |
| add-radio-group (r1) | — | packages/testing/src/model.ts:1116 | focus-does-not-commit skips hidden-input for every form-associated contract — scope to contracts declaring commitsOnFocus **Resolved** in add-radio-group (r1): only contracts declaring commitsOnFocus. |
| add-radio-group (r1) | — | packages/react/src/radio-group/radio-group.tsx:~245 | parent accepting a proposal asynchronously after a later commit loses the input/change dispatch (pending cleared in layout effect) — unverified |
| site audit (rind-ui-e2) | — | core connect / docs/guides/hidden-until-found | `data-reveal` is generic: a consumer's own [data-reveal] style hid every Accordion/Collapsible panel on the site — namespace it (data-rind-reveal?) or document the collision |
| add-checkbox-group (r1) | — | packages/testing/src/model.ts:578 (replayEnv) | labelled() not wrapped in touch-hover/composing replays: actions through labelled() run for real (Field contract types for real instead of composing); directed() wraps it → inconsistent. Wrap with a role/name, then fix the Field broken-variant test |
| add-checkbox-group (r1) | — | layer.pw.test.ts | "layer [touch|pointer|keyboard]: closed —OPEN→ open —CLOSE→ closed" fails under full-suite load (passes alone) — recurring flake, investigate timing |
| add-switch (r1) | — | packages/react/src/index.ts | createFormToggle + FormToggle* types re-exported as public API (internal factory); FormToggleService.checked typed CheckedState lets Switch receive "indeterminate" — drop the re-export unless third-party toggles are a goal |
| add-switch (r1) | — | scripts/docs-examples.test.ts:~29 | tag regex stops at the `>` of `=>`: a self-closing <X.Root onFoo={() => …} /> counts as open and hides later misplaced parts (false negative) — balanced-brace scan |
| add-switch (r1) | — | packages/react/src/form-toggle/form-toggle.tsx | Switch.Thumb function children receive indeterminate (always false) — narrow SwitchThumbProps |
| add-switch (r1) | — | packages/react/src/collapsible + accordion | Accordion decoration spreads into own props before mergeProps, so it can override critical aria-* silently; critical check skips keys absent from base (aria-controls when content unrendered) |
| add-checkbox (r1) | — | packages/react/src/checkbox/checkbox.tsx (Control onKeyDown) | Enter guard misses keyCode 229 (Safari commit keydown after compositionend) → IME Enter could implicitSubmit; share one isImeKey(e) with press.ts |
| add-checkbox (r1) | — | packages/core/src/dom/modality.ts (onClick) | pressLabel never cleared when the label wraps the control → later AT click stays "pointer" and a later programmatic focus is cause "pointer" (ring hidden); clear after the first forwarded click |
| add-checkbox (r1) | — | packages/react/src/checkbox/checkbox.tsx (lastReason) | UNVERIFIED: controlled parent rejecting a toggle leaves lastReason "TOGGLE", so a later programmatic checked change may reach the Field as user: true — write a test |
| add-toggle (r1) | — | packages/react/src/toggle/toggle.tsx:80-86 | stable-name dev check runs accessibleNameOf in production (and keeps accname.ts in the bundle) — guard the effect with NODE_ENV like text-field |
| add-toggle (r1) | — | packages/theme/src/toggle.css | forced-colors [data-state=on] rule is dead (base.css :where([data-scope])[data-state=on] wins) — delete or raise specificity |
| add-toggle (r1) | — | packages/core/src/dom/accname.ts | subset accname (no hidden-labelledby, title, svg title, CSS display/pseudo content) is public API — mark @internal |
| add-toggle (r1) | — | packages/testing/src/components | Toggle lacks SSR/hydration tests, React-level controlled/cancel/undefined tests, aria-pressed override warning test, Indicator-outside-Root test |
| add-accordion (r1) | — | packages/core/src/components/accordion/accordion.contract.ts:62-85 | heading invariant doesn't check "trigger is the header's only element child" nor name the item; triggers matched by name conflate same-label items |
| add-accordion (r1) | — | accordion.connect.ts:57-60 / accordion.tsx:174 | region rule uses registered item count (0 on server) → SSR of 8-item multiple accordion gives role=region until mount — count Item children or document |
| add-accordion (r1) | — | accordion.machine.ts:67-77 | single-mode "more than one value" warning keyed by array identity → fires every render with inline arrays |
| add-accordion (r1) | — | accordion.contract.ts:13 | module-level accordionArgs.current: unsafe under describe.concurrent, silent "" item when unset — let testMachine pass the argument class |
| add-accordion (r1) | — | packages/react/src/collapsible/collapsible.tsx | decoration rebuilt every render (api in memo deps) — harmless, defeats the memo |
| add-collapsible (r1) | — | packages/core/src/dom/content-size.ts | switched()/settled(): navigation-menu adapter must snapshot animations after switched() and cancel a pending settle on switch→switch; in-place swap needs px pinned before the swap or switched(from) — decide when speccing add-navigation-menu |
| add-collapsible (r1) | — | packages/core/src/dom/content-size.ts | measure()/closed() use scrollHeight/Width (exclude borders): bordered/border-box content a few px short |
| add-collapsible (r1) | — | packages/testing/fixtures/layer/layer.pw.test.ts | "reopenDuringExit" (pointer) failed once under full-suite load, passed uncached — possible new flake |
| add-text-field (r1) | — | packages/react/src/text-field/text-field.tsx | soft-max error key is customError, not tooLong as spec/tasks say — map the key or amend the spec (match="tooLong" won't match) |
| add-text-field (r1) | — | packages/core/src/components/text-field/text-field.contract.ts | ClearTrigger invariant only checks "rendered while not clearable" (spec: exactly when) — add the reverse check |
| add-text-field (r1) | — | packages/core/src/contract | contract event-mapping `args` type loses action parameters; text-field uses `as never` — widen the args type to the action's parameters |
| add-text-field (r1) | — | packages/core/src/components/text-field/text-field.machine.ts | buildTextFieldMachine merges presets with `as never`: preset event names unchecked — type it when Search Field/Password Input/Number Input reuse it |
| add-form (r1) | — | packages/react/src/form/form.tsx | Field unmounting while Form is validating never sends FIELD.SETTLED → hold stranded, data-validating stuck; send settled() from register cleanup |
| add-form (r1) | — | packages/react/src/form/form.tsx (byName memo) | inline errors={{...}} re-applies a cleared server error on every parent re-render (identity-keyed) — compare by content or document stable object |
| add-form (r1) | — | packages/core/src/components/field/field.machine.ts (lastAsync) | cache never expires, not cleared on RESET or validate identity change; File/Blob collide as {}; stringify failure → null key could re-hold loop |
| add-form (r1) | — | packages/core/src/components/form/form.machine.ts | `name in errors` matches prototype keys (constructor) and empty messages; framework RESET clears form data-invalid while Fields keep server errors; VALIDATE during validating/awaiting-server aborts the hold; quietIfManaged focusMoved not cleared on !displayAllowed; locate only by name |
| add-field (r1) | — | packages/react/src/field/field.tsx:402 | Field.Label focusTarget passes modality "pointer", so an AT (virtual) label click is re-labelled pointer — pass the current modality |
| add-field (r1) | — | packages/testing/src/invariants.ts (field-associated) | describedby filter keeps only ids starting with "field-" while expected set is all rendered part ids → false positive when Description/ErrorMessage get a consumer id; filter by field.partIds |
| add-field (r1) | — | packages/react/src/field/field.tsx (useFieldControl) | claim during render / release in effect cleanup: after a StrictMode-style remount the owner is null until next render (repro still passed) |
| add-fieldset (r1) | — | packages/core/src/dom/fieldset-disabled.ts | watchFieldsetDisabled returns early when the part has no fieldset ancestor at watch time, so moving it into a disabled fieldset later is missed |
| add-fieldset (r1) | — | packages/core/src/dom/fieldset-disabled.ts | document-level childList observer re-checks every watch on every mutation batch — filter records to fieldset/legend changes |
| add-fieldset (r1) | — | openspec specs (fieldset) / docs | substituted Legend (render={<div/>}) gets no first-legend exemption (matches native) — state it in spec/docs; reconcile "ErrorMessage listed while rendered" vs forceMount-while-valid not listed |
| add-fieldset (r1) | — | add-switch/radio-group/select/checkbox/text-field | it.todo Fieldset scenarios (6.1, 8.1 partial) must become tests when those components land |
| add-label (r1) | — | packages/core/src/components/shared/label-interaction.ts:31-35 | labelTarget: a substituted label (render={<span/>}) without htmlFor finds no wrapped control — fall back to first labelable descendant or document the limit |
| add-label (r1) | — | add-checkbox / add-field / add-radio-group | Re-check "Group target" (focus the checked or first enabled radio) and "Labels Focus Popup Triggers" (Select) with real consumers; fix the test's dangling aria-labelledby="size" |
| add-label (r1) | — | packages/react/src/label/label.tsx | checkLabelTarget only re-runs when htmlFor changes; a target mounting later with the same htmlFor isn't re-evaluated |
| add-label (r1) | — | packages/testing/src/adapters/playwright.ts | labelled() via getByLabel(text, exact) may match several controls when two labels share text (DOM adapter resolves the label's own control) — unverified |
| add-button (r1) | — | packages/core/src/dom/fieldset-disabled.ts:45 | watchFieldsetDisabled observes only `disabled`; re-parenting into a disabled fieldset or legend order changes aren't tracked (observe childList) |
| add-button (r1) | — | packages/core/src/dom/press.ts:549 | Space on submit/reset leaves state "key" until the native click; if it never comes data-pressed sticks until blur — add a scheduler timeout guard; check Firefox/WebKit |
| add-button (r1) | — | packages/testing/src/invariants.ts:213 | stateAttrs accepts aria-disabled="false" together with disabled + data-disabled |
| add-button (r1) | — | add-fieldset | Button's SHALL "enclosing Fieldset/Field context disables portalled parts" is an it.todo — add-fieldset must implement it and turn the todo into a test |
| add-heading (r1) | — | packages/react/src/heading/heading.tsx + heading.connect.ts | warnEmptyHeading has no once-guard (dependency-less effect) → logs on every re-render; guard with a ref like warnedDeep |
| add-heading (r1) | — | packages/core/src/components/heading/heading.connect.ts | warnEmptyHeading false positive for image-only (img alt) or aria-label-only content; check accessible name instead of textContent |
| add-heading (r1) | — | packages/core/src/collection/list.test.ts | "Constant-time navigation" timing test flakes under full-suite load (passes in isolation) — loosen or move to a perf project |
| add-link (r1) | — | packages/react/src/link/link.tsx:62-68 | `staticTag` guesses "a" for a FUNCTION render: server output for render={(p)=><div {...p}/>} is <div href> without role/tabindex until hydration — document or dev-warn |
| add-link (r1) | — | packages/core/src/dom/link.ts:279-290 | onAuxClick fires onActivate without honoring a prevented event, and the consumer's onAuxClick isn't suppressed on a disabled link |
| add-link (r1) | — | link tests | "innermost provider wins" test cites react-spectrum#6557 (that's the external _blank case) — fix citation |
| add-link (r1) | — | docs/accessibility/manual-protocol.md | Manual check: real Safari ⌘-Enter on a role=link fallback (temporary-anchor fallback click may lose modifiers → same tab) |
| add-theme-system (verification) | — | docs/theme/white-label.md | Document that live CSS picks on-solid by the L 0.6 threshold while the builder picks by luminance: in the L≈0.55–0.62 band they can choose different text colours (each internally consistent; the builder is the validated path) |
| add-theme-system (r1) | — | packages/theme/package.json | tokens.manifest.json not in `files`/`exports` ("published manifest" SHALL) |
| add-theme-system (r1) | — | packages/theme/src/builder/theme.ts:377-394 | DTCG: dtcgColor drops alpha (overlay /0.45); brand.radius emitted as string, 2025.10 wants {value, unit}; only structural checks |
| add-theme-system (r1) | — | docs/theme | data-tone="accent" inside another tone is a no-op (technical limit) — document it |
| add-theme-system (r1) | — | packages/theme tests | icons.browser.test defines its own RTL/mask rules; no icon forced-colors (CanvasText) test; forced-colors border uses a demo stylesheet — add real tests when the first icon component (Checkbox/Select) lands |
| add-theme-system (r1) | — | packages/testing/fixtures/disclosure/disclosure.pw.test.ts:363 | stale `class="rind-root"` wrapper |
| add-theme-system (r1) | — | packages/theme/src/builder/derive.browser.test.ts:107 | stale "BUG" comment about clamp(-1,*1000,1) |
| add-floating-positioning (r1) | — | packages/core/src/dom/position/track.ts:~280 | pagehide stops tracking but ignores event.persisted and nothing re-arms on pageshow — a bfcache restore leaves an open popup untracked |
| add-floating-positioning (r1) | — | positioning tests | Ariakit#7625 keyboard-open test can't scroll anyway (unplaced popup is fixed at origin); keyboard-shrink emulated by pinch-zoom; pinch test uses dropdown (no align flip); iframe-removed test counts only window/document/visualViewport listeners |
| add-floating-positioning (r1) | — | packages/core/src/dom/inert-outside.ts | opener exclusion `filter(el => !el.contains(opener))` drops a whole element containing the opener — a non-portalled layer registering a root that wraps trigger + exiting content leaves that content non-inert during exit; exclude only the opener's own marking path |
| add-floating-positioning (r1) | — | packages/theme/src/overlay.css | generic [data-part="positioner"] rule reset by scoped positioner.css; scoping the overlay rule would be cleaner |
| add-overlay-infrastructure (found during add-collections) | — | packages/core/src/dom/presence.dom.test.ts | **CI risk**: "waits for the animation that replaces a cancelled one (retarget)" flakes in WebKit under full-suite load (passes 5/5 alone) — stabilise (deterministic animation control) before CI runs WebKit on every PR |
| add-collections (r1) | — | packages/core/src/collection/composite.ts:66 | `tabStop` doesn't map a hidden HIGHLIGHTED node to its nearest visible ancestor (spec: selected or highlighted); transient (repair follows) |
| add-collections (r1) | — | packages/core/src/collection/typeahead.ts:70 | Repeated-character detection is case-sensitive ("d","D","d" over Dog/Duck/Deer resets); compare case-folded |
| add-collections (r1) | — | packages/testing/src/invariants.ts (composite-roving) | Container fallback accepts any non-item part with tabindex=0 and doesn't flag container+item both as stops; restrict to part==="list" and assert exactly one stop |
| add-collections (r1) | — | packages/testing/src/invariants.ts:268-276 | focus-kept excuses leaving whenever from !== state (any state change excuses focus landing anywhere); new branch untested — narrow it |
| add-collections (r1) | — | collections tests | Reset-after-blur only at action level; no fast-key-press test; controlled-selection test passes the anchor by hand (not a new array per change); model test runs roving only (activedescendant never against the fixture); set-metadata size check exempts trees |
| add-collections (r1) | — | packages/react/src/use-collection-items.ts:70-87 | Static item default textValue read once at flush; content change with same key/deps leaves it stale (code read) |
| add-collections (r1) | — | packages/core/src/dom/pointer-guard.ts | First-ever pointer move treated as real movement: a keyboard-opened popup under a resting pointer can lose its highlight to the first synthetic zero-delta move (code read) |
| add-overlay-infrastructure (verification) | — | packages/core/src/dom/inert-outside.ts | `existing = new WeakSet(body.querySelectorAll("*"))` is O(DOM size) per outermost modal open; nodes added between open and content mount count as pre-existing; "kept elements changed" re-walk has no jsdom test |
| add-overlay-infrastructure (r1) | — | packages/core/src/dom/dismiss.ts:177 | `pressing` stays true if pointerup goes to another document (released over an iframe) → outside-focus dismissal disabled until the next pointer event |
| add-overlay-infrastructure (r1) | — | packages/core/src/dom/modality.ts:248, focus-restore.ts:55 | recentFocus() returns [] unless a tracker subscriber exists and history is wiped when the last subscriber leaves; overlayEffect never subscribes (fixture hides it with a no-op subscribe); contradictory comment in the react-spectrum#2444 test |
| add-overlay-infrastructure (r1) | — | overlay tests | kobalte#688 test uses a no-op keydown handler; zag#3248 not driven through overlayEffect with real mount timing; react-spectrum#10291 tested with a non-modal over a modal, not modal over modal |
| add-overlay-infrastructure (r1) | — | packages/core/src/dom/layer-stack.ts:215,246 | Compatibility check looks only for `push` at version 1 (check every method or bump VERSION); `layerOf` dead (test only); options(id) matches exiting entries while get(id) doesn't |
| add-overlay-infrastructure (r1) | — | packages/core/src/dom/overlay.ts:46 | parent-dismissed is cancelable but release() force-releases the child; owner stays "open" with no stack presence/inert/containment |
| add-overlay-infrastructure (r1) | — | packages/core/src/dom/scroll-lock.ts:142-165 | MutationObserver can ping-pong without bound against a counterpart that also re-asserts (500 rounds in microtasks); cap consecutive re-applies |
| add-overlay-infrastructure (r1) | — | packages/core/src/dom/presence.ts:20 | A paused finite animation never resolves waitForExit; stale comment/test about abort ("settles after the signal aborts") |
| add-overlay-infrastructure (r1) | — | apps/storybook/stories/__aria__ | Playwright ariaSnapshot ignores inert (open snapshot lists inert trigger/details); partial matching can't catch leaked nodes; nested/toast/native-dialog stories not snapshotted |
| add-overlay-infrastructure (r1) | — | packages/testing/src/invariants.ts:394-420 | modal trait "scroller locked" only checks data-rind-scroll-locked, not overflow on the actual scroller |
| add-overlay-infrastructure (r1) | — | docs/guides/overlays.md | "Late nodes are left alone" and presence-trait paragraphs overstate behaviour (until the inert/presence errors are fixed) |
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
| add-tooltip (r1) | — | packages/react/src/tooltip/tooltip.tsx (Trigger) | the render element's own `aria-describedby` / `aria-labelledby` (set on the element passed to `render`) are not merged with the tooltip's reference; only the Trigger's props are |
| add-tooltip (r1) | — | packages/testing/src/invariants.ts (`layer`) | the "focus already on body before the step" exemption also hides a Dialog/Popover that leaves focus on body after opening from body; scope it to contracts that declare a layer that never takes focus |
| test-stability (r1) | — | packages/testing/src/components/text-field.dom.test.tsx:325 | the IME debounce test no longer goes through the driver |
| test-stability (r1) | — | packages/testing (resting-cursor test) | the negative window shrank to 8 animation frames |
| test-stability (r1) | — | packages/testing/src/virtual-clock.ts | module-level clocks have no reset; `advance` has no loop guard for a timer that reschedules itself at 0 ms |
| add-menu (impl) | 5.1 | packages/testing/src/components/menu-scenarios.dom.test.tsx | no automated test yet for "Thumb resting on the trigger while scrolling" (radix#2418, a real touch scroll in Playwright) and "Exit animation" (radix#4195, needs the themed exit animation) |
| ci flake (2026-10-16) | — | packages/testing/src/components/accordion.model.dom.test.tsx | "ITEM.TOGGLE[itemEnabled && isOpen && canCollapse], pointer" failed once in a full jsdom run on d9463d0 with three sessions loading the machine; not reproduced: 8 runs of the file and 3 full jsdom runs with 16 threads on 7552c8a all green. The other cited failure (CI 38817142353, broken variants) was the 5 s default timeout, raised to 60 s in #5. Re-open with the failing assertion if it recurs |
| retire-storybook (r1) | — | packages/testing/src/state-stories.ts, packages/*/tsdown.config.ts / tsconfig, PRODUCT.md, apps/site/examples/fixtures/* ("Ported from" headers) | stale Storybook wording in comments and docs: say site examples |
| retire-storybook (r1) | — | packages/testing/fixtures/{anchored/viewport,segmented-control,disclosure}.pw.test.ts | pre-existing `waitForTimeout` waits: removed by the test-stability PR, which bans them |
| retire-storybook (r1) | — | openspec/changes/archive/2026-10-16-retire-storybook/tasks.md (2.1) | the task names `openExample(page, slug, example, skin?)`; the helper is `openExample(page, base, slug, example, { skin, scheme })` |
| add-context-menu (impl) | 5.3 | packages/testing/src/components/context-menu-scenarios.dom.test.tsx | Reado parity: only the bottom-right viewport corner is tested; the other corners and the left-click-opened menus are not |
| add-menu (r1) | — | packages/testing/src/components/menu.dom.test.tsx | "Dialog from an item" checks the focus only after a keyboard choose: add a pointer variant |
| add-menu (r1) | — | packages/core/src/components/menu/menu.connect.ts | arrow keys read the direction from `env.locale` while the portalled positioner reads the trigger's DOM `dir` |
| add-menu (r1) | — | openspec/changes/add-menu/specs/menu/spec.md:616 | the content orientation text (`aria-orientation` only for horizontal) needs rewording |
| add-prompt-input (pending) | — | docs/accessibility/tested-with.json | Manual tier-1 pass on real AT and the IME pass (macOS Japanese/Chinese/Korean, MS-IME, Fcitx5, Gboard), recorded in "Tested with" (task 9.2) |
| add-prompt-input (r1) | — | packages/core/src/components/prompt-input/prompt-input.contract.ts | No `paste(files)` / `drop(files)` contract actions (the environment has no file paste or drop): browser scenario tests cover them |
| add-prompt-input (r1) | — | packages/core/src/components/prompt-input/prompt-input.connect.ts | History in a multi-line draft: browsing recalled entries steps on any caret, so ArrowUp inside a recalled multi-line prompt recalls instead of moving the caret; step only from the first / last line |
| add-prompt-input (r1) | — | openspec/changes/add-prompt-input/specs/prompt-input/spec.md | Touch focus: a press on AttachmentRemove keeps focus off the Textarea on touch (`input-chips`), the spec's focus rule does not say so |
| add-prompt-input (r1) | — | packages/core/src/dom/file-intake.ts | A file copied in a file manager pastes as `text/plain` (its name) plus the file: text wins, so it is not attached |
| add-prompt-input (r1) | — | packages/react/src/prompt-input/prompt-input.tsx | `props as never` into `useMachine`: say why the cast is sound (or type the machine props) |
| add-prompt-input (r1) | — | packages/core/src/components/prompt-input/prompt-input.connect.ts | The connect view's documentation (top of the file) does not list which values are derived here and which come from the adapter |
| add-prompt-input (r1) | — | packages/core/src/components/prompt-input/prompt-input.contract.ts | RECALL from `stopped` is a model skip: after a pointer stop the jsdom walk's keyboard recall finds the Textarea without `data-focus-visible` although a real Tab turns the ring on |
| add-prompt-input (r1) | — | packages/react/src/prompt-input/prompt-input.tsx | Inside an enclosing Field the over-limit state is not reported to that Field (the Root's own Field gets `invalid`); `aria-invalid` still follows the limit |

## Site: open items (docs-site handoff, 2026-10-18)

- **Lighthouse**: re-run on rind.watermelon-studio.it after the zero-CLS intro (#142). Locally and live, Chromium measures CLS 0.0004, LCP ~0.5 s, TBT 0; the official score (last 76, from CLS 0.62) is not re-measured.
- **Home JS**: ~300 KB gzip (React/Next ~100 KB). The skin builder's Color Picker could load when the section nears the viewport, with its height reserved (no CLS); TBT is already 0, so it only helps the transfer.
- **Warning guard in the browser project**: still jsdom-only (row above).

## Manual AT protocol

Passes that need real assistive technology or devices; automated tests cannot stand in.

| Change | Task | What to check |
|---|---|---|
| add-password-input | 10.1 (deferred) | NVDA, JAWS, VoiceOver macOS/iOS, TalkBack: trigger read as a toggle button with its pressed state, the "Password shown/hidden" announcement on a pointer toggle, 1Password/Bitwarden badges not covering the trigger, Edge shows one reveal control |
| add-pin-input | 11.1 (deferred) | NVDA, JAWS, VoiceOver macOS/iOS, TalkBack: one field announced with its name, the code read back, iOS "From Messages" fill, 1Password/Bitwarden fill, iOS selection handles over the transparent input |
| add-search-field | 10.1 (deferred) | NVDA, JAWS, VoiceOver macOS/iOS, TalkBack: searchbox role and name, Clear named and out of the Tab order, Escape inside a dialog, IME on macOS and Windows |
| add-number-input | 11.1 (deferred) | NVDA, JAWS, VoiceOver macOS/iOS, TalkBack: spinbutton value read after each key, trigger names, touch trigger announcement, the `ios-vo-spinbutton-input` quirk on an iOS device (design Open Questions), Arabic / Persian keyboard input |
| add-menu | 8.2 (deferred) | VoiceOver Safari macOS/iOS: submenu announcement with the `vo-submenu-expanded` quirk, swipe past the last submenu item; NVDA + Firefox browse-mode open; JAWS + Chrome; TalkBack submenu close |
| add-context-menu | 8.2 (deferred) | iOS long press with VoiceOver off and on, Android long press, VO+Shift+M, NVDA/JAWS Shift+F10, Safari text selection on open |
| add-menubar | 8.2 (deferred) | VO + Safari macOS: VO+Space opens on the first item, VO cursor order along the bar, focus stays in the bar on open; NVDA + Firefox / Chrome; JAWS + Chrome; VO iOS and TalkBack; whether keyboard switching should keep focus on the bar item (design Risks) |
| add-grid-list | 0.2 / 9.2 (deferred) | Real-AT prototype and manual pass: VoiceOver macOS/iOS (Safari, Chrome) row focus + `aria-labelledby`, selection announcement, fast arrow repeat; NVDA, JAWS, TalkBack |
| add-grid-list | 4.3 (follow-up) | React tests: Strict Mode, SSR + hydration tab stop, static vs data items, nested Tag Group (react-spectrum#6757, #5179) beyond the DOM test |
| add-grid-list | 6.4 (follow-up) | Virtual screen-reader reading-order test: row name excludes controls, checkbox "Select …", selection announcement on Apple WebKit |
| add-grid-list | #144 review (warning) | A `GridLayout` env capability (measured spatial targets injected, not read from the DOM in connect) and the `isOnControl` / `canMoveSpatially` guards of the design |
| add-grid-list | #144 review (warning) | A row named by `aria-labelledby` without an `ItemText`: typeahead and announcements fall back to the key |
| add-grid-list | #144 review (warning) | `warnForeignFocusables` warns again on every remount of a row; warn once per element |
| add-grid-list | #144 review (warning) | `grid-list.connect.ts`: the module-level `pressedDown` WeakSet can keep a stale entry (a pointer down without a click), which drops the next virtual or screen-reader click on that row |
| date-family-consolidation | #134 review (warning) | Range Date Field: a press on the separator or the group's padding should focus the last filled segment (a group press handler) |
| date-family-consolidation | #134 review (warning) | `date-range.ts`: ranges longer than 366 days need the unavailable-day boundaries (as Calendar's `rangeEnds`), not a full scan per derive |
| date-family-consolidation | #134 review (warning) | Range Date Field: add an ARIA snapshot of the range group (start, separator, end, value description) |
| date-family-consolidation | 4.1 | Picker touch: no dedicated test that the popover unmounts only after the press completes (the pick acts on the click, so the synthesised click lands on the cell); a browser test with an element under the cell |
| date-family-consolidation | 4.1 | A picker with `defaultOpen` inside a Dialog that opens at the same mount closes at once (`outside-focus`): the Dialog's initial focus lands outside the child layer. Opening from the trigger is correct |
| date-family-consolidation | 3.2 | Range group description speaks times in the locale's hour cycle, not the `hourCycle` prop (24-hour range in en-US read as "5:30 PM") |
| add-navigation-menu | 2.2 | Connect unit tests per "Data Attributes" row; the absence of `aria-orientation`, `aria-haspopup`, `aria-owns` and menu roles is covered by the DOM tests and a per-contract invariant only |
| add-navigation-menu | 3.3 (rest) | SSR: hydrate test, Suspense inside a trigger, no `document` during render (server HTML with `hidden` panels is tested) |
| add-navigation-menu | 5.2 | One browser test per listed regression in three engines; today the DOM suite covers the core scenarios in jsdom and Chromium |
| add-navigation-menu | 5.3 | Tab-order equality inline vs viewport vs portal, viewport size under fast switching and items without content, window resize while open |
| add-navigation-menu | 5.4 (rest) | ARIA snapshots for open-by-hover, open-by-press and nested-open examples (closed and open exist) |
| add-navigation-menu | design | `data-motion` stays on a panel after its switch animation; clear it once the panel settles |
| add-navigation-menu | #163 review (warning) | `navigation-menu-no-menu-semantics` scans only root, list, triggers and contents: scan every part (links, viewport, positioner, indicator, Sub roots) |
| add-navigation-menu | #163 review (warning) | `navigationSet` (the arrow-key set from the DOM) belongs in `core/dom`, not the machine module |
| add-navigation-menu | #163 review (warning) | A shared `useContentSize` hook for Collapsible, Accordion and Navigation Menu (each adapter runs the size sequence itself today) |
| add-navigation-menu | #163 review | Model walk of a controlled menu: the `$props:value` / `$sync:value` prop steps are mapped, but a parent that accepts proposals is not modelled by the oracle, so no controlled config runs them |
| add-navigation-menu | #163 verification (warning) | Per-item `positioning`: the machine reads the Positioner registered for the last render's value, so an item whose `positioning` differs from the previous item's is placed with the previous one's for one switch; pass a per-key getter to the machine |
| add-navigation-menu | #163 verification (warning) | Controlled model runs: `$props:value` / `$sync:value` are mapped and the fixture has a `controlled` config, but none runs until the oracle models a parent that accepts proposals |
| add-navigation-menu | #163 verification (warning) | `navigation-menu-at-most-one-open` per level is not exercised: the model walk only opens Products, and no test runs the invariant with a parent and a nested item open together (a counting-across-levels regression would pass) |
| add-navigation-menu | #163 verification (warning) | "a hover or leave close never moves focus" passes without the finalFocus fix (focus starts outside the menu, where finalFocus never acts): start it with focus in the panel, then hover-close |
| docs-props-guard | #159 review (warning) | scripts/docs-gen.ts | A prop that two union variants declare (`selectionMode` single/multiple) shows the first variant's type only: join the variants' types in the Type column |
| docs-props-guard | #159 review (warning) | packages/core/src/components/toast/toast.meta.ts | The Options table (`createToaster`, toast options) is not checked against the types like props are; it also misses the toast options `id`, `type`, `title`, `description` and `meta` |
| docs-props-guard | #159 review (warning) | packages/react/src (JSDoc) | `dir` props: the precise default is "the locale's, else the provider's"; several JSDoc comments say "the provider's" only |
| date-family-consolidation | 2.1 (#152) | Calendar view trigger: its name joins the heading and the action ("October 2026, Choose month") with a hard-coded ", " that cannot be localised, and the h2 takes the action text. Name the button by its visible text plus aria-describedby, or pass the heading to \`viewUp({ view, heading })\` (needs a spec tweak) |

## Resolved

The six add-foundations warnings first recorded here (10e5b, 10e6c, 1394b, 1394d,
1394e, 1394f) were fixed by the implementer in the same round, before the move;
verified at round 3 (2026-10-14).

## Code Block (#151)

- warning: `parseRanges` builds every line of a huge finite range (`[1, 1e9]`). Clamp ranges to the line count.
- warning: no non-colour cue for `[data-state="copied"]` / `[data-state="error"]` on the copy trigger (WCAG 1.4.1), and the example keeps the "Copy" text. Add an icon or text swap.
- warning: the model test covers only the collapsible block. Add a variant without `maxLines`, or skip EXPAND.TOGGLE when the trigger is hidden.
- warning: the `code-block--basic` ARIA snapshot leaves out `button "Wrap"` and the code content.
## Splitter (#166)

- warning: `splitter.css:25`: the handle's `outline-offset` inside `:where()` loses to `base.css` `[data-focus-visible]`.
- warning: `splitter.tsx:247`: the ResizeObserver only watches the handles present at mount.
- warning: `splitter.tsx:316`: the Handle reads `data-disabled` in the parts; the machine guard should decide alone.
- warning: `splitter.contract.ts:34-46`: the contract's geometry uses the Root's border box, not its content box.
- warning: `splitter.contract.ts:205`: `toggleCollapse.done` is always true.
- warning: uncommented assertions: `as 1 | -1` (`splitter.connect.ts:105`), `as never` (`splitter.contract.ts:269-290`).
- warning: unprefixed public exports: `HandleOwn`, `clampSize`, `isCollapsed`, `resizeAt`, `sameSizes`, `validateSizes`, `resolveSizes`, `handleBounds`.
- warning: no test for "a second pointer SHALL not start another drag".
- warning: `splitter.machine.ts:187`: `step <= 0` is not validated.
- warning: `SIZES.COMMIT` is internal but in the exported `SplitterEvent` union: mark it `@internal` or move it to a private type.

## add-grid-list: deferred tasks (archived 2026-10-18)

- 0.2 / 9.2: real-AT pass (VoiceOver macOS/iOS, NVDA, JAWS, TalkBack). Record it in "Tested with".
- 3.1 / 6.3: virtualization (`aria-rowcount`/`aria-rowindex`), plus a virtualized fixture and measured spatial moves in three columns.
- 4.3: React tests for Strict Mode, SSR + hydration tab stop, nested Tag Group, static vs data items.
- 6.4: virtual screen-reader reading-order test.

## add-prompt-input: verification (2026-10-18)

- warning: `settleSend` clears `snapshot` only when `context.pending` is set. A send with no promise and no `status` keeps the pasted image blobs until the next submit. Also clear it when `props.status === undefined`.
- warning: the DOM test presses Stop only once. Add a second press in `stopped` (or a `detail: 2` click) and assert that `onStop` is still called once.
- warning: `replaceText` lives in dom/file-intake.ts. Move it to a text-edit module.
- warning: a sync throw from onSubmit through `requestSubmit` is reported by the listener, not to the `control.submit()` caller.
- 9.2: manual tier-1 AT pass and IME pass.

## Rating (#172)

- warning: some scenarios have no rendered test: the ring on the Control and the input after Tab (the dom test at :80 never presses Tab), focusing the carrier focuses the range input (the dom test at :238 asserts no focus), `aria-invalid` on the input, and `input`/`change` dispatch on the carrier for a rate vs a controlled change or a reset.
- warning: rating.tsx `lastReason` is not cleared when a controlled parent refuses a change, so the parent's next programmatic change is reported to the Field as `user: true` with a commit.
- warning: rating.tsx `onPointerUp` commits a macOS Control+click. Guard it with `isContextMenuClick(e, env.platform)`.
- warning: rating.tsx `released` stays true when the click after a pointerup lands on an ancestor, which swallows the next bare AT click. Reset it on `pointerdown`.
- warning: a clearing mouse press stays in `previewing` with the pressed star full until the pointer leaves. Drop the preview when a PRESS clears to 0.
- warning: rating.contract.ts `as never` / `as number | undefined` casts have no soundness comment.
- warning: on a controlled server render the range input has `value="0"` and the carrier `value=""` while `aria-valuenow` is the value, until hydration. The same pattern exists in Slider.

## File Upload (add-file-upload)

- warning: Prompt Input still tracks drags with `dragLeftRoot`. Move it to `dragPresence` so both components share one drag model (add-file-upload task 1.2).
- warning: the model tests cover the drag and reset edges only. The file events (add, remove, clear) are the DOM tests'. A model with file stories would map them.
- warning: the Playwright fixture runs in Chromium only. Firefox and WebKit `filechooser` and drop paths are covered by the Vitest browser project.
- 9.x: manual tier-1 AT pass (VoiceOver, NVDA) of the Trigger name and summary.
## Marquee (add-marquee)

- warning: the model does not check `idle`: any wait between steps may run the first frame's measurement, so the DOM leaves `idle` before the oracle's `measure` step. The machine tests cover `idle`.
- warning: reduced motion is not a model configuration (it applies on mount, before the first step); the DOM tests cover it.
- warning: the home band's Viewport is `aria-hidden` and the names are in the nav; check with the site that the PauseTrigger alone is a fine announcement there.
- 8.x: manual tier-1 AT pass (VoiceOver, NVDA) of the copies and the PauseTrigger.

## Streaming Message (add-streaming-message)

- warning: the reveal ticks on 16 ms `setTimeout`s, not animation frames; in a background tab timers are throttled and the reveal slows. Catching up on visibility (`PageVisibility`) would fix it.
- warning: the model reaches `settling` only from `streaming`; `complete → settling` (a new text after completion) is reported not taken.
- 8.x: manual tier-1 AT pass (VoiceOver, NVDA): whether `aria-busy` holds or drops reading, and the lifecycle announcements.

## Message Thread (add-message-thread)

- warning: keyboard scrolling of the viewport (arrows, Home, End) is the browser's; the model maps reading back and returning to pointer wheel only, because synthetic keys do not scroll. A Playwright test with real keys would cover it.
- warning: the model's message events (`COUNT.SYNCED`) are the DOM tests'; a model story adding messages would map them.
- warning: feed vs `role="log"` with `aria-live="off"` needs the tier-1 AT pass (NVDA, VoiceOver); a prop for the fallback if feed reads badly.
- warning: growth is followed instantly (no spring); a smooth follow like use-stick-to-bottom's is polish.

## Reasoning (add-reasoning)

- warning: the model tests need 20 s per path in jsdom (axe after every step of three-step paths); a cheaper per-step a11y check would bring them back under the default.
- warning: the content is unmounted while closed; a presence (exit animation) like Collapsible's is polish.

## Stepper (add-stepper)

- warning: `ChangeDetails.reason` is typed as the event type while machines that set a transition `reason` report that string at runtime (File Upload's "add"/"remove", Reasoning's "auto"/"trigger"); Stepper publishes its own `StepperChangeDetails`. A typed transition reason in the runtime would fix it once for all.
- warning: the model selects step 0 only; selecting other visited steps is the DOM tests'.

## Image Cropper (add-image-cropper)

- warning: the tainted-canvas test simulates the SecurityError; a real cross-origin image without CORS needs a second origin in the test server.
- warning: the model covers keyboard nudges and zoom; pointer drags and pinch are the DOM tests'.
- warning: zoom is clamped to [minZoom, maxZoom] except when coverage needs more (a rotation); the slider in a consumer's UI may then show a value above its max.

## Table of Contents (add-table-of-contents)

- warning: in the test harness, letting a click on `<a href="#missing">` inside `CheckboxGroup.ItemLabel` proceed (not cancelled) toggles the checkbox (a TOGGLE through the control's press), while real trusted clicks in Chromium, Firefox and WebKit do not forward the label. The harness now lets only jumps to existing elements through; find what forwards the untrusted click (`press.ts` `forwardedByLabel`?) and add a test.
- warning: `readingPosition` measures on scroll and resize only; content that grows without either (images loading above the line) updates on the next scroll.

## Number Input (vue-svelte-adapters)

- warning: in the server HTML (every adapter) the Increment and Decrement triggers' `aria-controls` names `number-input-<id>-input`, while a standalone Root's Input carries the Field's control id: the reference dangles until the client learns the Input's id after mount. The Root could use the Field's control id from the start (it creates that Field), so the server HTML is right too.

## Stepper (vue-svelte-adapters)

- warning: an Item's `disabled` and `completed` register after mount in every adapter, so the server HTML shows a disabled step as reachable and a `completed` override as upcoming until hydration. The Root could read them from its declared Items (as Tabs reads its declared panels) or the Items could register during render.
## Dialog (site review, round 47)

- warning: a dialog opened programmatically with no `Dialog.Trigger` has no logical parent, so its portal host lands in `<body>` without the opener's `data-rind-theme`, `dir` and `lang`, and a themed page shows it unstyled (the site's "Open from outside" example now passes `logicalParent`). Consider falling back to the portal's own React position (a marker element) or the focused element at open.
- warning (text-field, site review): an `id` passed to `TextField.Input` replaces the generated control id, but `TextField.Label`'s `htmlFor` keeps the generated one, so the input loses its name. The control id should follow a consumer's `id` (Liskov: a part forwards the props of its element without changing behaviour); the site's tour example now puts its id on the Root.
