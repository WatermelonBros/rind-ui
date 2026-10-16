// Task 6.2: each Slider invariant fails on a broken page (unsorted values, NaN position,
// blur and refocus on a key, a double commit, an extra slider), naming what broke.
import { sliderInvariants } from "@rind-ui/core"
import { act } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { domEnv, sliderStepInvariants } from "../index"

afterEach(() => {
  document.body.innerHTML = ""
})

const a = (part: string, extra = "") =>
  `data-scope="slider" data-part="${part}" data-instance="s" ${extra}`
const thumb = (v: number, i: number, style = `--rind-slider-thumb-percent: ${v}%`) =>
  `<div ${a("thumb", `data-index="${i}" style="${style}"`)}><input type="range" ${a(
    "hidden-input",
    `aria-label="t${i}" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" value="${v}"`,
  )}></div>`
const page = (thumbs: string) => {
  document.body.innerHTML = `<div role="group" aria-label="Price" ${a("root")}><div ${a("control")}>${thumbs}</div></div>`
}
const env = () =>
  domEnv().create({
    scope: "slider",
    anchor: { role: "group", name: "Price" },
    modality: "keyboard",
  })

async function run(name: string) {
  const inv = sliderInvariants.find((i) => i.name === name)
  return inv?.check({
    env: env(),
    state: "idle",
    modality: "keyboard",
    props: {},
    values: {},
  } as never)
}

describe("slider invariants on broken pages", () => {
  it("unsorted values", async () => {
    page(thumb(80, 0) + thumb(20, 1))
    expect(await run("slider-values-valid")).toMatch(/not sorted/)
  })

  it("off-grid value", async () => {
    page(thumb(20.5, 0))
    expect(await run("slider-values-valid")).toMatch(/off the step grid/)
  })

  it("an input whose value disagrees with aria-valuenow", async () => {
    page(thumb(20, 0))
    ;(document.querySelector("input") as HTMLInputElement).value = "30"
    expect(await run("slider-input-mirrors-aria")).toMatch(/value 30, aria-valuenow 20/)
  })

  it("a NaN position", async () => {
    page(thumb(20, 0, "inset-inline-start: NaN%"))
    expect(await run("slider-no-nan-position")).toMatch(/NaN/)
  })

  it("a thumb without its input", async () => {
    page(`<div ${a("thumb", 'data-index="0"')}></div>`)
    expect(await run("slider-one-slider-per-thumb")).toMatch(/0 thumb inputs/)
  })

  it("blur and refocus during a key step", async () => {
    const steps = sliderStepInvariants()
    page(thumb(20, 0))
    const input = document.querySelector("input") as HTMLInputElement
    const other = document.createElement("button")
    document.body.append(other)
    input.focus()
    input.addEventListener("keydown", () => {
      other.focus()
      input.focus()
    })
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    })
    const inv = steps.invariants.find((i) => i.name === "slider-no-refocus-on-key")
    expect(await inv?.check({} as never)).toMatch(
      /focus moved during a key step: focusout on thumb input/,
    )
  })

  it("a double commit", async () => {
    let page = 0
    const steps = sliderStepInvariants({ commits: () => page, expectedCommits: () => 1 })
    page = 2
    const inv = steps.invariants.find((i) => i.name === "slider-commit-count")
    expect(await inv?.check({} as never)).toMatch(/ran 2 times, the oracle 1/)
  })

  it("an extra focusable slider inside", async () => {
    page(`<span role="slider" tabindex="0" aria-valuenow="1">${thumb(20, 0)}</span>`)
    const inv = sliderStepInvariants().invariants.find(
      (i) => i.name === "slider-only-thumb-inputs-focusable",
    )
    expect(await inv?.check({} as never)).toMatch(/span role="slider"/)
  })
})
