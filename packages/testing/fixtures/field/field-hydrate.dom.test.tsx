// Server markup hydrates cleanly: no console error or warning, stable ids, and every id
// aria-describedby lists exists once the client has committed (tasks 5.2, 6.3).
import { Field } from "@rind-ui/react"
import { act, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FieldInput } from "./field-input"

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

const withoutDescribedBy = (html: string) =>
  html.replace(/ aria-(describedby|errormessage)="[^"]*"/g, "")

describe("Field hydration", () => {
  const trees: Record<string, () => ReactNode> = {
    "label and description": () => (
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>We never share it</Field.Description>
      </Field.Root>
    ),
    "initially invalid with an error": () => (
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>We never share it</Field.Description>
        <Field.ErrorMessage>Enter a valid email</Field.ErrorMessage>
      </Field.Root>
    ),
    "label only": () => (
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
      </Field.Root>
    ),
    "disabled, read-only, required": () => (
      <Field.Root disabled readOnly required>
        <Field.Label>Email</Field.Label>
        <FieldInput />
      </Field.Root>
    ),
    "aria behaviour": () => (
      <Field.Root required validationBehavior="aria" errorMessageAttribute="both" invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage>Bad</Field.ErrorMessage>
      </Field.Root>
    ),
    "no label": () => (
      <Field.Root>
        <FieldInput aria-label="Search" />
        <Field.ErrorMessage />
      </Field.Root>
    ),
  }

  it.each(Object.keys(trees))("%s hydrates with no warning and the same markup", async (name) => {
    const { calls, before, after } = await hydrate(trees[name]?.())
    expect(calls).toEqual([])
    // Relations the server could not know (a part rendered after the control) are added
    // after commit (aria-describedby, aria-errormessage); everything else is identical.
    expect(withoutDescribedBy(after)).toBe(withoutDescribedBy(before))
    for (const [, list] of after.matchAll(/aria-describedby="([^"]*)"/g)) {
      expect(list).not.toBe("")
      for (const id of (list ?? "").split(" ")) expect(after).toContain(`id="${id}"`)
    }
  })

  it("the generated ids are the server's after hydration; the Label still points at the control", async () => {
    const tree = trees["initially invalid with an error"]?.()
    const container = serverContainer(tree)
    const ids = () => Array.from(container.querySelectorAll("[id]"), (e) => e.id)
    const serverIds = ids()
    expect(serverIds.length).toBeGreaterThanOrEqual(4)
    // Relations are added after commit: the server HTML never points at a missing id.
    expect(container.querySelector("input")?.hasAttribute("aria-describedby")).toBe(false)
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree)
    })
    expect(ids()).toEqual(serverIds)
    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input.id).toBe(container.querySelector("label")?.getAttribute("for"))
    expect(input.getAttribute("aria-invalid")).toBe("true")
    const listed = (input.getAttribute("aria-describedby") ?? "").split(" ")
    expect(listed).toEqual([
      container.querySelector('[data-part="description"]')?.id,
      container.querySelector('[data-part="error-message"]')?.id,
    ])
    await act(async () => root?.unmount())
  })

  it("is interactive after hydration: a typed change validates", async () => {
    const tree = (
      <Field.Root validationMode="change" validate={(v) => (v ? "Nope" : null)}>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.ErrorMessage />
      </Field.Root>
    )
    const container = serverContainer(tree)
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree)
    })
    const input = screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement
    const { userEvent } = await import("@testing-library/user-event")
    await userEvent.type(input, "a")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(container.querySelector('[data-part="error-message"]')?.textContent).toBe("Nope")
    await act(async () => root?.unmount())
  })
})
