## Context

See proposal.md for why and specs/separator/spec.md for behaviour. Research and the Bug
history the scenarios cite: [separator.md](../../../docs/research/separator.md). This
change consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | contracts, drivers, React adapter (`render` substitution, instance scoping attributes, reserved theme attributes pass-through) |
| `add-a11y-foundations` | injected development logger, ids (none needed here), generic invariants (no `aria-label` on `none`, rule 4) |
| `add-theme-system` | tier-3 token convention, `@layer rind.components`, `:where()` selectors, stylesheet manifest |

## Goals / Non-Goals

**Goals:**
- One function decides every separator's attributes, so Toolbar, Menubar and any later
  component cannot drift.
- Zero runtime cost: no machine, no effects, no subscriptions.

**Non-Goals:**
- A machine or state (there is none); Splitter.

## Decisions

### 1. No machine

The Separator has no states and no events. CLAUDE.md's "every component ships a
machine" rule exists so behaviour is a graph; here there is no behaviour. The component
ships connect, parts, contract, driver, tests, theme, stories and docs; the docs
generator marks it **stateless** (no states table, no `testMachine` section). A
machine with one state would only add bundle size and a meaningless graph.

### 2. One helper, two outputs

```ts
// core/components/separator/separator.connect.ts
export type SeparatorContext = "content" | "menu" | "toolbar" | "listbox"
export interface SeparatorInput {
  orientation?: "horizontal" | "vertical" | undefined   // undefined → context default
  defaultOrientation?: "horizontal" | "vertical"         // supplied by the container
  decorative?: boolean
  tag: string                                             // rendered tag, from the ref via core/dom
  context?: SeparatorContext
  scope?: string                                          // "separator" or the host component's scope
}
export function separatorProps(input: SeparatorInput, log: Logger): SeparatorProps
export const separatorConnect = (props, env) => ({ root: separatorProps({ ...props, scope: "separator" }, env.log) })
```

- Output is either `{ role: "separator" | (none on hr), "aria-orientation"?: "vertical" }`
  or `{ role: "none" }`, plus `data-*`. `listbox` context forces the second.
- Orientation: `orientation ?? defaultOrientation ?? "horizontal"`; invalid → horizontal
  + warning. Explicit always wins (ariakit#6302).
- The rendered tag arrives the same way other parts learn it (accessibility.md §1.4:
  connect receives the rendered tag from the ref); during SSR the declared default
  element is assumed, and `render={<hr />}` declares `hr` statically so server and client
  agree.
- Development warnings (logger): invalid orientation, `tabIndex >= 0` or `aria-value*`
  (→ Splitter), a name on a separator whose role is `none`. The name props are dropped
  in that case, which keeps the foundations' "no `aria-label` on `none`" rule true.

*Alternatives:* Radix's two props without context (forces every listbox to remember
`decorative`, the mui/base-ui#5398 bug); Base UI's per-part role (correct, but three
components carry the rule); Bits' `aria-hidden` on decorative separators (redundant on an
empty `none` element).

### 3. Parts (React)

`Separator.Root` — thin: calls `separatorConnect`, forwards props, `render` support.
When the element is void (`hr`), children are not rendered (chakra-ui/ark#3555).

### 4. Contract

```ts
export const separatorContract = contract("separator", {
  anatomy: ["root"],
  locate: (opts: { name?: string; within?: PartHandle }) =>
    opts.name ? { role: "separator", name: opts.name } : { part: "root", within: opts.within },
  actions: {},
  queries: { orientation, isDecorative, isExposed },
  traits: [],
})
```

No events to map (no machine). `getSeparator` is generated from it.

### 5. Theme

`packages/theme/src/separator.css`, `@layer rind.components`, `:where([data-scope="separator"][data-part="root"])`:
`--rind-separator-color` (→ `--rind-color-border`), `--rind-separator-thickness`
(→ `1px`), `--rind-separator-spacing` (→ a spacing step). Horizontal: `border-block-start`;
vertical: `border-inline-start`, `align-self: stretch`; `margin` from spacing along the
cross axis; forced colours keep borders (`CanvasText`). No variant, size or tone rules
(nothing accent-coloured), so the `data-tone="danger"` capture shows it unchanged by
design. Hosted separators (Toolbar, Menubar) use their host's scope and their host's
stylesheet reads `--rind-separator-*` too, so one override restyles every separator.

## Requests to other changes

To `add-listbox`, `add-select`, `add-combobox`, `add-autocomplete` (separator parts) —
APPLIED (coordinator, 2026-10-14):

1. **APPLIED (coordinator, 2026-10-14).** **`role="none"` for separators inside the listbox.** Their specs give the separator
   part `role="separator"`; `listbox` allows only `option` and `group` children, and axe
   `aria-required-children` fails (mui/base-ui#5398, ariakit#3315). Use
   `separatorProps({ context: "listbox" })`, keep `data-orientation`.

To `add-menu` (separator part) — optional:

2. **APPLIED (coordinator, 2026-10-14).** Build the menu `separator` part with `separatorProps({ context: "menu",
   scope: "menu" })` so the role / orientation rules are shared (behaviour unchanged).

To `add-theme-system` (`theme-variants`, Family Matrix) — APPLIED (coordinator, 2026-10-14):

3. **APPLIED (coordinator, 2026-10-14).** The matrix says every component change places its component in one family; Separator
   has no variant or size. Add a row `decoration | Separator | — | —` (one row, also used
   by future decorative parts).

## Risks / Trade-offs

- [Consumers expect text inside a separator to be read ("or")] → children are
  presentational in ARIA; the docs show text outside the separator or an `aria-label`.
- [The rendered tag is only known after mount for arbitrary `render` elements] → `hr`
  declared through `render` is known statically; for other custom elements the role is
  explicit anyway (`separator`), so SSR and client agree.

## Migration Plan

New API. Reado's menu separators move with `add-menu` (`Menu.Separator`); its
hand-rolled MenuBar dividers become `Menu.Separator` inside `Menubar` menus.
