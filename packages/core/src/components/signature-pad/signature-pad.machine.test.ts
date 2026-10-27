import { describe, expect, it } from "vitest"
import { platforms } from "../../dom/platform"
import type { Announcement } from "../../env"
import { createService } from "../../machine/service"
import { signaturePadConnect } from "./signature-pad.connect"
import { signaturePadContract } from "./signature-pad.contract"
import {
  EMPTY_SIGNATURE,
  type SignatureValue,
  signatureFormValue,
  signaturePath,
  signatureSvg,
} from "./signature-pad.geometry"
import { type SignaturePadProps, signaturePadMachine } from "./signature-pad.machine"
import { signaturePadMessages } from "./signature-pad.messages"
import { signaturePadMeta } from "./signature-pad.meta"

const pt = (x: number, y: number, time = 0) => ({ x, y, pressure: 0.5, time })
const box = { width: 400, height: 200 }

function make(over: Partial<SignaturePadProps> = {}) {
  const announced: Announcement[] = []
  const changes: SignatureValue[] = []
  const synced: string[] = []
  const props: SignaturePadProps = { id: "s1", onValueChange: (v) => changes.push(v), ...over }
  const env = {
    announcer: {
      announce: (a: Announcement) => {
        announced.push(a)
      },
      prepare: () => () => {},
      cancel: () => {},
    },
    locale: { locale: () => "en-US", dir: () => "ltr" as const, subscribe: () => () => {} },
    syncInput: (v: SignatureValue) => synced.push(signatureFormValue(v, "json", "#000")),
  }
  const s = createService(signaturePadMachine, props, env)
  s.start()
  const value = () => s.view(props).values.value as SignatureValue
  const draw = (id: number, points: [number, number][]) => {
    const [first, ...rest] = points
    if (!first) return
    s.send({ type: "POINTER.DOWN", pointerId: id, point: pt(...first), box })
    s.send({ type: "POINTER.MOVE", pointerId: id, points: rest.map((p) => pt(...p)) })
    s.send({ type: "POINTER.UP", pointerId: id })
  }
  return { s, announced, changes, synced, value, draw, state: () => s.getSnapshot().state }
}

