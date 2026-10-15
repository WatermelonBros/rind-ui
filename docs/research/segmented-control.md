# Segmented Control — research

Status: done · Wave: 1 (used by Reado)

Two libraries ship it: Ark UI (Segment Group) and Kobalte (Segmented Control). Both build
it on their Radio Group. This note decides its semantics, then reuses
[radio-group.md](radio-group.md) (machine, keyboard, forms) and the selection indicator of
[tabs.md](tabs.md). Cross-cutting: [accessibility.md](accessibility.md),
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md),
[native-platform.md](native-platform.md), [collections.md](collections.md).

Sources read (local clones, 2026-10-14):

| Library | Files |
|---|---|
| Ark UI | `ark/packages/react/src/components/segment-group/{use-segment-group,segment-group.anatomy,segment-group-indicator,segment-group-item}.tsx` (on `@zag-js/radio-group`) |
| Zag | `zag/packages/machines/radio-group/src/radio-group.{machine,connect,dom}.ts` (indicator rect, `animateIndicator`) |
| Kobalte | `kobalte/packages/core/src/segmented-control/{segmented-control-root,segmented-control-indicator,segmented-control-item,segmented-control-item-input}.tsx` (on `RadioGroup`) |
| Also compared | React Aria `ToggleButtonGroup` + `SelectionIndicator`, Base UI `Tabs.Indicator`, Radix/Base UI Toggle Group (what people use instead) |

## Pattern

- No APG pattern named "segmented control". The two candidates:
  - [Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/): one of N, arrows move
    **and select**, "2 of 3" announced, no deselect. accessibility.md §1.5 already maps
    Segmented Control here.
  - Toggle Group (toolbar keys, `aria-pressed`, deselect): see [toggle-group.md](toggle-group.md).
  - [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) when the segments switch a
    panel (view switcher with associated content).
- Platform controls: Apple's segmented control (UIKit / AppKit) is a single-choice
  control; HIG uses it for both modes and views.

## How the others built it

### Ark UI (Segment Group)

- Source: `use-segment-group.ts` imports `@zag-js/radio-group`; `segment-group.anatomy.ts`
  renames the radio anatomy to `segment-group`.
- Parts: `Root`, `Label`, `Item`, `ItemText`, `ItemControl`, `ItemHiddenInput`,
  `Indicator`.
- State model: the radio-group machine (native hidden inputs, `value: string | null`,
  `orientation` default from the consumer), plus the indicator: `indicatorRect` from the
  checked item's `offsetLeft/Top/Width/Height`, a `ResizeObserver` on that item, and
  `animateIndicator` only when the value changed; CSS variables
  `--left/--top/--width/--height`, `--transition-property`.
