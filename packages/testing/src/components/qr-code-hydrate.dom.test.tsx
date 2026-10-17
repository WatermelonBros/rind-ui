// QR Code hydrates the server HTML with no mismatch and the same `d` (spec "Server
// Rendering"), in React Strict Mode, with an inline encoding object.
import { QrCode } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

const tree = (value: string) => (
  <StrictMode>
    <QrCode.Root defaultValue={value} encoding={{ ecc: "M" }}>
      <QrCode.Frame width={220} height={220}>
        <QrCode.Pattern />
      </QrCode.Frame>
      <QrCode.ValueText />
      <QrCode.DownloadTrigger>Download</QrCode.DownloadTrigger>
    </QrCode.Root>
  </StrictMode>
)

describe("QR Code hydration", () => {
  it.each(["https://reado.app/anywhere", "", "x".repeat(4000)])("hydrates %#", async (value) => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree(value))
    document.body.append(container)
    const d = container.querySelector("path")?.getAttribute("d")
    const describedBy = container.querySelector("svg")?.getAttribute("aria-describedby")
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree(value), { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    // The too-long value warns once in development (the encoder failed); nothing else does.
    expect(warn.mock.calls.filter((c) => !String(c[0]).includes("no symbol rendered"))).toEqual([])
    expect(container.querySelector("path")?.getAttribute("d")).toBe(d)
    expect(container.querySelector("svg")?.getAttribute("aria-describedby")).toBe(describedBy)
    await act(async () => root?.unmount())
    container.remove()
  })
})
