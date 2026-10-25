// "Controlled Values With Bindings": a binding with no value yet starts at `null` and receives
// every accepted change.
import { screen } from "@testing-library/dom"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import Bound from "../../fixtures/radio-group/bound-null.svelte"

describe("Svelte binding that starts at null", () => {
  it("bind:value receives the user's choice", async () => {
    mount(Bound)
    expect(screen.getByTestId("bound").textContent).toBe("null")
    screen.getByRole("radio", { name: "Pro" }).click()
    await vi.waitFor(() => expect(screen.getByTestId("bound").textContent).toBe("pro"))
  })
})
