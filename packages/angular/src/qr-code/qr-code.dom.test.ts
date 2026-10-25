// The QR Code contract model (React's, decoding the rendered symbol) against the Angular parts,
// and markup parity.
import { Component, input } from "@angular/core"
import { createQrEncoder, type QrEncodingOptions } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { allowRindWarning, qrCodeDecodingContract, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { QrCode } from "./qr-code"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown> & { readonly overlay?: boolean }
const LOGO = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
/** The configuration the next fixture renders. */
let current: { overlay: boolean; defaultValue?: string; controlled: boolean } = {
  overlay: false,
  controlled: false,
}

const BODY = `<svg rindQrCodeFrame width="220" height="220"><path rindQrCodePattern /></svg>
      @if (cfg.overlay) {
        <div rindQrCodeOverlay><img alt="" [src]="logo" width="20" height="20" /></div>
      }
      <span rindQrCodeValueText></span>
      <button rindQrCodeDownloadTrigger>Download</button>`

@Component({
  selector: "rind-f",
  imports: [QrCode],
  template: `@if (cfg.controlled) {
      <div rindQrCodeRoot [value]="value()" [encoding]="encoding()">${BODY}</div>
    } @else {
      <div rindQrCodeRoot [defaultValue]="cfg.defaultValue">${BODY}</div>
    }`,
})
class Tree {
  readonly value = input<string>()
  readonly encoding = input<QrEncodingOptions>()
  readonly cfg = current
  readonly logo = LOGO
}
const reactFixture = ({ overlay = false, ...p }: P) =>
  r(
    R.QrCode.Root,
    p as never,
    r(R.QrCode.Frame, { width: 220, height: 220 }, r(R.QrCode.Pattern)),
    overlay
      ? r(R.QrCode.Overlay, null, r("img", { alt: "", src: LOGO, width: 20, height: 20 }))
      : null,
    r(R.QrCode.ValueText),
    r(R.QrCode.DownloadTrigger, null, "Download"),
  )
/** The component's inputs out of a prop step (the oracle's `encode` and keys are not). */
const pick = (next: unknown) => {
  const { value, encoding } = next as P
  return {
    ...(value === undefined ? {} : { value }),
    ...(encoding === undefined ? {} : { encoding }),
  }
}

function variant(name: string, start: P) {
  describe(`angular qr-code model: ${name}`, () => {
    const encoder = createQrEncoder()
    const { value, overlay, encoding } = start
    testMachine(qrCodeDecodingContract, {
      test: it,
      setup: () => {
        current = { overlay: overlay === true, controlled: true }
        return mount(Tree, { value, ...(encoding === undefined ? {} : { encoding }) })
      },
      rerender: (next, rendered) =>
        rendered.rerender({
          value,
          ...(encoding === undefined ? {} : { encoding }),
          ...pick(next),
        }),
      target: () => screen,
      anchor: [{}] as never,
      props: {
        value,
        encode: (v: string) => encoder.encode(v),
        encodingKey: "",
        root: "oracle",
      } as never,
      a11y,
      modalities: ["pointer", "keyboard", "virtual"],
    })
  })
}
variant("URL with value text", { value: "https://reado.app/anywhere" })
variant("non-ASCII with an overlay", { value: "Grüße 世界", overlay: true })
variant("digits at level H", { value: "0123456789", encoding: { ecc: "H" } })

describe("Angular QR Code matches React", () => {
  it("a value, an overlay, empty, invalid", async () => {
    // The too-long value is the invalid case: its encode error is reported.
    allowRindWarning(/qr-code/)
    for (const p of [
      { defaultValue: "https://reado.app" },
      { defaultValue: "Grüße", overlay: true },
      {},
      { defaultValue: "x".repeat(5000) },
    ] as { defaultValue?: string; overlay?: boolean }[]) {
      current = { overlay: p.overlay === true, controlled: false, ...p }
      await both(reactFixture(p), Tree)
    }
  })
})
