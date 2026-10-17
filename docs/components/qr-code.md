# QR Code

A value rendered as a scannable QR Code symbol: a named image whose description is the value,
an optional logo, and a download trigger. Encoding is done by rind-ui's own encoder, with no
dependency; the symbol is identical on the server and in the browser.

## When to use

- **Use it for** showing a value, such as a URL or a token, as a scannable QR Code symbol,
  with an optional logo and a download trigger.
- **Over an image file or a hand-made `<svg>`**: it encodes in the page, so the symbol is the
  same on the server and in the browser, needs no dependency, and stays in sync with the
  value.
- **Over a plain `<img>`**: it exposes the frame as a named image whose description is the
  value, so assistive technology users get the text behind the code.
- **Don't use it for** reading a QR Code: it only renders one. Don't use it for a short
  value the user can read and copy: show it as text.

```tsx
import { QrCode } from "@rind-ui/react"

<QrCode.Root value={shareUrl}>
  <QrCode.Frame>
    <QrCode.Pattern />
  </QrCode.Frame>
  <QrCode.ValueText />
  <QrCode.DownloadTrigger>Download</QrCode.DownloadTrigger>
</QrCode.Root>
```

## API

<!-- api:qr-code -->

## Encoding options

`encoding` takes the encoder's options and the quiet zone. It is compared by value, so an
inline object (`encoding={{ ecc: "M" }}`) re-rendered with the same value does not encode
again.

| Option | Default | Description |
|---|---|---|
| `ecc` | `"M"` | Error-correction level: `L` 7 %, `M` 15 %, `Q` 25 %, `H` 30 % of the codewords recover. |
| `boostEcc` | `false` | Raise the level to the highest that fits the chosen version. Off, so the output equals other generators at the same level. |
| `minVersion` / `maxVersion` | `1` / `40` | The range of symbol sizes to choose from. |
| `mask` | automatic | `0`–`7` forces a mask. |
| `eci` | `"auto"` | Non-ASCII text gets a segment declaring UTF-8, so readers do not guess Latin-1. `"none"` never writes it. |
| `quietZone` | `4` | Light modules around the symbol, inside the frame's `viewBox`. |

Why `M` by default: it recovers 15 % of the codewords, enough for a scratched print or a
small logo, without making short URLs denser than they need to be. Use `H` with a logo.

## Quiet zone

Scanners need a light margin around the symbol. The frame includes it: a version-1 symbol
(21 modules) has the `viewBox` `0 0 29 29`. If your design already has a light tile around
the code, pass `quietZone: 0` and keep at least four modules of light padding yourself.

## States

The root's `data-state` is `ready` when the value encoded, `empty` for `""`, and `invalid`
when the encoder failed (the value is too long for the largest symbol at the level, or an
option is invalid). Without a symbol the frame keeps its size, draws nothing and is hidden
from assistive technology, the value text renders nothing, and the download trigger is
`aria-disabled`. Encoding never throws: `onEncodeError` is called once per failing value.

```tsx
<QrCode.Root value={text} onEncodeError={(e) => e.error === "too-long" && setHint(`At most ${e.maxBytes} bytes`)}>
```

## Name and description

When there is a symbol, the frame is `role="img"`, named by your `aria-labelledby`, else your
`aria-label`, else `messages.label` ("QR code"). `ValueText` renders the value as visually
hidden text and becomes the frame's description, also in the server HTML; your own
`aria-describedby` is kept first. If the logo carries information, say it in the name
(`aria-label="QR code for Reado"`).

## Logos and the error-correction budget

`Overlay` sits over the centre of the frame. The modules under it stay in the matrix: the
logo hides them, and error correction has to recover them. In the browser the overlay reports
the share of the symbol it covers as `data-covers` (0–100), and in development a warning is
logged when it covers more than half of what the level recovers (L 3.5 %, M 7.5 %, Q 12.5 %,
H 15 %) or reaches a finder pattern. With a logo, use `ecc: "H"` and keep the logo small.

```tsx
<QrCode.Root value={url} encoding={{ ecc: "H" }}>
  <QrCode.Frame>
    <QrCode.Pattern />
  </QrCode.Frame>
  <QrCode.Overlay>
    <img alt="" src={logoUrl} />
  </QrCode.Overlay>
</QrCode.Root>
```

## Download

`DownloadTrigger` saves the symbol as PNG (default), JPEG, WebP or SVG.

- **Sharp at any size**: the image has a whole number of pixels per module, rounded up from
  `size` (default 1024), drawn with smoothing off.
