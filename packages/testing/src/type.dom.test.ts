// Part.type: a text field still gets the click (caret at the end); a focused non-text part
// is typed into without one (a click would press it).
import { afterEach, expect, it } from "vitest"
import { domEnv } from "./index"

afterEach(() => {
  document.body.innerHTML = ""
})

it("a focused text input still gets the click: typing X into 'abc' gives 'abcX'", async () => {
  document.body.innerHTML =
    '<input aria-label="Name" value="abc" data-scope="field" data-part="input" data-instance="f1">'
  const input = document.querySelector("input") as HTMLInputElement
  input.focus()
  const env = domEnv().create({
    scope: "field",
    anchor: { role: "textbox", name: "Name" },
    modality: "keyboard",
  })
  await env.part("input").type("X")
  expect(input.value).toBe("abcX")
})

it("a focused non-text part is typed into without a click", async () => {
  document.body.innerHTML =
    '<div role="listbox" aria-label="L" data-scope="l" data-part="list" data-instance="1">' +
    '<div role="option" tabindex="0" data-scope="l" data-part="item" data-instance="1">One</div></div>'
  const option = document.querySelector('[role="option"]') as HTMLElement
  const seen: string[] = []
  for (const t of ["click", "keydown"]) option.addEventListener(t, () => seen.push(t))
  option.focus()
  const env = domEnv().create({
    scope: "l",
    anchor: { role: "listbox", name: "L" },
    modality: "keyboard",
  })
  await env.part("item").type("x")
  expect(seen).toContain("keydown")
  expect(seen).not.toContain("click")
})
