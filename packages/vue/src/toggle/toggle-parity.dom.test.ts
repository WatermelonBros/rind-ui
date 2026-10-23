// Toggle and Button: the same markup as @rind-ui/react.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Button, Toggle } from "../index"

const both = async (react: Parameters<typeof serverParity>[0], vue: () => ReturnType<typeof h>) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}

describe("Vue Toggle and Button match React", () => {
  it("toggle states and indicator", async () => {
    await both(r(R.Toggle.Root, null, "Bold"), () => h(Toggle.Root, null, () => "Bold"))
    await both(
      r(
        R.Toggle.Root,
        { defaultPressed: true, disabled: true },
        "Bold",
        r(R.Toggle.Indicator, null, "✓"),
      ),
      () =>
        h(Toggle.Root, { defaultPressed: true, disabled: true }, () => [
          "Bold",
          h(Toggle.Indicator, null, () => "✓"),
        ]),
    )
  })

  it("button variants", async () => {
    for (const p of [
      {},
      { type: "submit" },
      { disabled: true },
      { disabled: true, focusableWhenDisabled: true },
      { pending: true },
    ] as const) {
      await both(r(R.Button, p, "Save"), () => h(Button, p, () => "Save"))
    }
    await both(r(R.Button, { render: r("a", { href: "/docs" }) }, "Docs"), () =>
      h(Button, { asChild: true }, () => h("a", { href: "/docs" }, "Docs")),
    )
  })
})
