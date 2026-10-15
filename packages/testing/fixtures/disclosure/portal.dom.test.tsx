import { RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { Disclosure } from "./disclosure.react"

it("content portalled to the end of body carries the root's dir and lang", () => {
  render(
    <RindProvider locale="ar">
      <Disclosure.Root defaultOpen>
        <Disclosure.Trigger>Details</Disclosure.Trigger>
        <Disclosure.Content portal>Body text</Disclosure.Content>
      </Disclosure.Root>
    </RindProvider>,
  )
  const content = screen.getByText("Body text")
  expect(content.parentElement).toBe(document.body)
  expect(content.getAttribute("dir")).toBe("rtl")
  expect(content.getAttribute("lang")).toBe("ar")
})
