# @rind-ui/testing

## 1.2.0

### Patch Changes

- be7adde: Text locators skip `hidden` elements, as Playwright's getByText does.
- aefab08: Table of Contents: the contract's keyboard follow waits for the target heading to take focus
  (the next frame), so model runs no longer race the step's snapshot, and the focus invariant
  accepts focus moving from an in-page link (`href="#id"`) to its target as native link
  behaviour, not focus lost.
- e5140db: Vue and Svelte: Popover, with a Portal and the layer context the overlays share (outside
  presses, Escape and focus return follow the nesting). `canonicalHtml` rounds measured lengths
  to whole pixels, drops an empty `style` and treats a generated `data-value` as one token, so
  two renders of one component compare equal across engines.
- Updated dependencies [aefab08]
  - @rind-ui/core@1.2.0

## 1.1.0

### Minor Changes

- 6d53336: New packages: `@rind-ui/vue` (Vue ≥ 3.5) and `@rind-ui/svelte` (Svelte ≥ 5.29). Same machines,
  ARIA and drivers as `@rind-ui/react`; components are ported one at a time (this release: Toggle,
  Button, Separator, Kbd, Badge, Heading, Label, Link, Skeleton, Progress, Meter, Avatar, Image,
  Alert, Toggle Group, Fieldset, Field, Text Field, Checkbox, Checkbox Group, Switch, Visually
  Hidden, Radio Group, Segmented Control, Collapsible, Accordion, Tabs, Toolbar, Breadcrumbs,
  Pagination, Rating, Slider, Number Input, Pin Input, Splitter, Stepper, Timeline, Table of Contents, Scroll Area, Marquee, QR Code, Clipboard, Code Block, Form, Form Toggle (Svelte public parts), File Upload, Tag Group, Listbox, Grid List, Tree View). `@rind-ui/core/internal` gains
  the framework-neutral helpers the adapters share; `@rind-ui/testing` exports `canonicalHtml` to
  compare a component's markup across frameworks. Every `@rind-ui` library package now ships at
  one version (a Changesets fixed group).

### Patch Changes

- Updated dependencies [175c5cf]
- Updated dependencies [6d53336]
  - @rind-ui/core@1.1.0

## 1.0.0

### Major Changes

- 0774e80: rind-ui 1.0: the public API is stable. Component and part names, props, the `data-*` and `aria-*` attributes parts render, CSS custom properties, messages and driver actions and queries change only in a major release, after at least one minor release of development warnings.

### Patch Changes

- ed626d1: Package pages on npm point to the docs site and carry searchable keywords; `@rind-ui/react` describes what it is.
- Updated dependencies [746d104]
- Updated dependencies [ec8c68a]
- Updated dependencies [ed626d1]
- Updated dependencies [8cd0689]
- Updated dependencies [0774e80]
- Updated dependencies [6e648bd]
- Updated dependencies [c63f1e0]
  - @rind-ui/core@1.0.0

## 0.5.0

### Minor Changes