- Problems: indicator 0×0 unless the consumer wires `width: var(--width)` (ARK#2080);
  not shown on mount (ARK#3703) or when rendered conditionally (ARK#3435); wrong inside a
  scrolled container (ZG#2810); no animation on the first change (ARK#1129); `data-scope`
  leaked as `radio-group` (ARK#2629); `readOnly` advertised but ignored (ZG#829); the
  hidden-input focus scroll of radio groups (ZG#3239).

### Kobalte (Segmented Control)

- Source: `segmented-control-root.tsx` wraps `RadioGroup` with `orientation:
  "horizontal"` and a context holding the selected item element;
  `segmented-control-indicator.tsx` computes `width`, `height` and a `translate(x, y)`
  transform from `offsetLeft/Top` minus the parent's padding, and sets
  `transition-duration: 0ms` plus `data-resizing` while the root's `ResizeObserver`
  fires, so resizes do not animate.
- Notes: native visually hidden inputs (`RadioGroup.ItemInput`), form reset re-selects the
  default (`createFormResetListener`).

### What people use when a library has none

- Radix / shadcn: Toggle Group `type="single"` (radio roles, move-only arrows,
  deselectable) or Tabs without panels.
- Base UI: Toggle Group (`aria-pressed`), or RadioGroup styled as segments (the outcome of
  BU#3525's migration report).
- React Aria: `ToggleButtonGroup` with `SelectionIndicator` (radio roles in single mode;
  SelectionIndicator jumps when scrolled, RA#9931; offset after SSR in StrictMode,
  RA#10570).

## Semantics decision (with AT evidence)

**Segmented Control is a radio group** — `radiogroup` + `radio` (`aria-checked`), arrows
move and select, one tab stop on the checked segment, no deselect, form participation.

1. Both shipping implementations are radio groups (Ark, Kobalte), and accessibility.md
   §1.5 already maps the component to the APG Radio Group.
2. Screen-reader users get "radio button, 2 of 3, checked" and know the choice is
   exclusive. With toggle buttons they do not (BU#3525: an app migrated single-choice
   toggle groups and had to move them to RadioGroup to recover exactly that; RX#951 and
   RX#3188 asked Radix for it; RX#3188's VoiceOver report: no position or count without
   radio roles).
3. Radio roles are only honest with radio keys: arrows that do not select contradict them
   (RX#4119). Toggle Group keeps toolbar keys and `aria-pressed`, so the two components do
   not overlap: exclusive and always one value → Segmented Control; pressable options,
   possibly none or several → Toggle Group; segments that show a panel → Tabs.
4. Automatic selection on arrows is harmless here: the change is local (no navigation,
   no submit). If a consumer needs "move, then confirm" (Kobalte#579), that is Tabs with
   manual activation or a Toggle Group, not a mode of this component.

## Accessibility

Everything in [radio-group.md](radio-group.md#accessibility) applies (focus does not
commit, four arrows, wrap, Space checks, tab stop rules, hidden inputs never exposed or
focused, required/invalid/read-only on the group). Additionally:

- **Name**: the root needs a name (Label part or `aria-label`); segments are named by
  their content. Icon-only segments need an `aria-label` per item (dev warning when an
  item has no text and no label).
- **Indicator is decorative**: `aria-hidden`, no role, never focusable, no text.
- **Forced colors**: the sliding background disappears under `forced-colors: active`; the
  theme adds a border/`Highlight` on `[data-state="checked"]` items so the selection never
  depends on the indicator.
- **Motion**: indicator transition from theme tokens, zero under `prefers-reduced-motion`;
  layout-driven moves never animate (`data-resizing`).
- **Target size**: each segment at least 24×24 CSS px.
- **RTL**: horizontal arrows mirrored; the indicator exposes `--rind-indicator-right` so
  RTL layouts can anchor on the right.

## Bug history

Few issues exist (two libraries; most Segment Group bugs are filed against Zag's radio
group). Method: `gh search issues` for "segment group", "segmented control", "segment
in:title" on chakra-ui/ark, chakra-ui/zag, kobaltedev/kobalte; plus the selection
indicator issues of React Aria and Base UI Tabs that apply to the same part.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Ark | [#2080](https://github.com/chakra-ui/ark/issues/2080) closed | Indicator renders 0×0 | Variables set, size left to the consumer | Docs | Theme sizes from the variables; docs example; dev warning not needed |
| Ark | [#3703](https://github.com/chakra-ui/ark/issues/3703) closed | Indicator not shown on mount until a re-render | Measured before the items' layout existed | Fixed | Measure after items register and on first layout (observer) |
| Ark | [#3435](https://github.com/chakra-ui/ark/issues/3435) closed | `defaultValue` not highlighted when mounted conditionally | Same timing | Fixed | Scenario: conditional mount shows the indicator |
| Ark | [#1129](https://github.com/chakra-ui/ark/issues/1129) closed | No animation on the first change | No previous rect yet, so no transition | Fixed (`animateIndicator`) | First measurement positions without transition; the first *change* animates |
| Zag | [#2810](https://github.com/chakra-ui/zag/issues/2810) closed | Indicator offset inside a scrolled container | Rect not relative to the root's scroll | Fixed | Layout offsets relative to the root, scroll-corrected |
| React Aria | [#9931](https://github.com/adobe/react-spectrum/issues/9931) open | Indicator jumps when the page is scrolled (Chrome) | Viewport-relative `getBoundingClientRect` | Open | Never client rects for the indicator |
| React Aria | [#10570](https://github.com/adobe/react-spectrum/issues/10570) open | Indicator stuck offset after SSR + StrictMode | Inline styles + cancelled rAF on double effect | Open | Variables come from state through connect; no imperative styles; StrictMode test |
| Base UI | [#3425](https://github.com/mui/base-ui/issues/3425), [#2235](https://github.com/mui/base-ui/issues/2235) closed | Wrong under a scaling dialog; rounding overflow | Transforms; rounding up | Fixed | Same module as Tabs (`selection-indicator`) |
| Ark | [#2629](https://github.com/chakra-ui/ark/issues/2629) closed | `data-scope="radio-group"` on a segment group | Reused anatomy not renamed everywhere | Fixed | Own scope `segmented-control` on every part, own contract and driver |
| Zag | [#829](https://github.com/chakra-ui/zag/issues/829) closed | `readOnly` does nothing | Not implemented, removed from types | Removed | `readOnly` supported through the radio machine; scenario |
| Zag | [#3239](https://github.com/chakra-ui/zag/issues/3239) closed | Clicking a segment scrolls the page | Hidden input focused | `preventScroll` | Hidden inputs never take focus (radio decision) |
| Radix / Base UI | [RX#4119](https://github.com/radix-ui/primitives/issues/4119), [BU#3525](https://github.com/mui/base-ui/issues/3525) | Single toggle group used as a segmented control: radio roles with toolbar keys / no exclusivity cue | No segmented control; toggle group stands in | Won't fix / open | Ship Segmented Control with radio semantics |
| Kobalte | [#579](https://github.com/kobaltedev/kobalte/issues/579) open | Want arrows that move without selecting | Radio semantics | Open | Not a mode here: Tabs (manual) or Toggle Group |

## Known pitfalls

1. Indicator timing: on mount, on conditional mount, first change, resize, scroll.
2. Viewport-relative or rounded measurements.
3. Reusing the radio machine without renaming scope, parts and docs.
4. Choosing toggle-button semantics for an exclusive choice.

## Testing notes

- Driver = radio group's (`check`, `checked`, `segments` instead of `radios`) under scope
  `segmented-control`; locate by `radiogroup` role and name.
- Indicator scenarios run in browser mode only (layout); jsdom asserts the variables are
  absent and the indicator hidden.

## Decisions

- **Parts**: `Root` (`div[role=radiogroup]`), `Label`, `Item` (`button[role=radio]`, name
  from content, renders its hidden radio input as a sibling), `Indicator` (decorative,
  inside `Root`). No ItemControl/ItemText split: a segment is one pressable element.
- **Machine**: the `add-radio-group` machine, unchanged; Segmented Control has its own
  connect (parts, scope, defaults) and contract.
- **Defaults**: `orientation: "horizontal"`; everything else as Radio Group (`value:
  string | null`, `name`, `form`, `required`, `disabled`, `readOnly`, `invalid`).
- **Indicator**: `selection-indicator` from `add-tabs`, measuring the checked item
  relative to the root: `--rind-indicator-{left,right,top,bottom,width,height}`,
  `data-resizing`, hidden while nothing is checked or measured.
- **`data-*`**: `data-scope="segmented-control"`; root `data-orientation`,
  `data-disabled`, `data-readonly`, `data-invalid`, `data-required`; item `data-key`,
  `data-state="checked|unchecked"`, `data-disabled`, `data-highlighted`, `data-focus`,
  `data-focus-visible`, `data-pressed`, `data-hover`; indicator `data-orientation`,
  `data-resizing`, `data-state`.
- **Contract**: anchor `radiogroup` by name; actions `check`; queries `segments`,
  `checked`, `focusedSegment`, `isDisabled`; traits `composite-roving`, `selectable`,
  `directional`.
- **Deliberately different**: its own scope and driver (vs Ark's leaked scope), button
  segments + hidden inputs (vs native inputs), indicator variables from state (vs RA's
  imperative shared element).

## Open questions

- Pre-hydration indicator placement, as in Tabs: deferred (hidden until hydration).
