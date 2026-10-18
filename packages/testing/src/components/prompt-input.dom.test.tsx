// Prompt Input scenarios (prompt-input spec) through the driver where an action exists; in
// jsdom and in real browsers.

import { platforms } from "@rind-ui/core"
import {
  PromptInput,
  type PromptInputRootProps,
  RindProvider,
  usePromptInput,
} from "@rind-ui/react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { getPromptInput, installAnnouncementLog } from "../index"

function Prompt(props: Partial<PromptInputRootProps> & { readonly count?: number }) {
  const { count, ...rest } = props
  return (
    <PromptInput.Root {...rest}>
      <PromptInput.Label>Message</PromptInput.Label>
      <PromptInput.Attachments />
      <PromptInput.Textarea placeholder="Ask anything" />
      {count === undefined ? null : <PromptInput.CharacterCount max={count} />}
      <PromptInput.AttachTrigger />
      <PromptInput.Submit />
    </PromptInput.Root>
  )
}

const textarea = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement
const submitButton = () =>
  document.querySelector('[data-scope="prompt-input"][data-part="submit"]') as HTMLButtonElement
const pi = (o?: Parameters<typeof getPromptInput>[2]) =>
  getPromptInput(screen, { name: "Message" }, o)
const user = async () => (await import("@testing-library/user-event")).userEvent.setup()
const messages = () => installAnnouncementLog().map((a) => a.message)
const spec = (name: string, type = "text/plain") => ({ name, type, content: "x" })
/**
 * A paste or drag event carrying a plain clipboard / transfer object: browsers refuse a
 * non-DataTransfer in the constructors, so the property is defined on a bare Event.
 */
function dispatch(el: Element, type: string, props: Readonly<Record<string, unknown>>) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value })
  act(() => {
    el.dispatchEvent(event)
  })
  return event
}

