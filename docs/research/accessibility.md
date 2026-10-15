# Accessibility foundations — research

Status: in progress · Wave: all (cross-cutting; binds every component)

Accessibility rules that hold for **every** rind-ui component, whatever its pattern. Component
notes (`dialog.md`, `select.md`, …) cite this file and only add what is pattern-specific.
Overlay mechanics (layer stack, focus trap, focus restore, `inert` outside, portals) are decided
in [overlay-infrastructure.md](overlay-infrastructure.md) and only summarised here;
screen-reader test matrices go in `assistive-tech-and-a11y-testing.md`, native
`<dialog>`/`popover`/invokers in `native-platform.md`.

Each section gives **what the standard says**, **how the best libraries do it** (with source
files) and the **rind-ui decision**. The decisions map onto the layers in
[0002](../decisions/0002-architecture.md): *machine* (state and events), *connect* (every
`aria-*` / `data-*`), `core/dom` (environment effects), *contract* (driver actions/queries),
*model invariants* ([0003](../decisions/0003-testing.md)).

Browser support figures come from `mdn/browser-compat-data` `main` (fetched 2026-10-14); spec
status from the W3C pages fetched the same day.

Sources read (local clones; paths relative to each repo):

| Library | Files |
|---|---|
| React Aria (`adobe/react-spectrum` @ `e04377c`, 2026-10-13) | `packages/react-aria/src/interactions/{usePress,useFocusVisible,useHover,useLongPress,textSelection,focusSafely}.ts`, `focus/{FocusScope.tsx,virtualFocus.ts}`, `utils/{useId,mergeProps,useLabels,useDescription,keyboard.tsx,isVirtualEvent,platform}.ts`, `ssr/SSRProvider.tsx`, `live-announcer/LiveAnnouncer.tsx`, `visually-hidden/VisuallyHidden.tsx`, `label/{useLabel,useField}.ts`, `i18n/{utils,I18nProvider,useDefaultLocale}.ts(x)`, `selection/{useTypeSelect,useSelectableCollection}.ts`, `combobox/useComboBox.ts`, `disclosure/useDisclosure.ts`, `overlays/ariaHideOutside.ts`, `intl/**` (the `@react-aria/*` folders in the shared clone are re-export shims; the real source lives in `packages/react-aria`, sparse-cloned separately) |
| Zag | `packages/utilities/{live-region,focus-visible,dom-query,i18n-utils}/src/*`, `machines/{combobox,tags-input,dialog}/src/*` |
| Radix | `packages/react/{visually-hidden,id,announce,roving-focus,toast,dialog,direction}/src/*` |
| Base UI | `packages/utils/src/{visuallyHidden,useId,inertValue}.ts`, `packages/react/src/internals/useInitialLiveRegionTextMutation.ts`, `utils/useFocusableWhenDisabled.ts`, `collapsible/panel/useCollapsiblePanel.ts` |
| Ariakit | `packages/ariakit-react-components/src/{focusable/focusable.tsx,composite/composite.tsx,composite/composite-item.tsx}`, `ariakit-components/src/composite/composite-store.ts` |
| Headless UI | `packages/@headlessui-react/src/internal/hidden.tsx` |
| Bits UI / Reka | `bits/{accordion,collapsible}/*.svelte.ts`, `Collapsible/CollapsibleContent.vue` (`hidden="until-found"`) |
| Reado | `src/components/molecules/Announcer.tsx`, `src/lib/a11y.ts` (the Announcer we extract) |

---

## 1. Standards

### 1.1 WCAG 2.2 — what binds a component library

