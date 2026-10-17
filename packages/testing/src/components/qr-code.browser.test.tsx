// QR Code in real browsers (add-qr-code 2.3, 6.2): raster exports decoded back from their
// pixels, the overlay composited (or omitted when it taints the canvas), integer scaling,
// the overlay coverage measured from layout, and `BarcodeDetector` as a second oracle.
import { QrCode, type QrCodeApi } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { decodeQr, getQrCode } from "../index"

let blobs: Blob[] = []
let clicked: string[] = []
beforeEach(() => {
  blobs = []
  clicked = []
  const create = URL.createObjectURL.bind(URL)
  vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
    blobs.push(b as Blob)
    return create(b as Blob)
  })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this.download)
  })
})
afterEach(() => vi.restoreAllMocks())

/** Reads a raster export's modules back: the centre pixel of every module. */
async function pixelsToModules(blob: Blob, total: number, quietZone = 4) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no 2D context")
  ctx.drawImage(bitmap, 0, 0)
  const scale = bitmap.width / total
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  const at = (x: number, y: number) => {
    const i = (Math.floor((y + 0.5) * scale) * bitmap.width + Math.floor((x + 0.5) * scale)) * 4
    return (data[i] ?? 255) < 128
  }
  const size = total - quietZone * 2
  return {
    width: bitmap.width,
    modules: Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => at(x + quietZone, y + quietZone)),
    ),
    pixel: (x: number, y: number) => {
      const i = (y * bitmap.width + x) * 4
      return [data[i], data[i + 1], data[i + 2]]
    },
  }
}

const LOGO =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#e11d48"/></svg>',
  )

function Qr(props: {
  value: string
  overlay?: React.ReactNode
  mime?: "image/png" | "image/jpeg" | "image/svg+xml"
  size?: number
  onDownload?: () => void
  ecc?: "L" | "M" | "Q" | "H"
}) {
  return (
    <QrCode.Root
      defaultValue={props.value}
      encoding={{ ecc: props.ecc ?? "M" }}
      {...(props.onDownload ? { onDownload: props.onDownload } : {})}
    >
      <QrCode.Frame width={290} height={290} style={{ display: "block", background: "#fff" }}>
        <QrCode.Pattern style={{ fill: "#000" }} />
      </QrCode.Frame>
      {props.overlay}
      <QrCode.DownloadTrigger mimeType={props.mime ?? "image/png"} size={props.size ?? 500}>
        Download
      </QrCode.DownloadTrigger>
    </QrCode.Root>
  )
}

describe("raster download", () => {
  it("PNG: the file decodes to the value, at an integer scale (qrcode.react#373)", async () => {
    const onDownload = vi.fn()
    render(<Qr value="hello" onDownload={onDownload} />)
    const q = getQrCode(screen)
    await q.download()
    expect(clicked).toEqual(["qr-code.png"])
    expect(onDownload.mock.calls[0]?.[0]).toMatchObject({ overlay: "none", mimeType: "image/png" })
    const blob = blobs.at(-1) as Blob
    expect(blob.type).toBe("image/png")
    const read = await pixelsToModules(blob, 29)
    expect(read.width % 29).toBe(0) // 500 px → 18 px per module → 522
    expect(read.width).toBe(522)
    expect(decodeQr(read.modules).text).toBe("hello")
  })

  it("JPEG is drawn on the frame's background, never black-backed", async () => {
    render(<Qr value="jpeg" mime="image/jpeg" />)
    await getQrCode(screen).download()
    const read = await pixelsToModules(blobs.at(-1) as Blob, 29)
    const [r, g, b] = read.pixel(2, 2) // inside the quiet zone
    expect(Math.min(r ?? 0, g ?? 0, b ?? 0)).toBeGreaterThan(200)
    expect(decodeQr(read.modules).text).toBe("jpeg")
  })

  it("the overlay image is composited into the file (zag#3277)", async () => {
    const onDownload = vi.fn()
    render(
      <Qr
        value="https://reado.app/overlay"
        ecc="H"
        onDownload={onDownload}
        overlay={
          <QrCode.Overlay style={{ width: 40, height: 40 }}>
            <img alt="" src={LOGO} width={40} height={40} style={{ display: "block" }} />
          </QrCode.Overlay>
        }
      />,
    )
    await getQrCode(screen).download()
    expect(onDownload.mock.calls[0]?.[0]).toMatchObject({ overlay: "included" })
    const blob = blobs.at(-1) as Blob
    const bitmap = await createImageBitmap(blob)
    const c = document.createElement("canvas")
    c.width = bitmap.width
    c.height = bitmap.height
    const ctx = c.getContext("2d")
    ctx?.drawImage(bitmap, 0, 0)
    const centre = ctx?.getImageData(bitmap.width / 2, bitmap.height / 2, 1, 1).data
    expect([centre?.[0], centre?.[1], centre?.[2]]).toEqual([225, 29, 72]) // #e11d48
  })

  it("a cross-origin overlay without CORS: the symbol alone, overlay omitted, no error (qrcode.react#359)", async () => {
    const onDownload = vi.fn()
    // Another origin (127.0.0.1 vs localhost) serving an image with no CORS headers.
    const other = new URL(location.href)
    other.hostname = other.hostname === "localhost" ? "127.0.0.1" : "localhost"
    const src = `${other.origin}/@fs${new URL("../../fixtures/avatar/face.svg", import.meta.url).pathname}`
    render(
      <Qr
        value="tainted"
        onDownload={onDownload}
        overlay={
          <QrCode.Overlay>
            <img alt="" src={src} width={30} height={30} />
          </QrCode.Overlay>
        }
      />,
    )
    const img = document.querySelector("img") as HTMLImageElement
    await vi.waitFor(() => expect(img.complete).toBe(true), { timeout: 5000 })
    await getQrCode(screen).download()
    const outcome = onDownload.mock.calls[0]?.[0]?.overlay
    // Loaded cross-origin: omitted (tainted). An engine that refused the image: omitted too.
    expect(outcome).toBe("omitted")
    const read = await pixelsToModules(blobs.at(-1) as Blob, 29)
    expect(decodeQr(read.modules).text).toBe("tainted")
  })

  it("SVG export with a data-URL overlay inlines it; no external reference (qrcode.react#379)", async () => {
    render(
      <Qr
        value="svg"
        mime="image/svg+xml"
        overlay={
          <QrCode.Overlay>
            <img alt="" src={LOGO} width={30} height={30} />
          </QrCode.Overlay>
        }
      />,
    )
    await getQrCode(screen).download()
    const text = await (blobs.at(-1) as Blob).text()
    expect(text).toContain("<image ")
    expect(text).toContain('href="data:image/svg+xml')
    expect(text).not.toContain("foreignObject")
  })

  it("sharp at any zoom: 130 % page zoom still exports an integer scale", async () => {
    document.documentElement.style.zoom = "1.3"
    try {
      render(<Qr value="zoom" size={500} />)
      await getQrCode(screen).download()
      const read = await pixelsToModules(blobs.at(-1) as Blob, 29)
      expect(read.width % 29).toBe(0)
      expect(decodeQr(read.modules).text).toBe("zoom")
    } finally {
      document.documentElement.style.zoom = ""
    }
  })
})

