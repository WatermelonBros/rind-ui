// Server markup hydrates with no mismatch warning, for every Text Field flavour.
import { Field, TextField } from "@rind-ui/react"
import { act } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

async function hydrate(tree: ReactNode) {
  const container = document.createElement("div")
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
  })
  const calls = [...error.mock.calls, ...warn.mock.calls]
  const input = container.querySelector("input,textarea") as HTMLInputElement | null
  const describedBy = input?.getAttribute("aria-describedby")?.split(" ") ?? []
  const dangling = describedBy.filter((id) => !container.querySelector(`[id="${id}"]`))
  const value = input?.value
  await act(async () => root?.unmount())
  container.remove()
  return { calls, dangling, value }
}

const trees: Record<string, () => ReactNode> = {
  "defaultValue, Label, Description": () => (
    <TextField.Root defaultValue="hello">
      <TextField.Label>Name</TextField.Label>
      <TextField.Input />
      <TextField.Description>Hint</TextField.Description>
    </TextField.Root>
  ),
  "controlled with clear and count": () => (
    <TextField.Root value="abc" onValueChange={() => {}}>
      <TextField.Label>Name</TextField.Label>
      <TextField.Input maxLength={10} />
      <TextField.ClearTrigger />
      <TextField.CharacterCount />
    </TextField.Root>
  ),
  "textarea with autosize": () => (
    <TextField.Root defaultValue={"a\nb"}>
      <TextField.Label>Bio</TextField.Label>
      <TextField.Textarea autosize rows={3} />
    </TextField.Root>
  ),
  "read-only and focusable-disabled": () => (
    <>
      <TextField.Root readOnly defaultValue="x">
        <TextField.Label>A</TextField.Label>
        <TextField.Input />
      </TextField.Root>
      <TextField.Root disabled focusableWhenDisabled>
        <TextField.Label>B</TextField.Label>
        <TextField.Input />
      </TextField.Root>
    </>
  ),
  "inside a Field": () => (
    <Field.Root required>
      <Field.Label>Email</Field.Label>
      <TextField.Root>
        <TextField.Input type="email" />
      </TextField.Root>
      <Field.ErrorMessage />
    </Field.Root>
  ),
  autoFocus: () => (
    <TextField.Root>
      <TextField.Label>Name</TextField.Label>
      <TextField.Input autoFocus />
    </TextField.Root>
  ),
}

describe("TextField hydration", () => {
  it.each(Object.entries(trees))("%s: zero console errors or warnings", async (_n, tree) => {
    const { calls, dangling } = await hydrate(tree())
    expect(calls).toEqual([])
    expect(dangling).toEqual([])
  })

  it("keeps the server defaultValue", async () => {
    const { value } = await hydrate(trees["defaultValue, Label, Description"]?.())
    expect(value).toBe("hello")
  })
})
