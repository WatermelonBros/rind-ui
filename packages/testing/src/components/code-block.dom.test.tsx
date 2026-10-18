// Code Block through its driver (spec code-block): input forms, lines, copy with the fake
// clipboard, wrap, collapse, a Tabs composition, messages, direction, server HTML.
import { trustedCodeHtml } from "@rind-ui/core"
import {
  CodeBlock,
  type CodeBlockRootProps,
  RindProvider,
  type RindProviderProps,
  Tabs,
} from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeClipboard, getCodeBlock, getTabs, recordingAnnouncer } from "../index"

afterEach(() => vi.restoreAllMocks())

const src = "const a = 1\n\n\tif (a) {\n  b()\n}"

function Block({
  title = "app.ts",
  withTitle = true,
  ...props
}: Partial<CodeBlockRootProps> & { readonly title?: string; readonly withTitle?: boolean }) {
  return (
    <CodeBlock.Root code={src} {...props}>
      <CodeBlock.Header>
        {withTitle ? <CodeBlock.Title>{title}</CodeBlock.Title> : null}
        <CodeBlock.CopyTrigger />
        <CodeBlock.WrapTrigger />
        <CodeBlock.CollapseTrigger />
      </CodeBlock.Header>
      <CodeBlock.Content />
    </CodeBlock.Root>
  )
}

function setup(node: React.ReactNode, env: RindProviderProps["environment"] = {}) {
  const rec = recordingAnnouncer()
  const clipboard = fakeClipboard()
  render(
    <RindProvider announcer={rec.announcer} environment={{ clipboard, ...env }}>
      {node}
    </RindProvider>,
  )
  return { log: rec.log, clipboard }
}

