import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import { clipboardConnect, clipboardInputCopy } from "./clipboard.connect"
import { clipboardContract } from "./clipboard.contract"
import { clipboardMachine } from "./clipboard.machine"
import { clipboardMessages } from "./clipboard.messages"
import { clipboardMeta } from "./clipboard.meta"

const env = { platform: platforms.linux } as unknown as Parameters<typeof clipboardConnect>[1] // only platform is read

const api = (over: Partial<Parameters<typeof clipboardConnect>[0]> = {}) =>
  clipboardConnect(
    {
      instance: "i",
      state: "copied",
      value: "sk-123",
      disabled: true,
      messages: clipboardMessages,
      ids: { label: "l", input: "in", trigger: "t" },
      rendered: { label: true, input: true },
      ...over,
    },
    env,
  )

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

const focused = { focused: true, modality: "keyboard" as const }

describe("clipboard meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(clipboardContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(clipboardMeta.contract.actions).toEqual(actions)
    expect(clipboardMeta.contract.queries).toEqual(Object.keys(clipboardContract.queries))
    expect(clipboardMeta.contract.traits).toEqual(clipboardContract.traits)
    expect(Object.keys(clipboardMeta.states)).toEqual(Object.keys(clipboardMachine.def.states))
  })

  it("data attributes", () => {
    const a = api()
    const parts = {
      root: a.root(),
      label: a.label(),
      control: a.control(),
      input: a.input(focused),
      trigger: a.trigger({ ...focused, tag: "button" }),
      indicator: a.indicator(),
      "value-text": a.valueText(),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta = clipboardMeta.dataAttributes[part as keyof typeof clipboardMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("clipboard connect", () => {
  it("trigger: Copy, then the Label; never the state", () => {
    const t = { focused: false, modality: "pointer" as const, tag: "button" }
    expect(api({ disabled: false }).trigger(t)).toMatchObject({
      type: "button",
      id: "t",
      "aria-label": "Copy",
      "aria-labelledby": "t l",
    })
    for (const state of ["idle", "copying", "error"] as const) {
      expect(api({ state }).trigger(t)["aria-label"]).toBe("Copy")
    }
  })
  it("no IDREF to a part that is not rendered", () => {
    const bare = api({ rendered: { label: false, input: false } })
    const t = { focused: false, modality: "pointer" as const, tag: "button" }
    expect(bare.trigger(t)["aria-labelledby"]).toBeUndefined()
    expect(bare.label()["for"]).toBeUndefined()
    expect(bare.input(focused)["aria-labelledby"]).toBeUndefined()
    expect(api().label()["for"]).toBe("in")
  })
  it("input: read-only, the value, disabled", () => {
    expect(api().input(focused)).toMatchObject({
      readonly: true,
      value: "sk-123",
      disabled: true,
      "aria-labelledby": "l",
    })
    expect(api({ disabled: false }).input(focused)["disabled"]).toBeUndefined()
  })
  it("disabled trigger is natively disabled", () => {
    const t = { focused: false, modality: "pointer" as const, tag: "button" }
    expect(api().trigger(t)["disabled"]).toBe(true)
  })
  it("indicator is hidden from assistive technology", () => {
    expect(api().indicator()["aria-hidden"]).toBe("true")
  })
  it("an input copy is whole only for the whole, non-empty value", () => {
    const at = (start: number | null, end: number | null, value = "sk-123") =>
      clipboardInputCopy({ value, selectionStart: start, selectionEnd: end })
    expect(at(0, 6)).toEqual({ type: "INPUT.COPY", whole: true })
    expect(at(0, 3)).toEqual({ type: "INPUT.COPY", whole: false })
    expect(at(1, 6)).toEqual({ type: "INPUT.COPY", whole: false })
    expect(at(0, 0, "")).toEqual({ type: "INPUT.COPY", whole: false })
    expect(at(null, null)).toEqual({ type: "INPUT.COPY", whole: false })
  })
})
