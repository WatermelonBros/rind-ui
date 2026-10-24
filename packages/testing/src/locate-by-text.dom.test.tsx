// The `{ text }` locator in the DOM adapter skips hidden elements, as Playwright's getByText
// does; `hidden="until-found"` stays findable (find-in-page reveals it).
import { Alert } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { getAlert } from "./index"

const saved = (
  <Alert.Root announce="off">
    <Alert.Title>Saved</Alert.Title>
  </Alert.Root>
)

describe("By { text }", () => {
  it("finds visible text", async () => {
    render(saved)
    expect(await getAlert(screen, { title: "Saved" }).title()).toBe("Saved")
  })

  it("skips text in a hidden element and inside one", async () => {
    render(
      <>
        <div hidden>{saved}</div>
        <Alert.Root announce="off" hidden>
          <Alert.Title>Saved</Alert.Title>
        </Alert.Root>
      </>,
    )
    await expect(getAlert(screen, { title: "Saved" }).title()).rejects.toThrow(
      /no element matches the anchor/,
    )
  })

  it('finds text inside hidden="until-found"', async () => {
    const { container } = render(<div>{saved}</div>)
    // Set on the element: React writes `hidden` as a boolean attribute.
    container.firstElementChild?.setAttribute("hidden", "until-found")
    expect(await getAlert(screen, { title: "Saved" }).title()).toBe("Saved")
  })
})
