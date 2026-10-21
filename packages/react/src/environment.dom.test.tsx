import { announcerCapability, type Capability } from "@rind-ui/core"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RindProvider, useEnvironment } from "./index"

function counting() {
  const create = vi.fn(() => ({ id: Math.random() }))
  const capability: Capability<"probe", { id: number }> = { key: "probe", create }
  return { capability, create }
}

describe("requested capabilities", () => {
  it("are built once per provider and shared by every component below", () => {
    const { capability, create } = counting()
    const seen: unknown[] = []
    function Probe() {
      seen.push(useEnvironment(capability).probe)
      return null
    }
    render(
      <RindProvider>
        <Probe />
        <Probe />
      </RindProvider>,
    )
    expect(create).toHaveBeenCalledTimes(1)
    expect(seen[0]).toBe(seen[1])
  })

  it("are not built when no component asks for them", () => {
    const { capability, create } = counting()
    function Probe() {
      useEnvironment()
      return null
    }
    render(
      <RindProvider>
        <Probe />
      </RindProvider>,
    )
    expect(create).not.toHaveBeenCalled()
    expect(capability.key).toBe("probe")
  })

  it("work without a provider", () => {
    let announce: unknown
    function Probe() {
      announce = useEnvironment(announcerCapability).announcer.announce
      return null
    }
    render(<Probe />)
    expect(typeof announce).toBe("function")
  })

  it("take the provider's options over the default implementation", () => {
    const announcer = { announce() {}, prepare: () => () => {}, cancel() {} }
    let got: unknown
    function Probe() {
      got = useEnvironment(announcerCapability).announcer
      return null
    }
    render(
      <RindProvider announcer={announcer}>
        <Probe />
      </RindProvider>,
    )
    expect(got).toBe(announcer)
  })
})
