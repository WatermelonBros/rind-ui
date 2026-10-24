/** @jsxImportSource solid-js */
// Badge: the same markup as @rind-ui/react for every case of its server-render spec.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { clientParity } from "../../fixtures/parity"
import { Badge } from "../index"

describe("Solid Badge matches React", () => {
  it("text, label, consumer id, theme attributes", async () => {
    await clientParity(r(R.Badge.Root, null, "Beta"), () => <Badge.Root>Beta</Badge.Root>)
    await clientParity(r(R.Badge.Root, { label: "3 unread" }, "3"), () => (
      <Badge.Root label="3 unread">3</Badge.Root>
    ))
    await clientParity(r(R.Badge.Root, { id: "c" }, "3"), () => <Badge.Root id="c">3</Badge.Root>)
    await clientParity(
      r(R.Badge.Root, { "data-variant": "solid", "data-tone": "danger" } as never, "2"),
      () => (
        <Badge.Root data-variant="solid" data-tone="danger">
          2
        </Badge.Root>
      ),
    )
  })

  it("element substitution", async () => {
    await clientParity(r(R.Badge.Root, { render: r("strong") }, "New"), () => (
      <Badge.Root render={(p) => <strong {...p} />}>New</Badge.Root>
    ))
  })
})
