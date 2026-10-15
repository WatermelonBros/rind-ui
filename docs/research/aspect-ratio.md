# Aspect Ratio — research

Status: done · Wave: 3

A box that keeps a width-to-height ratio (16 : 9 video, 1 : 1 thumbnail, 4 : 3 map)
whatever its width. Radix, Reka and Bits ship it as a component. It was a component
because CSS had no way to do it; since 2021 CSS has one — `aspect-ratio` — and the
question for rind-ui is whether anything is left to be a component at all.

Sources: shallow clones read 2026-10-14: `radix/packages/react/aspect-ratio/src/aspect-ratio.tsx`,
`reka-ui/packages/core/src/AspectRatio/AspectRatio.vue`,
`bits-ui/packages/bits-ui/src/lib/bits/aspect-ratio/{aspect-ratio.svelte.ts,components/aspect-ratio.svelte}`.
Bug history: `gh search issues` (`aspect ratio`, `AspectRatio`, `aspect`) over Radix,
Reka, Bits and the other trackers of [README.md](README.md), plus Chakra UI (whose
`AspectRatio` has the longest history); ~40 hits, 11 read. Browser data:
`@mdn/browser-compat-data`.

## Pattern

- WAI-ARIA APG: **none**. An aspect-ratio box has no role, no state, no keyboard.
  Accessibility is only about its **content** (an image's `alt`, an iframe's `title`, a
  video's captions) and about not breaking reflow (1.4.10) and zoom (1.4.4): a fixed
  ratio must not clip text when the user enlarges it.
- Platform: CSS [`aspect-ratio`](https://drafts.csswg.org/css-sizing-4/#aspect-ratio)
  — Chrome 88, Firefox 89, Safari 15 (BCD). Replaced elements (`img`, `video`,
  `iframe`) also get a ratio from their `width`/`height` attributes before they load
  (UA style `aspect-ratio: auto w / h`), which is what prevents layout shift for images.

## How the others built it

### Radix (Reka and Bits are ports)

- Source: `aspect-ratio.tsx`. `AspectRatio.Root` with `ratio` (default 1).
- Output: **two** elements — an outer `div` with inline `position: relative; width:
  100%; padding-bottom: ${100 / ratio}%` (`data-radix-aspect-ratio-wrapper`), and the
  consumer's `div` with inline `position: absolute; inset: 0`. This is the 2010s
  "padding-bottom hack".
- Reka: same two elements (`data-reka-aspect-ratio-wrapper`), exposes `aspect` (the
  percentage) to the slot. Bits: same, `child` snippet support.
- Problems:
  - The wrapper is not stylable through the component (props go to the inner element)
    and forces `width: 100%`; inside a flex row it collapses or overflows.
  - Content is absolutely positioned: it cannot grow, so text inside a ratio box clips at
    zoom (1.4.4) instead of growing the box — native `aspect-ratio` lets content
    overflow the ratio ("`aspect-ratio` is a preferred ratio", content-based minimum).
  - [RX#2401](https://github.com/radix-ui/primitives/issues/2401): "Replace js logic
    for aspect-ratio component with css native prop … the API doesn't need to be
    changed" — closed by its author without a change; the source at HEAD still uses the
    padding trick.
  - [RX#2346](https://github.com/radix-ui/primitives/issues/2346): could not be used in
    a React Server Component (the shared `Primitive` imports `flushSync`) — a pure-CSS
    box shipped as a client component.
  - [RK#375](https://github.com/unovue/reka-ui/issues/375): "Aspect Ratio need extra
    css to works" (title only; the wrapper needs a defined width).

### Chakra UI (styled; same idea, more reports)

- [CH#2582](https://github.com/chakra-ui/chakra-ui/issues/2582): invisible inside a
  flex container (zero width → zero height) — "not a bug", the child needs a width.
- [CH#5343](https://github.com/chakra-ui/chakra-ui/issues/5343): the component styles
  its child (`& > *:not(style)` becomes a flex container) — unwanted layout.
- [CH#4347](https://github.com/chakra-ui/chakra-ui/issues/4347): forces `object-fit:
  cover` on `img`/`video` children; `objectFit="contain"` ignored; not fixable without a
  breaking change.
- [CH#10290](https://github.com/chakra-ui/chakra-ui/issues/10290): `Children.only`
  breaks with Next.js `Image` (multiple elements); maintainer: "pass the `aspectRatio`
  prop to the image directly instead of using the AspectRatio component".
- [CH#4516](https://github.com/chakra-ui/chakra-ui/issues/4516): users asking for the
  plain CSS `aspect-ratio` style prop because "it achieves what the `AspectRatio`
  component does in one line, plus works flawlessly with flex layouts".
- [CH#1919](https://github.com/chakra-ui/chakra-ui/issues/1919): stray text before the
  image loaded in production (not reproduced) — styling-runtime noise around a layout
  wrapper.

### Not shipped

Ark/Zag, React Aria Components, Base UI, Headless UI, Ariakit, Kobalte.

### Reado

No aspect-ratio boxes (`grep aspect-` in `src/components`: none). Image previews size
by `max-width`/`max-height`.

## Accessibility

Applying [accessibility.md](accessibility.md), [assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md)
and [native-platform.md](native-platform.md):

- Nothing to expose: a ratio box is `generic`; its content carries the semantics.
- **Reflow and zoom**: native `aspect-ratio` grows the box when content (text in a
  card, captions) needs more height; the padding hack clips it. Prefer native.
- **Iframes and video** in a ratio box keep their own names (`title`, `aria-label`) —
  the recipe shows them.
- **Forced colors / motion / RTL**: not applicable.
- **Native platform**: the whole component is one CSS property. native-platform.md's
  rule — build on the native primitive when it covers the need — applies fully here.

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Radix | [#2401](https://github.com/radix-ui/primitives/issues/2401) | Asks to replace the padding trick with CSS `aspect-ratio` | Pre-2021 technique kept | Closed by the author, no change | Use the native property; no wrapper |
| Radix | [#2346](https://github.com/radix-ui/primitives/issues/2346) | AspectRatio unusable in React Server Components | Shared client primitive (`flushSync`) | Closed as duplicate of the RSC issue | A CSS-only feature should not be a client component |
| Reka | [#375](https://github.com/unovue/reka-ui/issues/375) | "Need extra css to work" | Wrapper needs a defined width | Closed | Same |
| Chakra UI | [#2582](https://github.com/chakra-ui/chakra-ui/issues/2582) | Invisible in a flex container | `width: 100%` wrapper + padding trick in an indefinite width | "Not a bug" | Native `aspect-ratio` on the item itself works in flex/grid |
| Chakra UI | [#5343](https://github.com/chakra-ui/chakra-ui/issues/5343) | Child forced to `display: flex` | Component styles its child | Closed (workaround) | A ratio box must not style its content |
| Chakra UI | [#4347](https://github.com/chakra-ui/chakra-ui/issues/4347) | `object-fit: contain` ignored on images inside | Component forces `object-fit: cover` | Not fixable without breaking change | Fit is the image's own CSS |
| Chakra UI | [#10290](https://github.com/chakra-ui/chakra-ui/issues/10290) | `Children.only` throws with Next.js Image | Wrapper clones its single child | Maintainer: put `aspectRatio` on the image | No wrapper, no cloning |
| Chakra UI | [#4516](https://github.com/chakra-ui/chakra-ui/issues/4516) | Users want the CSS property instead of the component | — | Discussed | The recipe *is* the CSS property |
| Chakra UI | [#1919](https://github.com/chakra-ui/chakra-ui/issues/1919) | Stray text before the image loads (prod) | Not reproduced | Closed | — (styling-runtime noise) |

## Known pitfalls

- Padding-hack wrappers in flex/grid (zero size, overflow).
- Absolutely positioned content clipping at 200 % zoom.
- Components that restyle their children (`object-fit`, `display`).
- `Children.only` / cloning wrappers breaking framework image components.

## Testing notes

Nothing behavioural to test. The docs page's examples are stories with a Playwright
check that the box's height equals `width / ratio` at two widths and grows with long
text at 200 % zoom (reflow), and axe passes (content names).

## Decisions

- **No component.** rind-ui ships no `AspectRatio` part, connect, contract or driver:
  the native `aspect-ratio` property does everything the Radix/Reka/Bits component does,
  without the wrapper, the clipping and the client-component cost. Shipping a part would
  add a contract with nothing to act on or query, a driver nobody calls, and an element
  that is only `style={{ aspectRatio }}`.
- **A docs recipe instead** (`docs/components/aspect-ratio`), discoverable where people
  and agents look for the component: the LLM docs (`llms.txt`) list "Aspect Ratio" and
  point to the recipe, so an agent porting Radix code does not invent an import. The
  recipe covers: a ratio box (`aspect-ratio: 16 / 9` + `width: 100%`), media inside it
  (`object-fit` on the media), iframes/video with their names, the Radix/Reka/Bits
  migration table (`<AspectRatio.Root ratio={16/9}>` → `<div style={{ aspectRatio:
  "16 / 9" }}>`, `asChild` → put the property on the element itself), and Image's ratio
  box (`--rind-image-aspect-ratio`, add-image).
- **Theme**: no stylesheet (no `data-scope`); the Image stylesheet reads its own ratio
  token.
- **Deliberately different**: every shipping library has a component; we have a recipe,
  because the component's reason to exist (no CSS for it) is gone.

## Open questions

- If a future component needs a ratio (Carousel slides, Image Cropper), it sets the CSS
  property on its own part and exposes a `--rind-<scope>-aspect-ratio` token; revisit a
  shared helper only if two such components appear.
