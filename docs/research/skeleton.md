# Skeleton — research

Status: done · Wave: 3

Grey placeholder shapes shown where content is still loading, sized like the content
that will replace them. Visually trivial; for assistive technology a page full of
skeletons is either noise (dozens of empty boxes, or the stale text they wrap) or
silence (nothing says "loading"). The work is to hide the shapes, say once that the
region is loading, mark the region busy, optionally say that it finished — and stop the
shimmer for people who asked for less motion.

Sources: shallow clones read 2026-10-14 (Kobalte; React Spectrum S2 `Skeleton.tsx` via
`git show`). Bug history: `gh search issues` over the ten trackers in
[README.md](README.md) (`skeleton`, `aria-busy`) plus Material UI and Chakra UI, whose
Skeletons most apps use; ~80 hits, 15 read in full. External: Adrian Roselli, "More
Accessible Skeletons" (2020), TPGi "Short note on being busy" (both cited in the issues
below).

## Pattern

- WAI-ARIA APG: **none**. Relevant ARIA:
  - [`aria-busy`](https://www.w3.org/TR/wai-aria-1.2/#aria-busy): "an element is being
    modified and … assistive technologies may want to wait until the modifications are
    complete before exposing them". Set on the **region whose content is loading**, not on
    each placeholder. AT support is uneven (TPGi): some ignore it, some suppress the busy
    subtree's content — which would also suppress a "Loading" text placed *inside* it
    (React Aria maintainer, RS#8479).
  - The placeholders themselves carry no information: `aria-hidden="true"`; when a
    placeholder wraps real or stale children (the "skeleton over text" style), those
    children must also be unfocusable: `inert`.
  - A text alternative for the loading state: a short "Loading…" text the user can find,
    **outside** the busy element (Roselli's sibling pattern), not a live region.
- Keyboard: none. Nothing inside a loading skeleton is reachable.
- WCAG: 1.3.1 / 4.1.2 (the loading state is exposed as text, MUI#31363), 4.1.3 (load
  completion may be a status message — optional announcement), 2.2.2 (shimmer is
  moving content: it must stop when loading ends and can be paused — reduced motion
  turns it off), 2.3.1 (no flashing), 1.4.11 (placeholder shapes are not meaningful
  graphics; no contrast requirement, but they must stay visible in forced colors so the
  layout does not jump).

## How the others built it

Only Kobalte ships a headless Skeleton. React Spectrum S2, Material UI and Chakra UI
ship styled ones.

### Kobalte

- Source: `kobalte/packages/core/src/skeleton/skeleton-root.tsx`.
- One part, `Skeleton` (`div`): `visible` (default true), `animate` (default true),
  `width`, `height`, `circle`, `radius` written as **inline styles** (width 100 % by
  default), `role="group"`, `data-visible`, `data-animate`.
- Problems: `role="group"` with no name exposes an empty group per skeleton and says
  nothing about loading; children stay exposed and focusable while `visible`; no
  `aria-busy`, no loading text; `data-animate`/`data-visible` are emitted as
  `"true"`/absent, inconsistent with Kobalte's other boolean attributes
  ([KB#453](https://github.com/kobaltedev/kobalte/issues/453): the Tailwind plugin's
  `ui-animate` generated `[data-animate]` but styles needed `[data-animate="true"]`).
  Inline sizes fight the consumer's CSS.

### React Spectrum S2

- Source: `packages/@react-spectrum/s2/src/Skeleton.tsx`, `SkeletonCollection.tsx`.
- `<Skeleton isLoading>` is a **context provider** only; components that support it
  (`Text`, `Image`, form controls) render a skeleton of themselves: text gets an `inert`
  span with `box-decoration-break: clone` (one placeholder per line box) and transparent
  text; the shimmer is a Web Animation with `startTime = 0` so every placeholder on the
  page shimmers **in sync**; no animation under `prefers-reduced-motion: reduce`.
- Problems: no `aria-busy`, no loading text, no completion announcement — S2 leaves the
  loading state to the app. A context that reaches into every component is a
  design-system feature, not a headless one. A render loop with the context inside a
  DropZone ([RS#10057](https://github.com/adobe/react-spectrum/issues/10057)) came from
  double collection registration, not from the skeleton.
- [RS#8479](https://github.com/adobe/react-spectrum/issues/8479): users asked to pass
  `aria-busy` to GridList/Table while showing skeleton rows; the maintainer argued
  against putting it on the skeleton's own container ("that would prevent the loading
  state from being announced"), noted that few screen readers support it, and pointed at
  Roselli's pattern (skeleton as a *sibling* of the busy content). Closed without a
  change.

### Material UI

- `Skeleton` with `variant` (text, rectangular, rounded, circular) and `animation`
  (pulse, wave, false); renders a `span`; no ARIA.
- [MUI#26930](https://github.com/mui/material-ui/issues/26930) (open): docs should say
  to put `aria-busy` on the region and `aria-describedby` to a progress element, as for
  Progress; maintainers: "attributes should be handled userland, the Skeleton being too
  low level". [MUI#28057](https://github.com/mui/material-ui/issues/28057) /
  [#32391](https://github.com/mui/material-ui/issues/32391): `role="progressbar"`
  requested and rejected — "the nominal use case is to have **multiple** Skeleton
  rendered, while there is only **one** loading area. So aria attributes can't be hosted
  by the Skeleton". [MUI#31363](https://github.com/mui/material-ui/issues/31363): "fails
  WCAG level A … exposes no state" (closed as a docs duplicate).
  [MUI#49442](https://github.com/mui/material-ui/issues/49442) (open, 2026 assessment):
  check what AT says over a skeleton region, whether replacing it is announced, that
  pulse/wave stop when content loads and under `prefers-reduced-motion`, no flashing.
- Visual bugs: wave clipped wrong in Safari with `border-radius` + `overflow:hidden`
  during an animation ([MUI#24050](https://github.com/mui/material-ui/issues/24050), fixed
  with a mask / `transform` hint); wave too light in dark mode
  ([MUI#19429](https://github.com/mui/material-ui/issues/19429)); a family of v6 wave
  regressions (#43506, #43511, #43611, #43481, #43470 — titles: animation broken after a
  styling-engine change).

### Chakra UI

- `Skeleton isLoaded` wraps children (shown and faded in when loaded), `SkeletonText`,
  `SkeletonCircle`. [CH#2130](https://github.com/chakra-ui/chakra-ui/issues/2130):
  passing `isLoading` to each of 4–5 skeletons is tedious → request for a provider
  (declined, "a guide in the docs"). [CH#2864](https://github.com/chakra-ui/chakra-ui/issues/2864):
  "fades upon remounting" turned out to be a `Math.random()` key — the fade-in on every
  mount is real, though: a loaded skeleton must not animate in when it mounts loaded.
  [CH#2563](https://github.com/chakra-ui/chakra-ui/issues/2563): a skeleton waiting for an
  image's `onLoad` stays forever when the image was cached before the handler attached
  (the Avatar/Image hydration bug; see [avatar.md](avatar.md)).

### Not shipped

Radix, Reka, Bits, Base UI, Headless UI, Zag/Ark, React Aria Components, Ariakit.

### Reado

No skeleton. Loading states are text placeholders ("Loading…", `Editor.tsx`), some as
`role="status"` divs (`Editor.tsx`, `NotebookView.tsx`) that are mounted with their text
(silent, cause D).

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

- **One loading area, many placeholders** (MUI#28057). The ARIA lives on the area, the
  shapes are hidden. Three pieces, all rendered by rind-ui so the consumer cannot forget
  them:
  1. the **content region** carries `aria-busy="true"` while loading (removed, not set
     to `"false"`, when done — fewer attributes, same meaning);
  2. every **placeholder** is `aria-hidden="true"`, and `inert` when it wraps children
     (stale text, form controls) so nothing inside is focusable (rule 10);
  3. a **status text** ("Loading", from `messages`) rendered visually hidden as a
     **sibling** of the busy region, so AT that suppress busy content still find it
     (RS#8479, Roselli). It is plain text, not a live region (rule 23).
- **Load completion** is optionally announced (`announceOnLoad`): one polite message
  through the Announcer ("Loaded", or the consumer's string, e.g. "12 comments loaded")
  on the `loading → loaded` transition — never on mount, never when the region mounts
  already loaded, keyed per instance. Off by default: most loads are not status messages
  worth interrupting for, and a page with ten regions loading would speak ten times.
- **No `role="progressbar"`/`"status"`/`"group"`** on skeletons (MUI#28057, Kobalte's
  unnamed groups). If a determinate progress exists, it is a Progress, referenced by the
  region's `aria-describedby` (consumer, documented).
- **Focus**: nothing to focus while loading; when content arrives, focus is not moved.
  If focus was on an element that the loading replaced (a refresh button inside the
  region), that is the consumer's: documented.
- **Reduced motion** (2.2.2): the theme's shimmer runs only under
  `prefers-reduced-motion: no-preference`; under `reduce` the placeholder is static. The
  shimmer stops when loading ends because the attribute it hangs on is gone. No JS
  animation in core (S2's WAAPI sync is replaced by a CSS trick: a fixed-attachment
  gradient, so all placeholders shimmer together without script).
- **Forced colors**: placeholder fills become `Canvas`; the theme draws them with
  `GrayText` (border or `forced-color-adjust` on the fill only) so the layout stays
  readable.
- **No flashing** (2.3.1): one slow sweep (≥ 1.5 s), low contrast.
- **SSR**: everything is attributes and static text; the server HTML is already right.
- **Native platform**: nothing native (no loading pseudo-class for arbitrary content).
  `<progress>` without a value is an indeterminate progress bar — the wrong semantics for
  layout placeholders.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| React Spectrum | [#8479](https://github.com/adobe/react-spectrum/issues/8479) | `aria-busy` wanted on GridList/Table during skeleton loading; stripped by the components | Debate: busy on the skeleton's container would hide the loading text; few SRs support it | Closed without change | `aria-busy` on the content region; status text *outside* it; never rely on busy alone |
| Material UI | [#28057](https://github.com/mui/material-ui/issues/28057) | "Shouldn't Skeleton have role progressbar?" | Many skeletons, one loading area | Closed: ARIA belongs to the container | ARIA on the region part, placeholders hidden |
| Material UI | [#32391](https://github.com/mui/material-ui/issues/32391) | Same request | Same | Closed, not planned | No progressbar role on placeholders |
| Material UI | [#31363](https://github.com/mui/material-ui/issues/31363) | Skeleton "fails WCAG level A", no state exposed (VO, NVDA) | Nothing says "loading" | Closed as docs duplicate | rind-ui renders the loading text itself |
| Material UI | [#26930](https://github.com/mui/material-ui/issues/26930) (open) | Docs should give the `aria-busy` + describedby guidance of Progress | ARIA left to userland | Open | Built in, not just documented |
| Material UI | [#49442](https://github.com/mui/material-ui/issues/49442) (open) | Must check SR output over skeletons, completion announcement, animation stop and reduced motion | — | Open (WCAG 2.2) | Scenarios for each of those |
| Material UI | [#24050](https://github.com/mui/material-ui/issues/24050) | Circle skeleton with wave loses its radius in Safari | WebKit drops `border-radius` clipping of `overflow:hidden` with an animated child (known WebKit bug) | Fixed (PR #24054) | Theme animates `background-position` on the element itself, no clipped child |
| Material UI | [#19429](https://github.com/mui/material-ui/issues/19429) | Wave too bright in dark mode | Fixed light colour | Fixed: colour per scheme | Shimmer colours from tokens with `light-dark()` |
| Material UI | [#43506](https://github.com/mui/material-ui/issues/43506), [#43511](https://github.com/mui/material-ui/issues/43511) | Wave animation broken in v6 (read from titles and the fix) | v6 regression | Fixed | Visual capture of the animated state per engine |
| Kobalte | [#453](https://github.com/kobaltedev/kobalte/issues/453) | `[data-animate]` selector never matches; only `[data-animate="true"]` | Boolean attribute emitted as a string value | Fixed to match the other components | Boolean `data-*` are present-empty or absent, the rind-ui convention |
| Chakra UI | [#2130](https://github.com/chakra-ui/chakra-ui/issues/2130) | `isLoading` repeated on every skeleton | No shared loading state | Declined (docs guide) | `loading` on Root, items inherit through context |
| Chakra UI | [#2864](https://github.com/chakra-ui/chakra-ui/issues/2864) | Loaded skeleton fades in on every remount | (User's random key) but the fade runs on mount | Closed | No entry animation when mounted loaded; transitions only on the change |
| Chakra UI | [#2563](https://github.com/chakra-ui/chakra-ui/issues/2563) | Skeleton waiting on an image `onLoad` never resolves | `load` fired before the handler attached | Workaround (`complete` check) | Image + Skeleton recipe uses Image's status (image-loading-status), not `onLoad` |
| Chakra UI | [#7956](https://github.com/chakra-ui/chakra-ui/issues/7956) | Wanted a skeleton while a lazy image loads | Fallback skipped for lazy images | Closed | Image.Fallback can hold a Skeleton.Item |
| React Spectrum | [#10057](https://github.com/adobe/react-spectrum/issues/10057) | Render loop with `Skeleton isLoading` + Tabs + DropZone | Double collection registration (not the skeleton) | Fixed | A skeleton context must not re-render its subtree per frame; ours is a static attribute |

## Known pitfalls

- ARIA on each placeholder (progressbar/group/status per box).
- Busy flag on the element that also holds the "Loading" text.
- Wrapped stale text and controls still focusable and read while loading.
- Shimmer that ignores reduced motion or keeps running after load.
- Inline width/height props fighting the consumer's CSS (Kobalte).
- A completion announcement per region on a dashboard — noisy; opt-in.

## Testing notes

- The machine is two states bound to the `loading` prop; model-based tests walk
  `loading ⇄ loaded` with prop steps and assert per state: `aria-busy` on Content only
  while loading, every Item `aria-hidden` (+ `inert` when it has children) only while
  loading, the Status text present only while loading and outside Content, and the
  announcement log (zero, or one per `loading → loaded` with `announceOnLoad`).
- Virtual screen reader: reading the region while loading yields "Loading" and no
  placeholder text.
- Reduced motion emulated: no running animation on any Item (`getAnimations()` empty).
- Driver: `getSkeleton(screen, { within })` → `isLoading()`, `statusText()`.

## Decisions

- **Parts**: `Root` (`div`, context holder, no ARIA), `Status` (`span`, visually
  hidden "Loading" while loading), `Content` (`div`, `aria-busy` while loading), `Item`
  (`span`, placeholder or wrapper).
- **Machine** (`skeleton.machine.ts`): `loading` / `loaded` from a read-only prop binding
  `bindProp("loading", { states: { loading: true, loaded: false } })`; effect
  `announceLoaded` on `loading → loaded` when `announceOnLoad` is set.
- **`data-*`**: `data-state="loading|loaded"` on every part; Item `data-animate` (present
  unless `animate={false}`); `data-scope="skeleton"`, `data-part`.
- **Contract**: locate within a container; queries `isLoading`, `statusText`; events
  `$sync:loading` → prop steps; no actions; no traits.
- **Deliberately different**: ARIA on the region, not the shapes (MUI's lesson, Kobalte
  gets it wrong); loading text rendered by us, outside the busy element (Roselli,
  RS#8479); no inline sizes (consumer CSS / theme tokens); no `circle`/`radius` props
  (tokens); no JS shimmer.

## Open questions

- Should Content be omittable (Root marks itself busy, Status rendered before Root by
  the consumer)? Kept as a part: a region that is a list or table needs the busy flag on
  that element, which `render` on Content gives.
