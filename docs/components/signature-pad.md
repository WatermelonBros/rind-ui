# Signature Pad

A surface to sign on with a mouse, a pen or a finger. The drawing is stroke data (points, not pixels), rendered as SVG paths in the text colour, so it never clears or shifts on a resize, a zoom or a high-DPI screen. One pointer owns a stroke (a resting palm or a second finger draws nothing), and a stroke always ends, even when the browser loses the pointer. The pad submits with its form (an SVG image, or the strokes as JSON), `required` blocks an empty submit, and Clear and Undo announce what they did.

## When to use

- **Use it for** a handwritten signature or initials on a form: a delivery receipt, a consent, a contract.
- **Over a canvas library**: no resize and DPR bug class (the drawing is data), the value can be re-rendered at any size, the form value is computed synchronously, `required` validates, and the triggers keep the keyboard focus.
- **Always pair it with another way to sign.** Drawing is a pointer path: keyboard and many screen-reader users cannot do it. Offer a typed full name next to it, and accept either.

```tsx
import { SignaturePad, TextField } from "@rind-ui/react"

<form>
  <SignaturePad.Root name="signature" required>
    <SignaturePad.Label>Signature</SignaturePad.Label>
    <SignaturePad.Control>
      <SignaturePad.Segment />
      <SignaturePad.Guide />
    </SignaturePad.Control>
    <SignaturePad.Status />
    <SignaturePad.UndoTrigger>Undo</SignaturePad.UndoTrigger>
    <SignaturePad.ClearTrigger>Clear</SignaturePad.ClearTrigger>
  </SignaturePad.Root>

  <TextField.Root name="typedName">
    <TextField.Label>Or type your full name</TextField.Label>
    <TextField.Input autoComplete="name" />
  </TextField.Root>
</form>
```

## API

<!-- api:signature-pad -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `SignaturePad.Root` | `root` | `<div>`; holds the strokes and renders the hidden form input. |
| `SignaturePad.Label` | `label` | `<span>`; names the Control and the triggers. |
| `SignaturePad.Control` | `control` | `<div role="img">`; the drawing surface, described by the Status. |
| `SignaturePad.Segment` | `segment` | `<svg aria-hidden="true">`; a `<path data-part="stroke">` per stroke. |
| `SignaturePad.Guide` | `guide` | `<div aria-hidden="true">`; the line to sign on. |
| `SignaturePad.Status` | `status` | visually hidden "Not signed" / "Signed". |
| `SignaturePad.ClearTrigger` | `clear-trigger` | `<button type="button">`; removes every stroke. |
| `SignaturePad.UndoTrigger` | `undo-trigger` | `<button type="button">`; removes the last stroke. |

Root, Control and Segment are required.

## The value

```ts
{ width: 400, height: 160, strokes: [{ points: [{ x, y, pressure, t }, …] }, …] }
```

`width` and `height` are the Control's CSS size when the first stroke began; points are in that space, `t` in ms from the stroke's start, `pressure` from the device (0.5 for a mouse). `onValueChange` runs when a stroke ends, on Clear, Undo and form reset, never while drawing. Store the value to show the signature again later (`defaultValue` or `value`).

## Form and export

- `name` submits an `image/svg+xml` data URL (or the strokes as JSON with `formValue="json"`); empty submits `""`, so `required` blocks it and focuses the pad.
- `api.toBlob({ type, scale, background })` rasterises at the stroke space × `scale` (default 2): `image/png` (transparent), `image/jpeg` and `image/webp` on white. It rejects with `EmptySignatureError` on an empty pad. `api.download(fileName)` saves it.

## Keyboard

| Key | Action |
|---|---|
| Enter, Space | On Clear or Undo: runs it. |

The surface itself has no keyboard function and is not a Tab stop.

## Accessibility notes

- **An image, not an application.** The Control is `role="img"` named by the Label and described by the Status ("Not signed", "Signed"), so a screen reader stays in browse mode and hears the state.
- **Focus stays.** Clear and Undo are `aria-disabled` when there is nothing to do, never hidden; after Clear by keyboard, the focus is still on it. Their names include the Label ("Clear Signature").
- **Announced.** "Signature cleared", "Last stroke removed"; drawing itself is silent.
- **An alternative is required** for WCAG 2.1.1 in practice: pair the pad with a typed name.
- **Forced colors**: ink `CanvasText`, guide `GrayText`.

## Testing

```tsx
import { getSignaturePad } from "@rind-ui/testing"

const pad = getSignaturePad(screen, { label: "Signature" })
await pad.draw() // a stroke through the middle (or pass points as fractions of the box)
expect(await pad.strokeCount()).toBe(1)
await pad.undo()
expect(await pad.isEmpty()).toBe(true)
```

Contract actions: `draw(points?)`, `tap(at?)`, `drawWithTwoPointers`, `cancelStroke`, `clear`, `undo`. Queries: `isEmpty`, `strokeCount`, `formValue`, `name`, `statusText`, `clearDisabled`, `undoDisabled`. Drawing needs a real browser (layout).

## Tested with

<!-- tested-with:signature-pad -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
