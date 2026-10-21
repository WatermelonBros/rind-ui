import { describe, expect, it } from "vitest"
import { type Fetcher, handle, parseIndex, slugOf } from "./server"

const LLMS = `# rind-ui

> Headless React components.

## Quick start

pnpm add @rind-ui/react

## Guides

- [Focus and input modality](https://x/docs/focus-and-modality.md): Rings for keyboard users.

## Components

- [Combobox](https://x/docs/combobox.md): An input with a popup list of suggestions, autocomplete.
- [Date Field](https://x/docs/date-field.md): A date typed in segments.
`

const site = "https://x"
const fake: Fetcher = async (url) => {
  if (url === `${site}/llms.txt`) return LLMS
  if (url === `${site}/docs/date-field.md`) return "# Date Field\n\nSegments."
  throw new Error(`${url}: HTTP 404`)
}
const call = (name: string, args: Record<string, unknown> = {}) =>
  handle(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    fake,
    site,
  )
const body = (r: unknown) => JSON.stringify(r)

describe("rind-ui MCP server", () => {
  it("initializes with the tools capability and lists four tools", async () => {
    const init = await handle(
      { jsonrpc: "2.0", id: 0, method: "initialize", params: {} },
      fake,
      site,
    )
    expect(body(init)).toContain('"tools":{}')
    const list = await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, fake, site)
    expect(body(list).match(/"name":"/g)).toHaveLength(4)
  })

  it("answers no notification", async () => {
    expect(
      await handle({ jsonrpc: "2.0", method: "notifications/initialized" }, fake, site),
    ).toBeNull()
  })

  it("lists only components, with their summaries", async () => {
    const r = body(await call("list_components"))
    expect(r).toContain("- Combobox: An input")
    expect(r).not.toContain("Focus and input modality")
  })

  it("reads a component by name however it is written", async () => {
    for (const name of ["Date Field", "DateField", "date-field", "date-field.md"]) {
      expect(body(await call("get_component", { name }))).toContain("# Date Field")
    }
  })

  it("suggests close names for an unknown component instead of failing", async () => {
    expect(body(await call("get_component", { name: "date" }))).toContain(
      "Did you mean: Date Field",
    )
  })

  it("searches titles and summaries with every word", async () => {
    expect(body(await call("search_docs", { query: "autocomplete" }))).toContain("Combobox")
    expect(body(await call("search_docs", { query: "zebra" }))).toContain("Nothing matches")
  })

  it("starts with the summary and quick start, never the index", async () => {
    const r = body(await call("get_started"))
    expect(r).toContain("pnpm add @rind-ui/react")
    expect(r).not.toContain("Combobox")
  })

  it("reports an unknown tool and method as JSON-RPC errors", async () => {
    expect(body(await call("nope"))).toContain("-32602")
    expect(body(await handle({ jsonrpc: "2.0", id: 2, method: "nope" }, fake, site))).toContain(
      "-32601",
    )
  })

  it("parses the index and slugs names", () => {
    expect(parseIndex(LLMS).filter((e) => e.section === "Components")).toHaveLength(2)
    expect(slugOf("Date Field")).toBe("date-field")
    expect(slugOf("DateField")).toBe("date-field")
  })
})
