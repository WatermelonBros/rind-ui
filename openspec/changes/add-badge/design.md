## Context

See proposal.md for why and specs/badge/spec.md for behaviour. Research and the Bug
history the scenarios cite: [badge.md](../../../docs/research/badge.md). This change
consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | contracts, drivers, React adapter (`render`, stable ids from the instance id, instance scoping attributes, reserved theme attributes pass-through) |
| `add-a11y-foundations` | injected development logger, `core/dom/visually-hidden`, generic invariants (rule 4: no name on `generic`; rule 23: no `aria-live` of its own) |
| `add-theme-system` | tier-3 token convention, `@layer rind.components`, `:where()` selectors, `status` family (Badge already listed), contrast checks in the builder |

## Goals / Non-Goals

**Goals:** one place that decides what a badge exposes; a development check for the
host-name trap; zero runtime cost (no machine, no subscriptions).

**Non-Goals:** announcing, count formatting, positioning (proposal Non-goals).

## Decisions

### 1. No machine (Separator precedent)

No states, no events. The component ships connect, parts, contract, driver, tests,
theme, stories and docs; the docs generator marks it **stateless** (no states table,
no `testMachine` section).

### 2. Connect

```ts
// core/components/badge/badge.connect.ts
export interface BadgeProps { label?: string | undefined; id?: string }
export function badgeConnect(props: BadgeProps, env: { log: Logger; ids: Ids }): {
  root: { id: string; "data-scope": "badge"; "data-part": "root" }
  content: { "aria-hidden": "true" } | null        // wrapper for children when label is set
  label: VisuallyHiddenProps | null                // the visually hidden label
}
```

- `label` set → the React part renders `<span {...root}><span {...content}>{children}
  </span><span {...label}>{label}</span></span>`; otherwise children directly. The same
  structure Avatar's `GroupOverflow` uses; the wrapper exists only with `label`, so a
  plain badge is one element.
- Development checks (logger, development builds only):
  - at render: consumer `role` ∈ {status, alert, log} or any `aria-live` → warning
    (forwarded anyway: Liskov — the element gets what the consumer passed);
    `aria-label`/`aria-labelledby` on root → warning recommending `label`.
  - after mount (`core/dom/badge-host.ts`, one small function): if the root is exposed
    (no `aria-hidden` on it or an ancestor) and has no text and no `label` → warning;
    find the closest interactive host (`closest()` over the role list in the spec, native
    `button`, `a[href]`, `[role=…]`); if it has `aria-label`/`aria-labelledby`, compare
    the host's label text (attribute value or the referenced elements' text) with the
    badge's spoken text (case- and whitespace-insensitive `includes`) and its
    `aria-describedby` tokens with the badge id → warning when neither holds. This is a
    heuristic over attributes, not an accname computation (accname lives in
    `@rind-ui/testing`, decision 0008); the precise check runs in the browser tests.

*Alternatives:* Kobalte's `role="status"` + `aria-label` (live region; label on a span
is ignored — rejected, research Accessibility); automatically adding the badge id to
the host's `aria-describedby` from the badge (writes an attribute on an element rind-ui
does not own and React overwrites on its next render — rejected); computing the full
accessible name in core (duplicate of `dom-accessibility-api`, 0008 — rejected).

### 3. Parts (React)

`Badge.Root` — thin: calls `badgeConnect`, forwards props, `render` support, the
post-mount check in a development-only layout effect.

### 4. Contract

```ts
export const badgeContract = contract("badge", {
  anatomy: ["root"],
  locate: (opts: { within: PartHandle; index?: number }) => ({ part: "root", within: opts.within }),
  actions: {},
  queries: { text, isExposed },   // text: visually hidden label or text content; "" when aria-hidden
  traits: [],
})
```

No events (no machine). `getBadge` is generated from it.

### 5. Theme

`packages/theme/src/badge.css`, `@layer rind.components`,
`:where([data-scope="badge"][data-part="root"])`: tokens `--rind-badge-bg`, `-text`,
`-border`, `-radius` (→ full), `-height` (→ a size step in `em` of the control text),
`-padding-inline`, `-font-size`, `-font-weight`. `display: inline-flex; align-items:
center; justify-content: center; min-inline-size: var(--rind-badge-height);
block-size: var(--rind-badge-height); line-height: 1; justify-self/align-self: start`
(never stretches). Variants through the palette roles (`soft` default, `solid`,
`outline`); sizes `sm`/`md`/`lg`; `data-tone` re-points the palette (accent, neutral,
danger, warning, success). Forced colors: `border: 1px solid CanvasText`. No corner
positioning (docs recipe with `inset-inline-end`).

## Requests to other changes

None. `add-theme-system`'s `status` family already lists Badge.

## Risks / Trade-offs

- [The host-name check is a heuristic (substring of attribute text)] → it can miss
  a label that paraphrases the count; the browser test suite and the host's own driver
  check the real accessible name.
- [Consumers will keep using `aria-label` on icon buttons] → the warning names both
  remedies; the docs page leads with the name-from-content recipe and explains why
  (translation, VoiceOver hints).

## Migration Plan

Reado `atoms/Badge.tsx` → `Badge.Root` with `data-tone` (accent, neutral; `soft` and
`marker` map to `data-variant="soft"` and `data-tone="danger"`); the size override
classes become `data-size="sm"`. `ActivityBar.tsx`: the `IconButton` keeps its
`aria-label` and gains `aria-describedby` → the badge id with `label={t("…", { count })}`,
or drops `aria-label` for a visually hidden label (preferred). `GitPanel.tsx`: the Sync
badge becomes `aria-hidden` (its label already states the counts). Kobalte users:
`textValue` → `label`; `role="status"` is gone (announce with the Announcer if needed).
