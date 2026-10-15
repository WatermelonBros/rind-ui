import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RindProvider, useIconChildren } from "./index"

const MyCheck = () => <svg data-testid="my-check" />
// An indicator-like part: empty unless the consumer or the provider fills it.
const Indicator = ({ children }: { children?: React.ReactNode }) => (
  <span data-testid="indicator">{useIconChildren("check", children)}</span>
)

describe("provider icons", () => {
  it("renders the provider icon in an empty indicator", () => {
    render(
      <RindProvider icons={{ check: MyCheck }}>
        <Indicator />
      </RindProvider>,
    )
    expect(screen.getByTestId("indicator").contains(screen.getByTestId("my-check"))).toBe(true)
  })

  it("children win over the provider icon", () => {
    render(
      <RindProvider icons={{ check: MyCheck }}>
        <Indicator>ok</Indicator>
      </RindProvider>,
    )
    expect(screen.getByTestId("indicator").textContent).toBe("ok")
    expect(screen.queryByTestId("my-check")).toBeNull()
  })

  it("renders nothing extra without an entry, or without a provider", () => {
    render(
      <RindProvider icons={{ x: MyCheck }}>
        <Indicator />
      </RindProvider>,
    )
    expect(screen.getByTestId("indicator").childNodes).toHaveLength(0)
  })

  it("nested providers merge icons", () => {
    render(
      <RindProvider icons={{ check: MyCheck }}>
        <RindProvider icons={{ x: MyCheck }}>
          <Indicator />
        </RindProvider>
      </RindProvider>,
    )
    expect(screen.getByTestId("my-check")).toBeTruthy()
  })
})
