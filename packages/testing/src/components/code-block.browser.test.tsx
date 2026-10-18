// add-code-block 6.2: the tab stop follows real overflow (layout), after wrap and resize.
import { CodeBlock, RindProvider } from "@rind-ui/react"
import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { userEvent } from "vitest/browser"
import { fakeClipboard, getCodeBlock } from "../index"

const style = document.createElement("style")
style.textContent = `pre[data-part=content] { overflow: auto; white-space: pre; inline-size: 240px; margin: 0 }
pre[data-part=content][data-wrapped] { white-space: pre-wrap; overflow-wrap: anywhere }`
document.head.append(style)
afterEach(() => {
  document.body.innerHTML = ""
})

function Block({ code }: { readonly code: string }) {
  return (
    <RindProvider environment={{ clipboard: fakeClipboard() }}>
      <button type="button">Before</button>
      <CodeBlock.Root code={code}>
        <CodeBlock.Header>
          <CodeBlock.Title>demo.ts</CodeBlock.Title>
          <CodeBlock.WrapTrigger />
        </CodeBlock.Header>
        <CodeBlock.Content />
      </CodeBlock.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

describe("code-block overflow", () => {
  it("a block that fits is no tab stop", async () => {
    render(<Block code="short" />)
    screen.getByRole("button", { name: "Before" }).focus()
    await userEvent.tab()
    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }))
  })

  it("a scrolling block is a named tab stop; wrap removes it", async () => {
    render(<Block code={`const long = "${"x".repeat(200)}"`} />)
    const d = getCodeBlock(screen, { title: "demo.ts" })
    await waitFor(async () => expect(await d.isScrollable()).toBe(true))
    const group = screen.getByRole("group", { name: "demo.ts" })
    expect(group.tagName).toBe("PRE")
    await d.setWrapped(true)
    await waitFor(async () => expect(await d.isScrollable()).toBe(false))
    expect(screen.queryByRole("group")).toBeNull()
  })

  it("re-measures on resize", async () => {
    render(<Block code={"x".repeat(60)} />)
    const d = getCodeBlock(screen)
    const pre = document.querySelector("pre") as HTMLElement
    pre.style.inlineSize = "2000px"
    await waitFor(async () => expect(await d.isScrollable()).toBe(false))
    pre.style.inlineSize = "100px"
    await waitFor(async () => expect(await d.isScrollable()).toBe(true))
  })
})
