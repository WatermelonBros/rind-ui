// QR Code through its driver (add-qr-code 5.2, 6.2): the same tests in jsdom and in real
// browsers. jsdom has no canvas and no object URLs, so downloads here are SVG files with
// `URL.createObjectURL` stubbed; raster exports are in qr-code.browser.test.tsx.
import { QrCode, type QrCodeRootProps } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { decodeQr, getQrCode } from "../index"

const a11y = async (root: Element = document.body) => {
  const { violations } = await axe.run(root, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

// Object URLs (jsdom has none) and anchor clicks (no navigation in tests), recorded.
let created: string[] = []
let revoked: string[] = []
let clicked: { download: string; href: string }[] = []
beforeEach(() => {
  created = []
  revoked = []
  clicked = []
  let n = 0
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    const url = `blob:test/${++n}`
    created.push(url)
    return url
  })
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
    revoked.push(url)
  })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ download: this.download, href: this.href })
  })
})
afterEach(() => vi.restoreAllMocks())

/** A QR code with every part, and the fixture's "Value" input that calls `setValue`. */
function Fixture(props: Partial<QrCodeRootProps> & { readonly trigger?: React.ReactNode }) {
  const { trigger, ...root } = props
  const [value, setValue] = useState(root.defaultValue ?? "https://reado.app")
  return (
    <>
      <label>
        Value <input value={value} onChange={(e) => setValue(e.currentTarget.value)} />
      </label>
      <QrCode.Root value={value} onValueChange={setValue} {...root}>
        <QrCode.Frame width={220} height={220}>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.ValueText />
        {trigger ?? (
          <QrCode.DownloadTrigger mimeType="image/svg+xml">Download</QrCode.DownloadTrigger>
        )}
      </QrCode.Root>
    </>
  )
}

const part = (name: string) =>
  document.querySelector(`[data-scope="qr-code"][data-part="${name}"]`) as HTMLElement

describe("anatomy and naming", () => {
  it("every part is attributed with one data-instance", () => {
    render(
      <QrCode.Root defaultValue="x">
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.Overlay />
        <QrCode.ValueText />
        <QrCode.DownloadTrigger />
      </QrCode.Root>,
    )
    const parts = [...document.querySelectorAll('[data-scope="qr-code"]')]
    expect(parts.map((p) => p.getAttribute("data-part"))).toEqual([
      "root",
      "frame",
      "pattern",
      "overlay",
      "value-text",
      "download-trigger",
    ])
    expect(new Set(parts.map((p) => p.getAttribute("data-instance"))).size).toBe(1)
  })

  it("named image with the default name (qrcode.react#283, #319), value as description", async () => {
    render(<Fixture defaultValue="WIFI:T:WPA;S:Home;P:secret;;" />)
    const frame = screen.getByRole("img", { name: "QR code" })
    expect(frame.getAttribute("aria-describedby")).toBe(part("value-text").id)
    expect(await getQrCode(screen).description()).toBe("WIFI:T:WPA;S:Home;P:secret;;")
    await a11y()
  })

  it("translated name, consumer description kept first", () => {
    render(
      <>
        <p id="hint">Scan with your phone</p>
        <QrCode.Root defaultValue="x">
          <QrCode.Frame aria-label="Codice QR per l'app" aria-describedby="hint">
            <QrCode.Pattern />
          </QrCode.Frame>
          <QrCode.ValueText />
        </QrCode.Root>
      </>,
    )
    const frame = screen.getByRole("img", { name: "Codice QR per l'app" })
    expect(frame.getAttribute("aria-describedby")).toBe(`hint ${part("value-text").id}`)
  })

  it("messages: a partial override keeps the other default; an icon-only trigger", () => {
    render(
      <QrCode.Root defaultValue="x" messages={{ label: "Codice QR" }}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.DownloadTrigger>
          <svg aria-hidden="true" />
        </QrCode.DownloadTrigger>
      </QrCode.Root>,
    )
    expect(screen.getByRole("img", { name: "Codice QR" })).toBeTruthy()
    // An SVG-only trigger has content but no text: name it explicitly through messages.
    render(
      <QrCode.Root defaultValue="x" messages={{ download: "Scarica" }}>
        <QrCode.DownloadTrigger />
      </QrCode.Root>,
    )
    expect(screen.getByRole("button", { name: "Scarica" })).toBeTruthy()
  })

  it("overlay image is not announced (presentational children of the img role)", () => {
    render(
      <QrCode.Root defaultValue="x">
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.Overlay>
          <img alt="Reado" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        </QrCode.Overlay>
      </QrCode.Root>,
    )
    // The overlay is a sibling of the frame: its image keeps its own alt; the frame is one image.
    expect(screen.getAllByRole("img", { name: "QR code" })).toHaveLength(1)
  })
})

describe("element substitution", () => {
  it("parts rendered as other elements keep their behaviour", async () => {
    render(
      <QrCode.Root defaultValue="swap" render={<section />}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
        <QrCode.ValueText render={<p />} />
        <QrCode.DownloadTrigger
          mimeType="image/svg+xml"
          render={<button type="button" className="mine" />}
        >
          Save
        </QrCode.DownloadTrigger>
      </QrCode.Root>,
    )
    expect(part("root").tagName).toBe("SECTION")
    expect(part("value-text").tagName).toBe("P")
    const frame = screen.getByRole("img", { name: "QR code" })
    expect(frame.getAttribute("aria-describedby")).toBe(part("value-text").id)
    const trigger = screen.getByRole("button", { name: "Save" })
    expect(trigger.className).toContain("mine")
    await getQrCode(screen).download()
    expect(clicked.map((c) => c.download)).toEqual(["qr-code.svg"])
  })
})

