# Toggle Group — research

Status: done · Wave: 1

Builds on [toggle.md](toggle.md) (`add-toggle`: the item is a Toggle whose `pressed` the
group owns), [collections.md](collections.md) (static registration, roving focus, one tab
stop, single and multiple selection) and the cross-cutting notes
[accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md),
[native-platform.md](native-platform.md). Compared with [radio-group.md](radio-group.md)
and [segmented-control.md](segmented-control.md), which own the "exclusive choice with
radio semantics" case.

Sources read (local clones, 2026-10-14):

| Library | Files |
|---|---|
| Zag / Ark | `zag/packages/machines/toggle-group/src/{toggle-group.machine,toggle-group.connect,toggle-group.dom}.ts` |
| Radix (Reka, Bits) | `radix/packages/react/toggle-group/src/toggle-group.tsx`, `roving-focus`; `reka-ui/packages/core/src/ToggleGroup/{ToggleGroupRoot,ToggleGroupItem}.vue`; `bits-ui/src/lib/bits/toggle-group/toggle-group.svelte.ts` |
| React Aria | `react-aria/src/button/useToggleButtonGroup.ts`, `react-stately/src/toggle/useToggleGroupState.ts`, `react-aria-components/src/ToggleButtonGroup.tsx` |
| Base UI | `base-ui/packages/react/src/toggle-group/ToggleGroup.tsx`, `toggle/Toggle.tsx` |
| Kobalte | `kobalte/packages/core/src/toggle-group/{toggle-group-base,toggle-group-item}.tsx`, `toggle-button/toggle-button-root.tsx` |

