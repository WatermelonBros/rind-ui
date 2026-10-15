## Context

See proposal.md and [avatar.md](../../../docs/research/avatar.md). This change consumes,
without restating:

| From | Used for |
|---|---|
| `add-foundations` | `setup()`/`machine()`, read-only status with `onStatusChange` change details, `onProps`, delayed transitions (scheduler), effects, service lifecycle (late sends ignored), contracts (`{ skip }`, `$props` steps), drivers, `testMachine`, React adapter (`render`, ids, part registration, `data-instance`) |
| `add-a11y-foundations` | dev name check (missing name = dev error), `messages` + provider, `Intl.PluralRules` formatting, `core/dom/visually-hidden` (overflow label), generic invariants, announcement log (empty) |
| `add-theme-system` | tokens, `@layer rind.components`, variant/size/tone conventions, motion tokens, forced-colors rules |

## Goals / Non-Goals

**Goals:** the rendered `<img>` is the only loader; one name for every status; no
fallback flash for cached or server-rendered images; a fallback that always comes back.

**Non-Goals:** preloading, retries, initials, group layout logic, an Image component.

## Decisions

### 1. Layout

```
packages/core/src/dom/image-status.ts        settled(img): "loaded" | "error" | "loading" | Promise<"loaded" | "error">
packages/core/src/components/image-status/
└─ image-status.machine.ts  idle | loading | loaded | error  (image-loading-status; shared with Image)
packages/core/src/components/avatar/
├─ avatar.machine.ts      re-exports the image-status machine as `avatarMachine`
├─ avatar.connect.ts      root/image/fallback/group/groupOverflow props
├─ avatar.contract.ts
└─ avatar.messages.ts     overflowLabel(count)
packages/react/src/avatar/   Root, Image, Fallback, Group, GroupOverflow
packages/theme/src/avatar.css
```

`image-status.ts` is the `image-loading-status` capability's DOM half; the machine
half is the four states below. The machine lives at the shared
`components/image-status/` path (from add-image) with `avatarMachine` as an alias, so
Image reuses both without a move (no generalisation beyond that: the machine is
exported, not abstracted).

### 2. Machine

```
            IMAGE.MOUNT{hasSource} / IMAGE.SOURCE{hasSource}  (settled → target)
   idle ───────────────────────────────────────────────────────► loading
    ▲  ▲                                                          │  │
    │  └──── IMAGE.UNMOUNT · IMAGE.SOURCE{!hasSource} ◄───────────┘  │ IMAGE.LOAD
    │                                                                ▼
    │                                        error ◄── IMAGE.ERROR ─ loaded
    └── IMAGE.UNMOUNT · IMAGE.SOURCE{!hasSource} (from every state)
   loading: after fallbackDelay → FALLBACK.DELAY (sets fallbackReady)
   root:    ROOT.MOUNT (sets mounted) · IMAGE.SETTLED{status, source}
```

```ts
type AvatarEvent =
  | { type: "ROOT.MOUNT" }
  | { type: "IMAGE.MOUNT" | "IMAGE.SOURCE"; hasSource: boolean; source: number; settled: "loaded" | "error" | "loading" }
  | { type: "IMAGE.SETTLED"; status: "loaded" | "error"; source: number } // decode() result
  | { type: "IMAGE.LOAD" | "IMAGE.ERROR"; source: number }
  | { type: "IMAGE.UNMOUNT" }
  | { type: "FALLBACK.DELAY" }
```

- **Context**: `source` (a counter bumped on each source change, so events from a
  previous source are dropped by the guard `isCurrentSource`), `mounted`,
  `fallbackReady` (initial `fallbackDelay === 0`; set by `ROOT.MOUNT` when status is
  `idle`/`error`, by `FALLBACK.DELAY`, by entering `error`; never cleared).
- **`IMAGE.MOUNT` / `IMAGE.SOURCE`**: the React Image part sends them from a layout
  effect (registration, commit-time — never during render) with `settled` from
  `core/dom/image-status.ts`: `complete && naturalWidth > 0` → `loaded`, `!complete` →
  `loading`, `complete && naturalWidth === 0` → `loading` plus a `decode()` whose result
  arrives as `IMAGE.SETTLED`. Guards pick the target from `settled`; the hydration case
  is just a `settled: "loaded"` mount.
- **`onStatusChange`** is a status observer (`bindProp`-style read-only status with a
  change callback), never a controllable.
- **Server snapshot**: `idle` (no image registered yet); Fallback rendering on the
  server follows `fallbackReady` (true only when `fallbackDelay === 0`), so server and
  first client render agree.
- Why not Zag's observers: attribute/child `MutationObserver`s duplicate what props and
  part registration already tell the machine.

