import { describe, expect, it } from "vitest"
import {
  fillBlocks,
  fillTestedWith,
  renderAria,
  renderLlms,
  renderQuirks,
  renderTestedWith,
  type TestedWith,
} from "./docs-gen"

const pass: TestedWith = {
  component: "dialog",
  at: "NVDA",
  atVersion: "2026.3",
  browser: "Chrome",
  browserVersion: "141",
  os: "Windows 11",
  date: "2026-10-01",
  result: "pass",
}

describe("docs generator", () => {
  it("renders a component's passes, newest first, and nothing else", () => {
    const table = renderTestedWith(
      [
        pass,
        { ...pass, date: "2026-10-09", at: "JAWS", atVersion: "2026" },
        { ...pass, component: "menu" },
      ],
      "dialog",
    )
    const rows = table.split("\n").slice(2)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain("JAWS 2026")
    expect(renderTestedWith([], "dialog")).toContain("No manual screen-reader pass")
  })

  it("fills tested-with blocks in a page, idempotently", () => {
    const page = "# Dialog\n\n<!-- tested-with:dialog -->\nold\n<!-- /tested-with -->\n"
    const once = fillTestedWith(page, [pass])
    expect(once).toContain("| NVDA 2026.3 | Chrome 141 | Windows 11 | 2026-10-01 | pass |")
    expect(once).not.toContain("old")
    expect(fillTestedWith(once, [pass])).toBe(once)
  })

  it("lists each quirk with its bugs, test and the modules checking it", () => {
    const md = renderQuirks(
      [
        {
          id: "q",
          links: ["https://bugs.example/1"],
          test: "a.test.ts",
          removeWhen: "fixed",
          verified: "2026-10-14",
        },
      ],
      { q: ["packages/core/src/dom/press.ts"] },
    )
    expect(md).toContain("| `packages/core/src/dom/press.ts` | `q` |")
    expect(md).toContain("<https://bugs.example/1>")
    expect(md).toContain("Remove when: fixed")
  })

  it("summarises each guide for llms.txt from its title and first paragraph", () => {
    const txt = renderLlms([
      { path: "docs/guides/x.md", markdown: "# Focus\n\nWhen the ring\nshows.\n\nMore." },
    ])
    expect(txt).toContain("- [Focus](docs/guides/x.md): When the ring shows.")
  })

  it("leaves markers inside inline code and fenced blocks alone (they document the syntax)", () => {
    const page = [
      "```json",
      '{ "a": "`x`" }',
      "```",
      "Use `<!-- tested-with:dialog --><!-- /tested-with -->` in a page.",
      "```md",
      "<!-- tested-with:dialog -->",
      "<!-- /tested-with -->",
      "```",
      "<!-- tested-with:dialog -->",
      "<!-- /tested-with -->",
    ].join("\n")
    const filled = fillTestedWith(page, [pass])
    expect(filled.match(/\| NVDA 2026\.3/g)).toHaveLength(1)
    expect(filled.split("\n").slice(0, 8).join("\n")).toBe(page.split("\n").slice(0, 8).join("\n"))
  })

  it("fills aria blocks from the story's snapshot, and fails on a missing one", () => {
    const read = (id: string) => (id === "x--open" ? '- button "Details" [expanded]\n' : undefined)
    expect(
      fillBlocks("<!-- aria:x--open -->\n<!-- /aria -->", "aria", (id) => renderAria(id, read)),
    ).toBe('<!-- aria:x--open -->\n```yaml\n- button "Details" [expanded]\n```\n<!-- /aria -->')
    expect(() => renderAria("x--closed", read)).toThrow(/no ARIA snapshot for story x--closed/)
  })
})
