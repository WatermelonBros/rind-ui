# Separator — research

Status: done · Wave: 1

A static divider between groups of content or controls: a rule in a page, between
toolbar groups, between menu sections. It has no state and no interaction. Its whole
difficulty is semantic: when it is exposed as `separator`, when it must be hidden, how
its orientation is announced, and where the `separator` role is not allowed at all.

Sources: shallow clones read 2026-10-14 (paths repo-relative; React Aria from the
`ra/` sparse clone). Bug history: `gh search issues` over the ten trackers in
[README.md](README.md) with `separator`, `toolbar separator`, `divider`; ~140 hits,
~25 separator-related, 14 read in full.

## Pattern

- WAI-ARIA APG: **none** for a static separator. ARIA 1.2 defines
  [`separator`](https://www.w3.org/TR/wai-aria-1.2/#separator) with two meanings:
  - **not focusable** → a *structure* role: "a divider that separates and distinguishes
    sections of content or groups of menuitems". This is this component.
  - **focusable** → a *widget* (it then needs `aria-valuenow`, `-min`, `-max`): the
    [Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
    pattern. That is **Splitter** (wave 3), not Separator.
- Roles and attributes:
  - `role="separator"`, or the native `<hr>` whose implicit role is `separator`.
  - `aria-orientation`: default `horizontal`; set `vertical` when the line is vertical.
  - Children are **presentational** (ARIA: "Children Presentational: True"): text inside
    a separator ("or") is not exposed as content; a name, if any, comes from
    `aria-label` / `aria-labelledby`.
  - Decorative dividers are removed from the accessibility tree with `role="none"`
    (ARIA 1.3 prefers `none` over `presentation`, accessibility.md §1.3).
- Where `separator` is allowed: in flow content, in `menu` / `menubar` (APG: "Items in a
  menu may be divided into groups by placing an element with a role of separator"), in
  `toolbar` (no required owned roles). **Not** in `listbox`: its allowed owned roles are
  `option` and `group`, so a `separator` child fails `aria-required-children`
  (AK#3315, BU#5398).
- Keyboard: none. A separator is never a tab stop and never a composite item.

## How the others built it

Shipped by Radix, React Aria, Base UI, Ariakit, Reka, Bits, Kobalte (7 of 9); Headless
UI and Zag/Ark only have a menu separator part.

### Radix (Reka and Bits are ports)

- Source: `radix/packages/react/separator/src/separator.tsx`;
  `reka-ui/packages/core/src/Separator/Separator.vue` → `shared/component/BaseSeparator.vue`;
  `bits-ui/packages/bits-ui/src/lib/bits/separator/separator.svelte.ts`.
- API: `Separator.Root` (`div`), `orientation` (`horizontal` default), `decorative`.
- Output: `decorative` → `role="none"`; else `role="separator"` and `aria-orientation`
  **only when vertical** (horizontal is the ARIA default); `data-orientation` always; an
  invalid `orientation` falls back to horizontal (RX#216 was a prop-type crash on
  `undefined`).
- Bits adds `aria-hidden="true"` on decorative separators as well — redundant with
  `role="none"` on an empty element.
- Toolbar and Menubar reuse it: `ToolbarSeparator` passes the **perpendicular**
  orientation (`toolbar.tsx`); menu separators are their own part.

### React Aria (and Kobalte, its Solid port)

- Source: `react-aria/src/separator/useSeparator.ts`;
  `kobalte/packages/core/src/separator/separator-root.tsx`.
- API: `useSeparator({ orientation, elementType })`, labelable (`aria-label` passes).
- Output: if the element is `hr`, **no role** (implicit), else `role="separator"`;
  `aria-orientation` only when vertical. Kobalte renders `<hr>` by default and detects
  the rendered tag (`createTagName`) to decide the role.
- No decorative mode; React Spectrum's `Divider` is the styled wrapper.

### Base UI

- Source: `base-ui/packages/react/src/separator/Separator.tsx`,
  `toolbar/separator/ToolbarSeparator.tsx`, `utils/listbox-separator/ListboxSeparator.tsx`.
- `div` with `role="separator"` and `aria-orientation` **always**. `ToolbarSeparator`
  defaults to the opposite of the toolbar's orientation (BU#4647 thought it was
  inverted; it is not). Since BU#5398, Select / Combobox / Autocomplete separators are
  `role="presentation"` with `data-orientation` only, because `separator` is not an
  allowed child of `listbox`.

### Ariakit

- Source: `ariakit-react-components/src/separator/separator.tsx`,
  `composite/composite-separator.tsx`, `toolbar/toolbar-separator.tsx`; sandbox
  `app/src/sandbox/separator-semantics`.
- Renders `<hr>` with explicit `role="separator"` and `aria-orientation` always
  (AK#721 asked to drop both on a horizontal `hr`, closed). `CompositeSeparator` derives
  the opposite of the composite's orientation; until AK#6302 an explicit `orientation`
  was ignored.
- `SelectSeparator` inside `role="listbox"` failed axe `aria-required-children`
  (AK#3315).

### Headless UI, Zag / Ark

- Headless UI `MenuSeparator` (`components/menu/menu.tsx`): `role="separator"`.
- Zag `menu` has a `separator` part (`role="separator"`); no standalone separator.

## Accessibility

Applying [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md):

- **Semantics (rules 4, 10).** A semantic separator is `role="separator"` (none on
  `<hr>`, rule 4: do not repeat the implicit role); a decorative one is `role="none"` and
  carries nothing else. `aria-orientation` only for vertical: it is the only value that
  adds information, and screen readers read "separator" either way.
- **Never focusable.** A focusable separator is a different widget with a value; adding
  `tabIndex` to a Separator would expose a widget with no value. Splitter owns that.
- **Context decides the role.** Inside a `listbox` (Listbox, Select, Combobox,
  Autocomplete) a divider must be `none`; inside `menu`, `menubar`, `toolbar` and plain
  content it may be `separator`.
- **Names.** Usually none. Children are presentational, so a "text divider" (`— or —`)
  exposes nothing from its text; if the text matters it belongs outside the separator,
  or as `aria-label`.
- **Screen readers.** VO and NVDA announce "separator" (NVDA also "horizontal/vertical"
  on some versions) in browse mode; inside menus they are skipped by arrow keys because
  they are not items. No quirk entry is needed.
- **Forced colors (cause K).** A separator drawn as a `background-color` box disappears
  in Windows High Contrast (backgrounds become `Canvas`). The theme draws it as a border,
  which forced colours keep visible.
- **Layout.** A vertical separator in a flex row has zero height unless it stretches
  (RX#1926); fractional heights render as 1 or 2 device pixels (RX#3291). Theme concerns,
  handled by drawing a border on a stretched element.
- **Native platform** ([native-platform.md](native-platform.md)): `<hr>` is a native
  separator (implicit role, horizontal), but it is only valid in flow content (not inside
  `<span>`, `<button>`, `<p>`, `<ul>`) and carries UA borders and margins. Default `div`,
  `hr` through element substitution.
- Target size, motion, RTL: not applicable (orientation is physical, not logical).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Base UI | [#5398](https://github.com/mui/base-ui/issues/5398) closed | `Select.Separator` exposes `role="separator"` inside the listbox | Listbox separators reused the standalone Separator | PR #5399: `role="presentation"` | Listbox-family separators are `none` (Spec; request to listbox changes) |
| Ariakit | [#3315](https://github.com/ariakit/ariakit/issues/3315) closed | axe `aria-required-children` fails on a select with a separator | `<hr role="separator">` as a `listbox` child | Fixed | Same (Spec) |
| Ariakit | [#721](https://github.com/ariakit/ariakit/issues/721) closed | Redundant `role="separator"` / `aria-orientation="horizontal"` on `<hr>` | Attributes always emitted | Closed | No role on `hr`; `aria-orientation` only when vertical (Spec) |
| Ariakit | [#6302](https://github.com/ariakit/ariakit/issues/6302) closed | `ToolbarSeparator orientation="horizontal"` ignored | Derived orientation overwrote the prop | PR #6433 | Explicit orientation always wins over the context default (Spec) |
| Base UI | [#4647](https://github.com/mui/base-ui/issues/4647) closed | "ToolbarSeparator `data-orientation` inverted" | The separator's own orientation is perpendicular to the toolbar; the docs described it as the toolbar's | Closed as intended (maintainer: "when the toolbar is horizontal, the separators are vertical") | `data-orientation` is the separator's own orientation; documented (Spec) |
| Base UI | [#1303](https://github.com/mui/base-ui/issues/1303) closed | No vertical separator | Prop missing; users hand-wrote `aria-orientation` | Added | `orientation` prop drives both attributes (Spec) |
| Radix | [#216](https://github.com/radix-ui/primitives/issues/216) closed | `orientation={undefined}` throws a prop-type error | Validation rejected `undefined` | Fixed: fallback | Undefined or invalid orientation → horizontal, dev warning for invalid (Spec) |
| Radix | [#1926](https://github.com/radix-ui/primitives/issues/1926) closed | Vertical separator invisible in a flex row | Zero height; no stretch | Docs (`align-self`) | Theme stretches vertical separators (tasks) |
| Radix | [#3291](https://github.com/radix-ui/primitives/issues/3291) closed | `height: 1px` separator renders 2 px | Sub-pixel box rounding | Closed | Theme draws a border, not a box height (tasks) |
| Radix | [#949](https://github.com/radix-ui/primitives/issues/949) closed | axe flags `role="toolbaritem"` | Invented role on toolbar children | PR #950 | Only ARIA roles; Separator has exactly two outputs (Spec) |
| Bits UI | [#2090](https://github.com/huntabyte/bits-ui/issues/2090) closed | `Menu.Separator` exposes an empty `role="group"` | Shared spread props carried the group role | Fixed | A separator's props come from one helper with exactly two outcomes (Spec) |
| Ark | [#3555](https://github.com/chakra-ui/ark/issues/3555) closed | Hydration children mismatch on `Menu.Separator` (`<hr>`) | Children rendered into a void `hr` on the client only | Fixed | `hr` is void: the React part never renders children into it; SSR test (tasks) |
| React Aria | `useSeparator.ts` (source) | — | `hr` gets no explicit role; `aria-orientation` only vertical | — | Copied |
| Bits UI | `separator.svelte.ts` (source) | Decorative separators carry `role="none"` and `aria-hidden` | Belt and braces | — | `role="none"` alone; nothing focusable or named to hide |

## Known pitfalls

1. Reusing the standalone separator inside a listbox (Base UI, Ariakit) — the context
   changes the allowed role.
2. Orientation conventions: a toolbar's separator is perpendicular to the toolbar; a
   derived default must never override an explicit prop.
3. Using `separator` for resizable dividers: that is a focusable widget with a value
   (Splitter).
4. Styling with a background box: invisible in forced colours, collapses in flex rows.

## Testing notes

- No machine, so no `testMachine` graph. Connect is a pure function: unit tests for every
  combination of orientation × decorative × element (`div`, `hr`) × context.
- Contract: queries only (`orientation`, `isDecorative`); driver tests in DOM and
  Playwright; axe on stories, including a separator inside a toolbar, a menu and a
  listbox-like popup (the role must change there).
- Dev warnings are tested with the injected logger.

## Decisions

- **Parts**: `root` (default `div`; `hr` or anything else through `render`).
- **Machine**: none — stateless. Connect is a pure function of props; this is the one
  component the "every component has a machine" rule does not apply to, and the docs
  generator lists it as stateless.
- **Props**: `orientation: "horizontal" | "vertical"` (default `horizontal`; invalid
  value → horizontal + dev warning), `decorative: boolean` (default `false`).
- **Output**: semantic → `role="separator"` (omitted on `hr`), `aria-orientation` only
  when vertical; decorative → `role="none"` and no `aria-orientation`. Never `tabIndex`,
  never `aria-value*`; a consumer `tabIndex ≥ 0` or `aria-valuenow` triggers a dev
  warning pointing at Splitter.
- **Shared helper** `separatorProps({ orientation, decorative, tag, context })` in
  `core/components/separator`, with `context: "content" | "menu" | "toolbar" | "listbox"`;
  `listbox` forces `none` and drops `aria-orientation`. Toolbar's separator part and
  Menubar call it; Menu, Select, Listbox, Combobox and Autocomplete may adopt it (their
  own changes already specify their parts — see Requests in the change).
- **`data-*`**: `data-scope="separator"`, `data-part="root"`, `data-orientation`
  always (the separator's own orientation), `data-decorative` when decorative or when
  the `listbox` context forces `none`.
- **Contract**: locate by role `separator` and accessible name when named, else by
  `data-scope` inside a container; queries `orientation()`, `isDecorative()`; no actions;
  no traits.
- **Theme**: `separator.css`, tier-3 `--rind-separator-color`, `-thickness`, `-spacing`;
  drawn as a border; vertical separators stretch; no variants or sizes.
- **Deliberately different**: role chosen from context (no library does this in one
  helper; Base UI does it per part); explicit orientation always wins (AK#6302); the
  Splitter boundary is enforced with a warning instead of documented only.

## Open questions

None that change the specs.
