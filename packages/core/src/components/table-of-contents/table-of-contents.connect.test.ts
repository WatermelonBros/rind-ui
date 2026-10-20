import { describe, expect, it } from "vitest"
import {
  type TableOfContentsConnectInput,
  type TableOfContentsItem,
  tableOfContentsConnect,
} from "./table-of-contents.connect"
import { tableOfContentsContract } from "./table-of-contents.contract"
import { tableOfContentsMachine } from "./table-of-contents.machine"
import { tableOfContentsMessages } from "./table-of-contents.messages"
import { tableOfContentsMeta } from "./table-of-contents.meta"

const intro: TableOfContentsItem = { id: "intro", label: "Intro", depth: 0 }
const usage: TableOfContentsItem = { id: "usage", label: "Usage", depth: 1 }
const input = (over: Partial<TableOfContentsConnectInput> = {}): TableOfContentsConnectInput => ({
  instance: "t",
  value: "intro",
  visible: ["intro", "usage"],
  titled: false,
  ids: { title: "t-title" },
  marker: { top: 0, height: 20 },
  messages: tableOfContentsMessages,
  ...over,
})

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("table of contents meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(tableOfContentsContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(tableOfContentsMeta.contract.actions).toEqual(actions)
    expect(tableOfContentsMeta.contract.queries).toEqual(
      Object.keys(tableOfContentsContract.queries),
    )
    expect(Object.keys(tableOfContentsMeta.states)).toEqual(
      Object.keys(tableOfContentsMachine.def.states),
    )
  })

  it("data attributes", () => {
    const a = tableOfContentsConnect(input())
    const parts = {
      root: a.root(),
      title: a.title(),
      list: a.list(),
      item: a.item(intro),
      link: a.link(intro, { focused: true, modality: "keyboard" }),
      indicator: tableOfContentsConnect(input({ marker: null })).indicator(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        tableOfContentsMeta.dataAttributes[part as keyof typeof tableOfContentsMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("table of contents connect", () => {
  it("a named landmark; one current location; visible is not current", () => {
    const a = tableOfContentsConnect(input())
    expect(a.root()["aria-label"]).toBe("On this page")
    expect(tableOfContentsConnect(input({ titled: true })).root()).toMatchObject({
      "aria-labelledby": "t-title",
    })
    expect(a.link(intro)).toMatchObject({ href: "#intro", "aria-current": "location" })
    expect(a.link(usage)["aria-current"]).toBeUndefined()
    expect(a.link(usage)["data-visible"]).toBe("")
    expect(a.item(usage)["data-depth"]).toBe("1")
  })
})
