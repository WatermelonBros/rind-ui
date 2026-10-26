// Signature Pad (React) through its driver (spec signature-pad): anatomy and names, server HTML
// and hydration. Drawing needs layout: signature-pad.browser.test.tsx.
import { RindProvider, SignaturePad, type SignaturePadRootProps } from "@rind-ui/react"
import { act, render, screen } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getSignaturePad, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

function Pad(props: Partial<SignaturePadRootProps>) {
  return (
    <SignaturePad.Root name="signature" {...props}>
      <SignaturePad.Label>Signature</SignaturePad.Label>
      <SignaturePad.Control style={{ width: 300, height: 120, display: "block" }}>
        <SignaturePad.Segment />
        <SignaturePad.Guide />
      </SignaturePad.Control>
      <SignaturePad.Status />
      <SignaturePad.UndoTrigger>Undo</SignaturePad.UndoTrigger>
      <SignaturePad.ClearTrigger>Clear</SignaturePad.ClearTrigger>
    </SignaturePad.Root>
  )
}

function setup(node: React.ReactNode) {
  const rec = recordingAnnouncer()
  render(<RindProvider announcer={rec.announcer}>{node}</RindProvider>)
  return { log: rec.log, d: getSignaturePad(screen, { label: "Signature" }) }
}

const part = (name: string) =>
  document.querySelector<HTMLElement>(`[data-scope="signature-pad"][data-part="${name}"]`)

describe("signature pad anatomy", () => {
  it("the Control is an image named by the Label, described by the Status, not a Tab stop", async () => {
    const { d } = setup(<Pad />)
    const control = screen.getByRole("img", { name: "Signature" })
    expect(control.tabIndex).toBe(-1)
    expect(await d.statusText()).toBe("Not signed")
    expect(control.getAttribute("aria-describedby")).toBe(part("status")?.id)
    expect(part("segment")?.getAttribute("aria-hidden")).toBe("true")
    expect(part("guide")?.getAttribute("aria-hidden")).toBe("true")
    expect(control.style.touchAction).toBe("none")
    expect(screen.getByRole("button", { name: "Clear Signature" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Undo Signature" })).toBeTruthy()
    expect(await d.isEmpty()).toBe(true)
    expect(await d.clearDisabled()).toBe(true)
  })
})

describe("signature pad server rendering", () => {
  it("server HTML hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <RindProvider>
          <Pad />
        </RindProvider>
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[role="img"]')?.getAttribute("data-empty")).not.toBeNull()
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
