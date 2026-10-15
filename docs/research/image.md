# Image — research

Status: done · Wave: 3

A content image with loading and error states: show a placeholder while it loads, a
fallback when it fails or has no source, and never break the things the native `<img>`
already does well (lazy loading, `srcset`, preload, server HTML). It is Avatar's
problem without the identity styling — and [avatar.md](avatar.md) already solved the
hard half: the shared **`image-loading-status`** capability (status read from the
rendered element, settled-before-hydration check, lazy-safe rendering), specified in
`add-avatar`. This note covers what Image adds: the accessible name of a *content*
image across statuses, `alt` as a required decision, the aspect-ratio box, and the
fallback as content.

Sources: shallow clones read 2026-10-14 (Kobalte `image/`; React Spectrum S2
`Image.tsx` via `git show`); Chakra UI's tracker (its `Image` with `fallback` was the
most used and the most reported). Bug history: `gh search issues` over the ten trackers
(`image`, `image fallback`) plus Chakra UI; ~70 hits, 14 read in full; the Avatar note's
table (shared root causes) is not repeated.

## Pattern

- WAI-ARIA APG: **none** (images are HTML). [WAI Images tutorial](https://www.w3.org/WAI/tutorials/images/):
  informative images have a text alternative (`alt`), decorative ones `alt=""`; complex
  images get a longer description elsewhere.
- Roles and attributes: `<img alt="…">` is `role=img` named by `alt`; `alt=""` makes it
  presentational; **no `alt` at all** is an error (axe `image-alt`) and some screen
  readers read the file name.
- Keyboard: none.
- WCAG: 1.1.1 (text alternative in every status, including the fallback), 1.4.5 (text
  in images), 2.4.4 when the image is a link's only content (then `alt` is the link
  name), CLS is not WCAG but layout shift moves targets (2.5.x usability).

## How the others built it

### Kobalte (the only headless Image)

- Source: `kobalte/packages/core/src/image/{image-root,image-img,image-fallback}.tsx`.
- A port of Radix Avatar: Root (`span`) with `fallbackDelay` and `onLoadingStatusChange`;
  `Img` probes with `new window.Image()` (copies `crossOrigin` and `referrerPolicy`
  only) and renders the `<img>` **only once loaded** (`<Show when=loaded>`); Fallback
  rendered after the delay while not loaded. `src` empty → `error` (not `idle`).
- Problems: every probe bug of Radix Avatar (avatar.md: lazy loading impossible,
  preload ignored, double request with framework image components, nothing in server
  HTML); no name handling at all — while loading or failed, the image's `alt` is not in
  the tree, so a content image *disappears* for screen-reader users.

### React Spectrum S2

- Source: `packages/@react-spectrum/s2/src/Image.tsx`.
- `alt` optional in types but a **development warning** when missing: "Add `alt` text
  for screen readers, or set `alt=""` prop to indicate that the image is decorative".
