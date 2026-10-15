## Why

Separator ships in seven of nine libraries and is needed by Toolbar and Menubar in
wave 2. It is trivial to render and easy to get wrong: libraries expose it inside
listboxes where the role is not allowed (mui/base-ui#5398, ariakit#3315), repeat the
implicit role on `<hr>` (ariakit#721), let a derived orientation override an explicit one
(ariakit#6302), and blur the line with resizable dividers, which are a different, focusable
widget. This change specifies the semantics once so every component that draws a divider
uses the same rules.

Research: [separator](../../../docs/research/separator.md) (sources, Bug history,
Accessibility, Decisions) · [accessibility](../../../docs/research/accessibility.md) ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-foundations` (contracts, drivers, React adapter, element
substitution), `add-a11y-foundations` (dev logger, invariants) and `add-theme-system`
(tier-3 tokens, stylesheet convention). `add-toolbar` and `add-menubar` use its helper.

## What Changes

- `@rind-ui/core`: `separator` connect (a pure function — the component has no machine),
  the shared `separatorProps` helper with a context (`content`, `menu`, `toolbar`,
  `listbox`) that decides the role, contract, development warnings.
- Behaviour: `role="separator"` (none repeated on `<hr>`), `aria-orientation` only when
  vertical, `role="none"` when decorative or inside a listbox, never focusable; a
  focusable or valued use warns and points to Splitter.
- `@rind-ui/react`: `Separator.Root` with element substitution (`div` default, `hr`
  allowed).
- `@rind-ui/testing`: `getSeparator` driver.
- Theme stylesheet (`--rind-separator-*`), stories, docs page.

## Capabilities

### New Capabilities

- `separator`: the Separator component and the shared separator semantics — role by
  context, orientation, decorative mode, element substitution, `data-*`, the Splitter
  boundary, contract and driver, theme expectations.

### Modified Capabilities

None. Requests to other changes (listbox-family separators, theme family matrix) are in
design.md.

## Non-goals

- Focusable, resizable separators (Window Splitter pattern): **Splitter** (wave 3).
- Labelled "text dividers" with exposed content: separator children are presentational
  in ARIA; the docs show the alternative.
- Variants and sizes (`data-variant`, `data-size`): a separator has none.
- Re-specifying the separator parts of Menu, Select, Listbox, Combobox or Autocomplete
  (their changes own them; design.md lists what they should adopt).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/separator/{separator.connect,separator.contract}.ts`,
  `packages/react/src/separator/*`, `getSeparator` in `@rind-ui/testing`,
  `packages/theme/src/separator.css`, stories, generated docs page.
- Public API: `separatorConnect`, `separatorProps`, `separatorContract`, `Separator`,
  `getSeparator`.
- No new runtime dependency.
