// Heading, Label and Link: the same markup as @rind-ui/react; Link routes through the provider.
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Heading, Label, Link, RouterProvider } from "../index"

const both = async (react: Parameters<typeof serverParity>[0], vue: () => ReturnType<typeof h>) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}

describe("Vue Heading matches React", () => {
  it("levels from nesting, explicit level, substitution", async () => {
    await both(r(R.Heading, null, "Settings"), () => h(Heading, null, () => "Settings"))
    await both(
      r(
        R.Heading.Level,
        null,
        r(R.Heading, null, "A"),
        r(R.Heading.Level, null, r(R.Heading, null, "B")),
      ),
      () =>
        h(Heading.Level, null, () => [
          h(Heading, null, () => "A"),
          h(Heading.Level, null, () => h(Heading, null, () => "B")),
        ]),
    )
    await both(r(R.Heading, { level: 5 }, "E"), () => h(Heading, { level: 5 }, () => "E"))
    await both(r(R.Heading, { render: r("h4") }, "H"), () =>
      h(Heading, { asChild: true }, () => h("h4", null, "H")),
    )
  })
})

describe("Vue Label matches React", () => {
  it("for, wrapping, substitution", async () => {
    await both(r("div", null, r(R.Label, { htmlFor: "n" }, "Name"), r("input", { id: "n" })), () =>
      h("div", null, [h(Label, { for: "n" }, () => "Name"), h("input", { id: "n" })]),
    )
    await both(r(R.Label, null, "Name ", r("input")), () =>
      h(Label, null, () => ["Name ", h("input")]),
    )
  })
})

describe("Vue Link", () => {
  it("matches React: href, external, disabled, current", async () => {
    await both(r(R.Link, { href: "/a" }, "A"), () => h(Link, { href: "/a" }, () => "A"))
    await both(r(R.Link, { href: "mailto:a@b.c" }, "M"), () =>
      h(Link, { href: "mailto:a@b.c" }, () => "M"),
    )
    await both(r(R.Link, { href: "https://x.test/", target: "_blank" }, "X"), () =>
      h(Link, { href: "https://x.test/", target: "_blank" }, () => "X"),
    )
    await both(r(R.Link, { href: "/a", disabled: true }, "D"), () =>
      h(Link, { href: "/a", disabled: true }, () => "D"),
    )
    await both(r(R.Link, { href: "/a", current: "page" }, "C"), () =>
      h(Link, { href: "/a", current: "page" }, () => "C"),
    )
  })

  it("routes through RouterProvider; a disabled link drops the consumer's click", async () => {
    const navigate = vi.fn()
    const onClick = vi.fn()
    mount(() =>
      h(RouterProvider, { navigate }, () => [
        h(Link, { href: "/docs" }, () => "Docs"),
        h(Link, { href: "/off", disabled: true, onClick }, () => "Off"),
      ]),
    )
    screen.getByRole("link", { name: "Docs" }).click()
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate.mock.calls[0]?.[0]).toBe("/docs")
    screen.getByText("Off").click()
    expect(onClick).not.toHaveBeenCalled()
  })
})
