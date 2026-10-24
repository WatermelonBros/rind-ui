/** @jsxImportSource solid-js */
// Fieldset: the same DOM as @rind-ui/react across its anatomy, nesting and first-legend
// exemption (rind controls inside), and disabled at runtime.
import * as R from "@rind-ui/react"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import type { JSX } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Button, Fieldset, type FieldsetRootProps, Toggle } from "../index"

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
  solid: (): JSX.Element => (
    <Fieldset.Root {...(root as FieldsetRootProps)}>
      {legend ? (
        <Fieldset.Legend>
          Shipping<Button>Help</Button>
        </Fieldset.Legend>
      ) : null}
      {desc ? <Fieldset.Description>Where it goes</Fieldset.Description> : null}
      <Toggle.Root>Gift</Toggle.Root>
      <input aria-label="Street" />
      {error ? <Fieldset.ErrorMessage>Required</Fieldset.ErrorMessage> : null}
    </Fieldset.Root>
  ),
})

describe("Solid Fieldset matches React", () => {
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
      await clientParity(t.react, t.solid)
    }
  })

  it("nested: the inner fieldset inherits disabled", async () => {
    await clientParity(
      r(
        R.Fieldset.Root,
        { disabled: true },
        r(R.Fieldset.Root, null, r(R.Fieldset.Legend, null, "Inner"), r(R.Button, null, "Go")),
      ),
      () => (
        <Fieldset.Root disabled>
          <Fieldset.Root>
            <Fieldset.Legend>Inner</Fieldset.Legend>
            <Button>Go</Button>
          </Fieldset.Root>
        </Fieldset.Root>
      ),
    )
  })

  it("substituted legend labels by id", async () => {
    await clientParity(
      r(R.Fieldset.Root, null, r(R.Fieldset.Legend, { render: r("div") }, "Name")),
      () => (
        <Fieldset.Root>
          <Fieldset.Legend render={(p) => <div {...p} />}>Name</Fieldset.Legend>
        </Fieldset.Root>
      ),
    )
  })
})

describe("Solid Fieldset disabled at runtime", () => {
  it("presses are ignored while disabled, then work again", async () => {
    const onPress = vi.fn()
    const view = mount(
      (p: { disabled: boolean }) => (
        <Fieldset.Root disabled={p.disabled}>
          <Button onPress={onPress}>Go</Button>
        </Fieldset.Root>
      ),
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
