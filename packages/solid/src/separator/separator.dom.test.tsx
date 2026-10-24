/** @jsxImportSource solid-js */
// Separator: the same markup as @rind-ui/react for every case of its server-render spec.
import * as R from "@rind-ui/react"
import { expectRindWarning } from "@rind-ui/testing"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { clientParity } from "../../fixtures/parity"
import { Separator, SeparatorHostContext } from "../index"

describe("Solid Separator matches React", () => {
  it("div, vertical, decorative, labelled, theme attributes", async () => {
    await clientParity(r(R.Separator.Root), () => <Separator.Root />)
    await clientParity(r(R.Separator.Root, { orientation: "vertical" }), () => (
      <Separator.Root orientation="vertical" />
    ))
    await clientParity(r(R.Separator.Root, { decorative: true }), () => (
      <Separator.Root decorative />
    ))
    await clientParity(r(R.Separator.Root, { "aria-label": "Advanced" }), () => (
      <Separator.Root aria-label="Advanced" />
    ))
    await clientParity(
      r(R.Separator.Root, {
        "data-variant": "v",
        "data-size": "lg",
        "data-tone": "muted",
      } as never),
      () => <Separator.Root data-variant="v" data-size="lg" data-tone="muted" />,
    )
  })

  it("hr through render: no role, no children", async () => {
    await clientParity(r(R.Separator.Root, { render: r("hr") }), () => (
      <Separator.Root render={(p) => <hr {...p} />} />
    ))
  })

  it("a toolbar host gives vertical by default; a listbox host forces role none", async () => {
    const toolbar = { context: "toolbar", defaultOrientation: "vertical" } as const
    await clientParity(
      r(
        R.SeparatorHostContext,
        { value: toolbar },
        r(R.Separator.Root),
        r(R.Separator.Root, { orientation: "horizontal" }),
      ),
      () => (
        <SeparatorHostContext.Provider value={toolbar}>
          <Separator.Root />
          <Separator.Root orientation="horizontal" />
        </SeparatorHostContext.Provider>
      ),
    )
    // Both adapters warn that the listbox's decorative separator drops its name.
    expectRindWarning(/decorative separator \(role none\) cannot be named/)
    const listbox = { context: "listbox" } as const
    await clientParity(
      r(
        R.SeparatorHostContext,
        { value: listbox },
        r(R.Separator.Root, { orientation: "vertical", "aria-label": "x" }),
      ),
      () => (
        <SeparatorHostContext.Provider value={listbox}>
          <Separator.Root orientation="vertical" aria-label="x" />
        </SeparatorHostContext.Provider>
      ),
    )
  })
})