describe("signature pad machine", () => {
  it("the value changes only when a stroke ends (Zag 156940f)", () => {
    const t = make()
    t.s.send({ type: "POINTER.DOWN", pointerId: 1, point: pt(10, 10), box })
    t.s.send({ type: "POINTER.MOVE", pointerId: 1, points: [pt(20, 20), pt(30, 25)] })
    expect(t.state()).toBe("drawing")
    expect(t.changes).toHaveLength(0)
    t.s.send({ type: "POINTER.UP", pointerId: 1 })
    expect(t.changes).toHaveLength(1)
    expect(t.value()).toMatchObject({ width: 400, height: 200 })
    expect(t.value().strokes[0]?.points).toHaveLength(3)
  })

  it("a second pointer never feeds the stroke (signature_pad#787)", () => {
    const t = make()
    t.s.send({ type: "POINTER.DOWN", pointerId: 1, point: pt(10, 10), box })
    t.s.send({ type: "POINTER.DOWN", pointerId: 2, point: pt(300, 10), box })
    t.s.send({ type: "POINTER.MOVE", pointerId: 2, points: [pt(350, 150)] })
    t.s.send({ type: "POINTER.MOVE", pointerId: 1, points: [pt(40, 40)] })
    t.s.send({ type: "POINTER.UP", pointerId: 2 })
    expect(t.state()).toBe("drawing")
    t.s.send({ type: "POINTER.UP", pointerId: 1 })
    expect(t.value().strokes).toHaveLength(1)
    expect(t.value().strokes[0]?.points.every((p) => p.x < 100)).toBe(true)
  })

  it("a cancelled stroke is still ink", () => {
    const t = make()
    t.s.send({ type: "POINTER.DOWN", pointerId: 1, point: pt(10, 10), box })
    t.s.send({ type: "POINTER.MOVE", pointerId: 1, points: [pt(50, 50)] })
    t.s.send({ type: "POINTER.CANCEL", pointerId: 1 })
    expect(t.value().strokes).toHaveLength(1)
  })

  it("points closer than minDistance are dropped", () => {
    const t = make({ minDistance: 5 })
    t.draw(1, [
      [10, 10],
      [11, 11],
      [12, 10],
      [30, 30],
    ])
    expect(t.value().strokes[0]?.points.map((p) => p.x)).toEqual([10, 30])
  })

  it("clear and undo announce, and do nothing while empty or drawing", () => {
    const t = make()
    t.s.send({ type: "CLEAR" })
    t.s.send({ type: "UNDO" })
    expect(t.announced).toHaveLength(0)
    t.draw(1, [
      [1, 1],
      [9, 9],
    ])
    t.draw(1, [
      [20, 20],
      [40, 40],
    ])
    t.s.send({ type: "POINTER.DOWN", pointerId: 1, point: pt(1, 1), box })
    t.s.send({ type: "UNDO" })
    expect(t.value().strokes).toHaveLength(2)
    t.s.send({ type: "POINTER.UP", pointerId: 1 })
    t.s.send({ type: "UNDO" })
    expect(t.value().strokes).toHaveLength(2)
    t.s.send({ type: "CLEAR" })
    expect(t.value()).toEqual(EMPTY_SIGNATURE)
    expect(t.announced.map((a) => a.message)).toEqual(["Last stroke removed", "Signature cleared"])
  })

  it("disabled and read-only do not draw", () => {
    for (const over of [{ disabled: true }, { readOnly: true }]) {
      const t = make(over)
      t.draw(1, [
        [1, 1],
        [9, 9],
      ])
      expect(t.value().strokes).toHaveLength(0)
    }
  })

  it("a frozen defaultValue is never mutated (react-signature-canvas#56)", () => {
    const defaultValue = Object.freeze({
      width: 100,
      height: 50,
      strokes: Object.freeze([
        Object.freeze({ points: Object.freeze([{ x: 1, y: 1, pressure: 0.5, t: 0 }]) }),
      ]),
    }) as SignatureValue
    const t = make({ defaultValue })
    t.draw(1, [
      [5, 5],
      [9, 9],
    ])
    expect(t.value().strokes).toHaveLength(2)
    expect(defaultValue.strokes).toHaveLength(1)
    // The stroke space stays the default's.
    expect(t.value().width).toBe(100)
  })

  it("form reset restores the default and syncs the input", () => {
    const t = make()
    t.draw(1, [
      [1, 1],
      [9, 9],
    ])
    t.s.send({ type: "RESET" })
    expect(t.value()).toEqual(EMPTY_SIGNATURE)
    expect(t.synced.at(-1)).toBe("")
  })
})

describe("signature pad geometry", () => {
  it("a dot for one point, no NaN for repeated points", () => {
    expect(signaturePath({ points: [{ x: 5, y: 5, pressure: 0.5, t: 0 }] })).toBe("M5 5h0.01")
    const same = { x: 3, y: 3, pressure: 0.5, t: 0 }
    expect(signaturePath({ points: [same, same, same] })).not.toContain("NaN")
    expect(signaturePath({ points: [] })).toBe("")
  })

  it("serialises a standalone SVG with the ink inlined, and the form values", () => {
    const value: SignatureValue = {
      width: 100,
      height: 50,
      strokes: [
        {
          points: [
            { x: 1, y: 1, pressure: 0.5, t: 0 },
            { x: 9, y: 9, pressure: 0.5, t: 8 },
          ],
        },
      ],
    }
    const svg = signatureSvg(value, { color: "rgb(1, 2, 3)" })
    expect(svg).toContain('viewBox="0 0 100 50"')
    expect(svg).toContain('stroke="rgb(1, 2, 3)"')
    expect(signatureFormValue(value, "svg", "#000")).toMatch(/^data:image\/svg\+xml,/)
    expect(JSON.parse(signatureFormValue(value, "json", "#000"))).toEqual(value)
    expect(signatureFormValue(EMPTY_SIGNATURE, "svg", "#000")).toBe("")
  })
})

