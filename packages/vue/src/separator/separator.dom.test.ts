// Separator: the same markup as @rind-ui/react for every case of its server-render spec.
import * as R from "@rind-ui/react"
import { expectRindWarning } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h, provide } from "vue"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Separator, SeparatorHostKey } from "../index"

const both = async (react: Parameters<typeof serverParity>[0], vue: () => ReturnType<typeof h>) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}

describe("Vue Separator matches React", () => {
  it("div, vertical, decorative, labelled, theme attributes", async () => {
    await both(r(R.Separator.Root), () => h(Separator.Root))
    await both(r(R.Separator.Root, { orientation: "vertical" }), () =>
      h(Separator.Root, { orientation: "vertical" }),
    )
    await both(r(R.Separator.Root, { decorative: true }), () =>
      h(Separator.Root, { decorative: true }),
    )
    await both(r(R.Separator.Root, { "aria-label": "Advanced" }), () =>
      h(Separator.Root, { "aria-label": "Advanced" }),
    )
    const theme = { "data-variant": "v", "data-size": "lg", "data-tone": "muted" } as Record<
      string,
      string
    >
    await both(r(R.Separator.Root, theme), () => h(Separator.Root, theme))
  })

  it("hr through render/asChild: no role, no children", async () => {
    await both(r(R.Separator.Root, { render: r("hr") }), () =>
      h(Separator.Root, { asChild: true }, () => h("hr")),
    )
  })

  it("a toolbar host gives vertical by default; a listbox host forces role none", async () => {
    const Host = (host: R.SeparatorHost, children: () => ReturnType<typeof h>[]) => ({
      setup() {
        provide(SeparatorHostKey, { value: host } as never)
        return () => children()
      },
    })
    const toolbar = { context: "toolbar", defaultOrientation: "vertical" } as const
    await both(
      r(
        R.SeparatorHostContext,
        { value: toolbar },
        r(R.Separator.Root),
        r(R.Separator.Root, { orientation: "horizontal" }),
      ),
      () =>
        h(
          Host(toolbar, () => [
            h(Separator.Root),
            h(Separator.Root, { orientation: "horizontal" }),
          ]),
        ),
    )
    // Both adapters warn that the listbox's decorative separator drops its name.
    expectRindWarning(/decorative separator \(role none\) cannot be named/)
    const listbox = { context: "listbox" } as const
    await both(
      r(
        R.SeparatorHostContext,
        { value: listbox },
        r(R.Separator.Root, { orientation: "vertical", "aria-label": "x" }),
      ),
      () =>
        h(Host(listbox, () => [h(Separator.Root, { orientation: "vertical", "aria-label": "x" })])),
    )
  })
})