**What the standard says.** WCAG 2.2 (Recommendation, 2023; 4.1.1 Parsing removed) is the
conformance target. A headless library cannot make a page conformant, but it can make
conformance *impossible* — so the criteria below are ones where behaviour (ours) decides the
outcome, not styling (the consumer's).

| SC | Level | What it means for rind-ui | Owner |
|---|---|---|---|
| 1.3.1 Info and Relationships | A | Roles, `aria-labelledby`, groups, `aria-describedby` come from connect | connect |
| 1.3.2 Meaningful Sequence | A | Portalled content must still be reachable in a sensible order (focus moves into it; `aria-controls`/`aria-owns` link it) | dom |
| 1.4.1 Use of Color | A | State is always also an attribute (`aria-checked`, `aria-invalid`), never only a colour | connect |
| 1.4.10 Reflow | AA | Popovers fit a 320 CSS px viewport (collision + size middleware, no fixed widths in theme) | dom/theme |
| 1.4.11 Non-text Contrast | AA | Focus rings, borders of controls, thumbs ≥ 3:1 | theme |
| 1.4.12 Text Spacing | AA | No measured heights frozen in JS; collapsible heights re-measure | dom |
| 1.4.13 Content on Hover or Focus | AA | Tooltip/Hover Card: dismissible (Esc) without moving pointer, hoverable, persistent | machine |
| 2.1.1 Keyboard / 2.1.2 No Keyboard Trap | A | Every pointer action has a keyboard path; traps only in modal layers, always escapable | machine |
| 2.1.4 Character Key Shortcuts | A | Single-key typeahead only while the widget has focus | machine |
| 2.2.1 Timing Adjustable / 2.2.2 Pause, Stop, Hide | A | Toast timers pause on hover/focus/window blur; Carousel/Marquee autoplay pausable | machine |
| 2.4.3 Focus Order | A | Open moves focus in, close restores it | dom |
| 2.4.7 Focus Visible | AA | `data-focus-visible` on every focusable part, including virtually focused items | connect |
| 2.4.11 Focus Not Obscured (Min) | AA | Focused items scroll into view clear of sticky UI (`scroll-padding`); toasts don't cover focus | dom/theme |
| 2.4.13 Focus Appearance | AAA | Theme target: 2 CSS px perimeter, 3:1 change | theme |
| 2.5.1 Pointer Gestures | A | Swipe/pinch always has a single-pointer alternative (Drawer close button, Carousel buttons) | machine |
| 2.5.2 Pointer Cancellation | A | Activation on *up*, cancel by moving out (press semantics, §5) | dom |
| 2.5.3 Label in Name | A | Accessible name contains the visible label text (no `aria-label` that replaces a visible label) | connect |
| 2.5.7 Dragging Movements | AA | Slider, Splitter, Color Area, DnD, Image Cropper: click/keyboard alternative | machine |
| 2.5.8 Target Size (Min) | AA | 24×24 CSS px or spacing — theme, plus hit-area parts | theme |
| 3.2.1 / 3.2.2 On Focus / On Input | A | Arrowing a Select/Tabs does not navigate or submit | machine |
| 3.3.1 / 3.3.2 Error Identification, Labels | A | Field: Label, Description, ErrorMessage parts wired by connect | connect |
| 3.3.8 Accessible Authentication (Min) | AA | Pin Input / Password Input accept paste and password managers (`autocomplete="one-time-code"`) | machine |
| 4.1.2 Name, Role, Value | A | The core of connect | connect |
| 4.1.3 Status Messages | AA | Announcer (§7), Toast as `status` | dom |

4.1.1 is gone, but duplicate ids still break every IDREF — our ids stay unique (§3).

### 1.2 WCAG 3 — what to anticipate

**What the standard says.** WCAG 3.0 is a Working Draft (latest [10 Sep
2026](https://www.w3.org/TR/2026/WD-wcag-3.0-20260910/)); a Recommendation is not expected
before 2028. Requirements carry "Developing" status and the contrast algorithm is still
undecided.

Cheap to anticipate now: **separate keyboard and pointer focus appearance** (2.3.1/2.3.2 — our
`data-focus` vs `data-focus-visible` split covers it); **"changes to elements notified" /
"submission status notified"** (2.3.5, 2.5.2, 2.12.5 — Tool Approval, Prompt Input status go
through the Announcer); **errors persistent, associated, collocated** (2.5.1); **"no visual
motion"** (2.6.1).

**Decision.** Target WCAG 2.2 AA; design the attribute contract so WCAG 3's keyboard/pointer
focus split and element-change notifications need no API break.

### 1.3 WAI-ARIA 1.2 and 1.3

**What the standard says.** ARIA 1.2 is the Recommendation. ARIA 1.3 is a Working Draft ([4 Jun
2026](https://www.w3.org/TR/2026/WD-wai-aria-1.3-20260604/); Editor's Draft 12 Oct 2026). New
since 1.2:

| Feature | Status | Browser reflection (BCD) | rind-ui use |
|---|---|---|---|
| `aria-description` | 1.3 | `ariaDescription`: Chrome 83, Firefox 119, Safari 17.4 | Not emitted by default: invisible hints use `aria-describedby` → hidden node (React Aria `useDescription`), which page translation also reaches |
| `aria-braillelabel`, `aria-brailleroledescription` | 1.3 | Chrome 107, Firefox 125, Safari 18 | Pass-through only; never set by default (prohibited wherever `aria-label` is) |
| roles `suggestion`, `comment`, `mark` | 1.3 | — | `mark` for typeahead/Highlight matches; `suggestion` for AI "proposed, not confirmed" edits (see 0001) — behind a flag until AT support is verified |
| `aria-errormessage` is now an **ID reference list** and must be hidden/removed when not pertinent | 1.3 | — | See §2 |
| `aria-details` takes multiple IDrefs | 1.3 | — | Citation → source card |
| `image` role as synonym of `img`; `none` preferred over `presentation` | 1.3 | — | Emit `img`, `none` |
| ARIA element reflection (`ariaLabelledByElements`, `ariaActiveDescendantElement`) | 1.3 | Chrome 135, Firefox 136, Safari 16.4 | Only to cross shadow roots (§3) |
| `ARIANotifyMixin` — `document.ariaNotify()` / `element.ariaNotify()` | 1.3 §10.2 | Chrome 141, Firefox 150, Safari 27 (BCD: not experimental) | Optional Announcer backend (§7) |

`aria-actions` is **not** in the current Editor's Draft; do not anticipate it.

### 1.4 HTML-AAM and ARIA in HTML

**What the standard says.** [ARIA in HTML](https://www.w3.org/TR/html-aria/) is the authoring
conformance spec; [HTML-AAM](https://www.w3.org/TR/html-aam-1.0/) says what native elements
already map to. The rules that bite component authors:

1. **First rule of ARIA**: use the native element when it has the semantics; do not repeat the
   implicit role (`<button role="button">`).
2. No interactive content inside interactive content (button in button, link in option).
3. `aria-hidden="true"` never on a focusable element or `<body>`.
4. `aria-label`/`aria-labelledby` are **prohibited** on `generic` (`div`/`span`), `none`,
   `code`, `caption`, `paragraph`… — ignored by AT, flagged by axe.
5. Attributes duplicating native state (`aria-disabled` on a disabled `<button>`) are redundant.

**How libraries do it.** Base UI `utils/useFocusableWhenDisabled.ts`: native button →
`disabled`, unless `focusableWhenDisabled` → `aria-disabled` + all keys but Tab swallowed;
non-native → `aria-disabled` + `tabIndex=-1`. Ariakit: `accessibleWhenDisabled`
(`focusable/focusable.tsx`).

**Decision.**
- Each part declares its **default element** and connect emits only the attributes that element
  lacks natively. When `asChild`/`render` swaps the element, connect receives the rendered tag
  (from the ref, through `core/dom`) and adds the role/keyboard handling the native element
  would have provided (`role="button"`, `tabIndex=0`, Enter/Space via press, §5). This keeps
  Liskov: substituting the element never changes behaviour.
- Disabled: native `disabled` by default; `focusableWhenDisabled` switches to
  `aria-disabled="true"` and the machine ignores activation events. Menu items, tabs and options
  are always `aria-disabled` (they must stay discoverable in a composite).
- Connect never puts `aria-label`/`aria-labelledby` on a part whose role is `generic`/`none` —
  enforced by a type: parts have a `role` in their static definition and labelling props are
  only accepted where the role is nameable.

### 1.5 APG patterns → rind-ui components

All 30 [APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) (list fetched 2026-10-14). Each
component research note copies the pattern's keyboard table.

| APG pattern | rind-ui components |
|---|---|
| [Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/) | Accordion |
| [Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) | Alert, Toast (as `status`, see §7) |
| [Alert and Message Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/) | Alert Dialog, Tool Approval |
| [Breadcrumb](https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/) | Breadcrumbs |
| [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Button, Toggle (`aria-pressed`), Clipboard trigger, Message Actions, Suggestions |
| [Carousel](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) | Carousel, Marquee (pause control) |
| [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/) | Checkbox, Checkbox Group |
| [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) | Combobox, Autocomplete, Command, Tags Input, Mentions / Slash Commands, Date Picker (dialog popup) |
| [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Dialog, Drawer, Popover (modal mode), Tour step |
| [Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Collapsible, Reasoning, Navigation Menu triggers, Password Input toggle |
| [Feed](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) | Message Thread (candidate; see §7.5) |
| [Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Calendar, Range Calendar, Grid List, Table (interactive), Color Swatch Picker, Tag Group (Layout grid (APG Pill List example)) |
| [Landmarks](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/) | Navigation Menu (`nav`), Toast region (`region` + label), Table of Contents |
| [Link](https://www.w3.org/WAI/ARIA/apg/patterns/link/) | Link, Breadcrumb items, Pagination links, Citation |
| [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) | Listbox, Select popup, Combobox popup |
| [Menu and Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) | Menu, Context Menu, Menubar |
| [Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) | Menu trigger |
| [Meter](https://www.w3.org/WAI/ARIA/apg/patterns/meter/) | Meter, Context Meter |
| [Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) | Radio Group, Segmented Control, Rating (radio variant) |
| [Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) | Slider, Angle Slider, Color Slider |
| [Slider (Multi-Thumb)](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/) | Range Slider, Color Area (two sliders) |
| [Spinbutton](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/) | Number Input, Date Field / Time Field segments |
| [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) | Switch |
| [Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/) | Table (static) |
| [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | Tabs, Steps (when interactive) |
| [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) | Toolbar, Toggle Group, Message Actions row |
| [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) | Tooltip (Hover Card is *not* a tooltip: it is a non-modal dialog) |
| [Tree View](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Tree View, JSON Tree View |
| [Treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Table with expandable rows |
| [Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) | Splitter |

No APG pattern (closest composition noted in each research note): Pin Input (group of
textboxes), Color Picker/Wheel (slider), File Upload (button + drop zone), Signature Pad / Image
Cropper (application + keyboard alternative), Scroll Area (native scroll, must stay
keyboard-scrollable), Progress (`progressbar`), QR Code / Avatar / Image (`img` + name), Prompt
Input (textbox), Streaming Message / Agent Presence (status + announcer), Tour (non-modal
dialog).

---

## 2. Accessible name and description

**What the standard says.** [accname 1.2](https://www.w3.org/TR/accname-1.2/): the name is
computed in this order — `aria-labelledby` (each referenced node's text, *even if the node is
hidden*, not recursing into its own labelledby), `aria-label`, native label (`<label for>`,
`<legend>`, `<caption>`, `alt`), name-from-content for roles that allow it (button, link,
option, tab, menuitem…), `title`. Descriptions: `aria-describedby`, then `aria-description`,
then `title` if unused. `aria-labelledby` may self-reference (`aria-labelledby="self other"`) to
concatenate. A name is **required** for dialog, alertdialog, listbox, grid, tree, tablist (via
tab), slider, progressbar, textbox-like widgets, and `region` only counts as a landmark when
named.

**How libraries do it.**
- React Aria `label/useLabel.ts` puts the label id first in `aria-labelledby` and warns in dev
  when no name source exists; `utils/useLabels.ts` folds a coexisting `aria-label` in by
  self-referencing the element's id (else it is ignored).
- React Aria `label/useField.ts` puts description **and error** into `aria-describedby`:
  "`aria-errormessage` is unsupported using VoiceOver or NVDA" (#1346).
  `utils/useDescription.ts`: invisible descriptions (long-press hint) are one shared,
  ref-counted `display:none` node per string.
- Radix `dialog/src/dialog.tsx`: `Title` registers (`titleCount`), and `aria-labelledby` is set
  **only while a Title is present** (multiple warn); React Aria's `useSlotId` (`utils/useId.ts`)
  checks `getElementById` after render. Both avoid **dangling IDREFs**, which yield an empty
  name.

**rind-ui decision.**
- **Labelling parts**: `Label`, `Title`, `Description`, `ErrorMessage`. Each registers with the
  machine (`PART.MOUNT`/`PART.UNMOUNT` carry its id); connect points `aria-labelledby`/
  `aria-describedby` only at **currently rendered** parts.
- **Precedence**: native `<label for>` when the control is labelable; otherwise a visible part
  via `aria-labelledby` (satisfies 2.5.3, translates with the page); `aria-label` only from a
  consumer prop for icon-only controls, folded with a Label part by self-reference.
- **Errors**: `aria-invalid="true"` + ErrorMessage id in `aria-describedby`; no
  `aria-errormessage` until VoiceOver/NVDA support is verified (Open questions).
- **Groups** (Radio/Checkbox Group, Date Field, Pin Input): `group`/`radiogroup` labelled by
  the Label; segments named from `messages` ("Month").
- **Missing name = dev error**: after mount, connect checks every part whose role requires a
  name (small accname subset in `core/dom`) and reports through the injected logger.

## 3. Ids and SSR stability

**What the standard says.** IDREF attributes need ids that are unique in the document (or in the
same shadow root: IDREFs do not cross shadow boundaries; element reflection does).

**How libraries do it.** React Aria (`ssr/SSRProvider.tsx`, `utils/useId.ts`), Radix
(`id/src/id.tsx`) and Base UI (`utils/src/useId.ts`) all use `React.useId` with pre-18 fallbacks
(React Aria's StrictMode fiber hack; Base UI's client-only counter). React Aria's `mergeIds`
(inside `mergeProps`) reconciles a consumer id with a generated one by re-rendering every hook
that held the losing id. Zag (`machines/dialog/src/dialog.dom.ts`) derives every part id from
one root id — `` ctx.ids?.content ?? `dialog:${ctx.id}:content` `` — and lets `ids` override.

**rind-ui decision.**
- Machines receive **one root id** from the adapter (`React.useId()`; React ≥ 18 only). Connect
  derives part ids `${scope}-${rootId}-${part}` and `${scope}-${rootId}-${part}-${itemKey}`
  (hyphens, unlike Zag's colons, keep them valid in selectors). Never parse React's id format.
- `ids` overrides any part (typed from part names); a consumer `id` on a part is fed back to the
  machine — no `mergeIds` re-render. Item ids come from collection keys (branded), never
  indexes, so `aria-activedescendant` survives reordering and virtualization.
- Deterministic ⇒ SSR-stable; every component has a hydration test with zero warnings.
- Shadow DOM: string IDREFs by default; when the target is in another root `core/dom` sets the
  reflected property (`ariaActiveDescendantElement`, `ariaLabelledByElements` — Baseline 2025).

## 4. Focus

### 4.1 Focus visible and interaction modality

**What the standard says.** 2.4.7 requires a visible indicator for keyboard focus. CSS
`:focus-visible` (Baseline: Chrome 86, Firefox 85, Safari 15.4) encodes a browser heuristic:
always on text inputs, on after keyboard, off after pointer, and inherits the last modality for
programmatic `focus()`.

**How libraries do it.** React Aria `interactions/useFocusVisible.ts` keeps a **global
modality** (`keyboard | pointer | virtual`) from capture listeners. A key counts only if
unmodified (no Meta/Ctrl, no Alt off-Mac, not a lone Shift/Control — those fire when switching
tabs). A **focus with no preceding key or pointer event** ⇒ `virtual` (screen-reader cursor, iOS
form prev/next), with window re-focus excluded (Safari double-fire, Firefox iframe workarounds).
It patches `HTMLElement.prototype.focus` so programmatic focus is not "virtual"; in text inputs
only Tab/Escape flip to visible; an `invalid` event that moved focus switches to keyboard.
`isFocusVisible()` is `modality !== 'pointer'`. Zag `utilities/focus-visible/src/index.ts` is a
declared port. Ariakit `focusable/focusable.tsx` writes `data-focus-visible` itself and keeps it
when focus moves between already-visible items.

**rind-ui decision.**
- `core/dom/modality.ts`: port of React Aria's tracker (per window, multi-document, SSR-safe),
  exposed as `Environment.modality()` + subscription. **No prototype patching**: our own focus
  moves go through `focusSafely()`, which marks them; a consumer's bare `el.focus()` counts as
  virtual and shows the ring (same as the native heuristic).
- Connect emits **`data-focus`** and **`data-focus-visible`** (modality ≠ pointer, text-input
  rule) on every focusable part — and on the **virtually focused** item, where `:focus-visible`
  cannot apply; that is why we compute it.
- Modality also drives `focusSafely` (wait for transitions when virtual — React Aria
  `interactions/focusSafely.ts`, avoids iOS VoiceOver scroll jumps), highlighting the first item
  only on keyboard open, and no tooltip on focus after a pointer press.

### 4.2 Roving tabindex vs `aria-activedescendant`

**What the standard says.** APG ["Managing focus in
composites"](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_general_within):
a composite is one Tab stop; inside it either move DOM focus (roving tabindex: the active item
`tabIndex=0`, others `-1`) or keep DOM focus on the container and point `aria-activedescendant`
at the active item (which must be a descendant or owned/controlled element with an id).

**How libraries do it.**
- Radix `roving-focus/src/roving-focus-group.tsx`: roving for Tabs, Toolbar, Radio, Toggle
  Group, Menu. Ariakit `composite-store.ts`: one Composite with a `virtualFocus` switch, the
  active item carries `data-active-item` either way. React Aria `focus/virtualFocus.ts`
  dispatches synthetic `focus/blur` on virtually focused items so item handlers work unchanged.
- VoiceOver does not reliably speak `aria-activedescendant` changes (macOS fixed in Sequoia per
  WebKit 167671; iOS inconsistent). React Aria (`combobox/useComboBox.ts`, `isAppleDevice()`)
  and Zag (`combobox.machine.ts` `announceHighlightedItem`, `isApple()`) **announce the
  highlighted option via a live region on Apple only**; React Aria also `ariaHideOutside([input,
  popover])` while open.

**rind-ui decision.**
- **Roving tabindex is the default** wherever focus can live on items: Tabs, Toolbar, Radio
  Group, Toggle Group, Segmented Control, Menu, Menubar, standalone Listbox, Tree, Grid List,
  Calendar, Table, Tag Group. Pagination is not a composite: it is a `nav` landmark of links
  in plain Tab order (APG link pattern; decided in add-pagination design §5).
- **`aria-activedescendant` only where DOM focus must stay in a text field**: Combobox,
  Autocomplete, Command, Tags Input, Mentions. One composite module in `core/collection` with
  `focusStrategy: "roving" | "active-descendant"`; the item always gets `data-highlighted`.
- On Apple platforms (`Environment.platform`) active-descendant machines emit `announce`
  effects for highlight, section entry, result count and selection; never elsewhere.
- The active id must be rendered when set (virtualizers keep the active item mounted). With no
  active item, the roving stop is the selected or first enabled item; disabled items stay
  focusable only with `focusableWhenDisabled` (APG recommends it for menus/listboxes).

### 4.3 Focus restore, portals, `inert`

Decided in [overlay-infrastructure.md §3–4, §7](overlay-infrastructure.md): restore to the
captured trigger if connected and not inert, else to the latest connected history entry; modal
outside made `inert` (Baseline: Chrome 102, Firefox 112, Safari 15.5), never `aria-hidden`
alone; portals keep the logical parent for the layer stack. Additions that apply beyond
overlays:

- **Focus loss on removal**: when the focused item is removed (Tag delete, Tree collapse,
  filter), focus moves to the next, else previous, else the container — never `<body>` (React
  Aria `selection/useSelectableCollection.ts` falls back to the collection).
- **Portalled non-modal popups** (Hover Card, Popover, Citation) stay in a sensible order
  (1.3.2): focus guards return Tab to the element after the trigger (Base UI
  `utils/FocusGuard.tsx`, Radix `focus-guards`).
- The live announcer is exempt from `inert` (overlay note's keep-visible list).

## 5. Interactions: press, hover, long press

**What the standard says.** 2.5.2 Pointer Cancellation: activation on the up-event, abortable by
moving away. HTML's activation behaviour: buttons activate on Enter (keydown) and Space (keyup);
links only on Enter; checkboxes toggle on Space only. 2.5.1 / 2.5.7: gestures and drags need
single-pointer alternatives.

**How React Aria does it** (`interactions/usePress.ts`, 1,198 lines — the reference every other
library approximates). One abstraction for mouse, touch, pen, keyboard and virtual; events carry
`pointerType` and modifiers.
- **Virtual clicks** (`utils/isVirtualEvent.ts`): `detail === 0` without pointerType
  (keyboard/AT `click()`), `pointerType === ''` (JAWS/NVDA+Firefox), TalkBack cases; zero-size
  pointer events are iOS VoiceOver (WebKit 222627, 223202) — ignored, the following `click`
  presses as if from a keyboard.
- **onPress fires from `click`, not `pointerup`** (DOM mutated between the two breaks browsers,
  #1513), with a ≥ 32 ms timeout fallback because iOS/Android fire no `click` after a long
  press.
- **Keyboard** (`isValidKeyboardEvent`): Enter/Space, not in text inputs; links Enter only;
  checkbox/radio Space only; **repeats ignored**; keyup captured on the document; **macOS ⌘
  bug** — no keyup for keys released while ⌘ is held (Chromium 1393524, WebKit 55291, Mozilla
  1299553), so keyups are synthesised when Meta is released.
- **Touch**: releases implicit pointer capture on pointerdown so `pointerleave` fires (cancel on
  exit); hit-tests the contact rectangle (`width/height`, `radiusX/Y`); injects `touch-action:
  pan-x pan-y pinch-zoom` (not `manipulation`, which stops `pointercancel` on scroll in Safari,
  WebKit 240917) in an anonymous `@layer` with the CSP nonce, to kill the double-tap delay.
- **Text selection** (`textSelection.ts`): `user-select:none` on the target during a press; on
  iOS on the whole document, restored 300 ms after release, via a global 3-state machine to
  avoid races.
- **Hover** (`useHover.ts`): never from touch; ignores iOS's emulated `pointerType="mouse"`
  enter after a touch (WebKit 214609).
- **Long press** (`useLongPress.ts`): 500 ms; suppresses the touch context menu and the trailing
  click; `accessibilityDescription` attached via `useDescription`.
- `preventFocusOnPress` for controls that must not steal focus (steppers).

**Other libraries.** Zag `dom-query/src/{press,event}.ts` covers part of this
(`isKeyboardClick`, `isContextMenuEvent` = right button or Mac Ctrl+click); Radix and Base UI
mostly rely on native `click` + per-component handlers; Base UI `internals/usePressAndHold.ts`
for steppers.

**rind-ui decision.**
- `core/dom/press.ts`: a framework-free port of usePress semantics producing machine events
  `PRESS.START | PRESS.END | PRESS.UP | PRESS | PRESS.CANCEL` with `{ pointerType, shiftKey,
  ctrlKey, metaKey, altKey }`. Machines never see raw `click`/`pointerdown`. Connect spreads
  press handlers onto every pressable part and emits `data-pressed`.
- Kept from React Aria, each with a test: virtual clicks, press from `click` with the ≥ 32 ms
  fallback, per-element Enter/Space rules, repeats ignored, macOS ⌘ keyup synthesis, touch
  capture release + contact-rect hit-test, `touch-action` injected once (CSP nonce from
  `Environment`), iOS text-selection state machine, `preventFocusOnPress`.
- **Hover** (`core/dom/hover.ts`): `data-hover` only for `mouse`/`pen`; Tooltip, Hover Card and
  submenus never open from touch hover (Tooltip text must also be in the trigger's
  name/description, per APG).
- **Long press** (`core/dom/long-press.ts`, 500 ms, Scheduler) always has a keyboard twin in the
  machine (Shift+F10 / ContextMenu key; Alt+ArrowDown) and a hint in `aria-describedby` (§9
  strings).
- **Drags** (Slider, Splitter, Color Area, Signature Pad, Cropper, DnD): `setPointerCapture` on
  the drag surface; `pointercancel`/`lostpointercapture` end it; 2.5.7 alternative always
  present (track click, arrow keys).

## 6. Keyboard

**What the standard says.** APG [Developing a Keyboard
Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/): Tab moves between
widgets, arrows within; Home/End to ends; typeahead in lists, menus, trees; Escape closes the
innermost layer; in RTL, Left/Right are **mirrored for horizontal navigation** (APG notes this
explicitly for tabs, toolbars, sliders, menubars, trees). 2.1.4: single-character shortcuts only
when the component has focus or can be remapped/disabled.

**How libraries do it.**
- RTL: Zag `dom-query/src/event.ts` `getEventKey(e, { dir, orientation })` swaps Left/Right only
  for `rtl` + horizontal; Radix `roving-focus` `getDirectionAwareKey`; React Aria
  `selection/ListKeyboardDelegate.ts`.
- Platform modifier: React Aria `utils/keyboard.tsx` `isCtrlKeyPressed = isMac() ? metaKey :
  ctrlKey` (additive select, ⌘/Ctrl+Home/End/A).
- Typeahead: React Aria `selection/useTypeSelect.ts` — 1000 ms, search from the item after focus
  then wrap, Space inside a search is a character. Radix 1000 ms; Zag
  `dom-query/src/typeahead.ts` **350 ms**, repeated keys cycle (`isRepeated`).
- IME: Zag `isComposingEvent = isComposing || keyCode === 229`. Shortcuts: Radix Toast matches
  `event.code` because Mac `Ctrl+Alt+T` yields `key === "†"`.

**rind-ui decision.**
- **Key normalisation** in `core/dom/keyboard.ts`: one function maps a native event to a machine
  event using `{ dir, orientation, platform }`; machines are written in **logical** keys
  (`NEXT`, `PREV`, `FIRST`, `LAST`, `PAGE_NEXT`, `EXPAND`, `COLLAPSE`), so RTL is decided once
  and testable without a DOM. Flip rule: only horizontal arrows, only in RTL; vertical, Home/End
  and PageUp/Down never flip; Slider's "increase" follows the visual direction (Right increases
  in LTR, Left in RTL), Up always increases.
- `mod` = ⌘ on Apple platforms, Ctrl elsewhere, decided by `Environment.platform` (injected;
  tests run both). Mac Ctrl+click = context menu.
- **Typeahead**: `core/collection/typeahead.ts`, shared by Select, Menu, Listbox, Tree,
  Radio-like lists, Menubar. Defaults: 1000 ms (React Aria/Radix; 350 ms is too short for
  screen-reader and motor-impaired users), cycling on a repeated single character (Zag), Space
  joins an in-progress search (React Aria), ignore events with Ctrl/Meta/Alt, ignore during IME
  composition, match on the item's `textValue` with locale-aware, accent-insensitive comparison
  (`Intl.Collator(locale, { usage: "search", sensitivity: "base" })`).
- **IME is a machine guard**, not an adapter detail: every key handler that acts on
  Enter/Escape/arrows/typeahead/delimiters (Prompt Input submit, Tags Input delimiter, Combobox
  Enter, Pin Input) checks `isComposing || keyCode === 229`, and the machine tracks
  `compositionstart/end` so the Enter that commits a composition is not treated as submit
  (Safari delivers it after `compositionend`).
- Hotkeys match on `key` for printable characters with `code` fallback when Alt (Option) changed
  the character; shortcuts are scoped to focus unless the consumer registers them globally
  (2.1.4).
- Every component's research note lists its APG keyboard table; the contract exposes
  `press(key)` and model tests generate those transitions.

## 7. Live regions and announcements

### 7.1 What the standard says

[ARIA live regions](https://www.w3.org/TR/wai-aria-1.2/#aria-live): AT speaks **changes** to a
region's content; `polite` waits for idle, `assertive` may interrupt; `role="status"` ⇒ polite +
atomic, `role="alert"` ⇒ assertive + atomic, `role="log"` ⇒ polite, additions. ARIA 1.3 permits
UAs to ignore user-triggered changes inside live regions. What actually happens in browsers:

- **The region must exist (and be in the accessibility tree) before the change.** A region
  inserted already containing text is often not announced; Safari needs extra time after
  insertion.
- **Identical repeated messages are dropped**: re-setting the same text often produces no
  accessible change (the text node's value is equal, or the browser/AT diffs the region's text
  and sees nothing new; some AT also suppresses a repeat within a short window). A "Copied"
  after "Copied" is silent.
- `display:none`, `visibility:hidden`, `aria-hidden`, `inert` ancestors silence a region.
  Content removed from a region is not spoken (`aria-relevant` "removals" is poorly supported
  and discouraged).
- Alerts from a background tab can be spoken to a user working elsewhere.
- Assertive interrupts the user's current speech — reserve it for errors.

### 7.2 How libraries do it

- **React Aria** `live-announcer/LiveAnnouncer.tsx`: vanilla-DOM singleton
  (`data-live-announcer`) with two `role="log" aria-relevant="additions"` regions; **each
  announcement is a new child node** (repeats are new additions), removed after 7 s; the first
  message waits 100 ms after the regions are created ("Safari won't announce the message if it's
  added too quickly"); can announce `{ 'aria-labelledby': id }` via a `role="img"` node.
- **Zag** `live-region/src/index.ts`: removes the old region and creates a fresh `status|alert`
  span per message, text set after `delay` — repeat-safe but breaks "exists first".
- **Radix** `announce/src/announce.tsx` **mutes regions while `document.hidden`**; Toast is
  always `role="status"` "to avoid stuttering issues with role=alert", text rendered **in the
  next frame** (NVDA), removed after 1 s.
- **Base UI** `internals/useInitialLiveRegionTextMutation.ts`: appends U+2060 to a region that
  mounted with text, reverts after 200 ms, so VoiceOver notices it.
- **Reado** `src/lib/a11y.ts` + `Announcer.tsx`: two regions, message keyed by a nonce so the
  span remounts; announcing gated on a user setting.

### 7.3 `ariaNotify`

Real and shipped: `document.ariaNotify(text, { priority: "normal" | "high" })` and
`element.ariaNotify` (ARIA 1.3 `ARIANotifyMixin`). BCD: Chrome/Edge 141, Firefox 150, Safari 27
— MDN marks it Baseline 2026 "newly available". Caveats from BCD/MDN: on macOS VoiceOver drops
an announcement that coincides with another accessibility event (all browsers); on ChromeOS it
is exposed but never spoken; a Permissions-Policy `aria-notify` block fails silently;
`aria-live` announcements take priority; often only the latest of several calls is spoken. No
library ships it yet. The language is taken from the element's `lang`.

### 7.4 rind-ui decision

- **`Announcer` is an injected abstraction** (CLAUDE.md lists it): machines emit `announce({
  message, priority: "polite" | "assertive", key? })` effects; they never touch the DOM. This is
  what lets the contract read `announcements` and the model test assert counts (0003).
- **Default implementation** `core/dom/live-announcer.ts`: React Aria's design — a singleton per
  document with two `log` regions created **eagerly when the first announcing component mounts**
  (not on first message), so the "exists first" rule holds without the 100 ms first-message
  delay; each message is a new child node (repeat-safe), removed after 7 s (Scheduler-injected);
  muted while `document.hidden` (Radix); `data-live-announcer` so `inertOutside` exempts it.
  Polite by default; assertive only for errors and failures.
- **De-duplication is ours, explicit**: an optional `key` coalesces — a new message with the
  same key within the polite queue replaces the pending one (result counts while typing: only
  the last "12 results" is spoken), debounced through the Scheduler (default 500 ms for counts).
- **`ariaNotify` backend** behind the same interface, opt-in (`announcer: "aria-notify"`),
  feature-detected with live-region fallback. Not default until the macOS VoiceOver drop and
  ChromeOS silence are fixed — Open question to re-check each release.
- **Component-owned regions** stay where the pattern requires them: Toast viewport items are
  `role="status"` (Radix's choice, alert for `type: "error"` only if the consumer asks), Field
  error messages are *not* live (focus-on-submit + describedby carries them), Progress/Meter are
  not live.
- **Locale**: announcer nodes get `lang` from the component's locale so speech uses the right
  voice.

### 7.5 Streaming text (AI primitives)

A streaming message inside a live region is announced once per chunk — or re-read from the start
for `aria-atomic` — which floods the user (0001 calls this "live-region flooding"). Decision:

- The Message Thread is **not** a live region (`role="log"` would speak every token). Each
  message has `aria-busy="true"` while streaming (AT may defer reading busy content) and
  `data-state="streaming"`.
- Streaming Message announces through the Announcer: **once on completion** by default (0003
  invariant: *exactly one announcement per completed message*), or in **sentence-sized chunks**
  (`announce: "sentences"`) flushed on sentence boundary (`Intl.Segmenter` with `granularity:
  "sentence"`) or every N ms (default 2 s), polite, keyed per message so a backlog collapses.
- Status changes are short separate announcements ("Assistant is responding", tool "Running" →
  "Done"/"Failed", assertive only for failure); Agent Presence announces state, never audio
  level. The full text is always in the DOM for virtual-cursor reading.

## 8. Visual preferences and sizing

Headless means the consumer styles, but behaviour can still break these.

| Concern | Standard | What libraries do | rind-ui decision |
|---|---|---|---|
| Forced colors / Windows High Contrast | CSS `forced-colors: active` (Chrome 89, Firefox 89, Safari 16): UA replaces colours with system colours, drops `box-shadow` and background images | Ariakit UI styles and RAC Spectrum styles add `@media (forced-colors: active)` rules; headless cores do nothing | State must be visible without colour: every state is a `data-*`/`aria-*` attribute so the theme can add `outline`, `border`, `forced-color-adjust`, `Highlight`/`SelectedItem` system colours. Theme ships focus rings as `outline` (transparent outline survives forced colors), never `box-shadow` alone; checkbox/radio indicators are real SVG/`currentColor`, not backgrounds. A Storybook global toggles forced-colors emulation (Playwright `forcedColors: "active"`). |
| `prefers-contrast` | Chrome 96, Firefox 101, Safari 14.1 | — | Theme only (thicker borders). No behaviour. |
| `prefers-reduced-motion` | 2.3.3 (AAA), WCAG 3 "No visual motion" | Base UI `useCollapsiblePanel.ts` neutralises motion for `beforematch` reveals; presence waits on `getAnimations()` | Presence must complete with zero animations (it does — it waits on running animations only). **JS-driven motion checks `Environment.reducedMotion()`**: `scrollIntoView({ behavior })`, Carousel autoplay (off), Marquee (paused, content static), stick-to-bottom smooth scroll (instant), drag inertia. Theme wraps transitions in the media query. |
| Target size | 2.5.8 (AA): 24×24 CSS px or 24 px spacing circle; 2.5.5 (AAA) 44×44 | — | Theme meets 24×24 for every pressable part. Small visual parts (slider thumb, splitter handle, tag remove) expose a CSS var `--rind-hit-area` and the theme expands the hit area with a pseudo-element, not by resizing. |
| Zoom / reflow | 1.4.4 Resize Text (200%), 1.4.10 Reflow (320 CSS px ≈ 400% of 1280) | floating-ui `size`/`flip`/`shift` | Positioner always applies `shift` + `size` (exposes `--available-width/height`); popups scroll internally instead of overflowing; Drawer/Dialog never set fixed px widths in theme; `visualViewport` used for on-screen keyboard (React Aria `utils/keyboard.tsx` tracks it). |
| Text spacing | 1.4.12 | — | No JS-frozen heights; collapsible/accordion expose `--height` measured on open **and** on resize (ResizeObserver), cleared to `auto` when idle. |
| Focus indicator | 2.4.7 (AA), 2.4.11 Not Obscured (AA), 2.4.13 Appearance (AAA: ≥ 2 CSS px perimeter-equivalent, 3:1 against unfocused) | — | Theme: 2 px outline + 2 px offset, 3:1. Behaviour: `focusSafely` scrolls the focused element into view using `scrollIntoView({ block: "nearest" })`, which respects the consumer's `scroll-padding` for sticky headers; toasts sit outside the focused content area by default. |
| Hover/focus content | 1.4.13 | Radix/Base tooltip: grace area, Esc | Tooltip/Hover Card: Esc dismisses without moving focus or pointer; pointer can travel onto the content (safe triangle); content persists until dismissed or trigger loses hover/focus. |

## 9. Internationalisation

**What the standard says.** HTML `dir` / `lang`; 3.1.1/3.1.2 Language of page/parts; ARIA:
`aria-valuetext` is the human value when `aria-valuenow` alone is not meaningful;
`aria-roledescription` and every author string must be localised; `aria-keyshortcuts` values are
not translated (ARIA 1.3 note).

**How libraries do it.**
- **Direction**: React Aria `i18n/utils.ts` `isRTL(locale)` — `Intl.Locale#getTextInfo()`
  (Chrome 130, Firefox 153, Safari 17), falling back to RTL script/language lists;
  `useDefaultLocale` tracks `languagechange`. Radix `direction` provider; Zag `dir` prop.
- **Who translates**: React Aria **ships translations** —
  `packages/react-aria/intl/<component>/<locale>.json`, 34 locales, 719 files, ICU
  (`"{optionCount, plural, one {# option} other {# options}} available."`). Zag ships **English
  defaults + a typed `translations` prop** in 25 machines (`tags-input.types.ts`:
  `deleteTagTriggerLabel: (value) => string`, `inputLabel(count)`). Radix ships no strings
  (consumer passes `label`).
- **Formatting**: React Aria `useNumberFormatter`/`useDateFormatter`/`useCollator`; Zag
  `i18n-utils`; dates via `@internationalized/date`.

**rind-ui decision.**
- **One `Environment.locale` + `dir`**, set by provider or per-component props; default locale
  `document.documentElement.lang || navigator.language`, default `dir` from the locale (React
  Aria's `isRTL`). Portalled content copies `dir`/`lang` from its logical parent (RTL breaking
  inside portals is a bug class every library has hit).
- **Strings**: each component exports a typed `messages` object with English defaults;
  parameterised messages are functions (`(n: number) => string`, plurals via
  `Intl.PluralRules`), no ICU parser in core. Override via a partial `messages` prop or the
  provider. Other locales: optional `@rind-ui/locales` package (Open question). Everything that
  reaches AT — default `aria-label`s (Close, Remove *tag*, Previous month), announcements, hints,
  segment names, `aria-roledescription`, `aria-valuetext` — goes through `messages`.
- **Numbers**: Slider, Progress, Meter, Number Input, Rating, Context Meter emit numeric
  `aria-valuenow/min/max` plus `aria-valuetext` from `Intl.NumberFormat(locale, formatOptions)`
  ("50%", "€1,200", "3 of 5 stars").
- **Dates**: `@internationalized/date` only. Calendar cells are labelled with the full localised
  date (+ selected/today/unavailable); the grid by the month heading; week start and segment
  order from the locale (`formatToParts`).
- Typeahead and the default Combobox filter use `Intl.Collator(locale, { sensitivity: "base" })`.

## 10. Hidden content

**What the standard says.** `display:none`, `visibility:hidden`, `hidden`, `inert`,
`aria-hidden="true"` remove content from the accessibility tree (inert also from interaction);
nodes referenced by `aria-labelledby`/`describedby` still contribute text when hidden.
`hidden="until-found"` (HTML) hides content but lets find-in-page and fragment navigation reveal
it, firing `beforematch` first.

**How libraries do it.**
- Visually hidden: React Aria `visually-hidden/VisuallyHidden.tsx` (`clip` + `clipPath:
  inset(50%)`, 1 px, `isFocusable` reveals on focus for skip links); Radix `visually-hidden.tsx`
  and Zag `dom-query/src/visually-hidden.ts` (Bootstrap's, no `clip-path`); Base UI
  `utils/src/visuallyHidden.ts` uses **`position: fixed; top:0; left:0`** for content (avoids
  scroll jumps inside scrollers) and `position: absolute` for hidden form inputs (validation
  bubble anchors near the control). Headless UI `internal/hidden.tsx`: `Focusable` / `Hidden`
  feature flags.
- `hidden="until-found"`: React Aria `disclosure/useDisclosure.ts` sets it via `setAttribute`
  and listens to `beforematch`; Base UI `collapsible/panel/useCollapsiblePanel.ts`
  (`hiddenUntilFound` prop; forces the attribute because React coerces `hidden` to a boolean,
  react#24740; skips the open animation for a `beforematch` reveal); Bits UI and Reka do the
  same. Support (BCD): Chrome 102, Firefox 148, Safari 26.2 (partial: does not scroll to the
  match, WebKit 304174).
- `inert` value: Base UI `utils/src/inertValue.ts` / React Aria `utils/inertValue.ts` — React <
  19 needs `inert=""` not `true`.

**rind-ui decision.**
- `core/dom/visually-hidden.ts`: Base UI's style (`clip-path: inset(50%)`, 1 px,
  `overflow:hidden`, `white-space:nowrap`, `position: fixed`, `absolute` variant for inputs)
  plus `clip: rect(0 0 0 0)`. Public `VisuallyHidden` part with `focusable` (reveal on focus).
  Form value sync uses `<input type="hidden">` where possible; when a real input is needed for
  native validation (required Select/Checkbox), it gets the input variant, `tabIndex=-1` and
  `aria-hidden="true"` (the visible control is the accessible one).
- **aria-hidden** (lint + invariant): never on a focusable element, an ancestor of focus, or
  `<body>`; decorative parts (Indicator, Arrow, Icon) get it only if they hold no name text;
  never `aria-hidden="false"` to "unhide"; hide interactive subtrees with `inert`.
- **Closed content**: unmounted or `hidden` (presence decides). Accordion and Collapsible accept
  `hiddenUntilFound`: content stays mounted, `beforematch` becomes `OPEN` with `reason:
  "find-in-page"` (a controlled consumer may refuse; we restore `until-found`), reveal skips
  the animation (Base UI).
- IDREF-referenced content may be hidden; name-from-content text (a Select's value) may not.

---

## Rules for every component

Testable statements. *[I]* generic model invariant checked after every transition in
`testMachine`; *[S]* static, unit or lint check; *[T]* theme/visual check.

**Semantics and names**
1. *[I]* Every element whose role requires a name has a non-empty accessible name.
2. *[I]* Every IDREF (`aria-labelledby/-describedby/-controls/-activedescendant/-owns/-details`,
   `for`) resolves to an element in the same document or root.
3. *[I]* All ids the component renders are unique; *[S]* they derive deterministically from the
   root id and part/item key, and SSR hydration produces no warnings.
4. *[S]* No part repeats its element's implicit role; no `aria-label(ledby)` on
   `generic`/`none`.
5. *[I]* When a visible Label/Title part is rendered, the accessible name contains its text.
6. *[I]* `aria-expanded/-selected/-checked/-pressed/-disabled/-invalid` match the machine state,
   and the matching `data-*` attribute agrees.
7. *[S]* Every AT-facing string comes from the component's `messages`.

**Focus**
8. *[I]* A composite is one Tab stop: roving → exactly one item has `tabIndex=0`;
   active-descendant → only the input/container is tabbable.
9. *[I]* `aria-activedescendant` is empty or points to a rendered element inside the controlled
   popup that carries `data-highlighted`.
10. *[I]* The focused element is never inside `aria-hidden="true"` or `inert`, and no focusable
    element is inside `aria-hidden="true"`.
11. *[I]* If focus was inside the component before a transition, afterwards it is inside the
    component or on its documented restore target — never `<body>`.
12. *[I]* After a pointer interaction no part has `data-focus-visible`; after keyboard
    navigation the focused (or highlighted) part has it.
13. *[I]* Closing a layer returns focus to its trigger when it is connected and not inert.

**Interaction and keyboard**
14. *[I]* Every pointer action in the contract has a keyboard twin; model tests run both.
15. *[I]* Activation happens on release; a press moved off the target first does not activate.
16. *[S]* Enter and Space activate button-like parts, links Enter only; key repeats do not
    activate twice.
17. *[I]* With `dir="rtl"` horizontal arrows produce the mirrored logical event; vertical
    arrows, Home/End and PageUp/Down do not change.
18. *[I]* Key events with `isComposing` or `keyCode 229` never submit, select, split or
    typeahead.
19. *[I]* Escape closes only the topmost layer; with nothing open it is a no-op.
20. *[S]* Hover-driven opening never triggers from `pointerType: "touch"`.
21. *[S]* Every drag has a non-drag alternative; every long press has a keyboard twin.
22. *[S]* Disabled parts ignore activation; `focusableWhenDisabled` keeps them reachable with
    `aria-disabled="true"`.

**Announcements**
23. *[I]* Announcements go only through the injected `Announcer`; components render no
    `aria-live` of their own except Toast (`status`) and Alert.
24. *[I]* A completed streamed message yields exactly one announcement (default mode); N
    identical `announce()` calls without a `key` yield N announcements.
25. *[S]* The announcer region exists before the first message, carries `lang`, and is exempt
    from `inert`/`aria-hidden`; assertive is used only for errors/failures.

**Visual, timing, hidden content**
26. *[S]* Presence completes with zero running animations; JS motion (smooth scroll, autoplay,
    inertia) is off when `Environment.reducedMotion()` is true.
27. *[I]* Auto-dismiss/auto-advance timers pause while hovered, focused or document hidden.
28. *[T]* Focus ring ≥ 2 px at 3:1, visible under `forced-colors: active`; pressable targets ≥
    24×24 CSS px; popups do not overflow a 320 px viewport.
29. *[S]* Visually hidden content uses `core/dom/visually-hidden`; nothing that must be
    announced or name-from-content is `display:none`.
30. *[I]* `hiddenUntilFound` content stays mounted while closed; `beforematch` opens it.

## Open questions

- **`aria-errormessage`**: ARIA 1.3 makes it an ID list and requires removal when not pertinent.
  Do VoiceOver (macOS/iOS) and NVDA support it in 2026? If yes, emit it *in addition to*
  `aria-describedby`, or instead (to avoid double reading)? Needs an AT test matrix run.
- **ariaNotify as default**: re-check the macOS VoiceOver drop (mdn/browser-compat-data#29610)
  and ChromeOS silence each quarter; switching the default changes the announcement timing model
  tests rely on.
  *Resolved in add-a11y-foundations:* stays opt-in behind the Announcer, re-checked quarterly.
- **Announcer inside modal dialogs**: with `aria-modal="true"` some Safari/VO versions ignore
  live regions outside the dialog even when not inert. Should the announcer relocate its regions
  into the topmost modal layer while one is open?
  *Resolved in add-a11y-foundations:* no relocation (moving a region makes it new to AT); regions stay out of `inert`
  via the keep-visible rule; a reproduced VO issue becomes a quirk entry.
- **Element reflection by default** (`ariaActiveDescendantElement`, …) instead of string IDREFs
  — removes the uniqueness requirement and works across shadow roots, but React/SSR can't
  serialise it.
- **Typeahead timeout**: 1000 ms (React Aria/Radix) vs 350 ms (Zag) — validate with Reado users;
  make it a provider-level setting?
  *Resolved in add-a11y-foundations:* 1000 ms default, configurable per component and via the provider.
- **Translations package**: seed `@rind-ui/locales` from React Aria's Apache-2.0 `intl/` JSON
  (attribution in NOTICE) or crowdsource? Who maintains 34 locales?
  *Resolved in add-a11y-foundations:* deferred; English defaults + typed overrides now, the package seeded
  from React Aria's JSON with NOTICE attribution when first needed.
- **Apple active-descendant announcements**: still right on macOS now that Sequoia speaks
  activedescendant changes (double speech)? React Aria and Zag still announce on all Apple
  platforms; needs device testing.
  *Resolved in add-a11y-foundations:* Apple-only, gated by the `vo-activedescendant` quirk entry; narrowing
  it after device testing changes only the quirk condition.
- **`suggestion` role** for AI "proposed" values: AT support unknown.
- **`hidden="until-found"` for Tabs panels / Navigation Menu** given Safari's partial support.
- **Feed vs log vs plain list** for Message Thread — settle in its note.
- The **AT test matrix** and what can be automated belong to
  `assistive-tech-and-a11y-testing.md`; native `<dialog>`/`popover`/`closedby` /`command`
  adoption to `native-platform.md` (both cross-cutting, see CLAUDE.md).