const env = { platform: platforms.linux } as unknown as Parameters<typeof signaturePadConnect>[1] // only platform is read

const api = (over: Partial<Parameters<typeof signaturePadConnect>[0]> = {}) =>
  signaturePadConnect(
    {
      instance: "i",
      state: "idle",
      value: EMPTY_SIGNATURE,
      stroke: null,
      messages: signaturePadMessages,
      ids: { label: "l", control: "c", status: "st", input: "in" },
      rendered: { label: true, status: true },
      disabled: false,
      readOnly: false,
      required: true,
      invalid: false,
      formValue: "svg",
      inkColor: "#000",
      ...over,
    },
    env,
  )

const dataKeys = (p: Record<string, unknown>) =>
  Object.keys(p)
    .filter((k) => k.startsWith("data-") && p[k] !== undefined)
    .sort()

describe("signature pad meta matches the code", () => {
  it("contract and states", () => {
    const actions = Object.fromEntries(
      Object.entries(signaturePadContract.actions).map(([name, a]) => [
        name,
        [
          ...(["pointer", "keyboard", "touch"] as const).filter((m) => m in a),
          ...("pointer" in a && "keyboard" in a ? ["virtual"] : []),
        ],
      ]),
    )
    expect(signaturePadMeta.contract.actions).toEqual(actions)
    expect(signaturePadMeta.contract.queries).toEqual(Object.keys(signaturePadContract.queries))
    expect(Object.keys(signaturePadMeta.states)).toEqual(
      Object.keys(signaturePadMachine.def.states),
    )
  })

  it("data attributes", () => {
    const a = api({ invalid: true, disabled: true, readOnly: true })
    const t = { tag: "button", focused: true, modality: "keyboard" as const }
    const parts = {
      root: a.root(),
      label: a.label(),
      control: a.control(),
      segment: a.segment(),
      guide: a.guide(),
      status: a.status(),
      stroke: a.stroke("M0 0"),
      "clear-trigger": a.clearTrigger(t),
      "undo-trigger": a.undoTrigger(t),
    }
    for (const [part, props] of Object.entries(parts)) {
      const meta =
        signaturePadMeta.dataAttributes[part as keyof typeof signaturePadMeta.dataAttributes]
      expect(Object.keys(meta).sort(), part).toEqual(dataKeys(props))
    }
  })
})

describe("signature pad connect", () => {
  it("the Control is an image named by the Label, described by the Status, not a Tab stop", () => {
    expect(api().control()).toMatchObject({
      role: "img",
      tabindex: -1,
      "aria-labelledby": "l",
      "aria-describedby": "st",
    })
    expect(api().statusText).toBe("Not signed")
  })

  it("triggers: named with the Label, aria-disabled when empty, never hidden", () => {
    const t = { tag: "button", focused: false, modality: "pointer" as const }
    const clear = api().clearTrigger(t)
    expect(clear).toMatchObject({ type: "button", "aria-label": "Clear", "aria-disabled": "true" })
    expect(clear["aria-labelledby"]).toBe("c-clear-trigger l")
    expect(clear["hidden"]).toBeUndefined()
    expect(clear["disabled"]).toBeUndefined()
  })

  it("the hidden input is required, never readonly, empty when empty", () => {
    const input = api({ name: "sig" }).hiddenInput()
    expect(input).toMatchObject({ name: "sig", required: true, value: "" })
    expect(input["readonly"]).toBeUndefined()
  })

  it("the surface takes every touch and no selection", () => {
    expect(api().control()["style"]).toMatchObject({
      "touch-action": "none",
      "user-select": "none",
    })
  })

  it("the stroke being drawn is rendered last", () => {
    const value: SignatureValue = {
      width: 10,
      height: 10,
      strokes: [{ points: [{ x: 1, y: 1, pressure: 0.5, t: 0 }] }],
    }
    const a = api({ value, stroke: { points: [{ x: 5, y: 5, pressure: 0.5, t: 0 }] } })
    expect(a.paths).toEqual(["M1 1h0.01", "M5 5h0.01"])
    expect(a.strokeCount).toBe(1)
  })
})
