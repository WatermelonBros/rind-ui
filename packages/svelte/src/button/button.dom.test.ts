// The Button contract's model-based test, with React's variants, against the Svelte Button.
import { buttonContract, platforms } from "@rind-ui/core"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import Fixture from "../../fixtures/button/button.svelte"
import Link from "../../fixtures/button/link.svelte"
import { mount } from "../../fixtures/mount"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = Record<string, unknown>
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

function variant(name: string, props: Props, extra = {}) {
  describe(`svelte button model: ${name}`, () => {
    testMachine(buttonContract, {
      test: it,
      setup: () => mount(Fixture, { ...props, onPress }),
      activations,
      target: () => screen,
      anchor,
      props: { ...base, ...props, as: undefined } as never,
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
variant("child div", { as: "div" })

describe("svelte button model: pending edges through rerender ($sync:pending)", () => {
  testMachine(buttonContract, {
    test: it,
    setup: () => mount(Fixture, { pending: false } as Props),
    rerender: (next, rendered) => rendered.rerender(next as unknown as Props),
    target: () => screen,
    anchor,
    props: { ...base, pending: false } as never,
    a11y,
    modalities: ["keyboard", "pointer"],
  })
})

describe("svelte button", () => {
  it("href: a link that keeps link semantics; disabled is native", () => {
    mount(Link)
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.tagName).toBe("A")
    expect(link.getAttribute("href")).toBe("/docs")
    expect(link.getAttribute("data-scope")).toBe("button")
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true)
  })
})
