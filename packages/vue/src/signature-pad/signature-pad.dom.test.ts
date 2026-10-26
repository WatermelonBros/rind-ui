// Signature Pad (Vue): anatomy and names, and markup parity with React (server and client).
// Drawing needs layout: signature-pad.browser.test.ts.
import * as R from "@rind-ui/react"
import { getSignaturePad } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, expect, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { SignaturePad } from "../index"

const style = { width: "300px", height: "120px", display: "block" }
const pad = (p: Record<string, unknown> = {}) =>
  h(SignaturePad.Root, { name: "signature", ...p }, () => [
    h(SignaturePad.Label, null, () => "Signature"),
    h(SignaturePad.Control, { style }, () => [h(SignaturePad.Segment), h(SignaturePad.Guide)]),
    h(SignaturePad.Status),
    h(SignaturePad.UndoTrigger, null, () => "Undo"),
    h(SignaturePad.ClearTrigger, null, () => "Clear"),
  ])
const reactPad = () =>
  r(
    R.SignaturePad.Root,
    { name: "signature" },
    r(R.SignaturePad.Label, { key: "l" }, "Signature"),
    r(
      R.SignaturePad.Control,
      { key: "c", style: { width: 300, height: 120, display: "block" } },
      r(R.SignaturePad.Segment, { key: "s" }),
      r(R.SignaturePad.Guide, { key: "g" }),
    ),
    r(R.SignaturePad.Status, { key: "st" }),
    r(R.SignaturePad.UndoTrigger, { key: "u" }, "Undo"),
    r(R.SignaturePad.ClearTrigger, { key: "x" }, "Clear"),
  )
const part = (name: string) =>
  document.querySelector<HTMLElement>(`[data-scope="signature-pad"][data-part="${name}"]`)

describe("vue signature pad", () => {
  it("the Control is an image named by the Label, described by the Status, not a Tab stop", async () => {
    mount(() => pad())
    const d = getSignaturePad(document.body, { label: "Signature" })
    const control = part("control") as HTMLElement
    expect(control.getAttribute("role")).toBe("img")
    expect(await d.name()).toBe("Signature")
    expect(control.tabIndex).toBe(-1)
    expect(await d.statusText()).toBe("Not signed")
    expect(control.getAttribute("aria-describedby")).toBe(part("status")?.id)
    expect(control.style.touchAction).toBe("none")
    expect(await d.clearDisabled()).toBe(true)
    expect((part("hidden-input") as HTMLInputElement).readOnly).toBe(false)
  })

  it("matches React's markup, server and client", async () => {
    await serverParity(reactPad(), () => pad())
    await clientParity(reactPad(), () => pad())
  })
})
