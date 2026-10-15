# Avatar — research

Status: done · Wave: 2

An Avatar shows a person (or organisation) as an image, with a fallback — initials, an
icon — while the image is missing, loading or broken. Five libraries ship it: Ark (Zag),
Radix, Base UI, Reka and Bits UI; Kobalte ships the same thing as **Image**. It has no
interaction; all of its difficulty is the **image loading status** and when to show the
fallback, and nearly every bug below is one of four: the fallback flashes, the fallback
never comes back, the image is fetched by a hidden probe instead of the rendered element,
or the status ignores how the image is fetched.

Sources read 2026-10-14 (local clones, paths relative to each repo). Reado's
`src/components/atoms/PersonAvatar.tsx` read read-only.

## Pattern

- WAI-ARIA APG: **none** ([accessibility.md §1.5](accessibility.md): "QR Code / Avatar /
  Image (`img` + name)"). The closest rules are the [W3C images
  tutorial](https://www.w3.org/WAI/tutorials/images/) and HTML's `alt` rules: an
  informative image has a text alternative that says what it conveys (here: who); a
  decorative image — an avatar next to the person's visible name — has `alt=""` and is
  hidden from AT.
- Roles and attributes: `img` (native `<img alt>`, or `role="img"` + `aria-label` on a
  container); the name is required (axe `image-alt`, `role-img-alt`). `role="img"` has
  presentational children, so whatever is inside (an `<img>`, initials text, an SVG) is
  not read separately.
- Keyboard: none. An avatar is not focusable unless the consumer renders it as (or inside)
  a button or link, which then takes its name from the avatar's name.
- Avatar groups ("stacked faces" + "+3"): no pattern; a `group` with a name, each avatar
  an `img`, the overflow counter as text ("3 more").

## How the others built it

### Zag / Ark UI

- Source: `zag/packages/machines/avatar/src/{avatar.machine,avatar.connect,avatar.dom,avatar.types}.ts`;
  `ark/packages/{react,vue,svelte,solid}/src/components/avatar/*`; Ark's styled recipe
  `ark/website/src/components/ui/{avatar,avatar-group}.tsx`.
- API shape: `Root`, `Image`, `Fallback`; `onStatusChange({ status })`; `api.setSrc`,
  `setLoaded`, `setError`.
- State model: a real machine, `loading | loaded | error` (no `idle`). `loading` entry runs
  `checkImageStatus`: if the **rendered** `<img>` is already `complete`, it sends
  `img.loaded`/`img.error` (comment-free, but this is the hydration case). Effects: a
  `MutationObserver` on the image's `src`/`srcset` (→ `loading`) and on the root's
  children (image removed → `error`). `onLoad`/`onError` on the element.
- Notable: the status comes from the element the user sees, so `srcset`, `loading`,
  `referrerpolicy`, CDN loaders all just work, and the server HTML contains the `<img>`.
  The only library that detects images completed before hydration.
- Problems: the image is `hidden` while loading. `hidden` is `display: none`, and an
  image with `loading="lazy"` that is not rendered never intersects the viewport, so a
  lazy avatar would never load (found by reading the source; no issue filed). Fallback
  has no delay. Observers on attributes instead of props. Using a custom image component
  means spreading Zag's props, and `hidden` toggling looped with `next/image`
  (ARK#3426). `hasLoaded` uses `naturalWidth !== 0`.

### Radix

- Source: `radix/packages/react/avatar/src/avatar.tsx`.
- API shape: `Avatar` (Root), `AvatarImage` (`onLoadingStatusChange`), `AvatarFallback`
  (`delayMs`). Dev warning when more than one Image is rendered (`useImageCount`).
- State model: `idle | loading | loaded | error` in Root context. `useImageLoadingStatus`
  creates a detached `new window.Image()` in a layout effect, copies `src`,
  `referrerPolicy`, `crossOrigin`, and reads `complete`/`naturalWidth` synchronously
  after setting `src` (the fix for the client-side cached flash, RX#2044). The `<img>` is
  rendered **only once loaded**; cleanup resets to `idle` (the RX#1767 fix).
- Notable: delay timer on Fallback mount; the probe makes the status independent of
  rendering.
- Problems: the probe is the root of most of its history — every `<img>` attribute has to
  be copied by hand (referrerPolicy RX#1616, crossOrigin RX#3312), `loading="lazy"` is
  meaningless (RX#2512, open), preload hints are ignored (RX#3727), a custom image
  component is fetched twice, and nothing is in the server HTML, so SSR always shows the
  fallback first (RX#2044 comments; BU#4468 analysis).

### Base UI

- Source: `base-ui/packages/react/src/avatar/{root/AvatarRoot.tsx,image/AvatarImage.tsx,image/useImageLoadingStatus.ts,fallback/AvatarFallback.tsx}`.
- API shape: `Avatar.Root`, `Avatar.Image` (`onLoadingStatusChange`, `keepMounted`,
  `render`), `Avatar.Fallback` (`delay`). Transition attributes on Image only (BU#4109).
- State model: Radix's four statuses and probe by default; `keepMounted` (BU#5529,
  BU#2597, PR#5536) switches to **the rendered element as the source of truth**: on every
  commit a layout effect reads `image.complete` / `naturalWidth`; `onLoad`/`onError` set
  the status; while not loaded the image gets `data-loading` / `data-error` and
  **`aria-hidden`** ("until the image is displayable, the fallback owns the accessible
  name; without this both would be exposed … including in server HTML"); an image already
  complete on the first commit "was painted before hydration", so it mounts without
  replaying the enter transition.
- Notable: the most complete design; also orders `src` **after** `srcSet`/`sizes`
  because "React 17 and 18 set attributes in props order, and Safari and Firefox start
  fetching as soon as `src` lands, ignoring a `loading` or `srcSet` that arrives after
  it". Once a delay-less fallback is visible a later delay never re-hides it.
- Problems: two modes with different semantics; the delay also hides the fallback when
  there is no image at all or it already failed (BU#5988, open); SSR cached flash in the
  default mode (BU#4468, open).

### Reka UI

- Source: `reka-ui/packages/core/src/Avatar/{AvatarRoot,AvatarImage,AvatarFallback}.vue`, `utils.ts`.
- Radix port with a probe and `v-show` on the image (so the `<img>` is in the DOM but
  `display: none` while loading — same lazy-loading trap as Zag). `role="img"` on an
  `<img>` (redundant, rule 4 of accessibility.md §1.4). `delayMs` on Fallback.
  SSR support was a feature request (RK#751). A maintainer notes the component has "no
  specific a11y" and is meant for dynamic profile URLs (RK#1169).

### Bits UI

- Source: `bits-ui/packages/bits-ui/src/lib/bits/avatar/avatar.svelte.ts`.
- Probe on Root; **`delayMs` delays the `loaded` status** (the image), not the fallback —
  the opposite of the others. `display: none` inline on the image until loaded; the
  fallback once wrote `style="display: undefined;"` into the HTML (BITS#1351). Early
  bug: `src → undefined` left the old image (BITS#88). Teardown races: a timer reading a
  destroyed context after `onload` (BITS#2050). An Avatar Group was proposed and declined
  as "more stylistic" (BITS#298).

### Kobalte (Image)

- Source: `kobalte/packages/core/src/image/{image-root,image-img,image-fallback}.tsx`.
- Radix port named Image: `fallbackDelay` and `onLoadingStatusChange` on Root, probe in
  `Img`, `<Show when=loaded>`. Same strengths and limits as Radix.

### Not shipped

React Aria Components and Headless UI have no Avatar (Spectrum's styled Avatar is a plain
`<img>` with `alt`, RS#1345; avatars in a ListBox use the icon slot, RS#5428). Ariakit has
none.

### Reado

`PersonAvatar` renders `<img alt="">` when a URL is known, else a `span aria-hidden`
with up to two initials on a per-person hue (`personHue`, `personTint`). It is always
decorative (it sits beside the author's visible name). It has **no error fallback**: a
broken URL shows a broken image. `w[0]` splits surrogate pairs (an emoji or some CJK
names give half a character). Migration: `<Avatar.Root aria-hidden>` with `Image` and
`Fallback`; the hue stays a consumer style (`--rind-avatar-bg`).

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

- **One name, whatever the status.** If the `<img alt>` names the avatar while it is
  loaded and the initials text names it otherwise, the name changes with network timing
  ("Ada Lovelace" vs "AL"), and during loading both may be exposed (Base UI's comment).
  Decision: the **Root** is the named element — `role="img"` with the consumer's
  `aria-label`/`aria-labelledby` — so the inner `<img>` and the initials are presentational
  children, and the `<img>` renders `alt=""` (which also stops browsers drawing alt text
  or a broken-image glyph). The name never changes during loading (rule 6).
- **Decorative avatars** (next to a visible name: Reado's case, message threads, comment
  lists): the consumer puts `aria-hidden="true"` on Root; connect then drops `role="img"`.
  An avatar that is neither named nor hidden is a development error (rule 1; axe
  `role-img-alt`).
- **Initials are not a name.** "AL" read aloud is noise; the docs tell consumers to name
  the avatar with the full name, not the initials.
- **Inside interactive elements** (an account-menu trigger): the button's
  name-from-content includes the avatar's `aria-label`, so "Ada Lovelace" is announced
  without extra work. Target size (2.5.8) is the button's concern.
- **No announcements.** Status changes are not status messages (4.1.3); never live.
- **Forced colors**: the fallback's background disappears; the theme draws a
  `CanvasText` border so the circle stays visible. Initials use `currentColor`.
- **Text spacing / zoom**: initials sized relative to the avatar (theme), never clipped
  by a fixed line height.
- **RTL**: group overlap uses logical properties (`margin-inline-start`); no behaviour
  difference.
- **Reduced motion**: nothing moves; the theme does not fade the image (a fade would
  delay a cached image and needs the reduced-motion path for no benefit).
- **Native platform**: the `<img>` element itself is the loader — `loading="lazy"`,
  `decoding`, `srcset`/`sizes`, `fetchpriority`, `referrerpolicy`, `crossorigin` and
  `<link rel=preload>` all apply only to a rendered element, and only a rendered element
  is in server HTML (so a cached image paints before hydration). `HTMLImageElement.decode()`
  resolves for a usable image and rejects for a broken one.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#2044](https://github.com/radix-ui/primitives/issues/2044) | Avatars flash the fallback on mount even when cached (also base64 `src`) | Status starts `idle`, set only from async `onload` | Partly: sync `complete` check after setting the probe's `src` (client only); still reported on SSR | Read `complete` synchronously **and** render the real `<img>` in server HTML |
| Radix | [#2851](https://github.com/radix-ui/primitives/issues/2851) | Cached avatar shown only after `delayMs` | Dupe of #2044 | Closed as dupe | Same |
| Base UI | [#4468](https://github.com/mui/base-ui/issues/4468) (open) | Fallback flashes for cached images during SSR hydration, 52–304 ms | No `<img>` in server HTML; status only from the probe after hydration | Open; maintainers note Radix only fixes the client frame | The image must be in server HTML; check `complete` when the image registers |
| Base UI | [#5988](https://github.com/mui/base-ui/issues/5988) (open) | With `delay`, an avatar with no image or a failed image stays empty for the delay; empty `<span>` in SSR | Delay gates every status | Open, proposal: delay only while `loading` | Delay applies only to `loading`; `idle`/`error` show the fallback at once |
| Base UI | [#5529](https://github.com/mui/base-ui/issues/5529) | `render={<NextImage>}` fetches twice and serialises (probe first, then the element) | Status from a detached `new Image()` of the raw `src` | Fixed by `keepMounted` (element is the source) | The rendered element is the only loader |
| Base UI | [#2597](https://github.com/mui/base-ui/issues/2597) | `loading="lazy"` impossible | Probe instead of `<img>` | Fixed by `keepMounted` | Same |
| Radix | [#2512](https://github.com/radix-ui/primitives/issues/2512) (open) | `loading="lazy"` accepted but ignored | Probe | Open | Same; and never hide a lazy image with `display:none` |
| Radix | [#3727](https://github.com/radix-ui/primitives/issues/3727) | `<link rel=preload>` ignored; fetch waits for render | Probe runs in an effect after render | Closed, "no plans" | Real `<img>` in server HTML starts the fetch with the HTML |
| Radix | [#1616](https://github.com/radix-ui/primitives/issues/1616) | `referrerPolicy` not respected | Probe did not copy it | Fixed later by copying | Do not re-implement `<img>` attributes |
| Radix | [#3312](https://github.com/radix-ui/primitives/issues/3312) | `crossOrigin` ignored, images fail | Same | Fixed later | Same |
| Bits UI | [#111](https://github.com/huntabyte/bits-ui/issues/111) | `crossorigin` "does not work" under COEP | Report; maintainer could not reproduce vs plain `<img>` | Closed | A component must behave exactly like `<img>`; compare with the native element first |
| Radix | [#1651](https://github.com/radix-ui/primitives/issues/1651) | `onError` on Image never fires | Image not rendered until loaded, so element events never happen | Closed (pointed at #1616) | Element events must reach consumer handlers |
| Radix | [#1767](https://github.com/radix-ui/primitives/issues/1767) | After deleting a profile picture (`src → undefined`, Image unmounted) the fallback never returns | Status stayed `loaded` | Fixed: cleanup resets to `idle` | Image unmount and empty `src` return to `idle` |
| Bits UI | [#88](https://github.com/huntabyte/bits-ui/issues/88) | `src → undefined` on logout keeps the old image | Status not reset | Fixed | Same |
| Radix | [#2892](https://github.com/radix-ui/primitives/issues/2892) | No way to retry after an error; ref null | Image unmounted on error; status does not change again | Closed (user code) | Document retry by changing `src` (or a cache-busting key); status leaves `error` on `src` change |
| Bits UI | [#2050](https://github.com/huntabyte/bits-ui/issues/2050) | `derived_inert` warning on dynamic `src` changes | `onload` timer outlived the component | Fixed: detach handlers on teardown | Late events after stop are ignored (runtime rule) |
| Bits UI | [#1351](https://github.com/huntabyte/bits-ui/issues/1351) | `style="display: undefined;"` in HTML | Inline style object with `undefined` | Fixed | No inline styles from core |
| Base UI | [#4109](https://github.com/mui/base-ui/issues/4109) | Image and Fallback both mounted while loading → layout shift | Transition attributes kept the Fallback mounted | Fixed: transitions on Image only | Fallback appears/disappears with no exit animation; overlap is the theme's job |
| Base UI | [#3921](https://github.com/mui/base-ui/issues/3921) | Request: animate Image/Fallback swap | — | Added (Image only, after #4109) | No presence machinery; stacking replaces the swap (no fade, see Accessibility) |
| Ark | [#3426](https://github.com/chakra-ui/ark/issues/3426) | Infinite loop with `next/image` | Spreading Zag props including a toggling `hidden` | Workaround in discussion | Element substitution must not depend on attributes the substitute re-renders on |
| Ark | [#4108](https://github.com/chakra-ui/ark/issues/4108) | Vue `AvatarImage asChild` never renders the child; fallback stays | Slot not forwarded | Fixed | `render` parity test with a custom image component |
| Base UI | [#5102](https://github.com/mui/base-ui/issues/5102) | `render` callback props lack `src`/`alt` types | Loose polymorphic HTML props | Fixed: Image is tag-typed | Image part is typed as `img` props |
| Bits UI | [#328](https://github.com/huntabyte/bits-ui/issues/328) | How to use SvelteKit `enhanced:img` | Asked for docs | Docs | Docs example with a framework image component |
| Radix | [#2230](https://github.com/radix-ui/primitives/issues/2230) | Wants to render `next/image` | Probe + `asChild` | `asChild` suggested | Same; only works when status comes from the element |
| Base UI | [#5379](https://github.com/mui/base-ui/issues/5379) | "Maximum update depth" with many avatars | **Misattributed** by the reporter (re-tested: 100 avatars fine) | Closed | Measure before blaming; still keep per-instance updates O(1) |
| Bits UI | [#298](https://github.com/huntabyte/bits-ui/issues/298) | Avatar Group requested | Maintainer: no headless behaviour, "more stylistic" | Declined | Group = semantics + overflow text only, no machine |
| Reka | [#751](https://github.com/unovue/reka-ui/issues/751) | Image renders client-only | Probe | Feature request, closed | Server HTML includes the image |
| Reka | [#1169](https://github.com/unovue/reka-ui/issues/1169) (open) | "Avatar has no a11y; rename to Image"; wants different fallbacks for loading vs error | Status not exposed per fallback | Open | Expose `data-state` (`idle`, `loading`, `error`) on Fallback so consumers show different content |
| Reka | [#710](https://github.com/unovue/reka-ui/issues/710) | Hydration id mismatch (Avatar among others) | Non-SSR-stable ids | Dupe of #577 | Ids from the root id (element-ids) |
| Radix | [#962](https://github.com/radix-ui/primitives/issues/962) | "`AvatarFallback` must be used within `Avatar`" thrown in Next.js `_document` | Duplicate module instances / context | Closed | Context errors name the missing part (dev only) |
| React Spectrum | [#6496](https://github.com/adobe/react-spectrum/issues/6496) | `<object>` image-with-fallback trick inside a Radio broke arrow navigation | Focusable tree walker treated `<object>` as focusable | Fixed (PR#8488) | Do not use `<object>` fallbacks; the Avatar never adds focusable content |

## Known pitfalls

- **Load before hydration.** A server-rendered `<img>` can finish (`load` fired) before
  React attaches `onLoad`; the status must be read from `complete` / `naturalWidth` when
  the image part registers (Zag `checkImageStatus`, Base UI `keepMounted`).
- **`complete` is true for broken images** and for an `<img>` with no `src`; `naturalWidth
  === 0` is ambiguous for SVGs without intrinsic size in some engines. Resolve the
  ambiguous case with `decode()` (resolves usable, rejects broken) instead of declaring
  an error.
- **`display:none` and `loading="lazy"`**: a hidden lazy image never loads (Zag `hidden`,
  Reka `v-show`, Bits inline `display:none`). The loading image must stay rendered.
- **Attribute order** (Base UI): with React 17/18, `src` must come after `srcSet`,
  `sizes` and `loading`, or Safari/Firefox start the wrong fetch.
- **Empty `src`**: React warns on `src=""` and browsers may refetch the page; omit the
  attribute and report `idle`.
- **Transparent images** show the fallback through them if the fallback is not removed
  once loaded.
- **Delay and SSR**: a fallback delay hides the fallback in server HTML (BU#5988's SSR
  case), and toggling it after hydration would mismatch. Keep the delay client-only and
  documented; the overlap of image over fallback already prevents the cached flash.
- **Different names per status** (see Accessibility).

## Testing notes

- jsdom never loads images (`complete` is true, `naturalWidth` 0, no `load` event):
  `@rind-ui/testing/setup` cannot fake real loading, so status tests run in browser mode
  with fixture images (a data URL PNG, a 404 URL, a slow route via a service
  worker / Playwright `route` delay, an SVG without width/height). Machine tests run in
  Node with a fake image capability.
- Hydration test: server-render an avatar whose image is served instantly, hydrate after
  the image loaded, assert the fallback was never painted after hydration and the status
  is `loaded` on the first post-hydration snapshot.
- Lazy test: an avatar far below the fold with `loading="lazy"` makes no request until
  scrolled into view, then reaches `loaded`.
- Driver: `getAvatar(screen, { name })` — queries `status()`, `isFallbackVisible()`,
  `name()`; action `waitForStatus(status)` (postcondition only; the environment drives
  the network). Group: ARIA snapshot and axe.

## Decisions

- **Parts**: `Root` (`span`; `role="img"` + consumer name, or `aria-hidden`), `Image`
  (`img`, always rendered while it has a source, `alt=""`), `Fallback` (`span`), `Group`
  (`div role="group"`), `GroupOverflow` (`span`, "+N" visible, "N more" for AT).
- **Machine** (`avatar.machine.ts`): `idle | loading | loaded | error`.
  - `idle`: no image part registered or it has no `src`/`srcSet`.
  - Events: `IMAGE.MOUNT { hasSource, settled }`, `IMAGE.SOURCE { hasSource }` (src /
    srcSet / sizes changed, through the part's registration), `IMAGE.UNMOUNT`,
    `IMAGE.LOAD`, `IMAGE.ERROR`, `ROOT.MOUNT`, delayed `FALLBACK.DELAY` in `loading`.
  - `settled` is computed by `core/dom/image-status.ts` at registration (`complete` +
    `naturalWidth`, `decode()` for the ambiguous case) — the hydration path.
  - Context: `fallbackReady` (sticky: once shown, never re-hidden by the delay),
    `mounted`.
  - Status is **read-only** (observed, not controlled): `onStatusChange(status, details)`.
- **Fallback visibility**: rendered when status ≠ `loaded` and (`fallbackDelay === 0`, or
  status ∈ {`idle`, `error`} after mount, or the delay elapsed in `loading`); removed
  (unmounted) when `loaded`. `fallbackDelay` is a Root prop (Kobalte), default 0;
  client-only (server HTML renders the fallback only with delay 0).
- **Image**: never `display:none` while loading (lazy loading works); `hidden` only in
  `error`; `aria-hidden` is unnecessary (Root is `role="img"`, children presentational;
  with an `aria-hidden` Root everything is hidden). Attributes ordered with `src` last.
  Consumer `onLoad`/`onError` run (merge).
- **`data-*`**: `data-state="idle|loading|loaded|error"` on Root, Image and Fallback;
  `data-scope="avatar"`, `data-part`; consumer `data-variant` / `data-size` /
  `data-tone` passed through; Group: `data-scope="avatar" data-part="group"`.
- **Contract**: locate by role `img` + exact name (or, for decorative avatars, by
  `data-instance`); queries `status`, `isFallbackVisible`, `name`; action
  `waitForStatus`; events mapped `{ skip }` for browser-driven load/error with browser
  fixtures, prop steps for `src` changes (`$props:src`).
- **Shared capability**: `image-loading-status` (states, events, hydration check,
  `decode()` rule, lazy-safe rendering) is specified once here; Kobalte-style **Image**
  (components.md, wave 3) reuses it.
- **Deliberately different**:
  - No probe `new Image()` (Radix, Base UI default, Reka, Bits, Kobalte): the rendered
    element is the only loader — fixes RX#2512, RX#3727, RX#1616, RX#3312, BU#5529,
    BU#2597, BU#4468 at the root.
  - No `display:none` on a loading image (Zag, Reka, Bits).
  - Name on Root, not on `<img alt>`: one stable name across statuses.
  - Delay only for `loading` (BU#5988).
  - Group without a machine (BITS#298): semantics and the overflow label only.
  - No initials helper in core: names and scripts vary (CJK, Arabic, emoji); a docs recipe
    with `Intl.Segmenter` (graphemes) replaces Reado's `w[0]`.

## Open questions

- `naturalWidth === 0` for SVG without intrinsic size: confirm per engine (Chrome,
  Firefox, Safari) in the browser suite; if all report non-zero, drop the `decode()`
  branch.
- Group overflow as an interactive "show all" (button + popover) — consumer composition
  for now.
