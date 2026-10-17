// QR Code on the server (add-qr-code 4.2): the symbol, its name and the value-text relation
// are in the server HTML, identical to what the encoder gives in Node.
import { encodeQr, qrPath } from "@rind-ui/core/qr"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { QrCode } from "../index"

afterEach(() => vi.restoreAllMocks())

function html(node: React.ReactNode) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const out = renderToString(node)
  expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
  return out
}

const qr = (value: string, extra?: React.ReactNode) => (
  <QrCode.Root id="q" value={value} onValueChange={() => {}} encoding={{ ecc: "M" }}>
    <QrCode.Frame>
      <QrCode.Pattern />
    </QrCode.Frame>
    {extra}
  </QrCode.Root>
)

describe("QR Code server rendering", () => {
  it("the d attribute is the encoder's merged path, byte for byte", () => {
    const out = html(qr("https://reado.app"))
    const r = encodeQr("https://reado.app", { ecc: "M" })
    if (!r.ok) throw new Error("encodes")
    expect(out).toContain(`d="${qrPath(r.modules)}"`)
    expect(out).toContain('viewBox="0 0 33 33"')
    expect(out).toContain('shape-rendering="crispEdges"')
    expect(out).toContain('role="img"')
    expect(out).toContain('aria-label="QR code"')
  })

  it("the value text is the frame's description in the server HTML (expected part)", () => {
    const out = html(qr("hello", <QrCode.ValueText />))
    const id =
      /<span[^>]*id="([^"]+)"[^>]*data-part="value-text"|data-part="value-text"[^>]*id="([^"]+)"/.exec(
        out,
      )
    const vt = id?.[1] ?? id?.[2]
    expect(vt).toBeTruthy()
    expect(out).toContain(`aria-describedby="${vt}"`)
    expect(out).toContain(">hello</span>")
  })

  it("without a ValueText the server HTML has no aria-describedby (no dangling id)", () => {
    const out = html(qr("hello"))
    expect(out).not.toContain("aria-describedby")
  })

  it("a ValueText nested in elements is still found; every describedby id exists", () => {
    const out = html(
      qr(
        "nested",
        <div>
          <p>
            <QrCode.ValueText />
          </p>
        </div>,
      ),
    )
    const ref = /aria-describedby="([^"]+)"/.exec(out)?.[1] ?? ""
    expect(ref).not.toBe("")
    for (const id of ref.split(" ")) expect(out).toContain(`id="${id}"`)
  })

  it("empty and invalid values render a hidden, unnamed frame without throwing", () => {
    for (const value of ["", "x".repeat(4000)]) {
      const out = html(qr(value))
      expect(out).toContain('aria-hidden="true"')
      expect(out).not.toContain('role="img"')
      expect(out).toContain('d=""')
    }
  })

  it("a right-to-left page renders the same symbol", () => {
    const ltr = html(qr("rtl?"))
    const rtl = html(<div dir="rtl">{qr("rtl?")}</div>)
    expect(rtl).toContain(/ d="[^"]*"/.exec(ltr)?.[0] ?? "missing")
  })
})
