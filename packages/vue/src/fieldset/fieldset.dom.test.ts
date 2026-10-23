// Fieldset: the same DOM as @rind-ui/react across its anatomy, nesting and first-legend
// exemption (rind controls inside), and disabled at runtime.
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { type ReactElement, createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, type VNode } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Button, Fieldset, Toggle } from "../index"

const both = async (react: ReactElement, vue: () => VNode) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}
type P = Record<string, unknown>

const tree = (root: P, legend = true, desc = true, error = true) => ({
  react: r(
    R.Fieldset.Root,
    root,
    legend ? r(R.Fieldset.Legend, null, "Shipping", r(R.Button, null, "Help")) : null,
    desc ? r(R.Fieldset.Description, null, "Where it goes") : null,
    r(R.Toggle.Root, null, "Gift"),
    r("input", { "aria-label": "Street" }),
    error ? r(R.Fieldset.ErrorMessage, null, "Required") : null,
  ),
  vue: () =>
    h(Fieldset.Root, root, () => [
      legend ? h(Fieldset.Legend, null, () => ["Shipping", h(Button, null, () => "Help")]) : null,
      desc ? h(Fieldset.Description, null, () => "Where it goes") : null,
      h(Toggle.Root, null, () => "Gift"),
      h("input", { "aria-label": "Street" }),
      error ? h(Fieldset.ErrorMessage, null, () => "Required") : null,
    ]),
})

describe("Vue Fieldset matches React", () => {
  it("anatomy, invalid, disabled, legend exemption, no parts", async () => {
    for (const [root, legend, desc, error] of [
      [{}, true, true, true],
      [{ invalid: true }, true, true, true],
      [{ disabled: true }, true, true, true],
      [{ disabled: true, invalid: true, "aria-describedby": "extra" }, true, true, true],
      [{}, false, false, false],
      [{ invalid: true }, true, false, false],
    ] as const) {
      const t = tree(root, legend, desc, error)
      await both(t.react, t.vue)
    }
  })

  it("nested: the inner fieldset inherits disabled", async () => {
    await both(
      r(
        R.Fieldset.Root,
        { disabled: true },
        r(R.Fieldset.Root, null, r(R.Fieldset.Legend, null, "Inner"), r(R.Button, null, "Go")),
      ),
      () =>
        h(Fieldset.Root, { disabled: true }, () =>
          h(Fieldset.Root, null, () => [
            h(Fieldset.Legend, null, () => "Inner"),
            h(Button, null, () => "Go"),
          ]),
        ),
    )
  })

  it("substituted legend labels by id", async () => {
    await both(r(R.Fieldset.Root, null, r(R.Fieldset.Legend, { render: r("div") }, "Name")), () =>
      h(Fieldset.Root, null, () =>
        h(Fieldset.Legend, { asChild: true }, () => h("div", null, "Name")),
      ),
    )
  })
})

describe("Vue Fieldset disabled at runtime", () => {
  it("presses are ignored while disabled, then work again", async () => {
    const onPress = vi.fn()
    const view = mount(
      (p: { disabled: boolean }) =>
        h(Fieldset.Root, { disabled: p.disabled }, () => h(Button, { onPress }, () => "Go")),
      { disabled: true },
    )
    const button = screen.getByRole("button", { name: "Go" })
    expect(button.hasAttribute("data-disabled")).toBe(true)
    button.click()
    expect(onPress).not.toHaveBeenCalled()
    await view.rerender({ disabled: false })
    await vi.waitFor(() => expect(button.hasAttribute("data-disabled")).toBe(false))
    button.click()
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
