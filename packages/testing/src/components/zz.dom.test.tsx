import { Menu } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { it } from "vitest"
it("dbg", () => {
  render(<Menu.Root><label><Menu.Trigger>Wrapped</Menu.Trigger></label></Menu.Root>)
  console.log(document.body.innerHTML)
  console.log(screen.queryAllByRole("button").map(b=>b.outerHTML))
})
