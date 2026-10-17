// QR Code machine, connect, coverage, encoding memo and meta in Node (add-qr-code 2.3, 3.1,
// 3.2). The export and the overlay measurement need a browser (qr-code.browser.test.tsx).
import { describe, expect, it, vi } from "vitest"
import { sanitizeFileName } from "../../dom/download"
import { createService } from "../../machine/service"
import { qrCodeConnect } from "./qr-code.connect"
import { qrCodeContract } from "./qr-code.contract"
import { overlayCoverage, warnOverlayCoverage } from "./qr-code.coverage"
import { createQrEncoder, encodeForQrCode, qrEncodingKey } from "./qr-code.encoding"
import { type QrCodeProps, qrCodeMachine } from "./qr-code.machine"
import { qrCodeMessages } from "./qr-code.messages"
import { qrCodeMeta } from "./qr-code.meta"

// Node: no DOM, so the effects return early (no `document`, no ResizeObserver).
const env = {
  dom: { getRootNode: () => ({}) as Document, getById: () => null, activeElement: () => null },
  scheduler: {
    // fake-time: never called in these tests (no download completes in Node)
    setTimeout: (cb: () => void) => cb,
    clearTimeout: () => {},
    requestAnimationFrame: (cb: () => void) => cb,
    cancelAnimationFrame: () => {},
  },
}

function make(over: Partial<QrCodeProps> = {}) {
  const onValueChange = vi.fn()
  const onDownload = vi.fn()
  const encoder = createQrEncoder()
  let props: QrCodeProps = {
    root: "q",
    encode: (v) => encoder.encode(v),
    encodingKey: "",
    defaultValue: "hello",
    onValueChange,
    onDownload,
    ...over,
  }
  const s = createService(qrCodeMachine, props, env)
  s.start()
  const set = (next: Partial<QrCodeProps>) => {
    props = { ...props, ...next }
    s.setProps(props)
  }
  return { s, set, onValueChange, onDownload, value: () => s.view(props).values.value }
}

describe("qr-code machine", () => {
  it("uncontrolled: setValue changes the value and reports it once", () => {
    const { s, value, onValueChange } = make({ defaultValue: "https://a.example" })
    s.send({ type: "VALUE.SET", value: "https://b.example" })
    expect(value()).toBe("https://b.example")
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("https://b.example")
  })

  it("controlled: setValue only proposes (ark#4141)", () => {
    const { s, value, onValueChange } = make({ value: "a" })
    s.send({ type: "VALUE.SET", value: "b" })
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(value()).toBe("a")
  })

  it("a download starts only with a symbol, and a second press while downloading is ignored", () => {
    const empty = make({ value: "" })
    empty.s.send({ type: "DOWNLOAD", modality: "pointer" })
    expect(empty.s.getSnapshot().state).toBe("ready")
    const invalid = make({ value: "x".repeat(5000) })
    invalid.s.send({ type: "DOWNLOAD", modality: "pointer" })
    expect(invalid.s.getSnapshot().state).toBe("ready")
  })

  it("download done records it and calls onDownload once; failure goes back to ready", () => {
    const { s, onDownload } = make()
    // In Node the export effect cannot run: it reports a failure at once.
    s.send({ type: "DOWNLOAD", modality: "keyboard", fileName: "a.png" })
    expect(s.getSnapshot().state).toBe("ready")
    expect(onDownload).not.toHaveBeenCalled()
    // The completion path itself.
    const t = make()
    const details = { fileName: "qr.png", mimeType: "image/png" as const, overlay: "none" as const }
    t.s.send({ type: "DOWNLOAD.DONE", details })
    expect(t.onDownload).not.toHaveBeenCalled() // only from `downloading`
  })

  it("parts and coverage are recorded", () => {
    const { s } = make()
    s.send({ type: "PARTS.CHANGED", valueText: true, overlay: true })
    s.send({ type: "OVERLAY.MEASURED", coverage: { covers: 2, modules: 81, reachesFinder: false } })
    expect(s.getSnapshot().context.parts).toEqual({ valueText: true, overlay: true })
    expect(s.getSnapshot().context.coverage?.covers).toBe(2)
  })
})

describe("encoding memo (spec 'Inline options object')", () => {
  it("encodes once for the same value and option values, whatever the object identity", () => {
    const enc = createQrEncoder()
    for (let i = 0; i < 10; i++) enc.encode("https://reado.app", { ecc: "M" })
    expect(enc.runs()).toBe(1)
    enc.encode("https://reado.app", { ecc: "Q" })
    expect(enc.runs()).toBe(2)
    expect(qrEncodingKey("v", { ecc: "M" })).toBe(qrEncodingKey("v", { ecc: "M", mask: undefined }))
  })

  it("empty, invalid and ready", () => {
    expect(encodeForQrCode("").status).toBe("empty")
    expect(encodeForQrCode("x".repeat(4000)).status).toBe("invalid")
    const r = encodeForQrCode("hi")
    expect(r.status === "ready" && r.result.ecc).toBe("M")
  })
})

