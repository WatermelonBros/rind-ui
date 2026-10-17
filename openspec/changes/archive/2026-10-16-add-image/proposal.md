## Why

Content images need a fallback when they fail or have no source, without losing what
the native `<img>` does: lazy loading, `srcset`, preload, server HTML, one request. The
only headless Image (Kobalte) is a port of Radix Avatar and inherits its probe bugs, and
it removes the image from the accessibility tree while loading and after an error, so a
content image simply disappears for screen-reader users. Chakra UI's tracker shows the
rest (no `src` in server HTML #462, double requests #5285, lazy loading ignored #7192,
fallback skipped for lazy images #7956). `add-avatar` already specifies the hard part,
`image-loading-status`; Image is its second user, so this change reuses it and adds
what a *content* image needs: a required `alt` decision and one stable name in every
status.

Research: [image](../../../docs/research/image.md) (sources, Bug history,
Accessibility, Decisions) · [avatar](../../../docs/research/avatar.md) (shared
loading-status bugs) · [aspect-ratio](../../../docs/research/aspect-ratio.md) (the ratio
box) · [accessibility](../../../docs/research/accessibility.md) rules 1, 4, 6 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md)
§1.2 K · [native-platform](../../../docs/research/native-platform.md)

**Depends on** `add-avatar` (`image-loading-status` and the four-state machine, reused;
two requests in design.md), `add-foundations` (archived), `add-a11y-foundations` (dev
logger, name check, invariants) and `add-theme-system` (tokens, family matrix — a request
in design.md).

## What Changes

- `@rind-ui/core`: the image-status machine extracted from Avatar into a shared module
  (Avatar's behaviour unchanged); `image` connect and contract on top of it.
- Behaviour: `alt` required (type-level, and a development error at runtime with no
  silent `alt=""`); the `<img>` carries the name while `loading`/`loaded`, Root
  (`role="img"` + `aria-label`) in `idle`/`error`; Fallback always hidden from AT;
  decorative images (`alt=""`) expose nothing; native `img` attributes untouched,
  `loading` not defaulted; aspect-ratio box through CSS.
- `@rind-ui/react`: `Image.Root`, `Img`, `Fallback`.
- `@rind-ui/testing`: `getImage` driver (Avatar's image fixtures reused).
- Theme stylesheet (`--rind-image-*`, stacked layout, `--rind-image-aspect-ratio`,
  `object-fit` token), stories, docs page.

## Capabilities

### New Capabilities

- `image`: the Image component — anatomy, `alt` rule, name per status, decorative
  images, fallback, native attributes and lazy loading, ratio box, `data-*`, contract
  and driver, theme. Loading status itself is `image-loading-status` (add-avatar).

### Modified Capabilities

None here: `image-loading-status` is not yet archived, so the change it needs (hide the
source-less `<img>` in `idle`) is listed under "Requests to other changes" in design.md.

## Non-goals

- A probe, retries, blur-hash/LQIP placeholders (a framework image component through
  `render`, or the consumer's own Fallback content).
- Reveal coordination across several images and fade-in (React Spectrum's
  `ImageCoordinator`, 500 ms fade — rejected, research).
- Long descriptions (`aria-describedby` to a caption is consumer markup, documented with
  `<figure>`).
- Zoom, pan, lightbox, cropping (Image Cropper is a separate component).
- An AspectRatio part (add-aspect-ratio is a docs recipe).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/components/image/{image.connect,image.contract}.ts`,
  shared `packages/core/src/components/image-status/image-status.machine.ts` (moved from
  avatar), `packages/react/src/image/*`, `getImage` in `@rind-ui/testing`,
  `packages/theme/src/image.css`, stories, generated docs page.
- Public API: `image` connect/contract, `imageStatusMachine` (shared; Avatar re-exports
  its alias), `Image` parts, `getImage`.
- Reado: `organisms/ImageView.tsx` can adopt `Image` (Migration in design.md).
- No new runtime dependency.
