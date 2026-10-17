// Model-based tests (add-qr-code 6.1): the contract's states with the decode invariant and
// the generic invariants over value classes (ready with value text and overlay, empty,
// invalid). Every QR event is API-, async- or layout-driven, so the walk is the mount of
// each class plus the invariants; the transitions themselves are in the DOM and browser
// tests. A wrapper that drops the frame's role fails the name invariant.
import { createQrEncoder } from "@rind-ui/core"
import { QrCode, type QrCodeRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { domEnv, qrCodeDecodingContract, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = QrCodeRootProps & { readonly broken?: boolean; readonly overlay?: boolean }

/** The component's props out of a prop step (the oracle's `encode` and keys are not). */
const pick = (next: unknown): Partial<Props> => {
  const { value, encoding } = next as Props
  return {
    ...(value === undefined ? {} : { value }),
    ...(encoding === undefined ? {} : { encoding }),
  }
}

function Fixture({ broken = false, overlay = false, ...props }: Props) {
  return (
    <QrCode.Root {...props}>
      <QrCode.Frame
        width={220}
        height={220}
        {...(broken ? { render: ({ role: _dropped, ...p }) => <svg {...p} /> } : {})}
      >
        <QrCode.Pattern />
      </QrCode.Frame>
      {overlay ? (
        <QrCode.Overlay>
          <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width={20} height={20} />
        </QrCode.Overlay>
      ) : null}
      <QrCode.ValueText />
      <QrCode.DownloadTrigger>Download</QrCode.DownloadTrigger>
    </QrCode.Root>
  )
}

function variant(name: string, start: Props) {
  describe(`qr-code model: ${name}`, () => {
    const encoder = createQrEncoder()
    testMachine(qrCodeDecodingContract, {
      test: it,
      setup: () => render(<Fixture {...start} />),
      rerender: (next, rendered) => rendered.rerender(<Fixture {...start} {...pick(next)} />),
      target: () => screen,
      anchor: [{}] as never,
      props: {
        value: start.value,
        encode: (v: string) => encoder.encode(v),
        encodingKey: "",
        root: "oracle",
      } as never,
      a11y,
      modalities: ["pointer", "keyboard", "virtual"],
    })
  })
}

const noop = () => {}
variant("URL with value text", { value: "https://reado.app/anywhere", onValueChange: noop })
variant("non-ASCII with an overlay", { value: "Grüße 世界", onValueChange: noop, overlay: true })
variant("digits at level H", { value: "0123456789", onValueChange: noop, encoding: { ecc: "H" } })

describe("broken QR Code fails with the invariant's name", () => {
  it("a wrapper that drops role=img → the frame is not a named image", {
    timeout: 60_000,
  }, async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    const encoder = createQrEncoder()
    testMachine(qrCodeDecodingContract, {
      test: (n, fn) => tests.push({ name: n, fn }),
      setup: () =>
        render(
          // The frame has no role: the driver cannot even locate it by its name.
          <Fixture value="x" onValueChange={() => {}} broken aria-label="QR code" />,
        ),
      rerender: (next, rendered) => rendered.rerender(<Fixture broken {...pick(next)} />),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{}] as never,
      props: {
        value: "x",
        encode: (v: string) => encoder.encode(v),
        encodingKey: "",
        root: "o",
      } as never,
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.length).toBeGreaterThan(0)
    // Without role="img" the frame is no named image: the anchor misses in every step.
    expect(errors.every((e) => e.includes("no element matches the anchor (role"))).toBe(true)
    expect(errors.every((e) => /img.{0,4} named .{0,4}QR code/.test(e))).toBe(true)
  })
})