describe("code-block lines", () => {
  it("one line per source line, numbered, text without numbers", async () => {
    setup(<Block lineNumbers highlightLines={[[2, 3]]} />)
    const d = getCodeBlock(screen, { title: "app.ts" })
    // The query reads accessible text (whitespace collapsed); the DOM keeps it exactly.
    expect(await d.text()).toBe("const a = 1 if (a) { b() }")
    expect(document.querySelector("code")?.textContent).toBe(src)
    expect(await d.lineCount()).toBe(5)
    expect(await d.highlightedLines()).toEqual([2, 3])
    const pre = document.querySelector("pre") as HTMLElement
    expect(pre.getAttribute("dir")).toBe("ltr")
    expect(pre.hasAttribute("data-line-numbers")).toBe(true)
    expect(document.getElementById(pre.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Highlighted lines: 2 to 3",
    )
  })

  it("CRLF and a trailing newline (rehype-pretty-code#180)", async () => {
    setup(<Block code={"a\r\nb\r\n"} />)
    expect(await getCodeBlock(screen).lineCount()).toBe(2)
  })

  it("tokens render as text, html is injected per line", () => {
    setup(
      <>
        <Block title="t" code="<b>" lines={[[{ text: "<b>", className: "tok" }]]} />
        <Block title="h" code={"x\ny"} html={trustedCodeHtml('<i class="k">x</i>\ny')} />
      </>,
    )
    const [tokens, html] = [...document.querySelectorAll("code")]
    expect(tokens?.querySelector("b")).toBeNull()
    expect(tokens?.querySelector(".tok")?.textContent).toBe("<b>")
    expect(html?.querySelector("i.k")?.textContent).toBe("x")
    expect(html?.textContent).toBe("x\ny")
  })

  it("startLineNumber numbers data-line and highlights", async () => {
    setup(<Block startLineNumber={10} highlightLines={[11]} />)
    const d = getCodeBlock(screen)
    expect(await d.highlightedLines()).toEqual([11])
    expect(document.querySelector("code")?.getAttribute("style")).toContain(
      "--rind-code-block-start: 9",
    )
  })
})

describe("code-block built-in highlighting", () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: JS source under test, not a template
  const ts = "/* a\n   b */ const s = `x\n${y}`\r\n\n\tif (a < b) f('<b>')\n"

  it("tokens are data-token spans; plain text is not wrapped; nothing becomes markup", () => {
    setup(<Block code={ts} language="ts" lineNumbers />)
    const code = document.querySelector("code") as HTMLElement
    expect(code.querySelector("b")).toBeNull()
    expect(code.querySelector('[data-token="keyword"]')?.textContent).toBe("const")
    expect(code.querySelector('[data-token="function"]')?.textContent).toBe("f")
    expect([...code.querySelectorAll("[data-token]")].every((s) => s.childElementCount === 0)).toBe(
      true,
    )
    // A multi-line comment and template string keep their type on every line.
    const second = code.querySelector('[data-line="2"]') as HTMLElement
    expect(second.querySelector('[data-token="comment"]')?.textContent).toBe("   b */")
    const strings = (n: number) =>
      [...code.querySelectorAll(`[data-line="${n}"] [data-token="string"]`)].map(
        (s) => s.textContent,
      )
    expect(strings(2)).toEqual(["`", "x"])
    expect(strings(3)).toEqual(["`"])
  })

  it("lines, numbers and copy are the source's: the text is unchanged by tokens", async () => {
    const { clipboard } = setup(<Block code={ts} language="ts" highlightLines={[4]} />)
    const d = getCodeBlock(screen, { title: "app.ts" })
    const code = document.querySelector("code") as HTMLElement
    expect(code.textContent).toBe(ts.replace(/\r\n/g, "\n").replace(/\n$/, ""))
    expect(await d.lineCount()).toBe(5)
    expect(await d.highlightedLines()).toEqual([4])
    await d.copy()
    await d.settleCopy()
    expect(clipboard.copied).toEqual([ts])
  })

  it("an unknown language renders plain; lines and html win over language", () => {
    setup(
      <>
        <Block title="u" code="const a" language="cobol" />
        <Block
          title="t"
          code="const a"
          language="ts"
          lines={[[{ text: "const a", token: "string" }]]}
        />
      </>,
    )
    const [unknown, own] = [...document.querySelectorAll("code")]
    expect(unknown?.querySelector("[data-token]")).toBeNull()
    expect(unknown?.textContent).toBe("const a")
    expect(own?.querySelector('[data-token="string"]')?.textContent).toBe("const a")
    expect(own?.querySelector('[data-token="keyword"]')).toBeNull()
  })

  it("server HTML is highlighted and hydrates without a warning", async () => {
    const tree = (
      <StrictMode>
        <Block code={ts} language="tsx" />
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    expect(container.querySelector('[data-token="keyword"]')?.textContent).toBe("const")
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})

describe("code-block copy", () => {
  it("copies the exact source, announces once, keeps the name (docusaurus#11414)", async () => {
    const { log, clipboard } = setup(<Block />)
    const d = getCodeBlock(screen, { title: "app.ts" })
    await d.copy()
    await d.settleCopy()
    expect(await d.copyState()).toBe("copied")
    expect(clipboard.copied).toEqual([src])
    expect(log.map((a) => [a.message, a.priority])).toEqual([["Copied", "polite"]])
    expect(screen.getByRole("button", { name: "Copy code" }).dataset["state"]).toBe("copied")
  })

  it("a failed write is announced as a failure, never Copied", async () => {
    const { log, clipboard } = setup(<Block />)
    clipboard.set("reject")
    const d = getCodeBlock(screen)
    await d.copy()
    await d.settleCopy()
    expect(await d.copyState()).toBe("error")
    expect(log.map((a) => a.message)).toEqual(["Copy failed"])
  })

  it("returns to idle after the feedback duration (fake time)", async () => {
    vi.useFakeTimers() // fake-time: the feedback delay runs on the faked window timers
    try {
      setup(<Block copyFeedbackDuration={500} />)
      const d = getCodeBlock(screen)
      await act(async () => {
        screen.getByRole("button", { name: "Copy code" }).click()
      })
      expect(await d.copyState()).toBe("copied")
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      expect(await d.copyState()).toBe("idle")
    } finally {
      vi.useRealTimers()
    }
  })

  it("a collapsed block copies every line", async () => {
    const long = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n")
    const { clipboard } = setup(<Block code={long} maxLines={10} />)
    const d = getCodeBlock(screen)
    expect(await d.isExpanded()).toBe(false)
    await d.copy()
    await d.settleCopy()
    expect(clipboard.copied[0]?.split("\n")).toHaveLength(40)
  })

  it("Italian messages from the provider", async () => {
    const rec = recordingAnnouncer()
    render(
      <RindProvider
        announcer={rec.announcer}
        environment={{ clipboard: fakeClipboard() }}
        messages={{ "code-block": { copied: "Copiato", copy: "Copia" } }}
      >
        <Block />
      </RindProvider>,
    )
    const d = getCodeBlock(screen)
    expect(screen.getByRole("button", { name: "Copia" })).toBeTruthy()
    await d.copy()
    await d.settleCopy()
    expect(rec.log.map((a) => a.message)).toEqual(["Copiato"])
  })
})

describe("code-block wrap and collapse", () => {
  it("wrap is a toggle button with a constant name", async () => {
    const onWrappedChange = vi.fn()
    setup(<Block onWrappedChange={onWrappedChange} />)
    const d = getCodeBlock(screen)
    await d.setWrapped(true)
    const button = screen.getByRole("button", { name: "Wrap lines" })
    expect(button.getAttribute("aria-pressed")).toBe("true")
    expect(document.querySelector("pre")?.hasAttribute("data-wrapped")).toBe(true)
    expect(onWrappedChange).toHaveBeenCalledWith(true, expect.anything())
  })

  it("collapse: aria-expanded flips, the name stays; hidden when short", async () => {
    const long = Array.from({ length: 12 }, (_, i) => `l${i}`).join("\n")
    setup(<Block code={long} maxLines={5} />)
    const d = getCodeBlock(screen)
    const button = screen.getByRole("button", { name: "Show all lines" })
    expect(button.getAttribute("aria-expanded")).toBe("false")
    expect(button.getAttribute("aria-controls")).toBe(document.querySelector("pre")?.id)
    await d.setExpanded(true)
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("button", { name: "Show all lines" })).toBe(button)
  })

  it("no collapse for a short block", () => {
    setup(<Block maxLines={10} />)
    expect(screen.queryByRole("button", { name: "Show all lines" })).toBeNull()
    expect(document.querySelector("[data-collapsible]")).toBeNull()
  })
})

describe("code-block in Tabs (several files)", () => {
  it("each panel's copy button copies its file", async () => {
    const { clipboard } = setup(
      <Tabs.Root defaultValue="app">
        <Tabs.List aria-label="Files">
          <Tabs.Tab value="app">app.tsx</Tabs.Tab>
          <Tabs.Tab value="css">styles.css</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="app">
          <Block withTitle={false} code="<App />" />
        </Tabs.Panel>
        <Tabs.Panel value="css">
          <Block withTitle={false} code="a { color: red }" />
        </Tabs.Panel>
      </Tabs.Root>,
    )
    await getTabs(screen, { name: "Files" }).select("styles.css")
    const panel = screen.getByRole("tabpanel")
    const d = getCodeBlock(panel)
    await d.copy()
    await d.settleCopy()
    expect(clipboard.copied).toEqual(["a { color: red }"])
  })
})

describe("code-block direction and server HTML", () => {
  it("code stays ltr in an rtl page", () => {
    setup(
      <div dir="rtl">
        <Block />
      </div>,
    )
    expect(document.querySelector("pre")?.getAttribute("dir")).toBe("ltr")
    expect(document.querySelector("[data-part=header]")?.hasAttribute("dir")).toBe(false)
  })

  it("server HTML reads without JavaScript: code, lines, description, no tab stop", () => {
    const html = renderToString(<Block lineNumbers highlightLines={[3]} />)
    const doc = new DOMParser().parseFromString(html, "text/html")
    expect(doc.querySelector("code")?.textContent).toBe(src)
    expect(doc.querySelectorAll("[data-line]")).toHaveLength(5)
    expect(doc.querySelector('[data-line="3"]')?.hasAttribute("data-highlighted")).toBe(true)
    expect(doc.body.textContent).toContain("Highlighted lines: 3")
    expect(doc.querySelector("pre")?.hasAttribute("tabindex")).toBe(false)
    expect(doc.querySelectorAll("button:not([hidden])")).toHaveLength(2)
  })

  it("hydrates in Strict Mode with html input and no warning", async () => {
    const tree = (
      <StrictMode>
        <Block code={"x\ny"} html={trustedCodeHtml(['<i class="k">x</i>', "y"])} />
      </StrictMode>
    )
    const container = document.createElement("div")
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (e) => error(String(e)) })
    })
    await waitFor(() => expect(container.querySelector("i.k")).not.toBeNull())
    expect(error.mock.calls).toEqual([])
    await act(async () => root?.unmount())
    container.remove()
  })
})
