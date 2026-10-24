/** @jsxImportSource solid-js */
// Heading: the same markup as @rind-ui/react.
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { clientParity } from "../../fixtures/parity"
import { Heading } from "../index"

describe("Solid Heading matches React", () => {
  it("levels from nesting, explicit level, substitution", async () => {
    await clientParity(r(R.Heading, null, "Settings"), () => <Heading>Settings</Heading>)
    await clientParity(
      r(
        R.Heading.Level,
        null,
        r(R.Heading, null, "A"),
        r(R.Heading.Level, null, r(R.Heading, null, "B")),
      ),
      () => (
        <Heading.Level>
          <Heading>A</Heading>
          <Heading.Level>
            <Heading>B</Heading>
          </Heading.Level>
        </Heading.Level>
      ),
    )
    await clientParity(r(R.Heading, { level: 5 }, "E"), () => <Heading level={5}>E</Heading>)
    await clientParity(r(R.Heading, { render: r("h4") }, "H"), () => (
      <Heading render={(p) => <h4 {...p} />}>H</Heading>
    ))
  })
})
