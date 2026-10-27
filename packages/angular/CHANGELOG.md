# @rind-ui/angular

## 1.3.0

### Minor Changes

- e04eece: Agent Presence: what a voice agent is doing (connecting, listening, thinking, speaking, error), spoken once per change, with an audio level written straight to CSS variables (no re-render per frame). Testing: `getAgentPresence`. Theme: `agent-presence.css`.
- e04eece: Angle Slider: a dial from 0 to 359 degrees on a native range input; press or drag sets the angle, arrows step, Shift steps 15, the ends wrap, Escape cancels a drag. Testing: `getAngleSlider`. Theme: `angle-slider.css`.
- e04eece: Carousel: slides on native scroll snap with pages, Prev/Next, a roving tablist of indicators and a status; autoplay off by default and, when on, paused by hover and a hidden page, stopped by focus, never with reduced motion; hidden slides inert. Testing: `getCarousel`. Theme: `carousel.css`.
- e04eece: Citation: a numbered source marker in an answer, named by its source, with a hover card (Portal, Positioner, Content, Source parts); a link for a safe URL, a pinning button otherwise, plain text while pending. Testing: `getCitation`. Theme: `citation.css`.
- e04eece: Color Wheel: a hue ring on the Angle Slider machine with Color Slider's colour binding; a press counts only on the ring, the other channels and a grey's hue are kept, the colour submits as hex. Testing: `getColorWheel`. Theme: `color-wheel.css`.
- e04eece: Context Meter: a model's context usage as a `role="meter"` named in words ("21K of 128K tokens, 17%"), with zones that never rely on colour alone, a rising threshold crossing announced once (`warnAt`, `fullAt`, `resetKey` re-arms), the stream itself silent, and a breakdown list. Testing: `getContextMeter`. Theme: `context-meter.css`.
- e04eece: Editable: text shown in place that becomes an input; Enter saves, Escape restores the value at entry, an outside press or Tab-out saves or cancels by `submitMode`, the Preview and the Input share one box. Testing: `getEditable`. Theme: `editable.css`.
- e04eece: Floating Panel: a non-modal window (the Dialog machine) moved and resized by pointer or keys on its grip, kept inside its boundary, minimised and maximised; a drag is seen at its start and end only. Testing: `getFloatingPanel`. Theme: `floating-panel.css`.
- e04eece: JSON Tree View: a Tree View of any JSON or JavaScript value. Children are built only when their container opens, so a huge value opens at once; keys are JSON Pointers (no dotted-path collision); large containers are grouped in ranges; a cycle shows where it loops while a shared value shows twice; BigInt, Map, Set, Date, RegExp, Error and sparse arrays render exactly. The visible text is the item's name ("address: object, 4 entries"). Ctrl/⌘+C copies the focused node as JSON, its value or its pointer, announced. Testing: `getJsonTreeView`. Theme: `json-tree-view.css`; a Tree View leaf's indicator keeps its place without a caret.
- e04eece: Mentions: @-mentions and /-commands in a textarea; plain text plus ranges reconciled from each edit (Backspace removes a mention whole), a list on the combobox pattern anchored at the trigger, IME-safe. Testing: `getMentions`. Theme: `mentions.css`.
- e04eece: Message Actions: the row of actions under a chat message, one Tab stop (a Toolbar). Copy (Clipboard's states, the value read at press time), Regenerate (busy until its promise settles, a second press ignored), Edit (`aria-pressed`, the focus back when the editor closes), thumbs up/down (a single, deselectable Toggle Group), and versions that announce "Version 2 of 3" and do not wrap silently. The row hides by style and never unmounts, so the focus never drops. Testing: `getMessageActions`. Theme: `message-actions.css`.
- e04eece: Signature Pad: sign with a mouse, a pen or a finger. The value is stroke data rendered as SVG in the text colour, so it never clears or misaligns on a resize, a zoom or a high-DPI screen; one pointer owns a stroke; every way a stroke can end is handled. It submits with its form (an SVG data URL, or JSON), `required` validates, Clear and Undo stay focusable and announce. `toBlob` / `download` rasterise at the stroke size. Core: `startStroke` (dom/stroke-input) and `rasterizeSvg` (dom/svg-raster). Testing: `getSignaturePad`, and a `pointerId` option on `Part.pointer` for a second finger. Theme: `signature-pad.css` (family `field`).
- e04eece: Suggestions: prompt chips. A press calls `onSelect({ value, index, key })` and sends nothing itself; while `loading` the chips stay disabled but focusable (the focus never drops); a new set is announced only with `announce="polite"`, never on mount; `focusTarget` takes the focus back to the prompt after a press that began inside. Testing: `getSuggestions`. Theme: `suggestions.css`.
- e04eece: Timer: a countdown or a stopwatch. The time is derived from the injected monotonic clock, never added up from ticks, so it stays right after a background tab or a slow frame; ticks land on the value's whole interval; a countdown completes exactly at its target, once, and catches up when the page becomes visible. Actions `start`, `pause`, `resume`, `reset`, `restart`, `toggle`: an action that does nothing now leaves its trigger disabled but focusable, never hidden. The Area is `role="timer"` named by the time in words (`Intl.DurationFormat`); completion is announced. Testing: `getTimer`. Theme: `timer.css` (family `decoration`).
- e04eece: Tool Call: an AI tool call's name, status and duration in a disclosure, its input and output, and a human approval that sends one decision, keeps the buttons focusable while it is sent and puts the focus on a receipt. Testing: `getToolCall`. Theme: `tool-call.css`.

### Patch Changes

- 2f7ee89: Button, file upload and streaming message fixes from the cross-library audit:
  
  - Button: a pending submit stays `type="submit"` and cancels its click, so Enter in a text field no longer submits the form again through implicit submission (RA#7543).
  - File Upload: a click on the dropzone's content opens the chooser inside a Dialog, a Popover, a label or any focusable container. Only interactive elements inside the zone are excluded.
  - Streaming Message: a response that fails, is cancelled or completes before it ever streams is announced. Only a message that mounts already final stays silent.
- 56f87a7: Color picker, color field and number input fixes from the cross-library audit:
  
  - Color picker: an enclosing disabled or read-only Field, rind's Fieldset or a native `<fieldset disabled>` disables the picker and every child.
  - Color picker: a read-only or disabled picker ignores autofill.
  - Color field: a typed css colour with alpha (`rgba(…, 0.5)`, `rgb(… / 50%)`) sets the alpha when the field has `alpha`.
  - Number input: a step, a large step or End never goes past an off-grid `max` (max 10.5, step 1 stops at 10), so the hidden input reports no range or step mismatch.
  - Number input: Persian digits typed by the user are kept when the value is reformatted.
  - Scroll area: a removed Content child is no longer observed.
- f47b58c: Combobox and Listbox fixes from the cross-library audit:
  
  - A selected option the server-filtered results no longer contain keeps its text on blur and on its chip (it reverted to an empty input while the value stayed).
  - A parent clearing the controlled value clears the input text.
  - Enter on typed text the combobox rejects no longer submits the form.
  - Inline mode (a command palette) loops by default, as specified.
  - A press on a disabled option no longer closes the popup.
  - Listbox with `strategy="active-descendant"` announces the highlighted option in VoiceOver with Safari.
  - The highlight stays during an IME composition; a pointer choice mid-composition is final.
  - A caret moved before async results arrive is never overwritten by an inline completion.
  - Chips follow a read-only Field; Clear with nothing selected reports no value change; a disabled selected option is never the keyboard entry highlight.
- f7db9f7: Date field and calendar fixes from the cross-library audit:
  
  - Range fields: an end that commits a new value with the same problem (still before `minValue`) stays invalid. Before, the pair turned valid and emitted.
  - Range fields: Clear, form reset, a pick and a parent's value drop each end's partial segments, even when that end's value was already null.
  - Pickers: the bound calendar follows the field's own `locale`, direction and calendar system, not the app's.
  - IME: compositions add up. A Korean 오 then 후 is PM, and full-width １ then ２ is 12.
  - Calendar: server markup marks no day as today (the server's day or zone may not be the viewer's). Today is marked after hydration.
  - `minValue` after `maxValue`: a development warning names both props, and a controlled calendar no longer loops between them.
  - Calendar: a new object for the same date in `focusedValue`, `minValue` or `maxValue` is no change, so a re-render does not clamp again.
  - A 12-hour locale that formats no day period (fr-CM) gets an AM/PM segment.
  - A minute or second edit in the repeated hour of a fall-back day keeps that occurrence.
  - Solid, Svelte and Angular: a refused IME composition no longer leaves its text in the segment.
  - `placeholderValue` follows the prop after mount.
- 2c1f7d7: Date and time field fixes from the cross-library audit:
  
  - Typing a whole date with separators over a filled field ("12/25/2027") no longer corrupts it: the separator right after an auto-advance no longer advances a second time.
  - Enter commits the digit still waiting for a second one, so the form submits the date on screen.
  - Enter in a segment submits the form in Chromium too (its line break is no longer cancelled).
- 4124627: Field, text field, tags input, pin input, prompt input and color area fixes from the cross-library audit:
  
  - Field: after a form reset, a value that fails `validate` still sets the native validity, so the form cannot submit it.
  - Text Field: a parent's change to a controlled value is reported to the Field, so its error, its custom validity and `data-filled` follow.
  - Pin Input, Tags Input and Prompt Input: a form reset, a parent's value, an API change and a draft cleared by a send are no longer user changes. They keep server errors, and a successful send no longer shows "Please fill out this field".
  - Field.Label rendered as another element (`render={<span/>}`, a child snippet, a directive on a span) still names the control through `aria-labelledby`, and a press on it focuses the control.
  - Tags Input: a read-only or disabled input ignores a paste with delimiters. The textbox carries `aria-required`.
  - Pin Input: a custom `pattern` no longer turns into a native `pattern` that rejects valid codes (`/[a-f0-9]/i`, `/^[A-Z]$/`). `pattern` is documented as BMP-only.
  - Text Field: Enter in a Textarea is a new line, never `onSubmit`.
  - Color Area: an enclosing disabled or read-only Field, rind's Fieldset and a native `<fieldset disabled>` disable it, pointer drags included.
- d42779f: Toggle Group, Checkbox Group, Menu and Navigation Menu triggers follow a native `<fieldset disabled>` (and rind's Fieldset, for the triggers): `data-disabled`, no hover state, no tab stop on a disabled button, and a trigger never opens.
- d42779f: Menubar: a menu's content rendered inside the bar (without Menu.Portal) logs a development warning. A menubar may only own its items, so `role="menu"` among its children fails axe `aria-required-children`.
- 0c4d74c: Overlay fixes from the cross-library audit:
  
  - Drawer: a mouse or pen click on a checkbox, label or clickable row inside the drawer reaches it again (the swipe captured the pointer at pointerdown and took the click).
  - A press or focus inside a web component (open shadow root) inside a dialog, popover or drawer no longer counts as outside and closes it.
  - A tooltip open over a modal no longer swallows the backdrop click that closes the modal.
  - Dialog: a submit-type Cancel, Action or Close trigger lets the form's own submit handler run and submits it with the form connected, then closes.
  - Drawer: `--rind-drawer-keyboard-inset` is written for portalled drawers; the parent's `--rind-drawer-frontmost-size` follows a nested drawer's resize; content that mounts late (lazy chunk) still gets swipe and snap points.
- cafa48e: Select, menu and navigation menu fixes from the cross-library audit:
  
  - Select: browser autofill that matches no option (or lands on a multiple or read-only select) no longer stays in the hidden input. The input is re-synced, so `required` keeps working.
  - Select: a read-only select ignores autofill.
  - Select: inside a Field, the trigger's `aria-describedby` keeps its own Select.Description and the consumer's ids after the Field's.
  - Select: a native `<fieldset disabled>` around the trigger disables the select (radix#2417).
  - Menu and menubar: arrow keys follow the trigger's nearest `[dir]`, the same direction placement uses. The positioner falls back to the locale's direction instead of `ltr`.
  - Context menu: Tab in a non-modal menu on a focusable region moves on from the row the menu opened on, not into the region.
  - Navigation menu: a panel opened and closed with the keyboard no longer blocks hover on its trigger.
  - Angular context menu: a bound `tabindex` on the trigger is read after the first render.
- 7becc63: Tabs, radio group, toggle group, checkbox and accordion fixes from the cross-library audit:
  
  - Tabs, Radio Group, Segmented Control and Toggle Group items own their `id`. A consumer `id` is ignored with a development warning, so the panel's name, the item labels and the roving focus keep working. A `CRITICAL` entry `"!name"` marks such an attribute.
  - Radio Group: a press on an item's label checks and focuses its radio when the control is a substituted, non-labelable element.
  - Tabs: a disabled root leaves the tab list as the one tab stop.
  - Angular Checkbox and Switch: Enter submits the hidden input's form, so the `form` prop is honoured.
  - Accordion: modified keys (Ctrl/Cmd+Home, Alt+Arrow) on a trigger stay the browser's.
- d42779f: Tabs: uncontrolled Tabs with no `defaultValue` render the first enabled tab selected, with its panel, on the server. The first panel no longer appears only after hydration.
- 7776d8c: Toast fixes from the cross-library audit:
  
  - Toasts auto-dismiss again after the last toast was closed under the pointer, or after the region was left with the focus (F6, Escape): the region's hover and focus ended with it, but the pause stayed and every later toast showed paused and expanded forever (zag#3464).
  - A toast still playing its exit when the Toaster unmounts no longer leaves an empty "Notifications" landmark in the next Toaster.
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [e04eece]
- Updated dependencies [2f7ee89]
- Updated dependencies [56f87a7]
- Updated dependencies [f47b58c]
- Updated dependencies [f7db9f7]
- Updated dependencies [2c1f7d7]
- Updated dependencies [4124627]
- Updated dependencies [d42779f]
- Updated dependencies [d42779f]
- Updated dependencies [0c4d74c]
- Updated dependencies [5d177e9]
- Updated dependencies [7c30d18]
- Updated dependencies [ce8ab06]
- Updated dependencies [cafa48e]
- Updated dependencies [7becc63]
- Updated dependencies [7776d8c]
- Updated dependencies [a4c9e6a]
- Updated dependencies [5308d68]
- Updated dependencies [8196675]
  - @rind-ui/core@1.3.0

## 1.2.0

### Minor Changes

- 1471d49: New package `@rind-ui/angular` (`@angular/core` ≥ 21): the same machines, ARIA and drivers as
  `@rind-ui/react`, ported one component at a time (this release: Toggle, Button, Separator, Kbd,
  Badge, Heading, Label, Link, Skeleton, Progress, Meter, Image, Avatar, Alert, Toggle Group, Fieldset, Field,
  Text Field, Checkbox, Checkbox Group, Switch, Radio Group, Segmented Control, Collapsible,
  Accordion, Tabs, Toolbar, Breadcrumbs, Pagination, Rating, Slider, Number Input, Pin Input, Splitter, Stepper, Timeline, Table of
  Contents, Scroll Area, Marquee, QR Code, Clipboard, Code Block, Form, File Upload, VisuallyHidden, Listbox, Tag
  Group, Grid List, Tree View, Sortable, Popover, Tooltip, Hover Card, Dialog, Drawer, Toast, Table
  with its Filter parts, Menu, Context Menu, Menubar, Navigation Menu, Select, Combobox, Tags Input,
  Calendar, Date Field with its picker, Color Picker, Image Viewer, Image Cropper, Tour, Message
  Thread, Streaming Message, Reasoning, Prompt Input;
  the form toggle bases, for a toggle of your own). Parts are attribute directives on your own elements
  (`<button rindToggleRoot [(pressed)]="bold">`), so no wrapper element is added and any host element
  keeps the behaviour; a part that renders elements of its own (Kbd, Badge) is a component with an
  attribute selector, and a part that is a Button or a Link (Pagination's pages and triggers) is
  the one its element asks for: `<button>`, or `<a>` with `getPageHref`; a Stepper's Trigger is `<button>` while its step is reachable,
  `<span>` otherwise; a Marquee's Content is a structural directive (`<div *rindMarqueeContent>`),
  stamped once per copy; a Drawer's Handle is `<button>` with two or more measured snap points
  (`d.handleIsButton()`), `<div>` otherwise. A layer's portal is a template
  (`<ng-template rindPopoverPortal>`, `<ng-template [rindToaster]="store" let-toast>`), rendered into
  `body` after the first render with the trigger's dir, lang and theme; a Table Filter's content goes
  in `<ng-template rindTableFilterPortal>` with a FilterPositioner around it. A Menu item's activation is `(itemSelect)`
  (a native `select` event bubbles); Select, Combobox and Tags Input options are the Listbox
  parts under their own names (`rindSelectItem`), their data rows from the Root's `groups()`. A Date Field
  is a range field with `selectionMode="range"` on its Root; a Color Picker Channel Input is a text
  field for `channel="hex"` or `"css"` and a Number Input for any other channel; an inline Color
  Picker has its Content in place (no Portal or Positioner). A Tour Root is an `<ng-container>`
  (`injectTour()` gives a handle for `[tour]`), its actions a template
  (`<ng-template rindTourActions let-actions>`). A Prompt Input is `<form rindPromptInputRoot>`; its send
  is the `submitHandler` input (it may return a promise), its Attachments take an
  `<ng-template let-a>` chip; a Streaming Message's Content shows the text when it has no content of
  its own. A part React renders nothing for in some state (a loaded Skeleton's Status, a
  dismissed Alert, an inactive Tab's panel) keeps your element, hidden. Controlled values are an input and a `<value>Change` output (`[(pressed)]`),
  with `<value>ChangeDetails` for vetoing a change. Published as Angular partial compilation, linked
  by your application's build; its relative imports name their files, so Node's ESM loader (SSR, a
  test runner that leaves the package external) loads it too. A Date Field's picker has a
  CloseTrigger (`<button rindDateFieldCloseTrigger>`), as in React.

### Patch Changes

- Updated dependencies [aefab08]
  - @rind-ui/core@1.2.0
