import type { Modality } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { createDriver } from "../../src/index"
import { counterContract, toggleContract } from "./press.contract"
import { CounterButton, ToggleButton } from "./press.react"

const modalities: Modality[] = ["pointer", "keyboard", "touch", "virtual"]

describe("press fixture drivers", () => {
  it.each(modalities)("toggle via %s: one activation per press", async (modality) => {
    render(<ToggleButton>Bold</ToggleButton>)
    const bold = createDriver(toggleContract, screen, "Bold").via(modality)
    await bold.press()
    expect(await bold.pressed()).toBe(true)
    await bold.press()
    expect(await bold.pressed()).toBe(false)
  })

  it.each(modalities)("counter via %s: each press counts once", async (modality) => {
    let presses = 0
    render(<CounterButton onPress={() => presses++}>Add</CounterButton>)
    const add = createDriver(counterContract, screen, "Add").via(modality)
    await add.press()
    await add.press()
    expect(await add.count()).toBe(2)
    expect(presses).toBe(2)
  })

  it.each(modalities)("a disabled toggle ignores %s", async (modality) => {
    render(<ToggleButton disabled>Bold</ToggleButton>)
    const bold = createDriver(toggleContract, screen, "Bold").via(modality)
    await bold.press()
    expect(await bold.pressed()).toBe(false)
  })
})
