// A server-rendered alert hydrates without a mismatch and announces nothing (spec "Alert
// present at page load", mui/material-ui#49440); the same alert mounted on the client does.
import { Alert } from "@rind-ui/react"
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getAlert } from "../index"

afterEach(() => vi.restoreAllMocks())

const tree = (
  <Alert.Root announce="assertive">
    <Alert.Title>Couldn't save</Alert.Title>
    <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
  </Alert.Root>
)

describe("Alert hydration", () => {
  it("hydrates cleanly with the same markup and makes no announcement", async () => {
    const a = getAlert(document.body, { title: "Couldn't save" })
    expect(await a.announcements()).toEqual([])
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const before = container.innerHTML
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe(before)
    expect(await a.isOpen()).toBe(true)
    expect(await a.announcements()).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })

  it("server HTML has no role and no live attribute", () => {
    const html = renderToString(tree)
    expect(html).not.toMatch(/role=|aria-live|aria-atomic/)
    expect(html).toContain('data-state="open"')
  })
})
