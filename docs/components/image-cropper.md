# Image Cropper

Choose the part of an image to keep: a crop area over the image that you move and resize, with zoom, any-angle rotation and flip, and the result in the image's own pixels. It does everything the reference croppers do (the crop in the viewport with the image moving under it, a fixed crop area, wheel and pinch zoom, nudge steps), with three fixes: the image always covers the crop exactly (no empty corners under rotation), the crop area stays reachable by keyboard with a fixed area, and the rectangle is announced after keyboard changes instead of a live region re-reading the cropper.

## When to use

- **Use it for** avatars, covers, banners, product photos: any upload that must fit a shape or a ratio.
- **Over a hand-made crop box**: preview and output come from one matrix, so flips and rotations crop the right pixels (zag#3238); one tab stop with arrow, Alt and zoom keys; an announcement per keyboard burst; typed errors for cross-origin images (ark#3901).
- **Don't use it for** pixel editing or filters; it selects, it does not edit.

```tsx
import { ImageCropper } from "@rind-ui/react"
import { cropImage } from "@rind-ui/core"

<ImageCropper.Root aria-label="Avatar" cropShape="circle" onCropChange={(_, { data }) => (latest = data)}>
  <ImageCropper.Viewport style={{ blockSize: 320 }}>
    <ImageCropper.Image src={url} crossOrigin="anonymous" />
    <ImageCropper.Selection>
      {["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((p) => (
        <ImageCropper.Handle key={p} position={p} />
      ))}
    </ImageCropper.Selection>
  </ImageCropper.Viewport>
</ImageCropper.Root>

const blob = await cropImage(imageElement, latest)
```

## API

<!-- api:image-cropper -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `ImageCropper.Root` | `root` | `<div role="group">`; name it. CSS variables `--rind-crop-*`, `--rind-image-zoom`, `--rind-image-rotation`, `--rind-image-offset-*`. |
| `ImageCropper.Viewport` | `viewport` | The stage: clips, takes pans, wheel and pinch. Give it a size. |
| `ImageCropper.Image` | `image` | `<img aria-hidden>` placed by the transform. Set `crossOrigin` for remote images. |
| `ImageCropper.Selection` | `selection` | The one tab stop: `role="slider"` "crop area", its value the crop in natural pixels. |
| `ImageCropper.Handle` | `handle` | `aria-hidden`; `position`; placed on its edge or corner with a 24 px hit area. |
| `ImageCropper.Grid` | `grid` | `aria-hidden` thirds; `axis`. |

## Geometry

The crop lives in viewport pixels; the image is placed by one affine transform of fit, `zoom`, `rotation` (degrees, any angle), `flip` and the pan offset. `onCropChange(crop, { data })` and the render state give `data`: the crop in natural pixels, its four `corners` (a quad under rotation) and their bounding `rect`. `cropImage(image, data, { output, type, quality })` draws exactly that.

Every change keeps the image covering the crop: each corner of the crop must map inside the image. A rotation that would expose an empty corner raises zoom to the smallest value that covers; a pan stops where coverage would end.

## Keyboard

| Key | Action |
|---|---|
| Arrows | Move the crop by `nudgeStep` (1 px); Shift: `nudgeStepShift` (10); Ctrl / ⌘: `nudgeStepCtrl` (50). With `fixedCropArea`, pan the image. |
| Alt + Arrows | Resize the right or bottom edge. |
| + / − | Zoom by `zoomStep` around the crop's centre. |

After keyboard changes, the rectangle ("200 by 200 pixels, 400 from the left, 100 from the top") is announced once, half a second after the last key.

## Pointer and touch

Drag the crop to move it, a handle to resize it (Shift keeps the ratio), outside the crop to pan the image; the wheel zooms around the pointer; two fingers pinch.

## Accessibility notes

- **One tab stop**, a slider with roledescription "crop area", instructions as its description, the natural-pixel rectangle as its value.
- **Not a live region**: one polite announcement per keyboard burst.
- **Handles are pointer affordances**: hidden from assistive technology, 24 × 24 px hit areas.
- **Zoom, rotate and flip controls are yours** (a Slider, Buttons), each with its own name.

## Testing

```tsx
import { getImageCropper } from "@rind-ui/testing"

const cropper = getImageCropper(screen, { name: "Avatar" })
await cropper.nudge(10, 0)
await cropper.zoomIn()
expect(await cropper.covered()).toBe(true)
expect((await cropper.crop()).width).toBeGreaterThan(0)
```

Contract actions: `nudge`, `resize`, `zoomIn`, `zoomOut`, `dragSelection`, `dragHandle`. Queries: `crop`, `zoom`, `valueText`, `covered`. Run it in a browser (layout and image decoding).

## Tested with

<!-- tested-with:image-cropper -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
