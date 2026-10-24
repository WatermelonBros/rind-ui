/** @jsxImportSource solid-js */
// The Button contract's model-based test, with React's variants, against the Solid Button;
// markup parity with React.
import { buttonContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, expect, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Button, type ButtonProps, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const withPlatform = (props: ButtonProps) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    <Button {...props} onPress={onPress}>
      Save
    </Button>
  </RindProvider>
)
const runs = {
  directions: ["ltr", "rtl"] as const,
  platforms: [platforms.apple, platforms.windows],
}
const base = { disabled: undefined, pending: undefined }
const anchor = [{ name: "Save" }] as never

let presses = 0
const onPress = () => {
  presses += 1
}
const activations = { action: "notifyPress", count: () => presses }

function variant(name: string, props: ButtonProps, extra = {}) {
  describe(`solid button model: ${name}`, () => {
    testMachine(buttonContract, {
      test: it,
      setup: () => mount(() => withPlatform(props)),
      activations,
      target: () => screen,
      anchor,
      props: { ...base, ...props, render: undefined } as never,
      a11y,
      ...extra,
    })
  })
}

variant("default", {}, runs)
variant("submit", { type: "submit" })
variant("reset", { type: "reset" })
variant("disabled", { disabled: true })
variant("focusableWhenDisabled", { disabled: true, focusableWhenDisabled: true })
variant("pending", { pending: true })
variant("render div", { render: (props) => <div {...props} /> })

describe("solid button model: pending edges through rerender ($sync:pending)", () => {
  testMachine(buttonContract, {
    test: it,
    setup: () =>
      // JSX reads the store, so a rerender reaches the Button (an object built here would not).
      mount(
        (p: { pending: boolean }) => (
          <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
            <Button pending={p.pending} onPress={onPress}>
              Save
            </Button>
          </RindProvider>
        ),
        { pending: false },
      ),
    rerender: (next, rendered) =>
      rendered.rerender({ pending: (next as { pending: boolean }).pending }),
    target: () => screen,
    anchor,
    props: { ...base, pending: false } as never,
    a11y,
    modalities: ["keyboard", "pointer"],
  })
})

describe("solid button", () => {
  it("href: a link that keeps link semantics", () => {
    mount(() => <Button href="/docs">Docs</Button>)
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.getAttribute("href")).toBe("/docs")
    expect(link.getAttribute("data-scope")).toBe("button")
  })
})

describe("Solid Button matches React", () => {
  it("variants and a link", async () => {
    const cases: [Record<string, unknown>, ButtonProps][] = [
      [{}, {}],
      [{ type: "submit" }, { type: "submit" }],
      [{ disabled: true }, { disabled: true }],
      [
        { disabled: true, focusableWhenDisabled: true },
        { disabled: true, focusableWhenDisabled: true },
      ],
      [{ pending: true }, { pending: true }],
    ]
    for (const [react, solid] of cases) {
      await clientParity(
        r(R.Button, react, "Save"),
        (): JSX.Element => <Button {...solid}>Save</Button>,
      )
    }
    await clientParity(r(R.Button, { render: r("a", { href: "/docs" }) }, "Docs"), () => (
      <Button href="/docs">Docs</Button>
    ))
  })
})