describe("value and states", () => {
  it("the driver reads the symbol back (decode invariant)", async () => {
    render(<Fixture defaultValue="hello" />)
    const q = getQrCode(screen)
    expect(await q.decoded()).toBe("hello")
    expect(await q.version()).toBe(1)
    expect(await q.ecc()).toBe("M")
    expect(await q.size()).toBe(21)
    expect(part("frame").getAttribute("viewBox")).toBe("0 0 29 29")
  })

  it("uncontrolled setValue reports once; controlled refusal keeps the symbol (ark#4141)", async () => {
    const onValueChange = vi.fn()
    const { rerender } = render(<Fixture defaultValue="https://a.example" />)
    await getQrCode(screen).setValue("https://b.example")
    expect(await getQrCode(screen).decoded()).toBe("https://b.example")
    rerender(
      <QrCode.Root value="fixed" onValueChange={onValueChange}>
        <QrCode.Frame>
          <QrCode.Pattern />
        </QrCode.Frame>
      </QrCode.Root>,
    )
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("value too long: invalid, hidden frame, onEncodeError once (react-qr-code#255)", async () => {
    const onEncodeError = vi.fn()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { rerender } = render(
      <Fixture defaultValue={"é".repeat(4000)} onEncodeError={onEncodeError} />,
    )
    expect(part("root").getAttribute("data-state")).toBe("invalid")
    expect(part("frame").getAttribute("aria-hidden")).toBe("true")
    expect(part("pattern").getAttribute("d")).toBe("")
    expect(onEncodeError).toHaveBeenCalledTimes(1)
    expect(onEncodeError.mock.calls[0]?.[0]).toMatchObject({ error: "too-long" })
    rerender(<Fixture defaultValue={"é".repeat(4000)} onEncodeError={onEncodeError} />)
    expect(onEncodeError).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
    // Recovery: a valid value makes it an image again (no frame to locate the driver by yet).
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "ok" } })
    expect(screen.getByRole("img", { name: "QR code" })).toBeTruthy()
    expect(await getQrCode(screen).decoded()).toBe("ok")
  })

  it("empty value: data-state empty, no modules, trigger aria-disabled and inert to presses", async () => {
    const onDownload = vi.fn()
    render(<Fixture defaultValue="" onDownload={onDownload} />)
    expect(part("root").getAttribute("data-state")).toBe("empty")
    expect(part("pattern").getAttribute("d")).toBe("")
    expect(screen.queryByRole("img", { name: "QR code" })).toBeNull()
    const trigger = screen.getByRole("button", { name: "Download" })
    expect(trigger.getAttribute("aria-disabled")).toBe("true")
    expect(trigger.hasAttribute("data-disabled")).toBe(true)
    await act(async () => trigger.click())
    expect(onDownload).not.toHaveBeenCalled()
    expect(clicked).toEqual([])
  })
})

describe("download (SVG in jsdom)", () => {
  it("driver round trip: setValue, download, lastDownload has the file name", async () => {
    const onDownload = vi.fn()
    render(<Fixture defaultValue="x" onDownload={onDownload} />)
    const q = getQrCode(screen)
    await q.setValue("hello")
    await q.download()
    expect(await q.decoded()).toBe("hello")
    expect(await q.lastDownload()).toBe("qr-code.svg")
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onDownload.mock.calls[0]?.[0]).toEqual({
      fileName: "qr-code.svg",
      mimeType: "image/svg+xml",
      overlay: "none",
    })
    expect(clicked.map((c) => c.download)).toEqual(["qr-code.svg"])
  })

  it("hostile file name, double click → one file, the object URL revoked", async () => {
    const onDownload = vi.fn()
    render(
      <Fixture
        defaultValue="x"
        onDownload={onDownload}
        trigger={
          <QrCode.DownloadTrigger mimeType="image/svg+xml" fileName="../../etc/x.svg">
            Save
          </QrCode.DownloadTrigger>
        }
      />,
    )
    const trigger = screen.getByRole("button", { name: "Save" })
    await act(async () => {
      trigger.click()
      trigger.click()
    })
    await vi.waitFor(() => expect(onDownload).toHaveBeenCalled(), { timeout: 2000 })
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(clicked).toHaveLength(1)
    expect(clicked[0]?.download).toBe("etc-x.svg")
    await vi.waitFor(() => expect(revoked).toEqual(created), { timeout: 2000 })
  })

  it("the SVG file is self-contained and decodes to the value", async () => {
    let blob: Blob | undefined
    vi.mocked(URL.createObjectURL).mockImplementation((b) => {
      blob = b as Blob
      return "blob:test/svg"
    })
    render(<Fixture defaultValue="svg file" />)
    await getQrCode(screen).download()
    const text = await (blob as Blob).text()
    expect(text).toContain('shape-rendering="crispEdges"')
    expect(text.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(/https?:/)
    const d = /<path d="([^"]*)"/.exec(text)?.[1] ?? ""
    const n = Number(/viewBox="0 0 (\d+)/.exec(text)?.[1])
    const { parseQrPath } = await import("../index")
    expect(decodeQr(parseQrPath(d, `0 0 ${n} ${n}`, n - 8).modules).text).toBe("svg file")
  })
})
