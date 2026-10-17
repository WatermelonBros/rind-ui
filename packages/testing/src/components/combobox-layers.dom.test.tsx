// The popup above page content, and the empty state from the trigger (site audit).
import { Combobox } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

// Layout (hit testing) needs a real browser.
const inJsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")
const browserIt = it.skipIf(inJsdom)

const user = async () => (await import("@testing-library/user-event")).userEvent.setup()

function Box(props: {
  readonly items: readonly { key: string; label: string }[]
  readonly defaultOpen?: boolean
}) {
  return (
    <Combobox.Root items={props.items} defaultOpen={props.defaultOpen ?? false}>
      <Combobox.Label>City</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.Trigger />
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Items />
          </Combobox.List>
          <Combobox.Empty>No cities yet</Combobox.Empty>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Root>
  )
}

describe("Combobox popup layering", () => {
  it("opening by the trigger with no options shows the Empty part", async () => {
    render(<Box items={[]} />)
    const u = await user()
    await u.click(screen.getByRole("button", { name: "Show suggestions" }))
    await waitFor(() => expect(screen.getByText("No cities yet")).toBeTruthy())
  })

  it("starts open with no options: Empty shows; closing and reopening by the trigger keeps it", async () => {
    render(<Box items={[]} defaultOpen />)
    await waitFor(() => expect(screen.getByText("No cities yet")).toBeTruthy())
    const u = await user()
    const trigger = screen.getByRole("button", { name: "Show suggestions" })
    await u.click(trigger)
    await waitFor(() => expect(screen.queryByText("No cities yet")).toBe(null))
    await u.click(trigger)
    await waitFor(() => expect(screen.getByText("No cities yet")).toBeTruthy())
  })

  browserIt(
    "a later sibling positioned over the popup does not take the option's press",
    async () => {
      render(
        <div style={{ display: "grid", gap: 4 }}>
          <Box items={[{ key: "rome", label: "Rome" }]} />
          <span
            data-testid="cover"
            style={{ position: "relative", display: "block", height: 200, background: "white" }}
          >
            status
          </span>
        </div>,
      )
      const u = await user()
      await u.click(screen.getByRole("button", { name: "Show suggestions" }))
      const option = await screen.findByRole("option", { name: "Rome" })
      await waitFor(() => expect(document.querySelector("[data-placing]")).toBe(null))
      const r = option.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      expect(option.contains(hit)).toBe(true)
      await u.click(option)
      expect((screen.getByRole("combobox", { name: "City" }) as HTMLInputElement).value).toBe(
        "Rome",
      )
    },
  )
})
