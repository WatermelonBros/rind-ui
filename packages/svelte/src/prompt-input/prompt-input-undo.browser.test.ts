// The Prompt Input's own draft writes are edits the user can undo (real keys, real engine).
import { screen } from "@testing-library/dom"
import { describe, expect, it, vi } from "vitest"
import { userEvent } from "vitest/browser"
import { mount } from "../../fixtures/mount"
import Prompt from "../../fixtures/prompt-input/prompt.svelte"

const prompt = (history: readonly string[] = []) =>
  mount(Prompt, { root: { history, onSubmit: () => {} }, undo: true } as never)

const box = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

describe("Svelte Prompt Input undo", () => {
  it("undo a recall: Mod+Z after ArrowUp empties the draft again", async () => {
    prompt(["one", "two"])
    // The Label's `for` follows the registered Textarea after Svelte's flush.
    await userEvent.click(await vi.waitFor(box))
    await userEvent.keyboard("{ArrowUp}")
    await expect.poll(() => box().value).toBe("two")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("")
  })

  it("undo a send: Mod+Z after Enter brings the prompt back into the draft", async () => {
    prompt()
    await userEvent.click(await vi.waitFor(box))
    await userEvent.keyboard("hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => box().value).toBe("")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("hello")
  })
})
