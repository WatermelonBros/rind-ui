// Fieldset: the same DOM as @rind-ui/react across its anatomy, nesting and first-legend
// exemption (rind controls inside), and disabled at runtime.
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import Tree from "../../fixtures/fieldset/tree.svelte"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"

type P = Record<string, unknown>
const reactTree = (root: P, legend = true, desc = true, error = true) =>
  r(
    R.Fieldset.Root,
    root,
    legend ? r(R.Fieldset.Legend, null, "Shipping", r(R.Button, null, "Help")) : null,
    desc ? r(R.Fieldset.Description, null, "Where it goes") : null,
    r(R.Toggle.Root, null, "Gift"),
    r("input", { "aria-label": "Street" }),
    error ? r(R.Fieldset.ErrorMessage, null, "Required") : null,
  )

describe("Svelte Fieldset matches React", () => {
  it("anatomy, invalid, disabled, legend exemption, no parts", async () => {
    for (const [root, legend, desc, error] of [
      [{}, true, true, true],
      [{ invalid: true }, true, true, true],
      [{ disabled: true }, true, true, true],
      [{ disabled: true, invalid: true, "aria-describedby": "extra" }, true, true, true],
      [{}, false, false, false],
      [{ invalid: true }, true, false, false],
    ] as const) {
      await clientParity(reactTree(root, legend, desc, error), Tree, {
        root,
        legend,
        desc,
        error,
      } as never)
    }
  })

  it("nested and substituted legend", async () => {
    await clientParity(
      r(
        R.Fieldset.Root,
        { disabled: true },
        r(R.Fieldset.Root, null, r(R.Fieldset.Legend, null, "Inner"), r(R.Button, null, "Go")),
      ),
      Tree,
      { variant: "nested" } as never,
    )
    await clientParity(
      r(R.Fieldset.Root, null, r(R.Fieldset.Legend, { render: r("div") }, "Name")),
      Tree,
      { variant: "div-legend" } as never,
    )
  })
})

describe("Svelte Fieldset disabled at runtime", () => {
  it("presses are ignored while disabled, then work again", async () => {
    const onPress = vi.fn()
    const view = mount(Tree, { variant: "runtime", root: { disabled: true }, onPress } as never)
    const button = screen.getByRole("button", { name: "Go" })
    expect(button.hasAttribute("data-disabled")).toBe(true)
    button.click()
    expect(onPress).not.toHaveBeenCalled()
    view.rerender({ root: { disabled: false } } as never)
    await vi.waitFor(() => expect(button.hasAttribute("data-disabled")).toBe(false))
    button.click()
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
