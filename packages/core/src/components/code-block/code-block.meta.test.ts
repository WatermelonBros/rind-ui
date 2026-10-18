import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { codeBlockConnect } from "./code-block.connect"
import { codeBlockContract } from "./code-block.contract"
import { parseRanges } from "./code-block.lines"
import { codeBlockMachine } from "./code-block.machine"
import { codeBlockMessages } from "./code-block.messages"
import { codeBlockMeta } from "./code-block.meta"

const env = { platform: platforms.linux } as unknown as Parameters<typeof codeBlockConnect>[1] // only platform is read

const api = (over: Partial<Parameters<typeof codeBlockConnect>[0]> = {}) =>
  codeBlockConnect(
    {
      instance: "i",
      copyState: "copied",
      wrapped: true,
      expanded: true,
      collapsible: true,
      scrollable: true,
      lineNumbers: true,
      startLineNumber: 1,
      maxLines: 10,
      highlighted: parseRanges([2]),
      highlightRuns: [[2, 2]],
      messages: codeBlockMessages,
      titleId: "t",
      contentId: "c",
      descriptionId: "d",
      ...over,
    },
    env,
  )

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("code-block meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(codeBlockContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(codeBlockMeta.contract.actions).toEqual(actions)
    expect(codeBlockMeta.contract.queries).toEqual(Object.keys(codeBlockContract.queries))
    expect(codeBlockMeta.contract.traits).toEqual(codeBlockContract.traits)
    expect(Object.keys(codeBlockMeta.states)).toEqual(Object.keys(codeBlockMachine.def.states))
  })

  it("data attributes", () => {
    const a = api()
    const t = { tag: "button", named: false, focused: true, modality: "keyboard" as const }
    const parts = {
      root: a.root(),
      header: a.header(),
      title: a.title("t"),
      "copy-trigger": a.copyTrigger(t),
      "wrap-trigger": a.wrapTrigger(t),
      "collapse-trigger": a.collapseTrigger(t),
      content: a.content(),
      code: a.code(),
      line: a.line(2),
      token: a.token("keyword"),
      description: a.description(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = codeBlockMeta.dataAttributes[part as keyof typeof codeBlockMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("code-block connect", () => {
  it("content: a named group and tab stop only while scrollable", () => {
    const fits = api({ scrollable: false, titleId: undefined }).content()
    expect(fits["tabindex"]).toBeUndefined()
    expect(fits["role"]).toBeUndefined()
    expect(fits["aria-label"]).toBeUndefined()
    expect(fits["dir"]).toBe("ltr")
    const scrolls = api({ titleId: undefined }).content()
    expect(scrolls).toMatchObject({ tabindex: 0, role: "group", "aria-label": "Code" })
    expect(api().content()).toMatchObject({ "aria-labelledby": "t", "aria-describedby": "d" })
    expect(api().content()["aria-label"]).toBeUndefined()
  })
  it("description only with highlighted lines", () => {
    expect(api().descriptionText).toBe("Highlighted lines: 2")
    const none = api({ highlighted: new Set(), highlightRuns: [] })
    expect(none.content()["aria-describedby"]).toBeUndefined()
    expect(none.descriptionText).toBe("")
  })
  it("triggers keep their names; state in aria", () => {
    const t = { tag: "button", named: false, focused: true, modality: "keyboard" as const }
    expect(api().copyTrigger(t)).toMatchObject({
      "aria-label": "Copy code",
      "data-state": "copied",
    })
    expect(api().copyTrigger({ ...t, named: true })["aria-label"]).toBeUndefined()
    expect(api({ wrapped: false }).wrapTrigger(t)).toMatchObject({
      "aria-pressed": "false",
      "aria-label": "Wrap lines",
    })
    expect(api({ expanded: false }).collapseTrigger(t)).toMatchObject({
      "aria-expanded": "false",
      "aria-controls": "c",
      "aria-label": "Show all lines",
    })
    expect(api({ collapsible: false }).collapseTrigger(t)["hidden"]).toBe(true)
  })
  it("lines and the counter start", () => {
    expect(api().line(2)).toMatchObject({ "data-line": "2", "data-highlighted": "" })
    expect(api().line(3)["data-highlighted"]).toBeUndefined()
    expect(api({ startLineNumber: 10 }).code()["style"]).toEqual({ "--rind-code-block-start": "9" })
  })
})