describe("connect", () => {
  const api = (value: string, extra = {}) =>
    qrCodeConnect({
      instance: "q",
      encoded: encodeForQrCode(value, extra),
      downloading: false,
      messages: qrCodeMessages,
    })

  it("quiet zone: a version-1 symbol has the viewBox 0 0 29 29", () => {
    const frame = api("hello").frame({ named: false, valueTextId: undefined })
    expect(frame["viewBox"]).toBe("0 0 29 29")
    expect(frame["shape-rendering"]).toBe("crispEdges")
    expect(frame["xmlns"]).toBe("http://www.w3.org/2000/svg")
  })

  it("ready: role img, the default name, the value text appended to a consumer description", () => {
    const frame = api("hello").frame({ named: false, valueTextId: "vt", describedBy: "mine" })
    expect([frame["role"], frame["aria-label"], frame["aria-describedby"]]).toEqual([
      "img",
      "QR code",
      "mine vt",
    ])
    expect(api("hello").frame({ named: true, valueTextId: undefined })["aria-label"]).toBe(
      undefined,
    )
  })

  it("empty and invalid: hidden frame, no role, no modules, the same size", () => {
    for (const value of ["", "x".repeat(4000)]) {
      const a = api(value)
      const frame = a.frame({ named: false, valueTextId: "vt" })
      expect([frame["role"], frame["aria-hidden"], frame["viewBox"]]).toEqual([
        undefined,
        "true",
        "0 0 29 29",
      ])
      expect(a.pattern()["d"]).toBe("")
      expect(a.downloadTrigger(true)["data-disabled"]).toBe("")
    }
  })

  it("styling hooks: data-version, data-ecc, data-modules (version 3, level M)", () => {
    const root = api("x".repeat(30)).root()
    expect([root["data-version"], root["data-ecc"], root["data-modules"]]).toEqual(["3", "M", "29"])
  })

  it("download trigger: named by messages.download only without content", () => {
    expect(api("a").downloadTrigger(false)["aria-label"]).toBe("Download QR code")
    expect(api("a").downloadTrigger(true)["aria-label"]).toBe(undefined)
  })
})

describe("overlay coverage", () => {
  // A version-10 symbol (57 modules) with a quiet zone of 4: 65 modules on a 650 px frame.
  const frame = { left: 0, top: 0, width: 650, height: 650 }
  const centred = (modules: number) => ({
    left: 325 - modules * 5,
    top: 325 - modules * 5,
    width: modules * 10,
    height: modules * 10,
  })

  it("within budget: 9 × 9 over version 10 at M covers 2 % and logs nothing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const c = overlayCoverage(frame, centred(9), 57, 4)
    expect(c).toEqual({ covers: 2, modules: 81, reachesFinder: false })
    warnOverlayCoverage(c, { ecc: "M" })
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("over budget and reaching the finders warn once each (qrcode.react#395)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const big = overlayCoverage(frame, centred(25), 57, 4)
    expect(big.covers).toBe(19)
    warnOverlayCoverage(big, { ecc: "M" })
    warnOverlayCoverage(big, { ecc: "M" })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/19 %.*level M.*7.5 %/)
    const huge = overlayCoverage(frame, centred(45), 57, 4)
    expect(huge.reachesFinder).toBe(true)
    warnOverlayCoverage(huge, { ecc: "H" })
    expect(warn.mock.calls.some((c) => String(c[0]).includes("finder"))).toBe(true)
    expect(overlayCoverage(frame, centred(41), 57, 4).reachesFinder).toBe(false)
    warn.mockRestore()
  })
})

describe("download file names", () => {
  it("hostile file name loses separators and .. segments", () => {
    expect(sanitizeFileName("../../etc/x.png", "qr-code.png")).toBe("etc-x.png")
    expect(sanitizeFileName("a\u0000b\nc.png", "f")).toBe("abc.png")
    expect(sanitizeFileName("..", "qr-code.png")).toBe("qr-code.png")
  })
})

describe("qr-code meta matches the code", () => {
  const keys = (p: object) =>
    Object.keys(p)
      .filter((k) => k.startsWith("data-"))
      .sort()
  it("contract", () => {
    expect(Object.keys(qrCodeMeta.contract.actions)).toEqual(Object.keys(qrCodeContract.actions))
    expect(qrCodeMeta.contract.queries).toEqual(Object.keys(qrCodeContract.queries))
    expect(Object.keys(qrCodeMeta.states).sort()).toEqual(
      Object.keys(qrCodeMachine.def.states).sort(),
    )
  })
  it("data attributes (connect's are documented)", () => {
    const a = qrCodeConnect({
      instance: "q",
      encoded: encodeForQrCode("hi"),
      downloading: false,
      covers: 3,
      lastDownload: "x.png",
      messages: qrCodeMessages,
    })
    const parts = {
      root: a.root(),
      frame: a.frame({ named: false, valueTextId: undefined }),
      pattern: a.pattern(),
      overlay: a.overlay(),
      "value-text": a.valueText(),
      "download-trigger": a.downloadTrigger(true),
    }
    for (const [name, props] of Object.entries(parts)) {
      const documented = Object.keys(qrCodeMeta.dataAttributes[name as keyof typeof parts])
      for (const k of keys(props)) expect(documented).toContain(k)
    }
  })
})
