// R1.7: a full IME composition through the DOM adapter, seen by the keyboard module.
import { describeKey, platforms } from "@rind-ui/core"
import { afterEach, expect, it } from "vitest"
import { domEnv } from "./index"

afterEach(() => {
  document.body.innerHTML = ""
})

it("composes に, にほ, にほん and commits 日本; every keydown in between is composing", async () => {
  document.body.innerHTML =
    '<input aria-label="Name" data-scope="field" data-part="input" data-instance="f1">'
  const input = document.querySelector("input") as HTMLInputElement
  const events: string[] = []
  const keys: boolean[] = []
  let composing = false
  input.addEventListener("compositionstart", () => {
    composing = true
    events.push("compositionstart")
  })
  input.addEventListener("compositionend", (e) => {
    composing = false
    events.push(`compositionend:${e.data}`)
  })
  input.addEventListener("input", (e) => {
    if ((e as InputEvent).isComposing) events.push(`input:${input.value}`)
  })
  input.addEventListener("keydown", (e) => {
    if (composing) keys.push(describeKey(e, { platform: platforms.windows }).composing)
  })
  const env = domEnv().create({
    scope: "field",
    anchor: { role: "textbox", name: "Name" },
    modality: "keyboard",
  })
  await env.part("input").compose(["に", "にほ", "にほん"], "日本")
  expect(events).toEqual([
    "compositionstart",
    "input:に",
    "input:にほ",
    "input:にほん",
    // The commit is a last composing input, as browsers send it.
    "input:日本",
    "compositionend:日本",
  ])
  expect(input.value).toBe("日本")
  expect(keys.length).toBeGreaterThanOrEqual(3)
  expect(keys.every(Boolean)).toBe(true)
})
