# Component inventory

Every component found across nine headless libraries, merged so that synonyms
(Modal = Dialog, Preview Card = Hover Card, OTP Field = Pin Input, …) collapse to
one row. rind-ui's target is **all of them**: being a superset of every library
below is a stated goal, not an aspiration.

Sources (collected 2026-10-14): Ark UI, Radix Primitives, React Aria Components
(RAC), Base UI, Headless UI (HUI), Ariakit, Reka UI, Bits UI, Kobalte — their
`llms.txt` files and component folders on GitHub. Rows marked *unverified* were
seen in docs or source but not confirmed as public, stable API.

**88 components** in 10 categories, plus 11 AI-UI primitives no library ships.

## How to read this

- `●` the library ships it · blank: it does not.
- **#** how many of the nine libraries ship it. 7+ is the common core; 1 is
  usually a single library's speciality, and the place to read its source first.
- **Wave** the order we build in (see [decisions/0002-architecture.md](decisions/0002-architecture.md#build-order)):
  1 foundations and what Reado uses · 2 complex interactions · 3 heavy or niche.
- **Status** `todo` → `research` → `spec` → `wip` → `done`. Research notes live
  in [research/](research/), one file per component.


## Overlays (9)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dialog | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done | RAC: Dialog + Modal |
| Popover | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done |  |
| Tooltip | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done | HUI: in source, not in public docs |
| Hover Card | ● | ● | ● | ● |  | ● | ● | ● | ● | 8 | 2 | wip | Base: Preview Card · Bits: Link Preview · Ariakit: Hovercard · RAC: PreviewTrigger (unverified) |
| Toast | ● | ● | ● | ● |  |  | ● |  | ● | 6 | 2 | done |  |
| Alert Dialog |  | ● |  | ● |  |  | ● | ● | ● | 5 | 1 | done |  |
| Drawer | ● |  |  | ● |  |  | ● |  |  | 3 | 1 | done | Used by Reado |
| Floating Panel | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| Tour | ● |  |  |  |  |  |  |  |  | 1 | 3 | done | Reado has TourCard/TourScrim |

## Menus & navigation (11)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Menu | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done | Radix/Reka/Bits/Kobalte: Dropdown Menu |
| Tabs | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done |  |
| Context Menu | ● | ● | ● | ● |  |  | ● | ● | ● | 7 | 1 | wip | Ark: Menu context trigger · RAC: useContextMenu |
| Menubar |  | ● |  | ● |  | ● | ● | ● | ● | 6 | 2 | wip | Reado has MenuBar |
| Navigation Menu | ● | ● |  | ● |  |  | ● | ● | ● | 6 | 2 | spec |  |
| Toolbar |  | ● | ● | ● |  | ● | ● | ● |  | 6 | 2 | done |  |
| Pagination | ● |  |  |  |  |  | ● | ● | ● | 4 | 2 | done |  |
| Breadcrumbs |  |  | ● |  |  |  |  |  | ● | 2 | 2 | done | Reado has Breadcrumb |
| Link |  |  | ● |  |  |  |  |  | ● | 2 | 2 | done |  |
| Steps | ● |  |  |  |  |  | ● |  |  | 2 | 3 | todo | Reka: Stepper |
| Table of Contents | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |

## Disclosure (2)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Collapsible | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done | RAC/HUI/Ariakit: Disclosure |
| Accordion | ● | ● | ● | ● |  |  | ● | ● | ● | 7 | 1 | done | RAC: DisclosureGroup |

## Selection & collections (11)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Select | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done | Used by Reado |
| Combobox | ● |  | ● | ● | ● | ● | ● | ● | ● | 8 | 2 | done | Includes Autocomplete (free text) and Command (inline) |
| Listbox | ● |  | ● |  | ● |  | ● |  |  | 4 | 2 | done |  |
| Tag Group |  |  | ● |  |  | ● | ● |  |  | 3 | 2 | done | Display/removal of chips |
| Tags Input | ● |  | ● |  |  |  | ● |  |  | 3 | 2 | wip | RAC: TokenField (unverified) |
| Tree View | ● |  | ● |  |  |  | ● |  |  | 3 | 3 | done | RAC/Reka: Tree |
| Segmented Control | ● |  |  |  |  |  |  |  | ● | 2 | 1 | done | Ark: Segment Group · used by Reado |
| Grid List |  |  | ● |  |  |  |  |  |  | 1 | 3 | wip | Missing in Ark |
| Table |  |  | ● |  |  |  |  |  |  | 1 | 3 | todo | Missing in Ark; data-grid semantics |

## Boolean & toggles (4)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Radio Group | ● | ● | ● | ● | ● | ● | ● | ● | ● | 9 | 1 | done |  |
| Switch | ● | ● | ● | ● | ● |  | ● | ● | ● | 8 | 1 | done |  |
| Toggle Group | ● | ● | ● | ● |  |  | ● | ● | ● | 7 | 1 | done | RAC: ToggleButtonGroup · a lone Item is the single Toggle (RAC/Kobalte: Toggle Button) |
| Checkbox Group | ● |  | ● | ● |  | ● | ● | ● |  | 6 | 2 | done | A lone Item is the single Checkbox (used by Reado) · Ark: Checkbox.Group · Ariakit: CheckboxProvider with an array value · Reka: CheckboxGroupRoot · Bits: Checkbox.Group (verified in source, 2026-10-14) |

## Inputs (12)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Slider | ● | ● | ● | ● |  |  | ● | ● | ● | 7 | 2 | done |  |
| Button |  |  | ● | ● | ● | ● |  | ● | ● | 6 | 1 | done |  |
| Number Input | ● |  | ● | ● |  |  | ● |  | ● | 5 | 2 | done | Number Field |
| Pin Input | ● | ● |  | ● |  |  | ● | ● |  | 5 | 2 | done | Radix/Base: OTP Field |
| Rating | ● |  |  |  |  |  | ● | ● | ● | 4 | 3 | todo | Rating Group |
| Text Field |  |  | ● | ● | ● |  |  |  | ● | 4 | 1 | done | Input / Textarea; Ark via Field; Password Input (`type="password"`, Radix: Password Toggle Field) and Search Field (`type="search"`) are its parts |
| File Upload | ● |  | ● |  |  |  |  |  | ● | 3 | 3 | todo | RAC: DropZone + FileTrigger · Kobalte: File Field |
| Editable | ● |  |  |  |  |  | ● |  |  | 2 | 3 | todo |  |
| Angle Slider | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| Signature Pad | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |

## Form structure (4)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Form |  | ● | ● | ● |  | ● | ● |  |  | 5 | 2 | done |  |
| Label |  | ● | ● |  | ● |  | ● | ● |  | 5 | 1 | done |  |
| Field | ● |  |  | ● | ● |  | ● |  |  | 4 | 1 | done |  |
| Fieldset | ● |  |  | ● | ● |  |  |  |  | 3 | 2 | done |  |

## Date & time (10)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Calendar | ● |  | ● |  |  |  | ● | ● |  | 4 | 3 | wip | Includes Range Calendar (`selectionMode="range"`) and Month / Year Picker (`view`); Reka: Month/MonthRange/Year/YearRange Picker |
| Date Field | ● |  | ● |  |  |  | ● | ● | ● | 5 | 3 | wip | Includes Time Field (no date segments), Date / Time Range Field (`selectionMode="range"`) and Date (Range) Picker (picker parts); Ark: Date Input, range mode of Date Picker |
| Timer | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |

## Color (2)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Color Picker | ● |  | ● |  |  |  | ● |  | ● | 4 | 3 | done | One component: area, channel sliders, hex and channel inputs (field), swatch group and swatches are its parts |
| Color Wheel |  |  | ● |  |  |  |  |  | ● | 2 | 3 | todo | Missing in Ark |

## Display & feedback (19)

| Component | Ark | Radix | RAC | Base | HUI | Ariakit | Reka | Bits | Kobalte | # | Wave | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Progress | ● | ● | ● | ● |  |  | ● | ● | ● | 7 | 2 | done | Linear + circular (Ark) |
| Separator |  | ● | ● | ● |  | ● | ● | ● | ● | 7 | 1 | done |  |
| Avatar | ● | ● |  | ● |  |  | ● | ● |  | 5 | 2 | done | Reado has PersonAvatar |
| Scroll Area | ● | ● |  | ● |  |  | ● | ● |  | 5 | 2 | done |  |
| Meter |  |  | ● | ● |  |  |  | ● | ● | 4 | 2 | done |  |
| Aspect Ratio |  | ● |  |  |  |  | ● | ● |  | 3 | 3 | done | Recipe (native CSS `aspect-ratio`), no component — docs/components/aspect-ratio.md |
| Heading |  |  | ● |  |  | ● |  |  |  | 2 | 2 | done |  |
| Splitter | ● |  |  |  |  |  | ● |  |  | 2 | 3 | todo |  |
| Alert |  |  |  |  |  |  |  |  | ● | 1 | 3 | done |  |
| Badge |  |  |  |  |  |  |  |  | ● | 1 | 3 | done |  |
| Carousel | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| Clipboard | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| Code Block |  |  |  |  |  |  |  |  |  | 0 | 2 | todo | Requested for the docs site: copy, language tabs, line highlight, focusable scroll region; composes Tabs + Clipboard |
| Image |  |  |  |  |  |  |  |  | ● | 1 | 3 | done | Loading/fallback states |
| Image Cropper | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| JSON Tree View | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| Marquee | ● |  |  |  |  |  |  |  |  | 1 | 3 | todo |  |
| QR Code | ● |  |  |  |  |  |  |  |  | 1 | 3 | done | Used by Reado |
| Skeleton |  |  |  |  |  |  |  |  | ● | 1 | 3 | done |  |

## AI-UI primitives (11)

Not shipped by any of the nine libraries. Headless like everything else: behaviour,
accessibility and a contract — no model inside. Wave: AI (after wave 1).

| Component | The hard part | Status |
|---|---|---|
| Prompt Input | IME-safe submit, autosize, attachments, submit/stop state | todo |
| Mentions / Slash Commands | Inline combobox anchored to the caret (Reado: CompletingTextarea) | todo |
| Message Thread | Stick-to-bottom scroll, jump-to-latest, virtualization | todo |
| Streaming Message | Chunked live-region announcements (Reado: Announcer) | todo |
| Reasoning | Collapsible with a streaming state | todo |
| Tool Call / Tool Approval | pending/running/done/error; human confirmation with managed focus | todo |
| Citation | Keyboard-reachable hover card on inline references | todo |
| Message Actions | Copy, regenerate, edit, feedback, branch navigation | todo |
| Suggestions | Prompt chips | todo |
| Agent Presence | idle/listening/thinking/speaking, audio level, announcements (drives fx Orb) | todo |
| Context Meter | Token/context usage meter | todo |

## Utilities (not components)

Shared infrastructure the components are built from. Most libraries expose some of
these publicly; we decide per utility whether it is public API.

Portal · Presence / Transition · Focus Trap / Focus Scope · Dismissable Layer ·
Roving Focus / Composite · Collection (list, tree, async; specified: add-collections) · Slot / asChild / render
prop · mergeProps · Visually Hidden · Accessible Icon · Live Region / Announcer ·
Direction / Locale / I18n Provider · Formatters (number, date, bytes, relative
time) · Hotkeys · Highlight · Download Trigger · Drag and Drop (RAC) · Virtualizer
(RAC, Reka) · Frame · Client Only · Environment (shadow root / iframe).

## Coverage per library

| Library | Components | Frameworks |
|---|---|---|
| Reka UI | ~60 | Vue |
| Ark UI | ~52 | React, Vue, Solid, Svelte |
| React Aria Components | ~51 | React |
| Kobalte | ~45 | Solid |
| Bits UI | ~41 | Svelte |
| Base UI | 37 | React |
| Radix Primitives | 30 | React |
| Ariakit | ~19 | React, Solid |
| Headless UI | 16 | React, Vue |
