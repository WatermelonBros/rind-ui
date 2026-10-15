// Adapter inputs the accessibility invariants need (a11y-test-tooling).
import { platforms } from "@rind-ui/core"
import { afterEach, describe, expect, it } from "vitest"
import { domEnv } from "./index"

afterEach(() => {
  document.body.innerHTML = ""
})

function keys(el: Element) {
  const seen: {
    type: string
    key: string
    composing: boolean
    keyCode: number
    meta: boolean
    ctrl: boolean
  }[] = []
  for (const type of ["keydown", "keyup"]) {
    el.addEventListener(type, (e) => {
      const k = e as KeyboardEvent
      seen.push({
        type,
        key: k.key,
        composing: k.isComposing,
        keyCode: k.keyCode,
        meta: k.metaKey,
        ctrl: k.ctrlKey,
      })
    })
  }
  return seen
}

describe("adapter inputs", () => {
  it("a composing Enter: keydown and keyup with isComposing true and keyCode 229", async () => {
    document.body.innerHTML = '<input aria-label="Prompt">'
    const input = document.querySelector("input") as HTMLInputElement
    const seen = keys(input)
    const env = domEnv().create({
      scope: "x",
      anchor: { role: "textbox", name: "Prompt" },
      modality: "keyboard",
    })
    await env.find({ role: "textbox", name: "Prompt" }).press("Enter", { composing: true })
    expect(seen.map((e) => [e.type, e.key, e.composing, e.keyCode])).toEqual([
      ["keydown", "Enter", true, 229],
      ["keyup", "Enter", true, 229],
    ])
    expect(input.value).toBe("")
  })

  it("inert content counts as hidden", async () => {
    document.body.innerHTML = "<div inert><button>Inside</button></div>"
    const env = domEnv().create({ scope: "x", anchor: { text: "Inside" }, modality: "pointer" })
    expect(await env.find({ text: "Inside" }).exists()).toBe(false)
  })

  it("hover with pointerType touch", async () => {
    document.body.innerHTML = "<button>Info</button>"
    const button = document.querySelector("button") as HTMLButtonElement
    const types: string[] = []
    button.addEventListener("pointerenter", (e) => types.push((e as PointerEvent).pointerType))
    const env = domEnv().create({ scope: "x", anchor: { text: "Info" }, modality: "touch" })
    await env.find({ text: "Info" }).hover({ pointerType: "touch" })
    expect(types).toEqual(["touch"])
  })

  it("F10 and ContextMenu keys; mod follows the platform", async () => {
    document.body.innerHTML = "<button>Menu</button>"
    const button = document.querySelector("button") as HTMLButtonElement
    const seen = keys(button)
    const apple = domEnv().create({
      scope: "x",
      anchor: { text: "Menu" },
      modality: "keyboard",
      platform: platforms.apple,
    })
    const part = apple.find({ text: "Menu" })
    await part.press("F10", { shift: true })
    await part.press("ContextMenu")
    await part.press("Home", { mod: true })
    const windows = domEnv().create({
      scope: "x",
      anchor: { text: "Menu" },
      modality: "keyboard",
      platform: platforms.windows,
    })
    await windows.find({ text: "Menu" }).press("Home", { mod: true })
    const downs = seen.filter(
      (e) => e.type === "keydown" && !["Shift", "Meta", "Control"].includes(e.key),
    )
    expect(downs.map((e) => e.key)).toEqual(["F10", "ContextMenu", "Home", "Home"])
    expect([downs[2]?.meta, downs[2]?.ctrl]).toEqual([true, false])
    expect([downs[3]?.meta, downs[3]?.ctrl]).toEqual([false, true])
  })
})
