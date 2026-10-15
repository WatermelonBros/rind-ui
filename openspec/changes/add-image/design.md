## Context

See proposal.md and [image.md](../../../docs/research/image.md). This change consumes,
without restating:

| From | Used for |
|---|---|
| `add-avatar` | `image-loading-status` (status values, the rendered element as the loader, settled-before-hydration, source changes, lazy-safe rendering, late events) and its implementation: `core/dom/image-status.ts`, the four-state machine with `fallbackDelay`/`fallbackReady` and the source counter, Avatar's browser image fixtures |
| `add-foundations` | runtime (read-only status, `onStatusChange` details, delayed transitions), contracts (`{ skip }`, `$props` steps), drivers, `testMachine`, React adapter (`render`, ids, part registration) |
| `add-a11y-foundations` | dev logger and dev name check, invariants (rules 1, 4, 6) |
| `add-theme-system` | tokens, `@layer rind.components`, forced-colors rules, family matrix (request 2) |

## Goals / Non-Goals

**Goals:** reuse Avatar's status machinery unchanged; one name per status; `alt` as a
compile-time decision.

**Non-Goals:** placeholders, coordination, zoom (proposal Non-goals).

## Decisions

### 1. Generalise the status machine (second user)

Avatar's design kept the four-state machine inside `avatar/` "exported, not abstracted"
until a second component needed it. Image is that component, so this change moves it:

```
packages/core/src/components/image-status/image-status.machine.ts   (moved; id "image-status")
packages/core/src/components/avatar/avatar.machine.ts               re-export: avatarMachine = imageStatusMachine
packages/core/src/components/image/{image.connect,image.contract}.ts
packages/react/src/image/   Root, Img, Fallback
packages/theme/src/image.css
```

The move is behaviour-preserving: Avatar's tests run unchanged before and after
(task 1.1). If `add-avatar` is implemented after this change is approved, it is written
at the shared path directly (request 1).

### 2. Connect output

| Part | `idle` | `loading` | `loaded` | `error` |
|---|---|---|---|---|
| Root (named) | `role="img"`, `aria-label={alt}` | — | — | `role="img"`, `aria-label={alt}` |
| Root (decorative) | `data-decorative` | `data-decorative` | `data-decorative` | `data-decorative` |
| Img | `alt`, `hidden`, no `src` | `alt`, `src` last | `alt` | `alt`, `hidden` |
| Fallback | `aria-hidden="true"`, rendered per fallback timing | same | not rendered | same |

All parts: `data-scope="image"`, `data-part`, `data-instance`, `data-state`. `alt`
undefined at runtime → dev error, `alt` attribute omitted. Root `aria-label` is never
emitted for decorative images (rule 4: no name on a role-less element). The Img's
`hidden` in `idle` is the extension in request 1.

*Alternatives:* Avatar's "Root is always `role="img"`" — one rule, but the content image
loses native `alt` (translation, `<figure>` association) in the common `loaded` case;
Fallback as the named element — leaves a gap when no Fallback is rendered or a delay
holds it back. Root covers every gap because it is always rendered.

### 3. Contract

```ts
export const imageContract = contract(imageStatusMachine, {
  scope: "image",
  anatomy: ["root", "img", "fallback"],
  locate: { role: "img", name: true, fallback: "data-instance" },
  queries: { status, isFallbackVisible, name },
  actions: { waitForStatus: { postcondition: (env, s) => status(env) === s, keyboard: { none: "observation only" } } },
  events: { /* as avatarContract: IMAGE.* { skip: "browser image fixtures" }, "$props:src" steps, ROOT.MOUNT / FALLBACK.DELAY skips */ },
  traits: [],
})
```

Per-contract invariants: the Model-Based Coverage list in the spec.

### 4. Theme

`image.css`: Root `display: grid; aspect-ratio: var(--rind-image-aspect-ratio, auto);
overflow: hidden; border-radius: var(--rind-image-radius, 0)`; Img and Fallback
`grid-area: 1 / 1`; Img `inline-size: 100%; block-size: 100%; object-fit:
var(--rind-image-fit, cover)` (with the default ratio `auto`, Root's block size follows
the image, so the fit only matters once a ratio is set); no transition on Img; Fallback centred content, `--rind-image-fallback-bg`,
`-fallback-text`; forced colors: Fallback `border: 1px solid CanvasText`. Family:
`decoration` (request 2).

## Requests to other changes

1. APPLIED (coordinator, 2026-10-14; add-avatar A.1–A.2): **`add-avatar`** (`image-loading-status` → "Lazy-Safe Rendering", and design §1):
   (a) change "Only in `error` SHALL the element carry `hidden`" to "In `error`, and in
   `idle` (no `src` and no `srcSet`), the element SHALL carry `hidden`" — a source-less
   `<img>` with a non-empty `alt` draws alt text and duplicates the name (Avatar's
   `alt=""` makes the change invisible there); add the scenario "No source → `<img>`
   hidden". (b) Implement the machine at
   `core/components/image-status/image-status.machine.ts` with `avatarMachine` as an
   alias, so Image reuses it without a move (if Avatar lands first, this change's task
   1.1 does the move).
2. APPLIED (coordinator, 2026-10-14; add-theme-system A.8): **`add-theme-system`** (`theme-variants` → Family Matrix): add Image to the
   **decoration** family (no `data-variant`, no `data-size`; look via
   `--rind-image-*` tokens), with Skeleton (add-skeleton's request) and Separator.

## Risks / Trade-offs

- [The named element moves between `<img>` and Root when a load fails] → same name text,
  same role; a screen reader positioned on it keeps reading the same name. Tested with
  the virtual screen reader.
- [Request 1 not accepted] → Image's connect still emits `hidden` on a source-less Img
  itself (it owns its connect); only the shared spec wording differs.
- [`alt` required breaks untyped JS callers loudly] → intended: a missing text
  alternative is a WCAG A failure.

## Migration Plan

Reado `organisms/ImageView.tsx`: `<Image.Root alt={name} style={{ "--rind-image-fit":
"contain" }}>` with `<Image.Img src={dataUrl} ref={…} onLoad={readSize} />` and
`<Image.Fallback>{t("imageView.failed")}</Image.Fallback>`; the `role="alert"` paragraph
goes (or becomes an `Alert announce="polite"` beside the image, add-alert). Kobalte:
`Image.Img alt` → `Image.Root alt`; `onLoadingStatusChange` → `onStatusChange`.
