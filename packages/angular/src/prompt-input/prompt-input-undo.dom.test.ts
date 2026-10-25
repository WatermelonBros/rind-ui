// The Prompt Input's own draft writes are edits the user can undo (real keys, real engine:
// browser only).
import { Component } from "@angular/core"
import { screen } from "@testing-library/dom"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../../fixtures/mount"
import { PromptInput } from "./index"

const browser = !navigator.userAgent.includes("jsdom")

/** The history the next prompt recalls. */
let past: readonly string[] = []

@Component({
  selector: "rind-f",
  imports: [PromptInput],
  template: `<form rindPromptInputRoot [history]="history" [submitHandler]="send">
    <label rindPromptInputLabel>Message</label>
    <textarea rindPromptInputTextarea></textarea>
    <button rindPromptInputSubmit></button>
  </form>`,
})
class Prompt {
  readonly history = past
  readonly send = () => {}
}

const box = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement

describe.runIf(browser)("Angular Prompt Input undo", () => {
  it("undo a recall: Mod+Z after ArrowUp empties the draft again", async () => {
    const { userEvent } = await import("vitest/browser")
    past = ["one", "two"]
    await mount(Prompt)
    await userEvent.click(await vi.waitFor(box))
    await userEvent.keyboard("{ArrowUp}")
    await expect.poll(() => box().value).toBe("two")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("")
  })
  it("undo a send: Mod+Z after Enter brings the prompt back into the draft", async () => {
    const { userEvent } = await import("vitest/browser")
    past = []
    await mount(Prompt)
    await userEvent.click(await vi.waitFor(box))
    await userEvent.keyboard("hello")
    await userEvent.keyboard("{Enter}")
    await expect.poll(() => box().value).toBe("")
    await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}")
    await expect.poll(() => box().value).toBe("hello")
  })
})