- 66d93ab: Clipboard: a copy button or a read-only field with a copy button. The result comes from the write (`copying` → `copied` | `error`), announced politely; the Trigger's name never changes; a copy of the whole Input counts. Code Block shares its copy logic. Testing: `getClipboard`, and `Part.copySelection()` / `Part.selectRange()` in the contract environment. Theme: `clipboard.css` in the field family.
- de95b59: File Upload: files from the native chooser, a drop or a paste, through one validation (accept with an extension fallback, sizes, duplicates, folders, a custom check; only the surplus over `maxFiles` is refused), held as one list the hidden input mirrors for forms. A real Trigger button, a Dropzone with no role, removal that keeps focus, announcements per gesture, Field and Fieldset binding, form reset, and a `dropSource` for shells such as Tauri. Core: `validateFiles` gains `MIN_SIZE`, `DUPLICATE`, `DIRECTORY`, `CUSTOM`; `file-intake` gains `dragPresence`, folder traversal and `domDropSource`. Testing: `getFileUpload`, and `Part.dropFiles()` / `pasteFiles()` / `dragFiles()` in the contract environment. Theme: `file-upload.css` in the field family.
- 17b2f82: Image Cropper: Ark's capabilities (crop in the viewport over an image placed by zoom, any-angle rotation, flip and pan; fixed crop area; aspect ratio, circle, min / max sizes; nudge steps 1 / 10 / 50; wheel and pinch zoom; the crop in natural pixels as a rect and a corner quad) with exact coverage (the image always covers the crop's corners, raising zoom when a rotation needs it), one focusable crop area that stays usable with a fixed area, one announcement per keyboard burst instead of a live root, and `cropImage(image, data)` with typed `CropError`s. Core: pure geometry, `core/dom/crop-gestures`, `core/dom/crop-image`. Contract env: the "+" and "-" keys. Testing: `getImageCropper`. Theme: `image-cropper.css`.
- 02ebad0: Image Viewer: zoom and pan an image in place. Ctrl-wheel, trackpad pinch (Safari's gesture events too), touch pinch and double click zoom about the pointer; drag pans; + / − / 0 and arrows on the focusable viewport; ZoomIn / ZoomOut / Reset buttons that keep focus at the limits. Every change is clamped (zoom limits, the image never leaves the view, no pinch overshoot); a plain wheel scrolls the page unless `wheel="zoom"`; the zoom is announced once per keyboard burst. Core: `image-viewer.geometry` (`clampPan`), `core/dom/zoom-gestures`. Contract env: the "0" key. Testing: `getImageViewer`. Theme: `image-viewer.css`.
- 39ce5a8: Kbd: keyboard shortcuts resolved for the platform (`mod` is ⌘ on Apple, Ctrl elsewhere; Apple glyphs, words with "+" elsewhere; sequences "G then I"), every glyph hidden next to its spoken name ("Command plus Shift plus P"), `dir="ltr"`, a hydration-safe platform with a `platform` override, and `useKeyShortcuts` / `keyShortcuts` for the control's `aria-keyshortcuts`. Core: `kbd.keys` (`parseKeys`, `resolveKey`, `keyShortcuts`). Testing: `getKbd`. Theme: `kbd.css`.
- 5db22ea: Marquee: a looping band of content moved by CSS, with a PauseTrigger, hover and keyboard-focus pauses (WCAG 2.2.2), reduced motion shown still and wrapped, hidden untabbable copies (`autoFill` up to 32), continuity when the speed, size or direction changes, and focus brought into view without scrolling. Core: `core/dom/marquee-motion` (`observeMarquee`, `retime`, `mirror`, `reveal`, `untabbable`). Testing: `getMarquee`; the generic hidden-focus invariant accepts `tabindex="-1"` inside a hidden copy. Theme: `marquee.css` in the decoration family; `pause` and `play` icons.
- e122807: Message Thread: the scrolling conversation. It follows the newest content while you are at the bottom and lets go when you read back (upward scroll or wheel, a dragged selection; its own scrolls never count), counts new messages on JumpToLatest, keeps the bottom when the prompt grows the layout, keeps your place when older messages load (Safari too), and offers a top-anchored layout. An APG Feed: articles named by speaker, Page Down / Page Up between them, never a live region. Core: `core/dom/stick-to-bottom` (`stickToBottom`, `atBottom`, `observeTop`); `TABBABLE` exported. Contract env: `Part.wheel(deltaY)` in both adapters. Testing: `getMessageThread`. Theme: `message-thread.css`; the `arrow-down` icon.
- 0fd5aa9: Reasoning: a model's chain of thought in a disclosure that opens by itself while the model thinks and closes a second after it answers. Only live changes toggle it (a reloaded message never does), the user's toggle wins, focus inside keeps it open; the duration comes from your runtime or the Environment's clock; "Thinking…" and "Thought for N seconds" are announced, the trace is not. Core: `DomEnvironmentOptions.clock`. Testing: `getReasoning`; `virtualClock().clock`. Theme: `reasoning.css` with a shimmer that stops under reduced motion.
- c20e100: Sortable: reorder a list by pointer, keyboard or buttons. A handle per item ("Reorder Apple"): Space picks up, arrows / Home / End move by position with a live reorder and focus kept, Space drops, Escape restores, Alt+arrow moves one place; `MoveButton` is the single-pointer alternative. Pointer drags from the handle (or the item) with a threshold, a long press on touch, a midpoint drop indicator and edge auto-scroll; `onReorder(keys, { key, from, to, reason })` with controlled `items`. Announcements carry positions from the current order; the session ends when its item leaves `items`. Core: `reorder`, `core/dom/sortable-drag`. Testing: `getSortable`. Theme: `sortable.css`.
- 379dfd6: Stepper: an ordered list of steps with `aria-current="step"` (never tabs); reachable steps are buttons, the rest text, each named with its status. Controllable, cancellable `step` (`next`, `prev`, `select`) for validation; `linear` (back freely, forward only with Next); disabled and completed steps from the mounted Items; the user's moves focus the step's region and announce "Step 2 of 4: Shipping"; contents stay mounted so field values survive. Testing: `getStepper`. Theme: `stepper.css` (a check for completed steps).
- 94615a9: Streaming Message: one AI response arriving in chunks. You pass `text` and `status`; it paces bursty chunks evenly (each drained in `drainMs`), marks the content `aria-busy` with a caret while it grows, keeps the body out of any live region and announces the lifecycle (or the text once, or by sentences), and keeps everything received on cancel or failure. Your renderer gets the displayed text. Core: `splitSentences` exported from the stream announcer. Contract: a machine event the parent's props drive can take a props step. Testing: `getStreamingMessage`. Theme: `streaming-message.css` in the decoration family.
- d87fecb: Table of Contents: a navigation landmark of anchor links with one current section, chosen by a reading line (`offset`, `ratio`) and the end of the scroll range, `data-visible` on sections in view, a followed link held through its jump, focus moved to the heading for keyboard and screen-reader users, a window or container scroll root, a list that keeps the current item in view, and an Indicator positioned by CSS variables. Core: `core/dom/reading-position` (`collectHeadings`, `measureReading`, `readingPosition`). Testing: `getTableOfContents`; a link to an element of the same document now jumps instead of being cancelled. Theme: `table-of-contents.css`.
- 02acb0b: Table (phase 1): a native table with no role or handler added, a scroll container that is a named tab stop only when it overflows with nothing focusable inside, scroll-edge attributes and head/first-column CSS variables, and sorting (SortTrigger, `aria-sort` on the sorted header only, polite announcement, controllable `sort`, `allowUnsorted`). `sortItems` helper. Testing: `getTable`. Theme: `table.css` in the decoration family.
- b259a95: Timeline: an ordered list of events in reading order, with statuses (completed, current, pending, upcoming) per Item or derived from `current`, spoken in each title and `aria-current="step"` on the current event; `align` (start, end, alternate) and `orientation` as data; `Timeline.Time` with a machine-readable `datetime`. Testing: `getTimeline`. Theme: `timeline.css` (statuses by shape and colour).
- 6ed640f: Tree View: moving nodes. `movable` (all, or a predicate) and `onMove(key, { parent, index, reason })`, with `moveNode(items, key, target)` to apply it. Keyboard: the outliner keys (Alt+Up / Down among siblings, Alt+Right into the folder above, Alt+Left out of its folder), focus kept, each move announced. Pointer: drag a row before / inside / after another (a closed folder opens after 700 ms), `TreeView.DropIndicator`, `data-dragging` and `data-drop-target`; never into its own subtree; the drag ends when its node is hidden. Core: `moveTarget`, `pointerTarget`, `moveNode`, `core/dom/tree-drag`. Contract: `moveNode`, `dragNode`. Theme: tree-view.css rules for the drag.
- d4dc263: Date Field: time values and time ranges (no separate Time Field).
  
  - **Time values.** A `Time` value, or `maxGranularity="hour"`, shows no date segments; a date-time keeps its date. Hour cycles (the prop wins over the locale), the day period as its own segment that hour edits never change, zoned stepping across DST, and a 12-hour "0" left alone meaning 12.
  - **Form value.** `type="time"` hidden input with `step` 3600 / 60 / 1 and native `min` / `max`; `minValue` / `maxValue` may be `Time`s.
  - **Time ranges.** `Time` ends named "Start time" / "End time", `allowsOvernight`, two `type="time"` hidden inputs.
  - **Contract and driver.** `setDayPeriod`, `fill("21:05")`, the day-period invariant; range `setDayPeriod(edge, period)` and pair invariants that read time ends.
- ad6b61f: Table: pinned columns at either edge (`pinnedColumns`, measured offsets), column filters in a popover (`Table.Filter`, `FilterTrigger`, `FilterContent`, `FilterIndicator`), indicators that take any node per state, `Table.Frame` with `Header` / `Footer` and a full-page view (`expanded`, `ExpandTrigger`, `Title`), expandable rows (`RowTrigger`, `RowDetails`, `expandedRows`, `multiple`), row-count and row-range announcements, and the data helpers `filterItems`, `facetValues`, `paginateItems` (`sortItems` gains per-column `compare` and `empty`). Theme icons `caret-up-down`, `funnel`, `funnel-simple`, `arrows-out`, `arrows-in`.

### Patch Changes

- Updated dependencies [66d93ab]
- Updated dependencies [de95b59]
- Updated dependencies [17b2f82]
- Updated dependencies [02ebad0]
- Updated dependencies [39ce5a8]
- Updated dependencies [5db22ea]
- Updated dependencies [e122807]
- Updated dependencies [0fd5aa9]
- Updated dependencies [c20e100]
- Updated dependencies [379dfd6]
- Updated dependencies [94615a9]
- Updated dependencies [d87fecb]
- Updated dependencies [02acb0b]
- Updated dependencies [b259a95]
- Updated dependencies [6ed640f]
- Updated dependencies [d4dc263]
- Updated dependencies [d4dc263]
- Updated dependencies [ad6b61f]
- Updated dependencies [48e4dd5]
  - @rind-ui/core@0.5.0

## 0.4.0

### Minor Changes

- 7b8c78f: Grid List: a list of rows that hold their own controls (a selection checkbox, buttons, fields, links, a nested Tag Group).
  
  - **Navigation.** One Tab stop, arrows between rows, ArrowRight into a row's controls (or Tab with `childNavigation="tab"`), and `layout="grid"` for cards.
  - **Selection and actions.** The selection and action rules follow the selection behaviour, the checkbox and link rows; a press on a control never reaches its row.
  - **Accessibility.** Each row is named by its text only. A quirk entry announces the selection on Apple WebKit.
  - **Core infrastructure.** `collection-grid` (`grid.ts`, `grid-layout`, `row-controls`).
  - **Contract and driver.** `getGridList`.
  - **Theme.** `grid-list.css`.
- 42578ce: Navigation Menu: site navigation following the disclosure navigation pattern, a named `nav` landmark whose triggers open panels of links.
  
  - **Opening.** Press, Enter or Space toggle; a mouse or pen resting on a trigger opens it after `openDelay`, with a grace area towards the panel, immediate switching while open, a warm window after a close, and the press that follows a hover open keeping it open. `openOnHover={false}` keeps press and keys only.
  - **Closing and focus.** Escape closes the innermost level and returns focus to its trigger; an outside press, focus leaving the menu and a same-tab link activation close every level. The open panel follows its trigger in the Tab order wherever it renders.
  - **Parts.** `Root`, `List`, `Item`, `Trigger`, `Content`, `Link`, `Indicator`, `Viewport`, `Positioner`, `Sub`. Closed panels stay in the document with `hidden` (`closedContent="unmount"` removes them). A shared `Viewport` animates its size between panels (`content-size` gains a part name for its properties).
  - **Contract and driver.** `getNavigationMenu`.
  - **Theme.** `navigation-menu.css`.
- 4920e99: Splitter: resizable panels on one axis with a focusable `separator` between each pair (APG Window Splitter).
  
  - **Sizes before hydration.** Sizes and limits are declared on the Root (`panels`, `sizes` / `defaultSizes` in percent), and each panel is `flex-grow` on a zero basis, so the server renders the final layout.
  - **Limits.** `min`, `max` and `collapsedSize` as percents or `"Npx"` strings, re-resolved whenever the Splitter resizes; `collapsible` panels snap at the halfway point.
  - **Keyboard and pointer.** Arrows on the handle's axis (mirrored in RTL), Home / End, Enter to collapse or restore; drag through pointer-drag, with Escape and `pointercancel` restoring the press sizes. `onSizesCommit` once per interaction.
  - **Contract and driver.** `getSplitter`.
  - **Theme.** `splitter.css`.
- f133268: Calendar range mode gains drag selection: press a day, drag, release. The preview follows the pointer, a drag out of the grid keeps the last day, Escape cancels, and a release on the anchor keeps it (a click still starts a range). A touch drags only after `dragDelay` (default 200 ms) held still, and the page does not scroll while dragging. `data-dragging` on the root and grids; `onValueChange` reason `"DRAG"`; the contract action `dragRange(start, end)`. The DOM layer adds `createCellDrag` and exports `trackPointer`.
- 8664388: Calendar range mode (`selectionMode="range"`): an anchor then an end (`{ start, end }`, one `onValueChange` per commit), a hover/keyboard preview, Escape and leaving with `commitOnBlur`, `minRangeLength` / `maxRangeLength`, contiguous ranges around unavailable dates (`allowsNonContiguousRanges`), an anchor-aware `isDateUnavailable(date, { anchor })`, a controllable `anchor`, prompts and polite announcements, and exported range helpers. The driver adds `selectRange`, `startRange`, `cancel` and `range()` / `anchor()` / `preview()` / `isAnchored()`; `calendar.css` draws the range as a band with a dashed preview. `watchLeave` / `eventIsInside` are exported from the DOM utilities.
- c5adfa3: Calendar month and year views with drill-down: a controllable `view` (`"days"`, `"months"`, `"years"`; `defaultView`, `onViewChange(view, { reason })`) bounded by `minView` / `maxView`, `yearsPerPage`, `columns`, `isMonthUnavailable` and `isYearUnavailable`. The heading becomes a button one view up (`messages.viewUp`), choosing a period above `minView` goes back down, and Escape goes down one view. With `minView="months"` or `"years"` the Calendar is a month or year picker: the day, time and zone of the value are kept, the day clamped. Single, multiple and range selection work at the period. The pure `period-navigation` helpers (`pageOf`, `movePeriod`, `canPagePeriod`, `periodAllowed`, …) are exported; `messages.previous` / `next` take a string or a function of the view. The driver adds `viewUp()`, `viewDown()` and `view()`, and accepts periods (`"2027-03"`, `"2031"`); the `composite-roving` invariant now fails on a focusable control inside a grid cell. `calendar.css` styles the view button and the wider period cells.
- 716eb2e: Add Calendar: a month grid on `@internationalized/date` (calendar systems via `createCalendar`, locale week starts, `today` from an injected clock). Single and multiple selection, a focused date with roving focus and APG keys (days, weeks, Home/End, months, years with Shift), several visible months with `pageBehavior`, min/max (disabled) and unavailable dates, read-only and disabled, triggers that stay focusable at the bounds, polite range announcements from outside the grid. The `getCalendar` driver, `fixedDateClock`, and `calendar.css`. The keyboard layer gains the `grid` orientation.
- fbd23de: Add Code Block: code readable as server HTML, highlighted in the component with `language` (ts/tsx/js/jsx, css, html, json, bash, or your own `CodeGrammar`; no dependency; `data-token` spans coloured by `--rind-code-token-*`), or from tokens or highlighter HTML (`trustedCodeHtml`, split per line with balanced tags); a copy button whose state follows the clipboard write and is announced politely ("Copied" / "Copy failed") with a constant name; line numbers as a CSS counter (never copied), highlighted lines with a description, soft wrap, a collapsed preview with `maxLines`, and a named tab stop only while the content scrolls. New `clipboard` environment capability (Clipboard API with a fallback next to the trigger), `fakeClipboard` and `getCodeBlock` in testing, `code-block.css`.
- 0760dab: Combobox variants. These replace separate Autocomplete and Command components.
  
  - **Free text** (`selectionMode="none"`): an autocomplete. The text is the value (`onInputValueChange`), suggestions fill it, the visible input is the native form control, Enter with nothing highlighted submits, and `clearOnEscape` and `submitOnChoose` are available.
  - **Inline** (`inline`): a command palette. The list is in place and always shown; the machine is the new `inlineComboboxMachine`, with the single state `open`. Items run `onAction(key, { modality, modifiers })`; pages use `page` and `onBack` (Backspace on an empty query); Escape clears the query, then calls `onOpenChange(false)`; link items open natively with modifiers.
  - **New parts:** `Combobox.Loading` and `Combobox.ItemDescription`.
  - **Contracts:** `inlineComboboxContract`, `comboboxInvariants` and `optionsNeverSelected`.
  - **Driver:** `getCombobox(…, { inline: true })` with `run` and `back`.
  - **Theme:** the inline list and danger items.
- a00089b: Date Field picker parts, single and range. `DateField.Control`, `Trigger`, `ClearTrigger`, `Portal`, `Positioner`, `Content` and `Calendar` turn the field into a date picker, or a date range picker with `selectionMode="range"`.
  
  - **Value and closing.** The field owns the one value, and the calendar is a view of it. A pick keeps the value's type, time and zone; it closes the popover (reason `"select"`) and returns focus to the trigger.
  - **Opening and typing.** Alt+ArrowDown opens the picker from a segment. Typing while open moves the calendar.
  - **Range rules.** The range picker forces `commitOnBlur="reset"` and forwards min/max, unavailable dates and contiguity to the calendar.
  - **Calendar.** New props `invalid` and `onDateSelect`.
  - **Popover.** New close reason `"select"`.
  - **Driver.** New actions `openPicker`, `pickDate`, `closePicker` and `clearPicker`.
  - **Theme.** Picker rules in `date-field.css`.
- 43b7d37: Range Date Field fixes:
  - Select all + Backspace in a partial end clears both ends.
  - An invalid pair marks every segment `aria-invalid`.
  - `DateField.Description` (and the Field's error) describe the group and the first start segment.
  - The range contract adds the invariants other-end-untouched, value-is-derived and hidden-never-focused.
  - `@rind-ui/testing` adds `dateRangeStepInvariants` (the onValueChange count).
- cde940b: Date Field range mode (`selectionMode="range"`): two ends (embedded fields) in one group named by the Label. The value is `{ start, end }`, emitted once per change and never for a partial range. The ends never edit each other: an inverted range is kept as typed and invalid, a range across an unavailable day is invalid unless `allowsNonContiguousRanges`. Focus moves between the ends, segments are named by the end and the Label, there are two hidden inputs (`startName` / `endName`, autofill adopted), and select-all-and-Backspace clears both ends. New parts `DateField.Start`, `DateField.End`, `DateField.Separator`; `getDateField(…, { selectionMode: "range" })`; range rules in `date-field.css`.
- 716eb2e: Add Date Field: a date (or date and time) typed segment by segment in the locale's order and digits, one native `<input role="spinbutton">` per segment. The value (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`) changes only at commit points. Impossible or incomplete entries are kept and reported invalid, never rewritten. It supports paste and copy, calendar systems and eras, time zones with wall-clock steps, the iOS VoiceOver quirk, Field and form integration through a typed hidden native input, and an embedded mode with boundary and draft callbacks for hosts. The shared segment model is exported as `date-segments`. Also added: the `getDateField` driver, `dateFieldStepInvariants` and `date-field.css`. The keyboard layer gains `value: "vertical"`.
- a6e7210: Add Menubar: a named bar of menu items, one tab stop with arrow keys and typeahead, one open-menu `value` (`onValueChange` with kebab-case reasons), switching menus by press, hover and the arrow keys inside a menu, vertical bars, modal menus with the bar kept interactive, the `getMenubar` driver (`menu(name)` returns the item's Menu driver) and `menubar.css`. The runtime accepts a transition `reason` computed from the event; `MenuTreeHost.press` receives the press's modality.
- 91191ed: **BREAKING** Alert Dialog folds into Dialog. `<Dialog.Root role="alertdialog">` is a confirmation with every former Alert Dialog default: always modal, never closed by an outside press, focus on Cancel, a warning for a missing description. `modal` and `closeOnInteractOutside` are type errors with that role. `Dialog.Cancel` and `Dialog.Action` are Dialog parts usable in any dialog. Migrate as follows:
  
  - `AlertDialog.*` → `Dialog.*` with `role="alertdialog"` on the Root.
  - `getAlertDialog(t, a)` → `getDialog(t, { ...a, role: "alertdialog" })`.
  - `alertDialogContract` → `alertDialogRoleContract`.
  - `@rind-ui/theme/alert-dialog.css` → `dialog.css`, with the same `--rind-alert-dialog-*` tokens.
  - Selectors on `data-scope="alert-dialog"` → `[data-scope="dialog"]` and `[role="alertdialog"]`.
  
  `alertDialogMachine`, `alertDialogConnect` and `alertDialogMeta` are removed.
- f2e172a: Add Prompt Input, the first AI-UI primitive: a native form with a content-sized textarea, IME-safe Enter (Shift+Enter, Mod+Enter, `submitKey`, newline on phones), the send/stop lifecycle driven by `onSubmit` (a promise) and `status` with no model inside, one Submit button that becomes Stop and keeps focus, a failed send that restores the prompt, attachments from the file chooser, paste and drop with `accept` / `maxFiles` / `maxFileSize` and every refusal reported, history recall, a character or token limit, and announcements for stop, failure and files; `usePromptInput`, `getPromptInput`, `prompt-input.css`. Contract parts gain `setFiles(files)`; the theme gains the `arrow-up`, `stop` and `paperclip` icons; `core/dom` gains the file-intake helpers (`matchesAccept`, `validateFiles`, `filesFromClipboard`, `syncFileInput`, …).
- 017c873: Add Rating: a row of stars backed by one visually hidden native `<input type="range">` (role `slider`, "3 of 5 stars"), with half stars by pointer position (`allowHalf`), a hover preview that never changes the value, clearing (`allowClear`), RTL, read-only and disabled, and form participation through a hidden input (`name`, `required`, reset, fieldset, Field). `ratingMachine`, `ratingConnect`, `ratingContract`, `Rating.Root` / `Label` / `Control` / `Item`, `getRating`, `rating.css` (stars drawn by the stylesheet, no icon).
- 7ea8b6f: Add Tag Group: a grid of tags (or a named group when empty) with roving focus over both arrow pairs, selection, link tags, removal by the remove button or Delete/Backspace with focus moved to a neighbour and a polite announcement, a removal hint for keyboard and screen-reader users, and a data mode; `getTagGroup`, `tag-group.css`. Contracts can locate by a set of roles (`By.role([...])`).
- 589a54f: Tags Input suggestions: with `items` (or a `collection`) the input is a combobox over the suggestions; choosing one creates a tag from its key (shown with its label), clears the draft and keeps the popup open (`closeOnSelect`); chosen suggestions leave the list unless `allowDuplicates`; `allowCustom={false}` refuses typed text. New parts `Positioner`, `Popup`, `List`, `Item`, `ItemText`, `Group`, `Separator`, `Empty`, `Items` (the listbox parts, as in Combobox). The combobox-pattern pieces (`patternPieces`, `patternConnect`, `patternContract`, `popupOverlay`, `patternMessages`) are exported for every input-driven listbox; Combobox uses them unchanged. The Tags Input driver locates `textbox` or `combobox` and gains the pattern's actions and queries.
- c9ebf60: Add Tree View: the APG tree with expand and collapse, roving focus, typeahead, single or multiple selection, tri-state checking that updates parents and children both ways, lazily loaded branches, link items, and set metadata (`aria-level`, `aria-setsize`, `aria-posinset`); `getTreeView`, `tree-view.css`.

### Patch Changes

- Updated dependencies [7b8c78f]
- Updated dependencies [42578ce]
- Updated dependencies [4920e99]
- Updated dependencies [f133268]
- Updated dependencies [8664388]
- Updated dependencies [c5adfa3]
- Updated dependencies [716eb2e]
- Updated dependencies [fbd23de]
- Updated dependencies [0760dab]
- Updated dependencies [a00089b]
- Updated dependencies [43b7d37]
- Updated dependencies [cde940b]
- Updated dependencies [716eb2e]
- Updated dependencies [5069b3c]
- Updated dependencies [a6e7210]
- Updated dependencies [91191ed]
- Updated dependencies [8664388]
- Updated dependencies [f2e172a]
- Updated dependencies [017c873]
- Updated dependencies [79093f1]
- Updated dependencies [7ea8b6f]
- Updated dependencies [589a54f]
- Updated dependencies [c9ebf60]
  - @rind-ui/core@0.4.0

## 0.3.0

### Minor Changes

- 0cdaff3: Add Alert Dialog: the Dialog's machine, always modal with `role="alertdialog"`, closed only by Escape, Cancel or an action (an outside press never closes it), focus starting on Cancel, a warning for a missing description, the `getAlertDialog` driver and `alert-dialog.css`.
- 2ceeef6: Add Calendar: a month grid on `@internationalized/date` (calendar systems via `createCalendar`, locale week starts, `today` from an injected clock). Single and multiple selection, a focused date with roving focus and APG keys (days, weeks, Home/End, months, years with Shift), several visible months with `pageBehavior`, min/max (disabled) and unavailable dates, read-only and disabled, triggers that stay focusable at the bounds, polite range announcements from outside the grid. The `getCalendar` driver, `fixedDateClock`, and `calendar.css`. The keyboard layer gains the `grid` orientation.
- a966aa7: **Breaking for themes (unreleased; a minor bump while on 0.x).** Every Color Picker part carries `data-scope="color-picker"` with its own part name: `area`, `area-background`, `area-thumb`, `area-input`; `channel-slider`, `channel-slider-label`, `channel-slider-value-text`, `channel-slider-control`, `channel-slider-track`, `channel-slider-thumb`; `channel-input`, `channel-input-root` (with `data-channel`); `swatch-group`, `swatch-item`, `swatch-trigger`, `swatch-indicator`; `swatch`, `value-swatch`, `transparency-grid` (a part's form input keeps `hidden-input`). `data-color-swatch-picker` is gone. The theme's six colour sheets are merged into `color-picker.css`, which styles the channel slider and the inputs itself. Slider, Number Input and Radio Group gain an optional hosted naming (the host's scope and part names; defaults unchanged), contracts an optional `partName` (the test adapters locate parts through it), `Field.Root` an optional `rootPart`, and `sliderStepInvariants` an optional `naming`.
- f982235: Add Combobox: a text input with a listbox popup. Filtering (locale-aware, or off with `filter: null`), auto highlight with a typing pause before the active descendant, inline completion, IME-safe keys, Enter/Escape/Tab and the commit rules for typed text (exact match, empty, custom values), async results with `itemsQuery` and an abort signal per text change, the empty state, multiple selection with chips (the shared `input-chips` helpers), forms (hidden inputs, reset, autofill, required), Field binding and label activation. The `getCombobox` driver, `comboboxTraits`, and `combobox.css`. The machine runtime now processes an event an action sends after its step (a scheduler callback) at once; `FormInputDecl.values` names the values a hidden input mirrors.
- 631011b: **Breaking (unreleased; a minor bump while on 0.x).** Add Color Picker, the one colour component. A trigger and a popover, or an inline panel (`inline`), holding the parts you choose: `Area` (two channels as a 2D surface, keyboard and pointer), `ChannelSlider` (one channel on a Slider), `ChannelInput` (a hex or CSS field, or a number field per channel), `SwatchGroup` / `SwatchTrigger` / `SwatchIndicator` (a palette with one centred selected mark: a ringed dot, or your glyph), `Swatch` / `ValueSwatch`, `EyeDropperTrigger` (where the browser has one), `FormatSelect` / `FormatTrigger` / `View`, `ValueText` and form participation. The popover is positioned next to its control. There are no standalone Color Area, Color Slider, Color Field, Color Channel Field, Color Swatch or Color Swatch Picker exports: they are the picker's parts (their machines live in the internal `@rind-ui/core/internal` entry, not public API). `@rind-ui/core` exports the colour model (`Color`, `parseColor`, `formatColor`, channels, names); `@rind-ui/testing` exports `getColorPicker` with its parts' drivers (`area`, `slider`, `input`, `swatches`, `swatch`). `pointer-drag` gains a 2D mode; Field gains `FieldControlBoundary`. Stylesheets for every part, with a checkerboard for transparency.
- 09f2445: Add Context Menu: a Menu opened from a region by right click, Control+click, long press (touch and pen) or the context-menu key, anchored at the point, re-anchored by a second right click in the region, with `openAt` for programmatic opening, the `getContextMenu` driver and `context-menu.css`. Press interactions: a long press can set a movement tolerance and a second pointer cancels it. Testing: parts gain `contextMenu()` and `longPress()`, and the DOM adapter takes `advanceClock` (a virtual clock for explicit waits only).
- 4ddc47f: Add Dialog: modal by default (outside inert, scroll locked, Tab contained) or non-modal, named by its title, with initial and final focus rules, controllable open state with reasons, nested dialogs, submit-type close triggers, the `getDialog` driver and `dialog.css`.
- adc1270: Add Badge, Skeleton and Avatar. Badge: static status text that is never a live region, a `label` for assistive technology and a development check for a host whose `aria-label` hides the count; `getBadge`, `badge.css`. Skeleton: one busy region per loading area, hidden and inert placeholders, a loading text outside the region, an optional completion announcement and a CSS shimmer that stops under reduced motion; `getSkeleton`, `skeleton.css`. Avatar: the shared `image-loading-status` machine read from the rendered `<img>` (no probe, cached and server-rendered images never flash the fallback), one stable name on Root, fallback timing, Avatar Group with an overflow label; `getAvatar`, `avatar.css`. Aspect Ratio is documented as a recipe on the native CSS property: there is no component.
- 9e5c536: Add Image, Progress, Meter and Alert. Image: the shared image-status machine with one stable name in every status (the `<img>`'s own `alt` while it shows, Root's when it is gone) and a lazy-safe server render; `getImage`, `image.css`. Progress and Meter: the shared `range-value` model, determinate/indeterminate progress with completion announcements, meter zones from low/high/optimum; `getProgress`, `getMeter`, stylesheets. Alert: an inline message announced through the Announcer (never its own live region), dismissable with focus moved past it; `getAlert`, `alert.css`. Contracts can declare `absentIn` (states where the component is unmounted) for the model runner.
- a1c4bd8: Drawer: a Dialog at an edge of the viewport, swipeable away and between snap points (with a handle that cycles them), nested drawers with background indent metadata, a keyboard inset, the `drawer` contract and `getDrawer` driver, and the theme stylesheet. New shared pieces:
  - `trackSwipe` (the `swipe-gesture` capability: discrete events, movement as CSS variables);
  - `Part.drag` in both test adapters;
  - `dialogPieces`, so dialog-family machines compose the Dialog's graph.
  
  A transition's declared `reason` now also names the controllable changes its actions write.
  
  Behaviour changes:
  - `DialogCloseReason` gains `"swipe"` (the Drawer's).
  - A transition's declared reason now also applies to the controllable writes of its actions. Dialog and Alert Dialog keep their `details.reason` for every close path (covered by their machine tests).
  - Press: a pointer press no longer cancels when focus moves to an ancestor of the pressed part. This is WebKit's mousedown on a focused button.
- 480fb80: Add Hover Card: a link's non-modal preview opened after a delay by hover or keyboard focus (never by touch), kept open by focus inside, a keyboard-focused trigger or a child layer, in the Tab order right after its trigger, with kebab-case reasons, the `getHoverCard` driver and `hover-card.css`. Tooltip's open ↔ closing session is now a shared module. The restores-focus invariant no longer treats a closed → opening step as a close.
- 216adc6: Add Listbox: single, multiple and no selection, toggle and replace behaviours (selection follows focus, mod to move only), actions, sections, descriptions, empty and load-more, horizontal and RTL, all built on the collection pieces. The listbox parts are reusable under another scope (`listboxParts`, `createListboxParts`) for Select and Combobox. The `getListbox` driver, `listboxTraits`, and `listbox.css`.
- 257cea5: Add Menu: a dropdown menu with items, checkbox and radio items, link items, groups, separators and nested submenus (one machine per level linked by a menu tree), opening by modality, submenu pointer intent with a grace area and rest timeout, Tab and window-blur closing, kebab-case close reasons, the `getMenu` driver and `menu.css`. Hover intent: an exit near a corner counts the side facing the target when the pointer moves towards it. The DOM adapter's outside press stays inside the viewport's client area. Press interactions count a release on a descendant that overflows the part (an extended tap area) as inside.
- 12a2ce9: Breaking (unreleased): one component per control. `Checkbox` and `Toggle` are no longer exported.
  - `Checkbox.Root`, `Control`, `Indicator`, `Label` and `Description` become `CheckboxGroup.Item`, `ItemControl`, `ItemIndicator`, `ItemLabel` and `ItemDescription`.
  - `Toggle.Root` and `Indicator` become `ToggleGroup.Item` and `ItemIndicator`.
  - An Item outside any Root is the single control: no group wrapper and no roving.
  - The item machines, contracts and drivers (`getCheckbox`, `getToggle`) are unchanged.
- ee5958d: Add Breadcrumbs and Pagination. Breadcrumbs: a named navigation landmark with an ordered list, the current page marked with `aria-current="page"` (a span when it has no `href`), separators hidden from assistive technology, and collapsing with an Ellipsis; `getBreadcrumbs`, `breadcrumbs.css`. Pagination: a page-range model with boundaries and siblings, controls as buttons or real links (`getPageHref`), a page clamped when the count shrinks, page-size changes that keep the first item visible; `getPagination`, `pagination.css`.
- 5297d71: Add Number Input: a locale-aware `spinbutton` whose value changes only at commit points (blur, Enter, keys, steppers, wheel, paste), with press-and-hold steppers that take no focus, a hidden number input for forms and validity, Field integration, quiet announcements, the shared `number-parsing` capability (on `@internationalized/number`), the `getNumberInput` driver and `number-input.css`.
- 48a3000: Add Pin Input: one native input over presentational slots, so typing, paste, SMS and password-manager autofill, IME and screen readers work as for one field. Insertions are planned before they apply (filtering, NFKC, `sanitize`, separators dropped from pastes, a full paste replaces), the caret never leaves holes, `onValueComplete` and `autoSubmit` without focus moves, the input is the form control (`pattern`, `required`). The `getPinInput` driver, `Part.paste` in both adapters, and `pin-input.css`.
- 7552c8a: Add Popover: an anchored, non-modal-by-default `dialog` with the non-modal Tab order (content right after its trigger), optional modal mode, naming from the title, the consumer or the trigger, positioning with arrow, controllable open state with reasons, nesting, the `getPopover` driver and `popover.css`.
- 10d8ef0: Add QR Code: an own encoder (`@rind-ui/core/qr`, versions 1–40, all levels and masks, no dependency) rendered as one SVG path with an accessible name, an optional overlay sized within the error-correction budget, a value text, and a download trigger (SVG or PNG); `getQrCode` with an independent decoder in `@rind-ui/testing`, differential fixtures, `qr-code.css`.
- a060b0c: Add Scroll Area: native scrolling with custom scrollbars drawn over it, a Viewport that is a keyboard tab stop only when it scrolls and holds nothing focusable, scrollbars hidden from assistive technology, thumb drag through the shared pointer-drag module, `hover` / `scroll` / `auto` / `always` visibility, the `scroll-metrics` DOM module (batched reads, no layout thrash), `getScrollArea`, `scroll-area.css`.
- af6d9d0: Select: a `combobox` trigger with a listbox popup, single and multiple values, closed-trigger typeahead, a hidden form input (submission, reset, required, autofill), Field integration, the `select` contract and `getSelect` driver, and the theme stylesheet. Modal containment no longer wraps Tab for layers that close on Tab (select, menu).
- a755718: Add Slider: single and multi-thumb values with one native range input per thumb (keyboard, track press, drag with pointer capture and cancel, assistive-technology adjustment), decimal-safe steps, neighbour bounds and `stop` / `push` / `swap` collisions, one commit per interaction, form reset and Field binding, the shared `pointer-drag` module, `getSlider`, adapter pointer steps (`box`, `pointer`, `fill`), the `valued` invariant for value lists, and `slider.css`.
- 72b23f2: Add Tags Input: a text input whose typed or pasted text becomes string tags. One creation path for Enter, delimiters (strings literal, RegExps, lists; caret at the end), paste splitting, blur `add` and `ADD`, with normalising, duplicates, `max` and `validate` (refusal keeps the draft, `data-refused`, `onRefuse`, an announcement); IME-safe keys; chips from the shared `input-chips` helpers with per-tag `disabled`; editing a tag in place; Clear; forms (one entry per tag, required, reset) and Field binding. The `getTagsInput` driver and `tags-input.css`. Suggestions come later, with Autocomplete.
- 78d35f6: **Breaking:** `PasswordInput` and `SearchField` (and their core machines, contracts, messages and metas), `getPasswordInput` and `getSearchField`, and the `password-input.css` and `search-field.css` stylesheets are removed. Use `TextField.Root type="password"` with `TextField.VisibilityTrigger` / `TextField.VisibilityIndicator`, `TextField.Root type="search"`, and `getTextField`; `searchFieldStepInvariants` is now `textFieldKeyStepInvariants`.
  
  Text Field gains passwords and search. `type="password"` adds `VisibilityTrigger` and `VisibilityIndicator` (a toggle with `aria-pressed` and one name in both states, caret kept across the reveal, hidden again on every form submit and unprevented reset, spellcheck and autocorrect off) and `visible` / `defaultVisible` / `onVisibleChange`. `type="search"` makes the input a searchbox with "Clear search" and one clear control. `escapeClears` (default on for search) clears with Escape only when there is something to clear, so an enclosing Dialog still closes on an empty field; `onSubmit` runs on Enter and never while an IME composes. The driver `getTextField` covers it all, located by the control's name (`{ label }`), with `textFieldKeyStepInvariants`; the styles are in `text-field.css`.
- 561f947: Toast:
  - a `createToaster()` store usable from any module, with `Toaster` and `Toast.*` parts;
  - lifetimes that pause on hover, focus, a hidden page, a swipe, while no region is mounted, beyond the limit, or by the API;
  - announcements through the announcer, with no live regions;
  - the F6 hotkey into the region and back, swipe to dismiss, promise toasts;
  - the `toaster` and `toast` contracts with the `getToaster` and `getToast` drivers, and the theme stylesheet.
  
  New capability: `PageVisibility` (`env.visibility`), with `fakeVisibility` in `@rind-ui/testing`. The contract `Key` gains `F6`.
- 485e59a: Add Tooltip: a hover-and-focus `tooltip` (description or label) with open and close delays, a hoverable safe area, Escape and press dismissal, a shared delay group, positioning with arrow, the `getTooltip` driver and `tooltip.css`. Adds the `hover-intent` and `delay-group` capabilities.
- 73ca011: Add Tour: a sequence of steps anchored to elements (or centred), with a spotlight cut out of an optional backdrop, steps that wait for their target to appear, modal or non-modal steps with the target in the Tab order, progress and navigation parts, and `onStepChange` / completion / dismissal reasons; `useTour`, `getTour`, `tour.css`, and the `wait-for-element` and `step-effect` DOM modules.

### Patch Changes

- 77f8580: The DOM adapter waits up to 3000 ms by default in a real browser (1000 ms in jsdom): on a CPU-starved page the first animation frame, which an overlay's initial focus waits for, can arrive after more than a second.
- 0300df8: Delay functions receive the context as well as the props. Number Input has one hold delay (`spinDelay`, 600 ms for a touch hold), and its model test walks press-and-hold again on a virtual clock.
- 93b0abe: `testMachine` through Playwright: a step that closes a presence layer arms the animation hold before the action (Chromium freezes the page's animations through CDP; other engines start CSS animations paused), so the reopen-during-exit check always sees the exit, however slow the round trip.
- f32220d: `testMachine` holds the running animations while it reopens a layer during its exit, so a slow run can no longer see the exit end first and report a new content element; adapters gain `holdAnimations()`.
- Updated dependencies [0cdaff3]
- Updated dependencies [2ceeef6]
- Updated dependencies [a966aa7]
- Updated dependencies [b83e04e]
- Updated dependencies [f982235]
- Updated dependencies [631011b]
- Updated dependencies [09f2445]
- Updated dependencies [6c14cb9]
- Updated dependencies [4ddc47f]
- Updated dependencies [adc1270]
- Updated dependencies [9e5c536]
- Updated dependencies [a1c4bd8]
- Updated dependencies [480fb80]
- Updated dependencies [216adc6]
- Updated dependencies [257cea5]
- Updated dependencies [12a2ce9]
- Updated dependencies [ee5958d]
- Updated dependencies [0300df8]
- Updated dependencies [5297d71]
- Updated dependencies [48a3000]
- Updated dependencies [7552c8a]
- Updated dependencies [10d8ef0]
- Updated dependencies [a060b0c]
- Updated dependencies [af6d9d0]
- Updated dependencies [a755718]
- Updated dependencies [72b23f2]
- Updated dependencies [78d35f6]
- Updated dependencies [561f947]
- Updated dependencies [7ca7ea2]
- Updated dependencies [485e59a]
- Updated dependencies [73ca011]
  - @rind-ui/core@0.3.0

## 0.2.0

### Minor Changes

- 6c01b92: Separator: `Separator.Root` with role by context (`separator`, implicit on `<hr>`, `none` when
  decorative or in a listbox), `aria-orientation` only when vertical, `SeparatorHostContext` for
  containers, `separatorProps` in core for every divider, `getSeparator` with `orientation`,
  `isDecorative` and `isExposed` queries, and `separator.css` (a border, stretching in flex rows,
  visible in forced colors).
- b1a9e18: `@rind-ui/testing/setup` registers Testing Library's `cleanup` (and rind-ui's state reset) after each test also when Vitest runs without `globals`, so a second `render` in a file no longer leaves the first tree in the document. Opt out with `globalThis.RIND_AUTO_CLEANUP = false` in an earlier setup file.
- a135fd4: Add Toolbar: one tab stop with focus memory, arrows and Home / End over its own controls, hosted Toggle Group and Radio Group, text fields that keep their caret keys, `Toolbar.Item` for any other control, `getToolbar` driver and `toolbar.css`.

### Patch Changes

- 3115e7c: In a real browser, React act() warnings caused by the user's resting cursor (a hover on a part rendered under it) no longer count as step errors in `testMachine`.
- Updated dependencies [6c01b92]
- Updated dependencies [a135fd4]
  - @rind-ui/core@0.2.0

## 0.1.0

### Minor Changes

- a383a92: Accordion: items built on Collapsible, with `value` / `defaultValue` / `onValueChange`,
  `multiple`, `collapsible` (default true), `disabled`, `focusableWhenDisabled`, `orientation`,
  `dir`, `headingLevel` (default: the surrounding `Heading.Level`, else 3) and `closedContent`.
  Arrow-key, Home and End navigation between triggers is opt-in (`keyboardNavigation`, as in
  APG 2026). Open panels are regions by the region rule (up to 6 items, single mode, or
  `contentRole`). `getAccordion`, `accordionContract`, and `accordion.css`.
- 08430f7: Button: one `onPress` per activation from every input with its modality, `onPressStart` /
  `onPressEnd`, a pending state that keeps focus, swaps `submit` to `button` and announces
  `messages.pending` when focused, and `getButton` with `press` / `pressWithSpace`. Shared
  button-like rules for every button-like part (`buttonLikeProps`: native by default with
  `type="button"`, `<a href>` delegated to link-navigation, generic elements with role and
  tabIndex, disabled and `focusableWhenDisabled`, `elementInfo`, a fieldset-disabled tracker
  following every ancestor fieldset). Press interactions now keep the native Enter and Space
  activation of submit and reset buttons, so a form submits or resets once.
- be08d71: Checkbox Group: a set of Checkboxes with one array `value` (controlled or not, set-equality
  change detection), submitted as one entry per checked item under the group's `name`.
  Parts: `Root`, `Label`, `Description`, `ErrorMessage`, and `Parent`, a select-all Checkbox
  that is mixed for a partial selection and follows the APG cycle (select all, none, restore).
  `required` means at least one item; disabled and read-only apply to the whole group; one
  form reset answers for every item. Registers as one control in a Field.
  `getCheckboxGroup`, `checkboxGroupContract` and `checkbox-group.css` (structural).
- 758adfb: Checkbox: checked, unchecked or `indeterminate` (`aria-checked="mixed"`), controllable and
  form-associated through a hidden native input (`name`, `value`, `uncheckedValue`, `form`,
  `required`, form reset to the current `defaultChecked`). Parts: `Root`, `Control`,
  `Indicator` (children may be a function of the state), `Label`, `Description`. Space
  toggles; Enter submits the form. Shared `hidden-form-input` and `control-label` behaviour
  for Switch and Checkbox Group. `getCheckbox`, `checkboxContract` and `checkbox.css`
  (structural; forced colors map checked and mixed to `Highlight`).
- 06aba0c: Collapsible: a trigger and a content region with controllable `open`, `disabled` and
  `focusableWhenDisabled`, and `closedContent` (`until-found` by default so the browser's
  search can open it, `hidden`, or `unmount`). The content publishes its size as
  `--rind-collapsible-content-height` / `-width` (measured without disabling animations, `auto`
  at rest) for CSS transitions; `data-reveal` marks instant reveals. `getCollapsible`,
  `collapsibleContract`, and `collapsible.css`.
- 04b697c: Collections: one immutable, key-based model for lists, sections and trees (O(1) lookups and
  moves, filters that ignore case and diacritics and match keywords), selection (modes,
  behaviours, ranges from an internal anchor, select all, disabled rules), navigation with a
  bounded walker and data-driven highlight repair, a clock-based typeahead, reusable machine
  pieces and connect helpers for roving tabindex and `aria-activedescendant`, static item
  registration (`useCollectionItems`, `useRegisterItem`), and the collection contract fragment
  with the `selectable` and `set-metadata` checks in `@rind-ui/testing`.
- 4311bfb: Field: one form control with a Label, Description and ErrorMessage, validated by one
  engine (sources in order: `invalid`, external errors, native constraints, `validate`;
  native validity as the source of truth; submit / blur / change modes; native and aria
  behaviours; async validation with stale-result dropping and debounce; touched, dirty,
  filled; reset; focus on the first invalid control in tree order with a focus ring; polite
  announcements once per message). The `field-control` binding for control authors
  (`useFieldControl`, `mergeFieldProps`), `constraintValidity` as an environment capability,
  `focusSafely` with an optional modality, `getField` with `.control()` composition,
  `field.css`, and the "Implementing field-control" guide.
- 13fa6bb: Fieldset: a native `<fieldset>` named by its Legend and described by Description and
  ErrorMessage, whose `disabled` reaches every rind-ui control through a context (portalled
  parts and nested Fieldsets included, the first Legend exempt) and native controls natively.
  Button now follows it. `getFieldset`, `Part.accessibleDescription()`, optional parts in the
  part registry, `fieldset.css`; the native fieldset tracker also follows moved nodes.
- 70581a4: Floating positioning: a `position` capability (`domPositioning`, on `@floating-ui/dom`) that
  places anchored popups against an element, a virtual rectangle or a point, with collision
  avoidance, available-size and anchor-size CSS variables, an arrow, a hidden-anchor state,
  tracking (visual viewport, layer stack, ancestor animations), strategy `auto`, side lock and
  a manual mode for CSS anchor positioning; connect helpers for the positioner, content and
  arrow parts; the `positioningQueries` contract fragment, `fakePositioning()` and the
  `anchored` layout invariant in `@rind-ui/testing`; and the positioner stylesheet.
  Fix: a registered trigger is no longer made inert while its layer exits, so focus returns to it.
- 63f8e5f: Form: a native `<form>` that validates every Field on a submit attempt (native `invalid`
  events grouped into one attempt), focuses the first invalid Field in tree order once,
  holds a submission for pending async checks and requests it again with the same
  submitter, maps server `errors` to Fields by exact name, announces one summary for two or
  more invalid Fields, calls `onFormSubmit` with typed values, exposes `validate(name?)`,
  and keeps server errors through React 19's automatic action reset. Fields take the Form's
  defaults and let it lead attempts; async results are cached per input. `getForm`,
  `Part.scoped()`, `data-name` on Field roots, `form.css`.
- 430a92f: Heading: levels from the nesting of `Heading.Level` sections (root 2, explicit `level`
  wins, clamped to 1–6 with development warnings), native `h1`–`h6` with the role and
  `aria-level` rules for substituted elements, `useHeadingLevel()` for your own components,
  `headingProps` in core for every heading part, `getHeading` with a `level()` query,
  `Part.tagName()` in the test environment, and `heading.css` sizing by `data-level`.
- 5c82f1a: Label: a native `<label>` with no role, the shared `label-interaction` rules (double-click
  selection guard, focus forwarding for non-labelable targets, development check of `for`),
  `getLabel` with `click` / `doubleClick` and `text` / `controlName` / `isControlFocused` /
  `selectedText`, new test environment operations (`Part.accessibleName()`,
  `Part.labelled()`, `Part.doubleClick()`, `env.selectedText()`), `label.css`, and a Labels
  guide.
- d309928: Link: the first component. `linkProps` (core/dom) gives every link part the same rules:
  a native anchor by default, client routing through a hooks-free `Router` environment
  capability that never double-navigates, modifier, middle and cross-origin activations left
  to the browser, href resolution that never rewrites external URLs, the disabled-link rule
  (TalkBack-reachable), `aria-current`, activation reports with a disposition, and a
  `role="link"` fallback built on the exported `activateLink` routine. `<Link>` and
  `RouterProvider` in React; `staticContract` for stateless components; `getLink`,
  `fakeRouter()` and `env.navigated()` in the DOM and Playwright adapters; `link.css` in the
  theme; generated API docs from component meta files.
- ee3687d: Overlay infrastructure: a per-document layer stack with explicit parentage, dismissal by
  Escape, outside press and outside focus (vetoable, with reasons), focus containment and
  restore without sentinels, outside hiding with `inert`, a reference-counted scroll lock,
  presence for exit animations, portal target resolution and the `overlayEffect` that ties
  them together. React gains `Portal`, `usePresence` and `LayerProvider`; testing gains the
  `modal` and `presence` traits, a document-clean check after unmount, and driver support for
  overlays; the theme gains overlay base styles.
- 058f6e8: Radio Group: one choice out of several with a roving single tab stop. Arrow keys move and
  check (every arrow whatever the orientation, mirrored in RTL); focus alone never checks. Parts:
  `Root`, `Label`, `Description`, `ErrorMessage`, `Item`, `ItemControl`, `ItemIndicator`,
  `ItemLabel`, `ItemDescription`. One native radio input per item shares the group's `name`;
  `readOnly`, `required`, `invalid`, `disabled` and `focusableWhenDisabled` apply to the whole
  group, and the group registers as one control in a Field.
  `getRadioGroup`, `radioGroupContract` and `radio-group.css` (structural, forced-colors aware).
- 1e7460e: Segmented Control: one choice out of a joined strip of segments, with radio semantics (a
  `radiogroup` of `radio` buttons, one roving tab stop; every arrow moves and selects, Space
  selects, Enter submits the form). Parts: `Root`, `Label`, `Item` (the segment, its hidden input
  a sibling) and an optional measured `Indicator` (`--rind-indicator-*`). `readOnly`, `required`,
  `invalid`, `disabled` and `focusableWhenDisabled` apply to the whole control.
  `getSegmentedControl`, `segmentedControlContract` and `segmented-control.css` (structural,
  forced-colors and reduced-motion aware).
- d9c190c: Switch: an on/off setting (`role="switch"`), controllable and form-associated through a
  hidden native input (`name`, `value`, `uncheckedValue`, `form`, `required`, form reset to
  the current `defaultChecked`). Parts: `Root`, `Control`, `Thumb`, `Label`, `Description`.
  Space toggles; Enter submits the form. `getSwitch`, `switchContract` and `switch.css`
  (structural; the thumb mirrors in RTL, forced colors keep the track border and map checked
  to `Highlight`).
- e5c91c9: Tabs: a tablist with one roving tab stop and a panel per tab. `activationMode` `automatic` or
  `manual` (focus alone never selects), `orientation`, `loop`, `disabled`, `focusableWhenDisabled`
  and `inactivePanels` (`unmount`, `hidden`, `until-found` with find-in-page). Parts: `Root`, `List`,
  `Tab`, `Panel` and an optional measured `Indicator` (`--rind-indicator-*`). `getTabs`,
  `tabsContract` and `tabs.css` (structural, forced-colors and reduced-motion aware).
- 97bac9f: Text Field: a native input or textarea with a controllable value (`onValueChange` with
  reason, native event and composition flag), IME-safe handling, a ClearTrigger that keeps
  focus and clears through one `input` event, a CharacterCount (hard `maxLength` or soft
  `max`, announced near the limit), and autosize (`field-sizing: content` or a side-effect-free
  measured fallback). `TextField.Root` is a Field when standalone and joins an enclosing one
  (the shared `FieldHost` helper). `buildTextFieldMachine(preset)` for presets,
  `textFieldContractFor(scope)`, `getTextField`, `text-field.css`, and an Autosize guide.
- 2e3d605: Toggle Group: a set of toggle buttons with one roving tab stop. `selectionMode` `single` or
  `multiple`, a `string[]` value, `disallowEmptySelection`, `orientation`, `loop`, `disabled` and
  `focusableWhenDisabled`. Arrow keys only move focus; Space and Enter press. Parts: `Root`, `Item`.
  `getToggleGroup`, `toggleGroupContract` and `toggle-group.css` (structural, forced-colors aware).
- c6c972c: Toggle: a two-state button (`aria-pressed`) with controllable `pressed`, `disabled` and
  `focusableWhenDisabled`, activated by Enter and Space. `Toggle.Indicator` swaps its content
  with the state (`fallback` while off) for icon-only toggles whose accessible name must not
  change. In development a name that follows the state is warned about. `data-state` is
  `on`/`off`; `data-pressed` is a press in progress. `getToggle`, `toggleContract`, and
  `toggle.css` (on state is an outline plus a background, never colour alone).

### Patch Changes

- Updated dependencies [a383a92]
- Updated dependencies [08430f7]
- Updated dependencies [be08d71]
- Updated dependencies [758adfb]
- Updated dependencies [06aba0c]
- Updated dependencies [04b697c]
- Updated dependencies [4311bfb]
- Updated dependencies [13fa6bb]
- Updated dependencies [70581a4]
- Updated dependencies [63f8e5f]
- Updated dependencies [430a92f]
- Updated dependencies [5c82f1a]
- Updated dependencies [d309928]
- Updated dependencies [ee3687d]
- Updated dependencies [058f6e8]
- Updated dependencies [1e7460e]
- Updated dependencies [d9c190c]
- Updated dependencies [e5c91c9]
- Updated dependencies [97bac9f]
- Updated dependencies [2e3d605]
- Updated dependencies [c6c972c]
  - @rind-ui/core@0.1.0
