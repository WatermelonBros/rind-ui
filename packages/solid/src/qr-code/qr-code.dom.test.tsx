/** @jsxImportSource solid-js */
// The QR Code contract model (React's, decoding the rendered symbol) against the Solid parts,
// and markup parity.
import { createQrEncoder } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { allowRindWarning, qrCodeDecodingContract, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { QrCode, type QrCodeRootProps } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
type P = Record<string, unknown> & { readonly overlay?: boolean }
const LOGO = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
const fixture = (all: P): JSX.Element => {
  const { overlay = false, ...p } = all
  return (
    <QrCode.Root {...(p as QrCodeRootProps)}>
      <QrCode.Frame width={220} height={220}>
        <QrCode.Pattern />
      </QrCode.Frame>
      {overlay ? (
        <QrCode.Overlay>
          <img alt="" src={LOGO} width={20} height={20} />
        </QrCode.Overlay>
      ) : null}
      <QrCode.ValueText />
      <QrCode.DownloadTrigger>Download</QrCode.DownloadTrigger>
    </QrCode.Root>
  )
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
/** The component's props out of a prop step (the oracle's `encode` and keys are not). */
const pick = (next: unknown) => {
  const { value, encoding } = next as P
  return {
    ...(value === undefined ? {} : { value }),
    ...(encoding === undefined ? {} : { encoding }),
  }
}

function variant(name: string, start: P) {
  describe(`solid qr-code model: ${name}`, () => {
    const encoder = createQrEncoder()
    const { value, ...rest } = start
    testMachine(qrCodeDecodingContract, {
      test: it,
      setup: () => mount((p: P) => fixture(p), { ...rest, value }),
      rerender: (next, rendered) => rendered.rerender({ ...rest, value, ...pick(next) }),
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

describe("Solid QR Code matches React", () => {
  it("a value, an overlay, empty, invalid", async () => {
    // The too-long value is the invalid case: its encode error is reported.
    allowRindWarning(/qr-code/)
    for (const p of [
      { defaultValue: "https://reado.app" },
      { defaultValue: "Grüße", overlay: true },
      {},
      { defaultValue: "x".repeat(5000) },
    ]) {
      await clientParity(reactFixture(p), () => fixture(p))
    }
  })
})
