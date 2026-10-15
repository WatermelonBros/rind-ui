// The server render of a Text Field (no DOM): defaultValue, the Label's `for`, the Description.
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TextField } from "../index"

const attr = (out: string, tag: RegExp, name: string) =>
  new RegExp(` ${name}="([^"]*)"`).exec(tag.exec(out)?.[0] ?? "")?.[1]

describe("TextField server render", () => {
  const out = renderToString(
    <TextField.Root defaultValue="hello">
      <TextField.Label>Name</TextField.Label>
      <TextField.Input />
      <TextField.Description>Your full name</TextField.Description>
    </TextField.Root>,
  )

  it("renders the defaultValue in the input", () => {
    expect(attr(out, /<input[^>]*>/, "value")).toBe("hello")
  })

  it("the Label's for is the input's id", () => {
    const htmlFor = attr(out, /<label[^>]*>/, "for")
    expect(htmlFor).toBeTruthy()
    expect(htmlFor).toBe(attr(out, /<input[^>]*>/, "id"))
    expect(out).toContain('data-scope="text-field"')
  })

  it("renders the Description with an id", () => {
    expect(out).toContain("Your full name")
    expect(attr(out, /<[a-z]+[^>]*data-part="description"[^>]*>/, "id")).toBeTruthy()
  })

  it("a textarea renders its defaultValue as content", () => {
    const t = renderToString(
      <TextField.Root defaultValue="abc">
        <TextField.Label>Bio</TextField.Label>
        <TextField.Textarea rows={3} />
      </TextField.Root>,
    )
    expect(t).toMatch(/<textarea[^>]*>abc<\/textarea>/)
  })
})