describe("getDataUrl", () => {
  it("resolves to a PNG at an integer scale that decodes to the value", async () => {
    const api = createRef<QrCodeApi>()
    render(
      <QrCode.Root defaultValue="png data url" apiRef={api}>
        <QrCode.Frame width={290} height={290} style={{ display: "block", background: "#fff" }}>
          <QrCode.Pattern style={{ fill: "#000" }} />
        </QrCode.Frame>
      </QrCode.Root>,
    )
    const url = (await api.current?.getDataUrl("image/png", { size: 300 })) ?? ""
    expect(url.startsWith("data:image/png;base64,")).toBe(true)
    const read = await pixelsToModules(await (await fetch(url)).blob(), 29)
    expect(read.width % 29).toBe(0)
    expect(decodeQr(read.modules).text).toBe("png data url")
    expect(clicked).toEqual([])
  })
})

describe("overlay coverage from layout", () => {
  // Version 10 at M (57 modules) on a 650 px frame: 10 px per module with the quiet zone.
  const value = "x".repeat(200)

  function Covered({ modules, ecc = "M" }: { modules: number; ecc?: "L" | "M" }) {
    return (
      <QrCode.Root defaultValue={value} encoding={{ ecc, minVersion: 10, maxVersion: 10 }}>
        <QrCode.Frame width={650} height={650} style={{ display: "block" }}>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.Overlay style={{ width: modules * 10, height: modules * 10 }} />
      </QrCode.Root>
    )
  }

  it("within budget: 9 × 9 covers 2 % and nothing is logged", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Covered modules={9} />)
    const overlay = document.querySelector('[data-part="overlay"]') as HTMLElement
    await vi.waitFor(() => expect(overlay.getAttribute("data-covers")).toBe("2"), { timeout: 3000 })
    expect(warn).not.toHaveBeenCalled()
  })

  it("over budget and reaching the finders warn (qrcode.react#395)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(<Covered modules={45} />)
    await vi.waitFor(() => expect(warn).toHaveBeenCalled(), { timeout: 3000 })
    expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/finder/)
  })

  it("the overlay is centred on the frame without the theme", async () => {
    render(<Covered modules={9} />)
    const f = (document.querySelector('[data-part="frame"]') as Element).getBoundingClientRect()
    const o = (document.querySelector('[data-part="overlay"]') as Element).getBoundingClientRect()
    expect(Math.round(o.left + o.width / 2)).toBe(Math.round(f.left + f.width / 2))
    expect(Math.round(o.top + o.height / 2)).toBe(Math.round(f.top + f.height / 2))
  })
})

describe("second oracle: BarcodeDetector", () => {
  type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> }
  const BD = (
    globalThis as {
      BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> }
    }
  ).BarcodeDetector

  it.skipIf(BD === undefined)("the engine's own decoder reads an export", async () => {
    if (!BD || !(await BD.getSupportedFormats()).includes("qr_code")) return
    render(<Qr value="https://reado.app/anywhere" />)
    await getQrCode(screen).download()
    const found = await new BD({ formats: ["qr_code"] }).detect(
      await createImageBitmap(blobs.at(-1) as Blob),
    )
    expect(found[0]?.rawValue).toBe("https://reado.app/anywhere")
  })
})

describe("scaling", () => {
  it("the frame at 220 and 221 px shows the whole symbol with its quiet zone", async () => {
    for (const px of [220, 221]) {
      const { unmount } = render(
        <QrCode.Root defaultValue="scale">
          <QrCode.Frame width={px} height={px}>
            <QrCode.Pattern />
          </QrCode.Frame>
        </QrCode.Root>,
      )
      const path = document.querySelector('[data-part="pattern"]') as SVGPathElement
      const frame = (
        document.querySelector('[data-part="frame"]') as Element
      ).getBoundingClientRect()
      const box = path.getBoundingClientRect()
      expect(box.left).toBeGreaterThan(frame.left)
      expect(box.right).toBeLessThan(frame.right + 0.5)
      expect(box.bottom).toBeLessThan(frame.bottom + 0.5)
      await act(async () => unmount())
    }
  })
})
