import { ToggleGroup } from "@rind-ui/react"
import { cleanup, render } from "@testing-library/react"
import { expect, it } from "vitest"
import { installErrorLog } from "./dom"

// CI (Firefox on Linux): the real cursor, left where the previous test put it, hovered the
// first item a model test rendered; the hover update outside act() was logged as an error.
it.skipIf(navigator.userAgent.includes("jsdom"))(
  "a resting cursor over a newly rendered part is not a step error",
  async () => {
    const { userEvent } = await import("vitest/browser")
    const ui = () => (
      <ToggleGroup.Root aria-label="A">
        <ToggleGroup.Item value="a">Alpha item wide</ToggleGroup.Item>
      </ToggleGroup.Root>
    )
    render(ui())
    await userEvent.hover(document.querySelector("button") as HTMLElement)
    cleanup()
    const log = installErrorLog()
    log.splice(0)
    render(ui())
    await new Promise((r) => setTimeout(r, 300))
    expect(log).toEqual([])
  },
)
