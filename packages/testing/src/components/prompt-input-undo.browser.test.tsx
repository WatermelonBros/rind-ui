// The Prompt Input's own draft writes are edits the user can undo (real keys, real engine).
import { PromptInput } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"

function Prompt(props: { readonly history?: readonly string[] }) {
  return (
    <PromptInput.Root history={props.history ?? []} onSubmit={() => {}}>
      <PromptInput.Label>Message</PromptInput.Label>
      <PromptInput.Textarea />
      <PromptInput.Submit />
    </PromptInput.Root>
  )
}

const box = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

describe("Prompt Input undo", () => {
  it("undo a recall: Mod+Z after ArrowUp empties the draft again", async () => {
    render(<Prompt history={["one", "two"]} />)
    await userEvent.click(box())
    await userEvent.keyboard("{ArrowUp}")
    await expect.poll(() => box().value).toBe("two")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("")
  })

  it("undo a send: Mod+Z after Enter brings the prompt back into the draft", async () => {
    render(<Prompt />)
    await userEvent.click(box())
    await userEvent.keyboard("hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => box().value).toBe("")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("hello")
  })
})
