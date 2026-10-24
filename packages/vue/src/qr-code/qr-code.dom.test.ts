// The QR Code contract model (React's, decoding the rendered symbol) against the Vue parts,
// and markup parity.
import { createQrEncoder } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { allowRindWarning, qrCodeDecodingContract, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { QrCode } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown> & { readonly overlay?: boolean }
const LOGO = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
const fixture = ({ overlay = false, ...p }: P) =>
  h(QrCode.Root, p, () => [
    h(QrCode.Frame, { width: 220, height: 220 }, () => h(QrCode.Pattern)),
    overlay
      ? h(QrCode.Overlay, null, () => h("img", { alt: "", src: LOGO, width: 20, height: 20 }))
      : null,
    h(QrCode.ValueText),
    h(QrCode.DownloadTrigger, null, () => "Download"),
  ])
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
/** The component's props out of a prop step (the oracle's `encode` and keys are not). */
const pick = (next: unknown) => {
  const { value, encoding } = next as P
  return {
    ...(value === undefined ? {} : { modelValue: value }),
    ...(encoding === undefined ? {} : { encoding }),
  }
}

function variant(name: string, start: P) {
  describe(`vue qr-code model: ${name}`, () => {
    const encoder = createQrEncoder()
    const { value, ...rest } = start
    testMachine(qrCodeDecodingContract, {
      test: it,
      setup: () => mount((p: P) => fixture(p), { ...rest, modelValue: value }),
      rerender: (next, rendered) =>
        rendered.rerender({ ...rest, modelValue: value, ...pick(next) }),
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

describe("Vue QR Code matches React", () => {
  it("a value, an overlay, empty, invalid", async () => {
    // The too-long value is the invalid case: its encode error is reported.
    allowRindWarning(/qr-code/)
    for (const [react, vue] of [
      [{ defaultValue: "https://reado.app" }, { defaultValue: "https://reado.app" }],
      [
        { defaultValue: "Grüße", overlay: true },
        { defaultValue: "Grüße", overlay: true },
      ],
      [{}, {}],
      [{ defaultValue: "x".repeat(5000) }, { defaultValue: "x".repeat(5000) }],
    ] as const) {
      await serverParity(reactFixture(react), () => fixture(vue))
      await clientParity(reactFixture(react), () => fixture(vue))
    }
  })
})
