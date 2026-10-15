## Context

See proposal.md and [skeleton.md](../../../docs/research/skeleton.md). This change
consumes, without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, read-only prop binding `bindProp` with `$sync` transitions, effects, contracts (prop steps), drivers, `testMachine`, React adapter (`render`, ids, context between parts, `data-instance`) |
| `add-a11y-foundations` | `Announcer.announce`/`prepare`, recording backend + announcement log, `messages` + provider, `core/dom/visually-hidden`, inert value across React versions, invariants (rule 10: no focusable element inside `aria-hidden`; rule 23) |
| `add-theme-system` | tokens, `@layer rind.components`, motion tokens and the reduced-motion rule, forced-colors conventions, family matrix (request below) |

## Goals / Non-Goals

**Goals:** the loading area's ARIA is built in; placeholders are silent and
unreachable; zero script motion; server HTML already correct.

**Non-Goals:** skeleton variants of other components, size/shape props (proposal
Non-goals).

## Decisions

### 1. Layout

```
packages/core/src/components/skeleton/
├─ skeleton.machine.ts    loading | loaded (bound to the loading prop)
├─ skeleton.connect.ts    root/status/content/item props
├─ skeleton.contract.ts
└─ skeleton.messages.ts   loading, loaded
packages/react/src/skeleton/   Root, Status, Content, Item
packages/theme/src/skeleton.css
```

### 2. Machine

```
   loading ──$sync:loading(false)──► loaded      (exit loading → announceLoaded, guarded)
      ▲                                │
      └──────$sync:loading(true)───────┘
```

```ts
setup({ guards: { announces /* props.announceOnLoad != null && !== false */, sawLoading },
        actions: { announceLoaded, prepareAnnouncer, markSawLoading } })
.machine({
  id: "skeleton",
  context: () => ({ sawLoading: false }),
  values: { loading: bindProp("loading", { states: { loading: true, loaded: false } }) },
  initial: "loading",                      // resolved from the prop at creation (SSR-correct)
  on: { "ROOT.MOUNT": { actions: [{ action: "prepareAnnouncer", guard: "announces" }] } },
  states: {
    loading: { entry: ["markSawLoading"] },
    loaded: { entry: [{ action: "announceLoaded", guard: ["announces", "sawLoading"] }] },
  },
})
```

- Read-only binding (add-button precedent for `pending`): the initial snapshot already
  matches the prop. `sawLoading` (set on every entry into `loading`, including the
  creation entry) makes `loaded`'s entry announce only after a real `loading → loaded`:
  a Skeleton created loaded never announces; one created loading announces when it
  finishes; every later reload announces again.
- `announceLoaded`: `announce({ message: typeof announceOnLoad === "string" ?
  announceOnLoad : messages.loaded, priority: "polite", key: \`skeleton-${id}\`, lang })`.
- Items do not have their own machine: an Item's `loading` prop override is a connect
  input (`item.loading ?? root.state === "loading"`), not a state; announcements belong to
  the Root only.

### 3. Connect output

| Part | Loading | Loaded |
|---|---|---|
| Root | `data-state="loading"` | `data-state="loaded"` |
| Status | visually hidden props, renders `messages.loading` / children | renders nothing |
| Content | `aria-busy="true"` | no `aria-busy` |
| Item | `aria-hidden="true"`, `inert` (only with children), `data-animate` (unless `animate={false}`) | nothing but scoping attributes and `data-state` |

All parts: `data-scope="skeleton"`, `data-part`, `data-instance`, `data-state`; consumer
`data-variant`/`data-size`/`data-tone` passed through. No inline styles. The Status
placement warning runs after mount (`status.closest('[data-scope=skeleton][data-part=content]')`,
development only).

### 4. Contract

```ts
export const skeletonContract = contract(skeletonMachine, {
  scope: "skeleton",
  anatomy: ["root", "status", "content", "item"],
  locate: (opts: { within: PartHandle }) => ({ part: "root", within: opts.within }),
  actions: {},
  queries: { isLoading, statusText },
  states: { loading: { isLoading: true }, loaded: { isLoading: false } },
  events: {
    "$sync:loading": { props: (to) => ({ loading: to === "loading" }) },
    "ROOT.MOUNT": { skip: "mount" },
  },
  traits: [],
})
```

Per-contract invariants (registered with the contract, run by `testMachine`): the
Model-Based Coverage list in the spec. Props classes: with/without `announceOnLoad`,
with/without wrapping Items, `animate` on/off.

### 5. Theme

`skeleton.css`: Item `display: inline-block` (block when it has block children), fill
`--rind-skeleton-bg` (→ neutral `soft`), highlight `--rind-skeleton-highlight`, radius
`--rind-skeleton-radius` (→ small radius; circles by token override),
`--rind-skeleton-line-height`. Wrapping Items: `color: transparent;
-webkit-text-fill-color: transparent; box-decoration-break: clone` (one shape per line
box, React Spectrum's technique) and `visibility: hidden` on descendants that are not
text. Shimmer: `@media (prefers-reduced-motion: no-preference)` →
`[data-animate]` gets a `linear-gradient` background with `background-attachment:
fixed` and `background-size` of the viewport, animated by `background-position` with a
duration token (≥ 1.5 s); fixed attachment puts every Item on the same gradient, so they
shimmer in phase without script (replaces S2's WAAPI `startTime = 0`). Animating the
Item's own background avoids the WebKit radius-clipping bug of clipped children
(mui/material-ui#24050). Forced colors: `background: GrayText` with
`forced-color-adjust: none` on the fill only. Family: `decoration` (request 1).

## Requests to other changes

1. APPLIED (coordinator, 2026-10-14; add-theme-system A.8): **`add-theme-system`** (`theme-variants` → Family Matrix): add Skeleton to the
   **decoration** family (no `data-variant`, no `data-size`; sizes via
   `--rind-skeleton-*` tokens), next to Separator. Same request as add-image's for
   Image.

## Risks / Trade-offs

- [`aria-busy` support is uneven] → it is a hint only; the loading text outside the
  region carries the information (research).
- [`background-attachment: fixed` is ignored on iOS Safari for some elements, losing
  phase sync] → visual only; each Item still shimmers.
- [Placeholders inside lists/tables (`li`, `tr`) hidden with `aria-hidden` change the
  exposed item count while loading] → documented: Content's `render` is the list; the
  set size AT reports while loading is zero, which matches "loading".

## Migration Plan

New API. Kobalte: `Skeleton visible` → `Skeleton.Root loading` + `Skeleton.Item`;
`width`/`height`/`circle`/`radius` → CSS and `--rind-skeleton-radius`. MUI/Chakra:
`variant="text"` → a wrapping Item over the text; `isLoaded` → `loading={!isLoaded}`.
Reado (optional): `Editor` loading placeholder becomes a Skeleton with a Status.