describe("Prompt Input", () => {
  it("minimal: a form with a named textbox and a Send button that is aria-disabled while empty", () => {
    render(<Prompt />)
    expect(textarea().closest("form")).not.toBeNull()
    expect(textarea().tagName).toBe("TEXTAREA")
    expect(submitButton().getAttribute("aria-label")).toBe("Send message")
    expect(submitButton().getAttribute("aria-disabled")).toBe("true")
    expect(submitButton().type).toBe("submit")
    expect(textarea().getAttribute("enterkeyhint")).toBe("send")
  })

  it("Enter sends once with the text, clears the draft and keeps focus; Shift+Enter is a newline", async () => {
    const onSubmit = vi.fn()
    render(<Prompt onSubmit={onSubmit} />)
    const u = await user()
    await u.click(textarea())
    await u.keyboard("a{Shift>}{Enter}{/Shift}b")
    expect(textarea().value).toBe("a\nb")
    expect(onSubmit).not.toHaveBeenCalled()
    await u.keyboard("{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ text: "a\nb", attachments: [] })
    expect(onSubmit.mock.calls[0]?.[1].formData.get("message")).toBe("a\nb")
    expect(textarea().value).toBe("")
    expect(document.activeElement).toBe(textarea())
  })

  it("the caret in the middle: Enter sends the whole text and inserts no newline (lobehub#9176)", async () => {
    const onSubmit = vi.fn()
    render(<Prompt onSubmit={onSubmit} />)
    await pi().type("hello world")
    act(() => textarea().setSelectionRange(5, 5))
    const u = await user()
    await u.keyboard("{Enter}")
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("hello world")
  })

  it("a composing Enter commits and does not send; the next Enter sends (ai-elements#21)", async () => {
    const onSubmit = vi.fn()
    render(<Prompt onSubmit={onSubmit} />)
    await pi().compose("日本語", true)
    await act(() => textarea().focus())
    fireEvent.keyDown(textarea(), { key: "Enter", keyCode: 229, isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea().value).toBe("日本語")
    await pi().submit()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("streaming: Enter does not send (ai-elements#439); Submit is Stop, stops once, keeps focus", async () => {
    const onSubmit = vi.fn()
    const onStop = vi.fn()
    render(<Prompt onSubmit={onSubmit} onStop={onStop} status="streaming" />)
    expect(await pi().state()).toBe("streaming")
    await pi().type("next")
    await pi({ modality: "keyboard" }).submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(textarea().value).toBe("next")
    expect(await pi().submitName()).toBe("Stop response")
    expect(submitButton().type).toBe("button")
    const before = messages().length
    await pi({ modality: "keyboard" }).stop()
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(await pi().state()).toBe("stopped")
    expect(document.activeElement).toBe(submitButton())
    await waitFor(() => expect(messages().slice(before)).toContain("Response stopped"))
  })

  it("the AI SDK status walk: submitting, streaming, idle; Submit's name follows", async () => {
    function Chat() {
      const [status, setStatus] = useState<"idle" | "submitting" | "streaming">("idle")
      return (
        <>
          <Prompt status={status} onSubmit={() => setStatus("submitting")} />
          <button type="button" onClick={() => setStatus("streaming")}>
            stream
          </button>
          <button type="button" onClick={() => setStatus("idle")}>
            done
          </button>
        </>
      )
    }
    render(<Chat />)
    await pi().fill("q")
    await pi().submit()
    expect(await pi().state()).toBe("submitting")
    const u = await user()
    await u.click(screen.getByRole("button", { name: "stream" }))
    expect(await pi().state()).toBe("streaming")
    await u.click(screen.getByRole("button", { name: "done" }))
    expect(await pi().state()).toBe("idle")
    expect(await pi().submitName()).toBe("Send message")
  })

  it("a rejected send restores text and attachments and is announced assertively (ai-elements#126)", async () => {
    render(<Prompt onSubmit={() => Promise.reject(new Error("offline"))} />)
    await pi().attach([spec("photo.jpg", "image/jpeg")])
    await pi().fill("look")
    const before = installAnnouncementLog().length
    await pi().submit()
    await waitFor(async () => expect(await pi().value()).toBe("look"))
    expect(await pi().attachments()).toEqual(["photo.jpg"])
    await waitFor(() =>
      expect(
        installAnnouncementLog()
          .slice(before)
          .find((a) => a.message === "Message not sent")?.priority,
      ).toBe("assertive"),
    )
  })

  it("attach through the chooser: a named chip, announced; remove by its button (aui#7268)", async () => {
    const onAttachmentsChange = vi.fn()
    render(<Prompt onAttachmentsChange={onAttachmentsChange} />)
    const before = messages().length
    await pi().attach([spec("q1.pdf", "application/pdf"), spec("q2.pdf", "application/pdf")])
    expect(await pi().attachments()).toEqual(["q1.pdf", "q2.pdf"])
    expect(screen.getByRole("toolbar", { name: "Attachments" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove q1.pdf" }).tabIndex).toBe(-1)
    await waitFor(() => expect(messages().slice(before)).toContain("2 files attached"))
    expect(onAttachmentsChange).toHaveBeenLastCalledWith(expect.any(Array), { reason: "add" })
    await pi().removeAttachment("q1.pdf")
    expect(await pi().attachments()).toEqual(["q2.pdf"])
    await waitFor(() => expect(messages()).toContain("q1.pdf removed"))
    // Files alone are submittable.
    expect(await pi().canSubmit()).toBe(true)
  })

  it("accept with an extension; a mixed selection reports the refused file (ai-elements#501, #511)", async () => {
    const onReject = vi.fn()
    render(<Prompt accept=".xlsx" onReject={onReject} />)
    await pi().attach([spec("q3.xlsx", ""), spec("notes.txt")])
    expect(await pi().attachments()).toEqual(["q3.xlsx"])
    expect(onReject.mock.calls[0]?.[0].map((r: { reason: string }) => r.reason)).toEqual(["ACCEPT"])
    await waitFor(() => expect(messages()).toContain("notes.txt is not an accepted file type"))
  })

  it("paste: a clipboard image is attached; spreadsheet cells (text and a picture) paste as text", () => {
    render(<Prompt />)
    const image = new File(["x"], "shot.png", { type: "image/png" })
    dispatch(textarea(), "paste", {
      clipboardData: { files: [image], items: [], types: ["Files"], getData: () => "" },
    })
    expect(screen.getByText("shot.png")).toBeTruthy()
    const cells = dispatch(textarea(), "paste", {
      clipboardData: {
        files: [new File(["x"], "cells.png", { type: "image/png" })],
        items: [],
        types: ["text/plain", "Files"],
        getData: (t: string) => (t === "text/plain" ? "1\t2" : ""),
      },
    })
    // Not prevented: the browser inserts the text.
    expect(cells.defaultPrevented).toBe(false)
    expect(screen.queryByText("cells.png")).toBeNull()
  })

  it("drop: files only, data-dragging until the drop, one attachment per file", () => {
    render(<Prompt />)
    const root = textarea().closest("form") as HTMLFormElement
    const file = new File(["x"], "drop.txt", { type: "text/plain" })
    const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" }
    const enter = dispatch(root, "dragenter", { dataTransfer })
    expect(enter.defaultPrevented).toBe(true)
    expect(root.hasAttribute("data-dragging")).toBe(true)
    // Moving onto a child fires dragleave on the Root: still dragging.
    dispatch(root, "dragleave", { dataTransfer, relatedTarget: textarea() })
    expect(root.hasAttribute("data-dragging")).toBe(true)
    // Prevented, so the tab does not navigate to the file.
    expect(dispatch(textarea(), "dragover", { dataTransfer }).defaultPrevented).toBe(true)
    expect(dispatch(textarea(), "drop", { dataTransfer }).defaultPrevented).toBe(true)
    expect(root.hasAttribute("data-dragging")).toBe(false)
    expect(screen.getAllByText("drop.txt").length).toBe(1)
    dispatch(root, "dragenter", { dataTransfer: { types: ["text/plain"], files: [] } })
    expect(root.hasAttribute("data-dragging")).toBe(false)
  })

  it("Backspace in the empty draft arms, then removes the last attachment", async () => {
    render(<Prompt defaultAttachments={[{ id: "a", name: "a.png" }]} />)
    const u = await user()
    await u.click(textarea())
    await u.keyboard("{Backspace}")
    expect(await pi().attachments()).toEqual(["a.png"])
    await u.keyboard("{Backspace}")
    expect(await pi().attachments()).toEqual([])
  })

  it("history: ArrowUp recalls from an empty draft, ArrowDown returns; multi-line drafts keep the arrows", async () => {
    render(<Prompt history={["one", "two"]} />)
    await pi().recall("older")
    expect(await pi().value()).toBe("two")
    await pi().recall("older")
    expect(await pi().value()).toBe("one")
    act(() => textarea().setSelectionRange(3, 3))
    await pi().recall("newer")
    expect(await pi().value()).toBe("two")
    act(() => textarea().setSelectionRange(3, 3))
    await pi().recall("newer")
    expect(await pi().value()).toBe("")
    await pi().fill("a\nb")
    act(() => textarea().setSelectionRange(3, 3))
    await pi().recall("older")
    expect(await pi().value()).toBe("a\nb")
  })

  it("a token limit: over it nothing is sent, aria-invalid, data-over-limit", async () => {
    const onSubmit = vi.fn()
    render(<Prompt onSubmit={onSubmit} count={5} />)
    await pi().type("123456")
    expect(await pi().isOverLimit()).toBe(true)
    expect(textarea().getAttribute("aria-invalid")).toBe("true")
    expect(await pi().characterCount()).toBe("6/5")
    await pi().submit()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("disabled: textarea, Submit and AttachTrigger disabled; a drop adds nothing (aui#9164)", () => {
    render(<Prompt disabled />)
    expect(textarea().disabled).toBe(true)
    expect(submitButton().disabled).toBe(true)
    expect(screen.getByRole("button", { name: "Attach files" })).toHaveProperty("disabled", true)
    const dataTransfer = {
      types: ["Files"],
      files: [new File(["x"], "d.txt")],
      dropEffect: "none",
    }
    dispatch(textarea().closest("form") as HTMLFormElement, "drop", { dataTransfer })
    expect(screen.queryByText("d.txt")).toBeNull()
  })

  it("mod+enter mode: Enter is a newline, Ctrl+Enter sends", async () => {
    const onSubmit = vi.fn()
    render(
      <RindProvider environment={{ platform: platforms.windows }}>
        <Prompt onSubmit={onSubmit} submitKey="mod+enter" />
      </RindProvider>,
    )
    expect(textarea().getAttribute("enterkeyhint")).toBe("enter")
    const u = await user()
    await u.click(textarea())
    await u.keyboard("a{Enter}b")
    expect(textarea().value).toBe("a\nb")
    await u.keyboard("{Control>}{Enter}{/Control}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("a handler that prevents Enter (an open popup) wins", async () => {
    const onSubmit = vi.fn()
    render(
      <PromptInput.Root onSubmit={onSubmit}>
        <PromptInput.Label>Message</PromptInput.Label>
        <PromptInput.Textarea onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
        <PromptInput.Submit />
      </PromptInput.Root>,
    )
    await pi().type("hi")
    await pi({ modality: "keyboard" }).submit()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("a press on the Root's padding focuses the Textarea (prompt-kit#55)", async () => {
    render(<Prompt />)
    const u = await user()
    await u.pointer({ keys: "[MouseLeft]", target: textarea().closest("form") as HTMLElement })
    expect(document.activeElement).toBe(textarea())
  })

  it("usePromptInput: a suggestion fills the draft; submit goes through the same guard", async () => {
    const onSubmit = vi.fn()
    function Suggest() {
      const prompt = usePromptInput()
      return (
        <button type="button" onClick={() => prompt.setValue("Explain this")}>
          Suggest
        </button>
      )
    }
    render(
      <PromptInput.Root onSubmit={onSubmit}>
        <PromptInput.Label>Message</PromptInput.Label>
        <PromptInput.Textarea />
        <Suggest />
        <PromptInput.Submit />
      </PromptInput.Root>,
    )
    const u = await user()
    await u.click(screen.getByRole("button", { name: "Suggest" }))
    expect(textarea().value).toBe("Explain this")
    await pi().submit()
    expect(onSubmit.mock.calls[0]?.[0].text).toBe("Explain this")
  })

  it("a Textarea with only a placeholder warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <PromptInput.Root>
        <PromptInput.Textarea placeholder="Ask anything" />
        <PromptInput.Submit />
      </PromptInput.Root>,
    )
    expect(warn.mock.calls.some(([m]) => String(m).includes("no accessible name"))).toBe(true)
    warn.mockRestore()
  })
})
