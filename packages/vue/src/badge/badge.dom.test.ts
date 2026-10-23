// Badge: the same markup as @rind-ui/react for every case of its server-render spec.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Badge } from "../index"

const both = async (react: Parameters<typeof serverParity>[0], vue: () => ReturnType<typeof h>) => {
  await serverParity(react, vue)
  await clientParity(react, vue)
}

describe("Vue Badge matches React", () => {
  it("text, label, consumer id, theme attributes", async () => {
    await both(r(R.Badge.Root, null, "Beta"), () => h(Badge.Root, null, () => "Beta"))
    await both(r(R.Badge.Root, { label: "3 unread" }, "3"), () =>
      h(Badge.Root, { label: "3 unread" }, () => "3"),
    )
    await both(r(R.Badge.Root, { id: "c" }, "3"), () => h(Badge.Root, { id: "c" }, () => "3"))
    const theme = { "data-variant": "solid", "data-tone": "danger" } as Record<string, string>
    await both(r(R.Badge.Root, theme, "2"), () => h(Badge.Root, theme, () => "2"))
  })

  it("element substitution", async () => {
    await both(r(R.Badge.Root, { render: r("strong") }, "New"), () =>
      h(Badge.Root, { asChild: true }, () => h("strong", null, "New")),
    )
  })
})
