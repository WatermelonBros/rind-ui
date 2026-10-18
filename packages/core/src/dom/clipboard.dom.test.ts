// The DOM clipboard (spec clipboard): API at call time, fallback next to `near`, restore, reject.
import { afterEach, describe, expect, it, vi } from "vitest"
import { domClipboard } from "./clipboard"

const clip = () => domClipboard(() => document)
const setApi = (value: unknown) =>
  Object.defineProperty(navigator, "clipboard", { value, configurable: true })
/** execCommand stub: records the selected text and the textarea's parent. */
function stubExec(result: boolean) {
  const seen: { text: string; parent: Element | null }[] = []
  // jsdom has no execCommand; the stub stands in for the browser's copy.
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: () => {
      const area = document.activeElement as HTMLTextAreaElement
      seen.push({ text: area.value, parent: area.parentElement })
      return result
    },
  })
  return seen
}

afterEach(() => {
  setApi(undefined)
  document.body.innerHTML = ""
})

describe("domClipboard", () => {
  it("uses the Clipboard API when present", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    setApi({ writeText })
    await clip().writeText("abc")
    expect(writeText).toHaveBeenCalledWith("abc")
  })

  it("falls back without the API (docusaurus#11791)", async () => {
    setApi(undefined)
    const seen = stubExec(true)
    await expect(clip().writeText("a\n\tb")).resolves.toBeUndefined()
    expect(seen.map((s) => s.text)).toEqual(["a\n\tb"])
    expect(document.querySelector("textarea")).toBeNull()
  })

  it("inserts the temporary node next to near, inside a dialog (docusaurus#11109)", async () => {
    setApi({ writeText: () => Promise.reject(new Error("denied")) })
    document.body.innerHTML = "<dialog open><button>Copy</button></dialog>"
    const dialog = document.querySelector("dialog")
    const button = document.querySelector("button") as HTMLButtonElement
    const seen = stubExec(true)
    await clip().writeText("x", { near: button })
    expect(seen[0]?.parent).toBe(dialog)
  })

  it("restores focus and selection", async () => {
    document.body.innerHTML = "<p>hello world</p><button>Copy</button>"
    const button = document.querySelector("button") as HTMLButtonElement
    const text = document.querySelector("p")?.firstChild as Text
    button.focus()
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    stubExec(true)
    await clip().writeText("x", { near: button })
    expect(document.activeElement).toBe(button)
    const after = document.getSelection()?.getRangeAt(0)
    expect([after?.startContainer, after?.startOffset, after?.endOffset]).toEqual([text, 0, 5])
  })

  it("rejects when both paths fail, never throws synchronously", async () => {
    setApi({ writeText: () => Promise.reject(new Error("denied")) })
    stubExec(false)
    let threw = false
    let p: Promise<void> | undefined
    try {
      p = clip().writeText("x")
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
    await expect(p).rejects.toThrow("Copy failed")
  })
})