- States `loading | loaded | revealed | error`; `complete` checked in a layout effect
  ("If the image is already loaded, update state immediately instead of waiting for
  onLoad") — the hydration fix; `renderError` slot; skeleton shimmer while loading
  (via the Skeleton context); 500 ms fade on reveal; an `ImageCoordinator` that reveals a
  group of images together; passes `loading`, `decoding`, `fetchPriority` (with the
  React 18 lowercase-attribute workaround).
- Problems: the fade delays a cached image (avatar.md rejected the fade for this); the
  error slot has no defined name.

### Chakra UI (styled; v1–v2 `Image` with `fallback`/`fallbackSrc`)

The tracker is a catalogue of what goes wrong when the status comes from a probe:

- [CH#462](https://github.com/chakra-ui/chakra-ui/issues/462): no `src` in server HTML
  (the hook started `pending` and rendered the fallback) — SEO and first paint; workaround
  `ignoreFallback`.
- [CH#5285](https://github.com/chakra-ui/chakra-ui/issues/5285),
  [CH#2899](https://github.com/chakra-ui/chakra-ui/issues/2899): images downloaded twice
  (probe + element; one "twice" was a redirecting URL, the other real).
- [CH#7192](https://github.com/chakra-ui/chakra-ui/issues/7192): `loading="lazy"` did
  nothing — `loading` not passed to the probe, **and attribute order** (`src` before
  `loading`) defeats lazy loading in some engines.
- [CH#7956](https://github.com/chakra-ui/chakra-ui/issues/7956): with `loading="lazy"`
  the fallback was skipped entirely (a 2020 change bypassed fallbacks for lazy images),
  leaving blank space.
- [CH#4648](https://github.com/chakra-ui/chakra-ui/issues/4648): with no fallback set,
  a remount rendered a source-less `<img>` for one frame — a flash.
- [CH#2563](https://github.com/chakra-ui/chakra-ui/issues/2563): `onLoad` "not always"
  firing (cached image loaded before the handler attached); the community fix is the
  `complete` check.
- [CH#4028](https://github.com/chakra-ui/chakra-ui/issues/4028): Avatar put `alt` on the
  wrapping `span` and showed initials where an icon was wanted — `alt` on a non-image.
- [CH#8988](https://github.com/chakra-ui/chakra-ui/issues/8988): v3 **removed** Image
  fallbacks ("use the blur hash placeholder of your framework"); users with a component
  fallback were left without one.

### Not shipped

Radix, Reka, Bits, Base UI, Zag/Ark (only as Avatar), React Aria Components, Headless
UI, Ariakit.

### Reado

`organisms/ImageView.tsx`: `<img src={dataUrl} alt={name}>` with its own `onLoad`/
`onError`; on error a `role="alert"` paragraph replaces it (re-announced on remount,
see alert.md). Natural size read from `onLoad`. Migration: `Image.Root alt={name}` with
`Image.Fallback` holding the "failed" text; the size readout stays consumer code (it
reads `naturalWidth` from the element ref).

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

- **`alt` is a required decision.** `alt` is a required `string` prop in the types
  (`""` = decorative is an explicit choice), and a development error when it is missing
  at runtime (S2's warning, made an error because a missing `alt` is a WCAG A failure);
  the `<img>` then renders with no `alt` attribute so axe reports it — we never default
  to `alt=""`, which would hide a content image silently.
- **One name in every status, on a native image when possible.** Unlike Avatar (whose
  Root is always `role="img"`), a content image keeps the native `<img alt>` as the named
  element while it can show (`loading`, `loaded`), because native image semantics matter
  for content (`alt` is translated with the page by browser translators, where
  `aria-label` often is not; copy/save; `<figure>`/`<figcaption>`). When the `<img>` is
  not usable (status `idle` — no source — or `error`), the **Root** takes over the name:
  `role="img"` + `aria-label` = `alt`, so the Fallback's content is presentational. Root
  is always rendered, so there is no gap — not even when the consumer renders no
  Fallback or a fallback delay holds it back. The Fallback itself is always
  `aria-hidden`: while loading the `<img>` already names the image, and afterwards Root
  does. Exactly one exposed element carries the name at any time and its text never
  changes with network timing (rule 6).
- **Decorative** (`alt=""`): Root never gets a role, the `<img alt="">` is
  presentational and the Fallback `aria-hidden` — invisible to AT in every status.
- **The `<img>` is hidden when it is not usable**: `hidden` in `error` (the shared rule)
  and in `idle` (a source-less `<img alt="Chart">` would be exposed and draw alt text —
  needs an extension of `image-loading-status`, see the change's requests).
- **Fallback content** is visible text or an icon for sighted users ("Image
  unavailable"); it is not read (`aria-hidden`, inside the `role="img"` Root), so the AT
  user hears the same `alt` whether or not the image loaded. If the failure itself matters, the app
  says so in text outside the image.
- **Lazy loading**: native `loading` passes through untouched (and `src` is written last,
  CH#7192); the default stays the browser's (`eager`) — lazy-loading the LCP image is a
  performance bug, so it is a documented choice, not a default.
- **Layout shift**: the `<img>`'s `width`/`height` attributes give the browser the
  aspect ratio before load (UA style `aspect-ratio: auto <w> / <h>`); for a box that
  holds both the image and the fallback, the Root takes the CSS `aspect-ratio` (see
  [aspect-ratio.md](aspect-ratio.md)); the theme stacks Img and Fallback in one grid cell.
- **Forced colors**: a Fallback's background vanishes; the theme draws a `CanvasText`
  border so the box is visible.
- **Motion**: no fade (a fade delays a cached image; avatar.md); a skeleton shimmer in
  the Fallback follows Skeleton's reduced-motion rule.
- **Native platform**: the rendered `<img>` is the loader (image-loading-status). For
  art direction, `Image.Img` sits inside a consumer `<picture>` next to its `<source>`
  elements: the `<img>` still loads and fires the events, and its `currentSrc` is the
  chosen source — a documented recipe, no extra part.

## Bug history

Shared root causes (probe, hydration, lazy, attribute order, retries) are in
[avatar.md](avatar.md#bug-history) and specified once in `image-loading-status`; rows
here are the Image-specific ones.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Chakra UI | [#462](https://github.com/chakra-ui/chakra-ui/issues/462) | No `src` in server-rendered `<img>` | Status starts pending; fallback rendered first | Workaround `ignoreFallback` | The `<img>` with `src` is always in server HTML (image-loading-status) |
| Chakra UI | [#5285](https://github.com/chakra-ui/chakra-ui/issues/5285) | Image requested twice when a fallback is set | Probe + rendered element | Fixed later | The rendered element is the only loader |
| Chakra UI | [#2899](https://github.com/chakra-ui/chakra-ui/issues/2899) | Image "downloaded two times" | Partly a redirecting URL, partly probe | Closed | Measure requests per engine in the browser suite |
| Chakra UI | [#7192](https://github.com/chakra-ui/chakra-ui/issues/7192) | `loading="lazy"` ignored by Image/Avatar | Not passed to the probe; `src` written before `loading` | Closed | `src` last; every `<img>` attribute reaches the one element |
| Chakra UI | [#7956](https://github.com/chakra-ui/chakra-ui/issues/7956) | Fallback never shown for `loading="lazy"` images | Fallback bypassed for lazy images | Closed | Fallback rules do not depend on `loading` |
| Chakra UI | [#4648](https://github.com/chakra-ui/chakra-ui/issues/4648) | One-frame flash of a source-less `<img>` on remount | Image rendered before the status settled | Fixed (ignore fallback when none set) | Settled check on registration; source-less `<img>` hidden |
| Chakra UI | [#2563](https://github.com/chakra-ui/chakra-ui/issues/2563) | `onLoad` not always called (Next.js) | Loaded from cache before the handler attached | Community workaround: `complete` in an effect | Settled-before-hydration rule (shared) |
| Chakra UI | [#4028](https://github.com/chakra-ui/chakra-ui/issues/4028) | `alt` applied to the wrapping `span`; wrong fallback | Name on a non-image element | Closed (stale) | `alt` reaches the `<img>`; the Fallback gets `role="img"` when it carries the name |
| Chakra UI | [#8988](https://github.com/chakra-ui/chakra-ui/issues/8988) | v3 removed Image fallbacks | Moved to framework placeholders | By design | A headless fallback is still needed for error states; framework placeholders work through `render` |
| Kobalte | `image-img.tsx` (source) | `<img>` rendered only when loaded; empty `src` → `error` | Radix Avatar port | — | Content image must stay named while loading/failed; empty `src` → `idle` |
| React Spectrum | `Image.tsx` (source, S2) | Missing `alt` only warns | — | — | Make `alt` required in types and a dev error |
| Radix (Avatar) | [#2512](https://github.com/radix-ui/primitives/issues/2512), [#3727](https://github.com/radix-ui/primitives/issues/3727), [#2044](https://github.com/radix-ui/primitives/issues/2044) | Lazy ignored; preload ignored; fallback flash on cached images | Probe | See avatar.md | Inherited by Kobalte Image; fixed at the root by image-loading-status |

## Known pitfalls

- A content image that vanishes from the accessibility tree while loading or after an
  error (Kobalte, Radix-style `<Show when=loaded>`).
- Defaulting `alt` to `""` (silent decorative) or omitting it (file name read).
- `alt` on a wrapper element (CH#4028).
- A source-less `<img alt>` shown as alt text or a broken-image glyph.
- Lazy-loading the hero image by default.

## Testing notes

- Reuses Avatar's browser fixtures (data URL, 404, slow route, SVG without intrinsic
  size) and its hydration test.
- Name invariant per status: exactly one exposed `img` role with name = `alt` in
  `idle`, `loading`, `loaded`, `error`; zero for `alt=""`.
- axe per status story (`image-alt`, `role-img-alt`).
- Layout: Root with `aspect-ratio` keeps its box in `error` (Playwright bounding box equal
  across statuses).
- Driver: `getImage(screen, { name })` (role `img` + exact name) → `status()`,
  `isFallbackVisible()`, `name()`, `waitForStatus(s)`; decorative images by
  `data-instance`.

## Decisions

- **Parts**: `Root` (`span`, the box; no role), `Img` (`img`), `Fallback` (`span`).
- **Machine**: the shared image-status machine (four states, `fallbackDelay`, source
  counter) — extracted from Avatar's into one module used by both (Avatar's behaviour
  unchanged); no new states.
- **Props**: `alt: string` (required, on Root; written to the `<img>`, and to Root's
  `aria-label` in `idle`/`error`), `fallbackDelay`, `onStatusChange`; every native `img`
  attribute on `Img`.
- **`data-*`**: `data-state="idle|loading|loaded|error"` on all three parts;
  `data-decorative` on Root when `alt=""`; `data-scope="image"`, `data-part`; consumer
  `data-variant`/`data-size`/`data-tone` passed through.
- **Contract**: locate by role `img` + name (decorative: `data-instance`); queries
  `status`, `isFallbackVisible`, `name`; action `waitForStatus`; events mapped like
  Avatar's (`{ skip }` for browser load/error, `$props:src` steps).
- **Deliberately different**: the `<img>` keeps the name while it can show, Root only in
  `idle`/`error` (Avatar: Root always) — content semantics; `alt` required; the `<img>` hidden in `idle`; no
  probe (Kobalte); no fade (S2); no group reveal coordinator (S2) — consumer composition.

## Open questions

- `<picture>` recipe: does every engine fire `load` again on the `<img>` when a
  `<source>` switches with the viewport, so the status follows it? Browser test; only the
  recipe depends on it.