### 3. Connect output

| Part | Attributes |
|---|---|
| Root | `span`, `role="img"` when named and not `aria-hidden`, consumer name passed through, `data-state`, `id` |
| Image | `img`, `alt=""` unless given, `hidden` in `error` and `idle` (no source; from add-image), `data-state`, `onLoad`/`onError` → `IMAGE.LOAD`/`IMAGE.ERROR` (merged with the consumer's), `src` omitted when empty and emitted after `srcSet`/`sizes`/`loading` |
| Fallback | `span`, `data-state`; rendered iff status ≠ `loaded` && `fallbackReady` |
| Group | `div role="group"`, consumer name; dev warning when unnamed |
| GroupOverflow | `span`; children `<span aria-hidden="true">+{count}</span>` + visually hidden `overflowLabel(count)` |

The name check runs after mount on Root (role `img` requires a name). No inline styles.

### 4. Contract

```ts
export const avatarContract = contract(avatarMachine, {
  scope: "avatar",
  locate: { role: "img", name: true, part: "root", fallback: "data-instance" },
  queries: { status, isFallbackVisible, name },
  actions: { waitForStatus: { postcondition: (env, s) => status(env) === s, keyboard: { none: "observation only" } } },
  events: {
    "IMAGE.LOAD": { skip: "browser image fixtures" }, "IMAGE.ERROR": { skip: "browser image fixtures" },
    "IMAGE.MOUNT": { skip: "browser image fixtures" }, "IMAGE.SETTLED": { skip: "browser image fixtures" },
    "IMAGE.SOURCE": { skip: "driven by the $props:src step" }, "IMAGE.UNMOUNT": { skip: "driven by the $props:src step (undefined)" },
    "$props:src": { props: (src) => ({ src }) }, // values: data URL, 404 URL, slow URL, undefined
    "ROOT.MOUNT": { skip: "mount" }, "FALLBACK.DELAY": { skip: "fake clock unit test" },
  },
})
```

Props classes: no source; data-URL source; 404 source; slow source (500 ms) with
`fallbackDelay` 0 and 300; decorative; group with overflow.

### 5. Theme

`avatar.css`: `--rind-avatar-size`, `-radius` (default full), `-bg`, `-text`,
`-font-size` (relative to size), `-font-weight`, `-ring` (group separator),
`-group-overlap`, `-overflow-bg`, `-overflow-text`. Root is a grid;
Image and Fallback share `grid-area: 1 / 1`, Image on top and always opaque: the
browser paints it over the Fallback as its bytes arrive, so a cached or server-rendered
image is never delayed by a fade. Group: flex row,
`margin-inline-start: calc(var(--rind-avatar-group-overlap) * -1)` from the second item,
ring via `outline` (survives forced colors). Variants soft (tinted fallback), solid,
outline; sizes sm, md, lg; `data-tone`. Forced colors: Fallback `border: 1px solid
CanvasText`.

### Requests to other changes

1. **`add-theme-system`** (`theme-variants` → Family Matrix): add the family
   **identity** — Avatar, Avatar Group — with `data-variant` solid, **soft**, outline and
   `data-size` sm, **md**, lg. No existing family fits (status is Badge/Tag/Alert; an
   avatar is neither status nor action). APPLIED (coordinator, 2026-10-14): add-theme-system `theme-variants` Family
   Matrix, task A.5.

## Risks / Trade-offs

- [No inline hiding while loading: an unstyled avatar shows image and fallback side by
  side] → the theme stacks them; the docs show the three-line stacking CSS for
  consumers without the theme. Chosen over `display:none`, which breaks `loading="lazy"`.
- [`fallbackDelay > 0` leaves the server HTML without a fallback] → documented as a
  client-side option; with the stacked layout the delay is rarely needed.
- [`decode()` branch exists only for `naturalWidth === 0` SVGs] → browser test per
  engine; drop the branch if no engine needs it (research open question).
- [`role="img"` hides an inner `alt` the consumer wrote] → the docs say to name Root;
  a dev warning when Image has a non-empty `alt` that differs from Root's name.

## Migration Plan

Reado `atoms/PersonAvatar.tsx`: `<Avatar.Root aria-hidden data-size="sm"
style={{ "--rind-avatar-bg": personTint(hue) }}>` with `<Avatar.Image src={url} />` and
`<Avatar.Fallback>{initials || "·"}</Avatar.Fallback>`; it gains an error fallback.
Radix/Base UI: `delayMs`/`delay` on Fallback → `fallbackDelay` on Root;
`onLoadingStatusChange` on Image → `onStatusChange` on Root; `alt` on Image → name on Root.