- **On the frame's background**, quiet zone included, so a JPEG is never black-backed.
- **The logo is composited**: an `<img>` or an inline `<svg>` in the Overlay is drawn at its
  position, with the overlay's background and outline. Other overlay content (text,
  components) is not drawn: use an image.
- **Cross-origin logos**: an image from another origin without CORS headers would taint the
  canvas. The file is then saved without the logo and `onDownload` reports
  `overlay: "omitted"`; give the image `crossOrigin="anonymous"` and serve it with CORS to
  keep it.
- **SVG files are self-contained**: the logo is inlined as a data URL when it can be read,
  never a remote reference.
- The file name loses path separators and control characters; the object URL is revoked
  right after the download starts. A second press while a download runs is ignored.

The same is available without a trigger through Root's `apiRef`: `getDataUrl(mimeType,
options)` resolves to the image as a `data:` URL (for an `<img>`, a share sheet or an upload),
drawn exactly like a download; `download(options)` starts a download.

```tsx
const qr = useRef<QrCodeApi>(null)

<QrCode.Root value={url} apiRef={qr}>…</QrCode.Root>

const png = await qr.current?.getDataUrl("image/png", { size: 512 })
```

`onDownload({ fileName, mimeType, overlay })` is called once per download, with `overlay`
`"included"`, `"omitted"` or `"none"`.

## Server rendering

Encoding is pure: the frame, the path and the value-text relation are in the server HTML
and hydrate with no mismatch. Downloads, overlay measurement and the development warnings
run only in the browser.

## The encoder on its own

`@rind-ui/core/qr` is a separate entry: an application that only needs a matrix or an SVG
file (a server route, a PDF) does not bundle the component.

```ts
import { encodeQr, qrPath, renderQrSvg } from "@rind-ui/core/qr"

const result = encodeQr("https://reado.app", { ecc: "M" })
if (result.ok) {
  result.modules // boolean[][], true = dark, no quiet zone
  const svg = renderQrSvg(result, { title: "QR code", description: "https://reado.app" })
}
```

`encodeQr` returns a result, never throws: `{ ok: false, error: "too-long" | "invalid-option" |
"invalid-input" }`. Strings are encoded as UTF-8 (a lone surrogate becomes U+FFFD); a
`Uint8Array` is encoded as bytes. `renderQrSvg` escapes every attribute and text it writes.

## Styling

The theme draws black modules on a white ground in every colour scheme and under forced
colors (the frame is the one place, besides colour swatches, with
`forced-color-adjust: none`), because scanners need dark on light. Size it with
`--rind-qr-code-size`; the other tokens are `--rind-qr-code-fg`, `-bg`, `-radius`,
`-padding`, `-overlay-size`, `-overlay-radius`, `-overlay-outline-width` and
`-overlay-outline-color`. Without the theme, the parts lay themselves out (the frame and the
overlay share one grid cell); colour the pattern with CSS `fill` and the frame with
`background`.

## Scanner differences

Phone cameras read almost every symbol, but some readers handle less: a few ignore the ECI
segment and decode non-ASCII text as Latin-1 (`eci: "none"` makes the payload plain bytes
for them), and symbols with no quiet zone or very low contrast fail in older readers. Test
real codes with the cameras your users have.

## Coming from another QR Code component

| Elsewhere | rind-ui |
|---|---|
| `encoding={{ ecc: "M" }}` on Root | the same; `M` is now the default |
| A pixel size on the frame | `width`/`height` on `QrCode.Frame` or `--rind-qr-code-size` |
| Padding around the symbol | the built-in quiet zone (`quietZone: 0` to keep yours) |
| `aria-label` on the frame | the same; `messages.label` is the default |
| `getDataUrl()` / `download()` on the API | the same, on Root's `apiRef`; or `QrCode.DownloadTrigger` |

## Testing

```tsx
import { getQrCode } from "@rind-ui/testing"

render(<ShareCard />)
const q = getQrCode(screen) // the image named "QR code"
await q.decoded() // the value, read back from the rendered path
await q.download()
await q.lastDownload() // "qr-code.png"
```

The driver parses the rendered path back into the module matrix (`matrix()`) and decodes it
with the testing decoder (`decoded()`), so a test checks what is on screen, not only the
encoder. `setValue(value)` types into the page's control labelled "Value". The same test runs
in jsdom, Vitest browser mode and Playwright (`getQrCode(page)`); in jsdom, download SVG
files or stub `URL.createObjectURL`, since jsdom has no canvas. `decodeQr` and `parseQrPath`
are exported too.

## Tested with

<!-- tested-with:qr-code -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
