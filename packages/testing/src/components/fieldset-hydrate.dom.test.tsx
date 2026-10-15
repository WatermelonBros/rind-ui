// Server markup hydrates cleanly: no console error or warning, same markup, except the
// relations the client can only add after commit (substituted legend).
import { Fieldset } from "@rind-ui/react"
import { act, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ""
})

function serverContainer(tree: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  return container
}

async function hydrate(tree: ReactNode) {
  const container = serverContainer(tree)
  const before = container.innerHTML
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const after = container.innerHTML
  await act(async () => root?.unmount())
  return { calls, before, after, container }
}

describe("Fieldset hydration", () => {
  const trees: Record<string, () => ReactNode> = {
    "legend and description": () => (
      <Fieldset.Root>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.Description>All fields required</Fieldset.Description>
        <input aria-label="Street" />
      </Fieldset.Root>
    ),
    "invalid with error": () => (
      <Fieldset.Root invalid>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.Description>All fields required</Fieldset.Description>
        <Fieldset.ErrorMessage>Enter an address</Fieldset.ErrorMessage>
      </Fieldset.Root>
    ),
    disabled: () => (
      <Fieldset.Root disabled>
        <Fieldset.Legend>Shipping address</Fieldset.Legend>
        <Fieldset.Root>
          <Fieldset.Legend>Inner</Fieldset.Legend>
        </Fieldset.Root>
      </Fieldset.Root>
    ),
    "legend only (no description)": () => (
      <Fieldset.Root>
        <Fieldset.Legend>Plain</Fieldset.Legend>
      </Fieldset.Root>
    ),
  }

  it.each(Object.keys(trees))("%s hydrates with no warning and the same markup", async (name) => {
    const { calls, before, after } = await hydrate(trees[name]?.())
    expect(calls).toEqual([])
    // The server never holds a relation to a part it cannot know is rendered (ark#3707):
    // aria-describedby is added after commit, and every id it lists exists.
    expect(before).not.toContain("aria-describedby")
    expect(after.replace(/ aria-describedby="[^"]*"/g, "")).toBe(before)
    for (const [, list] of after.matchAll(/aria-describedby="([^"]*)"/g)) {
      for (const id of (list ?? "").split(" ")) expect(after).toContain(`id="${id}"`)
    }
  })

  it("the generated ids are the server's after hydration", async () => {
    const tree = trees["legend and description"]?.()
    const container = serverContainer(tree)
    const ids = () => Array.from(container.querySelectorAll("[id]"), (e) => e.id)
    const serverIds = ids()
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree)
    })
    expect(ids()).toEqual(serverIds)
    expect(
      screen.getByRole("group", { name: "Shipping address" }).getAttribute("aria-describedby"),
    ).toBe(container.querySelector("p")?.id)
    await act(async () => root?.unmount())
  })

  it("a substituted legend hydrates cleanly; aria-labelledby appears after mount", async () => {
    const tree = (
      <Fieldset.Root>
        <Fieldset.Legend render={<div />}>Billing</Fieldset.Legend>
        <input aria-label="Name" />
      </Fieldset.Root>
    )
    const { calls, container } = await hydrate(tree)
    expect(calls).toEqual([])
    // Unmounted by hydrate(); hydrate again to inspect the live result.
    container.innerHTML = renderToString(tree)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree)
    })
    const fieldset = container.querySelector("fieldset")
    const legend = container.querySelector('[data-part="legend"]')
    expect(fieldset?.getAttribute("aria-labelledby")).toBe(legend?.id)
    expect(legend?.id).toBeTruthy()
    expect(screen.getByRole("group", { name: "Billing" })).toBe(fieldset)
    expect(error).not.toHaveBeenCalled()
    await act(async () => root?.unmount())
  })
})