Headless UI and Ariakit ship no toggle group (AK#7353 open).

## Pattern

- No APG pattern of its own. Closest: [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  (toggle button, `aria-pressed`) for the items and
  [Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) for the keyboard (one tab
  stop, arrows move focus, Home/End, optional wrap). The APG toolbar example also shows
  a [radio group in a toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) for
  text alignment (arrows move only, Space checks).
- Roles: `group` (or `toolbar`) named by `aria-label`/`aria-labelledby`; items are
  buttons with `aria-pressed="true|false"`. `aria-orientation` is **not** allowed on
  `group` (RX#964).
- Keyboard: Tab enters at one item; Left/Right (horizontal) or Up/Down (vertical) move
  focus; Home/End first/last; Space and Enter toggle the focused item.

## How the others built it

| | Zag/Ark | Radix | Reka | Bits | React Aria | Base UI | Kobalte |
|---|---|---|---|---|---|---|---|
| Single mode roles | `radiogroup` + `radio`/`aria-checked` | `radiogroup` + `radio` | `group` + `aria-pressed` | `group` + `radio`/`aria-checked` | `radiogroup` + `radio` | `group` + `aria-pressed` | `group` + `aria-pressed` |
| Multiple mode roles | `group` + `aria-pressed` | **`toolbar`** + `aria-pressed` | same | same | `toolbar` + `aria-pressed` | `group` | `group` |
| Value shape | `string[]` | `string` / `string[]` by `type` | inferred from `v-model` | by `type` | `Set<Key>` | `string[]` | — |
| Deselect in single | `deselectable` (default true) | yes | yes | yes | unless `disallowEmptySelection` | yes | yes |
| Tab stop | **root** `tabIndex=0` redirects focus to the first item | roving (last focused) | roving | roving | toolbar roving | composite | roving |
| Wrap | `loopFocus`, off inside `[role=toolbar]` | `loop` | `loop` | `loop` | — | `loopFocus` | — |
| Enter toggles | native button | native button | after RK#638 | yes | yes | yes | yes |

### Zag.js / Ark UI

- Source: `toggle-group.machine.ts` (`idle` / `focused`; `ROOT.FOCUS` focuses the first
  item; Shift+Tab bookkeeping `isTabbingBackward`), `toggle-group.connect.ts`.
- Notable: detects an ancestor `[role=toolbar]` and stops looping there; `deselectable`
  (ZG#2412) to require a value in single mode.
- Problems: the root is the tab stop and re-dispatches focus, which needs mouse-down and
  Shift+Tab special cases; `data-focus` not cleared on blur (ZG#2190); arrows read
  `getEventKey(event)` without `dir`, so RTL is not mirrored.

### Radix (and Reka, Bits)

- Source: `toggle-group.tsx` on `RovingFocusGroup` and `Toggle`.
- Notable: `rovingFocus={false}` lets it sit inside a Toolbar that owns focus.
- Problems: single mode announces radio semantics but keeps toolbar keys
  (RX#4119, closed as intended: "this is exactly how radio groups are intended to behave
  in the context of a toolbar"); first VoiceOver report was the opposite — a group of
  toggle buttons gave no hint of the others (RX#754) — and led to RX#951 / RX#3188;
  deselect needs two clicks with a controlled mapping that cannot express "none"
  (RX#721, RX#2254: `""` instead of `null`); Safari focus oddities (RX#703); group not
  focused by a dialog's initial focus because it starts with `tabIndex=-1` (RX#3077);
  Reka threw when the selected item was pressed again (RK#992) and ignored Enter (RK#638).

### React Aria

- Source: `useToggleButtonGroup` (built on `useToolbar`; `radiogroup` in single mode),
  `useToggleGroupState` (`selectionMode` single/multiple, `disallowEmptySelection`).
- Problems: `isDisabled` on the group not applied to items without ids (RA#7798, open);
  `SelectionIndicator` jumps when the page is scrolled in Chrome (RA#9931, open) and
  stays offset after SSR hydration in StrictMode (RA#10570, open).

### Base UI (and Kobalte)

- Source: `ToggleGroup.tsx` (`role="group"`, composite, `loopFocus`, `orientation`,
  `multiple`), `Toggle.tsx` (`aria-pressed`); inside a Toolbar it joins the toolbar's
  composite.
- Notable: the item is always a toggle button; `aria-pressed` in both modes.
- Problems: Home/End missing (BU#3970); single mode gives screen-reader users no sign
  that only one item can be pressed (BU#3525, open): a team migrating shadcn from Radix to
  Base UI saw every single-choice toggle group change from `radiogroup`/`radio` to
  `group`/`button[aria-pressed]`, caught it with 18 accessibility runs, and moved those
  controls to `RadioGroup` styled as a segmented control; `focusableWhenDisabled` asked
  for (BU#5834, open).

## Accessibility

Applies [accessibility.md](accessibility.md) §2, §4, §5, §6, §8 and the AT note's causes
A, C, K.

- **Semantics decision: toggle buttons, always.** Items are `button[aria-pressed]` in a
  named `group`, in both modes. Evidence:
  - radio roles promise APG radio keys (arrows check) and "cannot uncheck"; a toggle
    group with move-only arrows and deselect contradicts both (RX#4119; BU#3525 thread);
  - APG blesses move-only radios only *inside a toolbar*, where the toolbar is the
    composite; a standalone single toggle group is not that;
  - the need radio roles were meant to cover — "exactly one of N, 2 of 4" — is a radio
    group's job, which rind-ui ships twice: Radio Group and Segmented Control (radio
    semantics, arrows select). The BU#3525 migration landed on exactly this split.
  - What single mode loses (no "1 of 3", no exclusivity cue) is documented, and the docs
    send exclusive choices to Segmented Control.
- **Name the group** (RX#754): `group` without a name is not announced on entry; a
  development warning when neither `aria-label` nor `aria-labelledby` is present.
- **Keyboard**: arrows move focus only (never press); Space and Enter press (RK#638);
  Home/End (BU#3970); RTL mirrored; `loop` default true; vertical orientation accepts
  both arrow pairs because `aria-orientation` cannot be exposed on `group` (RX#964) and
  so the orientation is never announced (same reasoning as Tabs, RA#4140).
- **Focus alone does not press** (invariant 13); a virtual click presses exactly once
  (invariant 12, toggle's own rule).
- **One tab stop** on an item, never on the root (RX#3077: a root that redirects focus
  breaks dialog initial focus; Zag's mouse-down/Shift+Tab workarounds).
- **Explicit `aria-pressed`** on every item, equal to the selection.
- **Forced colors**: pressed state needs a border/`Highlight` cue (toggle theme rule).
- **Target size**: 24×24 per item.
- **Native platform**: no native primitive; `focusgroup` avoided (native-platform §9).

## Bug history

Method: `gh search issues` on the nine shipping repositories plus ariakit with "toggle
group", "togglegroup", "ToggleButtonGroup", "toggle in:title", "roving focus" (Radix 5 × 40;
the others "toggle in:title" × 100 and targeted queries). About 140 hits, 30 relevant,
22 read.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#4119](https://github.com/radix-ui/primitives/issues/4119) closed | Single mode announces `radiogroup` but arrows do not check | Radio roles on a toolbar-keyboard widget | Won't fix | Toggle buttons always; exclusive choice → Segmented Control |
| Radix | [#754](https://github.com/radix-ui/primitives/issues/754) closed | VoiceOver gives no hint that other toggles follow | Unnamed group of buttons | Warn on missing name | Named `group`; dev warning; scenario |
| Radix | [#951](https://github.com/radix-ui/primitives/issues/951), [#3188](https://github.com/radix-ui/primitives/issues/3188) closed | Request: radio roles in single mode for "1 of N" | Exclusivity not conveyed | Shipped radio roles | Recorded trade-off; docs point to radio-based components |
| Base UI | [#3525](https://github.com/mui/base-ui/issues/3525) open | Migration from Radix silently changed single toggle groups from radio to toggle buttons | Libraries disagree on semantics | Open; app moved to RadioGroup | Decide once, document it, and ship the radio alternative (Segmented Control) |
| Radix | [#964](https://github.com/radix-ui/primitives/issues/964) closed | `aria-orientation` on a role that does not allow it | Shared roving code set it everywhere | Fixed | No `aria-orientation` on `group` |
| Base UI | [#3970](https://github.com/mui/base-ui/issues/3970) closed | Home / End do nothing | Missing keys | Fixed | Home/End scenarios |
| Reka | [#638](https://github.com/unovue/reka-ui/issues/638) closed | Enter does not toggle | Space-only handler | Fixed | Enter and Space both press (button) |
| Radix | [#721](https://github.com/radix-ui/primitives/issues/721), [#2254](https://github.com/radix-ui/primitives/issues/2254) closed | Deselecting a controlled single group takes two clicks | "None" encoded as `""`; mapping round-trips wrong | Use `""` | Value is `string[]`; empty array is "none"; scenario |
| Reka | [#992](https://github.com/unovue/reka-ui/issues/992) closed | Error when pressing the pressed item again | Mode inferred from an `undefined` model | Require `type` | Mode is an explicit prop with a default |
| Zag | [#2412](https://github.com/chakra-ui/zag/issues/2412) closed | Need "at least one selected" | Only deselectable mode existed | `deselectable` (single only) | `disallowEmptySelection` in both modes (selection model) |
| Radix | [#3077](https://github.com/radix-ui/primitives/issues/3077) closed | Dialog's initial focus skips the group | Group starts with `tabIndex=-1`, fixed after a render | Fixed | Tab stop on an item from the first render (SSR fallback) |
| Zag | [#2190](https://github.com/chakra-ui/zag/issues/2190) closed | `data-focus` stays after blur | Blur handler missing a path | Fixed | `data-focus` from machine focus state; invariant |
| Radix | [#703](https://github.com/radix-ui/primitives/issues/703) closed | Focus jumps to another item on click in Safari | Safari does not focus buttons on click; roving focus guessed | Fixed | Press focuses the pressed item explicitly (`focusSafely`) |
| React Aria | [#7798](https://github.com/adobe/react-spectrum/issues/7798) open | Group `isDisabled` not applied to items | Items without ids are not group members | Open | Every item registers with a key; group disabled applies to all |
| React Aria | [#9445](https://github.com/adobe/react-spectrum/issues/9445) closed | Disabled group items still get `data-hovered` | Hover not gated by group disabled | Fixed | Disabled items get no hover/press attributes |
| Base UI | [#5834](https://github.com/mui/base-ui/issues/5834) open | Want disabled items reachable | Native `disabled` only | Open | `focusableWhenDisabled` (collections) |
| Radix | [#3058](https://github.com/radix-ui/primitives/issues/3058) closed | Want a hidden form value | No form participation | Declined | Non-goal (Toggle has none either); use Radio Group / Checkbox Group |
| Radix | [#1439](https://github.com/radix-ui/primitives/issues/1439) closed | Want the selected index as a CSS variable (sliding highlight) | No indicator part | Declined | Indicator belongs to Segmented Control |
| React Aria | [#9931](https://github.com/adobe/react-spectrum/issues/9931), [#10570](https://github.com/adobe/react-spectrum/issues/10570) open | Selection indicator jumps when scrolled; offset after hydration | Viewport-relative rects | Open | (For Segmented Control's indicator) layout offsets, not client rects |
| Reka | [#1407](https://github.com/unovue/reka-ui/issues/1407) open | Tooltip and ToggleGroupItem fight over `data-state` | Two parts on one element | Open | Composition question shared with Toggle (toggle.md open question) |

## Known pitfalls

1. Radio roles with toolbar keys (or the reverse) — pick one semantics per component.
2. Unnamed groups.
3. "None" not representable in controlled single mode.
4. Root-as-tab-stop focus redirection.
5. Group-level disabled not reaching items.

## Testing notes

- Driver: `toggle(name)` (pointer: press; keyboard: arrows to it, then Space; virtual:
  bare click); queries `items()`, `pressed()` (names), `focusedItem()`, `isDisabled(name)`.
- Per-component invariant: every item carries `aria-pressed="true|false"` equal to the
  oracle's selection (the foundations' `selectable` trait checks `aria-selected` /
  `aria-checked` only).
- Argument classes: single, multiple, `disallowEmptySelection`, vertical, RTL, all
  disabled.

## Decisions

- **Parts**: `Root` (`div[role=group]`), `Item` (a Toggle: `button[aria-pressed]`, uses
  `add-toggle`'s connect with `pressed` owned by the group).
- **Machine**: states `idle` / `focused`; events `NAVIGATE` (focus only), `PRESS`
  (toggle selection), `FOCUS` / `BLUR`, `COLLECTION.CHANGE`, `$sync` / `$reverted`.
  Controllable `value: string[]`; `selectionMode: "single" | "multiple"` (default
  `single`), `disallowEmptySelection` (default false); collections selection model with
  `selectionBehavior: "toggle"`.
- **Props**: `orientation` (`horizontal` default), `loop` (true), `disabled`,
  `focusableWhenDisabled`.
- **`data-*`**: root `data-orientation`, `data-disabled`, `data-selection-mode`; item
  toggle's set (`data-state="on|off"`, `data-disabled`, `data-focus`, `data-focus-visible`,
  `data-pressed`, `data-hover`) plus `data-key`, `data-highlighted`, `data-orientation`.
- **Contract**: anchor `group` by name; actions `toggle`; queries above; traits
  `composite-roving`, `directional`; per-component `aria-pressed` invariant.
- **Deliberately different**: `aria-pressed` in single mode (vs Radix/RA/Zag/Bits), item
  tab stop (vs Zag's root), `string[]` value in both modes (vs Radix), both arrow pairs in
  vertical.

## Open questions

- An optional hint ("Select one") through `aria-describedby` from `messages` for single
  mode? Not added: it would be read on every entry, and the documented answer is
  Segmented Control. Revisit after the manual protocol.
- Toolbar integration (no own tab stop, no loop inside a toolbar): `add-toolbar`.
