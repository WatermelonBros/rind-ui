// The Button contract's model-based test, with React's variants, against the Vue Button.
import { buttonContract, platforms } from "@rind-ui/core"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { createSSRApp, h } from "vue"
import { renderToString } from "vue/server-renderer"
import { mount } from "../../fixtures/mount"
import { Button, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

type Props = Record<string, unknown>
const withPlatform = (props: Props, children: () => unknown = () => "Save") =>
  h(RindProvider, { environment: { platform: currentRun()?.platform ?? platforms.linux } }, () =>
    h(Button, { ...props, onPress }, children as never),
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

function variant(name: string, props: Props, extra = {}, children?: () => unknown) {
  describe(`vue button model: ${name}`, () => {
    testMachine(buttonContract, {
      test: it,
      setup: () => mount(() => withPlatform(props, children)),
      activations,
      target: () => screen,
      anchor,
      props: { ...base, ...props } as never,
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
variant("asChild div", { asChild: true }, {}, () => h("div", null, "Save"))

describe("vue button model: pending edges through rerender ($sync:pending)", () => {
  testMachine(buttonContract, {
    test: it,
    setup: () => mount((p: Props) => withPlatform(p), { pending: false }),
    rerender: (next, rendered) => rendered.rerender(next as unknown as Props),
    target: () => screen,
    anchor,
    props: { ...base, pending: false } as never,
    a11y,
    modalities: ["keyboard", "pointer"],
  })
})

describe("vue button", () => {
  it("asChild <a href>: a link that keeps link semantics", () => {
    mount(() => h(Button, { asChild: true }, () => h("a", { href: "/docs" }, "Docs")))
    const link = screen.getByRole("link", { name: "Docs" })
    expect(link.getAttribute("href")).toBe("/docs")
    expect(link.getAttribute("data-scope")).toBe("button")
  })

  it("server render: a native button of type button; disabled already in the HTML", async () => {
    const html = (props: Props) =>
      renderToString(createSSRApp({ render: () => h(Button, props, () => "Save") }))
    const out = await html({})
    expect(out).toMatch(/^<button /)
    expect(out).toContain('type="button"')
    expect(out).toContain('data-scope="button"')
    expect(out).not.toMatch(/role=|aria-disabled|disabled|data-pending|data-disabled/)
    expect(await html({ disabled: true })).toMatch(/ disabled/)
  })
})
