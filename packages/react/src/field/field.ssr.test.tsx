// The server render of a Field (no DOM): ids agree and no relation dangles.
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FieldInput } from "../../../testing/fixtures/field/field-input"
import { Field } from "../index"

const html = (node: React.ReactNode) => renderToString(node)
const attr = (out: string, tag: RegExp, name: string) =>
  new RegExp(`${name}="([^"]*)"`).exec(tag.exec(out)?.[0] ?? "")?.[1]
const ids = (out: string) => [...out.matchAll(/ id="([^"]*)"/g)].map((m) => m[1])

describe("Field server render", () => {
  it("the Label's for is the control's id, which is the Field's control id", () => {
    const out = html(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
      </Field.Root>,
    )
    const htmlFor = attr(out, /<label[^>]*>/, "for")
    const inputId = attr(out, /<input[^>]*>/, "id")
    expect(htmlFor).toBeTruthy()
    expect(htmlFor).toBe(inputId)
    expect(out).toContain('data-scope="field"')
    expect(out).toContain('data-part="root"')
    expect(out).not.toMatch(/<div[^>]* role=/)
  })

  it("a consumer id on the control is the one the Label points at after hydration, not before", () => {
    const out = html(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput id="mine" />
      </Field.Root>,
    )
    expect(attr(out, /<input[^>]*>/, "id")).toBe("mine")
  })

  // Deliberate: relations to Description/ErrorMessage are added after commit, so the server HTML
  // never points at a missing id (same decision as Fieldset, ark#3707).
  it("the server HTML has no aria-describedby; the Description still renders with its id", () => {
    const out = html(
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>We never share it</Field.Description>
      </Field.Root>,
    )
    expect(attr(out, /<input[^>]*>/, "aria-describedby")).toBeUndefined()
    expect(attr(out, /<p[^>]*>/, "id")).toBeTruthy()
  })

  it("never points aria-describedby at a part that is not rendered", () => {
    for (const out of [
      html(
        <Field.Root>
          <Field.Label>Email</Field.Label>
          <FieldInput />
        </Field.Root>,
      ),
      html(
        <Field.Root>
          <FieldInput aria-label="Email" />
          <Field.ErrorMessage />
        </Field.Root>,
      ),
    ]) {
      const describedBy = attr(out, /<input[^>]*>/, "aria-describedby")
      expect(out).not.toContain('aria-describedby=""')
      for (const id of describedBy?.split(/\s+/).filter(Boolean) ?? []) {
        expect(ids(out)).toContain(id)
      }
    }
  })

  it("no Label rendered: no for and no aria-labelledby (ark#3824)", () => {
    const out = html(
      <Field.Root>
        <FieldInput aria-label="Email" />
      </Field.Root>,
    )
    expect(out).not.toContain("<label")
    expect(out).not.toContain("aria-labelledby")
    expect(out).toContain('aria-label="Email"')
  })

  it("an initial invalid={true} renders data-invalid, aria-invalid and the ErrorMessage", () => {
    const out = html(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>Hint</Field.Description>
        <Field.ErrorMessage>Enter a valid email</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(out).toContain("data-invalid")
    expect(out).not.toContain("data-valid")
    expect(out).toContain('aria-invalid="true"')
    expect(out).toContain("Enter a valid email")
  })

  it("an initial invalid={true} lists no aria-describedby on the server; every listed id exists", () => {
    const out = html(
      <Field.Root invalid>
        <Field.Label>Email</Field.Label>
        <FieldInput />
        <Field.Description>Hint</Field.Description>
        <Field.ErrorMessage>Enter a valid email</Field.ErrorMessage>
      </Field.Root>,
    )
    const describedBy = attr(out, /<input[^>]*>/, "aria-describedby")
    expect(describedBy).toBeUndefined()
    for (const id of describedBy?.split(" ") ?? []) expect(ids(out)).toContain(id)
  })

  it("invalid={false} renders data-valid; no prop renders neither", () => {
    expect(
      html(
        <Field.Root invalid={false}>
          <FieldInput aria-label="x" />
        </Field.Root>,
      ),
    ).toMatch(/data-part="root"[^>]* data-valid/)
    const plain = html(
      <Field.Root>
        <FieldInput aria-label="x" />
      </Field.Root>,
    )
    expect(plain).not.toMatch(/data-valid|data-invalid/)
  })

  it("an ErrorMessage renders nothing while the Field shows no error", () => {
    const out = html(
      <Field.Root>
        <FieldInput aria-label="x" />
        <Field.ErrorMessage>nope</Field.ErrorMessage>
      </Field.Root>,
    )
    expect(out).not.toContain("nope")
    expect(out).not.toContain("error-message")
  })

  it("state attributes: disabled, read-only and required reach the control", () => {
    const out = html(
      <Field.Root disabled readOnly required>
        <FieldInput aria-label="x" />
      </Field.Root>,
    )
    const input = /<input[^>]*>/.exec(out)?.[0] ?? ""
    expect(input).toContain("disabled")
    expect(input).toContain("readOnly")
    expect(input).toContain("required")
  })
})
