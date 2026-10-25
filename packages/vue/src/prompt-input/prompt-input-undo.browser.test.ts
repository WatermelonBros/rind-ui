// The Prompt Input's own draft writes are edits the user can undo (real keys, real engine).
import { screen } from "@testing-library/dom"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { PromptInput } from "../index"

const prompt =
  (history: readonly string[] = []) =>
  () =>
    h(PromptInput.Root, { history, onSubmit: () => {} }, () => [
      h(PromptInput.Label, null, () => "Message"),
      h(PromptInput.Textarea),
      h(PromptInput.Submit),
    ])

const box = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

// The Label's `for` follows the registered Textarea after Vue's flush. Wait on the attributes
// themselves: Firefox keeps a textarea's `labels` list from its first read, so a name lookup
// made before the `for` moves never sees the Label.
const labelled = () =>
  vi.waitFor(() => {
    const textarea = document.querySelector("textarea")
    if (!textarea || document.querySelector("label")?.htmlFor !== textarea.id) {
      throw new Error("the Label is not on the Textarea yet")
    }
    return box()
  })

describe("Vue Prompt Input undo", () => {
  it("undo a recall: Mod+Z after ArrowUp empties the draft again", async () => {
    mount(prompt(["one", "two"]))
    await userEvent.click(await labelled())
    await userEvent.keyboard("{ArrowUp}")
    await expect.poll(() => box().value).toBe("two")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("")
  })

  it("undo a send: Mod+Z after Enter brings the prompt back into the draft", async () => {
    mount(prompt())
    await userEvent.click(await labelled())
    await userEvent.keyboard("hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => box().value).toBe("")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("hello")
  })
})
